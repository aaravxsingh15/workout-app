import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppText, Card, Chip, EmptyState, Row, Screen, SectionHeader } from '@/components/ui';
import { BarChart, LineChart } from '@/components/Charts';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { getProgress , getExerciseInsights } from '@/services/stats';
import { RANGE_LABELS, rangeStart, type RangeKey } from '@/calculations/progress';
import { formatDateShort, formatDurationShort } from '@/calculations/time';
import { formatPRValue } from '@/calculations/format';
import { PR_LABELS } from '@/calculations/prs';
import { formatVolume, toDisplayWeight } from '@/calculations/units';
import { MUSCLE_LABELS } from '@/types/labels';
import { startWorkoutFlow } from '@/services/workoutFlow';

export default function Progress() {
  const p = usePalette();
  const unit = useUnit();
  const [range, setRange] = useState<RangeKey>('3m');
  const [exId, setExId] = useState<string | null>(null);
  const [metric, setMetric] = useState<'e1rm' | 'weight' | 'volume'>('e1rm');
  const q = useQuery({ queryKey: ['progress', range], queryFn: () => getProgress(range) });
  const selected = exId ?? q.data?.exercises[0]?.id ?? null;
  const ex = useQuery({ queryKey: ['exercise-insights', selected], queryFn: () => getExerciseInsights(selected!), enabled: !!selected });
  const d = q.data;
  if (d && d.stats.workouts === 0 && d.bodyweight.length === 0)
    return (
      <Screen scroll>
        <AppText variant="display" style={{ marginTop: spacing.sm }}>Progress</AppText>
        <EmptyState icon="stats-chart-outline" title="NO DATA YET" message="Charts and records appear after you complete workouts." actionLabel="START WORKOUT" onAction={() => void startWorkoutFlow({ type: 'empty' })} />
      </Screen>
    );
  const start = rangeStart(range);
  const series = (ex.data?.series ?? []).filter((s) => !start || new Date(s.at) >= start);
  const pts = series
    .map((s) => ({ x: Date.parse(s.at), y: metric === 'e1rm' ? s.bestE1rmKg : metric === 'weight' ? s.maxWeightKg : s.volumeKg }))
    .filter((s): s is { x: number; y: number } => s.y !== null && s.y > 0)
    .map((s) => ({ x: s.x, y: toDisplayWeight(s.y, unit) }));
  const stat = (label: string, v: string) => (
    <Card style={{ flexBasis: '47%', flexGrow: 1, gap: 2 }}><AppText variant="caption">{label}</AppText><AppText variant="title">{v}</AppText></Card>
  );
  return (
    <Screen scroll>
      <AppText variant="display" style={{ marginTop: spacing.sm }}>Progress</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: spacing.md, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm }}>
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => <Chip key={r} label={RANGE_LABELS[r]} selected={range === r} onPress={() => setRange(r)} />)}
      </ScrollView>
      {d ? (
        <>
          <Row style={{ flexWrap: 'wrap' }} gap={spacing.md}>
            {stat('Workouts', String(d.stats.workouts))}
            {stat('Training days', String(d.stats.trainingDays))}
            {stat('Training time', formatDurationShort(d.stats.totalTimeSec))}
            {stat('Avg duration', formatDurationShort(d.stats.avgDurationSec))}
            {stat('Working sets', String(d.stats.workingSets))}
            {stat('Volume', d.stats.volumeKg ? formatVolume(d.stats.volumeKg, unit) : '—')}
          </Row>
          <SectionHeader title="Workouts per week" />
          <BarChart bars={d.weekly.map((w) => ({ label: formatDateShort(w.weekStart + 'T00:00:00'), value: w.count }))} />

          <SectionHeader title="Exercise progression" />
          {d.exercises.length === 0 ? <AppText variant="muted">No exercises logged in this range.</AppText> : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm }}>
                {d.exercises.slice(0, 20).map((e) => <Chip key={e.id} label={e.name} selected={selected === e.id} onPress={() => setExId(e.id)} />)}
              </ScrollView>
              <Row style={{ marginVertical: spacing.sm }}>
                {([['e1rm', 'Est. 1RM'], ['weight', 'Max weight'], ['volume', 'Volume']] as const).map(([m, l]) => <Chip key={m} label={l} selected={metric === m} onPress={() => setMetric(m)} />)}
              </Row>
              <LineChart points={pts} format={(v) => String(Math.round(v))} xLabel={(x) => formatDateShort(new Date(x).toISOString())} />
              {selected ? <Pressable onPress={() => router.push(`/exercise/${selected}`)}><AppText color={p.accent} style={{ marginTop: spacing.sm, fontWeight: '700' }}>Open exercise history →</AppText></Pressable> : null}
            </>
          )}

          <SectionHeader title="Sets per muscle group (working sets)" />
          {d.muscles.length === 0 ? <AppText variant="muted">—</AppText> : d.muscles.map((m) => (
            <View key={m.muscle} style={{ marginBottom: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}><AppText>{MUSCLE_LABELS[m.muscle]}</AppText><AppText variant="muted">{m.sets}</AppText></Row>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: p.surfaceAlt }}><View style={{ height: 6, borderRadius: 3, width: `${(m.sets / d.muscles[0]!.sets) * 100}%`, backgroundColor: p.accent }} /></View>
            </View>
          ))}

          <SectionHeader title="Bodyweight" />
          <LineChart points={d.bodyweight.map((b) => ({ x: Date.parse(b.date), y: toDisplayWeight(b.kg, unit) }))} format={(v) => v.toFixed(1)} xLabel={(x) => formatDateShort(new Date(x).toISOString())} />
          <Pressable onPress={() => router.push('/bodyweight')}><AppText color={p.accent} style={{ marginTop: spacing.sm, fontWeight: '700' }}>Log / edit bodyweight →</AppText></Pressable>

          <SectionHeader title="Personal records" />
          {d.prEvents.length === 0 ? <AppText variant="muted">No new records in this range.</AppText> : d.prEvents.slice(0, 25).map((e, i) => (
            <Pressable key={i} onPress={() => router.push(`/exercise/${e.exerciseId}`)} style={{ marginBottom: 8 }}>
              <AppText style={{ fontWeight: '700' }}>🏆 {e.exerciseName}</AppText>
              <AppText variant="caption">{PR_LABELS[e.record.type]}: {formatPRValue(e.record.type, e.record.value, unit)} — {formatDateShort(e.record.at)}</AppText>
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
