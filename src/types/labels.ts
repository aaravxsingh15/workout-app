import type { Equipment, FieldKey, MuscleGroup, SetType, TrackingMode } from './domain';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', upper_back: 'Upper Back', lats: 'Lats', lower_back: 'Lower Back', traps: 'Traps',
  front_delts: 'Front Delts', side_delts: 'Side Delts', rear_delts: 'Rear Delts', biceps: 'Biceps',
  triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs', obliques: 'Obliques', quadriceps: 'Quadriceps',
  hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', adductors: 'Adductors',
  abductors: 'Abductors', full_body: 'Full Body', cardio: 'Cardio', other: 'Other',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', smith_machine: 'Smith Machine',
  bodyweight: 'Bodyweight', kettlebell: 'Kettlebell', ez_bar: 'EZ Bar', resistance_band: 'Resistance Band',
  plate: 'Plate', trap_bar: 'Trap Bar', bench: 'Bench', cardio_machine: 'Cardio Machine', other: 'Other',
};

export const SET_TYPE_LABELS: Record<SetType, string> = {
  warmup: 'Warm-up', normal: 'Working', drop: 'Drop set', failure: 'Failure', backoff: 'Back-off',
  top: 'Top set', amrap: 'AMRAP', other: 'Other',
};

/** Single-character badge shown in the set row. Working sets show their number instead. */
export const SET_TYPE_BADGE: Record<SetType, string> = {
  warmup: 'W', normal: '', drop: 'D', failure: 'F', backoff: 'B', top: 'T', amrap: 'A', other: 'O',
};

export const TRACKING_LABELS: Record<TrackingMode, string> = {
  weight_reps: 'Weight + Reps',
  bodyweight_reps: 'Bodyweight + Reps',
  assisted_bodyweight: 'Assisted Bodyweight',
  duration: 'Duration',
  distance_duration: 'Distance + Duration',
  distance_weight: 'Distance + Weight',
  reps_only: 'Reps Only',
  time_weight: 'Time + Weight',
  custom: 'Custom',
};

export const FIELD_LABELS: Record<FieldKey, string> = {
  weight: 'Weight', added_weight: '+Weight', assistance: 'Assist', reps: 'Reps', duration: 'Time', distance: 'Distance',
};
