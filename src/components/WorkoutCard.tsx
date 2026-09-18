import React from 'react';
import { View } from 'react-native';
import { AppText, Badge, Card, Row } from './ui';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import type { WorkoutListItem } from '@/database/repositories/workoutRepo';
import { summarizeWorkout } from '@/calculations/sets';
import { formatSetSummary } from '@/calculations/format';
import { dayName, formatDurationShort, formatTimeOfDay, monthName, workoutDurationSec } from '@/calculations/time';
import { formatVolume } from '@/calculations/units';
import { SET_TYPE_BADGE } from '@/types/labels';

export function dateHeader(iso: string): string {
  const d = new Date(iso);
  return `${monthName(d.getMonth()).toUpperCase()} ${d.getDate()} · ${dayName(d.getDay()).toUpperCase()}`;
}

/** Compact diary card; `expanded` shows every set. */
export function WorkoutCard({ item, prCount = 0, expanded = false, onPress }: { item: WorkoutListItem; prCount?: number; expanded?: boolean; onPress?: () => void }) {
  const p = usePalette();
  const unit = useUnit();
  const { workout, exercises } = item;
  const totals = summarizeWorkout(exercises.map((e) => ({ tracking_mode: e.we.tracking_mode, custom_fields: e.we.custom_fields, primary_muscle: e.we.primary_muscle, sets: e.sets })));
  const dur = workout.ended_at ? formatDurationShort(workoutDurationSec(workout.started_at, workout.ended_at)) : 'In progress';
  const shown = expanded ? exercises : exercises.slice(0, 4);
  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" style={{ fontSize: 18 }} numberOfLines={1}>{workout.title || 'Workout'}</AppText>
          <AppText variant="caption">{formatTimeOfDay(workout.started_at)} · {dur}</AppText>
        </View>
        {prCount > 0 ? <Badge label={`${prCount} PR`} color={p.pr} filled /> : null}
      </Row>
      <Row gap={spacing.lg}>
        <AppText variant="muted">{totals.exerciseCount} exercises</AppText>
        <AppText variant="muted">{totals.workingSets} sets</AppText>
        {totals.volumeKg > 0 ? <AppText variant="muted">{formatVolume(totals.volumeKg, unit)}</AppText> : null}
      </Row>
      {shown.map(({ we, sets }) => {
        const done = sets.filter((s) => s.is_completed);
        return (
          <View key={we.id} style={{ marginTop: 4 }}>
            <AppText style={{ fontWeight: '700' }} numberOfLines={1}>{we.exercise_name}</AppText>
            {done.length === 0 ? (
              <AppText variant="caption">Skipped</AppText>
            ) : (
              (expanded ? done : done.slice(0, 3)).map((s) => (
                <AppText key={s.id} variant="muted">
                  {SET_TYPE_BADGE[s.set_type] ? `${SET_TYPE_BADGE[s.set_type]}  ` : ''}
                  {formatSetSummary(we.tracking_mode, s, unit, we.custom_fields)}
                  {s.rpe ? `  @${s.rpe}` : ''}
                  {s.note ? `  · ${s.note}` : ''}
                </AppText>
              ))
            )}
            {!expanded && done.length > 3 ? <AppText variant="caption">+{done.length - 3} more sets</AppText> : null}
          </View>
        );
      })}
      {!expanded && exercises.length > shown.length ? <AppText variant="caption">+{exercises.length - shown.length} more exercises</AppText> : null}
      {workout.notes ? <AppText variant="muted" style={{ fontStyle: 'italic' }} numberOfLines={expanded ? undefined : 2}>“{workout.notes}”</AppText> : null}
    </Card>
  );
}
