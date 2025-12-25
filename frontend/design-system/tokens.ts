/**
 * Design Tokens for BrickOptima
 * Centralized design values for colors, spacing, typography, and more
 */

export const colors = {
  // Primary color palette (Blue)
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#2196F3',
    600: '#1E88E5',
    700: '#1976D2',
    800: '#1565C0',
    900: '#0D47A1',
  },

  // Severity indicators
  severity: {
    low: '#10B981',      // Green
    medium: '#F59E0B',   // Amber
    high: '#EF4444',     // Red
    critical: '#7C2D12', // Dark red
  },

  // Grayscale
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Background colors
  background: {
    light: '#FFFFFF',
    lightAlt: '#F9FAFB',
    dark: '#0F172A',
    darkAlt: '#1E293B',
  },

  // DAG node types
  dagNode: {
    scan: '#3B82F6',      // Blue - data input
    join: '#8B5CF6',      // Purple - data combination
    filter: '#06B6D4',    // Cyan - data filtering
    aggregate: '#F59E0B', // Amber - data aggregation
    write: '#10B981',     // Green - data output
    shuffle: '#EF4444',   // Red - expensive operation
    default: '#6B7280',   // Gray - other
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '40px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '80px',
} as const;

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const typography = {
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"Fira Code", "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
  },
  fontWeight: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
} as const;

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
} as const;

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const breakpoints = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Helper function to get severity color
export const getSeverityColor = (severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): string => {
  const map = {
    LOW: colors.severity.low,
    MEDIUM: colors.severity.medium,
    HIGH: colors.severity.high,
    CRITICAL: colors.severity.critical,
  };
  return map[severity] || colors.gray[500];
};

// Helper function to get DAG node color
export const getDagNodeColor = (type: string): string => {
  const normalizedType = type.toLowerCase();

  if (normalizedType.includes('scan') || normalizedType.includes('table')) {
    return colors.dagNode.scan;
  }
  if (normalizedType.includes('join')) {
    return colors.dagNode.join;
  }
  if (normalizedType.includes('filter')) {
    return colors.dagNode.filter;
  }
  if (normalizedType.includes('aggregate') || normalizedType.includes('group')) {
    return colors.dagNode.aggregate;
  }
  if (normalizedType.includes('write') || normalizedType.includes('insert')) {
    return colors.dagNode.write;
  }
  if (normalizedType.includes('shuffle') || normalizedType.includes('exchange')) {
    return colors.dagNode.shuffle;
  }

  return colors.dagNode.default;
};

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DagNodeType = keyof typeof colors.dagNode;
