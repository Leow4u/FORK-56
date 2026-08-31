// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";
import type { McpCatalogEntry, McpServer } from "@/lib/api";

function catalogEntry(
  overrides: Partial<McpCatalogEntry> & Pick<McpCatalogEntry, "name" | "auth_type">,
): McpCatalogEntry {
  return {
    description: `${overrides.name} catalog entry`,
    source: "official",
    transport: "http",
    required_env: [],
    command: null,
    args: [],
    url: `https://mcp.example.com/${overrides.name}`,
    install_url: null,
    install_ref: null,
    bootstrap: [],
    default_enabled: null,
    post_install: "",
    needs_install: false,
    installed: false,
    enabled: false,
    ...overrides,
  };
}

const apiMocks = vi.hoisted(() => ({
  getMcpServers: vi.fn(async () => ({ servers: [] as McpServer[] })),
  getMcpCatalog: vi.fn(async () => ({
    entries: [] as McpCatalogEntry[],
    diagnostics: [],
  })),
  installMcpCatalogEntry: vi.fn(),
  addMcpServer: vi.fn(),
  authMcpServer: vi.fn(),
  getMcpOAuthFlow: vi.fn(),
  removeMcpServer: vi.fn(),
  testMcpServer: vi.fn(),
  setMcpServerEnabled: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setAfterTitle: vi.fn(), setEnd: vi.fn() }),
}));

let container: HTMLDivElement;
let root: Root;

async function renderPage(embedded = true) {
  const { default: McpPage } = await import("./McpPage");
  act(() => {
    root.render(<McpPage embedded={embedded} />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickButton(label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((el) =>
    (el.textContent ?? "").includes(label),
  );
  expect(button, `button "${label}"`).toBeTruthy();
  act(() => {
    button!.click();
  });
}

describe("McpPage directory", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    resetTestLocalStorage();
    apiMocks.getMcpServers.mockReset();
    apiMocks.getMcpCatalog.mockReset();
    apiMocks.getMcpServers.mockResolvedValue({ servers: [] });
    apiMocks.getMcpCatalog.mockResolvedValue({
      entries: [
        catalogEntry({
          name: "gmail",
          auth_type: "oauth",
          description: "Read and send Gmail",
        }),
        catalogEntry({
          name: "filesystem",
          auth_type: "none",
          transport: "stdio",
          command: "npx",
          url: null,
          description: "Local files over stdio",
        }),
      ],
      diagnostics: [],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows catalog cards when no servers are configured", async () => {
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("Gmail");
    expect(text).toContain("Read and send Gmail");
    expect(text).toContain("Filesystem");
    expect(text).not.toContain("No MCP servers configured");
    expect(text).toContain("Connect");
    expect(text).toContain("Install");
  });

  it("labels OAuth catalog entries Connect and others Install", async () => {
    await renderPage();
    const cards = Array.from(container.querySelectorAll("button"));
    const gmailConnect = cards.find(
      (el) =>
        el.textContent?.trim() === "Connect" &&
        el.closest("div")?.textContent?.includes("Gmail"),
    );
    const filesystemInstall = cards.find(
      (el) =>
        el.textContent?.trim() === "Install" &&
        el.closest("div")?.textContent?.includes("Filesystem"),
    );
    expect(gmailConnect).toBeTruthy();
    expect(filesystemInstall).toBeTruthy();
  });

  it("hides the catalog under Connected when the fleet is empty", async () => {
    await renderPage();
    clickButton("Connected");
    const text = container.textContent ?? "";
    expect(text).toContain("No MCP servers configured");
    expect(text).not.toContain("Read and send Gmail");
  });

  it("filters catalog cards by name and description", async () => {
    await renderPage();
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, "gmail");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Gmail");
    expect(text).not.toContain("Filesystem");
  });

  it("keeps connected servers visible next to leftover catalog entries", async () => {
    apiMocks.getMcpServers.mockResolvedValue({
      servers: [
        {
          name: "linear",
          transport: "http",
          url: "https://mcp.linear.app/mcp",
          command: null,
          args: [],
          env: {},
          auth: "oauth",
          enabled: true,
          tools: null,
        },
      ],
    });
    apiMocks.getMcpCatalog.mockResolvedValue({
      entries: [
        catalogEntry({
          name: "linear",
          auth_type: "oauth",
          installed: true,
          enabled: true,
          description: "Linear issues and projects",
        }),
        catalogEntry({
          name: "gmail",
          auth_type: "oauth",
          description: "Read and send Gmail",
        }),
      ],
      diagnostics: [],
    });
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("Linear");
    expect(text).toContain("Linear issues and projects");
    expect(text).toContain("Gmail");
    expect(text).toContain("Connect");
  });
});
