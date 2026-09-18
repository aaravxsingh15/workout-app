import React from 'react';
import { Pressable, View } from 'react-native';
import { usePathname, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './ui';
import { radius, spacing, usePalette } from '@/theme';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';
import { restRemainingMs, useRestTimer } from '@/stores/restTimer';
import { useNow } from '@/hooks/useNow';
import { formatClock, workoutDurationSec } from '@/calculations/time';

const TAB_PATHS = ['/', '/diary', '/routines', '/progress', '/profile'];

/** Floating "return to workout" bar shown on every screen while a workout is in progress. */
export function ActiveWorkoutBar() {
  const workout = useActiveWorkoutMeta((s) => s.workout);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const now = useNow(1000);
  const rest = useRestTimer();
  if (!workout || pathname.startsWith('/workout/active') || pathname.startsWith('/exercise-picker')) return null;

  const onTab = TAB_PATHS.includes(pathname);
  const remaining = rest.active ? Math.ceil(restRemainingMs(rest, now) / 1000) : 0;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: (onTab ? 64 : 12) + insets.bottom }}>
      <Pressable
        onPress={() => router.push('/workout/active')}
        accessibilityLabel="Return to active workout"
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: p.accent, borderRadius: radius.lg, paddingHorizontal: spacing.lg, height: 56, elevation: 6 }}
      >
        <Ionicons name="barbell" size={22} color={p.accentText} />
        <View style={{ flex: 1 }}>
          <AppText color={p.accentText} style={{ fontWeight: '800' }} numberOfLines={1}>{workout.title || 'Workout'}</AppText>
          <AppText color={p.accentText} variant="caption" style={{ opacity: 0.85 }}>
            {remaining > 0 ? `Rest ${formatClock(remaining)}  ·  ` : ''}In progress
          </AppText>
        </View>
        <AppText color={p.accentText} variant="number">{formatClock(workoutDurationSec(workout.started_at, null, now))}</AppText>
        <Ionicons name="chevron-up" size={20} color={p.accentText} />
      </Pressable>
    </View>
  );
}
