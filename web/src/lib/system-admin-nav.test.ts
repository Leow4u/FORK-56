import { describe, expect, it } from "vitest";
import { showSystemAdminNav } from "./system-admin-nav";

describe("showSystemAdminNav", () => {
  it("hides System from sidebar unless show_system_admin is true", () => {
    expect(showSystemAdminNav(null)).toBe(false);
    expect(showSystemAdminNav(undefined)).toBe(false);
    expect(showSystemAdminNav({ show_system_admin: false })).toBe(false);
    expect(showSystemAdminNav({ show_system_admin: true })).toBe(true);
  });
});
