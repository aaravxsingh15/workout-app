import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field } from '@/components/ui';
import { forgotSchema } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { isSupabaseConfigured } from '@/supabase/client';
import { friendlyError } from '@/utils/errors';

type Values = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const send = useAuthStore((s) => s.sendPasswordReset);
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });
  const onSubmit = handleSubmit(async (v) => {
    if (busy) return;
    setBusy(true);
    try {
      await send(v.email);
      Alert.alert('Email sent', 'If an account exists for that address, a reset link is on its way. Open it on this phone.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not send email', friendlyError(e));
    } finally {
      setBusy(false);
    }
  });
  return (
    <AuthShell title="Reset password" subtitle="We will email you a link to choose a new password.">
      <Controller control={control} name="email" render={({ field }) => <Field label="Email" value={field.value} onChangeText={field.onChange} autoCapitalize="none" keyboardType="email-address" error={errors.email?.message} />} />
      <Button title="Send reset link" onPress={onSubmit} loading={busy} disabled={!isSupabaseConfigured} />
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
    </AuthShell>
  );
}
