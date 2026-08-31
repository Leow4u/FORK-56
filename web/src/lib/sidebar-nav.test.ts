import { describe, expect, it } from "vitest";

import {
  WEB_OVERLAY_ROUTES_NOT_IN_NAV,
  WEB_USER_SIDEBAR_NAV,
  isNewSessionNavItem,
  userSidebarNavForEmbeddedChat,
} from "./sidebar-nav";

describe("web user sidebar nav", () => {
  it("matches the Desktop destinations, order, and New session verb", () => {
    expect(WEB_USER_SIDEBAR_NAV.map((item) => item.id)).toEqual([
      "new-session",
      "skills",
      "messaging",
      "artifacts",
      "cron",
    ]);
    expect(WEB_USER_SIDEBAR_NAV.map((item) => item.path)).toEqual([
      "/chat",
      "/skills",
      "/channels",
      "/artifacts",
      "/cron",
    ]);
    expect(WEB_USER_SIDEBAR_NAV.map((item) => item.label)).toEqual([
      "New session",
      "Capabilities",
      "Messaging",
      "Artifacts",
      "Scheduled jobs",
    ]);
    expect(isNewSessionNavItem(WEB_USER_SIDEBAR_NAV[0])).toBe(true);
    expect(WEB_USER_SIDEBAR_NAV.slice(1).every((item) => !item.action)).toBe(
      true,
    );
  });

  it("keeps overlay destinations off the default nav", () => {
    const paths = new Set(WEB_USER_SIDEBAR_NAV.map((item) => item.path));
    for (const path of WEB_OVERLAY_ROUTES_NOT_IN_NAV) {
      expect(paths.has(path)).toBe(false);
    }
    expect(WEB_OVERLAY_ROUTES_NOT_IN_NAV).toContain("/agents");
  });

  it("omits New session when embedded chat is off", () => {
    const items = userSidebarNavForEmbeddedChat(false);
    expect(items.some(isNewSessionNavItem)).toBe(false);
    expect(items.map((item) => item.id)).toEqual([
      "skills",
      "messaging",
      "artifacts",
      "cron",
    ]);
  });
});
