export type ThemeMode = "bhurjapatra" | "nila-krshna";

export interface ThemeTokens {
  name: string;
  label: string;
  sanskritLabel: string;
  bgBase: string;
  bgSurface: string;
  bgCanvas: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  accentSecondary: string;
}

export const THEMES: Record<ThemeMode, ThemeTokens> = {
  bhurjapatra: {
    name: "bhurjapatra",
    label: "Bhurjapatra (Warm Parchment)",
    sanskritLabel: "भूर्जपत्र",
    bgBase: "#F3EEE3",
    bgSurface: "#FAF7F0",
    bgCanvas: "#FFFDF9",
    textPrimary: "#1C1917",
    textSecondary: "#575249",
    accentPrimary: "#A13D22",
    accentSecondary: "#B48228",
  },
  "nila-krshna": {
    name: "nila-krshna",
    label: "Nila-Krshna (Obsidian Slate)",
    sanskritLabel: "नील-कृष्ण",
    bgBase: "#0A0D13",
    bgSurface: "#111622",
    bgCanvas: "#151D2C",
    textPrimary: "#E6EDF5",
    textSecondary: "#94A3B8",
    accentPrimary: "#E5A93C",
    accentSecondary: "#38BDF8",
  },
};

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("pustakeum_theme", mode);
}

export function getSavedTheme(): ThemeMode {
  const saved = localStorage.getItem("pustakeum_theme") as ThemeMode;
  return saved === "nila-krshna" ? "nila-krshna" : "bhurjapatra";
}

