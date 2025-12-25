/**
 * Theme Configuration for BrickOptima
 * Manages light/dark theme definitions and utilities
 */

import { colors, shadows, typography } from './tokens';

export interface Theme {
  name: 'light' | 'dark';
  colors: {
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    border: {
      primary: string;
      secondary: string;
      focus: string;
    };
    interactive: {
      primary: string;
      primaryHover: string;
      primaryActive: string;
      secondary: string;
      secondaryHover: string;
      danger: string;
      dangerHover: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  shadows: typeof shadows;
  typography: typeof typography;
}

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    background: {
      primary: colors.background.light,
      secondary: colors.gray[50],
      tertiary: colors.gray[100],
    },
    text: {
      primary: colors.gray[900],
      secondary: colors.gray[600],
      tertiary: colors.gray[500],
      inverse: colors.background.light,
    },
    border: {
      primary: colors.gray[200],
      secondary: colors.gray[300],
      focus: colors.primary[500],
    },
    interactive: {
      primary: colors.primary[600],
      primaryHover: colors.primary[700],
      primaryActive: colors.primary[800],
      secondary: colors.gray[100],
      secondaryHover: colors.gray[200],
      danger: colors.error,
      dangerHover: '#DC2626',
    },
    status: {
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,
    },
  },
  shadows,
  typography,
};

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    background: {
      primary: colors.background.dark,
      secondary: colors.background.darkAlt,
      tertiary: colors.gray[800],
    },
    text: {
      primary: colors.gray[50],
      secondary: colors.gray[300],
      tertiary: colors.gray[400],
      inverse: colors.gray[900],
    },
    border: {
      primary: colors.gray[700],
      secondary: colors.gray[600],
      focus: colors.primary[400],
    },
    interactive: {
      primary: colors.primary[500],
      primaryHover: colors.primary[400],
      primaryActive: colors.primary[300],
      secondary: colors.gray[700],
      secondaryHover: colors.gray[600],
      danger: colors.error,
      dangerHover: '#F87171',
    },
    status: {
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      info: colors.info,
    },
  },
  shadows,
  typography,
};

// Theme utility functions
export const getTheme = (isDark: boolean): Theme => {
  return isDark ? darkTheme : lightTheme;
};

// CSS class names for theme-aware components
export const themeClasses = {
  card: {
    light: 'bg-white border border-gray-200 shadow-md',
    dark: 'bg-gray-800 border border-gray-700 shadow-lg',
  },
  button: {
    primary: {
      light: 'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white',
      dark: 'bg-primary-500 hover:bg-primary-400 active:bg-primary-300 text-white',
    },
    secondary: {
      light: 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-900 border border-gray-300',
      dark: 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-100 border border-gray-600',
    },
    danger: {
      light: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white',
      dark: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
    },
    ghost: {
      light: 'hover:bg-gray-100 active:bg-gray-200 text-gray-700',
      dark: 'hover:bg-gray-700 active:bg-gray-600 text-gray-200',
    },
  },
  input: {
    light: 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-200',
    dark: 'bg-gray-800 border border-gray-600 text-gray-100 placeholder:text-gray-500 focus:border-primary-400 focus:ring-2 focus:ring-primary-900',
  },
  badge: {
    light: 'bg-gray-100 text-gray-800 border border-gray-200',
    dark: 'bg-gray-700 text-gray-200 border border-gray-600',
  },
  modal: {
    overlay: {
      light: 'bg-black/50',
      dark: 'bg-black/70',
    },
    content: {
      light: 'bg-white border border-gray-200',
      dark: 'bg-gray-800 border border-gray-700',
    },
  },
} as const;

// Severity badge classes (theme-independent, color-specific)
export const severityClasses = {
  LOW: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
  HIGH: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
  CRITICAL: 'bg-red-900 text-white border-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
} as const;

// Status indicator classes
export const statusClasses = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
} as const;

export type ThemeName = 'light' | 'dark';
export type SeverityLevel = keyof typeof severityClasses;
export type StatusType = keyof typeof statusClasses;
