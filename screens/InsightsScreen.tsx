import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { MetricBarChart } from '../components/MetricBarChart';
import { ScreenShell } from '../components/ScreenShell';
import { useHealthData } from '../context/HealthDataContext';
import { colors } from '../theme/colors';
import type {
  MetricBarChartPoint,
  MoodLevel,
  SavedLog,
  SleepQuality,
} from '../types/health';

const MOOD_SCORES: Record<MoodLevel, number> = {
  Great: 4,
  Good: 3,
  Okay: 2,
  Low: 1,
};

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function getShortDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short' });
}

function getMoodLabel(score: number): MoodLevel {
  if (score >= 3.5) {
    return 'Great';
  }
  if (score >= 2.5) {
    return 'Good';
  }
  if (score >= 1.5) {
    return 'Okay';
  }
  return 'Low';
}

function getMostCommonMood(logs: SavedLog[]): MoodLevel {
  if (logs.length === 0) {
    return 'Good';
  }

  const counts = logs.reduce<Record<MoodLevel, number>>(
    (result, log) => ({
      ...result,
      [log.mood]: result[log.mood] + 1,
    }),
    {
      Great: 0,
      Good: 0,
      Okay: 0,
      Low: 0,
    },
  );

  return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    'Good') as MoodLevel;
}

function getSleepLabel(value: SleepQuality): string {
  const labelMap: Record<SleepQuality, string> = {
    1: 'Poor',
    2: 'Light',
    3: 'Fair',
    4: 'Good',
    5: 'Great',
  };
  return labelMap[value];
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

function buildRecoveryScore(log: SavedLog): number {
  const sleepQualityScore = (log.sleepQuality / 5) * 40;
  const sleepDurationScore = (Math.min(log.sleepHours, 8) / 8) * 20;
  const hydrationScore = (Math.min(log.waterIntake, 2.5) / 2.5) * 25;
  const moodScore = (MOOD_SCORES[log.mood] / 4) * 15;
  return Math.round(sleepQualityScore + sleepDurationScore + hydrationScore + moodScore);
}

function SnapshotTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}): React.JSX.Element {
  return (
    <View style={styles.snapshotTile}>
      <View style={[styles.snapshotDot, { backgroundColor: accent }]} />
      <Text style={styles.snapshotLabel}>{label}</Text>
      <Text style={styles.snapshotValue}>{value}</Text>
    </View>
  );
}

function FindingCard({
  title,
  detail,
  recommendation,
}: {
  title: string;
  detail: string;
  recommendation: string;
}): React.JSX.Element {
  return (
    <View style={styles.findingCard}>
      <Text style={styles.findingTitle}>{title}</Text>
      <Text style={styles.findingDetail}>{detail}</Text>
      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>Recommendation</Text>
        <Text style={styles.recommendationText}>{recommendation}</Text>
      </View>
    </View>
  );
}

export function InsightsScreen(): React.JSX.Element {
  const { logs, weeklySteps, stepGoal, foodEntries, insightFacts, profile } =
    useHealthData();

  const recentLogs = useMemo(
    () =>
      [...logs]
        .sort(
          (left, right) =>
            new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
        )
        .slice(-7),
    [logs],
  );

  const averages = useMemo(() => {
    const avgWater = average(recentLogs.map(log => log.waterIntake));
    const avgSleepQuality = average(recentLogs.map(log => log.sleepQuality));
    const avgSleepHours = average(recentLogs.map(log => log.sleepHours));
    const avgSteps = average(weeklySteps.map(point => point.steps));
    const avgCaloriesBurned = average(weeklySteps.map(point => point.caloriesBurned));
    return {
      avgWater: roundToSingleDecimal(avgWater),
      avgSleepQuality: roundToSingleDecimal(avgSleepQuality),
      avgSleepHours: roundToSingleDecimal(avgSleepHours),
      avgSteps: Math.round(avgSteps),
      avgCaloriesBurned: Math.round(avgCaloriesBurned),
      dominantMood: getMostCommonMood(recentLogs),
    };
  }, [recentLogs, weeklySteps]);

  const hydrationPoints = useMemo<MetricBarChartPoint[]>(
    () =>
      recentLogs.map(log => ({
        id: `${log.id}-water`,
        label: getShortDayLabel(log.timestamp),
        value: log.waterIntake,
        caption: `${log.waterIntake.toFixed(1)}L`,
      })),
    [recentLogs],
  );

  const sleepQualityPoints = useMemo<MetricBarChartPoint[]>(
    () =>
      recentLogs.map(log => ({
        id: `${log.id}-sleep-quality`,
        label: getShortDayLabel(log.timestamp),
        value: log.sleepQuality,
        caption: `${log.sleepQuality}/5`,
      })),
    [recentLogs],
  );

  const recoveryPoints = useMemo<MetricBarChartPoint[]>(
    () =>
      recentLogs.map(log => {
        const score = buildRecoveryScore(log);
        return {
          id: `${log.id}-recovery`,
          label: getShortDayLabel(log.timestamp),
          value: score,
          caption: `${score}`,
        };
      }),
    [recentLogs],
  );

  const stepPoints = useMemo<MetricBarChartPoint[]>(
    () =>
      weeklySteps.map(point => ({
        id: `${point.id}-steps`,
        label: point.day,
        value: point.steps,
        caption: `${Math.round(point.steps / 100) / 10}k`,
      })),
    [weeklySteps],
  );

  const calorieBurnPoints = useMemo<MetricBarChartPoint[]>(
    () =>
      weeklySteps.map(point => ({
        id: `${point.id}-calories`,
        label: point.day,
        value: point.caloriesBurned,
        caption: `${Math.round(point.caloriesBurned)} kcal`,
      })),
    [weeklySteps],
  );

  const caffeinePoints = useMemo<MetricBarChartPoint[]>(() => {
    const caffeineByDate = new Map<string, number>();

    foodEntries.forEach(entry => {
      if (!entry.isCaffeinated) {
        return;
      }

      const existing = caffeineByDate.get(entry.localDate) ?? 0;
      caffeineByDate.set(entry.localDate, existing + entry.caffeineMg);
    });

    return recentLogs.map(log => {
      const localDate = log.timestamp.slice(0, 10);
      const caffeine = caffeineByDate.get(localDate) ?? 0;
      return {
        id: `${log.id}-caffeine`,
        label: getShortDayLabel(log.timestamp),
        value: caffeine,
        caption: `${Math.round(caffeine)}mg`,
      };
    });
  }, [foodEntries, recentLogs]);

  const moodTrendText = useMemo(() => {
    const restedLogs = recentLogs.filter(log => log.sleepQuality >= 4);
    const roughSleepLogs = recentLogs.filter(log => log.sleepQuality <= 3);
    const restedMoodAverage = average(restedLogs.map(log => MOOD_SCORES[log.mood]));
    const roughMoodAverage = average(roughSleepLogs.map(log => MOOD_SCORES[log.mood]));

    if (restedLogs.length === 0 || roughSleepLogs.length === 0) {
      return `Your recent average sleep quality is ${averages.avgSleepQuality.toFixed(
        1,
      )}/5, and mood logging is ready for longer-term comparison.`;
    }

    return `Mood averages ${getMoodLabel(restedMoodAverage)} after stronger sleep and ${getMoodLabel(
      roughMoodAverage,
    )} after rougher sleep.`;
  }, [averages.avgSleepQuality, recentLogs]);

  return (
    <ScreenShell
      title="Insights"
      subtitle="Real charts and patterns derived from your saved sleep, hydration, mood, food, and activity history."
    >
      <AppCard title="7-Day Snapshot">
        <View style={styles.snapshotGrid}>
          <SnapshotTile
            label="Avg Water"
            value={`${averages.avgWater.toFixed(1)}L`}
            accent={colors.accent}
          />
          <SnapshotTile
            label="Sleep Score"
            value={`${averages.avgSleepQuality.toFixed(1)}/5`}
            accent={colors.warning}
          />
          <SnapshotTile
            label="Avg Burn"
            value={
              profile?.weightKg
                ? `${averages.avgCaloriesBurned.toLocaleString()} kcal`
                : 'Set weight'
            }
            accent={colors.danger}
          />
          <SnapshotTile
            label="Avg Sleep"
            value={formatHours(averages.avgSleepHours)}
            accent={colors.primary}
          />
        </View>
        <Text style={styles.chartFootnote}>
          Most common mood this week: {averages.dominantMood}. Average steps: {averages.avgSteps.toLocaleString()}.
        </Text>
      </AppCard>

      <AppCard title="Mood and Sleep Direction">
        <Text style={styles.chartDetail}>{moodTrendText}</Text>
        <Text style={styles.chartFootnote}>
          Interpretable stats come from synchronized relational data, not temporary UI state.
        </Text>
      </AppCard>

      <AppCard title="Hydration Trend">
        <Text style={styles.chartDetail}>
          Daily water intake for your seven most recent logs. Target range: 2.3L to 2.5L.
        </Text>
        <MetricBarChart points={hydrationPoints} color={colors.accent} maxValue={3} />
      </AppCard>

      <AppCard title="Sleep Quality Trend">
        <Text style={styles.chartDetail}>
          Daily sleep quality scores based on your saved check-ins.
        </Text>
        <MetricBarChart points={sleepQualityPoints} color={colors.warning} maxValue={5} />
        <Text style={styles.chartFootnote}>
          Latest sleep score: {recentLogs[recentLogs.length - 1]?.sleepQuality ?? 0}/5{' '}
          {recentLogs[recentLogs.length - 1]
            ? getSleepLabel(recentLogs[recentLogs.length - 1].sleepQuality)
            : ''}
        </Text>
      </AppCard>

      <AppCard title="Daily Steps Trend">
        <Text style={styles.chartDetail}>
          Daily movement totals pulled from your synced account data and cached offline for quick reads.
        </Text>
        <MetricBarChart
          points={stepPoints}
          color={colors.danger}
          maxValue={Math.max(stepGoal, ...weeklySteps.map(point => point.steps), 1)}
        />
        <Text style={styles.chartFootnote}>
          Goal benchmark: {stepGoal.toLocaleString()} steps per day.
        </Text>
      </AppCard>

      <AppCard title="Daily Calorie Burn">
        <Text style={styles.chartDetail}>
          Estimated calories burned from recorded steps plus any timed activities you logged, using your saved body metrics.
        </Text>
        <MetricBarChart
          points={calorieBurnPoints}
          color="#C2410C"
          maxValue={Math.max(100, ...calorieBurnPoints.map(point => point.value), 1)}
        />
        <Text style={styles.chartFootnote}>
          {profile?.weightKg
            ? 'Height improves stride-length estimation, while weight drives the burn estimate.'
            : 'Add your weight in Profile to turn step history into calorie-burn estimates.'}
        </Text>
      </AppCard>

      <AppCard title="Caffeine Timeline">
        <Text style={styles.chartDetail}>
          Daily caffeine totals pulled from your structured food and beverage entries.
          This is what powers late-caffeine versus sleep analysis.
        </Text>
        <MetricBarChart
          points={caffeinePoints}
          color="#0F766E"
          maxValue={Math.max(200, ...caffeinePoints.map(point => point.value), 1)}
        />
      </AppCard>

      <AppCard title="Recovery Score">
        <Text style={styles.chartDetail}>
          Composite score using sleep quality, sleep hours, hydration, and mood.
        </Text>
        <MetricBarChart points={recoveryPoints} color={colors.primary} maxValue={100} />
      </AppCard>

      <AppCard title="Detected Patterns">
        <View style={styles.findingsList}>
          {insightFacts.length === 0 ? (
            <Text style={styles.chartDetail}>
              Keep logging sleep, hydration, meals, and activity. Insights will appear once your
              account has enough synchronized history to support them.
            </Text>
          ) : (
            insightFacts.map(item => (
              <FindingCard
                key={item.title}
                title={`${item.title} (${item.confidence})`}
                detail={`${item.detail} Sample size: ${item.sampleSize} days.`}
                recommendation={item.recommendation}
              />
            ))
          )}
        </View>
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snapshotTile: {
    width: '48%',
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  snapshotDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: 8,
  },
  snapshotLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  snapshotValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartDetail: {
    marginBottom: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
  chartFootnote: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
  findingsList: {
    gap: 12,
  },
  findingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
  },
  findingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  findingDetail: {
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
  recommendationBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#D4F0E6',
    borderRadius: 12,
    backgroundColor: '#F3FCF8',
    padding: 12,
  },
  recommendationLabel: {
    color: '#18735F',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 4,
  },
  recommendationText: {
    color: '#18735F',
    fontSize: 13,
    lineHeight: 18,
  },
});
