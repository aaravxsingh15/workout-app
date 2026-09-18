import { create } from 'zustand';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { isSupabaseConfigured, lastUserStore, supabase } from '@/supabase/client';
import { bootstrapUser, teardownUser } from '@/services/bootstrap';
import { deleteUserDatabase } from '@/database/db';
import { syncNow } from '@/sync/syncEngine';

export const LOCAL_USER_ID = 'local-user';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  ready: boolean; // local database + profile are loaded for the signed-in user
  userId: string | null;
  email: string | null;
  localOnly: boolean;
  offlineSession: boolean;
  /** True while the user is completing a password-recovery link. */
  recovery: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  continueLocalOnly: () => Promise<void>;
}

let subscribed = false;
const entering = new Map<string, Promise<void>>();

async function handleRecoveryUrl(url: string | null): Promise<boolean> {
  if (!url || !url.includes('type=recovery')) return false;
  const frag = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const params = new URLSearchParams(frag);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const enterOnce = async (userId: string, email: string | null, displayName = '', offline = false) => {
    set({ ready: false });
    const net = await NetInfo.fetch().catch(() => null);
    await bootstrapUser(userId, displayName, net?.isConnected !== false);
    set({ status: 'signedIn', userId, email, offlineSession: offline, ready: true });
    await lastUserStore.set(JSON.stringify({ id: userId, email }));
  };

  // Sign-in triggers both the auth listener and the explicit call; run the bootstrap once.
  const enter = (userId: string, email: string | null, displayName = '', offline = false): Promise<void> => {
    const existing = entering.get(userId);
    if (existing) return existing;
    const p = enterOnce(userId, email, displayName, offline).finally(() => entering.delete(userId));
    entering.set(userId, p);
    return p;
  };

  return {
    status: 'loading',
    ready: false,
    userId: null,
    email: null,
    localOnly: false,
    offlineSession: false,
    recovery: false,

    init: async () => {
      if (!isSupabaseConfigured) {
        set({ status: 'signedOut', localOnly: true });
        return;
      }
      if (!subscribed) {
        subscribed = true;
        supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
          if (event === 'SIGNED_OUT' && get().status === 'signedIn' && !get().localOnly) {
            void teardownUser().then(() => set({ status: 'signedOut', userId: null, email: null, ready: false, recovery: false }));
          }
          if (event === 'SIGNED_IN' && session && get().userId !== session.user.id && !get().recovery) {
            void enter(session.user.id, session.user.email ?? null, (session.user.user_metadata?.display_name as string) ?? '');
          }
        });
        Linking.addEventListener('url', ({ url }) => {
          void handleRecoveryUrl(url).then((ok) => ok && set({ recovery: true }));
        });
      }
      try {
        const initial = await Linking.getInitialURL();
        if (await handleRecoveryUrl(initial)) set({ recovery: true });

        const { data, error } = await supabase.auth.getSession();
        if (data.session) {
          await enter(data.session.user.id, data.session.user.email ?? null, (data.session.user.user_metadata?.display_name as string) ?? '');
          return;
        }
        // No valid session. If we're simply offline (token could not refresh), let the user keep training with their local data.
        const net = await NetInfo.fetch().catch(() => null);
        const cached = await lastUserStore.get();
        if ((error || net?.isConnected === false) && cached && net?.isConnected === false) {
          const c = JSON.parse(cached) as { id: string; email: string | null };
          await enter(c.id, c.email, '', true);
          return;
        }
      } catch {
        // fall through to signed-out
      }
      set({ status: 'signedOut' });
    },

    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (data.session && get().status !== 'signedIn') {
        await enter(data.session.user.id, data.session.user.email ?? null, (data.session.user.user_metadata?.display_name as string) ?? '');
      }
    },

    signUp: async (email, password, displayName) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (error) throw error;
      if (data.session) {
        await enter(data.session.user.id, data.session.user.email ?? null, displayName.trim());
        return { needsConfirmation: false };
      }
      return { needsConfirmation: true };
    },

    signOut: async () => {
      const { userId, localOnly } = get();
      // Best-effort final sync so nothing pending is left behind on this device.
      if (userId && !localOnly) await syncNow(userId).catch(() => undefined);
      await teardownUser();
      if (!localOnly && isSupabaseConfigured) await supabase.auth.signOut().catch(() => undefined);
      await lastUserStore.clear();
      set({ status: 'signedOut', userId: null, email: null, ready: false, recovery: false, offlineSession: false });
    },

    sendPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: Linking.createURL('reset-password'),
      });
      if (error) throw error;
    },

    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      set({ recovery: false });
    },

    deleteAccount: async () => {
      const { userId } = get();
      if (!userId) return;
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await teardownUser();
      await deleteUserDatabase(userId);
      await supabase.auth.signOut().catch(() => undefined);
      await lastUserStore.clear();
      set({ status: 'signedOut', userId: null, email: null, ready: false });
    },

    continueLocalOnly: async () => {
      await enter(LOCAL_USER_ID, null, 'Athlete');
      set({ localOnly: true });
    },
  };
});
