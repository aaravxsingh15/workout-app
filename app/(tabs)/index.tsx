import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Banner, Button, Card, EmptyState, Row, Screen, SectionHeader } from '@/components/ui';
import { WorkoutCard } from '@/components/WorkoutCard';
import { spacing, usePalette } from '@/theme';
import { useProfileStore } from '@/stores/profileStore';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';
import { useSyncStore } from '@/stores/syncStore';
import { useNow } from '@/hooks/useNow';
import { formatDurationShort, formatTimeOfDay, workoutDurationSec } from '@/calculations/time';
import { getHomeStats } from '@/services/stats';
import { listCompletedWorkouts } from '@/database/repositories/workoutRepo';
import { listRoutines } from '@/database/repositories/routineRepo';
import { discardActiveFlow, startWorkoutFlow } from '@/services/workoutFlow';
import { requestSync } from '@/sync/scheduler';

export default function Home() {
  const p = usePalette();
  const profile = useProfileStore((s) => s.profile);
  const active = useActiveWorkoutMeta((s) => s.workout);
  const sync = useSyncStore();
  const now = useNow(30_000);
  const stats = useQuery({ queryKey: ['home-stats'], queryFn: getHomeStats });
  const recent = useQuery({ queryKey: ['home-recent'], queryFn: () => listCompletedWorkouts({}, 1, 0) });
  const routines = useQuery({ queryKey: ['routines', 'home'], queryFn: () => listRoutines() });
  const last = recent.data?.[0];

  const confirmDiscard = () =>
    Alert.alert('Discard workout?', 'This permanently deletes the workout in progress and everything you logged in it.', [
      { text: 'Keep workout', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => active && void discardActiveFlow(active.id) },
    ]);

  return (
    <Screen scroll>
      <View style={{ paddingTop: spacing.lg, gap: 2 }}>
        <AppText variant="caption">{new Date().toDateString().toUpperCase()}</AppText>
        <AppText variant="display">Hey{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}</AppText>
      </View>

      {sync.status === 'auth_error' ? <View style={{ marginTop: spacing.md }}><Banner tone="danger" text="Session expired. Your data is safe on this phone - sign in again to resume syncing." /></View> : null}
      {sync.status === 'error' ? <View style={{ marginTop: spacing.md }}><Banner text={`Sync problem: ${sync.error}`} action="Retry" onAction={() => requestSync(0)} /></View> : null}

      {active ? (
        <Card style={{ marginTop: spacing.lg, borderColor: p.accent, gap: spacing.sm }}>
          <AppText variant="label" color={p.accent}>Workout in progress</AppText>
          <AppText variant="title">{active.title || 'Workout'}</AppText>
          <AppText variant="muted">Started at {formatTimeOfDay(active.started_at)} · {formatDurationShort(workoutDurationSec(active.started_at, null, now))} elapsed</AppText>
          <Row style={{ marginTop: spacing.sm }}>
            <Button title="Resume workout" onPress={() => router.push('/workout/active')} style={{ flex: 2 }} />
            <Button title="Discard" variant="danger" onPress={confirmDiscard} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
          <Button title="Start empty workout" icon="add" onPress={() => void startWorkoutFlow({ type: 'empty' })} />
          <Row>
            <Button title="Repeat last" variant="secondary" icon="repeat" disabled={!last} onPress={() => last && void startWorkoutFlow({ type: 'repeat', workoutId: last.workout.id })} style={{ flex: 1 }} />
            <Button title="From routine" variant="secondary" icon="list" onPress={() => router.push('/(tabs)/routines')} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}

      {!active && (routines.data?.length ?? 0) > 0 ? (
        <>
          <SectionHeader title="Quick start" />
          {routines.data!.slice(0, 4).map((r) => (
            <Pressable key={r.routine.id} onPress={() => void startWorkoutFlow({ type: 'routine', routineId: r.routine.id })} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md }}>
              <Ionicons name="play-circle" size={30} color={p.accent} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontWeight: '700' }}>{r.routine.name}</AppText>
                <AppText variant="caption" numberOfLines={1}>{r.exerciseNames.join(', ') || 'No exercises yet'}</AppText>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      <SectionHeader title="Training log" />
      <Row gap={spacing.md}>
        {[
          ['This week', stats.data?.week],
          ['This month', stats.data?.month],
        ].map(([label, s]) => (
          <Card key={label as string} style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption">{label as string}</AppText>
            <AppText variant="display">{(s as { workouts: number } | undefined)?.workouts ?? 0}</AppText>
            <AppText variant="caption">workouts · {(s as { workingSets: number } | undefined)?.workingSets ?? 0} sets</AppText>
          </Card>
        ))}
      </Row>

      <SectionHeader title="Last workout" />
      {last ? (
        <WorkoutCard item={last} onPress={() => router.push(`/workout/${last.workout.id}`)} />
      ) : (
        <EmptyState icon="barbell-outline" title="NO WORKOUTS YET" message="Your training diary will appear here after your first workout." actionLabel="START WORKOUT" onAction={() => void startWorkoutFlow({ type: 'empty' })} />
      )}

      <SectionHeader title="Tools" />
      <Row style={{ flexWrap: 'wrap' }} gap={spacing.md}>
        <Button small variant="secondary" icon="body" title="Exercises" onPress={() => router.push('/exercises')} />
        <Button small variant="secondary" icon="scale" title="Bodyweight" onPress={() => router.push('/bodyweight')} />
        <Button small variant="secondary" icon="calculator" title="Plates" onPress={() => router.push('/plate-calculator')} />
      </Row>
    </Screen>
  );
}
