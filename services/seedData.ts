import type {
  DailyLog,
  FoodEntry,
  InsightFact,
  NutritionScan,
  StepDailySummary,
  UserProfile,
} from '../types/data';
import type { MoodLevel, SleepQuality } from '../types/health';
import { getCurrentTimestamp, getLocalDateDaysAgo, toIsoAtLocalTime } from './date';

export const LEGACY_DEVICE_USER_ID = 'local-primary';

const MOODS: MoodLevel[] = ['Great', 'Good', 'Okay', 'Low'];
const MEAL_ROTATION = [
  'Vegetable oats bowl',
  'Chicken rice plate',
  'Greek yogurt fruit cup',
  'Dal and roti',
  'Paneer wrap',
  'Salad with eggs',
] as const;

function makeScopedId(prefix: string, userId: string, dayOffset: number, suffix = 0): string {
  return `${prefix}-${userId}-${dayOffset}-${suffix}`;
}

export function buildSeedProfile(
  userId = LEGACY_DEVICE_USER_ID,
  fullName = 'Local Demo User',
  email = 'local.demo@healthrec.app',
): UserProfile {
  const timestamp = getCurrentTimestamp();
  return {
    id: userId,
    userId,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    fullName,
    email,
    avatarLabel: fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'HR',
    age: 29,
    heightCm: 175,
    weightKg: 70,
    goal: 'Improve sleep quality and reduce late caffeine intake',
    createdAt: timestamp,
    updatedAt: timestamp,
    syncStatus: 'pending',
  };
}

function buildSeedMood(dayOffset: number): MoodLevel {
  return MOODS[dayOffset % MOODS.length];
}

function buildSleepQuality(dayOffset: number, lateCoffee: boolean): SleepQuality {
  if (lateCoffee) {
    return ([2, 3, 3, 2][dayOffset % 4] ?? 3) as SleepQuality;
  }
  return ([4, 5, 4, 4][dayOffset % 4] ?? 4) as SleepQuality;
}

function buildSleepHours(dayOffset: number, lateCoffee: boolean): number {
  const base = lateCoffee ? 6.1 : 7.5;
  return Number((base + ((dayOffset % 3) - 1) * 0.3).toFixed(1));
}

function buildHydration(dayOffset: number): number {
  return Number((1.8 + (dayOffset % 5) * 0.2).toFixed(1));
}

function hasLateCoffee(dayOffset: number): boolean {
  return dayOffset % 3 === 0 || dayOffset % 5 === 0;
}

export function buildSeedDailyLogs(userId = LEGACY_DEVICE_USER_ID, days = 21): DailyLog[] {
  const logs: DailyLog[] = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const localDate = getLocalDateDaysAgo(dayOffset);
    const lateCoffee = hasLateCoffee(dayOffset);
    const loggedAt = toIsoAtLocalTime(localDate, 21, 30);
    const timestamp = loggedAt;
    const hydration = buildHydration(dayOffset);

    logs.push({
      id: makeScopedId('daily-log', userId, dayOffset),
      userId,
      localDate,
      loggedAt,
      mood: buildSeedMood(dayOffset),
      sleepQuality: buildSleepQuality(dayOffset, lateCoffee),
      sleepHours: buildSleepHours(dayOffset, lateCoffee),
      hydrationLiters: hydration,
      symptomSummary:
        lateCoffee && hydration < 2.1 ? 'Mild headache and restlessness' : '',
      foodNote: lateCoffee
        ? 'Included afternoon coffee. Felt slightly wired in the evening.'
        : 'Mostly balanced meals and earlier caffeine timing.',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  }

  return logs;
}

export function buildSeedFoodEntries(userId = LEGACY_DEVICE_USER_ID, days = 21): FoodEntry[] {
  const entries: FoodEntry[] = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const localDate = getLocalDateDaysAgo(dayOffset);
    const timestamp = toIsoAtLocalTime(localDate, 8, 15);
    const mealName = MEAL_ROTATION[dayOffset % MEAL_ROTATION.length];

    entries.push({
      id: makeScopedId('food-breakfast', userId, dayOffset),
      userId,
      localDate,
      occurredAt: timestamp,
      mealType: 'Breakfast',
      itemName: mealName,
      quantityValue: 1,
      quantityUnit: 'serving',
      caffeineMg: 0,
      isCaffeinated: false,
      estimatedCalories: 320 + (dayOffset % 4) * 25,
      estimatedProteinG: 14 + (dayOffset % 3),
      estimatedCarbsG: 36 + (dayOffset % 4) * 3,
      estimatedFatG: 11 + (dayOffset % 2),
      source: 'manual',
      sourceRefId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });

    entries.push({
      id: makeScopedId('food-lunch', userId, dayOffset),
      userId,
      localDate,
      occurredAt: toIsoAtLocalTime(localDate, 13, 10),
      mealType: 'Lunch',
      itemName: 'Balanced lunch bowl',
      quantityValue: 1,
      quantityUnit: 'bowl',
      caffeineMg: 0,
      isCaffeinated: false,
      estimatedCalories: 480,
      estimatedProteinG: 25,
      estimatedCarbsG: 44,
      estimatedFatG: 18,
      source: 'manual',
      sourceRefId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });

    if (hasLateCoffee(dayOffset)) {
      entries.push({
        id: makeScopedId('food-coffee', userId, dayOffset),
        userId,
        localDate,
        occurredAt: toIsoAtLocalTime(localDate, 17, 20),
        mealType: 'Beverage',
        itemName: 'Coffee',
        quantityValue: 1,
        quantityUnit: 'cup',
        caffeineMg: 140,
        isCaffeinated: true,
        estimatedCalories: 12,
        estimatedProteinG: 0,
        estimatedCarbsG: 1,
        estimatedFatG: 0,
        source: 'manual',
        sourceRefId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      });
    } else {
      entries.push({
        id: makeScopedId('food-tea', userId, dayOffset),
        userId,
        localDate,
        occurredAt: toIsoAtLocalTime(localDate, 14, 45),
        mealType: 'Beverage',
        itemName: 'Green tea',
        quantityValue: 1,
        quantityUnit: 'cup',
        caffeineMg: 28,
        isCaffeinated: true,
        estimatedCalories: 2,
        estimatedProteinG: 0,
        estimatedCarbsG: 0,
        estimatedFatG: 0,
        source: 'manual',
        sourceRefId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
      });
    }
  }

  return entries;
}

export function buildSeedStepSummaries(
  userId = LEGACY_DEVICE_USER_ID,
  days = 21,
): StepDailySummary[] {
  const entries: StepDailySummary[] = [];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset -= 1) {
    const localDate = getLocalDateDaysAgo(dayOffset);
    const timestamp = toIsoAtLocalTime(localDate, 20, 30);
    const base = 6200 + (dayOffset % 6) * 700 - (dayOffset % 3) * 180;

    entries.push({
      id: makeScopedId('steps', userId, dayOffset),
      userId,
      localDate,
      stepCount: Math.max(4200, base),
      source: 'mock',
      createdAt: timestamp,
      updatedAt: timestamp,
      syncStatus: 'pending',
    });
  }

  return entries;
}

export function buildSeedNutritionScans(
  userId = LEGACY_DEVICE_USER_ID,
): NutritionScan[] {
  const now = getCurrentTimestamp();

  return [
    {
      id: `seed-scan-${userId}-1`,
      userId,
      title: 'Grilled chicken salad',
      source: 'fatsecret',
      scannedAt: now,
      foodsCount: 2,
      totalCalories: 410,
      proteinG: 31,
      carbsG: 18,
      fatG: 21,
      rawPayloadJson: null,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    },
  ];
}

export function buildSeedInsightFacts(): InsightFact[] {
  return [];
}
