import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#11181c',
    background: '#f8faf9',
    backgroundElement: '#e8f0ec',
    backgroundSelected: '#d0e3d8',
    textSecondary: '#5a6b62',

    primary: '#1a7a4c',
    primaryLight: '#2d9d64',
    primaryDark: '#145e39',
    accent: '#c9a227',
    success: '#2d9d64',
    warning: '#d97706',
    danger: '#dc2626',
    prohibited: '#9333ea',
    female: '#db2777',
    selectedHighlight: '#e0f2e9',
  },
  dark: {
    text: '#edf2ee',
    background: '#0c1210',
    backgroundElement: '#162119',
    backgroundSelected: '#1f3025',
    textSecondary: '#9aa8a1',

    primary: '#34d17a',
    primaryLight: '#4ee890',
    primaryDark: '#28a85f',
    accent: '#e8c547',
    success: '#34d17a',
    warning: '#fbbf24',
    danger: '#f87171',
    prohibited: '#a855f7',
    female: '#f472b6',
    selectedHighlight: '#1a3022',
  },
};

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export type AppTheme = Record<keyof typeof Colors.light, string>;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
