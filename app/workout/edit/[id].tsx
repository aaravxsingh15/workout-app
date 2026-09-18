import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { WorkoutEditor } from '@/features/workout/WorkoutEditor';

export default function EditWorkout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutEditor workoutId={id} mode="edit" />;
}
