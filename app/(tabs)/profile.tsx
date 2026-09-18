import React from 'react';
import { Alert, View } from 'react-native';
import { AppText, Banner, Button, Card, Chip, Row, Screen, Segmented, SectionHeader, SwitchRow } from '@/components/ui';
import { useProfileStore } from '@/stores/profileStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore } from '@/stores/syncStore';
import { requestSync } from '@/sync/scheduler';
import { spacing } from '@/theme';
import { friendlyError } from '@/utils/errors';
import type { PrefillMode, ThemePreference, Unit } from '@/types/domain';

const REST = [30, 60, 90, 120, 180, 240];

export default function Profile() {
  const profile = useProfileStore((s) => s.profile);
  const update = useProfileStore((s) => s.update);
  const { email, localOnly, signOut, deleteAccount } = useAuthStore();
  const sync = useSyncStore();
  if (!profile) return null;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', sync.pending > 0 ? `${sync.pending} changes are not synced yet. They stay on this phone and sync when you sign back in.` : 'Your data stays on this phone and in the cloud.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently deletes your account and ALL workout data in the cloud and on this phone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete forever',
        style: 'destructive',
        onPress: () => deleteAccount().catch((e) => Alert.alert('Could not delete account', friendlyError(e))),
      },
    ]);

  return (
    <Screen scroll>
      <AppText variant="display" style={{ marginTop: spacing.lg }}>{profile.display_name || 'Profile'}</AppText>
      <AppText variant="muted">{localOnly ? 'Local-only mode (not synced)' : email}</AppText>

      <SectionHeader title="Units" />
      <Segmented<Unit> value={profile.units} onChange={(v) => void update({ units: v })} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />

      <SectionHeader title="Theme" />
      <Segmented<ThemePreference> value={profile.theme} onChange={(v) => void update({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />

      <SectionHeader title="Default rest" />
      <Row style={{ flexWrap: 'wrap' }}>
        {REST.map((r) => <Chip key={r} label={r >= 60 ? `${r / 60} min` : `${r}s`} selected={profile.default_rest_sec === r} onPress={() => void update({ default_rest_sec: r })} />)}
      </Row>

      <SectionHeader title="Logging" />
      <Card>
        <SwitchRow label="Auto-start rest timer" value={profile.auto_rest_timer} onChange={(v) => void update({ auto_rest_timer: v })} />
        <SwitchRow label="Show RPE column" value={profile.show_rpe} onChange={(v) => void update({ show_rpe: v })} />
        <SwitchRow label="Show RIR column" value={profile.show_rir} onChange={(v) => void update({ show_rir: v })} />
        <SwitchRow label="Haptic feedback" value={profile.vibration_enabled} onChange={(v) => void update({ vibration_enabled: v })} />
      </Card>
      <View style={{ height: spacing.md }} />
      <AppText variant="label">New set prefill</AppText>
      <View style={{ height: spacing.sm }} />
      <Segmented<PrefillMode> value={profile.prefill_mode} onChange={(v) => void update({ prefill_mode: v })} options={[{ value: 'previous_set', label: 'Prev. set' }, { value: 'previous_workout', label: 'Last workout' }, { value: 'none', label: 'None' }]} />

      <SectionHeader title="Sync" />
      {sync.status === 'disabled' || localOnly ? (
        <Banner tone="info" text="Cloud sync is off (Supabase not configured). Data is stored on this phone." />
      ) : (
        <Card style={{ gap: spacing.sm }}>
          <AppText>{sync.status === 'syncing' ? 'Syncing…' : sync.status === 'offline' ? 'Offline - changes will sync later' : sync.status === 'error' ? `Error: ${sync.error}` : 'Up to date'}</AppText>
          <AppText variant="caption">{sync.pending} pending changes{sync.lastSyncedAt ? ` · last sync ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : ''}</AppText>
          <Button small variant="secondary" title="Sync now" onPress={() => requestSync(0)} />
        </Card>
      )}

      <SectionHeader title="Account" />
      <Button title="Sign out" variant="secondary" onPress={confirmSignOut} />
      {!localOnly ? <Button title="Delete account" variant="danger" onPress={confirmDelete} style={{ marginTop: spacing.md }} /> : null}
    </Screen>
  );
}
