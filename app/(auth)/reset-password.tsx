import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AuthShell } from '@/components/AuthShell';
import { Button, Field } from '@/components/ui';
import { resetSchema } from '@/validation/schemas';
import { useAuthStore } from '@/stores/authStore';
import { friendlyError } from '@/utils/errors';

type Values = z.infer<typeof resetSchema>;

/** Opened by the emailed recovery link (ironlog://reset-password#access_token=...). */
export default function ResetPassword() {
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const status = useAuthStore((s) => s.status);
  const [busy, setBusy] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirm: '' } });
  const onSubmit = handleSubmit(async (v) => {
    if (busy) return;
    setBusy(true);
    try {
      await updatePassword(v.password);
      Alert.alert('Password updated', 'You can now use your new password.');
      if (status !== 'signedIn') router.replace('/(auth)/sign-in');
    } catch (e) {
      Alert.alert('Could not update password', friendlyError(e));
    } finally {
      setBusy(false);
    }
  });
  return (
    <AuthShell title="New password" subtitle="Choose a new password for your account.">
      <Controller control={control} name="password" render={({ field }) => <Field label="New password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.password?.message} />} />
      <Controller control={control} name="confirm" render={({ field }) => <Field label="Confirm password" value={field.value} onChangeText={field.onChange} secureTextEntry error={errors.confirm?.message} />} />
      <Button title="Save password" onPress={onSubmit} loading={busy} />
    </AuthShell>
  );
}
