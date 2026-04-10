import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { SleepQuality } from '../types/health';

type SleepQualitySelectorProps = {
  value: SleepQuality;
  onChange: (nextValue: SleepQuality) => void;
};

const OPTIONS: Array<{ label: string; value: SleepQuality }> = [
  { label: 'Poor', value: 1 },
  { label: 'Light', value: 2 },
  { label: 'Fair', value: 3 },
  { label: 'Good', value: 4 },
  { label: 'Great', value: 5 },
];

export function SleepQualitySelector({
  value,
  onChange,
}: SleepQualitySelectorProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      {OPTIONS.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.valueText, selected && styles.valueTextSelected]}>
              {option.value}
            </Text>
            <Text style={[styles.labelText, selected && styles.labelTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    minHeight: 78,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  valueText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  valueTextSelected: {
    color: '#FFFFFF',
  },
  labelText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelTextSelected: {
    color: '#FFFFFF',
  },
});
