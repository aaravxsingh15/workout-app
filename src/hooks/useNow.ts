import { useEffect, useState } from 'react';

/** Re-renders on an interval. Consumers still compute from timestamps, so a paused/throttled interval never causes drift. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
