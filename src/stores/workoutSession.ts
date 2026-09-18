import { create } from 'zustand';
import type { Exercise, ExerciseGroup, Workout, WorkoutExercise, WorkoutSet, SetType, FieldKey } from '@/types/domain';
import { blankWorkoutSet } from '@/calculations/clone';
import { getFields , FIELD_COLUMN } from '@/calculations/tracking';
import { initialValuesForNewSet, placeholderValues, previousSetAt } from '@/calculations/prefill';
import * as repo from '@/database/repositories/workoutRepo';
import { notifyDataChanged } from '@/database/repositories/common';
import { newId, nowIso } from '@/utils/id';
import { useProfileStore } from './profileStore';
import { getUserId } from '@/database/db';

/**
 * In-memory mirror of ONE workout (the active one, or a past one being edited) with
 * write-through persistence to SQLite. Data is normalized (records keyed by id) so a single
 * set edit re-renders only that set row.
 *
 * Durability model:
 *  - structural changes (add/remove/reorder/complete) are written immediately
 *  - free-typing (weight/reps/notes) is coalesced for ~250ms, and flushed on blur, on
 *    completion, when the app goes to background, and before finishing
 *  - failed writes stay queued and surface `saveError` so nothing is silently lost
 */

export type SessionMode = 'active' | 'edit';

interface SessionState {
  workoutId: string | null;
  mode: SessionMode | null;
  workout: Workout | null;
  exerciseOrder: string[];
  exercises: Record<string, WorkoutExercise>;
  setOrder: Record<string, string[]>;
  sets: Record<string, WorkoutSet>;
  groups: Record<string, ExerciseGroup>;
  previous: Record<string, repo.PreviousPerformance | null>; // keyed by library exercise id
  loading: boolean;
  loadError: string | null;
  saveError: string | null;

  load: (workoutId: string, mode: SessionMode) => Promise<void>;
  reload: () => Promise<void>;
  close: () => void;

  updateWorkoutMeta: (patch: Partial<Workout>) => void;
  addExercise: (exercise: Exercise, restSec?: number | null) => Promise<string>;
  removeExercise: (weId: string) => Promise<void>;
  replaceExercise: (weId: string, exercise: Exercise) => Promise<void>;
  moveExercise: (weId: string, dir: -1 | 1) => Promise<void>;
  setExerciseNotes: (weId: string, notes: string) => void;
  setExerciseRest: (weId: string, restSec: number | null) => void;
  groupExercises: (weIds: string[]) => Promise<void>;
  ungroupExercise: (weId: string) => Promise<void>;

  addSet: (weId: string, type?: SetType) => Promise<string | null>;
  duplicateSet: (setId: string) => Promise<void>;
  duplicatePreviousWorkoutSet: (weId: string) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  updateSet: (setId: string, patch: Partial<WorkoutSet>) => void;
  setSetType: (setId: string, type: SetType) => void;
  /** Returns true if the set is now completed. Blank fields take their placeholder values. */
  toggleComplete: (setId: string) => boolean;

  flush: () => Promise<void>;
  finish: (endedAt?: string) => Promise<void>;
  discard: () => Promise<void>;
}

const dirtySets = new Set<string>();
const dirtyExercises = new Set<string>();
let dirtyWorkout = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<void> = Promise.resolve();

export const useWorkoutSession = create<SessionState>((set, get) => {
  const schedule = (immediate = false) => {
    if (timer) clearTimeout(timer);
    if (immediate) {
      void get().flush();
      return;
    }
    timer = setTimeout(() => void get().flush(), 250);
  };

  const applyTree = (tree: Awaited<ReturnType<typeof repo.getWorkoutTree>>) => {
    if (!tree) return;
    const exercises: Record<string, WorkoutExercise> = {};
    const setOrder: Record<string, string[]> = {};
    const sets: Record<string, WorkoutSet> = {};
    const groups: Record<string, ExerciseGroup> = {};
    for (const g of tree.groups) groups[g.id] = g;
    for (const { we, sets: ss } of tree.exercises) {
      exercises[we.id] = we;
      setOrder[we.id] = ss.map((s) => s.id);
      for (const s of ss) sets[s.id] = s;
    }
    set({ workout: tree.workout, exerciseOrder: tree.exercises.map((e) => e.we.id), exercises, setOrder, sets, groups });
  };

  const loadPrevious = async (exerciseId: string) => {
    const w = get().workout;
    if (!w) return;
    try {
      const prev = await repo.getPreviousPerformance(exerciseId, w.started_at, w.id);
      set((s) => ({ previous: { ...s.previous, [exerciseId]: prev } }));
    } catch {
      set((s) => ({ previous: { ...s.previous, [exerciseId]: null } }));
    }
  };

  const persistSoon = () => {
    const w = get().workout;
    if (w && get().mode === 'edit') notifyDataChanged();
  };

  const prefillMode = () => useProfileStore.getState().profile?.prefill_mode ?? 'previous_set';

  return {
    workoutId: null,
    mode: null,
    workout: null,
    exerciseOrder: [],
    exercises: {},
    setOrder: {},
    sets: {},
    groups: {},
    previous: {},
    loading: false,
    loadError: null,
    saveError: null,

    load: async (workoutId, mode) => {
      if (get().workoutId === workoutId && get().mode === mode && get().workout) return;
      await get().flush();
      set({ workoutId, mode, loading: true, loadError: null, previous: {}, workout: null });
      try {
        const tree = await repo.getWorkoutTree(workoutId);
        if (!tree) throw new Error('Workout not found.');
        applyTree(tree);
        set({ loading: false });
        await Promise.all([...new Set(tree.exercises.map((e) => e.we.exercise_id))].map(loadPrevious));
      } catch (e) {
        set({ loading: false, loadError: e instanceof Error ? e.message : 'Could not open workout.' });
      }
    },

    reload: async () => {
      const id = get().workoutId;
      if (!id) return;
      await get().flush();
      const tree = await repo.getWorkoutTree(id);
      applyTree(tree);
      await Promise.all([...new Set((tree?.exercises ?? []).map((e) => e.we.exercise_id))].map(loadPrevious));
    },

    close: () => {
      set({ workoutId: null, mode: null, workout: null, exerciseOrder: [], exercises: {}, setOrder: {}, sets: {}, groups: {}, previous: {}, saveError: null });
    },

    updateWorkoutMeta: (patch) => {
      const w = get().workout;
      if (!w) return;
      set({ workout: { ...w, ...patch } });
      dirtyWorkout = true;
      schedule();
    },

    addExercise: async (exercise, restSec = null) => {
      const workoutId = get().workoutId;
      if (!workoutId) throw new Error('No workout open.');
      await get().flush();
      const { we, sets } = await repo.addWorkoutExercise(workoutId, exercise, { restSec });
      set((s) => ({
        exerciseOrder: [...s.exerciseOrder, we.id],
        exercises: { ...s.exercises, [we.id]: we },
        setOrder: { ...s.setOrder, [we.id]: sets.map((x) => x.id) },
        sets: { ...s.sets, ...Object.fromEntries(sets.map((x) => [x.id, x])) },
      }));
      if (!(exercise.id in get().previous)) await loadPrevious(exercise.id);
      persistSoon();
      return we.id;
    },

    removeExercise: async (weId) => {
      await get().flush();
      await repo.removeWorkoutExercise(weId);
      await get().reload();
      persistSoon();
    },

    replaceExercise: async (weId, exercise) => {
      await get().flush();
      await repo.replaceWorkoutExercise(weId, exercise);
      await get().reload();
      persistSoon();
    },

    moveExercise: async (weId, dir) => {
      const order = [...get().exerciseOrder];
      const i = order.indexOf(weId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j]!, order[i]!];
      set({ exerciseOrder: order });
      await repo.reorderWorkoutExercises(order);
      persistSoon();
    },

    setExerciseNotes: (weId, notes) => {
      const we = get().exercises[weId];
      if (!we) return;
      set((s) => ({ exercises: { ...s.exercises, [weId]: { ...we, notes } } }));
      dirtyExercises.add(weId);
      schedule();
    },

    setExerciseRest: (weId, restSec) => {
      const we = get().exercises[weId];
      if (!we) return;
      set((s) => ({ exercises: { ...s.exercises, [weId]: { ...we, rest_sec: restSec } } }));
      dirtyExercises.add(weId);
      schedule();
    },

    groupExercises: async (weIds) => {
      const workoutId = get().workoutId;
      if (!workoutId) return;
      await get().flush();
      // Keep members adjacent: pull them to the position of the first selected exercise.
      const order = get().exerciseOrder;
      const members = order.filter((id) => weIds.includes(id));
      const firstIdx = order.indexOf(members[0]!);
      const rest = order.filter((id) => !weIds.includes(id));
      const newOrder = [...rest.slice(0, firstIdx), ...members, ...rest.slice(firstIdx)];
      await repo.reorderWorkoutExercises(newOrder);
      await repo.groupWorkoutExercises(workoutId, members);
      await get().reload();
      persistSoon();
    },

    ungroupExercise: async (weId) => {
      await get().flush();
      await repo.ungroupWorkoutExercise(weId);
      await get().reload();
      persistSoon();
    },

    addSet: async (weId, type = 'normal') => {
      const s = get();
      const workoutId = s.workoutId;
      const we = s.exercises[weId];
      if (!workoutId || !we) return null;
      const ids = s.setOrder[weId] ?? [];
      const earlier = ids.map((id) => s.sets[id]!).filter(Boolean);
      const fields = getFields(we.tracking_mode, we.custom_fields);
      const prev = s.previous[we.exercise_id]?.sets ?? [];
      const values = initialValuesForNewSet(fields, prefillMode(), prev, ids.length, earlier.filter((x) => x.set_type !== 'warmup' || type === 'warmup'));
      const newSet = blankWorkoutSet({ userId: getUserId(), now: nowIso(), newId }, workoutId, weId, ids.length, { set_type: type, ...values });
      set((st) => ({ sets: { ...st.sets, [newSet.id]: newSet }, setOrder: { ...st.setOrder, [weId]: [...ids, newSet.id] } }));
      await repo.insertSet(newSet);
      persistSoon();
      return newSet.id;
    },

    duplicateSet: async (setId) => {
      const s = get();
      const src = s.sets[setId];
      if (!src || !s.workoutId) return;
      const ids = s.setOrder[src.workout_exercise_id] ?? [];
      const at = ids.indexOf(setId) + 1;
      const copy: WorkoutSet = {
        ...src, id: newId(), position: at, is_completed: false, completed_at: null, rpe: null, rir: null, note: '',
        created_at: nowIso(), updated_at: nowIso(), sync_status: 'pending',
      };
      const nextIds = [...ids.slice(0, at), copy.id, ...ids.slice(at)];
      set((st) => ({ sets: { ...st.sets, [copy.id]: copy }, setOrder: { ...st.setOrder, [src.workout_exercise_id]: nextIds } }));
      await repo.insertSet(copy);
      await repo.reorderSets(nextIds);
      persistSoon();
    },

    duplicatePreviousWorkoutSet: async (weId) => {
      const s = get();
      const we = s.exercises[weId];
      if (!we || !s.workoutId) return;
      const ids = s.setOrder[weId] ?? [];
      const prev = s.previous[we.exercise_id]?.sets ?? [];
      const src = previousSetAt(prev, ids.length);
      if (!src) return;
      const newSet = blankWorkoutSet({ userId: getUserId(), now: nowIso(), newId }, s.workoutId, weId, ids.length, {
        set_type: src.set_type, side: src.side, weight_kg: src.weight_kg, added_weight_kg: src.added_weight_kg,
        assistance_kg: src.assistance_kg, reps: src.reps, duration_sec: src.duration_sec, distance_m: src.distance_m,
      });
      set((st) => ({ sets: { ...st.sets, [newSet.id]: newSet }, setOrder: { ...st.setOrder, [weId]: [...ids, newSet.id] } }));
      await repo.insertSet(newSet);
      persistSoon();
    },

    deleteSet: async (setId) => {
      const s = get();
      const target = s.sets[setId];
      if (!target) return;
      dirtySets.delete(setId);
      const weId = target.workout_exercise_id;
      const ids = (s.setOrder[weId] ?? []).filter((id) => id !== setId);
      const { [setId]: _removed, ...rest } = s.sets;
      set({ sets: rest, setOrder: { ...s.setOrder, [weId]: ids } });
      await repo.deleteSet(setId);
      await repo.reorderSets(ids);
      persistSoon();
    },

    updateSet: (setId, patch) => {
      const cur = get().sets[setId];
      if (!cur) return;
      set((s) => ({ sets: { ...s.sets, [setId]: { ...cur, ...patch } } }));
      dirtySets.add(setId);
      schedule();
    },

    setSetType: (setId, type) => {
      get().updateSet(setId, { set_type: type });
      schedule(true);
    },

    toggleComplete: (setId) => {
      const s = get();
      const cur = s.sets[setId];
      if (!cur) return false;
      const we = s.exercises[cur.workout_exercise_id];
      if (cur.is_completed) {
        get().updateSet(setId, { is_completed: false, completed_at: null });
        schedule(true);
        return false;
      }
      const patch: Partial<WorkoutSet> = { is_completed: true, completed_at: nowIso() };
      if (we) {
        const ids = s.setOrder[we.id] ?? [];
        const idx = ids.indexOf(setId);
        const fields: FieldKey[] = getFields(we.tracking_mode, we.custom_fields);
        const ph = placeholderValues(cur, fields, {
          mode: prefillMode(),
          previousSets: s.previous[we.exercise_id]?.sets ?? [],
          index: idx,
          earlier: ids.slice(0, idx).map((id) => s.sets[id]!).filter(Boolean),
        });
        for (const f of fields) {
          const col = FIELD_COLUMN[f];
          if ((cur[col as keyof WorkoutSet] === null || cur[col as keyof WorkoutSet] === undefined) && ph[f] !== undefined) {
            (patch as Record<string, unknown>)[col] = ph[f];
          }
        }
      }
      get().updateSet(setId, patch);
      schedule(true);
      return true;
    },

    flush: async () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const sIds = [...dirtySets];
      const eIds = [...dirtyExercises];
      const w = dirtyWorkout;
      if (sIds.length === 0 && eIds.length === 0 && !w) return chain;
      dirtySets.clear();
      dirtyExercises.clear();
      dirtyWorkout = false;
      chain = chain.then(async () => {
        try {
          const st = get();
          for (const id of sIds) {
            const row = st.sets[id];
            if (row) await repo.persistSet(row);
          }
          for (const id of eIds) {
            const row = st.exercises[id];
            if (row) await repo.updateWorkoutExercise(id, { notes: row.notes, rest_sec: row.rest_sec });
          }
          if (w && st.workout) {
            const { title, notes, started_at, ended_at, bodyweight_kg, location, rating, energy } = st.workout;
            await repo.updateWorkout(st.workout.id, { title, notes, started_at, ended_at, bodyweight_kg, location, rating, energy });
          }
          if (get().saveError) set({ saveError: null });
          if (get().mode === 'edit') notifyDataChanged();
        } catch (e) {
          // Keep the data queued and tell the user - never drop it.
          sIds.forEach((id) => dirtySets.add(id));
          eIds.forEach((id) => dirtyExercises.add(id));
          if (w) dirtyWorkout = true;
          set({ saveError: e instanceof Error ? e.message : 'Could not save to this device.' });
        }
      });
      return chain;
    },

    finish: async (endedAt) => {
      const id = get().workoutId;
      if (!id) return;
      await get().flush();
      if (get().saveError) throw new Error(get().saveError!);
      await repo.finishWorkout(id, endedAt ?? nowIso());
    },

    discard: async () => {
      const id = get().workoutId;
      if (!id) return;
      dirtySets.clear();
      dirtyExercises.clear();
      dirtyWorkout = false;
      await chain;
      await repo.discardActiveWorkout(id);
      get().close();
    },
  };
});

export const selectExerciseSetIds = (weId: string) => (s: SessionState) => s.setOrder[weId];
