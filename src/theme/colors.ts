// Stock Nexus Theme Colors - Matching Android App
// Primary brand color: #E6002A (Stock Nexus Red)

export const Colors = {
  // Primary brand colors
  primary: '#E6002A',
  primaryVariant: '#B8001F',
  secondary: '#6C757D',

  // Light theme
  light: {
    primary: '#E6002A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#FFDAD6',
    onPrimaryContainer: '#410002',
    
    secondary: '#6C757D',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E9ECEF',
    onSecondaryContainer: '#343A40',
    
    tertiary: '#2D3748',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#E2E8F0',
    onTertiaryContainer: '#1A202C',
    
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    onError: '#FFFFFF',
    onErrorContainer: '#410002',
    
    background: '#FFFBFE',
    onBackground: '#1C1B1F',
    surface: '#FFFFFF',
    onSurface: '#1C1B1F',
    surfaceVariant: '#F5F5F5',
    onSurfaceVariant: '#49454F',
    outline: '#79747E',
    
    card: '#FFFFFF',
    text: '#1C1B1F',
    textSecondary: '#49454F',
    border: '#E0E0E0',
  },

  // Dark theme
  dark: {
    primary: '#E6002A',
    onPrimary: '#FFFFFF',
    primaryContainer: '#93000A',
    onPrimaryContainer: '#FFDAD6',
    
    secondary: '#C7C7C7',
    onSecondary: '#2E2E2E',
    secondaryContainer: '#454545',
    onSecondaryContainer: '#E3E3E3',
    
    tertiary: '#A0AEC0',
    onTertiary: '#1A202C',
    tertiaryContainer: '#2D3748',
    onTertiaryContainer: '#E2E8F0',
    
    error: '#FFB4AB',
    errorContainer: '#93000A',
    onError: '#690005',
    onErrorContainer: '#FFDAD6',
    
    background: '#1C1B1F',
    onBackground: '#E6E1E5',
    surface: '#1C1B1F',
    onSurface: '#E6E1E5',
    surfaceVariant: '#2B2B2B',
    onSurfaceVariant: '#CAC4D0',
    outline: '#938F99',
    
    card: '#2B2B2B',
    text: '#E6E1E5',
    textSecondary: '#CAC4D0',
    border: '#3D3D3D',
  },

  // Status colors
  success: '#00C851',
  warning: '#FF8800',
  info: '#33B5E5',
  danger: '#E53E3E',

  // Chart colors
  chart: [
    '#E6002A',
    '#00C851',
    '#33B5E5',
    '#FF8800',
    '#2D3748',
    '#FF5722',
    '#4CAF50',
    '#2196F3',
  ],
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
  display: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
};

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  error: string;
  errorContainer: string;
  onError: string;
  onErrorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  info: string;
}

export const getThemeColors = (isDark: boolean): ThemeColors => {
  const baseColors = isDark ? Colors.dark : Colors.light;
  return {
    ...baseColors,
    success: Colors.success,
    warning: Colors.warning,
    info: Colors.info,
  };
};
