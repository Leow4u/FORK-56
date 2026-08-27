import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Palette } from "lucide-react";
import { Button } from "@work4you/ui/ui/components/button";
import { BottomSheet } from "@work4you/ui/ui/components/bottom-sheet";
import { Typography } from "@work4you/ui/ui/components/typography/index";
import { useBelowBreakpoint } from "@work4you/ui/hooks/use-below-breakpoint";
import { useTheme } from "@/themes";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { FontPickerList, ThemePickerList } from "@/components/appearance-panels";

/**
 * Compact theme picker mounted next to the language switcher in the header.
 * Each dropdown row shows a 3-stop swatch (background / midground / warm
 * glow) so users can preview the palette before committing. User-defined
 * themes from `~/.work4you/dashboard-themes/*.yaml` use their API-provided
 * definitions so they show real palette swatches just like built-ins.
 *
 * When placed at the bottom of a container (e.g. the sidebar rail), pass
 * `dropUp` so the menu opens above the trigger instead of clipping below
 * the viewport. On viewports below the `sm` breakpoint, `dropUp` uses a
 * bottom sheet portaled to `document.body` so the picker is not clipped by
 * the sidebar (same idea as a responsive Drawer).
 */
export function ThemeSwitcher({ collapsed = false, dropUp = false }: ThemeSwitcherProps) {
  const { themeName, availableThemes } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const narrowViewport = useBelowBreakpoint(640);
  const useMobileSheet = Boolean(dropUp && narrowViewport);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open || useMobileSheet) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, close, useMobileSheet]);

  const current = availableThemes.find((th) => th.name === themeName);
  const label = current?.label ?? themeName;
  const sheetTitle = t.theme?.title ?? "Theme";

  const picker = (
    <>
      <ThemePickerList onAfterSelect={close} />
      <FontPickerList showHeading />
    </>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        ghost
        size={collapsed ? "icon" : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          collapsed
            ? "text-text-secondary hover:text-foreground hover:bg-transparent"
            : "px-2 py-1 normal-case tracking-normal font-normal text-xs text-text-secondary hover:text-foreground",
        )}
        title={`${t.theme?.switchTheme ?? "Switch theme"}: ${label}`}
        aria-label={t.theme?.switchTheme ?? "Switch theme"}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="inline-flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5" />

          {!collapsed && (
            <Typography className="hidden sm:inline text-display tracking-wide text-xs">
              {label}
            </Typography>
          )}
        </span>
      </Button>

      {useMobileSheet && (
        <BottomSheet
          backdropDismissLabel={t.common.close}
          onClose={close}
          open={open}
          title={sheetTitle}
        >
          <div aria-label={sheetTitle} role="listbox">
            {picker}
          </div>
        </BottomSheet>
      )}

      {open && !useMobileSheet && (() => {
        const rect = wrapperRef.current?.getBoundingClientRect();
        const dropdown = (
          <div
            ref={dropdownRef}
            aria-label={sheetTitle}
            className={cn(
              "min-w-[240px] max-h-[70dvh] overflow-y-auto",
              "border border-current/20 bg-background-base/95",
              "shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]",
              dropUp ? "fixed z-[100]" : "absolute z-50 right-0 top-full mt-1",
            )}
            role="listbox"
            style={
              dropUp && rect
                ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
                : undefined
            }
          >
            <div className="border-b border-current/20 px-3 py-2">
              <Typography className="text-display text-xs tracking-[0.12em] text-text-tertiary">
                {sheetTitle}
              </Typography>
            </div>
            {picker}
          </div>
        );
        return dropUp ? createPortal(dropdown, document.body) : dropdown;
      })()}
    </div>
  );
}

interface ThemeSwitcherProps {
  collapsed?: boolean;
  dropUp?: boolean;
}
