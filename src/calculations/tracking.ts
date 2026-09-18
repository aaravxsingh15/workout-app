import type { CalcSet, FieldKey, TrackingMode } from '@/types/domain';

export interface TrackingConfig {
  fields: FieldKey[];
  /** Whether volume (weight x reps) is a meaningful metric for this mode. */
  hasVolume: boolean;
}

/**
 * The single source of truth for what each tracking mode records. Adding a new mode means
 * adding an entry here (plus the enum value) - no schema change is needed because set rows
 * already carry every measurable column, and `custom` lets users pick fields per exercise.
 */
export const TRACKING_CONFIG: Record<TrackingMode, TrackingConfig> = {
  weight_reps: { fields: ['weight', 'reps'], hasVolume: true },
  bodyweight_reps: { fields: ['added_weight', 'reps'], hasVolume: true },
  assisted_bodyweight: { fields: ['assistance', 'reps'], hasVolume: false },
  duration: { fields: ['duration'], hasVolume: false },
  distance_duration: { fields: ['distance', 'duration'], hasVolume: false },
  distance_weight: { fields: ['weight', 'distance'], hasVolume: false },
  reps_only: { fields: ['reps'], hasVolume: false },
  time_weight: { fields: ['weight', 'duration'], hasVolume: false },
  custom: { fields: ['weight', 'reps'], hasVolume: false },
};

export const FIELD_ORDER: FieldKey[] = ['weight', 'added_weight', 'assistance', 'distance', 'duration', 'reps'];

export function getFields(mode: TrackingMode, customFields: FieldKey[] = []): FieldKey[] {
  if (mode === 'custom') {
    const chosen = FIELD_ORDER.filter((f) => customFields.includes(f));
    return chosen.length > 0 ? chosen : TRACKING_CONFIG.custom.fields;
  }
  return TRACKING_CONFIG[mode].fields;
}

/** Column on workout_sets that holds a given field. */
export const FIELD_COLUMN = {
  weight: 'weight_kg',
  added_weight: 'added_weight_kg',
  assistance: 'assistance_kg',
  reps: 'reps',
  duration: 'duration_sec',
  distance: 'distance_m',
} as const satisfies Record<FieldKey, keyof CalcSet | 'weight_kg' | 'added_weight_kg' | 'assistance_kg' | 'reps' | 'duration_sec' | 'distance_m'>;

export type FieldColumn = (typeof FIELD_COLUMN)[FieldKey];

export function getFieldValue(set: CalcSet, field: FieldKey): number | null {
  return set[FIELD_COLUMN[field]];
}

/** True when the set carries at least one measured value for its tracking mode. */
export function hasAnyValue(set: CalcSet, fields: FieldKey[]): boolean {
  return fields.some((f) => {
    const v = getFieldValue(set, f);
    return v !== null && v !== undefined;
  });
}
