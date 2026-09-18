import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { AppText, Button, Field } from '@/components/ui';
import { signUpSchema } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/supabase/client';
import { friendlyError } from '@/utils/errors';
import { usePalette } from '@/theme';

type Values = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const p = usePalette();
  const signUp = useAuthStore((s) => s.signUp);
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await signUp(v.email, v.password, v.displayName);
      if (res.needsConfirmation) {
        Alert.alert('Check your email', 'We sent you a confirmation link. Confirm your email, then sign in.', [
          { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
        ]);
      }
    } catch (e) {
      Alert.alert('Could not create account', friendlyError(e));
    } finally {
      setBusy(false);
    }
  });

  return (
    <AuthShell title="Create account" subtitle="Your workouts stay on your phone first and sync to your account.">
      <Controller control={control} name="displayName" render={({ field }) => <Field label="Name" value={field.value} onChangeText={field.onChange} autoComplete="name" error={errors.displayName?.message} />} />
      <Controller control={control} name="email" render={({ field }) => <Field label="Email" value={field.value} onChangeText={field.onChange} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email?.message} />} />
      <Controller control={control} name="password" render={({ field }) => <Field label="Password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />} />
      <Controller control={control} name="confirm" render={({ field }) => <Field label="Confirm password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirm?.message} />} />
      <Button title="Create account" onPress={onSubmit} loading={busy} disabled={!isSupabaseConfigured} />
      <Link href="/(auth)/sign-in">
        <AppText color={p.accent} style={{ fontWeight: '700' }}>I already have an account</AppText>
      </Link>
    </AuthShell>
  );
}
