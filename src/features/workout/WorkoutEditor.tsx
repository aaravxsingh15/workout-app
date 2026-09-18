import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Badge, Banner, Button, Card, Field, IconButton, Loading, Row, Screen, Sheet, SheetItem } from '@/components/ui';
import { RestTimerBar, SetHeader, SetRow } from './components';
import { spacing, usePalette } from '@/theme';
import { useWorkoutSession, type SessionMode } from '@/stores/workoutSession';
import { useProfileStore, useUnit } from '@/stores/profileStore';
import { useRestTimer } from '@/stores/restTimer';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';
import { usePickerStore } from '@/stores/pickerStore';
import { getFields } from '@/calculations/tracking';
import { formatSetSummary } from '@/calculations/format';
import { formatClock, formatDateShort, workoutDurationSec, formatTimeOfDay } from '@/calculations/time';
import { discardActiveFlow } from '@/services/workoutFlow';
import { friendlyError } from '@/utils/errors';
import { haptic } from '@/services/haptics';
import { SET_TYPES, type SetType } from '@/types/domain';
import { MUSCLE_LABELS, SET_TYPE_LABELS } from '@/types/labels';
import { useNow } from '@/hooks/useNow';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
const toLocalText = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function fromLocalText(t: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Elapsed({ startedAt, endedAt }: { startedAt: string; endedAt: string | null }) {
  const now = useNow(1000);
  return <AppText variant="number">{formatClock(workoutDurationSec(startedAt, endedAt, now))}</AppText>;
}

const ExerciseCard = memo(function ExerciseCard({ weId, label, onMenu, onSetMenu, mode }: { weId: string; label: string | null; onMenu: (weId: string) => void; onSetMenu: (setId: string) => void; mode: SessionMode }) {
  const p = usePalette();
  const unit = useUnit();
  const profile = useProfileStore((s) => s.profile);
  const we = useWorkoutSession((s) => s.exercises[weId]);
  const setIds = useWorkoutSession((s) => s.setOrder[weId]);
  const prev = useWorkoutSession((s) => (we ? s.previous[we.exercise_id] : null));
  const addSet = useWorkoutSession((s) => s.addSet);
  const setNotes = useWorkoutSession((s) => s.setExerciseNotes);
  if (!we || !setIds) return null;
  const fields = getFields(we.tracking_mode, we.custom_fields);
  const onCompleted = (setId: string) => {
    if (mode !== 'active' || !profile?.auto_rest_timer) return;
    const s = useWorkoutSession.getState().sets[setId];
    if (s?.set_type === 'warmup') return;
    useRestTimer.getState().start(we.rest_sec ?? profile.default_rest_sec, we.exercise_name);
  };
  return (
    <Card style={{ marginBottom: spacing.md, gap: spacing.xs }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Row>
            {label ? <Badge label={label} color={p.accent} filled /> : null}
            <AppText variant="title" style={{ fontSize: 18, flexShrink: 1 }}>{we.exercise_name}</AppText>
          </Row>
          <AppText variant="caption">{MUSCLE_LABELS[we.primary_muscle]}{we.is_unilateral ? ' · Unilateral (tap set # to set side)' : ''}</AppText>
        </View>
        <IconButton icon="ellipsis-horizontal" label="Exercise options" onPress={() => onMenu(weId)} />
      </Row>
      <Field value={we.notes} onChangeText={(t) => setNotes(weId, t)} placeholder="Exercise note" multiline style={{ marginVertical: 2 }} />
      {prev ? (
        <AppText variant="caption">
          LAST TIME ({formatDateShort(prev.startedAt)}): {prev.sets.map((s) => formatSetSummary(we.tracking_mode, s, unit, we.custom_fields)).join('  |  ')}
        </AppText>
      ) : (
        <AppText variant="caption">No previous performance yet</AppText>
      )}
      <SetHeader fields={fields} unit={unit} showRpe={profile?.show_rpe ?? true} showRir={profile?.show_rir ?? false} />
      {setIds.map((id, i) => (
        <SetRow key={id} setId={id} index={i} fields={fields} unit={unit} showRpe={profile?.show_rpe ?? true} showRir={profile?.show_rir ?? false} onOpenMenu={onSetMenu} onCompleted={onCompleted} />
      ))}
      <Button small variant="secondary" icon="add" title="Add set" onPress={() => void addSet(weId)} style={{ marginTop: spacing.sm }} />
    </Card>
  );
});

export function WorkoutEditor({ workoutId, mode }: { workoutId: string; mode: SessionMode }) {
  const p = usePalette();
  const store = useWorkoutSession();
  const { workout, exerciseOrder, exercises, groups, loading, loadError, saveError, sets, setOrder } = store;
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [setMenu, setSetMenu] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [startText, setStartText] = useState<string | null>(null);
  const [endText, setEndText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unit = useUnit();
  void unit;

  useEffect(() => {
    void useWorkoutSession.getState().load(workoutId, mode);
    return () => {
      if (mode === 'edit') {
        void useWorkoutSession.getState().flush().then(() => useWorkoutSession.getState().close());
      }
    };
  }, [workoutId, mode]);

  const labels = useMemo(() => {
    const out: Record<string, string> = {};
    const letters = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const id of exerciseOrder) {
      const g = exercises[id]?.group_id;
      if (!g || !groups[g]) continue;
      if (!letters.has(g)) letters.set(g, String.fromCharCode(65 + letters.size));
      const n = (counts.get(g) ?? 0) + 1;
      counts.set(g, n);
      out[id] = `${letters.get(g)}${n}`;
    }
    return out;
  }, [exerciseOrder, exercises, groups]);

  const openMenu = useCallback((id: string) => setExMenu(id), []);
  const openSetMenu = useCallback((id: string) => setSetMenu(id), []);

  if (loading || !workout) return loadError ? <Screen><Banner tone="danger" text={loadError} /><Button title="Back" onPress={() => router.back()} /></Screen> : <Loading />;

  const addExercises = () => {
    usePickerStore.getState().open({
      title: 'Add exercises',
      multi: true,
      onPick: async (exs) => {
        for (const e of exs) await useWorkoutSession.getState().addExercise(e, null);
        haptic('light');
      },
    });
    router.push('/exercise-picker');
  };

  const replace = (weId: string) => {
    setExMenu(null);
    usePickerStore.getState().open({ title: 'Replace exercise', multi: false, onPick: (exs) => useWorkoutSession.getState().replaceExercise(weId, exs[0]!) });
    router.push('/exercise-picker');
  };

  const removeExercise = (weId: string) => {
    setExMenu(null);
    const done = (setOrder[weId] ?? []).filter((id) => sets[id]?.is_completed).length;
    const doRemove = () => void store.removeExercise(weId);
    if (done > 0) Alert.alert('Remove exercise?', `${done} completed set${done > 1 ? 's' : ''} logged for this exercise will be deleted.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: doRemove }]);
    else doRemove();
  };

  const linkNext = (weId: string) => {
    setExMenu(null);
    const i = exerciseOrder.indexOf(weId);
    const next = exerciseOrder[i + 1];
    if (!next) return Alert.alert('Nothing to link', 'Add another exercise below this one first.');
    const current = exercises[weId]?.group_id;
    const members = current ? exerciseOrder.filter((id) => exercises[id]?.group_id === current) : [weId];
    void store.groupExercises([...new Set([...members, next])]);
  };

  const finish = async () => {
    if (busy) return;
    const all = Object.values(sets);
    const open = all.filter((s) => !s.is_completed).length;
    const doFinish = async () => {
      setBusy(true);
      try {
        await store.finish();
        useRestTimer.getState().skip();
        await useActiveWorkoutMeta.getState().refresh();
        haptic('success');
        router.replace(`/workout/summary/${workoutId}`);
      } catch (e) {
        Alert.alert('Could not finish', friendlyError(e));
        setBusy(false);
      }
    };
    if (all.every((s) => !s.is_completed)) return Alert.alert('Nothing logged', 'Complete at least one set, or discard the workout.');
    if (open > 0) Alert.alert('Unfinished sets', `${open} set${open > 1 ? 's are' : ' is'} not marked done and will be removed.`, [{ text: 'Keep going', style: 'cancel' }, { text: 'Finish workout', onPress: () => void doFinish() }]);
    else void doFinish();
  };

  const discard = () =>
    Alert.alert('Discard workout?', 'Everything logged in this workout will be permanently deleted.', [
      { text: 'Keep workout', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => void discardActiveFlow(workoutId).then(() => router.back()) },
    ]);

  const ex = exMenu ? exercises[exMenu] : null;
  const menuSet = setMenu ? sets[setMenu] : null;

  return (
    <Screen edges={['top', 'bottom']} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Row style={{ paddingHorizontal: spacing.md, justifyContent: 'space-between' }}>
          <IconButton icon={mode === 'active' ? 'chevron-down' : 'arrow-back'} label={mode === 'active' ? 'Minimize workout' : 'Back'} onPress={() => { void store.flush(); router.back(); }} />
          {mode === 'active' ? <Elapsed startedAt={workout.started_at} endedAt={null} /> : <AppText variant="label">Editing</AppText>}
          {mode === 'active' ? (
            <Row gap={0}>
              <IconButton icon="trash-outline" color={p.danger} label="Discard workout" onPress={discard} />
              <Button small title="Finish" onPress={() => void finish()} loading={busy} />
            </Row>
          ) : (
            <Button small title="Done" onPress={() => { void store.flush(); router.back(); }} />
          )}
        </Row>
        {saveError ? <View style={{ paddingHorizontal: spacing.lg }}><Banner tone="danger" text={`Could not save to this device: ${saveError}`} action="Retry" onAction={() => void store.flush()} /></View> : null}
        <FlatList
          data={exerciseOrder}
          keyExtractor={(id) => id}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={4}
          windowSize={7}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
              <Field value={workout.title} onChangeText={(t) => store.updateWorkoutMeta({ title: t })} placeholder="Workout name" />
              <AppText variant="caption">Started {formatTimeOfDay(workout.started_at)}{workout.routine_name ? ` · from ${workout.routine_name}` : ''}</AppText>
              <Field value={workout.notes} onChangeText={(t) => store.updateWorkoutMeta({ notes: t })} placeholder="Workout notes (optional)" multiline />
              {mode === 'edit' ? (
                <Row>
                  <Field style={{ flex: 1 }} label="Start (YYYY-MM-DD HH:MM)" value={startText ?? toLocalText(workout.started_at)} onFocus={() => setStartText(toLocalText(workout.started_at))} onChangeText={setStartText} onBlur={() => { const v = startText ? fromLocalText(startText) : null; if (v) store.updateWorkoutMeta({ started_at: v }); setStartText(null); }} />
                  <Field style={{ flex: 1 }} label="End" value={endText ?? (workout.ended_at ? toLocalText(workout.ended_at) : '')} onFocus={() => setEndText(workout.ended_at ? toLocalText(workout.ended_at) : '')} onChangeText={setEndText} onBlur={() => { const v = endText ? fromLocalText(endText) : null; if (v) store.updateWorkoutMeta({ ended_at: v }); setEndText(null); }} />
                </Row>
              ) : null}
            </View>
          }
          renderItem={({ item }) => <ExerciseCard weId={item} label={labels[item] ?? null} onMenu={openMenu} onSetMenu={openSetMenu} mode={mode} />}
          ListFooterComponent={<Button title="Add exercise" icon="add-circle" onPress={addExercises} />}
        />
        {mode === 'active' ? <RestTimerBar /> : null}
      </KeyboardAvoidingView>

      <Sheet visible={!!ex} onClose={() => setExMenu(null)} title={ex?.exercise_name}>
        {ex ? (
          <>
            <SheetItem icon="swap-horizontal" label="Replace exercise" onPress={() => replace(ex.id)} />
            <SheetItem icon="link" label={ex.group_id ? 'Add next exercise to this group' : 'Superset with next exercise'} onPress={() => linkNext(ex.id)} />
            {ex.group_id ? <SheetItem icon="unlink" label="Remove from group" onPress={() => { setExMenu(null); void store.ungroupExercise(ex.id); }} /> : null}
            <SheetItem icon="arrow-up" label="Move up" onPress={() => void store.moveExercise(ex.id, -1)} />
            <SheetItem icon="arrow-down" label="Move down" onPress={() => void store.moveExercise(ex.id, 1)} />
            <SheetItem icon="add" label="Add warm-up set" onPress={() => { setExMenu(null); void store.addSet(ex.id, 'warmup'); }} />
            <SheetItem icon="copy" label="Copy next set from last workout" onPress={() => { setExMenu(null); void store.duplicatePreviousWorkoutSet(ex.id); }} />
            <SheetItem icon="timer" label="Start rest timer now" onPress={() => { setExMenu(null); useRestTimer.getState().start(ex.rest_sec ?? useProfileStore.getState().profile?.default_rest_sec ?? 90, ex.exercise_name); }} />
            <SheetItem icon="hourglass" label={`Rest for this exercise: ${ex.rest_sec ? ex.rest_sec + 's' : 'default'} (tap to change)`} onPress={() => { const opts = [null, 60, 90, 120, 180]; const nxt = opts[(opts.indexOf(ex.rest_sec) + 1) % opts.length] ?? null; store.setExerciseRest(ex.id, nxt); }} />
            <SheetItem icon="trash" danger label="Remove exercise" onPress={() => removeExercise(ex.id)} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!menuSet} onClose={() => setSetMenu(null)} title="Set options">
        {menuSet ? (
          <>
            <AppText variant="label" style={{ marginBottom: spacing.sm }}>Set type</AppText>
            <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }}>
              {SET_TYPES.map((t: SetType) => (
                <Button key={t} small variant={menuSet.set_type === t ? 'primary' : 'secondary'} title={SET_TYPE_LABELS[t]} onPress={() => { store.setSetType(menuSet.id, t); setSetMenu(null); }} />
              ))}
            </Row>
            {exercises[menuSet.workout_exercise_id]?.is_unilateral ? (
              <SheetItem icon="swap-horizontal" label={`Side: ${menuSet.side} (tap to change)`} onPress={() => store.updateSet(menuSet.id, { side: menuSet.side === 'both' ? 'left' : menuSet.side === 'left' ? 'right' : 'both' })} />
            ) : null}
            <SheetItem icon="chatbox-ellipses" label="Set note" onPress={() => { setNoteFor(menuSet.id); setSetMenu(null); }} />
            <SheetItem icon="copy" label="Duplicate set" onPress={() => { setSetMenu(null); void store.duplicateSet(menuSet.id); }} />
            <SheetItem icon="trash" danger label="Delete set" onPress={() => { setSetMenu(null); void store.deleteSet(menuSet.id); }} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!noteFor} onClose={() => setNoteFor(null)} title="Set note">
        {noteFor && sets[noteFor] ? <Field autoFocus value={sets[noteFor]!.note} onChangeText={(t) => store.updateSet(noteFor, { note: t })} placeholder="e.g. Grip slipped, paused reps" multiline /> : null}
        <Button title="Done" onPress={() => setNoteFor(null)} style={{ marginTop: spacing.md }} />
      </Sheet>
    </Screen>
  );
}
