// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  api: {
    getThemes: vi.fn(async () => ({
      themes: [
        { name: "default", label: "Default", description: "Classic look" },
        { name: "midnight", label: "Midnight", description: "Dark teal" },
      ],
      active: "default",
    })),
    setTheme: vi.fn(async () => ({ ok: true, theme: "default" })),
    getFontPref: vi.fn(async () => ({ font: "theme" })),
    setFontPref: vi.fn(async () => ({ ok: true, font: "theme" })),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: {
      language: { switchTo: "Switch language" },
      theme: {
        title: "Theme",
        fontTitle: "Font",
        fontDefault: "Theme default",
        fontDefaultHint: "Use the active theme's font",
        fontSans: "Sans",
        fontSerif: "Serif",
        fontMono: "Mono",
      },
    },
  }),
  LOCALE_META: {
    en: { name: "English" },
    pt: { name: "Português" },
  },
}));

const themeState = vi.hoisted(() => ({
  themeName: "default",
  fontId: "theme",
  availableThemes: [
    { name: "default", label: "Default", description: "Classic look" },
    { name: "midnight", label: "Midnight", description: "Dark teal" },
  ],
  setTheme: vi.fn(),
  setFont: vi.fn(),
}));

vi.mock("@/themes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/themes")>();
  return {
    ...actual,
    useTheme: () => ({
      theme: actual.BUILTIN_THEMES.default,
      themeName: themeState.themeName,
      availableThemes: themeState.availableThemes,
      setTheme: themeState.setTheme,
      fontId: themeState.fontId,
      fontChoices: actual.FONT_CHOICES,
      setFont: themeState.setFont,
    }),
  };
});

let container: HTMLDivElement;
let root: Root;

async function renderSection() {
  const { AppearanceSettingsSection } = await import("./appearance-panels");
  act(() => {
    root.render(<AppearanceSettingsSection />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AppearanceSettingsSection", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    themeState.setTheme.mockClear();
    themeState.setFont.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders language and theme headings with selectable rows", async () => {
    await renderSection();
    expect(container.textContent).toContain("Switch language");
    expect(container.textContent).toContain("Theme");
    expect(container.textContent).toContain("English");
    expect(container.textContent).toContain("Default");
    expect(container.textContent).toContain("Midnight");
    expect(container.textContent).toContain("Font");
  });
});
