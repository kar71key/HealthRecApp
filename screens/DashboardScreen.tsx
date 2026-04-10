import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '../components/AppCard';
import { ProgressBar } from '../components/ProgressBar';
import { ScreenShell } from '../components/ScreenShell';
import { useHealthData } from '../context/HealthDataContext';
import { colors } from '../theme/colors';

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}): React.JSX.Element {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statDot, { backgroundColor: accent }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function DashboardScreen(): React.JSX.Element {
  const {
    stepsToday,
    stepGoal,
    stepProgress,
    logs,
    stepStatus,
    stepStatusMessage,
    weeklySteps,
  } = useHealthData();

  const latestLog = logs[0];
  const latestStepPoint = weeklySteps[weeklySteps.length - 1];

  const dashboardSteps = useMemo(() => {
    if (stepStatus === 'granted') {
      return stepsToday;
    }
    return latestStepPoint?.steps ?? 0;
  }, [latestStepPoint?.steps, stepStatus, stepsToday]);

  const dashboardProgress = useMemo(() => {
    if (stepStatus === 'granted') {
      return stepProgress;
    }
    if (stepGoal <= 0) {
      return 0;
    }
    return Math.min(dashboardSteps / stepGoal, 1);
  }, [dashboardSteps, stepGoal, stepProgress, stepStatus]);

  const hydrationText = useMemo(() => {
    if (!latestLog) {
      return '0.0L';
    }
    return `${latestLog.waterIntake.toFixed(1)}L`;
  }, [latestLog]);

  const sleepText = useMemo(() => {
    if (!latestLog) {
      return 'No log';
    }
    return `${latestLog.sleepQuality}/5`;
  }, [latestLog]);

  const statusSummary = useMemo(() => {
    if (!latestLog) {
      return 'No local wellness log saved yet.';
    }

    const parts = [];
    parts.push(`Mood ${latestLog.mood.toLowerCase()}`);
    parts.push(`${latestLog.sleepHours.toFixed(1)}h sleep`);
    parts.push(`${latestLog.waterIntake.toFixed(1)}L water`);
    if (latestLog.symptoms.trim().length > 0) {
      parts.push('symptoms logged');
    }
    return `Latest local check-in: ${parts.join(' · ')}.`;
  }, [latestLog]);

  const recommendation = useMemo(() => {
    if (!latestLog) {
      return 'Start with a quick daily check-in so the app can tailor hydration, sleep, and symptom guidance.';
    }

    const suggestions: string[] = [];

    if (latestLog.waterIntake < 2.3) {
      suggestions.push(
        `Increase hydration by about ${(2.3 - latestLog.waterIntake).toFixed(1)}L to reach your daily target.`,
      );
    }

    if (latestLog.sleepQuality <= 3 || latestLog.sleepHours < 7) {
      suggestions.push(
        `Protect tonight's recovery window and aim for at least ${Math.max(
          7,
          Math.ceil(latestLog.sleepHours + 0.5),
        )} hours of sleep.`,
      );
    }

    if (latestLog.symptoms.trim().length > 0) {
      suggestions.push('Keep symptom notes precise so trends become easier to spot.');
    }

    if (dashboardSteps < stepGoal) {
      suggestions.push(
        `A ${Math.max(stepGoal - dashboardSteps, 0).toLocaleString()}-step gap remains for today.`,
      );
    }

    if (suggestions.length === 0) {
      return 'Your recent log looks stable. Keep the same hydration, sleep, and movement rhythm through the next few days.';
    }

    return suggestions.join(' ');
  }, [dashboardSteps, latestLog, stepGoal]);

  const lastLogTime = useMemo(() => {
    if (!latestLog) {
      return 'No daily log yet';
    }
    return new Date(latestLog.timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [latestLog]);

  return (
    <ScreenShell
      title="Dashboard"
      subtitle="Your daily health overview with live and logged metrics."
    >
      <AppCard title="Today's Snapshot">
        <View style={styles.grid}>
          <StatTile
            label="Steps"
            value={dashboardSteps.toLocaleString()}
            accent={colors.primary}
          />
          <StatTile
            label="Hydration"
            value={hydrationText}
            accent={colors.accent}
          />
          <StatTile
            label="Sleep"
            value={sleepText}
            accent={colors.warning}
          />
          <StatTile
            label="Mood"
            value={latestLog?.mood ?? 'No log'}
            accent={colors.danger}
          />
        </View>
        <Text style={styles.snapshotMeta}>Last local update: {lastLogTime}</Text>
      </AppCard>

      <AppCard title="Step Goal Progress">
        <Text style={styles.goalText}>
          {dashboardSteps.toLocaleString()} / {stepGoal.toLocaleString()} steps
        </Text>
        <ProgressBar
          progress={dashboardProgress}
          caption={`${Math.round(dashboardProgress * 100)}% complete`}
        />
      </AppCard>

      <AppCard title="Status">
        <Text style={styles.statusCopy}>{statusSummary}</Text>
        <Text style={styles.statusDetail}>{stepStatusMessage}</Text>
      </AppCard>

      <AppCard title="Today's Recommendation">
        <Text style={styles.recommendation}>
          {recommendation}
        </Text>
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    width: '48%',
    minHeight: 95,
    borderRadius: 14,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  goalText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  snapshotMeta: {
    marginTop: 12,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusCopy: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  statusDetail: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  recommendation: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
});
