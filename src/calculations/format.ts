import type { CalcSet, FieldKey, TrackingMode, Unit } from '@/types/domain';
import { formatDistance, formatNumber, formatWeight, toDisplayWeight } from './units';
import { formatClock } from './time';
import { getFields } from './tracking';

/** Compact one-line description of a set for previews and the diary. "60 × 8", "45:00", "5 km · 25:00". */
export function formatSetSummary(
  mode: TrackingMode,
  s: CalcSet,
  unit: Unit,
  customFields: FieldKey[] = [],
): string {
  const fields = getFields(mode, customFields);
  const parts: string[] = [];
  const weight = (kg: number | null) => (kg === null ? '-' : formatWeight(kg, unit));
  const reps = s.reps === null ? '-' : String(s.reps);

  switch (mode) {
    case 'weight_reps':
      return `${weight(s.weight_kg)} × ${reps}`;
    case 'bodyweight_reps':
      return s.added_weight_kg ? `BW +${weight(s.added_weight_kg)} × ${reps}` : `BW × ${reps}`;
    case 'assisted_bodyweight':
      return s.assistance_kg ? `-${weight(s.assistance_kg)} × ${reps}` : `BW × ${reps}`;
    case 'reps_only':
      return `${reps} reps`;
    case 'duration':
      return s.duration_sec === null ? '-' : formatClock(s.duration_sec);
    case 'distance_duration':
      if (s.distance_m !== null) parts.push(formatDistance(s.distance_m, unit));
      if (s.duration_sec !== null) parts.push(formatClock(s.duration_sec));
      return parts.join(' · ') || '-';
    case 'distance_weight':
      if (s.weight_kg !== null) parts.push(`${weight(s.weight_kg)} ${unit}`);
      if (s.distance_m !== null) parts.push(formatDistance(s.distance_m, unit));
      return parts.join(' · ') || '-';
    case 'time_weight':
      if (s.weight_kg !== null) parts.push(`${weight(s.weight_kg)} ${unit}`);
      if (s.duration_sec !== null) parts.push(formatClock(s.duration_sec));
      return parts.join(' · ') || '-';
    default:
      for (const f of fields) {
        if (f === 'weight' && s.weight_kg !== null) parts.push(`${weight(s.weight_kg)} ${unit}`);
        if (f === 'added_weight' && s.added_weight_kg !== null) parts.push(`+${weight(s.added_weight_kg)} ${unit}`);
        if (f === 'assistance' && s.assistance_kg !== null) parts.push(`-${weight(s.assistance_kg)} ${unit}`);
        if (f === 'reps' && s.reps !== null) parts.push(`${s.reps} reps`);
        if (f === 'duration' && s.duration_sec !== null) parts.push(formatClock(s.duration_sec));
        if (f === 'distance' && s.distance_m !== null) parts.push(formatDistance(s.distance_m, unit));
      }
      return parts.join(' · ') || '-';
  }
}

export function formatPace(secPerKm: number, unit: Unit): string {
  const perUnit = unit === 'lb' ? secPerKm * 1.609344 : secPerKm;
  return `${formatClock(perUnit)} /${unit === 'lb' ? 'mi' : 'km'}`;
}

export function formatPRValue(
  type: string,
  value: number,
  unit: Unit,
): string {
  switch (type) {
    case 'max_weight':
    case 'best_e1rm':
    case 'min_assistance':
      return `${formatNumber(toDisplayWeight(value, unit))} ${unit}`;
    case 'max_reps':
    case 'reps_at_weight':
      return `${value} reps`;
    case 'best_volume':
      return `${Math.round(toDisplayWeight(value, unit)).toLocaleString('en-US')} ${unit}`;
    case 'longest_duration':
      return formatClock(value);
    case 'best_distance':
      return formatDistance(value, unit);
    case 'best_pace':
      return formatPace(value, unit);
    default:
      return String(value);
  }
}
