import React, { memo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, IconButton, Row } from '@/components/ui';
import { font, radius, spacing, usePalette } from '@/theme';
import { useWorkoutSession } from '@/stores/workoutSession';
import { restRemainingMs, useRestTimer } from '@/stores/restTimer';
import { useNow } from '@/hooks/useNow';
import { formatClock, parseDurationInput } from '@/calculations/time';
import { displayDistanceToMeters, formatNumber, fromDisplayWeight, metersToDisplayDistance, toDisplayWeight } from '@/calculations/units';
import { FIELD_COLUMN } from '@/calculations/tracking';
import { formatSetSummary } from '@/calculations/format';
import { placeholderValues } from '@/calculations/prefill';
import { parseDecimal } from '@/validation/schemas';
import { haptic } from '@/services/haptics';
import { SET_TYPE_BADGE } from '@/types/labels';
import type { FieldKey, Unit, WorkoutSet } from '@/types/domain';

const HEADERS: Record<FieldKey, (u: Unit) => string> = {
  weight: (u) => u.toUpperCase(),
  added_weight: (u) => `+${u.toUpperCase()}`,
  assistance: (u) => `-${u.toUpperCase()}`,
  reps: () => 'REPS',
  duration: () => 'TIME',
  distance: (u) => (u === 'lb' ? 'MI' : 'KM'),
};

function format(field: FieldKey, v: number | null | undefined, unit: Unit): string {
  if (v === null || v === undefined) return '';
  if (field === 'reps') return String(v);
  if (field === 'duration') return formatClock(v);
  if (field === 'distance') return formatNumber(metersToDisplayDistance(v, unit), 3);
  return formatNumber(toDisplayWeight(v, unit));
}

/** Returns canonical value, null for blank, undefined for invalid. */
function parse(field: FieldKey, text: string, unit: Unit): number | null | undefined {
  if (field === 'duration') return parseDurationInput(text);
  const n = parseDecimal(text);
  if (n === null) return null;
  if (Number.isNaN(n)) return undefined;
  if (field === 'reps') return Math.round(n);
  if (field === 'distance') return displayDistanceToMeters(n, unit);
  return fromDisplayWeight(n, unit);
}

export function NumField({ field, value, placeholder, unit, onCommit, width = 1 }: { field: FieldKey; value: number | null; placeholder?: number; unit: Unit; onCommit: (v: number | null) => void; width?: number }) {
  const p = usePalette();
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  return (
    <TextInput
      value={focused ? text : format(field, value, unit)}
      placeholder={placeholder !== undefined ? format(field, placeholder, unit) : '-'}
      placeholderTextColor={p.textFaint}
      keyboardType={field === 'duration' ? 'numbers-and-punctuation' : 'decimal-pad'}
      selectTextOnFocus
      onFocus={() => {
        setText(format(field, value, unit));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChangeText={(t) => {
        setText(t);
        const v = parse(field, t, unit);
        if (v !== undefined) onCommit(v);
      }}
      style={{ flex: width, height: 44, marginHorizontal: 3, borderRadius: radius.sm, backgroundColor: p.surfaceAlt, color: p.text, textAlign: 'center', fontSize: font.bodyLg, fontWeight: '700', padding: 0 }}
    />
  );
}

export const SetRow = memo(function SetRow({ setId, index, fields, unit, showRpe, showRir, onOpenMenu, onCompleted }: {
  setId: string; index: number; fields: FieldKey[]; unit: Unit; showRpe: boolean; showRir: boolean;
  onOpenMenu: (setId: string) => void; onCompleted: (setId: string) => void;
}) {
  const p = usePalette();
  const set = useWorkoutSession((s) => s.sets[setId]);
  const updateSet = useWorkoutSession((s) => s.updateSet);
  const toggle = useWorkoutSession((s) => s.toggleComplete);
  if (!set) return null;

  const st = useWorkoutSession.getState();
  const we = st.exercises[set.workout_exercise_id];
  const prevSets = we ? (st.previous[we.exercise_id]?.sets ?? []) : [];
  const ids = st.setOrder[set.workout_exercise_id] ?? [];
  const prevSet = prevSets[Math.min(index, prevSets.length - 1)];
  const ph = placeholderValues(set, fields, {
    mode: 'previous_workout',
    previousSets: prevSets,
    index,
    earlier: ids.slice(0, ids.indexOf(setId)).map((id) => st.sets[id]!).filter(Boolean),
  });
  const badge = SET_TYPE_BADGE[set.set_type];
  const badgeColor = set.set_type === 'warmup' ? p.warmup : set.set_type === 'normal' ? p.textMuted : set.set_type === 'failure' ? p.danger : p.warning;
  const done = set.is_completed;

  const copyPrev = () => {
    if (!prevSet) return;
    const patch: Partial<WorkoutSet> = {};
    for (const f of fields) (patch as Record<string, unknown>)[FIELD_COLUMN[f]] = prevSet[FIELD_COLUMN[f] as keyof WorkoutSet];
    updateSet(setId, patch);
  };

  return (
    <View style={{ backgroundColor: done ? p.isDark ? '#12261C' : '#E4F5EB' : 'transparent', borderRadius: radius.md, marginVertical: 2 }}>
      <Row gap={0} style={{ minHeight: 50 }}>
        <Pressable onPress={() => onOpenMenu(setId)} style={{ width: 38, height: 44, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Set options">
          <Text style={{ color: badgeColor, fontWeight: '900', fontSize: font.bodyLg }}>{badge || index + 1}</Text>
          {set.side !== 'both' ? <Text style={{ color: p.textFaint, fontSize: 10 }}>{set.side === 'left' ? 'L' : 'R'}</Text> : null}
        </Pressable>
        <Pressable onPress={copyPrev} style={{ flex: 1.5, height: 44, justifyContent: 'center' }}>
          <Text numberOfLines={1} style={{ color: p.textFaint, fontSize: font.small, textAlign: 'center' }}>
            {prevSet && we ? formatSetSummary(we.tracking_mode, prevSet, unit, we.custom_fields) : '-'}
          </Text>
        </Pressable>
        {fields.map((f) => (
          <NumField key={f} field={f} unit={unit} value={set[FIELD_COLUMN[f] as keyof WorkoutSet] as number | null} placeholder={ph[f]} onCommit={(v) => updateSet(setId, { [FIELD_COLUMN[f]]: v } as Partial<WorkoutSet>)} />
        ))}
        {showRpe ? (
          <NumField field="weight" unit="kg" width={0.7} value={set.rpe} onCommit={(v) => updateSet(setId, { rpe: v !== null && v >= 1 && v <= 10 ? v : null })} />
        ) : null}
        {showRir ? (
          <NumField field="reps" unit={unit} width={0.6} value={set.rir} onCommit={(v) => updateSet(setId, { rir: v !== null && v >= 0 && v <= 10 ? v : null })} />
        ) : null}
        <Pressable
          accessibilityLabel={done ? 'Mark set not done' : 'Mark set done'}
          onPress={() => {
            const nowDone = toggle(setId);
            if (nowDone) {
              haptic('success');
              onCompleted(setId);
            }
          }}
          style={{ width: 48, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={32} color={done ? p.success : p.textFaint} />
        </Pressable>
      </Row>
      {set.note ? <AppText variant="caption" style={{ paddingHorizontal: spacing.md, paddingBottom: 4 }}>📝 {set.note}</AppText> : null}
    </View>
  );
});

export function SetHeader({ fields, unit, showRpe, showRir }: { fields: FieldKey[]; unit: Unit; showRpe: boolean; showRir: boolean }) {
  const cell = (label: string, flex: number, w?: number) => (
    <Text key={label} style={{ flex: w ? undefined : flex, width: w, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#7C8794' }}>{label}</Text>
  );
  return (
    <Row gap={0} style={{ marginTop: spacing.sm }}>
      {cell('SET', 0, 38)}
      {cell('PREVIOUS', 1.5)}
      {fields.map((f) => cell(HEADERS[f](unit), 1))}
      {showRpe ? cell('RPE', 0.7) : null}
      {showRir ? cell('RIR', 0.6) : null}
      {cell('✓', 0, 48)}
    </Row>
  );
}

export function RestTimerBar() {
  const p = usePalette();
  const t = useRestTimer();
  const now = useNow(500);
  const remainingMs = restRemainingMs(t, now);
  const paused = t.pausedRemainingMs !== null;
  React.useEffect(() => {
    if (t.active && !paused && t.endsAt && remainingMs <= 0) {
      haptic('warning');
      const id = setTimeout(() => useRestTimer.getState().complete(), 4000);
      return () => clearTimeout(id);
    }
  }, [t.active, paused, t.endsAt, remainingMs]);
  if (!t.active) return null;
  const over = !paused && remainingMs <= 0;
  const secs = Math.ceil(remainingMs / 1000);
  const pct = t.durationSec > 0 ? Math.min(1, 1 - remainingMs / (t.durationSec * 1000)) : 1;
  return (
    <View style={{ backgroundColor: p.surface, borderTopWidth: 1, borderColor: over ? p.success : p.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ height: 3, backgroundColor: p.surfaceAlt, borderRadius: 2, marginBottom: spacing.sm }}>
        <View style={{ height: 3, width: `${pct * 100}%`, backgroundColor: over ? p.success : p.accent, borderRadius: 2 }} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <AppText variant="caption">{over ? 'REST OVER' : paused ? 'REST PAUSED' : 'REST'}</AppText>
          <AppText variant="display" style={{ fontSize: 30 }}>{formatClock(secs)}</AppText>
        </View>
        <Row gap={0}>
          <IconButton icon="remove-circle-outline" label="Minus 15 seconds" onPress={() => t.addSeconds(-15)} />
          <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Resume' : 'Pause'} onPress={() => (paused ? t.resume() : t.pause())} />
          <IconButton icon="refresh" label="Restart" onPress={() => t.restart()} />
          <IconButton icon="add-circle-outline" label="Plus 15 seconds" onPress={() => t.addSeconds(15)} />
          <IconButton icon="play-skip-forward" label="Skip rest" onPress={() => t.skip()} />
        </Row>
      </Row>
    </View>
  );
}
