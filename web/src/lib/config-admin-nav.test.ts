import { describe, expect, it } from "vitest";

import { showConfigAdminNav } from "./config-admin-nav";

describe("Config admin nav gate", () => {
  it("hides Config from sidebar unless show_config_admin is true", () => {
    expect(showConfigAdminNav(undefined)).toBe(false);
    expect(showConfigAdminNav({})).toBe(false);
    expect(showConfigAdminNav({ show_config_admin: false })).toBe(false);
    expect(showConfigAdminNav({ show_config_admin: true })).toBe(true);
  });
});
