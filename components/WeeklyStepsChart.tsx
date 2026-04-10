import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { StepPoint } from '../types/health';

type WeeklyStepsChartProps = {
  points: StepPoint[];
};

export function WeeklyStepsChart({
  points,
}: WeeklyStepsChartProps): React.JSX.Element {
  const maxSteps = useMemo(
    () => Math.max(...points.map(point => point.steps), 1),
    [points],
  );

  return (
    <View style={styles.row}>
      {points.map(point => {
        const ratio = point.steps / maxSteps;
        return (
          <View key={point.id} style={styles.item}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { height: `${ratio * 100}%` }]} />
            </View>
            <Text style={styles.day}>{point.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 170,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    height: 130,
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 10,
    backgroundColor: colors.accent,
    minHeight: 6,
  },
  day: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
