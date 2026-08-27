import { describe, expect, it } from "vitest";
import { showEnvAdminNav } from "./env-admin-nav";

describe("showEnvAdminNav", () => {
  it("hides Keys from sidebar unless show_env_admin is true", () => {
    expect(showEnvAdminNav(null)).toBe(false);
    expect(showEnvAdminNav(undefined)).toBe(false);
    expect(showEnvAdminNav({ show_env_admin: false })).toBe(false);
    expect(showEnvAdminNav({ show_env_admin: true })).toBe(true);
  });
});
