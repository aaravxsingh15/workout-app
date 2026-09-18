import type { Unit } from '@/types/domain';

export const KG_PER_LB = 0.45359237;
export const METERS_PER_KM = 1000;
export const METERS_PER_MILE = 1609.344;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Canonical kg -> number in the user's unit (rounded to 2dp so 135 lb round-trips cleanly). */
export function toDisplayWeight(kg: number, unit: Unit): number {
  return round(unit === 'lb' ? kgToLb(kg) : kg, 2);
}

/** Number typed by the user in their unit -> canonical kg (full precision). */
export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'lb' ? lbToKg(value) : value;
}

/** "60", "62.5", "135" - no trailing zeros. */
export function formatNumber(n: number, maxDecimals = 2): string {
  const r = round(n, maxDecimals);
  return String(r);
}

export function formatWeight(kg: number | null | undefined, unit: Unit, withUnit = false): string {
  if (kg === null || kg === undefined || Number.isNaN(kg)) return '-';
  const s = formatNumber(toDisplayWeight(kg, unit));
  return withUnit ? `${s} ${unit}` : s;
}

export function formatVolume(kg: number, unit: Unit): string {
  const v = Math.round(toDisplayWeight(kg, unit));
  return `${v.toLocaleString('en-US')} ${unit}`;
}

export function distanceUnitLabel(unit: Unit): string {
  return unit === 'lb' ? 'mi' : 'km';
}

export function metersToDisplayDistance(m: number, unit: Unit): number {
  return round(unit === 'lb' ? m / METERS_PER_MILE : m / METERS_PER_KM, 3);
}

export function displayDistanceToMeters(value: number, unit: Unit): number {
  return unit === 'lb' ? value * METERS_PER_MILE : value * METERS_PER_KM;
}

export function formatDistance(m: number | null | undefined, unit: Unit): string {
  if (m === null || m === undefined) return '-';
  return `${formatNumber(metersToDisplayDistance(m, unit), 2)} ${distanceUnitLabel(unit)}`;
}

/** Bodyweight and height helpers share the same canonical-kg convention. */
export const convertBodyweightForDisplay = toDisplayWeight;
export const convertBodyweightToKg = fromDisplayWeight;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}
