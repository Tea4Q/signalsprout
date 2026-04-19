export const lightTheme = {
  colors: {
    background: "#F7FAFC",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF6F2",
    textPrimary: "#1E293B",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    primary: "#5BCF8E",
    primarySoft: "#DDF7E7",
    secondary: "#4FC3F7",
    secondarySoft: "#DDF4FF",
    accent: "#FF8A65",
    accentSoft: "#FFF1EC",
    warning: "#F4B740",
    danger: "#EF6B6B",
    success: "#34C759",
    info: "#4FC3F7",
    border: "#DCE5EC",
    borderSoft: "#EAF1F5",
  },
};

export const darkTheme = {
  colors: {
    background: "#0F172A",
    surface: "#162033",
    surfaceAlt: "#1D2A3D",
    textPrimary: "#F8FAFC",
    textSecondary: "#CBD5E1",
    textMuted: "#94A3B8",
    primary: "#5BCF8E",
    primarySoft: "#1E4D38",
    secondary: "#63D3FF",
    secondarySoft: "#17384A",
    accent: "#FF8A65",
    accentSoft: "#4A2A24",
    warning: "#FFD166",
    danger: "#FF7B7B",
    success: "#4ADE80",
    info: "#63D3FF",
    border: "#2B3A4E",
    borderSoft: "#223044",
  },
};

// Flat colors alias (dark theme as default for the static theme export)
const colors = darkTheme.colors;

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
} as const;

const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
} as const;

const typography = {
  display: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "600" as const,
  },
  h1: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h2: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "500" as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },
  micro: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500" as const,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography,
} as const;

export type Theme = typeof theme;
export type ThemeColors = (typeof lightTheme)["colors"];
export type ThemeSpacing = typeof spacing;
export type ThemeRadius = typeof radius;
export type ThemeTypography = typeof typography;

// Re-export spacing/radius/typography standalone for convenience
export { radius, spacing, typography };

