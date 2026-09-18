import { Alert } from 'react-native';
import { router } from 'expo-router';
import * as repo from '@/database/repositories/workoutRepo';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';
import { useWorkoutSession } from '@/stores/workoutSession';
import { useRestTimer } from '@/stores/restTimer';
import { friendlyError } from '@/utils/errors';

let starting = false;

/**
 * Starts (or resumes) a workout. Guards against double taps and against creating a second
 * active workout: if one is already running the user is asked what to do.
 */
export async function startWorkoutFlow(kind: { type: 'empty' } | { type: 'routine'; routineId: string } | { type: 'repeat'; workoutId: string }): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    const existing = await repo.getActiveWorkout();
    if (existing) {
      Alert.alert('Workout in progress', `"${existing.title}" is still running. Finish or discard it before starting another.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Resume it', onPress: () => router.push('/workout/active') },
      ]);
      return;
    }
    const id =
      kind.type === 'empty'
        ? await repo.startEmptyWorkout('Workout')
        : kind.type === 'routine'
          ? await repo.startWorkoutFromRoutine(kind.routineId)
          : await repo.repeatWorkout(kind.workoutId);
    await useActiveWorkoutMeta.getState().refresh();
    useWorkoutSession.getState().close();
    router.push('/workout/active');
    void id;
  } catch (e) {
    Alert.alert('Could not start workout', friendlyError(e));
  } finally {
    starting = false;
  }
}

export async function discardActiveFlow(workoutId: string): Promise<void> {
  await useWorkoutSession.getState().flush();
  await repo.discardActiveWorkout(workoutId);
  useWorkoutSession.getState().close();
  useRestTimer.getState().skip();
  await useActiveWorkoutMeta.getState().refresh();
}
