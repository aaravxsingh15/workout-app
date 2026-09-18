import { useColorScheme } from 'react-native';
import { useProfileStore } from '@/stores/profileStore';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  pr: string;
  warmup: string;
  overlay: string;
  isDark: boolean;
}

export const darkPalette: Palette = {
  bg: '#0B0D10',
  surface: '#14181D',
  surfaceAlt: '#1C2229',
  border: '#262E37',
  text: '#F2F5F7',
  textMuted: '#9AA5B1',
  textFaint: '#68727D',
  accent: '#FF5A36',
  accentText: '#FFFFFF',
  success: '#34D07F',
  warning: '#F5B841',
  danger: '#FF5C5C',
  pr: '#F5B841',
  warmup: '#5CA8FF',
  overlay: 'rgba(0,0,0,0.6)',
  isDark: true,
};

export const lightPalette: Palette = {
  bg: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEEF1',
  border: '#DADFE5',
  text: '#101418',
  textMuted: '#56616D',
  textFaint: '#8A94A0',
  accent: '#E8461F',
  accentText: '#FFFFFF',
  success: '#149E5B',
  warning: '#B7791F',
  danger: '#D93A3A',
  pr: '#B7791F',
  warmup: '#2B78D6',
  overlay: 'rgba(0,0,0,0.4)',
  isDark: false,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  caption: 12,
  small: 13,
  body: 15,
  bodyLg: 17,
  title: 22,
  display: 32,
  number: 20,
} as const;

/** Resolves the palette from the user's theme preference (dark by default). */
export function usePalette(): Palette {
  const scheme = useColorScheme();
  const pref = useProfileStore((s) => s.profile?.theme ?? 'dark');
  const resolved = pref === 'system' ? (scheme === 'light' ? 'light' : 'dark') : pref;
  return resolved === 'light' ? lightPalette : darkPalette;
}
