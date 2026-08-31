import { describe, expect, it } from "vitest";

import { resolveTranslations } from "@/i18n/resolve";

import { resolvePageTitle } from "./resolve-page-title";

describe("resolvePageTitle", () => {
  const t = resolveTranslations("en");

  it("keeps Chat as the session surface name and Artifacts/Scheduled jobs as destinations", () => {
    expect(resolvePageTitle("/chat", t, [])).toBe("Chat");
    expect(resolvePageTitle("/artifacts", t, [])).toBe("Artifacts");
    expect(resolvePageTitle("/cron", t, [])).toBe("Scheduled jobs");
    expect(resolvePageTitle("/skills", t, [])).toBe("Capabilities");
    expect(resolvePageTitle("/channels", t, [])).toBe("Messaging");
    expect(resolvePageTitle("/agents", t, [])).toBe("Agents");
    expect(resolvePageTitle("/starmap", t, [])).toBe("Memory Graph");
  });
});
