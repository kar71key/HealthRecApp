import { executeSql } from './localDb';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import {
  getLastSuccessfulSyncAt,
  listPendingSyncQueue,
  markEntitySyncResult,
  mergeRemoteDailyLogs,
  mergeRemoteFoodEntries,
  mergeRemoteInsightFacts,
  mergeRemoteNutritionScans,
  mergeRemoteProfile,
  mergeRemoteStepSummaries,
  refreshInsightSnapshots,
  setLastSuccessfulSyncAt,
} from '../repositories/healthRepository';
import type {
  DailyLog,
  FoodEntry,
  HealthSyncMode,
  HealthSyncResult,
  InsightFact,
  NutritionScan,
  StepDailySummary,
  SyncQueueItem,
  SyncState,
  UserProfile,
} from '../types/data';

const ENTITY_TABLE_MAP = {
  profiles: 'profiles',
  daily_logs: 'daily_logs',
  food_entries: 'food_entries',
  step_daily_summaries: 'step_daily_summaries',
  nutrition_scans: 'nutrition_scans',
  insight_snapshots: 'insight_snapshots',
} as const;

type RemoteDailyLogRow = {
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

type RemoteFoodEntryRow = {
  id: string;
  user_id: string;
  local_date: string;
  occurred_at: string;
  meal_type: FoodEntry['mealType'];
  item_name: string;
  quantity_value: number;
  quantity_unit: string;
  caffeine_mg: number;
  is_caffeinated: boolean;
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

type RemoteStepSummaryRow = {
  id: string;
  user_id: string;
  local_date: string;
  step_count: number;
  source: StepDailySummary['source'];
  created_at: string;
  updated_at: string;
  sync_status: StepDailySummary['syncStatus'];
};

type RemoteNutritionScanRow = {
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

type RemoteInsightFactRow = {
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

type RemoteProfileRow = {
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

function toProfile(row: RemoteProfileRow): UserProfile {
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
    syncStatus: 'synced',
  };
}

function toDailyLog(row: RemoteDailyLogRow): DailyLog {
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
    syncStatus: 'synced',
  };
}

function toFoodEntry(row: RemoteFoodEntryRow): FoodEntry {
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
    isCaffeinated: row.is_caffeinated,
    estimatedCalories: row.estimated_calories,
    estimatedProteinG: row.estimated_protein_g,
    estimatedCarbsG: row.estimated_carbs_g,
    estimatedFatG: row.estimated_fat_g,
    source: row.source,
    sourceRefId: row.source_ref_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  };
}

function toStepSummary(row: RemoteStepSummaryRow): StepDailySummary {
  return {
    id: row.id,
    userId: row.user_id,
    localDate: row.local_date,
    stepCount: row.step_count,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncStatus: 'synced',
  };
}

function toNutritionScan(row: RemoteNutritionScanRow): NutritionScan {
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
    syncStatus: 'synced',
  };
}

function toInsightFact(row: RemoteInsightFactRow): InsightFact {
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
    syncStatus: 'synced',
  };
}

function buildSkippedResult(mode: HealthSyncMode): HealthSyncResult {
  return {
    mode,
    attempted: 0,
    synced: 0,
    pulled: 0,
    skipped: true,
    pending: 0,
    state: 'idle',
    error: null,
    lastSyncedAt: null,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown sync error';
}

function classifySyncState(message: string): SyncState {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('offline') ||
    normalized.includes('failed to fetch')
  ) {
    return 'offline';
  }

  return 'error';
}

function buildUpsertPayload(item: SyncQueueItem): Record<string, unknown> {
  const payload = JSON.parse(item.payloadJson) as Record<string, unknown>;
  return {
    ...payload,
    user_id: item.userId,
    sync_status: 'synced',
  };
}

export async function pushPendingMutations(
  _userId: string,
): Promise<HealthSyncResult> {
  if (!isSupabaseConfigured()) {
    return buildSkippedResult('push');
  }

  const client = getSupabaseClient();
  if (!client) {
    return buildSkippedResult('push');
  }

  const queue = await listPendingSyncQueue();
  let synced = 0;
  let syncError: string | null = null;
  let syncState: SyncState = 'idle';

  for (const item of queue) {
    const table = ENTITY_TABLE_MAP[item.entityType];

    try {
      let error: Error | null = null;

      if (item.operation === 'delete') {
        const result = await client
          .from(table)
          .delete()
          .eq('id', item.entityId)
          .eq('user_id', item.userId);
        error = result.error;
      } else {
        const result = await client
          .from(table)
          .upsert(buildUpsertPayload(item) as never);
        error = result.error;
      }

      if (error) {
        throw error;
      }

      await executeSql(
        'UPDATE sync_queue SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
        ['synced', null, new Date().toISOString(), item.id],
      );
      await markEntitySyncResult(item.entityType, item.entityId, 'synced');
      synced += 1;
    } catch (error) {
      syncError = getErrorMessage(error);
      syncState = classifySyncState(syncError);
      await executeSql(
        'UPDATE sync_queue SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ? WHERE id = ?',
        ['error', syncError, new Date().toISOString(), item.id],
      );
      await markEntitySyncResult(item.entityType, item.entityId, 'error');
    }
  }

  const pending = (await listPendingSyncQueue()).length;
  const lastSyncedAt =
    synced > 0 ? new Date().toISOString() : await getLastSuccessfulSyncAt();

  if (synced > 0 && lastSyncedAt) {
    await setLastSuccessfulSyncAt(lastSyncedAt);
  }

  return {
    mode: 'push',
    attempted: queue.length,
    synced,
    pulled: 0,
    skipped: false,
    pending,
    state: syncError ? syncState : 'idle',
    error: syncError,
    lastSyncedAt,
  };
}

export async function pullRemoteSnapshot(
  userId: string,
): Promise<HealthSyncResult> {
  if (!isSupabaseConfigured()) {
    return buildSkippedResult('pull');
  }

  const client = getSupabaseClient();
  if (!client) {
    return buildSkippedResult('pull');
  }

  try {
    const [
      profileResult,
      dailyLogResult,
      foodEntryResult,
      stepSummaryResult,
      nutritionScanResult,
      insightResult,
    ] = await Promise.all([
      client.from('profiles').select('*').eq('user_id', userId).limit(1).maybeSingle(),
      client.from('daily_logs').select('*').eq('user_id', userId).order('local_date', {
        ascending: false,
      }),
      client.from('food_entries').select('*').eq('user_id', userId).order('occurred_at', {
        ascending: false,
      }),
      client
        .from('step_daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .order('local_date', { ascending: true }),
      client
        .from('nutrition_scans')
        .select('*')
        .eq('user_id', userId)
        .order('scanned_at', { ascending: false }),
      client
        .from('insight_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false }),
    ]);

    for (const result of [
      profileResult,
      dailyLogResult,
      foodEntryResult,
      stepSummaryResult,
      nutritionScanResult,
      insightResult,
    ]) {
      if (result.error) {
        throw result.error;
      }
    }

    let pulled = 0;

    if (profileResult.data) {
      const merged = await mergeRemoteProfile(toProfile(profileResult.data as RemoteProfileRow));
      pulled += merged ? 1 : 0;
    }

    pulled += await mergeRemoteDailyLogs(
      ((dailyLogResult.data ?? []) as RemoteDailyLogRow[]).map(toDailyLog),
    );
    pulled += await mergeRemoteFoodEntries(
      ((foodEntryResult.data ?? []) as RemoteFoodEntryRow[]).map(toFoodEntry),
    );
    pulled += await mergeRemoteStepSummaries(
      ((stepSummaryResult.data ?? []) as RemoteStepSummaryRow[]).map(toStepSummary),
    );
    pulled += await mergeRemoteNutritionScans(
      ((nutritionScanResult.data ?? []) as RemoteNutritionScanRow[]).map(
        toNutritionScan,
      ),
    );
    pulled += await mergeRemoteInsightFacts(
      ((insightResult.data ?? []) as RemoteInsightFactRow[]).map(toInsightFact),
    );

    await refreshInsightSnapshots(pulled > 0);

    const lastSyncedAt = new Date().toISOString();
    await setLastSuccessfulSyncAt(lastSyncedAt);

    return {
      mode: 'pull',
      attempted: 0,
      synced: 0,
      pulled,
      skipped: false,
      pending: (await listPendingSyncQueue()).length,
      state: 'idle',
      error: null,
      lastSyncedAt,
    };
  } catch (error) {
    const message = getErrorMessage(error);
    return {
      mode: 'pull',
      attempted: 0,
      synced: 0,
      pulled: 0,
      skipped: false,
      pending: (await listPendingSyncQueue()).length,
      state: classifySyncState(message),
      error: message,
      lastSyncedAt: await getLastSuccessfulSyncAt(),
    };
  }
}

export async function syncHealthData(
  userId: string,
  mode: HealthSyncMode = 'full',
): Promise<HealthSyncResult> {
  if (mode === 'push') {
    return pushPendingMutations(userId);
  }

  if (mode === 'pull') {
    return pullRemoteSnapshot(userId);
  }

  const firstPull = await pullRemoteSnapshot(userId);
  const push = await pushPendingMutations(userId);
  const secondPull = push.synced > 0 ? await pullRemoteSnapshot(userId) : buildSkippedResult('pull');

  const lastSyncedAt =
    secondPull.lastSyncedAt ?? push.lastSyncedAt ?? firstPull.lastSyncedAt ?? null;
  const error = secondPull.error ?? push.error ?? firstPull.error ?? null;
  const state = error
    ? secondPull.state !== 'idle'
      ? secondPull.state
      : push.state !== 'idle'
        ? push.state
        : firstPull.state
    : 'idle';

  return {
    mode: 'full',
    attempted: push.attempted,
    synced: push.synced,
    pulled: firstPull.pulled + secondPull.pulled,
    skipped: firstPull.skipped && push.skipped && secondPull.skipped,
    pending: secondPull.pending || push.pending || firstPull.pending,
    state,
    error,
    lastSyncedAt,
  };
}
