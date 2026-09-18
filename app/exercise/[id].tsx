import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Button, Card, IconButton, Loading, Row, Screen, Segmented, SectionHeader } from '@/components/ui';
import { LineChart } from '@/components/Charts';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { getExerciseInsights } from '@/services/stats';
import { countExerciseUsage, deleteCustomExercise } from '@/database/repositories/exerciseRepo';
import { formatSetSummary, formatPRValue } from '@/calculations/format';
import { PR_LABELS } from '@/calculations/prs';
import { formatDateLong, formatDateShort } from '@/calculations/time';
import { formatVolume, formatWeight, toDisplayWeight } from '@/calculations/units';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, SET_TYPE_BADGE, TRACKING_LABELS } from '@/types/labels';
import { friendlyError } from '@/utils/errors';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const unit = useUnit();
  const [tab, setTab] = useState<'history' | 'stats' | 'prs'>('history');
  const q = useQuery({ queryKey: ['exercise-insights', id], queryFn: () => getExerciseInsights(id) });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Screen><AppText>Exercise not found.</AppText></Screen>;
  const { exercise: ex, rows, prs, stats, series } = q.data;

  // Group history rows into sessions, newest first.
  const sessions = new Map<string, typeof rows>();
  for (const r of rows) sessions.set(r.workoutId, [...(sessions.get(r.workoutId) ?? []), r]);
  const ordered = [...sessions.values()].reverse();

  const remove = async () => {
    const n = await countExerciseUsage(ex.id);
    Alert.alert('Delete exercise?', `${n ? `Used in ${n} past workouts - they will keep their history. ` : ''}It will no longer appear in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCustomExercise(ex.id).then(() => router.back()).catch((e) => Alert.alert('Failed', friendlyError(e))) },
    ]);
  };

  const stat = (label: string, v: string) => (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}><AppText variant="caption">{label}</AppText><AppText variant="title" style={{ fontSize: 18 }}>{v}</AppText></Card>
  );
  const metric = ex.tracking_mode === 'weight_reps' ? 'e1rm' : 'weight';
  const chartPts = series
    .map((s) => ({ x: Date.parse(s.at), y: metric === 'e1rm' ? s.bestE1rmKg : (s.maxWeightKg ?? (s.bestReps ?? s.maxDurationSec ?? s.maxDistanceM)) }))
    .filter((s): s is { x: number; y: number } => s.y !== null && s.y !== undefined)
    .map((s) => ({ x: s.x, y: metric === 'e1rm' || ex.tracking_mode.includes('weight') ? toDisplayWeight(s.y, unit) : s.y }));

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between', marginTop: spacing.sm }}>
        <IconButton icon="arrow-back" label="Back" onPress={() => router.back()} />
        {!ex.is_system ? <Row gap={0}><IconButton icon="create-outline" label="Edit exercise" onPress={() => router.push(`/exercise/edit?id=${ex.id}`)} /><IconButton icon="trash-outline" color={p.danger} label="Delete exercise" onPress={() => void remove()} /></Row> : null}
      </Row>
      <AppText variant="display" style={{ fontSize: 26 }}>{ex.name}</AppText>
      <AppText variant="muted">{MUSCLE_LABELS[ex.primary_muscle]}{ex.secondary_muscles.length ? ` (+ ${ex.secondary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')})` : ''} · {EQUIPMENT_LABELS[ex.equipment]} · {TRACKING_LABELS[ex.tracking_mode]}</AppText>
      {ex.instructions ? <AppText style={{ marginTop: spacing.sm }}>{ex.instructions}</AppText> : null}
      {ex.personal_notes ? <AppText variant="muted" style={{ fontStyle: 'italic' }}>📝 {ex.personal_notes}</AppText> : null}
      <View style={{ marginVertical: spacing.lg }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'history', label: 'History' }, { value: 'stats', label: 'Stats' }, { value: 'prs', label: 'Records' }]} />
      </View>

      {tab === 'history' ? (
        ordered.length === 0 ? <AppText variant="muted">No history yet. Complete a set of this exercise to start its diary.</AppText> : ordered.map((s) => (
          <Pressable key={s[0]!.workoutId} onPress={() => router.push(`/workout/${s[0]!.workoutId}`)}>
            <Card style={{ marginBottom: spacing.md, gap: 2 }}>
              <AppText style={{ fontWeight: '800' }}>{formatDateLong(s[0]!.startedAt)}</AppText>
              <AppText variant="caption">{s[0]!.workoutTitle}</AppText>
              {s.map((r) => (
                <AppText key={r.set.id} variant="muted">{SET_TYPE_BADGE[r.set.set_type] ? `${SET_TYPE_BADGE[r.set.set_type]}  ` : ''}{formatSetSummary(ex.tracking_mode, r.set, unit, ex.custom_fields)}{r.set.rpe ? `  @${r.set.rpe}` : ''}{r.set.note ? `  · ${r.set.note}` : ''}</AppText>
              ))}
            </Card>
          </Pressable>
        ))
      ) : null}

      {tab === 'stats' ? (
        <>
          <Row style={{ flexWrap: 'wrap' }} gap={spacing.md}>
            {stat('Max weight', stats.maxWeightKg ? formatWeight(stats.maxWeightKg, unit, true) : '—')}
            {stat('Best set', stats.bestSet ? formatSetSummary(ex.tracking_mode, stats.bestSet, unit, ex.custom_fields) : '—')}
            {stat('Best est. 1RM', stats.bestE1rmKg ? formatWeight(stats.bestE1rmKg, unit, true) : '—')}
            {stat('Best reps', stats.bestReps ? String(stats.bestReps) : '—')}
            {stat('Total sets', String(stats.totalSets))}
            {stat('Total reps', String(stats.totalReps))}
            {stat('Total volume', stats.totalVolumeKg ? formatVolume(stats.totalVolumeKg, unit) : '—')}
            {stat('Sessions / week', stats.sessionsPerWeek ? stats.sessionsPerWeek.toFixed(1) : '—')}
          </Row>
          <SectionHeader title={metric === 'e1rm' ? `Estimated 1RM (${unit})` : 'Best per session'} />
          <LineChart points={chartPts} xLabel={(x) => formatDateShort(new Date(x).toISOString())} />
          <SectionHeader title="Recent performance" />
          {stats.recent.map((r) => <AppText key={r.workoutId} variant="muted">{formatDateShort(r.at)} — {r.bestSet ? formatSetSummary(ex.tracking_mode, r.bestSet, unit, ex.custom_fields) : '—'}</AppText>)}
        </>
      ) : null}

      {tab === 'prs' ? (
        prs.events.length === 0 ? <AppText variant="muted">Records appear after you log completed working sets.</AppText> : (
          (Object.keys(PR_LABELS) as (keyof typeof PR_LABELS)[]).filter((t) => prs.events.some((e) => e.type === t)).map((t) => (
            <View key={t} style={{ marginBottom: spacing.lg }}>
              <AppText variant="label">{PR_LABELS[t]}</AppText>
              {[...prs.events].filter((e) => e.type === t).reverse().map((e, i) => (
                <AppText key={i} style={{ marginTop: 4, color: i === 0 ? p.pr : p.text }}>
                  {formatPRValue(t, e.value, unit)}{e.weight_kg && e.reps && t !== 'best_volume' ? `  (${formatWeight(e.weight_kg, unit)} × ${e.reps})` : ''} — {formatDateShort(e.at)}
                </AppText>
              ))}
            </View>
          ))
        )
      ) : null}
      <View style={{ height: spacing.xl }} />
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
