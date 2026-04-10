import { getCurrentTimestamp, getHourFromIso } from './date';
import type { DailyLog, FoodEntry, InsightFact, StepDailySummary } from '../types/data';

const LATE_CAFFEINE_CUTOFF_HOUR = 16;

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function toConfidence(sampleSize: number): InsightFact['confidence'] {
  if (sampleSize >= 30) {
    return 'strong recent trend';
  }
  if (sampleSize >= 14) {
    return 'moderate signal';
  }
  return 'early pattern';
}

function buildHydrationInsight(userId: string, dailyLogs: DailyLog[]): InsightFact {
  const generatedAt = getCurrentTimestamp();
  const hydratedDays = dailyLogs.filter(log => log.hydrationLiters >= 2.3);
  const lowerHydrationDays = dailyLogs.filter(log => log.hydrationLiters < 2.3);
  const sampleSize = dailyLogs.length;
  const hydratedSleep = average(hydratedDays.map(log => log.sleepQuality));
  const lowerHydrationSleep = average(lowerHydrationDays.map(log => log.sleepQuality));
  const delta = roundToSingleDecimal(hydratedSleep - lowerHydrationSleep);

  const detail =
    sampleSize >= 14 && hydratedDays.length >= 4 && lowerHydrationDays.length >= 4
      ? `Across ${sampleSize} logged days, sleep quality averages ${hydratedSleep.toFixed(
          1,
        )}/5 on days with at least 2.3L of water and ${lowerHydrationSleep.toFixed(
          1,
        )}/5 on lower-hydration days.`
      : `You have ${sampleSize} logged days so far. Keep capturing water intake and sleep together until you reach at least 14 mixed days for a reliable hydration pattern.`;

  const recommendation =
    delta >= 0
      ? 'Keep most hydration earlier in the day and stay close to 2.3L to 2.5L so the comparison remains clean.'
      : 'Hydration is still noisy relative to sleep. Keep logging consistently before acting on this pattern.';

  return {
    id: 'insight-hydration-sleep',
    userId,
    category: 'hydration',
    title: 'Hydration and Sleep',
    detail,
    recommendation,
    confidence: toConfidence(sampleSize),
    sampleSize,
    metricDelta: delta,
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    syncStatus: 'pending',
  };
}

function buildLateCaffeineInsight(
  userId: string,
  dailyLogs: DailyLog[],
  foodEntries: FoodEntry[],
): InsightFact {
  const generatedAt = getCurrentTimestamp();
  const lateCaffeineByDate = new Map<string, number>();
  const totalCaffeineByDate = new Map<string, number>();

  foodEntries.forEach(entry => {
    if (!entry.isCaffeinated) {
      return;
    }

    const total = totalCaffeineByDate.get(entry.localDate) ?? 0;
    totalCaffeineByDate.set(entry.localDate, total + entry.caffeineMg);

    if (getHourFromIso(entry.occurredAt) >= LATE_CAFFEINE_CUTOFF_HOUR) {
      const lateTotal = lateCaffeineByDate.get(entry.localDate) ?? 0;
      lateCaffeineByDate.set(entry.localDate, lateTotal + entry.caffeineMg);
    }
  });

  const logsWithLateCaffeine = dailyLogs.filter(log => lateCaffeineByDate.has(log.localDate));
  const logsWithoutLateCaffeine = dailyLogs.filter(
    log => !lateCaffeineByDate.has(log.localDate),
  );
  const sampleSize = dailyLogs.length;
  const lateSleepQuality = average(logsWithLateCaffeine.map(log => log.sleepQuality));
  const baselineSleepQuality = average(
    logsWithoutLateCaffeine.map(log => log.sleepQuality),
  );
  const lateSleepHours = average(logsWithLateCaffeine.map(log => log.sleepHours));
  const baselineSleepHours = average(logsWithoutLateCaffeine.map(log => log.sleepHours));
  const sleepQualityPct =
    baselineSleepQuality > 0
      ? roundToSingleDecimal(
          ((lateSleepQuality - baselineSleepQuality) / baselineSleepQuality) * 100,
        )
      : 0;
  const sleepHoursDelta = roundToSingleDecimal(lateSleepHours - baselineSleepHours);

  const detail =
    sampleSize >= 14 &&
    logsWithLateCaffeine.length >= 4 &&
    logsWithoutLateCaffeine.length >= 4
      ? `On ${logsWithLateCaffeine.length} late-caffeine days, sleep quality averages ${lateSleepQuality.toFixed(
          1,
        )}/5 versus ${baselineSleepQuality.toFixed(
          1,
        )}/5 on earlier-or-no caffeine days, a ${Math.abs(
          sleepQualityPct,
        ).toFixed(1)}% ${sleepQualityPct <= 0 ? 'drop' : 'increase'} in sleep quality. Sleep duration also shifts by ${Math.abs(
          sleepHoursDelta,
        ).toFixed(1)}h.`
      : `Late caffeine is now being tracked with timestamps. Keep logging beverage times until you have at least 14 days with a mix of late and non-late caffeine for a trustworthy comparison.`;

  const recommendation =
    sleepQualityPct <= 0
      ? 'Try moving coffee and other caffeinated drinks before 4pm, then compare the next two weeks against your baseline.'
      : 'Keep capturing caffeine timing. The current signal does not yet justify a stronger recommendation.';

  return {
    id: 'insight-late-caffeine',
    userId,
    category: 'nutrition',
    title: 'Late Caffeine and Sleep',
    detail,
    recommendation,
    confidence: toConfidence(sampleSize),
    sampleSize,
    metricDelta: sleepQualityPct,
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    syncStatus: 'pending',
  };
}

function buildActivityInsight(
  userId: string,
  stepSummaries: StepDailySummary[],
  stepGoal: number,
): InsightFact {
  const generatedAt = getCurrentTimestamp();
  const sampleSize = stepSummaries.length;
  const goalDays = stepSummaries.filter(day => day.stepCount >= stepGoal);
  const goalRate = sampleSize > 0 ? (goalDays.length / sampleSize) * 100 : 0;
  const averageSteps = average(stepSummaries.map(day => day.stepCount));
  const delta = roundToSingleDecimal(averageSteps - stepGoal);
  const detail =
    sampleSize >= 14
      ? `You reached the ${stepGoal.toLocaleString()}-step goal on ${goalDays.length} of the last ${sampleSize} days. Average daily steps are ${Math.round(
          averageSteps,
        ).toLocaleString()} with a ${Math.round(goalRate)}% goal-hit rate, which is ${Math.abs(
          Math.round(delta),
        ).toLocaleString()} ${
          delta >= 0 ? 'above' : 'below'
        } goal.`
      : `Step history is still building. Once you have at least 14 days of movement data, goal-hit rate and step consistency will become more useful.`;

  const recommendation =
    delta >= 0
      ? 'Keep the current movement rhythm and look for whether higher-step days also support better sleep.'
      : 'Add one deliberate walking block on low-activity days so the baseline moves closer to goal.';

  return {
    id: 'insight-activity-consistency',
    userId,
    category: 'activity',
    title: 'Movement Consistency',
    detail,
    recommendation,
    confidence: toConfidence(sampleSize),
    sampleSize,
    metricDelta: delta,
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    syncStatus: 'pending',
  };
}

function buildSymptomsInsight(userId: string, dailyLogs: DailyLog[]): InsightFact {
  const generatedAt = getCurrentTimestamp();
  const sampleSize = dailyLogs.length;
  const symptomDays = dailyLogs.filter(log => log.symptomSummary.trim().length > 0);
  const symptomHydration = average(symptomDays.map(log => log.hydrationLiters));
  const symptomSleep = average(symptomDays.map(log => log.sleepQuality));
  const cleanHydration = average(
    dailyLogs
      .filter(log => log.symptomSummary.trim().length === 0)
      .map(log => log.hydrationLiters),
  );
  const delta = roundToSingleDecimal(cleanHydration - symptomHydration);

  const detail =
    sampleSize >= 14 && symptomDays.length >= 3
      ? `Symptoms were logged on ${symptomDays.length} of the last ${sampleSize} days. On symptom days, hydration averages ${symptomHydration.toFixed(
          1,
        )}L and sleep quality averages ${symptomSleep.toFixed(1)}/5.`
      : `Symptom tracking is active, but you still need more days before symptom-related trends can be trusted.`;

  return {
    id: 'insight-symptoms-recovery',
    userId,
    category: 'symptoms',
    title: 'Symptoms and Recovery',
    detail,
    recommendation:
      'When symptoms appear, keep the note specific and continue logging hydration and meal timing so triggers stay queryable.',
    confidence: toConfidence(sampleSize),
    sampleSize,
    metricDelta: delta,
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
    syncStatus: 'pending',
  };
}

export function buildInsightFacts(
  userId: string,
  dailyLogs: DailyLog[],
  foodEntries: FoodEntry[],
  stepSummaries: StepDailySummary[],
  stepGoal: number,
): InsightFact[] {
  const descendingLogs = [...dailyLogs].sort((left, right) =>
    left.localDate < right.localDate ? 1 : -1,
  );
  const ascendingSteps = [...stepSummaries].sort((left, right) =>
    left.localDate > right.localDate ? 1 : -1,
  );

  return [
    buildHydrationInsight(userId, descendingLogs),
    buildLateCaffeineInsight(userId, descendingLogs, foodEntries),
    buildActivityInsight(userId, ascendingSteps, stepGoal),
    buildSymptomsInsight(userId, descendingLogs),
  ];
}
