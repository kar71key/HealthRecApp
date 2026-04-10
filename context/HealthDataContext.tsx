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
  listStepSummaries,
  listDailyLogs,
  mapDailyLogsToSavedLogs,
  mapNutritionScansToStoredScans,
  mapStepSummariesToStepPoints,
  refreshInsightSnapshots,
  saveDailyLog,
  saveFoodEntry as persistFoodEntry,
  saveNutritionScan as persistNutritionScan,
  updateUserProfile as persistUserProfile,
  upsertUserProfile,
  upsertStepSummary,
} from '../repositories/healthRepository';
import { syncHealthData } from '../services/sync';
import { toLocalDateString } from '../services/date';
import { useStepCounter } from '../hooks/useStepCounter';
import type {
  DailyLog,
  FoodEntry,
  FoodEntryInput,
  HealthSyncResult,
  InsightFact,
  NutritionScanInput,
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

  const refreshData = useCallback(async (recomputeInsights = false) => {
    if (!user) {
      setProfile(null);
      setDailyLogs([]);
      setLogs([]);
      setFoodEntries([]);
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
      nextStepSummaries,
      nextNutritionScans,
      nextInsightFacts,
      pendingQueue,
    ] = await Promise.all([
      getActiveProfile(),
      listDailyLogs(),
      listFoodEntries(),
      listStepSummaries(),
      listNutritionScans(),
      listInsightFacts(),
      listPendingSyncQueue(),
    ]);

    const nextLogs = mapDailyLogsToSavedLogs(nextDailyLogs);

    setProfile(nextProfile);
    setDailyLogs(nextDailyLogs);
    setLogs(nextLogs);
    setFoodEntries(nextFoodEntries);
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

        await bootstrapAuthenticatedUser(user);
        const syncedProfile = await upsertUserProfile({
          fullName: user.fullName,
          email: user.email,
          avatarLabel: user.avatarLabel,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
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
        const nextPoint: StepPoint = {
          id: `step-summary-${today}`,
          isoDate: new Date(`${today}T12:00:00`).toISOString(),
          day: new Date(`${today}T12:00:00`).toLocaleDateString([], {
            weekday: 'short',
          }),
          steps: stepsToday,
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
  }, [applySyncResult, isStorageReady, status, stepsToday, user]);

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

    await persistUserProfile({
      age: updates.age ?? undefined,
      heightCm: updates.heightCm ?? undefined,
      weightKg: updates.weightKg ?? undefined,
      goal: updates.goal ?? undefined,
    });
    await refreshData();
    const result = await syncHealthData(user.id, 'full');
    applySyncResult(result);
    await refreshData(false);
  };

  const value: HealthDataContextValue = {
    stepsToday,
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
