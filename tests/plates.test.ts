import { calculatePlates } from '@/calculations/plates';

describe('plate calculator', () => {
  it('loads 100 kg on a 20 kg bar', () => {
    const r = calculatePlates(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.perSide).toEqual([25, 15]);
    expect(r.total).toBe(100);
    expect(r.remainder).toBe(0);
  });
  it('reports remainder when target cannot be matched', () => {
    const r = calculatePlates(101, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
    expect(r.remainder).toBeCloseTo(1, 5);
  });
  it('handles target at or below the bar', () => {
    expect(calculatePlates(20, 20, [10]).perSide).toEqual([]);
  });
});
