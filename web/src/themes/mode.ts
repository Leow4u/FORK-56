import type { DashboardTheme, ThemePalette } from "./types";
import { mix, relativeLuminance } from "./color";

/** Brightness preference — mirrors desktop `ThemeMode`. */
export type ThemeMode = "light" | "dark" | "system";

export type ResolvedThemeMode = "light" | "dark";

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function resolveThemeMode(
  mode: ThemeMode,
  systemDark = typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches,
): ResolvedThemeMode {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function isPaletteDark(palette: ThemePalette): boolean {
  return relativeLuminance(palette.background.hex) < 0.5;
}

/** Synthesize a light palette from a dark seed — same idea as desktop
 *  `synthLightColors`, adapted to the dashboard's 3-layer model. */
export function synthLightPalette(seed: ThemePalette): ThemePalette {
  const accent = seed.midground.hex;
  return {
    background: { hex: mix("#ffffff", accent, 0.06), alpha: 1 },
    midground: { hex: accent, alpha: seed.midground.alpha },
    foreground: {
      hex: mix("#161616", accent, 0.12),
      alpha: seed.foreground.alpha > 0 ? seed.foreground.alpha : 1,
    },
    warmGlow: seed.warmGlow.replace(/[\d.]+\)$/, "0.12)"),
    noiseOpacity: Math.max(0, seed.noiseOpacity * 0.35),
  };
}

/** Synthesize a dark palette from a light seed (e.g. Work4You Blue). */
export function synthDarkPalette(seed: ThemePalette): ThemePalette {
  const accent = seed.midground.hex;
  return {
    background: { hex: mix("#0a0f18", accent, 0.35), alpha: 1 },
    midground: { hex: accent, alpha: seed.midground.alpha },
    foreground: {
      hex: "#ffffff",
      alpha: seed.foreground.alpha > 0 ? seed.foreground.alpha : 0,
    },
    warmGlow: seed.warmGlow.replace(/[\d.]+\)$/, "0.32)"),
    noiseOpacity: Math.min(1.2, seed.noiseOpacity + 0.4),
  };
}

/** Pick the palette for a theme + resolved brightness mode. Skin (theme name)
 *  and mode stay independent — same contract as the desktop fork. */
export function getPaletteForMode(
  theme: DashboardTheme,
  mode: ResolvedThemeMode,
): ThemePalette {
  if (mode === "dark") {
    if (theme.darkPalette) return theme.darkPalette;
    if (isPaletteDark(theme.palette)) return theme.palette;
    return synthDarkPalette(theme.palette);
  }
  if (theme.lightPalette) return theme.lightPalette;
  if (!isPaletteDark(theme.palette)) return theme.palette;
  return synthLightPalette(theme.palette);
}

/** Terminal colors that track the resolved brightness when the theme didn't
 *  declare mode-specific terminal overrides. */
export function terminalColorsForMode(
  theme: DashboardTheme,
  mode: ResolvedThemeMode,
): { background: string; foreground: string } {
  const nativeDark = isPaletteDark(theme.palette);
  const usingNativePalette =
    (mode === "dark" && nativeDark) || (mode === "light" && !nativeDark);
  if (usingNativePalette && theme.terminalBackground) {
    return {
      background: theme.terminalBackground,
      foreground:
        theme.terminalForeground ?? (nativeDark ? "#f0e6d2" : "#170d02"),
    };
  }
  const palette = getPaletteForMode(theme, mode);
  return {
    background:
      mode === "light"
        ? mix(palette.background.hex, "#f5f8fc", 0.35)
        : palette.background.hex,
    foreground: mode === "light" ? "#170d02" : "#f0e6d2",
  };
}
