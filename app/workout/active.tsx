import React from 'react';
import { router } from 'expo-router';
import { useActiveWorkoutMeta } from '@/stores/activeWorkout';
import { WorkoutEditor } from '@/features/workout/WorkoutEditor';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function ActiveWorkout() {
  const w = useActiveWorkoutMeta((s) => s.workout);
  if (!w)
    return (
      <Screen>
        <EmptyState icon="barbell-outline" title="No workout in progress" message="Start a workout from Home or a routine." />
        <Button title="Back" onPress={() => router.back()} />
      </Screen>
    );
  return <WorkoutEditor workoutId={w.id} mode="active" />;
}
