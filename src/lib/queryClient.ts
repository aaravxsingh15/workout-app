import { QueryClient } from '@tanstack/react-query';
import { onDataChanged } from '@/database/repositories/common';

export const queryClient = new QueryClient({
  defaultOptions: {
    // Data is local (SQLite): always fresh, never retried like a network call.
    queries: { staleTime: Infinity, gcTime: 5 * 60_000, retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
  },
});

/** Any repository write that affects user-visible history/routines/profile refreshes active queries. */
export function wireQueryInvalidation(): () => void {
  return onDataChanged(() => {
    void queryClient.invalidateQueries({ refetchType: 'active' });
  });
}
