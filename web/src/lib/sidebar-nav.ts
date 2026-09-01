/**
 * Web sidebar user destinations.
 *
 * Same ids, order, paths, and verbs as Desktop `SIDEBAR_NAV`
 * (`apps/desktop/src/app/chat/sidebar/index.tsx`). Overlay / machine / auth
 * surfaces stay off this list: Settings (footer), Profiles (switcher link),
 * Webhooks (URL), operator admin (gated).
 */

export type SidebarNavAction = "new-session";

export interface UserSidebarNavSpec {
  action?: SidebarNavAction;
  id: string;
  label: string;
  labelKey: string;
  path: string;
}

export const WEB_USER_SIDEBAR_NAV: readonly UserSidebarNavSpec[] = [
  {
    id: "new-session",
    path: "/chat",
    labelKey: "newSession",
    label: "New session",
    action: "new-session",
  },
  {
    id: "skills",
    path: "/skills",
    labelKey: "skills",
    label: "Capabilities",
  },
  {
    id: "messaging",
    path: "/channels",
    labelKey: "messaging",
    label: "Messaging",
  },
  {
    id: "artifacts",
    path: "/artifacts",
    labelKey: "artifacts",
    label: "Artifacts",
  },
  {
    id: "cron",
    path: "/cron",
    labelKey: "cron",
    label: "Scheduled jobs",
  },
];

/** Still URL-reachable; not default sidebar destinations (Desktop overlays). */
export const WEB_OVERLAY_ROUTES_NOT_IN_NAV = [
  "/webhooks",
  "/profiles",
  "/settings",
  "/docs",
  "/agents",
  "/starmap",
] as const;

const SETTINGS_RETURN_STORAGE_KEY = "work4you.web.settingsReturn";

export function isSettingsPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === "/settings";
}

/** Stash the last non-Settings route so closing Settings returns there. */
export function rememberSettingsReturnPath(pathname: string, search = ""): void {
  if (typeof sessionStorage === "undefined") return;
  if (isSettingsPath(pathname)) return;
  try {
    sessionStorage.setItem(
      SETTINGS_RETURN_STORAGE_KEY,
      `${pathname}${search}` || "/chat",
    );
  } catch {
    /* private browsing */
  }
}

export function readSettingsReturnPath(fallback = "/chat"): string {
  if (typeof sessionStorage === "undefined") return fallback;
  try {
    const stored = sessionStorage.getItem(SETTINGS_RETURN_STORAGE_KEY);
    if (!stored) return fallback;
    const storedPath = stored.split("?")[0] ?? stored;
    if (isSettingsPath(storedPath)) return fallback;
    return stored;
  } catch {
    return fallback;
  }
}

export function isNewSessionNavItem(item: {
  action?: string;
}): item is { action: "new-session" } {
  return item.action === "new-session";
}

export function userSidebarNavForEmbeddedChat(
  embeddedChat: boolean,
): UserSidebarNavSpec[] {
  if (embeddedChat) {
    return [...WEB_USER_SIDEBAR_NAV];
  }
  return WEB_USER_SIDEBAR_NAV.filter((item) => !isNewSessionNavItem(item));
}
