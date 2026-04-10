import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  executeSql,
  getDatabase,
  queryFirst,
  queryRows,
} from '../services/localDb';
import { buildInsightFacts } from '../services/insights';
import {
  LEGACY_DEVICE_USER_ID,
} from '../services/seedData';
import {
  getCurrentTimestamp,
  getLocalDateDaysAgo,
  getWeekdayShort,
  toLocalDateString,
} from '../services/date';
import type {
  DailyLog,
  DailyLogInput,
  FoodEntry,
  FoodEntryInput,
  InsightFact,
  NutritionScan,
  NutritionScanInput,
  SyncStatus,
  StepDailySummary,
  SyncQueueItem,
  UserProfile,
  UserProfileInput,
} from '../types/data';
import type { SaveLogResult, SavedLog, StepPoint } from '../types/health';
import type { StoredNutritionScan } from '../types/nutri';
import type { AuthUser } from '../types/auth';

const LEGACY_HEALTH_STORAGE_KEY = '@health-rec-app/manual-health-data';
const LEGACY_NUTRI_SCAN_STORAGE_KEY = '@health-rec-app/nutri-scan-history';
const LEGACY_CLAIMED_BY_KEY = 'legacy_claimed_by_user_id';
const LAST_SUCCESSFUL_SYNC_AT_KEY = 'last_successful_sync_at';
const STEP_GOAL = 9000;
let activeUserId: string | null = null;

type MetadataRow = {
  key: string;
  value: string | null;
};

type DailyLogRow = {
  id: string;
  user_id: string;
  local_date: string;
  logged_at: string;
  mood: DailyLog['mood'];
  sleep_quality: number;
  sleep_hours: number;
  hydration_liters: number;
  symptom_summary: string;
  food_note: string;
  created_at: string;
  updated_at: string;
  sync_status: DailyLog['syncStatus'];
};

type FoodEntryRow = {
  id: string;
  user_id: string;
  local_date: string;
  occurred_at: string;
  meal_type: FoodEntry['mealType'];
  item_name: string;
  quantity_value: number;
  quantity_unit: string;
  caffeine_mg: number;
  is_caffeinated: number;
  estimated_calories: number | null;
  estimated_protein_g: number | null;
  estimated_carbs_g: number | null;
  estimated_fat_g: number | null;
  source: FoodEntry['source'];
  source_ref_id: string | null;
  created_at: string;
  updated_at: string;
  sync_status: FoodEntry['syncStatus'];
};

type StepSummaryRow = {
  id: string;
  user_id: string;
  local_date: string;
  step_count: number;
  source: StepDailySummary['source'];
  created_at: string;
  updated_at: string;
  sync_status: StepDailySummary['syncStatus'];
};

type NutritionScanRow = {
  id: string;
  user_id: string;
  title: string;
  source: NutritionScan['source'];
  scanned_at: string;
  foods_count: number;
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  raw_payload_json: string | null;
  created_at: string;
  updated_at: string;
  sync_status: NutritionScan['syncStatus'];
};

type InsightFactRow = {
  id: string;
  user_id: string;
  category: InsightFact['category'];
  title: string;
  detail: string;
  recommendation: string;
  confidence: InsightFact['confidence'];
  sample_size: number;
  metric_delta: number;
  generated_at: string;
  created_at: string;
  updated_at: string;
  sync_status: InsightFact['syncStatus'];
};

type ProfileRow = {
  id: string;
  user_id: string;
  timezone: string;
  full_name: string;
  email: string | null;
  avatar_label: string | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
  created_at: string;
  updated_at: string;
  sync_status: UserProfile['syncStatus'];
};

type LegacyStoredHealthData = {
  logs?: Array<Partial<SavedLog>>;
  weeklySteps?: Array<Partial<StepPoint>>;
};

function getRequiredUserId(): string {
  if (!activeUserId) {
    throw new Error('No authenticated user is bound to the local repository.');
  }
  return activeUserId;
}

function getScopedId(prefix: string, suffix: string): string {
  return `${prefix}-${getRequiredUserId()}-${suffix}`;
}

function getLastSuccessfulSyncKey(userId: string): string {
  return `${LAST_SUCCESSFUL_SYNC_AT_KEY}:${userId}`;
}

function compareIsoTimestamps(left: string, right: string): number {
  return new Date(left).getTime() - new Date(right).getTime();
}

function toProfileRecord(profile: UserProfile): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: profile.userId,
    timezone: profile.timezone,
    full_name: profile.fullName,
    email: profile.email ?? null,
    avatar_label: profile.avatarLabel ?? null,
    age: profile.age ?? null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    goal: profile.goal ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
    sync_status: profile.syncStatus,
  };
}

function toDailyLogRecord(log: DailyLog): Record<string, unknown> {
  return {
    id: log.id,
    user_id: log.userId,
    local_date: log.localDate,
    logged_at: log.loggedAt,
    mood: log.mood,
    sleep_quality: log.sleepQuality,
    sleep_hours: log.sleepHours,
    hydration_liters: log.hydrationLiters,
    symptom_summary: log.symptomSummary,
    food_note: log.foodNote,
    created_at: log.createdAt,
    updated_at: log.updatedAt,
    sync_status: log.syncStatus,
  };
}

function toFoodEntryRecord(entry: FoodEntry): Record<string, unknown> {
  return {
    id: entry.id,
    user_id: entry.userId,
    local_date: entry.localDate,
    occurred_at: entry.occurredAt,
    meal_type: entry.mealType,
    item_name: entry.itemName,
    quantity_value: entry.quantityValue,
    quantity_unit: entry.quantityUnit,
    caffeine_mg: entry.caffeineMg,
    is_caffeinated: entry.isCaffeinated,
    estimated_calories: entry.estimatedCalories ?? null,
    estimated_protein_g: entry.estimatedProteinG ?? null,
    estimated_carbs_g: entry.estimatedCarbsG ?? null,
    estimated_fat_g: entry.estimatedFatG ?? null,
    source: entry.source,
    source_ref_id: entry.sourceRefId ?? null,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    sync_status: entry.syncStatus,
  };
}

function toStepSummaryRecord(entry: StepDailySummary): Record<string, unknown> {
  return {
    id: entry.id,
    user_id: entry.userId,
    local_date: entry.localDate,
    step_count: entry.stepCount,
    source: entry.source,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    sync_status: entry.syncStatus,
  };
}

function toNutritionScanRecord(scan: NutritionScan): Record<string, unknown> {
  return {
    id: scan.id,
    user_id: scan.userId,
    title: scan.title,
    source: scan.source,
    scanned_at: scan.scannedAt,
    foods_count: scan.foodsCount,
    total_calories: scan.totalCalories,
    protein_g: scan.proteinG,
    carbs_g: scan.carbsG,
    fat_g: scan.fatG,
    raw_payload_json: scan.rawPayloadJson ?? null,
    created_at: scan.createdAt,
    updated_at: scan.updatedAt,
    sync_status: scan.syncStatus,
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    timezone: row.timezone,
    fullName: row.full_name,
    email: row.email ?? undefined,
    avatarLabel: row.avatar_label ?? undefined,
    age: row.age ?? undefined,
    heightCm: row.height_cm ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    goal: row.goal ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapDailyLogRow(row: DailyLogRow): DailyLog {
  return {
    id: row.id,
    userId: row.user_id,
    localDate: row.local_date,
    loggedAt: row.logged_at,
    mood: row.mood,
    sleepQuality: row.sleep_quality as DailyLog['sleepQuality'],
    sleepHours: row.sleep_hours,
    hydrationLiters: row.hydration_liters,
    symptomSummary: row.symptom_summary,
    foodNote: row.food_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapFoodEntryRow(row: FoodEntryRow): FoodEntry {
  return {
    id: row.id,
    userId: row.user_id,
    localDate: row.local_date,
    occurredAt: row.occurred_at,
    mealType: row.meal_type,
    itemName: row.item_name,
    quantityValue: row.quantity_value,
    quantityUnit: row.quantity_unit,
    caffeineMg: row.caffeine_mg,
    isCaffeinated: row.is_caffeinated === 1,
    estimatedCalories: row.estimated_calories,
    estimatedProteinG: row.estimated_protein_g,
    estimatedCarbsG: row.estimated_carbs_g,
    estimatedFatG: row.estimated_fat_g,
    source: row.source,
    sourceRefId: row.source_ref_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapStepSummaryRow(row: StepSummaryRow): StepDailySummary {
  return {
    id: row.id,
    userId: row.user_id,
    localDate: row.local_date,
    stepCount: row.step_count,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapNutritionScanRow(row: NutritionScanRow): NutritionScan {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    source: row.source,
    scannedAt: row.scanned_at,
    foodsCount: row.foods_count,
    totalCalories: row.total_calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    rawPayloadJson: row.raw_payload_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

function mapInsightFactRow(row: InsightFactRow): InsightFact {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    title: row.title,
    detail: row.detail,
    recommendation: row.recommendation,
    confidence: row.confidence,
    sampleSize: row.sample_size,
    metricDelta: row.metric_delta,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
  };
}

async function getMetadataValue(key: string): Promise<string | null> {
  const row = await queryFirst<MetadataRow>(
    'SELECT key, value FROM metadata WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

async function setMetadataValue(key: string, value: string): Promise<void> {
  await executeSql(
    'INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)',
    [key, value],
  );
}

async function countUserRows(tableName: string, userId: string): Promise<number> {
  const row = await queryFirst<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE user_id = ?`,
    [userId],
  );
  return row?.count ?? 0;
}

async function clearSyncQueueForUser(userId: string): Promise<void> {
  await executeSql('DELETE FROM sync_queue WHERE user_id = ? OR user_id = ?', [
    userId,
    '',
  ]);
}

async function clearSyncQueueForEntity(
  userId: string,
  entityType: SyncQueueItem['entityType'],
  entityId: string,
): Promise<void> {
  await executeSql(
    `DELETE FROM sync_queue
     WHERE user_id = ? AND entity_type = ? AND entity_id = ? AND status IN ('pending', 'error')`,
    [userId, entityType, entityId],
  );
}

async function insertSyncQueueItem(
  userId: string,
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  payloadJson: string,
  operation: SyncQueueItem['operation'] = 'upsert',
): Promise<void> {
  const timestamp = getCurrentTimestamp();
  const itemId = `queue-${userId}-${entityType}-${entityId}-${Date.now()}`;

  await clearSyncQueueForEntity(userId, entityType, entityId);

  await executeSql(
    `INSERT INTO sync_queue(
      id,
      user_id,
      entity_type,
      entity_id,
      operation,
      payload_json,
      status,
      attempts,
      last_error,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      itemId,
      userId,
      entityType,
      entityId,
      operation,
      payloadJson,
      'pending',
      0,
      null,
      timestamp,
      timestamp,
    ],
  );
}

async function insertDailyLogIfMissing(log: DailyLog): Promise<void> {
  await executeSql(
    `INSERT OR IGNORE INTO daily_logs(
      id,
      user_id,
      local_date,
      logged_at,
      mood,
      sleep_quality,
      sleep_hours,
      hydration_liters,
      symptom_summary,
      food_note,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.userId,
      log.localDate,
      log.loggedAt,
      log.mood,
      log.sleepQuality,
      log.sleepHours,
      log.hydrationLiters,
      log.symptomSummary,
      log.foodNote,
      log.createdAt,
      log.updatedAt,
      log.syncStatus,
    ],
  );
}

async function insertFoodEntry(log: FoodEntry): Promise<void> {
  await executeSql(
    `INSERT OR IGNORE INTO food_entries(
      id,
      user_id,
      local_date,
      occurred_at,
      meal_type,
      item_name,
      quantity_value,
      quantity_unit,
      caffeine_mg,
      is_caffeinated,
      estimated_calories,
      estimated_protein_g,
      estimated_carbs_g,
      estimated_fat_g,
      source,
      source_ref_id,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.userId,
      log.localDate,
      log.occurredAt,
      log.mealType,
      log.itemName,
      log.quantityValue,
      log.quantityUnit,
      log.caffeineMg,
      log.isCaffeinated ? 1 : 0,
      log.estimatedCalories ?? null,
      log.estimatedProteinG ?? null,
      log.estimatedCarbsG ?? null,
      log.estimatedFatG ?? null,
      log.source,
      log.sourceRefId ?? null,
      log.createdAt,
      log.updatedAt,
      log.syncStatus,
    ],
  );
}

async function insertStepSummaryIfMissing(entry: StepDailySummary): Promise<void> {
  await executeSql(
    `INSERT OR IGNORE INTO step_daily_summaries(
      id,
      user_id,
      local_date,
      step_count,
      source,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.userId,
      entry.localDate,
      entry.stepCount,
      entry.source,
      entry.createdAt,
      entry.updatedAt,
      entry.syncStatus,
    ],
  );
}

async function insertNutritionScanIfMissing(scan: NutritionScan): Promise<void> {
  await executeSql(
    `INSERT OR IGNORE INTO nutrition_scans(
      id,
      user_id,
      title,
      source,
      scanned_at,
      foods_count,
      total_calories,
      protein_g,
      carbs_g,
      fat_g,
      raw_payload_json,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scan.id,
      scan.userId,
      scan.title,
      scan.source,
      scan.scannedAt,
      scan.foodsCount,
      scan.totalCalories,
      scan.proteinG,
      scan.carbsG,
      scan.fatG,
      scan.rawPayloadJson ?? null,
      scan.createdAt,
      scan.updatedAt,
      scan.syncStatus,
    ],
  );
}

async function upsertProfileRecord(profile: UserProfile): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO profiles(
      id,
      user_id,
      timezone,
      full_name,
      email,
      avatar_label,
      age,
      height_cm,
      weight_kg,
      goal,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.userId,
      profile.timezone,
      profile.fullName,
      profile.email ?? null,
      profile.avatarLabel ?? null,
      profile.age ?? null,
      profile.heightCm ?? null,
      profile.weightKg ?? null,
      profile.goal ?? null,
      profile.createdAt,
      profile.updatedAt,
      profile.syncStatus,
    ],
  );
}

async function upsertDailyLogRecord(log: DailyLog): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO daily_logs(
      id,
      user_id,
      local_date,
      logged_at,
      mood,
      sleep_quality,
      sleep_hours,
      hydration_liters,
      symptom_summary,
      food_note,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.userId,
      log.localDate,
      log.loggedAt,
      log.mood,
      log.sleepQuality,
      log.sleepHours,
      log.hydrationLiters,
      log.symptomSummary,
      log.foodNote,
      log.createdAt,
      log.updatedAt,
      log.syncStatus,
    ],
  );
}

async function upsertFoodEntryRecord(entry: FoodEntry): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO food_entries(
      id,
      user_id,
      local_date,
      occurred_at,
      meal_type,
      item_name,
      quantity_value,
      quantity_unit,
      caffeine_mg,
      is_caffeinated,
      estimated_calories,
      estimated_protein_g,
      estimated_carbs_g,
      estimated_fat_g,
      source,
      source_ref_id,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.userId,
      entry.localDate,
      entry.occurredAt,
      entry.mealType,
      entry.itemName,
      entry.quantityValue,
      entry.quantityUnit,
      entry.caffeineMg,
      entry.isCaffeinated ? 1 : 0,
      entry.estimatedCalories ?? null,
      entry.estimatedProteinG ?? null,
      entry.estimatedCarbsG ?? null,
      entry.estimatedFatG ?? null,
      entry.source,
      entry.sourceRefId ?? null,
      entry.createdAt,
      entry.updatedAt,
      entry.syncStatus,
    ],
  );
}

async function upsertStepSummaryRecord(entry: StepDailySummary): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO step_daily_summaries(
      id,
      user_id,
      local_date,
      step_count,
      source,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.userId,
      entry.localDate,
      entry.stepCount,
      entry.source,
      entry.createdAt,
      entry.updatedAt,
      entry.syncStatus,
    ],
  );
}

async function upsertNutritionScanRecord(scan: NutritionScan): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO nutrition_scans(
      id,
      user_id,
      title,
      source,
      scanned_at,
      foods_count,
      total_calories,
      protein_g,
      carbs_g,
      fat_g,
      raw_payload_json,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scan.id,
      scan.userId,
      scan.title,
      scan.source,
      scan.scannedAt,
      scan.foodsCount,
      scan.totalCalories,
      scan.proteinG,
      scan.carbsG,
      scan.fatG,
      scan.rawPayloadJson ?? null,
      scan.createdAt,
      scan.updatedAt,
      scan.syncStatus,
    ],
  );
}

async function upsertInsightFactRecord(fact: InsightFact): Promise<void> {
  await executeSql(
    `INSERT OR REPLACE INTO insight_snapshots(
      id,
      user_id,
      category,
      title,
      detail,
      recommendation,
      confidence,
      sample_size,
      metric_delta,
      generated_at,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fact.id,
      fact.userId,
      fact.category,
      fact.title,
      fact.detail,
      fact.recommendation,
      fact.confidence,
      fact.sampleSize,
      fact.metricDelta,
      fact.generatedAt,
      fact.createdAt,
      fact.updatedAt,
      fact.syncStatus,
    ],
  );
}

async function migrateLegacyHealthData(userId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_HEALTH_STORAGE_KEY);
  if (!raw) {
    return;
  }

  let parsed: LegacyStoredHealthData;
  try {
    parsed = JSON.parse(raw) as LegacyStoredHealthData;
  } catch {
    return;
  }

  const legacyLogs = Array.isArray(parsed.logs) ? parsed.logs : [];
  for (const log of legacyLogs) {
    if (!log.timestamp) {
      continue;
    }

    const loggedAt = log.timestamp;
    const localDate = toLocalDateString(new Date(loggedAt));
    const timestamp = getCurrentTimestamp();
    const dailyLog: DailyLog = {
      id:
        typeof log.id === 'string'
          ? `${userId}-${log.id}`
          : `legacy-log-${userId}-${localDate}`,
      userId,
      localDate,
      loggedAt,
      mood: (log.mood ?? 'Good') as DailyLog['mood'],
      sleepQuality: Number(log.sleepQuality ?? 4) as DailyLog['sleepQuality'],
      sleepHours: Number(log.sleepHours ?? 7.5),
      hydrationLiters: Number(log.waterIntake ?? 2.2),
      symptomSummary: typeof log.symptoms === 'string' ? log.symptoms : '',
      foodNote: typeof log.diet === 'string' ? log.diet : '',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    };
    await insertDailyLogIfMissing(dailyLog);
  }

  const legacySteps = Array.isArray(parsed.weeklySteps) ? parsed.weeklySteps : [];
  for (const point of legacySteps) {
    const isoDate = point.isoDate;
    if (typeof isoDate !== 'string') {
      continue;
    }

    const localDate = toLocalDateString(new Date(isoDate));
    const timestamp = getCurrentTimestamp();
    await insertStepSummaryIfMissing({
      id:
        typeof point.id === 'string'
          ? `${userId}-${point.id}`
          : `legacy-steps-${userId}-${localDate}`,
      userId,
      localDate,
      stepCount: Math.max(0, Math.round(Number(point.steps ?? 0))),
      source: 'mock',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  }
}

async function migrateLegacyNutritionScans(userId: string): Promise<void> {
  const raw = await AsyncStorage.getItem(LEGACY_NUTRI_SCAN_STORAGE_KEY);
  if (!raw) {
    return;
  }

  let parsed: StoredNutritionScan[];
  try {
    parsed = JSON.parse(raw) as StoredNutritionScan[];
  } catch {
    return;
  }

  if (!Array.isArray(parsed)) {
    return;
  }

  for (const item of parsed) {
    const timestamp =
      typeof item.scannedAt === 'string' ? item.scannedAt : getCurrentTimestamp();
    await insertNutritionScanIfMissing({
      id: `${userId}-${item.id}`,
      userId,
      title: item.title,
      source: 'fatsecret',
      scannedAt: timestamp,
      foodsCount: item.foodsCount,
      totalCalories: item.totalCalories,
      proteinG: item.protein,
      carbsG: item.carbs,
      fatG: item.fat,
      rawPayloadJson: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  }
}

async function hasAnyLegacyData(): Promise<boolean> {
  const checks = await Promise.all([
    countUserRows('daily_logs', LEGACY_DEVICE_USER_ID),
    countUserRows('food_entries', LEGACY_DEVICE_USER_ID),
    countUserRows('step_daily_summaries', LEGACY_DEVICE_USER_ID),
    countUserRows('nutrition_scans', LEGACY_DEVICE_USER_ID),
    AsyncStorage.getItem(LEGACY_HEALTH_STORAGE_KEY).then(value => Boolean(value)),
    AsyncStorage.getItem(LEGACY_NUTRI_SCAN_STORAGE_KEY).then(value => Boolean(value)),
  ]);

  return checks.some(item => Boolean(item));
}

async function claimLegacyRows(userId: string): Promise<void> {
  await executeSql('DELETE FROM profiles WHERE user_id = ?', [userId]);
  await executeSql(
    'UPDATE profiles SET id = ?, user_id = ?, updated_at = ? WHERE user_id = ?',
    [userId, userId, getCurrentTimestamp(), LEGACY_DEVICE_USER_ID],
  );

  for (const tableName of [
    'daily_logs',
    'food_entries',
    'step_daily_summaries',
    'nutrition_scans',
    'insight_snapshots',
  ]) {
    await executeSql(
      `UPDATE ${tableName} SET user_id = ?, updated_at = ? WHERE user_id = ?`,
      [userId, getCurrentTimestamp(), LEGACY_DEVICE_USER_ID],
    );
  }
}

async function replaceInsightFacts(
  userId: string,
  facts: InsightFact[],
): Promise<void> {
  await executeSql('DELETE FROM insight_snapshots WHERE user_id = ?', [userId]);

  for (const fact of facts) {
    await upsertInsightFactRecord(fact);
  }
}

const ENTITY_TABLE_NAME_MAP: Record<SyncQueueItem['entityType'], string> = {
  profiles: 'profiles',
  daily_logs: 'daily_logs',
  food_entries: 'food_entries',
  step_daily_summaries: 'step_daily_summaries',
  nutrition_scans: 'nutrition_scans',
  insight_snapshots: 'insight_snapshots',
};

export async function setLastSuccessfulSyncAt(timestamp: string): Promise<void> {
  const userId = getRequiredUserId();
  await setMetadataValue(getLastSuccessfulSyncKey(userId), timestamp);
}

export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  const userId = getRequiredUserId();
  return getMetadataValue(getLastSuccessfulSyncKey(userId));
}

export async function markEntitySyncResult(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  status: SyncStatus,
): Promise<void> {
  const tableName = ENTITY_TABLE_NAME_MAP[entityType];
  await executeSql(
    `UPDATE ${tableName} SET sync_status = ? WHERE id = ? AND user_id = ?`,
    [status, entityId, getRequiredUserId()],
  );
}

export async function clearPendingSyncForEntity(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
): Promise<void> {
  await clearSyncQueueForEntity(getRequiredUserId(), entityType, entityId);
}

export async function enqueueAllUserDataForSync(): Promise<void> {
  const userId = getRequiredUserId();
  const [profile, dailyLogs, foodEntries, stepSummaries, nutritionScans] =
    await Promise.all([
      getActiveProfile(),
      listDailyLogs(),
      listFoodEntries(),
      listStepSummaries(),
      listNutritionScans(),
    ]);

  if (profile) {
    await insertSyncQueueItem(
      userId,
      'profiles',
      profile.id,
      JSON.stringify(toProfileRecord(profile)),
    );
  }

  for (const log of dailyLogs) {
    await insertSyncQueueItem(
      userId,
      'daily_logs',
      log.id,
      JSON.stringify(toDailyLogRecord(log)),
    );
  }

  for (const entry of foodEntries) {
    await insertSyncQueueItem(
      userId,
      'food_entries',
      entry.id,
      JSON.stringify(toFoodEntryRecord(entry)),
    );
  }

  for (const summary of stepSummaries) {
    await insertSyncQueueItem(
      userId,
      'step_daily_summaries',
      summary.id,
      JSON.stringify(toStepSummaryRecord(summary)),
    );
  }

  for (const scan of nutritionScans) {
    await insertSyncQueueItem(
      userId,
      'nutrition_scans',
      scan.id,
      JSON.stringify(toNutritionScanRecord(scan)),
    );
  }
}

export async function initializeHealthRepository(): Promise<void> {
  await getDatabase();
}

export function setActiveRepositoryUser(userId: string): void {
  activeUserId = userId;
}

export function clearActiveRepositoryUser(): void {
  activeUserId = null;
}

export async function upsertUserProfile(
  input: UserProfileInput,
): Promise<UserProfile> {
  const userId = getRequiredUserId();
  const existing = await getActiveProfile();
  const timestamp = getCurrentTimestamp();
  const profile: UserProfile = {
    id: userId,
    userId,
    timezone: input.timezone,
    fullName: input.fullName,
    email: input.email,
    avatarLabel: input.avatarLabel,
    age: input.age ?? existing?.age,
    heightCm: input.heightCm ?? existing?.heightCm,
    weightKg: input.weightKg ?? existing?.weightKg,
    goal: input.goal ?? existing?.goal,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };

  await executeSql(
    `INSERT OR REPLACE INTO profiles(
      id,
      user_id,
      timezone,
      full_name,
      email,
      avatar_label,
      age,
      height_cm,
      weight_kg,
      goal,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.userId,
      profile.timezone,
      profile.fullName,
      profile.email ?? null,
      profile.avatarLabel ?? null,
      profile.age ?? null,
      profile.heightCm ?? null,
      profile.weightKg ?? null,
      profile.goal ?? null,
      profile.createdAt,
      profile.updatedAt,
      profile.syncStatus,
    ],
  );

  await insertSyncQueueItem(
    userId,
    'profiles',
    profile.id,
    JSON.stringify(toProfileRecord(profile)),
  );

  return profile;
}

export async function updateUserProfile(
  updates: Partial<Pick<UserProfile, 'age' | 'heightCm' | 'weightKg' | 'goal'>>,
): Promise<UserProfile | null> {
  const current = await getActiveProfile();
  if (!current) {
    return null;
  }

  return upsertUserProfile({
    fullName: current.fullName,
    email: current.email ?? '',
    avatarLabel: current.avatarLabel ?? 'HR',
    timezone: current.timezone,
    age: updates.age ?? current.age ?? null,
    heightCm: updates.heightCm ?? current.heightCm ?? null,
    weightKg: updates.weightKg ?? current.weightKg ?? null,
    goal: updates.goal ?? current.goal ?? null,
  });
}

export async function bootstrapAuthenticatedUser(user: AuthUser): Promise<void> {
  setActiveRepositoryUser(user.id);
  await upsertUserProfile({
    fullName: user.fullName,
    email: user.email,
    avatarLabel: user.avatarLabel,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });

  const claimedBy = await getMetadataValue(LEGACY_CLAIMED_BY_KEY);
  if (!claimedBy) {
    if (await hasAnyLegacyData()) {
      await claimLegacyRows(user.id);
      await migrateLegacyHealthData(user.id);
      await migrateLegacyNutritionScans(user.id);
    }

    await clearSyncQueueForUser(user.id);
    await refreshInsightSnapshots();
    if (await hasAnyLegacyData()) {
      await enqueueAllUserDataForSync();
    }
    await setMetadataValue(LEGACY_CLAIMED_BY_KEY, user.id);
  }
}

async function shouldApplyRemoteChange(
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  localUpdatedAt: string | null,
  remoteUpdatedAt: string,
): Promise<boolean> {
  if (!localUpdatedAt) {
    await clearPendingSyncForEntity(entityType, entityId);
    return true;
  }

  const comparison = compareIsoTimestamps(remoteUpdatedAt, localUpdatedAt);
  if (comparison > 0) {
    await clearPendingSyncForEntity(entityType, entityId);
    return true;
  }

  return false;
}

export async function mergeRemoteProfile(profile: UserProfile): Promise<boolean> {
  const existing = await getActiveProfile();
  const shouldApply = await shouldApplyRemoteChange(
    'profiles',
    profile.id,
    existing?.updatedAt ?? null,
    profile.updatedAt,
  );

  if (!shouldApply) {
    return false;
  }

  await upsertProfileRecord({
    ...profile,
    syncStatus: 'synced',
  });
  return true;
}

export async function mergeRemoteDailyLogs(logs: DailyLog[]): Promise<number> {
  let merged = 0;

  for (const log of logs) {
    const existing = await queryFirst<DailyLogRow>(
      'SELECT * FROM daily_logs WHERE id = ? AND user_id = ? LIMIT 1',
      [log.id, getRequiredUserId()],
    );
    const shouldApply = await shouldApplyRemoteChange(
      'daily_logs',
      log.id,
      existing?.updated_at ?? null,
      log.updatedAt,
    );

    if (!shouldApply) {
      continue;
    }

    await upsertDailyLogRecord({
      ...log,
      syncStatus: 'synced',
    });
    merged += 1;
  }

  return merged;
}

export async function mergeRemoteFoodEntries(entries: FoodEntry[]): Promise<number> {
  let merged = 0;

  for (const entry of entries) {
    const existing = await queryFirst<FoodEntryRow>(
      'SELECT * FROM food_entries WHERE id = ? AND user_id = ? LIMIT 1',
      [entry.id, getRequiredUserId()],
    );
    const shouldApply = await shouldApplyRemoteChange(
      'food_entries',
      entry.id,
      existing?.updated_at ?? null,
      entry.updatedAt,
    );

    if (!shouldApply) {
      continue;
    }

    await upsertFoodEntryRecord({
      ...entry,
      syncStatus: 'synced',
    });
    merged += 1;
  }

  return merged;
}

export async function mergeRemoteStepSummaries(
  entries: StepDailySummary[],
): Promise<number> {
  let merged = 0;

  for (const entry of entries) {
    const existing = await queryFirst<StepSummaryRow>(
      'SELECT * FROM step_daily_summaries WHERE id = ? AND user_id = ? LIMIT 1',
      [entry.id, getRequiredUserId()],
    );
    const shouldApply = await shouldApplyRemoteChange(
      'step_daily_summaries',
      entry.id,
      existing?.updated_at ?? null,
      entry.updatedAt,
    );

    if (!shouldApply) {
      continue;
    }

    await upsertStepSummaryRecord({
      ...entry,
      syncStatus: 'synced',
    });
    merged += 1;
  }

  return merged;
}

export async function mergeRemoteNutritionScans(
  scans: NutritionScan[],
): Promise<number> {
  let merged = 0;

  for (const scan of scans) {
    const existing = await queryFirst<NutritionScanRow>(
      'SELECT * FROM nutrition_scans WHERE id = ? AND user_id = ? LIMIT 1',
      [scan.id, getRequiredUserId()],
    );
    const shouldApply = await shouldApplyRemoteChange(
      'nutrition_scans',
      scan.id,
      existing?.updated_at ?? null,
      scan.updatedAt,
    );

    if (!shouldApply) {
      continue;
    }

    await upsertNutritionScanRecord({
      ...scan,
      syncStatus: 'synced',
    });
    merged += 1;
  }

  return merged;
}

export async function mergeRemoteInsightFacts(facts: InsightFact[]): Promise<number> {
  let merged = 0;

  for (const fact of facts) {
    const existing = await queryFirst<InsightFactRow>(
      'SELECT * FROM insight_snapshots WHERE id = ? AND user_id = ? LIMIT 1',
      [fact.id, getRequiredUserId()],
    );
    const shouldApply = await shouldApplyRemoteChange(
      'insight_snapshots',
      fact.id,
      existing?.updated_at ?? null,
      fact.updatedAt,
    );

    if (!shouldApply) {
      continue;
    }

    await upsertInsightFactRecord({
      ...fact,
      syncStatus: 'synced',
    });
    merged += 1;
  }

  return merged;
}

export async function getActiveProfile(): Promise<UserProfile | null> {
  const userId = getRequiredUserId();
  const row = await queryFirst<ProfileRow>(
    'SELECT * FROM profiles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
    [userId],
  );
  return row ? mapProfileRow(row) : null;
}

export async function listDailyLogs(): Promise<DailyLog[]> {
  const userId = getRequiredUserId();
  const rows = await queryRows<DailyLogRow>(
    'SELECT * FROM daily_logs WHERE user_id = ? ORDER BY local_date DESC',
    [userId],
  );
  return rows.map(mapDailyLogRow);
}

export async function listFoodEntries(): Promise<FoodEntry[]> {
  const userId = getRequiredUserId();
  const rows = await queryRows<FoodEntryRow>(
    'SELECT * FROM food_entries WHERE user_id = ? ORDER BY occurred_at DESC',
    [userId],
  );
  return rows.map(mapFoodEntryRow);
}

export async function listStepSummaries(): Promise<StepDailySummary[]> {
  const userId = getRequiredUserId();
  const rows = await queryRows<StepSummaryRow>(
    'SELECT * FROM step_daily_summaries WHERE user_id = ? ORDER BY local_date ASC',
    [userId],
  );
  return rows.map(mapStepSummaryRow);
}

export async function listNutritionScans(): Promise<NutritionScan[]> {
  const userId = getRequiredUserId();
  const rows = await queryRows<NutritionScanRow>(
    'SELECT * FROM nutrition_scans WHERE user_id = ? ORDER BY scanned_at DESC LIMIT 12',
    [userId],
  );
  return rows.map(mapNutritionScanRow);
}

export async function listInsightFacts(): Promise<InsightFact[]> {
  const userId = getRequiredUserId();
  const rows = await queryRows<InsightFactRow>(
    'SELECT * FROM insight_snapshots WHERE user_id = ? ORDER BY generated_at DESC',
    [userId],
  );
  return rows.map(mapInsightFactRow);
}

export async function listPendingSyncQueue(): Promise<SyncQueueItem[]> {
  const userId = getRequiredUserId();
  return queryRows<SyncQueueItem>(
    `SELECT
      id,
      user_id as userId,
      entity_type as entityType,
      entity_id as entityId,
      operation,
      payload_json as payloadJson,
      status,
      attempts,
      last_error as lastError,
      created_at as createdAt,
      updated_at as updatedAt
    FROM sync_queue
    WHERE user_id = ? AND status IN ('pending', 'error')
    ORDER BY created_at ASC`,
    [userId],
  );
}

export async function saveDailyLog(
  localDate: string,
  input: DailyLogInput,
): Promise<SaveLogResult> {
  const userId = getRequiredUserId();
  const existing = await queryFirst<DailyLogRow>(
    'SELECT * FROM daily_logs WHERE user_id = ? AND local_date = ? LIMIT 1',
    [userId, localDate],
  );
  const timestamp = getCurrentTimestamp();
  const nextId = existing?.id ?? getScopedId('daily-log', localDate);
  const result: SaveLogResult = existing ? 'updated' : 'created';
  const nextLog: DailyLog = {
    id: nextId,
    userId,
    localDate,
    loggedAt: timestamp,
    mood: input.mood,
    sleepQuality: input.sleepQuality,
    sleepHours: input.sleepHours,
    hydrationLiters: input.hydrationLiters,
    symptomSummary: input.symptomSummary,
    foodNote: input.foodNote,
    createdAt: existing?.created_at ?? timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };

  if (existing) {
    await executeSql(
      `UPDATE daily_logs
      SET logged_at = ?, mood = ?, sleep_quality = ?, sleep_hours = ?, hydration_liters = ?,
          symptom_summary = ?, food_note = ?, updated_at = ?, sync_status = ?
      WHERE id = ?`,
      [
        timestamp,
        input.mood,
        input.sleepQuality,
        input.sleepHours,
        input.hydrationLiters,
        input.symptomSummary,
        input.foodNote,
        timestamp,
        'pending',
        existing.id,
      ],
    );
  } else {
    await executeSql(
      `INSERT INTO daily_logs(
        id,
        user_id,
        local_date,
        logged_at,
        mood,
        sleep_quality,
        sleep_hours,
        hydration_liters,
        symptom_summary,
        food_note,
        created_at,
        updated_at,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId,
        userId,
        localDate,
        timestamp,
        input.mood,
        input.sleepQuality,
        input.sleepHours,
        input.hydrationLiters,
        input.symptomSummary,
        input.foodNote,
        timestamp,
        timestamp,
        'pending',
      ],
    );
  }

  await insertSyncQueueItem(
    userId,
    'daily_logs',
    nextId,
    JSON.stringify(toDailyLogRecord(nextLog)),
  );

  return result;
}

export async function saveFoodEntry(input: FoodEntryInput): Promise<FoodEntry> {
  const userId = getRequiredUserId();
  const timestamp = getCurrentTimestamp();
  const id = getScopedId('food-entry', `${Date.now()}`);
  const entry: FoodEntry = {
    id,
    userId,
    localDate: input.localDate,
    occurredAt: input.occurredAt,
    mealType: input.mealType,
    itemName: input.itemName,
    quantityValue: input.quantityValue,
    quantityUnit: input.quantityUnit,
    caffeineMg: input.caffeineMg,
    isCaffeinated: input.isCaffeinated,
    estimatedCalories: input.estimatedCalories ?? null,
    estimatedProteinG: input.estimatedProteinG ?? null,
    estimatedCarbsG: input.estimatedCarbsG ?? null,
    estimatedFatG: input.estimatedFatG ?? null,
    source: input.source,
    sourceRefId: input.sourceRefId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };

  await insertFoodEntry(entry);
  await insertSyncQueueItem(
    userId,
    'food_entries',
    entry.id,
    JSON.stringify(toFoodEntryRecord(entry)),
  );
  return entry;
}

export async function saveNutritionScan(
  input: NutritionScanInput,
): Promise<NutritionScan> {
  const userId = getRequiredUserId();
  const timestamp = getCurrentTimestamp();
  const scan: NutritionScan = {
    id: getScopedId('nutrition-scan', `${Date.now()}`),
    userId,
    title: input.title,
    source: input.source,
    scannedAt: input.scannedAt,
    foodsCount: input.foodsCount,
    totalCalories: input.totalCalories,
    proteinG: input.proteinG,
    carbsG: input.carbsG,
    fatG: input.fatG,
    rawPayloadJson: input.rawPayloadJson ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };

  await executeSql(
    `INSERT INTO nutrition_scans(
      id,
      user_id,
      title,
      source,
      scanned_at,
      foods_count,
      total_calories,
      protein_g,
      carbs_g,
      fat_g,
      raw_payload_json,
      created_at,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      scan.id,
      scan.userId,
      scan.title,
      scan.source,
      scan.scannedAt,
      scan.foodsCount,
      scan.totalCalories,
      scan.proteinG,
      scan.carbsG,
      scan.fatG,
      scan.rawPayloadJson ?? null,
      scan.createdAt,
      scan.updatedAt,
      scan.syncStatus,
    ],
  );

  await insertSyncQueueItem(
    userId,
    'nutrition_scans',
    scan.id,
    JSON.stringify(toNutritionScanRecord(scan)),
  );
  return scan;
}

export async function upsertStepSummary(
  localDate: string,
  stepCount: number,
  source: StepDailySummary['source'],
): Promise<void> {
  const userId = getRequiredUserId();
  const existing = await queryFirst<StepSummaryRow>(
    'SELECT * FROM step_daily_summaries WHERE user_id = ? AND local_date = ? LIMIT 1',
    [userId, localDate],
  );
  const timestamp = getCurrentTimestamp();
  const nextId = existing?.id ?? getScopedId('step-summary', localDate);
  const nextSummary: StepDailySummary = {
    id: nextId,
    userId,
    localDate,
    stepCount,
    source,
    createdAt: existing?.created_at ?? timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };

  if (existing) {
    await executeSql(
      `UPDATE step_daily_summaries
      SET step_count = ?, source = ?, updated_at = ?, sync_status = ?
      WHERE id = ?`,
      [stepCount, source, timestamp, 'pending', existing.id],
    );
  } else {
    await executeSql(
      `INSERT INTO step_daily_summaries(
        id,
        user_id,
        local_date,
        step_count,
        source,
        created_at,
        updated_at,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextId,
        userId,
        localDate,
        stepCount,
        source,
        timestamp,
        timestamp,
        'pending',
      ],
    );
  }

  await insertSyncQueueItem(
    userId,
    'step_daily_summaries',
    nextId,
    JSON.stringify(toStepSummaryRecord(nextSummary)),
  );
}

export async function refreshInsightSnapshots(
  enqueueForSync = false,
): Promise<InsightFact[]> {
  const userId = getRequiredUserId();
  const [dailyLogs, foodEntries, stepSummaries] = await Promise.all([
    listDailyLogs(),
    listFoodEntries(),
    listStepSummaries(),
  ]);
  const facts = buildInsightFacts(
    userId,
    dailyLogs,
    foodEntries,
    stepSummaries,
    STEP_GOAL,
  );
  await replaceInsightFacts(userId, facts);

  if (enqueueForSync) {
    for (const fact of facts) {
      await insertSyncQueueItem(
        userId,
        'insight_snapshots',
        fact.id,
        JSON.stringify({
          id: fact.id,
          user_id: fact.userId,
          category: fact.category,
          title: fact.title,
          detail: fact.detail,
          recommendation: fact.recommendation,
          confidence: fact.confidence,
          sample_size: fact.sampleSize,
          metric_delta: fact.metricDelta,
          generated_at: fact.generatedAt,
          created_at: fact.createdAt,
          updated_at: fact.updatedAt,
          sync_status: fact.syncStatus,
        }),
      );
    }
  }

  return facts;
}

export function mapDailyLogsToSavedLogs(dailyLogs: DailyLog[]): SavedLog[] {
  return dailyLogs.map(log => ({
    id: log.id,
    timestamp: log.loggedAt,
    symptoms: log.symptomSummary,
    diet: log.foodNote,
    waterIntake: log.hydrationLiters,
    mood: log.mood,
    sleepQuality: log.sleepQuality,
    sleepHours: log.sleepHours,
  }));
}

export function mapStepSummariesToStepPoints(
  stepSummaries: StepDailySummary[],
): StepPoint[] {
  return stepSummaries.slice(-7).map(summary => ({
    id: summary.id,
    isoDate: new Date(`${summary.localDate}T12:00:00`).toISOString(),
    day: getWeekdayShort(summary.localDate),
    steps: summary.stepCount,
  }));
}

export function mapNutritionScansToStoredScans(
  scans: NutritionScan[],
): StoredNutritionScan[] {
  return scans.map(scan => ({
    id: scan.id,
    scannedAt: scan.scannedAt,
    title: scan.title,
    totalCalories: scan.totalCalories,
    protein: scan.proteinG,
    carbs: scan.carbsG,
    fat: scan.fatG,
    foodsCount: scan.foodsCount,
  }));
}

export function buildDefaultLocalDate(): string {
  return getLocalDateDaysAgo(0);
}
