/**
 * Local (SQLite) schema - single source of truth for column lists, JSON/boolean columns
 * and DDL. Repositories and the sync engine both derive their SQL from these definitions,
 * so a column is added in exactly one place. Mirrors supabase/migrations.
 */

export interface TableMeta {
  name: string;
  /** column name -> SQL definition (excluding the shared sync columns) */
  cols: Record<string, string>;
  json?: string[];
  bool?: string[];
  /** Conflict target used for local upserts (defaults to "id"). */
  pk?: string;
}

const SYNC_COLS: Record<string, string> = {
  created_at: 'TEXT NOT NULL',
  updated_at: 'TEXT NOT NULL',
  deleted_at: 'TEXT',
  sync_status: "TEXT NOT NULL DEFAULT 'pending'",
};

const defineTable = (t: TableMeta): TableMeta & { allCols: string[] } => ({
  ...t,
  cols: { ...t.cols, ...SYNC_COLS },
  allCols: [...Object.keys(t.cols), ...Object.keys(SYNC_COLS)],
});

export const profiles = defineTable({
  name: 'profiles',
  cols: {
    id: 'TEXT PRIMARY KEY',
    display_name: "TEXT NOT NULL DEFAULT ''",
    units: "TEXT NOT NULL DEFAULT 'kg'",
    training_level: "TEXT NOT NULL DEFAULT 'beginner'",
    height_cm: 'REAL',
    bodyweight_kg: 'REAL',
    default_rest_sec: 'INTEGER NOT NULL DEFAULT 90',
    theme: "TEXT NOT NULL DEFAULT 'dark'",
    vibration_enabled: 'INTEGER NOT NULL DEFAULT 1',
    show_rpe: 'INTEGER NOT NULL DEFAULT 1',
    show_rir: 'INTEGER NOT NULL DEFAULT 0',
    prefill_mode: "TEXT NOT NULL DEFAULT 'previous_set'",
    auto_rest_timer: 'INTEGER NOT NULL DEFAULT 1',
    bar_weight_kg: 'REAL NOT NULL DEFAULT 20',
    plates_json: "TEXT NOT NULL DEFAULT '[25,20,15,10,5,2.5,1.25]'",
    onboarding_completed: 'INTEGER NOT NULL DEFAULT 0',
  },
  bool: ['vibration_enabled', 'show_rpe', 'show_rir', 'auto_rest_timer', 'onboarding_completed'],
});

export const exercises = defineTable({
  name: 'exercises',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT',
    name: 'TEXT NOT NULL',
    aliases: "TEXT NOT NULL DEFAULT '[]'",
    tracking_mode: "TEXT NOT NULL DEFAULT 'weight_reps'",
    primary_muscle: "TEXT NOT NULL DEFAULT 'other'",
    secondary_muscles: "TEXT NOT NULL DEFAULT '[]'",
    equipment: "TEXT NOT NULL DEFAULT 'other'",
    movement_category: "TEXT NOT NULL DEFAULT ''",
    instructions: "TEXT NOT NULL DEFAULT ''",
    personal_notes: "TEXT NOT NULL DEFAULT ''",
    is_system: 'INTEGER NOT NULL DEFAULT 0',
    is_unilateral: 'INTEGER NOT NULL DEFAULT 0',
    custom_fields: "TEXT NOT NULL DEFAULT '[]'",
  },
  json: ['aliases', 'secondary_muscles', 'custom_fields'],
  bool: ['is_system', 'is_unilateral'],
});

export const favorites = defineTable({
  name: 'favorites',
  // id is the exercise id: one favorite row per exercise.
  cols: { id: 'TEXT PRIMARY KEY', user_id: 'TEXT NOT NULL', exercise_id: 'TEXT NOT NULL' },
});

export const routineFolders = defineTable({
  name: 'routine_folders',
  cols: { id: 'TEXT PRIMARY KEY', user_id: 'TEXT NOT NULL', name: 'TEXT NOT NULL', position: 'INTEGER NOT NULL DEFAULT 0' },
});

export const routines = defineTable({
  name: 'routines',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    folder_id: 'TEXT',
    name: 'TEXT NOT NULL',
    description: "TEXT NOT NULL DEFAULT ''",
    notes: "TEXT NOT NULL DEFAULT ''",
    position: 'INTEGER NOT NULL DEFAULT 0',
    is_archived: 'INTEGER NOT NULL DEFAULT 0',
  },
  bool: ['is_archived'],
});

export const exerciseGroups = defineTable({
  name: 'exercise_groups',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    routine_id: 'TEXT',
    workout_id: 'TEXT',
    group_type: "TEXT NOT NULL DEFAULT 'superset'",
    position: 'INTEGER NOT NULL DEFAULT 0',
  },
});

export const routineExercises = defineTable({
  name: 'routine_exercises',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    routine_id: 'TEXT NOT NULL',
    exercise_id: 'TEXT NOT NULL',
    position: 'INTEGER NOT NULL DEFAULT 0',
    group_id: 'TEXT',
    rest_sec: 'INTEGER',
    notes: "TEXT NOT NULL DEFAULT ''",
  },
});

export const routineSets = defineTable({
  name: 'routine_sets',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    routine_exercise_id: 'TEXT NOT NULL',
    position: 'INTEGER NOT NULL DEFAULT 0',
    set_type: "TEXT NOT NULL DEFAULT 'normal'",
    target_reps_min: 'INTEGER',
    target_reps_max: 'INTEGER',
    target_weight_kg: 'REAL',
    target_duration_sec: 'INTEGER',
    target_distance_m: 'REAL',
    target_rpe: 'REAL',
    target_rir: 'INTEGER',
  },
});

export const workouts = defineTable({
  name: 'workouts',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    routine_id: 'TEXT',
    routine_name: 'TEXT',
    title: "TEXT NOT NULL DEFAULT ''",
    status: "TEXT NOT NULL DEFAULT 'active'",
    started_at: 'TEXT NOT NULL',
    ended_at: 'TEXT',
    bodyweight_kg: 'REAL',
    notes: "TEXT NOT NULL DEFAULT ''",
    location: "TEXT NOT NULL DEFAULT ''",
    rating: 'INTEGER',
    energy: 'INTEGER',
  },
});

export const workoutExercises = defineTable({
  name: 'workout_exercises',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    workout_id: 'TEXT NOT NULL',
    exercise_id: 'TEXT NOT NULL',
    exercise_name: 'TEXT NOT NULL',
    primary_muscle: "TEXT NOT NULL DEFAULT 'other'",
    tracking_mode: "TEXT NOT NULL DEFAULT 'weight_reps'",
    is_unilateral: 'INTEGER NOT NULL DEFAULT 0',
    custom_fields: "TEXT NOT NULL DEFAULT '[]'",
    position: 'INTEGER NOT NULL DEFAULT 0',
    group_id: 'TEXT',
    rest_sec: 'INTEGER',
    notes: "TEXT NOT NULL DEFAULT ''",
    replaced_from_exercise_id: 'TEXT',
  },
  json: ['custom_fields'],
  bool: ['is_unilateral'],
});

export const workoutSets = defineTable({
  name: 'workout_sets',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    workout_id: 'TEXT NOT NULL',
    workout_exercise_id: 'TEXT NOT NULL',
    position: 'INTEGER NOT NULL DEFAULT 0',
    set_type: "TEXT NOT NULL DEFAULT 'normal'",
    weight_kg: 'REAL',
    added_weight_kg: 'REAL',
    assistance_kg: 'REAL',
    reps: 'INTEGER',
    duration_sec: 'INTEGER',
    distance_m: 'REAL',
    rpe: 'REAL',
    rir: 'INTEGER',
    side: "TEXT NOT NULL DEFAULT 'both'",
    is_completed: 'INTEGER NOT NULL DEFAULT 0',
    completed_at: 'TEXT',
    note: "TEXT NOT NULL DEFAULT ''",
    rest_sec: 'INTEGER',
    plan_reps_min: 'INTEGER',
    plan_reps_max: 'INTEGER',
    plan_weight_kg: 'REAL',
    plan_duration_sec: 'INTEGER',
    plan_distance_m: 'REAL',
  },
  bool: ['is_completed'],
});

export const bodyweightEntries = defineTable({
  name: 'bodyweight_entries',
  cols: {
    id: 'TEXT PRIMARY KEY',
    user_id: 'TEXT NOT NULL',
    entry_date: 'TEXT NOT NULL',
    weight_kg: 'REAL NOT NULL',
    note: "TEXT NOT NULL DEFAULT ''",
  },
});

export type Table = ReturnType<typeof defineTable>;

/** Ordered so parents come before children (also the cloud push order). */
export const ALL_TABLES: Table[] = [
  profiles,
  exercises,
  favorites,
  routineFolders,
  routines,
  exerciseGroups,
  routineExercises,
  routineSets,
  workouts,
  workoutExercises,
  workoutSets,
  bodyweightEntries,
];

export function createTableSql(t: Table): string {
  const defs = Object.entries(t.cols).map(([c, d]) => `${c} ${d}`);
  return `CREATE TABLE IF NOT EXISTS ${t.name} (${defs.join(', ')});`;
}

export const INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_workouts_status_started ON workouts(status, started_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_workouts_sync ON workouts(sync_status)',
  'CREATE INDEX IF NOT EXISTS idx_we_workout ON workout_exercises(workout_id, position)',
  'CREATE INDEX IF NOT EXISTS idx_we_exercise ON workout_exercises(exercise_id)',
  'CREATE INDEX IF NOT EXISTS idx_ws_we ON workout_sets(workout_exercise_id, position)',
  'CREATE INDEX IF NOT EXISTS idx_ws_workout ON workout_sets(workout_id)',
  'CREATE INDEX IF NOT EXISTS idx_re_routine ON routine_exercises(routine_id, position)',
  'CREATE INDEX IF NOT EXISTS idx_rs_re ON routine_sets(routine_exercise_id, position)',
  'CREATE INDEX IF NOT EXISTS idx_groups_workout ON exercise_groups(workout_id)',
  'CREATE INDEX IF NOT EXISTS idx_groups_routine ON exercise_groups(routine_id)',
  'CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises(name)',
  'CREATE INDEX IF NOT EXISTS idx_bw_date ON bodyweight_entries(entry_date)',
];

/** Row <-> object conversion ------------------------------------------------------------ */

export type Row = Record<string, unknown>;

export function toParams(t: Table, obj: Record<string, unknown>): (string | number | null)[] {
  return t.allCols.map((c) => {
    const v = obj[c];
    if (v === undefined || v === null) return null;
    if (t.json?.includes(c)) return JSON.stringify(v);
    if (t.bool?.includes(c)) return v ? 1 : 0;
    return v as string | number;
  });
}

export function fromRow<T>(t: Table, row: Row): T {
  const out: Row = { ...row };
  for (const c of t.json ?? []) {
    const v = row[c];
    out[c] = typeof v === 'string' ? safeParse(v) : [];
  }
  for (const c of t.bool ?? []) out[c] = row[c] === 1 || row[c] === true;
  return out as T;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}

export function upsertSql(t: Table): string {
  const pk = t.pk ?? 'id';
  const cols = t.allCols;
  const updates = cols.filter((c) => c !== pk).map((c) => `${c}=excluded.${c}`);
  return `INSERT INTO ${t.name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')}) ON CONFLICT(${pk}) DO UPDATE SET ${updates.join(',')}`;
}
