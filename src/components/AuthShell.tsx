import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './ui';
import { spacing, usePalette } from '@/theme';

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg }}>
            <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="barbell" size={30} color={p.accentText} />
            </View>
            <AppText variant="display">{title}</AppText>
            {subtitle ? <AppText variant="muted">{subtitle}</AppText> : null}
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
