import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { Link } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { AppText, Banner, Button, Field } from '@/components/ui';
import { signInSchema } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/supabase/client';
import { friendlyError } from '@/utils/errors';
import { spacing, usePalette } from '@/theme';

type Values = z.infer<typeof signInSchema>;

export default function SignIn() {
  const p = usePalette();
  const signIn = useAuthStore((s) => s.signIn);
  const continueLocalOnly = useAuthStore((s) => s.continueLocalOnly);
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (v) => {
    if (busy) return; // duplicate-tap guard
    setBusy(true);
    try {
      await signIn(v.email, v.password);
    } catch (e) {
      Alert.alert('Sign in failed', friendlyError(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to open your training diary.">
      {!isSupabaseConfigured ? (
        <Banner tone="info" text="Cloud is not configured yet (see README > Supabase setup). You can try the app in local-only mode." />
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field label="Email" value={field.value} onChangeText={field.onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email?.message} />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field label="Password" value={field.value} onChangeText={field.onChange} secureTextEntry autoComplete="password" error={errors.password?.message} />
        )}
      />
      <Button title="Sign in" onPress={onSubmit} loading={busy} disabled={!isSupabaseConfigured} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <Link href="/(auth)/forgot-password">
          <AppText color={p.accent} style={{ fontWeight: '700' }}>Forgot password?</AppText>
        </Link>
        <Link href="/(auth)/sign-up">
          <AppText color={p.accent} style={{ fontWeight: '700' }}>Create account</AppText>
        </Link>
      </View>
      {!isSupabaseConfigured ? (
        <Button title="Continue in local-only mode" variant="secondary" onPress={() => void continueLocalOnly()} style={{ marginTop: spacing.lg }} />
      ) : null}
    </AuthShell>
  );
}
