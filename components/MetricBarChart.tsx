import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { MetricBarChartPoint } from '../types/health';

type MetricBarChartProps = {
  points: MetricBarChartPoint[];
  color: string;
  maxValue?: number;
  emptyText?: string;
};

export function MetricBarChart({
  points,
  color,
  maxValue,
  emptyText = 'No data available yet.',
}: MetricBarChartProps): React.JSX.Element {
  const chartMax = useMemo(() => {
    if (typeof maxValue === 'number' && maxValue > 0) {
      return maxValue;
    }
    return Math.max(...points.map(point => point.value), 1);
  }, [maxValue, points]);

  if (points.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.row}>
      {points.map(point => {
        const ratio = point.value / chartMax;
        return (
          <View key={point.id} style={styles.item}>
            <Text style={styles.caption}>{point.caption}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: color,
                    height: `${Math.max(ratio * 100, 6)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.label}>{point.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  row: {
    height: 190,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  caption: {
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  barTrack: {
    height: 126,
    width: '100%',
    borderRadius: 14,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    minHeight: 8,
    borderRadius: 14,
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
