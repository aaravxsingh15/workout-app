// Core domain types for IronLog. All weights are stored in KG, distances in METERS,
// durations in SECONDS. Conversion to user units happens only at the UI boundary.

export type Unit = 'kg' | 'lb';
export type ThemePreference = 'dark' | 'light' | 'system';
export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';
export type PrefillMode = 'previous_set' | 'previous_workout' | 'none';

export const TRACKING_MODES = [
  'weight_reps',
  'bodyweight_reps',
  'assisted_bodyweight',
  'duration',
  'distance_duration',
  'distance_weight',
  'reps_only',
  'time_weight',
  'custom',
] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/** Atomic measurable fields of a set. Tracking modes are just lists of these. */
export const FIELD_KEYS = ['weight', 'added_weight', 'assistance', 'reps', 'duration', 'distance'] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const SET_TYPES = ['warmup', 'normal', 'drop', 'failure', 'backoff', 'top', 'amrap', 'other'] as const;
export type SetType = (typeof SET_TYPES)[number];

export type SetSide = 'both' | 'left' | 'right';

export const MUSCLE_GROUPS = [
  'chest', 'upper_back', 'lats', 'lower_back', 'traps', 'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'quadriceps', 'hamstrings', 'glutes', 'calves',
  'adductors', 'abductors', 'full_body', 'cardio', 'other',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'machine', 'smith_machine', 'bodyweight', 'kettlebell', 'ez_bar',
  'resistance_band', 'plate', 'trap_bar', 'bench', 'cardio_machine', 'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export type GroupType = 'superset' | 'triset' | 'circuit';
export type SyncStatus = 'pending' | 'synced';
export type WorkoutStatus = 'active' | 'completed';

export interface SyncFields {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: SyncStatus;
}

export interface Profile extends SyncFields {
  id: string;
  display_name: string;
  units: Unit;
  training_level: TrainingLevel;
  height_cm: number | null;
  bodyweight_kg: number | null;
  default_rest_sec: number;
  theme: ThemePreference;
  vibration_enabled: boolean;
  show_rpe: boolean;
  show_rir: boolean;
  prefill_mode: PrefillMode;
  auto_rest_timer: boolean;
  bar_weight_kg: number;
  plates_json: string; // JSON array of plate weights in kg
  onboarding_completed: boolean;
}

export interface Exercise extends SyncFields {
  id: string;
  user_id: string | null;
  name: string;
  aliases: string[];
  tracking_mode: TrackingMode;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: Equipment;
  movement_category: string;
  instructions: string;
  personal_notes: string;
  is_system: boolean;
  is_unilateral: boolean;
  custom_fields: FieldKey[];
}

export interface RoutineFolder extends SyncFields {
  id: string;
  user_id: string;
  name: string;
  position: number;
}

export interface Routine extends SyncFields {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  description: string;
  notes: string;
  position: number;
  is_archived: boolean;
}

export interface ExerciseGroup extends SyncFields {
  id: string;
  user_id: string;
  routine_id: string | null;
  workout_id: string | null;
  group_type: GroupType;
  position: number;
}

export interface RoutineExercise extends SyncFields {
  id: string;
  user_id: string;
  routine_id: string;
  exercise_id: string;
  position: number;
  group_id: string | null;
  rest_sec: number | null;
  notes: string;
}

export interface RoutineSet extends SyncFields {
  id: string;
  user_id: string;
  routine_exercise_id: string;
  position: number;
  set_type: SetType;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  target_duration_sec: number | null;
  target_distance_m: number | null;
  target_rpe: number | null;
  target_rir: number | null;
}

export interface Workout extends SyncFields {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string | null;
  title: string;
  status: WorkoutStatus;
  started_at: string;
  ended_at: string | null;
  bodyweight_kg: number | null;
  notes: string;
  location: string;
  rating: number | null;
  energy: number | null;
}

export interface WorkoutExercise extends SyncFields {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_id: string;
  exercise_name: string; // snapshot
  primary_muscle: MuscleGroup; // snapshot
  tracking_mode: TrackingMode; // snapshot
  is_unilateral: boolean; // snapshot
  custom_fields: FieldKey[]; // snapshot
  position: number;
  group_id: string | null;
  rest_sec: number | null;
  notes: string;
  replaced_from_exercise_id: string | null;
}

export interface WorkoutSet extends SyncFields {
  id: string;
  user_id: string;
  workout_id: string;
  workout_exercise_id: string;
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  added_weight_kg: number | null;
  assistance_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  rpe: number | null;
  rir: number | null;
  side: SetSide;
  is_completed: boolean;
  completed_at: string | null;
  note: string;
  rest_sec: number | null;
  plan_reps_min: number | null;
  plan_reps_max: number | null;
  plan_weight_kg: number | null;
  plan_duration_sec: number | null;
  plan_distance_m: number | null;
}

export interface BodyweightEntry extends SyncFields {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  weight_kg: number;
  note: string;
}

/** A set as seen by calculations: only measurable data plus context. */
export interface CalcSet {
  set_type: SetType;
  weight_kg: number | null;
  added_weight_kg: number | null;
  assistance_kg: number | null;
  reps: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  is_completed: boolean;
}
