import React from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Button, Card, Field, Loading, Row, Screen, SectionHeader } from '@/components/ui';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { getWorkoutTree, saveWorkoutAsRoutine, updateRoutineFromWorkout, updateWorkout } from '@/database/repositories/workoutRepo';
import { getWorkoutPRInfo } from '@/services/stats';
import { summarizeWorkout } from '@/calculations/sets';
import { formatDateLong, formatDurationShort, workoutDurationSec } from '@/calculations/time';
import { formatVolume } from '@/calculations/units';
import { PR_LABELS } from '@/calculations/prs';
import { friendlyError } from '@/utils/errors';

export default function Summary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const unit = useUnit();
  const q = useQuery({
    queryKey: ['summary', id],
    queryFn: async () => {
      const tree = await getWorkoutTree(id);
      if (!tree) return null;
      return { tree, pr: await getWorkoutPRInfo(tree) };
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><AppText>Workout not found.</AppText></Screen>;
  const { tree, pr } = q.data;
  const w = tree.workout;
  const t = summarizeWorkout(tree.exercises.map((e) => ({ tracking_mode: e.we.tracking_mode, custom_fields: e.we.custom_fields, primary_muscle: e.we.primary_muscle, sets: e.sets })));
  const prLines = tree.exercises.flatMap(({ we, sets }) => {
    const types = new Set<string>();
    for (const s of sets) for (const ty of pr.bySet.get(s.id) ?? []) types.add(ty);
    for (const ty of pr.bySession.get(we.id) ?? []) types.add(ty);
    return [...types].map((ty) => `${we.exercise_name} — ${PR_LABELS[ty as keyof typeof PR_LABELS]}`);
  });

  const stat = (label: string, value: string) => (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant="title">{value}</AppText>
    </Card>
  );

  return (
    <Screen scroll>
      <View style={{ paddingTop: spacing.xl, gap: 4 }}>
        <AppText variant="label" color={p.success}>Workout complete</AppText>
        <AppText variant="display">{w.title || 'Workout'}</AppText>
        <AppText variant="muted">{formatDateLong(w.started_at)}</AppText>
      </View>
      <Row style={{ flexWrap: 'wrap', marginTop: spacing.lg }} gap={spacing.md}>
        {stat('Duration', formatDurationShort(workoutDurationSec(w.started_at, w.ended_at)))}
        {stat('Exercises', String(t.exerciseCount))}
        {stat('Total sets', String(t.totalSets))}
        {stat('Working sets', String(t.workingSets))}
        {stat('Warm-up sets', String(t.warmupSets))}
        {stat('Volume', t.volumeKg > 0 ? formatVolume(t.volumeKg, unit) : '—')}
      </Row>
      <SectionHeader title={`Personal records (${pr.count})`} />
      {prLines.length ? prLines.map((l) => <AppText key={l} style={{ color: p.pr, marginBottom: 4 }}>🏆 {l}</AppText>) : <AppText variant="muted">No new records this time — the log is what counts.</AppText>}
      <SectionHeader title="Session notes" />
      <Field defaultValue={w.notes} multiline placeholder="How did it feel? (optional)" onEndEditing={(e) => void updateWorkout(w.id, { notes: e.nativeEvent.text })} />
      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button title="Done" onPress={() => router.replace('/(tabs)')} />
        <Button title="View in diary" variant="secondary" onPress={() => router.replace(`/workout/${w.id}`)} />
        {w.routine_id ? (
          <Button
            title="Update original routine with today's structure"
            variant="secondary"
            onPress={() =>
              Alert.alert('Update routine?', `"${w.routine_name}" will be overwritten with the exercises and sets from this workout.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Update', onPress: () => updateRoutineFromWorkout(w.id).then(() => Alert.alert('Routine updated')).catch((e) => Alert.alert('Failed', friendlyError(e))) },
              ])
            }
          />
        ) : null}
        <Button title="Save as routine" variant="secondary" onPress={() => saveWorkoutAsRoutine(w.id, `${w.title || 'Workout'} routine`).then(() => Alert.alert('Saved', 'Find it under Routines.')).catch((e) => Alert.alert('Failed', friendlyError(e)))} />
      </View>
    </Screen>
  );
}
