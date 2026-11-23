import { useColorScheme } from '@/components/useColorScheme';

const light = {
  bg: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111418',
  muted: '#6B7280',
  border: '#E5E7EB',
  input: '#F3F4F6',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  warning: '#D97706',
  kcal: '#2563EB',
  protein: '#E11D48',
  carbs: '#D97706',
  fat: '#0891B2',
  track: '#E5E7EB',
};

const dark: typeof light = {
  bg: '#0B0D10',
  card: '#16191E',
  text: '#F3F4F6',
  muted: '#9CA3AF',
  border: '#262A31',
  input: '#1F232A',
  primary: '#3B82F6',
  primarySoft: '#172554',
  onPrimary: '#FFFFFF',
  danger: '#F87171',
  success: '#4ADE80',
  successSoft: '#14532D',
  warning: '#FBBF24',
  kcal: '#60A5FA',
  protein: '#FB7185',
  carbs: '#FBBF24',
  fat: '#22D3EE',
  track: '#262A31',
};

export type Palette = typeof light;

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
