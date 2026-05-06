import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { ProgressBar } from '../components/ProgressBar';
import { ScreenShell } from '../components/ScreenShell';
import { WeeklyStepsChart } from '../components/WeeklyStepsChart';
import { useHealthData } from '../context/HealthDataContext';
import { estimateCaloriesBurnedFromSteps } from '../services/calorieEstimate';
import { colors } from '../theme/colors';

export function ActivityScreen(): React.JSX.Element {
  const {
    stepsToday,
    caloriesBurnedToday,
    profile,
    stepGoal,
    stepStatus,
    stepStatusMessage,
    weeklySteps,
  } = useHealthData();

  const fallbackVisible =
    stepStatus === 'denied' ||
    stepStatus === 'unavailable' ||
    stepStatus === 'error';

  const latestStepPoint = weeklySteps[weeklySteps.length - 1];

  const displaySteps = useMemo(() => {
    if (stepStatus === 'granted') {
      return Math.max(stepsToday, latestStepPoint?.steps ?? 0);
    }
    return latestStepPoint?.steps ?? 0;
  }, [latestStepPoint?.steps, stepStatus, stepsToday]);

  const displayCalories = useMemo(() => {
    if (profile?.weightKg && displaySteps > 0) {
      return Math.max(
        caloriesBurnedToday,
        estimateCaloriesBurnedFromSteps(
          displaySteps,
          profile.weightKg,
          profile.heightCm ?? null,
        ),
      );
    }
    return latestStepPoint?.caloriesBurned ?? 0;
  }, [
    caloriesBurnedToday,
    displaySteps,
    latestStepPoint?.caloriesBurned,
    profile?.heightCm,
    profile?.weightKg,
  ]);

  const displayProgress = useMemo(() => {
    if (stepGoal <= 0) {
      return 0;
    }
    return Math.min(displaySteps / stepGoal, 1);
  }, [displaySteps, stepGoal]);

  const weeklyAverage = useMemo(() => {
    if (weeklySteps.length === 0) {
      return 0;
    }
    return Math.round(
      weeklySteps.reduce((sum, point) => sum + point.steps, 0) / weeklySteps.length,
    );
  }, [weeklySteps]);

  const weeklyAverageCalories = useMemo(() => {
    if (weeklySteps.length === 0) {
      return 0;
    }
    return Math.round(
      weeklySteps.reduce((sum, point) => sum + point.caloriesBurned, 0) /
        weeklySteps.length,
    );
  }, [weeklySteps]);

  const bestDay = useMemo(() => {
    if (weeklySteps.length === 0) {
      return null;
    }
    return weeklySteps.reduce((top, point) =>
      point.steps > top.steps ? point : top,
    );
  }, [weeklySteps]);

  const goalHitDays = useMemo(
    () => weeklySteps.filter(point => point.steps >= stepGoal).length,
    [stepGoal, weeklySteps],
  );

  return (
    <ScreenShell
      title="Activity"
      subtitle="Live step tracking, calorie burn, and weekly movement trend."
    >
      <AppCard title="Today's Steps">
        <Text style={styles.stepsValue}>{displaySteps.toLocaleString()}</Text>
        <Text style={styles.goalCopy}>
          Goal: {stepGoal.toLocaleString()} steps today
        </Text>
        <Text style={styles.calorieValue}>
          {profile?.weightKg
            ? `${Math.round(displayCalories).toLocaleString()} kcal burned`
            : 'Add your weight in Profile to estimate calories burned'}
        </Text>
        <ProgressBar
          progress={displayProgress}
          caption={`${Math.round(displayProgress * 100)}% of daily goal`}
        />
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Weekly Avg Steps</Text>
            <Text style={styles.summaryValue}>{weeklyAverage.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Weekly Avg Burn</Text>
            <Text style={styles.summaryValue}>
              {profile?.weightKg ? `${weeklyAverageCalories} kcal` : '--'}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Goal Days</Text>
            <Text style={styles.summaryValue}>{goalHitDays}/7</Text>
          </View>
        </View>
      </AppCard>

      <AppCard title="Weekly Steps">
        <WeeklyStepsChart points={weeklySteps} />
        <Text style={styles.chartMeta}>
          {bestDay
            ? `Best day: ${bestDay.day} with ${bestDay.steps.toLocaleString()} steps and ${Math.round(
                bestDay.caloriesBurned,
              ).toLocaleString()} kcal`
            : 'No weekly step history available yet.'}
        </Text>
      </AppCard>

      <AppCard title="Sensor Status">
        <Text style={styles.statusText}>{stepStatusMessage}</Text>
        {fallbackVisible ? (
          <View style={styles.fallbackBox}>
            <Text style={styles.fallbackTitle}>Fallback Active</Text>
            <Text style={styles.fallbackText}>
              Live pedometer data is not available right now, so this tab is
              showing stored daily steps and calorie estimates from your synced account history.
            </Text>
          </View>
        ) : null}
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stepsValue: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  goalCopy: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
  },
  calorieValue: {
    marginTop: 8,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  summaryCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chartMeta: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  fallbackBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE1B4',
    backgroundColor: '#FFF8ED',
  },
  fallbackTitle: {
    color: '#8C5A0E',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  fallbackText: {
    color: '#8C5A0E',
    fontSize: 13,
    lineHeight: 18,
  },
});
