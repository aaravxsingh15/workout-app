import React, { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText, Badge, Button, Card, Field, IconButton, Loading, Row, Screen, Sheet, SheetItem } from '@/components/ui';
import { NumField } from '@/features/workout/components';
import { spacing, usePalette } from '@/theme';
import { useUnit } from '@/stores/profileStore';
import { usePickerStore } from '@/stores/pickerStore';
import { getRoutineTree, saveRoutineTree } from '@/database/repositories/routineRepo';
import type { RoutineTree } from '@/calculations/clone';
import { getFields } from '@/calculations/tracking';
import { newId, nowIso } from '@/utils/id';
import { getUserId } from '@/database/db';
import { SET_TYPES, type Exercise, type ExerciseGroup, type RoutineExercise, type RoutineSet, type SetType } from '@/types/domain';
import { SET_TYPE_BADGE, SET_TYPE_LABELS } from '@/types/labels';
import { friendlyError } from '@/utils/errors';

type Item = RoutineTree['exercises'][number];
const base = () => ({ created_at: nowIso(), updated_at: nowIso(), deleted_at: null, sync_status: 'pending' as const });

const newSet = (reId: string, position: number, type: SetType = 'normal', from?: RoutineSet): RoutineSet => ({
  id: newId(), user_id: getUserId(), routine_exercise_id: reId, position, set_type: type,
  target_reps_min: from?.target_reps_min ?? 8, target_reps_max: from?.target_reps_max ?? 12, target_weight_kg: from?.target_weight_kg ?? null,
  target_duration_sec: from?.target_duration_sec ?? null, target_distance_m: from?.target_distance_m ?? null, target_rpe: null, target_rir: null, ...base(),
});

export default function RoutineEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = usePalette();
  const unit = useUnit();
  const [tree, setTree] = useState<RoutineTree | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ExerciseGroup[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [menu, setExMenu] = useState<number | null>(null);
  const [setMenuState, setSetMenu] = useState<{ i: number; j: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getRoutineTree(id).then((t) => {
      if (!t) return;
      setTree(t);
      setItems(t.exercises);
      setGroups(t.groups);
      setName(t.routine.name);
      setDescription(t.routine.description);
      setNotes(t.routine.notes);
    });
  }, [id]);

  if (!tree) return <Loading />;

  const patchItem = (i: number, fn: (it: Item) => Item) => setItems((xs) => xs.map((x, k) => (k === i ? fn(x) : x)));
  const patchSet = (i: number, j: number, patch: Partial<RoutineSet>) => patchItem(i, (it) => ({ ...it, sets: it.sets.map((s, k) => (k === j ? { ...s, ...patch } : s)) }));

  const addExercises = () => {
    usePickerStore.getState().open({
      title: 'Add to routine',
      multi: true,
      onPick: (exs: Exercise[]) => {
        setItems((xs) => [
          ...xs,
          ...exs.map((exercise, k) => {
            const re: RoutineExercise = { id: newId(), user_id: getUserId(), routine_id: id, exercise_id: exercise.id, position: xs.length + k, group_id: null, rest_sec: null, notes: '', ...base() };
            return { re, exercise, sets: [newSet(re.id, 0), newSet(re.id, 1), newSet(re.id, 2)] };
          }),
        ]);
      },
    });
    router.push('/exercise-picker');
  };

  const move = (i: number, d: -1 | 1) => {
    setExMenu(null);
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const c = [...xs];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  };

  const link = (i: number) => {
    setExMenu(null);
    const next = items[i + 1];
    if (!next) return Alert.alert('Nothing to link', 'Add another exercise below this one first.');
    const gid = items[i]!.re.group_id ?? newId();
    if (!items[i]!.re.group_id) setGroups((g) => [...g, { id: gid, user_id: getUserId(), routine_id: id, workout_id: null, group_type: 'superset', position: g.length, ...base() }]);
    setItems((xs) => xs.map((x, k) => (k === i || k === i + 1 ? { ...x, re: { ...x.re, group_id: gid } } : x)));
  };

  const save = async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Give the routine a name.');
    if (saving) return;
    setSaving(true);
    try {
      const counts = new Map<string, number>();
      items.forEach((x) => x.re.group_id && counts.set(x.re.group_id, (counts.get(x.re.group_id) ?? 0) + 1));
      const usedGroups = groups.filter((g) => (counts.get(g.id) ?? 0) >= 2).map((g) => ({ ...g, group_type: ((counts.get(g.id) ?? 2) > 3 ? 'circuit' : counts.get(g.id) === 3 ? 'triset' : 'superset') as ExerciseGroup['group_type'] }));
      await saveRoutineTree({
        routine: { ...tree.routine, name: name.trim(), description, notes },
        groups: usedGroups,
        exercises: items.map((x) => ({ re: { ...x.re, group_id: x.re.group_id && (counts.get(x.re.group_id) ?? 0) >= 2 ? x.re.group_id : null }, sets: x.sets })),
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save routine', friendlyError(e));
      setSaving(false);
    }
  };

  const groupLetters = new Map<string, string>();
  const cur = menu !== null ? items[menu] : null;
  const curSet = setMenuState ? items[setMenuState.i]?.sets[setMenuState.j] : null;

  return (
    <Screen scroll>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconButton icon="close" label="Cancel" onPress={() => router.back()} />
        <Button small title="Save" onPress={() => void save()} loading={saving} />
      </Row>
      <Field label="Routine name" value={name} onChangeText={setName} placeholder="e.g. Push Day" />
      <Field style={{ marginTop: spacing.md }} label="Description" value={description} onChangeText={setDescription} placeholder="Optional" />
      <Field style={{ marginTop: spacing.md }} label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional" />

      {items.length === 0 ? <AppText variant="muted" style={{ textAlign: 'center', marginVertical: spacing.xl }}>No exercises yet. Add some to make starting workouts faster.</AppText> : null}
      {items.map((it, i) => {
        const gid = it.re.group_id;
        if (gid && !groupLetters.has(gid)) groupLetters.set(gid, String.fromCharCode(65 + groupLetters.size));
        const fields = getFields(it.exercise.tracking_mode, it.exercise.custom_fields);
        return (
          <Card key={it.re.id} style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row style={{ flex: 1 }}>
                {gid ? <Badge label={groupLetters.get(gid)!} filled /> : null}
                <AppText variant="title" style={{ fontSize: 17, flexShrink: 1 }}>{it.exercise.name}</AppText>
              </Row>
              <IconButton icon="ellipsis-horizontal" label="Exercise options" onPress={() => setExMenu(i)} />
            </Row>
            <Field value={it.re.notes} onChangeText={(t) => patchItem(i, (x) => ({ ...x, re: { ...x.re, notes: t } }))} placeholder="Exercise note" />
            <AppText variant="caption">Rest: {it.re.rest_sec ? `${it.re.rest_sec}s` : 'default'}</AppText>
            {it.sets.map((s, j) => (
              <Row key={s.id} gap={0}>
                <Pressable onPress={() => setSetMenu({ i, j })} style={{ width: 40 }}><AppText style={{ fontWeight: "900", color: s.set_type === "warmup" ? p.warmup : p.textMuted }}>{SET_TYPE_BADGE[s.set_type] || j + 1}</AppText></Pressable>
                {fields.includes('weight') || fields.includes('added_weight') || fields.includes('assistance') ? (
                  <NumField field="weight" unit={unit} value={s.target_weight_kg} onCommit={(v) => patchSet(i, j, { target_weight_kg: v })} />
                ) : null}
                {fields.includes('reps') ? (
                  <>
                    <NumField field="reps" unit={unit} value={s.target_reps_min} onCommit={(v) => patchSet(i, j, { target_reps_min: v })} />
                    <AppText>–</AppText>
                    <NumField field="reps" unit={unit} value={s.target_reps_max} onCommit={(v) => patchSet(i, j, { target_reps_max: v })} />
                  </>
                ) : null}
                {fields.includes('duration') ? <NumField field="duration" unit={unit} value={s.target_duration_sec} onCommit={(v) => patchSet(i, j, { target_duration_sec: v })} /> : null}
                {fields.includes('distance') ? <NumField field="distance" unit={unit} value={s.target_distance_m} onCommit={(v) => patchSet(i, j, { target_distance_m: v })} /> : null}
              </Row>
            ))}
            <Button small variant="secondary" icon="add" title="Add set" onPress={() => patchItem(i, (x) => ({ ...x, sets: [...x.sets, newSet(x.re.id, x.sets.length, 'normal', x.sets[x.sets.length - 1])] }))} />
          </Card>
        );
      })}
      <View style={{ marginTop: spacing.lg }}><Button title="Add exercise" icon="add-circle" onPress={addExercises} /></View>

      <Sheet visible={!!cur} onClose={() => setExMenu(null)} title={cur?.exercise.name}>
        {cur && menu !== null ? (
          <>
            <SheetItem icon="arrow-up" label="Move up" onPress={() => move(menu, -1)} />
            <SheetItem icon="arrow-down" label="Move down" onPress={() => move(menu, 1)} />
            <SheetItem icon="link" label="Superset with next exercise" onPress={() => link(menu)} />
            {cur.re.group_id ? <SheetItem icon="unlink" label="Remove from group" onPress={() => { patchItem(menu, (x) => ({ ...x, re: { ...x.re, group_id: null } })); setExMenu(null); }} /> : null}
            <SheetItem icon="hourglass" label="Cycle rest: default / 60 / 90 / 120 / 180 s" onPress={() => { const o = [null, 60, 90, 120, 180]; patchItem(menu, (x) => ({ ...x, re: { ...x.re, rest_sec: o[(o.indexOf(x.re.rest_sec) + 1) % o.length] ?? null } })); }} />
            <SheetItem icon="trash" danger label="Remove from routine" onPress={() => { setItems((xs) => xs.filter((_, k) => k !== menu)); setExMenu(null); }} />
          </>
        ) : null}
      </Sheet>
      <Sheet visible={!!curSet} onClose={() => setSetMenu(null)} title="Set">
        {setMenuState && curSet ? (
          <>
            <Row style={{ flexWrap: 'wrap', marginBottom: spacing.md }}>
              {SET_TYPES.map((t) => <Button key={t} small variant={curSet.set_type === t ? 'primary' : 'secondary'} title={SET_TYPE_LABELS[t]} onPress={() => { patchSet(setMenuState.i, setMenuState.j, { set_type: t }); setSetMenu(null); }} />)}
            </Row>
            <SheetItem icon="trash" danger label="Delete set" onPress={() => { patchItem(setMenuState.i, (x) => ({ ...x, sets: x.sets.filter((_, k) => k !== setMenuState.j) })); setSetMenu(null); }} />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
