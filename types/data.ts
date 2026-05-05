import type { MoodLevel, SleepQuality } from './health';

export type SyncStatus = 'pending' | 'synced' | 'error';

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

export type HealthSyncMode = 'push' | 'pull' | 'full';

export type HealthSyncResult = {
  mode: HealthSyncMode;
  attempted: number;
  synced: number;
  pulled: number;
  skipped: boolean;
  pending: number;
  state: SyncState;
  error?: string | null;
  lastSyncedAt?: string | null;
};

export type MealType =
  | 'Breakfast'
  | 'Lunch'
  | 'Dinner'
  | 'Snack'
  | 'Beverage';

export type FoodEntrySource = 'manual' | 'fatsecret' | 'gemini';

export type StepSource = 'sensor' | 'manual' | 'mock';

export type PhysicalActivityCategory = 'Running' | 'Cycling' | 'Swimming';

export type PhysicalActivityOptionKey =
  | 'running-jogging'
  | 'running-steady'
  | 'running-sprints'
  | 'cycling-leisure'
  | 'cycling-road'
  | 'cycling-intervals'
  | 'swimming-light'
  | 'swimming-moderate'
  | 'swimming-vigorous';

export type InsightConfidence =
  | 'early pattern'
  | 'moderate signal'
  | 'strong recent trend';

export type Repository<T> = {
  getById: (id: string) => Promise<T | null>;
  list: () => Promise<T[]>;
};

export type UserProfile = {
  id: string;
  userId: string;
  timezone: string;
  fullName: string;
  email?: string;
  avatarLabel?: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type UserProfileInput = {
  fullName: string;
  email: string;
  avatarLabel: string;
  timezone: string;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  goal?: string | null;
};

export type DailyLog = {
  id: string;
  userId: string;
  localDate: string;
  loggedAt: string;
  mood: MoodLevel;
  sleepQuality: SleepQuality;
  sleepHours: number;
  hydrationLiters: number;
  symptomSummary: string;
  foodNote: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type FoodEntry = {
  id: string;
  userId: string;
  localDate: string;
  occurredAt: string;
  mealType: MealType;
  itemName: string;
  quantityValue: number;
  quantityUnit: string;
  caffeineMg: number;
  isCaffeinated: boolean;
  estimatedCalories?: number | null;
  estimatedProteinG?: number | null;
  estimatedCarbsG?: number | null;
  estimatedFatG?: number | null;
  source: FoodEntrySource;
  sourceRefId?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type StepDailySummary = {
  id: string;
  userId: string;
  localDate: string;
  stepCount: number;
  stepCaloriesBurned: number;
  activityCaloriesBurned: number;
  caloriesBurned: number;
  source: StepSource;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type PhysicalActivitySession = {
  id: string;
  userId: string;
  localDate: string;
  startedAt: string;
  endedAt: string;
  category: PhysicalActivityCategory;
  optionKey: PhysicalActivityOptionKey;
  title: string;
  intensityLabel: string;
  metValue: number;
  durationSeconds: number;
  caloriesBurned: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type ActivePhysicalActivityTimer = {
  optionKey: PhysicalActivityOptionKey;
  startedAt: string;
};

export type NutritionScan = {
  id: string;
  userId: string;
  title: string;
  source: FoodEntrySource;
  scannedAt: string;
  foodsCount: number;
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rawPayloadJson?: string | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type InsightFact = {
  id: string;
  userId: string;
  category: 'hydration' | 'sleep' | 'activity' | 'nutrition' | 'symptoms';
  title: string;
  detail: string;
  recommendation: string;
  confidence: InsightConfidence;
  sampleSize: number;
  metricDelta: number;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
};

export type SyncQueueItem = {
  id: string;
  userId: string;
  entityType:
    | 'profiles'
    | 'daily_logs'
    | 'food_entries'
    | 'step_daily_summaries'
    | 'physical_activity_sessions'
    | 'nutrition_scans'
    | 'insight_snapshots';
  entityId: string;
  operation: 'upsert' | 'delete';
  payloadJson: string;
  status: SyncStatus;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyLogInput = {
  mood: MoodLevel;
  sleepQuality: SleepQuality;
  sleepHours: number;
  hydrationLiters: number;
  symptomSummary: string;
  foodNote: string;
};

export type FoodEntryInput = {
  localDate: string;
  occurredAt: string;
  mealType: MealType;
  itemName: string;
  quantityValue: number;
  quantityUnit: string;
  caffeineMg: number;
  isCaffeinated: boolean;
  estimatedCalories?: number | null;
  estimatedProteinG?: number | null;
  estimatedCarbsG?: number | null;
  estimatedFatG?: number | null;
  source: FoodEntrySource;
  sourceRefId?: string | null;
};

export type PhysicalActivitySessionInput = {
  localDate: string;
  startedAt: string;
  endedAt: string;
  category: PhysicalActivityCategory;
  optionKey: PhysicalActivityOptionKey;
  title: string;
  intensityLabel: string;
  metValue: number;
  durationSeconds: number;
  caloriesBurned: number;
};

export type NutritionScanInput = {
  title: string;
  source: FoodEntrySource;
  scannedAt: string;
  foodsCount: number;
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  rawPayloadJson?: string | null;
};

export type AnalyticsSnapshot = {
  dailyLogs: DailyLog[];
  foodEntries: FoodEntry[];
  stepSummaries: StepDailySummary[];
  activitySessions: PhysicalActivitySession[];
  insightFacts: InsightFact[];
};
