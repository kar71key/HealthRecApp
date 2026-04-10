import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type ProgressBarProps = {
  progress: number;
  caption?: string;
};

export function ProgressBar({
  progress,
  caption,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(progress, 1));

  return (
    <View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  caption: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

