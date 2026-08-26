/**
 * AuthWidget — sidebar footer user area: identity + Settings + Log out.
 *
 * Mirrors the desktop-app / Cursor pattern: the logged-in identity sits at
 * the bottom of the sidebar with a Settings gear beside it; clicking the
 * identity opens a small drop-up menu with "Settings" and "Log out".
 *
 * Auth behavior (unchanged from the original OAuth-gate widget):
 *   - Gated mode (non-loopback, OAuth/password): fetches /api/auth/me and
 *     shows the identity (user_id truncated — Portal contract V1 emits no
 *     email/display_name) plus the provider name. Log out POSTs
 *     /auth/logout and full-page-navigates to /login.
 *   - Loopback / --insecure mode: there is no logged-in identity, so only
 *     the Settings affordance renders (the gear row) — Settings must stay
 *     reachable on local installs too.
 *
 * The drop-up menu reuses the LanguageSwitcher pattern: portal to body,
 * fixed position above the trigger, Escape + outside-pointerdown close.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { api, type AuthMeResponse } from "@/lib/api";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { LogOut, Settings } from "lucide-react";

interface AuthWidgetProps {
  className?: string;
}

/** Truncate ``user_id`` to fit a small UI without revealing the full
 *  opaque identifier. 14 chars is enough to disambiguate users in a
 *  small org and short enough to fit a single sidebar row. */
function truncateUserId(id: string): string {
  if (id.length <= 14) return id;
  return `${id.slice(0, 14)}…`;
}

export function AuthWidget({ className }: AuthWidgetProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [me, setMe] = useState<AuthMeResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Anchor rect captured in the click handler (not read from a ref during
  // render — react-hooks forbids that) so the portal menu can position
  // itself above the trigger.
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const settingsLabel = t.app.nav.settings ?? "Settings";
  const logOutLabel = t.app.logOut ?? "Log out";

  // Loopback / --insecure mode: the auth gate is off, so /api/auth/me is a
  // guaranteed 401. Don't fire the request at all — it only produces console
  // noise ("Failed to load resource: 401") on every dashboard load.
  const gated =
    typeof window !== "undefined" && !!window.__WORK4YOU_AUTH_REQUIRED__;

  useEffect(() => {
    if (!gated) return;
    let cancelled = false;
    api
      .getAuthMe()
      .then((data) => {
        if (cancelled) return;
        setMe(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401 from /api/auth/me means the gate isn't engaged in this
        // process (loopback mode) — render nothing identity-wise.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("401:") || msg.startsWith("403:")) {
          setHidden(true);
          return;
        }
        setError("auth status unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [gated]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const openSettings = () => {
    setMenuOpen(false);
    navigate("/settings");
  };

  const handleLogout = () => {
    setMenuOpen(false);
    void api.logout();
  };

  const gearButton = (
    <button
      type="button"
      onClick={openSettings}
      className={cn(
        "shrink-0 rounded p-1.5 text-muted-foreground/70",
        "transition-colors hover:bg-current/10 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/40",
      )}
      aria-label={settingsLabel}
      title={settingsLabel}
    >
      <Settings className="h-3.5 w-3.5" />
    </button>
  );

  // No logged-in identity (loopback / gate off / 401): keep the Settings
  // affordance in the footer anyway.
  const identityAbsent = !gated || hidden;
  if (identityAbsent || error || !me) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-2",
          "px-5 py-2",
          "border-t border-current/10",
          "text-[0.65rem] tracking-[0.05em]",
          className,
        )}
      >
        <span className="truncate text-muted-foreground/70">
          {error ?? (identityAbsent ? settingsLabel : "…")}
        </span>
        {gearButton}
      </div>
    );
  }

  // Prefer display_name → email → truncated user_id. Contract V1 only
  // populates user_id; the fallthroughs are forward-compat for a future
  // Portal that adds a userinfo endpoint (OQ-C1 in the plan).
  const label = me.display_name || me.email || truncateUserId(me.user_id);

  const menu = (() => {
    if (!menuOpen) return null;
    const rect = menuAnchor;
    if (!rect) return null;
    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        className="fixed z-[100] min-w-[11rem] border border-border bg-popover py-1 shadow-md"
        style={{ bottom: window.innerHeight - rect.top + 4, left: rect.left }}
      >
        <button
          type="button"
          role="menuitem"
          onClick={openSettings}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer",
            "font-sans text-display text-xs tracking-[0.08em]",
            "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="h-3 w-3 shrink-0" />
          <span className="truncate">{settingsLabel}</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer",
            "font-sans text-display text-xs tracking-[0.08em]",
            "text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <LogOut className="h-3 w-3 shrink-0" />
          <span className="truncate">{logOutLabel}</span>
        </button>
      </div>,
      document.body,
    );
  })();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2",
        "px-5 py-2",
        "border-t border-current/10",
        "text-[0.65rem] tracking-[0.05em]",
        className,
      )}
      role="status"
      aria-label={`Logged in as ${label}`}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          setMenuAnchor(e.currentTarget.getBoundingClientRect());
          setMenuOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn(
          "flex min-w-0 flex-col rounded px-1 py-0.5 text-left",
          "transition-colors hover:bg-current/10",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/40",
        )}
        title={me.user_id}
      >
        <span className="truncate font-mono text-foreground/90">{label}</span>
        <span className="truncate text-muted-foreground/70">
          via {me.provider}
        </span>
      </button>
      {gearButton}
      {menu}
    </div>
  );
}
