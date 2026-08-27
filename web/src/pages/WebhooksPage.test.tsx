// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";

const headerEnd = vi.hoisted(() => ({ node: null as ReactNode }));

const apiMocks = vi.hoisted(() => ({
  getWebhooks: vi.fn(async () => ({
    enabled: true,
    base_url: "http://127.0.0.1:18790",
    subscriptions: [
      {
        name: "github-push",
        description: "Handle push events",
        events: ["push"],
        deliver: "telegram",
        deliver_only: false,
        prompt: "Summarize the push for the team",
        skills: ["github", "release-notes"],
        created_at: null,
        url: "http://127.0.0.1:18790/webhook/github-push",
        secret_set: true,
        enabled: true,
      },
    ],
  })),
  createWebhook: vi.fn(async () => ({
    url: "http://127.0.0.1:18790/webhook/new-hook",
    secret: "once-only-secret",
  })),
  enableWebhooks: vi.fn(),
  setWebhookEnabled: vi.fn(),
  deleteWebhook: vi.fn(),
  restartGateway: vi.fn(),
  getActionStatus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({
    setAfterTitle: vi.fn(),
    setEnd: (node: ReactNode) => {
      headerEnd.node = node;
    },
  }),
}));

let container: HTMLDivElement;
let root: Root;
let WebhooksPage: (typeof import("./WebhooksPage"))["default"];

async function renderPage() {
  if (!WebhooksPage) {
    ({ default: WebhooksPage } = await import("./WebhooksPage"));
  }
  act(() => {
    root.render(
      <>
        <div data-testid="page-header-end">{headerEnd.node}</div>
        <WebhooksPage />
      </>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setInputValue(el: HTMLInputElement, value: string) {
  const proto = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  proto?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function openCreateModal() {
  await renderPage();
  act(() => {
    root.render(
      <>
        <div data-testid="page-header-end">{headerEnd.node}</div>
        <WebhooksPage />
      </>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  const newBtn = Array.from(container.querySelectorAll("button")).find((btn) =>
    btn.textContent?.includes("New subscription"),
  );
  expect(newBtn).toBeTruthy();
  await act(async () => {
    newBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("WebhooksPage", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    resetTestLocalStorage();
    headerEnd.node = null;
    apiMocks.getWebhooks.mockClear();
    apiMocks.createWebhook.mockClear();
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

  it("paints skills and prompt already returned by GET", async () => {
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("github-push");
    expect(text).toContain("github");
    expect(text).toContain("release-notes");
    expect(text).toContain("Summarize the push for the team");
  });

  it("exposes the desktop Skills field on create", async () => {
    await openCreateModal();
    const skillsInput = container.querySelector("#webhook-skills");
    expect(skillsInput).toBeTruthy();
    expect(skillsInput?.getAttribute("placeholder")).toBe(
      "comma-separated skill names (optional)",
    );
    expect(container.textContent).toContain("Skills");
  });

  it("sends comma-split skills on createWebhook", async () => {
    await openCreateModal();
    const nameInput = container.querySelector("#webhook-name") as HTMLInputElement;
    const skillsInput = container.querySelector(
      "#webhook-skills",
    ) as HTMLInputElement;
    expect(nameInput).toBeTruthy();
    expect(skillsInput).toBeTruthy();

    await act(async () => {
      setInputValue(nameInput, "deploy-hook");
      setInputValue(skillsInput, "github, release-notes");
    });

    const createBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Create"),
    );
    expect(createBtn).toBeTruthy();
    await act(async () => {
      createBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(apiMocks.createWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "deploy-hook",
        skills: ["github", "release-notes"],
      }),
    );
  });
});
