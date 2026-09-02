import { describe, expect, it } from "vitest";

import {
  directoryAppLogoUrl,
  filterDirectoryApps,
  groupDirectorySections,
  isTrustedComposioLogoUrl,
  mcpCatalogPrimaryAction,
  mcpDirectoryQueryHit,
  mcpDirectoryShowsAvailable,
  mcpDirectoryShowsConnected,
  type DirectoryApp,
} from "@work4you/shared";

function app(
  partial: Partial<DirectoryApp> & Pick<DirectoryApp, "id" | "name" | "source">,
): DirectoryApp {
  return {
    description: `${partial.name} app`,
    section: "email",
    popular: false,
    connected: false,
    auth_type: "oauth",
    ...partial,
  };
}

describe("mcpDirectoryQueryHit", () => {
  it("matches any field case-insensitively", () => {
    expect(mcpDirectoryQueryHit(["Notion", "pages and databases"], "notion")).toBe(
      true,
    );
    expect(mcpDirectoryQueryHit(["Notion", "pages and databases"], "PAGES")).toBe(
      true,
    );
    expect(mcpDirectoryQueryHit(["Notion", "pages and databases"], "stripe")).toBe(
      false,
    );
  });

  it("treats an empty query as a match", () => {
    expect(mcpDirectoryQueryHit(["Notion"], "  ")).toBe(true);
    expect(mcpDirectoryQueryHit([null, undefined], "")).toBe(true);
  });
});

describe("mcpDirectoryShowsConnected / available", () => {
  it("all and discover show both", () => {
    expect(mcpDirectoryShowsConnected("all")).toBe(true);
    expect(mcpDirectoryShowsAvailable("all")).toBe(true);
    expect(mcpDirectoryShowsConnected("discover")).toBe(true);
    expect(mcpDirectoryShowsAvailable("discover")).toBe(true);
  });

  it("connected hides the catalog section", () => {
    expect(mcpDirectoryShowsConnected("connected")).toBe(true);
    expect(mcpDirectoryShowsAvailable("connected")).toBe(false);
  });

  it("available hides the installed section", () => {
    expect(mcpDirectoryShowsConnected("available")).toBe(false);
    expect(mcpDirectoryShowsAvailable("available")).toBe(true);
  });
});

describe("mcpCatalogPrimaryAction", () => {
  it("labels oauth catalog entries Connect and everything else Install", () => {
    expect(mcpCatalogPrimaryAction("oauth")).toBe("connect");
    expect(mcpCatalogPrimaryAction("api_key")).toBe("install");
    expect(mcpCatalogPrimaryAction(undefined)).toBe("install");
  });
});

describe("filterDirectoryApps", () => {
  it("never surfaces work4you_apps", () => {
    const visible = filterDirectoryApps(
      [
        app({ id: "gmail", name: "Gmail", source: "composio" }),
        app({ id: "work4you_apps", name: "Apps", source: "native", connected: true }),
      ],
      { filter: "all", query: "", section: null },
    );
    expect(visible.map((row) => row.id)).toEqual(["gmail"]);
  });
});

describe("groupDirectorySections", () => {
  it("lists Popular and the type section for the same app", () => {
    const groups = groupDirectorySections([
      app({ id: "slack", name: "Slack", source: "composio", popular: true, section: "communication" }),
    ]);
    expect(groups.map((group) => group.id)).toEqual(["popular", "communication"]);
  });
});

describe("directoryAppLogoUrl", () => {
  it("uses the Composio CDN for catalog rows and never for custom MCP", () => {
    expect(directoryAppLogoUrl({ id: "gmail", source: "composio" })).toBe(
      "https://logos.composio.dev/api/gmail",
    );
    expect(directoryAppLogoUrl({ id: "n8n", source: "native" })).toBe(
      "https://logos.composio.dev/api/n8n",
    );
    expect(
      directoryAppLogoUrl({
        id: "gmail",
        source: "native",
        logo: "https://logos.composio.dev/api/gmail",
      }),
    ).toBe("https://logos.composio.dev/api/gmail");
    expect(
      directoryAppLogoUrl({
        id: "my-box",
        source: "custom",
        logo: "https://logos.composio.dev/api/gmail",
      }),
    ).toBeNull();
    expect(isTrustedComposioLogoUrl("https://evil.example/x.png")).toBe(false);
  });
});
