import React, { memo, useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { font, radius, spacing, usePalette, type Palette } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- Text ----------

type Variant = 'body' | 'muted' | 'caption' | 'title' | 'display' | 'label' | 'number';

export function AppText({
  variant = 'body',
  style,
  color,
  children,
  ...rest
}: {
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const p = usePalette();
  const base: Record<Variant, TextStyle> = {
    body: { fontSize: font.body, color: p.text },
    muted: { fontSize: font.small, color: p.textMuted },
    caption: { fontSize: font.caption, color: p.textFaint },
    title: { fontSize: font.title, color: p.text, fontWeight: '800', letterSpacing: -0.3 },
    display: { fontSize: font.display, color: p.text, fontWeight: '800', letterSpacing: -0.5 },
    label: { fontSize: font.caption, color: p.textMuted, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
    number: { fontSize: font.number, color: p.text, fontWeight: '700', fontVariant: ['tabular-nums'] },
  };
  return (
    <Text {...rest} style={[base[variant], color ? { color } : null, style]}>
      {children}
    </Text>
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'],
  style,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const pad = padded ? { paddingHorizontal: spacing.lg } : null;
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: p.bg }, style]}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[pad, { paddingBottom: 120 }, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress, onLongPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void }) {
  const p = usePalette();
  const s: ViewStyle = { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, padding: spacing.lg };
  if (onPress || onLongPress) {
    return (
      <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [s, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s, style]}>{children}</View>;
}

export function Row({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ h = spacing.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <AppText variant="label">{title}</AppText>
      {action}
    </Row>
  );
}

// ---------- Buttons ----------

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const colors = {
    primary: { bg: p.accent, fg: p.accentText, border: 'transparent' },
    secondary: { bg: p.surfaceAlt, fg: p.text, border: p.border },
    ghost: { bg: 'transparent', fg: p.accent, border: 'transparent' },
    danger: { bg: 'transparent', fg: p.danger, border: p.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 40 : 52,
          paddingHorizontal: small ? spacing.lg : spacing.xl,
          borderRadius: radius.md,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.fg} /> : icon ? <Ionicons name={icon} size={small ? 18 : 20} color={colors.fg} /> : null}
      <Text style={{ color: colors.fg, fontSize: small ? font.small : font.bodyLg, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export const IconButton = memo(function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  label,
  style,
  hitSlop = 8,
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={hitSlop}
      onPress={onPress}
      style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={size} color={color ?? p.text} />
    </Pressable>
  );
});

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        height: 36,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? p.accent : p.border,
        backgroundColor: selected ? p.accent : p.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? p.accentText : p.textMuted} /> : null}
      <Text style={{ color: selected ? p.accentText : p.text, fontSize: font.small, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, color, filled }: { label: string; color?: string; filled?: boolean }) {
  const p = usePalette();
  const c = color ?? p.accent;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: filled ? c : 'transparent', borderWidth: 1, borderColor: c }}>
      <Text style={{ color: filled ? p.bg : c, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: p.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={{ flex: 1, height: 38, borderRadius: radius.sm + 1, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? p.surface : 'transparent' }}>
            <Text style={{ color: sel ? p.text : p.textMuted, fontWeight: '700', fontSize: font.small }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Inputs ----------

export function Field({
  label,
  error,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string | null; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        placeholderTextColor={p.textFaint}
        {...rest}
        style={{
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? p.danger : p.border,
          backgroundColor: p.surface,
          color: p.text,
          paddingHorizontal: spacing.lg,
          paddingVertical: rest.multiline ? spacing.md : 0,
          fontSize: font.bodyLg,
          textAlignVertical: rest.multiline ? 'top' : 'center',
          minHeight: rest.multiline ? 90 : 50,
        }}
      />
      {error ? <AppText variant="caption" color={p.danger}>{error}</AppText> : null}
    </View>
  );
}

export function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  const p = usePalette();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        {hint ? <AppText variant="caption">{hint}</AppText> : null}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: value ? p.accent : p.surfaceAlt, borderWidth: 1, borderColor: p.border, justifyContent: 'center', paddingHorizontal: 2 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: value ? 'flex-end' : 'flex-start' }} />
      </View>
    </Pressable>
  );
}

// ---------- States ----------

export function EmptyState({ icon, title, message, actionLabel, onAction }: { icon: IconName; title: string; message: string; actionLabel?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl * 1.5, paddingHorizontal: spacing.xl, gap: spacing.md }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={32} color={p.textMuted} />
      </View>
      <AppText variant="title" style={{ textAlign: 'center', fontSize: 18 }}>{title}</AppText>
      <AppText variant="muted" style={{ textAlign: 'center' }}>{message}</AppText>
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

export function Loading() {
  const p = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.bg, padding: spacing.xl }}>
      <ActivityIndicator color={p.accent} size="large" />
    </View>
  );
}

export function Banner({ text, tone = 'warning', action, onAction }: { text: string; tone?: 'warning' | 'danger' | 'info'; action?: string; onAction?: () => void }) {
  const p = usePalette();
  const c = tone === 'danger' ? p.danger : tone === 'info' ? p.warmup : p.warning;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: p.surface, borderColor: c, borderWidth: 1, borderRadius: radius.md, padding: spacing.md }}>
      <Ionicons name={tone === 'info' ? 'information-circle' : 'warning'} size={20} color={c} />
      <AppText variant="muted" style={{ flex: 1 }}>{text}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: c, fontWeight: '800' }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------- Bottom sheet ----------

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: p.overlay }} onPress={onClose} />
        <View style={{ backgroundColor: p.surface, borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, maxHeight: '85%', borderTopWidth: 1, borderColor: p.border }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>
          {title ? <AppText variant="title" style={{ fontSize: 18, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>{title}</AppText> : null}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetItem({ label, icon, onPress, danger, hint }: { label: string; icon?: IconName; onPress: () => void; danger?: boolean; hint?: string }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: spacing.md, opacity: pressed ? 0.6 : 1 })}>
      {icon ? <Ionicons name={icon} size={22} color={danger ? p.danger : p.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <AppText color={danger ? p.danger : undefined}>{label}</AppText>
        {hint ? <AppText variant="caption">{hint}</AppText> : null}
      </View>
    </Pressable>
  );
}

// ---------- Utilities ----------

export function useStyles<T>(factory: (p: Palette) => T): T {
  const p = usePalette();
  return useMemo(() => factory(p), [p, factory]);
}

export const hairline = StyleSheet.hairlineWidth;
