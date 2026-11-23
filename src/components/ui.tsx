import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useColors } from '@/src/theme';

export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const c = useColors();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>{children}</View>
      )}
      {footer ? (
        <View style={{ padding: 16, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 14,
          padding: 14,
          gap: 8,
          borderWidth: 1,
          borderColor: c.border,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

type Variant = 'title' | 'h2' | 'body' | 'small' | 'big' | 'label';

const VARIANTS: Record<Variant, TextStyle> = {
  big: { fontSize: 30, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15 },
  small: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
};

export function T({
  children,
  v = 'body',
  color,
  muted,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  v?: Variant;
  color?: string;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useColors();
  const defaultColor = muted || v === 'small' || v === 'label' ? c.muted : c.text;
  return (
    <Text numberOfLines={numberOfLines} style={[VARIANTS[v], { color: color ?? defaultColor }, style]}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.primary, secondary: c.primarySoft, danger: 'transparent', ghost: 'transparent' }[variant];
  const fg = { primary: c.onPrimary, secondary: c.primary, danger: c.danger, ghost: c.primary }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: 10,
          paddingVertical: small ? 7 : 12,
          paddingHorizontal: small ? 12 : 16,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          borderWidth: variant === 'danger' ? 1 : 0,
          borderColor: c.danger,
        },
        style,
      ]}>
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  const input = (
    <TextInput
      placeholderTextColor={c.muted}
      {...props}
      style={[
        {
          backgroundColor: c.input,
          color: c.text,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
        },
        style,
      ]}
    />
  );
  if (!label) return input;
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <T v="small">{label}</T>
      {input}
    </View>
  );
}

export function Row({
  children,
  gap = 8,
  style,
  between,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  between?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap },
        between && { justifyContent: 'space-between' },
        style,
      ]}>
      {children}
    </View>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const c = useColors();
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: over ? c.danger : color }} />
    </View>
  );
}

export function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <T v="small">{label}</T>
      <ProgressBar value={value} max={target} color={color} />
      <T v="small">
        {Math.round(value)}/{target} g
      </T>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: active ? c.primary : c.input,
      }}>
      <Text style={{ color: active ? c.onPrimary : c.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((o) => (
        <Chip key={o} label={labels?.[o] ?? o} active={o === value} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

export function ListItem({
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
        opacity: pressed && onPress ? 0.6 : 1,
        borderBottomWidth: 1,
        borderColor: c.border,
      })}>
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{title}</T>
        {subtitle ? (
          <T v="small" numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <T v="small" style={{ textAlign: 'center', paddingVertical: 12 }}>
      {text}
    </T>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="small">{label}</T>
      <T v="h2">{value}</T>
    </View>
  );
}
