// src/components/common/NDVIBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getNDVIColor, getNDVILabel } from '@/types';

interface Props {
  ndvi: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function NDVIBadge({ ndvi, size = 'md' }: Props) {
  if (ndvi === null) {
    return (
      <View style={[styles.badge, styles.empty]}>
        <Text style={styles.emptyText}>—</Text>
      </View>
    );
  }

  const color = getNDVIColor(ndvi);
  const label = getNDVILabel(ndvi);
  const fontSize = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.value, { color, fontSize }]}>
        {ndvi.toFixed(3)}
      </Text>
      <Text style={[styles.label, { color, fontSize: fontSize - 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  value: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { fontWeight: '500', opacity: 0.8 },
  empty: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
  emptyText: { color: '#9CA3AF', fontSize: 13 },
});
