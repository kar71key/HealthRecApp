import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

type TabGlyphProps = {
  active: boolean;
  glyph: string;
};

export function TabGlyph({ active, glyph }: TabGlyphProps): React.JSX.Element {
  return (
    <View style={[styles.wrap, active && styles.wrapActive]}>
      <Text style={[styles.glyph, active && styles.glyphActive]}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  wrapActive: {
    backgroundColor: colors.primaryMuted,
  },
  glyph: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  glyphActive: {
    color: colors.primary,
  },
});

