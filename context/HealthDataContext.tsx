import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from './AuthContext';
import {
  buildDefaultLocalDate,
  bootstrapAuthenticatedUser,
  clearActiveRepositoryUser,
  getActiveProfile,
  getLastSuccessfulSyncAt,
  initializeHealthRepository,
  listFoodEntries,
  listInsightFacts,
  listNutritionScans,
  listPendingSyncQueue,
  listPhysicalActivitySessions,
  listStepSummaries,
  listDailyLogs,
  mapDailyLogsToSavedLogs,
  mapNutritionScansToStoredScans,
  mapStepSummariesToStepPoints,
  recalculateStepSummaryCalories,
  refreshInsightSnapshots,
  saveDailyLog,
  saveFoodEntry as persistFoodEntry,
  saveNutritionScan as persistNutritionScan,
  savePhysicalActivitySession as persistPhysicalActivitySession,
  setActiveRepositoryUser,
  updateUserProfile as persistUserProfile,
  upsertUserProfile,
  upsertStepSummary,
} from '../repositories/healthRepository';
import {
  estimateCaloriesBurnedFromActivity,
  getPhysicalActivityOption,
} from '../services/activityCalories';
import {
  pauseAndroidStepCounterTracking,
  resumeAndroidStepCounterTracking,
} from '../services/androidStepCounter';
import { syncHealthData } from '../services/sync';
import { estimateCaloriesBurnedFromSteps } from '../services/calorieEstimate';
import { toLocalDateString } from '../services/date';
import { useStepCounter } from '../hooks/useStepCounter';
import type {
  DailyLog,
  FoodEntry,
  FoodEntryInput,
  HealthSyncResult,
  InsightFact,
  NutritionScanInput,
  ActivePhysicalActivityTimer,
  PhysicalActivityOptionKey,
  PhysicalActivitySession,
  SyncState,
  UserProfile,
} from '../types/data';
import type {
  LogFormState,
  MoodLevel,
  SaveLogResult,
  SavedLog,
  SleepQuality,
  StepPoint,
} from '../types/health';
import type { StoredNutritionScan } from '../types/nutri';
import type { ProfileUpdateInput } from '../types/auth';

const STEP_GOAL = 9000;
const DEFAULT_SLEEP_QUALITY: SleepQuality = 4;
const DEFAULT_WATER_INTAKE = '2.2';
const DEFAULT_SLEEP_HOURS = '7.5';
const DEFAULT_MOOD: MoodLevel = 'Good';
const VALID_MOODS: MoodLevel[] = ['Great', 'Good', 'Okay', 'Low'];

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toStorageNumber(
  value: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return roundToSingleDecimal(Math.min(max, Math.max(min, parsed)));
}

function formatMetricInput(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function normalizeMood(value: unknown): MoodLevel {
  if (VALID_MOODS.includes(value as MoodLevel)) {
    return value as MoodLevel;
  }
  return DEFAULT_MOOD;
}

function normalizeSleepQuality(value: unknown): SleepQuality {
  const parsed = Math.round(Number(value));
  if (parsed >= 1 && parsed <= 5) {
    return parsed as SleepQuality;
  }
  return DEFAULT_SLEEP_QUALITY;
}

function createLogFormFromLog(log: SavedLog | null): LogFormState {
  return {
    symptoms: log?.symptoms ?? '',
    diet: log?.diet ?? '',
    waterIntake: formatMetricInput(log?.waterIntake ?? Number(DEFAULT_WATER_INTAKE)),
    mood: log?.mood ?? DEFAULT_MOOD,
    sleepQuality: log?.sleepQuality ?? DEFAULT_SLEEP_QUALITY,
    sleepHours: formatMetricInput(log?.sleepHours ?? Number(DEFAULT_SLEEP_HOURS)),
  };
}

type HealthDataContextValue = {
  stepsToday: number;
  caloriesBurnedToday: number;
  stepGoal: number;
  stepProgress: number;
  stepStatus: string;
  stepStatusMessage: string;
  weeklySteps: StepPoint[];
  stepSummaries: ReturnType<typeof mapStepSummariesToStepPoints>;
  logForm: LogFormState;
  logs: SavedLog[];
  dailyLogs: DailyLog[];
  foodEntries: FoodEntry[];
  activitySessions: PhysicalActivitySession[];
  activeActivityTimer: ActivePhysicalActivityTimer | null;
  nutritionScans: StoredNutritionScan[];
  insightFacts: InsightFact[];
  profile: UserProfile | null;
  pendingSyncCount: number;
  syncState: SyncState;
  lastSyncedAt: string | null;
  syncError: string | null;
  isStorageReady: boolean;
  refreshData: (recomputeInsights?: boolean) => Promise<void>;
  syncNow: () => Promise<HealthSyncResult | null>;
  saveProfile: (updates: ProfileUpdateInput) => Promise<void>;
  setLogField: <K extends keyof LogFormState>(field: K, value: LogFormState[K]) => void;
  saveLog: () => Promise<{ result: SaveLogResult; sync: HealthSyncResult }>;
  saveFoodEntry: (input: FoodEntryInput) => Promise<void>;
  startTimedActivity: (optionKey: PhysicalActivityOptionKey) => Promise<void>;
  stopTimedActivity: () => Promise<PhysicalActivitySession>;
  saveNutritionScan: (input: NutritionScanInput) => Promise<void>;
};

const HealthDataContext = createContext<HealthDataContextValue | null>(null);

export function HealthDataProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { user, isLoggedIn, isReady: isAuthReady } = useAuth();
  const { stepsToday, goal, progress, status, statusMessage } =
    useStepCounter(STEP_GOAL);
  const [logForm, setLogForm] = useState<LogFormState>(createLogFormFromLog(null));
  const [logs, setLogs] = useState<SavedLog[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [foodEntries, setFoodEntries] = useState<FoodEntry[]>([]);
  const [activitySessions, setActivitySessions] = useState<PhysicalActivitySession[]>([]);
  const [activeActivityTimer, setActiveActivityTimer] =
    useState<ActivePhysicalActivityTimer | null>(null);
  const [weeklySteps, setWeeklySteps] = useState<StepPoint[]>([]);
  const [nutritionScans, setNutritionScans] = useState<StoredNutritionScan[]>([]);
  const [insightFacts, setInsightFacts] = useState<InsightFact[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const lastForegroundSyncAtRef = useRef(0);
  const lastStepSyncAtRef = useRef(0);
  const todayLocalDate = toLocalDateString(new Date());

  const refreshData = useCallback(async (recomputeInsights = false) => {
    if (!user) {
      setProfile(null);
      setDailyLogs([]);
      setLogs([]);
      setFoodEntries([]);
      setActivitySessions([]);
      setActiveActivityTimer(null);
      setWeeklySteps([]);
      setNutritionScans([]);
      setInsightFacts([]);
      setPendingSyncCount(0);
      setSyncState('idle');
      setLastSyncedAt(null);
      setSyncError(null);
      setLogForm(createLogFormFromLog(null));
      return;
    }

    if (recomputeInsights) {
      await refreshInsightSnapshots();
    }

    const [
      nextProfile,
      nextDailyLogs,
      nextFoodEntries,
      initialStepSummaries,
      nextActivitySessions,
      nextNutritionScans,
      nextInsightFacts,
      pendingQueue,
    ] = await Promise.all([
      getActiveProfile(),
      listDailyLogs(),
      listFoodEntries(),
      listStepSummaries(),
      listPhysicalActivitySessions(),
      listNutritionScans(),
      listInsightFacts(),
      listPendingSyncQueue(),
    ]);

    let nextStepSummaries = initialStepSummaries;

    if (
      nextProfile?.weightKg &&
      nextProfile.weightKg > 0 &&
      nextStepSummaries.some(
        summary => summary.stepCount > 0 && summary.caloriesBurned <= 0,
      )
    ) {
      await recalculateStepSummaryCalories(nextProfile);
      nextStepSummaries = await listStepSummaries();
    }

    const nextLogs = mapDailyLogsToSavedLogs(nextDailyLogs);

    setProfile(nextProfile);
    setDailyLogs(nextDailyLogs);
    setLogs(nextLogs);
    setFoodEntries(nextFoodEntries);
    setActivitySessions(nextActivitySessions);
    setWeeklySteps(mapStepSummariesToStepPoints(nextStepSummaries));
    setNutritionScans(mapNutritionScansToStoredScans(nextNutritionScans));
    setInsightFacts(nextInsightFacts);
    setPendingSyncCount(pendingQueue.length);
    setLastSyncedAt(await getLastSuccessfulSyncAt());
    setLogForm(current => {
      if (current.diet || current.symptoms || current.waterIntake !== DEFAULT_WATER_INTAKE) {
        return current;
      }
      return createLogFormFromLog(nextLogs[0] ?? null);
    });
  }, [user]);

  const applySyncResult = useCallback((result: HealthSyncResult | null) => {
    if (!result) {
      return;
    }

    setSyncState(result.state);
    setSyncError(result.error ?? null);
    if (result.lastSyncedAt) {
      setLastSyncedAt(result.lastSyncedAt);
    }
  }, []);

  const syncNow = useCallback(async (): Promise<HealthSyncResult | null> => {
    if (!user) {
      return null;
    }

    setSyncState('syncing');
    setSyncError(null);
    const result = await syncHealthData(user.id, 'full');
    applySyncResult(result);
    await refreshData(false);
    return result;
  }, [applySyncResult, refreshData, user]);

  useEffect(() => {
    if (user || !activeActivityTimer) {
      return;
    }

    const resume = async () => {
      try {
        await resumeAndroidStepCounterTracking();
      } catch {
        // Ignore resume failures during sign-out cleanup.
      } finally {
        setActiveActivityTimer(null);
      }
    };

    resume();
  }, [activeActivityTimer, user]);

  useEffect(() => {
    let isActive = true;

    const hydrate = async () => {
      try {
        await initializeHealthRepository();
        if (!isActive || !isAuthReady) {
          return;
        }

        if (!isLoggedIn || !user) {
          clearActiveRepositoryUser();
          await refreshData();
          return;
        }

        setActiveRepositoryUser(user.id);
        await bootstrapAuthenticatedUser(user);
        const initialPull = await syncHealthData(user.id, 'pull');
        applySyncResult(initialPull);
        const existingProfile = await getActiveProfile();
        const syncedProfile = await upsertUserProfile({
          fullName: user.fullName,
          email: user.email,
          avatarLabel: user.avatarLabel,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          age: existingProfile?.age ?? null,
          heightCm: existingProfile?.heightCm ?? null,
          weightKg: existingProfile?.weightKg ?? null,
          goal: existingProfile?.goal ?? null,
        });
        await recalculateStepSummaryCalories(syncedProfile);
        setProfile(syncedProfile);
        const result = await syncHealthData(user.id, 'full');
        applySyncResult(result);
        await refreshData();
      } finally {
        if (isActive) {
          setIsStorageReady(true);
        }
      }
    };

    hydrate();

    return () => {
      isActive = false;
    };
  }, [applySyncResult, isAuthReady, isLoggedIn, refreshData, user]);

  useEffect(() => {
    if (!isLoggedIn || !user || !isStorageReady) {
      return;
    }

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        return;
      }

      const now = Date.now();
      if (now - lastForegroundSyncAtRef.current < 30_000) {
        return;
      }
      lastForegroundSyncAtRef.current = now;

      const refresh = async () => {
        setSyncState('syncing');
        const result = await syncHealthData(user.id, 'full');
        applySyncResult(result);
        await refreshData(false);
      };

      refresh();
    });

    return () => {
      subscription.remove();
    };
  }, [applySyncResult, isLoggedIn, isStorageReady, refreshData, user]);

  useEffect(() => {
    if (!isStorageReady || !user || status !== 'granted' || stepsToday <= 0) {
      return;
    }

    const persistLiveSteps = async () => {
      const today = toLocalDateString(new Date());
      await upsertStepSummary(today, stepsToday, 'sensor');
      if (Date.now() - lastStepSyncAtRef.current >= 60_000) {
        lastStepSyncAtRef.current = Date.now();
        const syncResult = await syncHealthData(user.id, 'push');
        applySyncResult(syncResult);
      }

      setWeeklySteps(current => {
        const existingPoint = current.find(
          point => point.isoDate.slice(0, 10) === today,
        );
        const stepCaloriesBurned = estimateCaloriesBurnedFromSteps(
          stepsToday,
          profile?.weightKg ?? null,
          profile?.heightCm ?? null,
        );
        const activityCaloriesBurned = existingPoint?.activityCaloriesBurned ?? 0;
        const nextPoint: StepPoint = {
          id: `step-summary-${today}`,
          isoDate: new Date(`${today}T12:00:00`).toISOString(),
          day: new Date(`${today}T12:00:00`).toLocaleDateString([], {
            weekday: 'short',
          }),
          steps: stepsToday,
          stepCaloriesBurned,
          activityCaloriesBurned,
          caloriesBurned: stepCaloriesBurned + activityCaloriesBurned,
        };
        const existingIndex = current.findIndex(point =>
          point.isoDate.slice(0, 10) === nextPoint.isoDate.slice(0, 10),
        );

        if (existingIndex >= 0) {
          return current.map((point, index) =>
            index === existingIndex ? nextPoint : point,
          );
        }

        return [...current.slice(-6), nextPoint];
      });
    };

    persistLiveSteps();
  }, [applySyncResult, isStorageReady, profile?.heightCm, profile?.weightKg, status, stepsToday, user]);

  const setLogField = <K extends keyof LogFormState>(
    field: K,
    value: LogFormState[K],
  ) => {
    setLogForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const saveLogHandler = async (): Promise<{
    result: SaveLogResult;
    sync: HealthSyncResult;
  }> => {
    if (!user) {
      throw new Error('You need to be signed in before saving a log.');
    }

    const fallbackLog = logs[0] ?? null;
    const saveResult = await saveDailyLog(buildDefaultLocalDate(), {
      mood: normalizeMood(logForm.mood),
      sleepQuality: normalizeSleepQuality(logForm.sleepQuality),
      sleepHours: toStorageNumber(
        logForm.sleepHours,
        fallbackLog?.sleepHours ?? Number(DEFAULT_SLEEP_HOURS),
        0,
        16,
      ),
      hydrationLiters: toStorageNumber(
        logForm.waterIntake,
        fallbackLog?.waterIntake ?? Number(DEFAULT_WATER_INTAKE),
        0,
        8,
      ),
      symptomSummary: logForm.symptoms.trim(),
      foodNote: logForm.diet.trim(),
    });

    await refreshData(true);
    const syncResult = await syncHealthData(user.id, 'full');
    applySyncResult(syncResult);
    await refreshData(false);
    return {
      result: saveResult,
      sync: syncResult,
    };
  };

  const saveFoodEntryHandler = async (input: FoodEntryInput) => {
    if (!user) {
      throw new Error('You need to be signed in before saving a food entry.');
    }

    await persistFoodEntry(input);
    await refreshData(true);
    const result = await syncHealthData(user.id, 'full');
    applySyncResult(result);
    await refreshData(false);
  };

  const startTimedActivityHandler = async (optionKey: PhysicalActivityOptionKey) => {
    if (activeActivityTimer) {
      throw new Error('A timed activity is already running.');
    }

    if (!profile?.weightKg || profile.weightKg <= 0) {
      throw new Error('Add your weight in Profile before recording timed activities.');
    }

    const option = getPhysicalActivityOption(optionKey);
    if (!option) {
      throw new Error('Unknown activity type selected.');
    }

    try {
      await pauseAndroidStepCounterTracking();
    } catch {
      if (status === 'granted') {
        throw new Error('Unable to pause step tracking right now. Please try again.');
      }
    }

    setActiveActivityTimer({
      optionKey: option.key,
      startedAt: new Date().toISOString(),
    });
  };

  const stopTimedActivityHandler = async (): Promise<PhysicalActivitySession> => {
    if (!user) {
      throw new Error('You need to be signed in before saving an activity.');
    }

    if (!activeActivityTimer) {
      throw new Error('No timed activity is currently running.');
    }

    const option = getPhysicalActivityOption(activeActivityTimer.optionKey);
    if (!option) {
      throw new Error('The active activity type is no longer available.');
    }

    if (!profile?.weightKg || profile.weightKg <= 0) {
      throw new Error('Add your weight in Profile before recording timed activities.');
    }

    const startedAt = activeActivityTimer.startedAt;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      1,
      Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
    );
    const caloriesBurned = estimateCaloriesBurnedFromActivity(
      option.metValue,
      durationSeconds,
      profile.weightKg,
    );

    try {
      const session = await persistPhysicalActivitySession({
        localDate: toLocalDateString(new Date(startedAt)),
        startedAt,
        endedAt,
        category: option.category,
        optionKey: option.key,
        title: option.title,
        intensityLabel: option.intensityLabel,
        metValue: option.metValue,
        durationSeconds,
        caloriesBurned,
      });
      setActiveActivityTimer(null);
      await refreshData(true);
      const result = await syncHealthData(user.id, 'full');
      applySyncResult(result);
      await refreshData(false);
      return session;
    } finally {
      try {
        await resumeAndroidStepCounterTracking();
      } catch {
        // Keep the workout save flow from failing on resume cleanup.
      }
    }
  };

  const saveNutritionScanHandler = async (input: NutritionScanInput) => {
    if (!user) {
      throw new Error('You need to be signed in before saving a nutrition scan.');
    }

    await persistNutritionScan(input);
    await refreshData(true);
    const result = await syncHealthData(user.id, 'full');
    applySyncResult(result);
    await refreshData(false);
  };

  const saveProfileHandler = async (updates: ProfileUpdateInput) => {
    if (!user) {
      throw new Error('You need to be signed in before saving your profile.');
    }

    const updatedProfile = await persistUserProfile({
      age: updates.age ?? undefined,
      heightCm: updates.heightCm ?? undefined,
      weightKg: updates.weightKg ?? undefined,
      goal: updates.goal ?? undefined,
    });

    if (updatedProfile) {
      setProfile(updatedProfile);
      setWeeklySteps(current =>
        current.map(point => ({
          ...point,
          stepCaloriesBurned: estimateCaloriesBurnedFromSteps(
            point.steps,
            updatedProfile.weightKg ?? null,
            updatedProfile.heightCm ?? null,
          ),
          caloriesBurned:
            estimateCaloriesBurnedFromSteps(
              point.steps,
              updatedProfile.weightKg ?? null,
              updatedProfile.heightCm ?? null,
            ) + point.activityCaloriesBurned,
        })),
      );
    }

    await refreshData(true);
    const result = await syncHealthData(user.id, 'full');
    applySyncResult(result);
    await refreshData(false);
  };

  const value: HealthDataContextValue = {
    stepsToday,
    caloriesBurnedToday: (() => {
      const todaysStoredPoint = weeklySteps.find(
        point => point.isoDate.slice(0, 10) === todayLocalDate,
      );
      const storedSteps = todaysStoredPoint?.steps ?? 0;
      const effectiveSteps =
        status === 'granted'
          ? Math.max(stepsToday, storedSteps)
          : storedSteps;

      if (profile?.weightKg && effectiveSteps > 0) {
        return (
          estimateCaloriesBurnedFromSteps(
            effectiveSteps,
            profile.weightKg,
            profile.heightCm ?? null,
          ) + (todaysStoredPoint?.activityCaloriesBurned ?? 0)
        );
      }

      return todaysStoredPoint?.caloriesBurned ?? 0;
    })(),
    stepGoal: goal,
    stepProgress: progress,
    stepStatus: status,
    stepStatusMessage: statusMessage,
    weeklySteps,
    stepSummaries: weeklySteps,
    logForm,
    logs,
    dailyLogs,
    foodEntries,
    activitySessions,
    activeActivityTimer,
    nutritionScans,
    insightFacts,
    profile,
    pendingSyncCount,
    syncState,
    lastSyncedAt,
    syncError,
    isStorageReady,
    refreshData,
    syncNow,
    saveProfile: saveProfileHandler,
    setLogField,
    saveLog: saveLogHandler,
    saveFoodEntry: saveFoodEntryHandler,
    startTimedActivity: startTimedActivityHandler,
    stopTimedActivity: stopTimedActivityHandler,
    saveNutritionScan: saveNutritionScanHandler,
  };

  return (
    <HealthDataContext.Provider value={value}>
      {children}
    </HealthDataContext.Provider>
  );
}

export function useHealthData(): HealthDataContextValue {
  const context = useContext(HealthDataContext);
  if (!context) {
    throw new Error('useHealthData must be used inside HealthDataProvider');
  }
  return context;
}
