import { describe, expect, it } from "vitest";

import { defaultTheme, tealTheme, work4youBlueTheme } from "@/themes/presets";
import {
  getPaletteForMode,
  isPaletteDark,
  normalizeThemeMode,
  resolveThemeMode,
  synthLightPalette,
} from "@/themes/mode";
import { relativeLuminance } from "@/themes/color";

describe("dashboard theme mode", () => {
  it("normalizes invalid mode values to system", () => {
    expect(normalizeThemeMode("system")).toBe("system");
    expect(normalizeThemeMode("light")).toBe("light");
    expect(normalizeThemeMode("bogus")).toBe("system");
  });

  it("resolves system mode from the OS preference flag", () => {
    expect(resolveThemeMode("system", true)).toBe("dark");
    expect(resolveThemeMode("system", false)).toBe("light");
    expect(resolveThemeMode("dark", false)).toBe("dark");
  });

  it("keeps dark themes on the seed palette in dark mode", () => {
    expect(isPaletteDark(tealTheme.palette)).toBe(true);
    expect(getPaletteForMode(tealTheme, "dark").background.hex).toBe(
      tealTheme.palette.background.hex,
    );
  });

  it("synthesizes a lighter palette for dark themes in light mode", () => {
    const light = getPaletteForMode(tealTheme, "light");
    expect(isPaletteDark(light)).toBe(false);
    expect(light.background.hex).not.toBe(tealTheme.palette.background.hex);
  });

  it("uses the native palette for inherently light themes in light mode", () => {
    expect(getPaletteForMode(work4youBlueTheme, "light").background.hex).toBe(
      work4youBlueTheme.palette.background.hex,
    );
    expect(getPaletteForMode(defaultTheme, "light").background.hex).toBe(
      defaultTheme.palette.background.hex,
    );
  });

  it("uses a theme's explicit dark palette in dark mode when declared", () => {
    const dark = getPaletteForMode(defaultTheme, "dark");
    expect(isPaletteDark(dark)).toBe(true);
    expect(dark.background.hex).toBe(defaultTheme.darkPalette?.background.hex);
    // Text layer must stay readable on the dark canvas.
    expect(relativeLuminance(dark.midground.hex)).toBeGreaterThan(0.5);
  });

  it("synthesizes a dark palette for light themes in dark mode", () => {
    const dark = getPaletteForMode(work4youBlueTheme, "dark");
    expect(isPaletteDark(dark)).toBe(true);
    expect(dark.background.hex).not.toBe(work4youBlueTheme.palette.background.hex);
  });

  it("light synthesis keeps midground readable on the light canvas", () => {
    const synth = synthLightPalette(tealTheme.palette);
    expect(synth.midground.hex).not.toBe(tealTheme.palette.midground.hex);
    expect(relativeLuminance(synth.midground.hex)).toBeLessThan(0.45);
    expect(isPaletteDark(synth)).toBe(false);
  });
});
