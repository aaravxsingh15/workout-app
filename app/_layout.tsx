import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, wireQueryInvalidation } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useProfileStore } from '@/stores/profileStore';
import { useWorkoutSession } from '@/stores/workoutSession';
import { Loading } from '@/components/ui';
import { ActiveWorkoutBar } from '@/components/ActiveWorkoutBar';
import { usePalette } from '@/theme';

function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const ready = useAuthStore((s) => s.ready);
  const recovery = useAuthStore((s) => s.recovery);
  const onboarded = useProfileStore((s) => s.profile?.onboarding_completed ?? false);
  const p = usePalette();

  const signedIn = status === 'signedIn' && ready;
  const loading = status === 'loading' || (status === 'signedIn' && !ready);
  if (loading) return <Loading />;

  return (
    <>
      <StatusBar style={p.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Protected guard={!signedIn || recovery}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded && !recovery}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && onboarded && !recovery}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="workout/active" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="workout/summary/[id]" options={{ gestureEnabled: false }} />
          <Stack.Screen name="workout/[id]" />
          <Stack.Screen name="workout/edit/[id]" />
          <Stack.Screen name="exercise-picker" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="exercise/[id]" />
          <Stack.Screen name="exercise/edit" options={{ presentation: "modal" }} />
          <Stack.Screen name="exercises" />
          <Stack.Screen name="routine/[id]" />
          <Stack.Screen name="bodyweight" />
          <Stack.Screen name="plate-calculator" />
        </Stack.Protected>
      </Stack>
      {signedIn && onboarded && !recovery ? <ActiveWorkoutBar /> : null}
    </>
  );
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    void init();
    const unwire = wireQueryInvalidation();
    // Flush any in-flight workout edits the moment the app leaves the foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void useWorkoutSession.getState().flush();
    });
    return () => {
      unwire();
      sub.remove();
    };
  }, [init]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
