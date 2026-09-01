/**
 * Shared language + dashboard theme/font pickers.
 *
 * Used by Settings → Appearance (the official surface for language, color
 * mode, theme, and font). Same hooks and persistence as the former sidebar
 * switchers — only the layout differs.
 */

import { Check, Type } from "lucide-react";

import { LOCALE_META, useI18n } from "@/i18n";
import type { Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  BUILTIN_THEMES,
  THEME_DEFAULT_FONT_ID,
  getPaletteForMode,
  useTheme,
} from "@/themes";
import type { DashboardTheme, FontChoice, ThemeMode } from "@/themes";
import { Segmented } from "@work4you/ui/ui/components/segmented";
import { ListItem } from "@work4you/ui/ui/components/list-item";
import { Typography } from "@work4you/ui/ui/components/typography/index";

const FONT_CATEGORY_LABEL_KEY: Record<
  FontChoice["category"],
  "fontSans" | "fontSerif" | "fontMono"
> = {
  sans: "fontSans",
  serif: "fontSerif",
  mono: "fontMono",
};

export function LanguagePickerList({
  onAfterSelect,
  className,
}: {
  onAfterSelect?: () => void;
  className?: string;
}) {
  const { locale, setLocale } = useI18n();
  const allLocales = Object.entries(LOCALE_META) as Array<
    [Locale, (typeof LOCALE_META)[Locale]]
  >;

  return (
    <div className={cn("py-1", className)} role="listbox">
      {allLocales.map(([code, meta]) => {
        const selected = code === locale;

        return (
          <button
            aria-selected={selected}
            className={cn(
              "w-full text-left px-3 py-1.5 flex items-center gap-2 cursor-pointer",
              "font-sans text-display text-xs tracking-[0.08em]",
              "hover:bg-accent hover:text-accent-foreground transition-colors",
              selected ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
            key={code}
            onClick={() => {
              setLocale(code);
              onAfterSelect?.();
            }}
            role="option"
            type="button"
          >
            <span className="truncate">{meta.name}</span>
            {selected && (
              <Check className="ml-auto h-3 w-3 shrink-0 text-midground" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeModePicker({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();
  const options: Array<{ value: ThemeMode; label: string }> = [
    { value: "light", label: t.theme?.modeLight ?? "Light" },
    { value: "dark", label: t.theme?.modeDark ?? "Dark" },
    { value: "system", label: t.theme?.modeSystem ?? "System" },
  ];

  return (
    <Segmented
      className={className}
      onChange={setMode}
      options={options}
      value={mode}
    />
  );
}

export function ThemePickerList({
  onAfterSelect,
  className,
}: {
  onAfterSelect?: () => void;
  className?: string;
}) {
  const { themeName, availableThemes, setTheme, resolvedMode } = useTheme();

  return (
    <div className={cn("py-1", className)} role="listbox">
      {availableThemes.map((th) => {
        const isActive = th.name === themeName;
        const paletteTheme = BUILTIN_THEMES[th.name] ?? th.definition;
        const previewTheme =
          paletteTheme &&
          ({
            ...paletteTheme,
            palette: getPaletteForMode(paletteTheme, resolvedMode),
          } satisfies DashboardTheme);

        return (
          <ListItem
            active={isActive}
            aria-selected={isActive}
            className="gap-3"
            key={th.name}
            onClick={() => {
              setTheme(th.name);
              onAfterSelect?.();
            }}
            role="option"
          >
            {previewTheme ? (
              <ThemeSwatch theme={previewTheme} />
            ) : (
              <PlaceholderSwatch />
            )}

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Typography className="truncate text-display text-xs tracking-wide">
                {th.label}
              </Typography>
              {th.description && (
                <Typography className="truncate text-xs tracking-normal text-text-tertiary">
                  {th.description}
                </Typography>
              )}
            </div>

            <Check
              className={cn(
                "h-3 w-3 shrink-0 text-midground",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
          </ListItem>
        );
      })}
    </div>
  );
}

export function FontPickerList({
  className,
  showHeading = true,
}: {
  className?: string;
  showHeading?: boolean;
}) {
  const { fontId, fontChoices, setFont } = useTheme();
  const { t } = useI18n();
  const order: FontChoice["category"][] = ["sans", "serif", "mono"];

  return (
    <div className={className}>
      {showHeading && (
        <div className="border-t border-current/20 px-3 pb-1 pt-2">
          <span className="inline-flex items-center gap-1.5">
            <Type className="h-3 w-3 text-text-tertiary" />
            <Typography className="text-display text-xs tracking-[0.12em] text-text-tertiary">
              {t.theme?.fontTitle ?? "Font"}
            </Typography>
          </span>
        </div>
      )}

      <ListItem
        active={fontId === THEME_DEFAULT_FONT_ID}
        aria-selected={fontId === THEME_DEFAULT_FONT_ID}
        className="gap-3"
        onClick={() => setFont(THEME_DEFAULT_FONT_ID)}
        role="option"
      >
        <span aria-hidden className="h-4 w-9 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Typography className="truncate text-xs tracking-normal">
            {t.theme?.fontDefault ?? "Theme default"}
          </Typography>
          <Typography className="truncate text-xs tracking-normal text-text-tertiary">
            {t.theme?.fontDefaultHint ?? "Use the active theme's font"}
          </Typography>
        </div>
        <Check
          className={cn(
            "h-3 w-3 shrink-0 text-midground",
            fontId === THEME_DEFAULT_FONT_ID ? "opacity-100" : "opacity-0",
          )}
        />
      </ListItem>

      {order.map((cat) => {
        const fonts = fontChoices.filter((f) => f.category === cat);
        if (fonts.length === 0) return null;
        const catLabel = t.theme?.[FONT_CATEGORY_LABEL_KEY[cat]] ?? cat;
        return (
          <div key={cat}>
            <div className="px-3 pb-0.5 pt-1.5">
              <Typography className="text-[0.65rem] uppercase tracking-[0.1em] text-text-tertiary">
                {catLabel}
              </Typography>
            </div>
            {fonts.map((f) => {
              const isActive = f.id === fontId;
              return (
                <ListItem
                  active={isActive}
                  aria-selected={isActive}
                  className="gap-3"
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  role="option"
                >
                  <span aria-hidden className="h-4 w-9 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate text-sm"
                      style={{ fontFamily: f.stack }}
                    >
                      {f.label}
                    </span>
                  </div>
                  <Check
                    className={cn(
                      "h-3 w-3 shrink-0 text-midground",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                </ListItem>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Settings → Appearance — expanded language, color mode, theme, and font panels. */
export function AppearanceSettingsSection() {
  const { t } = useI18n();

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <section className="flex flex-col gap-2">
        <Typography className="text-sm font-medium">
          {t.language.switchTo}
        </Typography>
        <div className="border border-border bg-background-base/40 max-h-80 overflow-y-auto">
          <LanguagePickerList />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography className="text-sm font-medium">
            {t.theme?.modeTitle ?? "Color mode"}
          </Typography>
          <ThemeModePicker />
        </div>
        <Typography className="text-xs tracking-normal text-text-tertiary">
          {t.theme?.modeDesc ??
            "Fixed light or dark, or follow your system setting."}
        </Typography>
      </section>

      <section className="flex flex-col gap-2">
        <Typography className="text-sm font-medium">
          {t.theme?.title ?? "Theme"}
        </Typography>
        <Typography className="text-xs tracking-normal text-text-tertiary">
          {t.theme?.skinDesc ??
            "Palette and typography. Color mode above controls brightness."}
        </Typography>
        <div className="border border-border bg-background-base/40 max-h-[70dvh] overflow-y-auto">
          <ThemePickerList />
          <FontPickerList showHeading />
        </div>
      </section>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: DashboardTheme }) {
  const [c1, c2, c3] = theme.swatchColors ?? [
    theme.palette.background.hex,
    theme.palette.midground.hex,
    theme.palette.warmGlow,
  ];
  return (
    <div
      aria-hidden
      className="flex h-4 w-9 shrink-0 overflow-hidden border border-current/20"
    >
      <span className="flex-1" style={{ background: c1 }} />
      <span className="flex-1" style={{ background: c2 }} />
      <span className="flex-1" style={{ background: c3 }} />
    </div>
  );
}

function PlaceholderSwatch() {
  return (
    <div
      aria-hidden
      className="h-4 w-9 shrink-0 border border-dashed border-current/20"
    />
  );
}
