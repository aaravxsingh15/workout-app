import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Badge, Button, Card, IconButton, Loading, Row, Screen } from '@/components/ui';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { deleteWorkout, getWorkoutTree, saveWorkoutAsRoutine } from '@/database/repositories/workoutRepo';
import { getWorkoutPRInfo } from '@/services/stats';
import { summarizeWorkout, muscleSetList } from '@/calculations/sets';
import { formatSetSummary } from '@/calculations/format';
import { formatDateLong, formatDurationShort, formatTimeOfDay, workoutDurationSec } from '@/calculations/time';
import { formatVolume, formatWeight } from '@/calculations/units';
import { PR_LABELS } from '@/calculations/prs';
import { MUSCLE_LABELS, SET_TYPE_BADGE, SET_TYPE_LABELS } from '@/types/labels';
import { startWorkoutFlow } from '@/services/workoutFlow';
import { friendlyError } from '@/utils/errors';

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const unit = useUnit();
  const q = useQuery({
    queryKey: ['workout', id],
    queryFn: async () => {
      const tree = await getWorkoutTree(id);
      return tree ? { tree, pr: await getWorkoutPRInfo(tree) } : null;
    },
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><AppText>Workout not found (it may have been deleted).</AppText><Button title="Back" onPress={() => router.back()} /></Screen>;
  const { tree, pr } = q.data;
  const w = tree.workout;
  const t = summarizeWorkout(tree.exercises.map((e) => ({ tracking_mode: e.we.tracking_mode, custom_fields: e.we.custom_fields, primary_muscle: e.we.primary_muscle, sets: e.sets })));
  const groupLabel = new Map<string, string>();
  const seen = new Map<string, number>();

  const confirmDelete = () =>
    Alert.alert('Delete workout?', 'This removes it from your diary and updates all statistics.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteWorkout(w.id).then(() => router.back()).catch((e) => Alert.alert('Failed', friendlyError(e))) },
    ]);

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        <Row gap={0}>
          <IconButton icon="create-outline" label="Edit workout" onPress={() => router.push(`/workout/edit/${w.id}`)} />
          <IconButton icon="trash-outline" color={p.danger} label="Delete workout" onPress={confirmDelete} />
        </Row>
      </Row>
      <AppText variant="display">{w.title || 'Workout'}</AppText>
      <AppText variant="muted">{formatDateLong(w.started_at)} · {formatTimeOfDay(w.started_at)}{w.ended_at ? ` – ${formatTimeOfDay(w.ended_at)}` : ''}</AppText>
      {w.routine_name ? <AppText variant="caption">From routine: {w.routine_name}</AppText> : null}
      <Card style={{ marginTop: spacing.lg, gap: 4 }}>
        <Row style={{ flexWrap: 'wrap' }} gap={spacing.xl}>
          <View><AppText variant="caption">Duration</AppText><AppText variant="number">{formatDurationShort(workoutDurationSec(w.started_at, w.ended_at))}</AppText></View>
          <View><AppText variant="caption">Exercises</AppText><AppText variant="number">{t.exerciseCount}</AppText></View>
          <View><AppText variant="caption">Working sets</AppText><AppText variant="number">{t.workingSets}</AppText></View>
          <View><AppText variant="caption">Warm-ups</AppText><AppText variant="number">{t.warmupSets}</AppText></View>
          <View><AppText variant="caption">Volume</AppText><AppText variant="number">{t.volumeKg > 0 ? formatVolume(t.volumeKg, unit) : '—'}</AppText></View>
          {w.bodyweight_kg ? <View><AppText variant="caption">Bodyweight</AppText><AppText variant="number">{formatWeight(w.bodyweight_kg, unit, true)}</AppText></View> : null}
          <View><AppText variant="caption">PRs</AppText><AppText variant="number" color={p.pr}>{pr.count}</AppText></View>
        </Row>
        <AppText variant="caption">Sets by muscle: {muscleSetList(t.muscleSets).map((m) => `${MUSCLE_LABELS[m.muscle]} ${m.sets}`).join(' · ') || '—'}</AppText>
      </Card>
      {w.notes ? <Card style={{ marginTop: spacing.md }}><AppText variant="label">Notes</AppText><AppText>{w.notes}</AppText></Card> : null}

      {tree.exercises.map(({ we, sets }) => {
        let label = '';
        if (we.group_id) {
          if (!groupLabel.has(we.group_id)) groupLabel.set(we.group_id, String.fromCharCode(65 + groupLabel.size));
          const n = (seen.get(we.group_id) ?? 0) + 1;
          seen.set(we.group_id, n);
          label = `${groupLabel.get(we.group_id)}${n}`;
        }
        const sessionPRs = pr.bySession.get(we.id) ?? [];
        return (
          <Card key={we.id} style={{ marginTop: spacing.md, gap: 4 }}>
            <Pressable onPress={() => router.push(`/exercise/${we.exercise_id}`)}>
              <Row>
                {label ? <Badge label={label} filled /> : null}
                <AppText variant="title" style={{ fontSize: 18, flex: 1 }}>{we.exercise_name}</AppText>
                {sessionPRs.map((t2) => <Badge key={t2} label={`🏆 ${PR_LABELS[t2]}`} color={p.pr} />)}
              </Row>
            </Pressable>
            {we.notes ? <AppText variant="muted" style={{ fontStyle: 'italic' }}>“{we.notes}”</AppText> : null}
            {sets.length === 0 ? <AppText variant="caption">Skipped</AppText> : null}
            {sets.map((s, i) => (
              <View key={s.id} style={{ paddingVertical: 2 }}>
                <Row>
                  <AppText style={{ width: 34, fontWeight: '800', color: s.set_type === 'warmup' ? p.warmup : p.textMuted }}>{SET_TYPE_BADGE[s.set_type] || i + 1}</AppText>
                  <AppText style={{ flex: 1, fontWeight: '600' }}>
                    {formatSetSummary(we.tracking_mode, s, unit, we.custom_fields)}
                    {s.side !== 'both' ? ` (${s.side})` : ''}
                  </AppText>
                  <AppText variant="caption">
                    {s.rpe ? `RPE ${s.rpe} ` : ''}{s.rir !== null ? `RIR ${s.rir} ` : ''}{s.set_type !== 'normal' && s.set_type !== 'warmup' ? SET_TYPE_LABELS[s.set_type] : ''}
                  </AppText>
                  {(pr.bySet.get(s.id) ?? []).length ? <AppText color={p.pr}>🏆</AppText> : null}
                </Row>
                {s.note ? <AppText variant="caption" style={{ marginLeft: 34 }}>📝 {s.note}</AppText> : null}
              </View>
            ))}
          </Card>
        );
      })}

      <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
        <Button title="Repeat this workout" icon="repeat" onPress={() => void startWorkoutFlow({ type: 'repeat', workoutId: w.id })} />
        <Button title="Save as routine" variant="secondary" onPress={() => saveWorkoutAsRoutine(w.id, `${w.title || 'Workout'} routine`).then(() => Alert.alert('Saved', 'Find it under Routines.')).catch((e) => Alert.alert('Failed', friendlyError(e)))} />
      </View>
    </Screen>
  );
}
