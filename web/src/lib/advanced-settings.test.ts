// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import {
  clearsEnabledToolsets,
} from "@/lib/advanced-settings";

describe("advanced-settings", () => {
  it("clearsEnabledToolsets flags non-empty toolsets cleared to []", () => {
    expect(
      clearsEnabledToolsets(
        { toolsets: ["memory", "terminal"] },
        { toolsets: [] },
      ),
    ).toBe(true);
  });

  it("clearsEnabledToolsets ignores missing toolsets key on next config", () => {
    expect(
      clearsEnabledToolsets({ toolsets: ["memory"] }, { model: "x" }),
    ).toBe(false);
  });

  it("clearsEnabledToolsets ignores unrelated edits", () => {
    expect(
      clearsEnabledToolsets(
        { model: "a", toolsets: ["memory"] },
        { model: "b", toolsets: ["memory"] },
      ),
    ).toBe(false);
  });
});
