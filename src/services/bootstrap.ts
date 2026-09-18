import { closeDatabase, openDatabaseForUser } from '@/database/db';
import { seedSystemExercises } from '@/database/repositories/exerciseRepo';
import { useProfileStore } from '@/stores/profileStore';
import { useRestTimer } from '@/stores/restTimer';
import { useWorkoutSession } from '@/stores/workoutSession';
import { pullProfileFromCloud } from '@/sync/syncEngine';
import { startSyncScheduler, stopSyncScheduler } from '@/sync/scheduler';
import { useSyncStore } from '@/stores/syncStore';
import { getProfile } from '@/database/repositories/profileRepo';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';

/** Opens the per-user database, seeds the library, loads the profile, and starts background sync. */
export async function bootstrapUser(userId: string, displayName = '', online = true): Promise<void> {
  await openDatabaseForUser(userId);
  await seedSystemExercises();
  const local = await getProfile(userId);
  if (!local && online) await pullProfileFromCloud(userId);
  await useProfileStore.getState().load(userId, displayName);
  await useRestTimer.getState().hydrate();
  await useActiveWorkoutMeta.getState().refresh();
  startSyncScheduler(userId);
}

export async function teardownUser(): Promise<void> {
  stopSyncScheduler();
  await useWorkoutSession.getState().flush();
  useWorkoutSession.getState().close();
  useRestTimer.setState({ endsAt: null, pausedRemainingMs: null, active: false });
  useActiveWorkoutMeta.getState().clear();
  useProfileStore.getState().clear();
  useSyncStore.getState().set({ status: 'idle', pending: 0, error: null, lastSyncedAt: null });
  await closeDatabase();
}
