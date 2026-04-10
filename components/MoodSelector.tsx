import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import type { MoodLevel } from '../types/health';

type MoodSelectorProps = {
  value: MoodLevel;
  onChange: (nextMood: MoodLevel) => void;
};

const MOODS: MoodLevel[] = ['Great', 'Good', 'Okay', 'Low'];

export function MoodSelector({
  value,
  onChange,
}: MoodSelectorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {MOODS.map(mood => {
        const selected = mood === value;
        return (
          <Pressable
            key={mood}
            onPress={() => onChange(mood)}
            style={[styles.pill, selected && styles.pillSelected]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
              {mood}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
});

