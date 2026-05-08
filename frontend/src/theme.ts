export const theme = {
  colors: {
    primary: '#D92525',
    primaryDark: '#B91C1C',
    secondary: '#1A365D',
    secondaryDark: '#0F2744',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    textMain: '#0F172A',
    textMuted: '#475569',
    textLight: '#94A3B8',
    border: '#E2E8F0',
    accent: '#EA580C',
    overlay: 'rgba(26, 54, 93, 0.65)',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
  },
  font: {
    heading: '700' as const,
    semibold: '600' as const,
    medium: '500' as const,
    regular: '400' as const,
  },
};

const backendHost =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000');

export const API_URL = `${backendHost}/api`;
