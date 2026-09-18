export interface PlateResult {
  perSide: number[];
  total: number;
  /** Target minus what could be loaded (>= 0). */
  remainder: number;
}

/**
 * Greedy plate loading in the user's display unit. `target` and `bar` are in the same unit as `plates`.
 * Greedy is exact for standard plate sets (each plate divides the next larger one's multiples closely enough);
 * the remainder reports anything that cannot be matched.
 */
export function calculatePlates(target: number, bar: number, plates: number[]): PlateResult {
  const sorted = [...plates].filter((p) => p > 0).sort((a, b) => b - a);
  let left = Math.max(0, (target - bar) / 2);
  const perSide: number[] = [];
  for (const p of sorted) {
    while (left + 1e-9 >= p) {
      perSide.push(p);
      left -= p;
    }
  }
  const loaded = perSide.reduce((s, p) => s + p, 0);
  const total = bar + loaded * 2;
  return { perSide, total: Math.round(total * 100) / 100, remainder: Math.max(0, Math.round((target - total) * 100) / 100) };
}
