// @vitest-environment jsdom
import { fireEvent } from "@testing-library/dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "@/chat/test-local-storage";
import { SystemActionsProvider } from "@/contexts/SystemActions";
import { I18nProvider } from "@/i18n/context";

const apiMocks = vi.hoisted(() => ({
  getMessagingPlatforms: vi.fn(async () => ({
    env_path: "~/.work4you/.env",
    gateway_start_command: "work4you gateway start",
    platforms: [
      {
        id: "slack",
        name: "Slack",
        description: "Workspace bot",
        docs_url: "",
        enabled: true,
        configured: true,
        gateway_running: true,
        state: "connected",
        error_code: null,
        error_message: null,
        updated_at: null,
        home_channel: null,
        env_vars: [],
      },
    ],
  })),
  getPairing: vi.fn(async () => ({
    pending: [
      {
        platform: "telegram",
        user_id: "7712345",
        user_name: "Bee",
        request_id: "aaaaaaaaaaaaaaaa",
      },
    ],
    approved: [],
  })),
  updateMessagingPlatform: vi.fn(async () => ({ ok: true })),
  restartGateway: vi.fn(async () => ({
    ok: true,
    name: "gateway-restart",
    pid: 1,
  })),
  getActionStatus: vi.fn(async () => ({
    running: false,
    exit_code: 0,
    lines: [],
    name: "gateway-restart",
    pid: 1,
  })),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@/contexts/usePageHeader", () => ({
  usePageHeader: () => ({ setAfterTitle: vi.fn(), setEnd: vi.fn() }),
}));

vi.mock("@/pages/PairingPage", () => ({
  default: ({ embedded }: { embedded?: boolean }) => (
    <div data-testid="pairing-page" data-embedded={String(Boolean(embedded))}>
      pairing requests
    </div>
  ),
}));

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <span data-testid="location">{`${pathname}${search}`}</span>;
}

let container: HTMLDivElement;
let root: Root;

async function renderPage(path = "/channels") {
  const { default: ChannelsPage } = await import("./ChannelsPage");
  act(() => {
    root.render(
      <I18nProvider>
        <SystemActionsProvider>
          <MemoryRouter initialEntries={[path]}>
            <ChannelsPage />
            <LocationProbe />
          </MemoryRouter>
        </SystemActionsProvider>
      </I18nProvider>,
    );
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ChannelsPage (Messaging)", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    resetTestLocalStorage();
    localStorage.clear();
    apiMocks.getMessagingPlatforms.mockClear();
    apiMocks.getPairing.mockClear();
    apiMocks.updateMessagingPlatform.mockClear();
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

  it("defaults to the Channels tab with the existing platform list", async () => {
    await renderPage();
    const text = container.textContent ?? "";
    expect(text).toContain("Slack");
    expect(text).toContain("Workspace bot");
    expect(text).toContain("Channels");
    expect(text).toContain("Pairing (1)");
    expect(container.querySelector('[data-testid="pairing-page"]')).toBeNull();
  });

  it("renders the embedded Pairing page under ?tab=pairing", async () => {
    await renderPage("/channels?tab=pairing");
    const pairing = container.querySelector('[data-testid="pairing-page"]');
    expect(pairing).toBeTruthy();
    expect(pairing?.getAttribute("data-embedded")).toBe("true");
    expect(container.textContent ?? "").not.toContain("Workspace bot");
  });

  it("shows Graph webhook hint plus the catalog env fields", async () => {
    apiMocks.getMessagingPlatforms.mockResolvedValueOnce({
      env_path: "~/.work4you/.env",
      gateway_start_command: "work4you gateway start",
      platforms: [
        {
          id: "msgraph_webhook",
          name: "Microsoft Graph Webhook",
          description: "Receive Microsoft Graph change notifications.",
          docs_url: "https://work4you.ai/docs/user-guide/messaging/msgraph-webhook",
          enabled: false,
          configured: false,
          gateway_running: false,
          state: "disabled",
          error_code: null,
          error_message: null,
          updated_at: null,
          home_channel: null,
          env_vars: [
            {
              key: "MSGRAPH_WEBHOOK_CLIENT_STATE",
              prompt: "Graph clientState secret",
              required: true,
              is_set: false,
              is_password: true,
              description: "",
              help: null,
              redacted_value: null,
            },
            {
              key: "MSGRAPH_WEBHOOK_HOST",
              prompt: "Graph webhook bind host",
              required: false,
              is_set: false,
              is_password: false,
              description: "",
              help: null,
              redacted_value: null,
            },
            {
              key: "MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS",
              prompt: "Allowed source CIDRs",
              required: false,
              is_set: false,
              is_password: false,
              description: "",
              help: null,
              redacted_value: null,
            },
            {
              key: "MSGRAPH_WEBHOOK_PUBLIC_URL",
              prompt: "Public HTTPS origin",
              required: false,
              is_set: false,
              is_password: false,
              description: "",
              help: null,
              redacted_value: null,
            },
          ],
        },
      ],
    });

    await renderPage();
    expect(container.textContent ?? "").toContain("Microsoft Graph Webhook");

    const configure = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Configure"),
    );
    expect(configure).toBeTruthy();
    await act(async () => {
      configure?.click();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("Inbound listener only");
    expect(text).toContain("Generate secret");
    expect(text).toContain("Bind localhost");
    expect(text).toContain("/msgraph/webhook");
    expect(text).toContain("Graph clientState secret");
    expect(text).toContain("Allowed source CIDRs");
    expect(text).toContain("Public HTTPS origin");
    expect(text).not.toContain("MSGRAPH_WEBHOOK_ENABLED");
    expect(text).not.toContain("MSGRAPH_TENANT_ID");
  });

  it("shows the Teams hint with the messaging endpoint and its warnings", async () => {
    apiMocks.getMessagingPlatforms.mockResolvedValueOnce({
      env_path: "~/.work4you/.env",
      gateway_start_command: "work4you gateway start",
      platforms: [
        {
          id: "teams",
          name: "Microsoft Teams",
          description: "Connect Work4You to Microsoft Teams chats via the Bot Framework.",
          docs_url: "https://work4you.ai/docs/user-guide/messaging/teams",
          enabled: false,
          configured: false,
          gateway_running: false,
          state: "disabled",
          error_code: null,
          error_message: null,
          updated_at: null,
          home_channel: null,
          env_vars: [
            {
              key: "TEAMS_CLIENT_ID",
              prompt: "Application (client) ID",
              required: true,
              is_set: false,
              is_password: false,
              description: "",
              help: null,
              redacted_value: null,
            },
            {
              key: "TEAMS_PUBLIC_URL",
              prompt: "Public HTTPS origin",
              required: false,
              is_set: false,
              is_password: false,
              description: "",
              help: null,
              redacted_value: null,
            },
          ],
        },
      ],
    });

    await renderPage();

    const configure = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Configure"),
    );
    await act(async () => {
      configure?.click();
    });

    const text = container.textContent ?? "";
    expect(text).toContain("The Teams chat bot");
    // The endpoint falls back to the local bind until a public origin is set,
    // and that fallback is exactly what Teams cannot reach.
    expect(text).toContain("http://127.0.0.1:3978/api/messages");
    expect(text).toContain("Copy endpoint");
    expect(text).toContain("which Teams cannot reach");
    expect(text).toContain("anyone who can find the bot in your tenant");
    expect(text).toContain("Application (client) ID");
  });

  it("shows the WhatsApp Cloud API hint with the callback URL, its warnings, and a verify token generator", async () => {
    const envVar = (key: string, prompt: string, required = false, isPassword = false) => ({
      key,
      prompt,
      required,
      is_set: false,
      is_password: isPassword,
      description: "",
      help: null,
      redacted_value: null,
    });
    apiMocks.getMessagingPlatforms.mockResolvedValueOnce({
      env_path: "~/.work4you/.env",
      gateway_start_command: "work4you gateway start",
      platforms: [
        {
          id: "whatsapp_cloud",
          name: "WhatsApp Cloud API",
          description: "Meta's official WhatsApp Business Cloud API.",
          docs_url: "https://work4you.ai/docs/user-guide/messaging/whatsapp-cloud",
          enabled: false,
          configured: false,
          gateway_running: false,
          state: "disabled",
          error_code: null,
          error_message: null,
          updated_at: null,
          home_channel: null,
          env_vars: [
            envVar("WHATSAPP_CLOUD_PHONE_NUMBER_ID", "Phone number ID", true),
            envVar("WHATSAPP_CLOUD_ACCESS_TOKEN", "Access token", true, true),
            envVar("WHATSAPP_CLOUD_VERIFY_TOKEN", "Webhook verify token", false, true),
            envVar("WHATSAPP_CLOUD_PUBLIC_URL", "Public HTTPS origin (or empty)"),
          ],
        },
      ],
    });

    await renderPage();

    const configure = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Configure"),
    );
    await act(async () => {
      configure?.click();
    });

    let text = container.textContent ?? "";
    expect(text).toContain("official WhatsApp Business API");
    // The callback falls back to the local bind until a public origin is set,
    // and that fallback is exactly what Meta cannot reach.
    expect(text).toContain("http://127.0.0.1:8090/whatsapp/webhook");
    expect(text).toContain("Copy callback URL");
    expect(text).toContain("which Meta cannot reach");
    expect(text).toContain("anyone who messages your business number");
    expect(text).toContain("Phone number ID");

    // Generate fills the (password) verify token field with a 64-hex secret.
    const generate = Array.from(container.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Generate verify token"),
    );
    expect(generate).toBeTruthy();
    await act(async () => {
      generate?.click();
    });
    const verifyInput = container.querySelector<HTMLInputElement>("#field-WHATSAPP_CLOUD_VERIFY_TOKEN");
    expect(verifyInput?.value).toMatch(/^[0-9a-f]{64}$/);

    // A public origin swaps the callback to the tunnel and clears the warning.
    const publicUrlInput = container.querySelector<HTMLInputElement>("#field-WHATSAPP_CLOUD_PUBLIC_URL");
    expect(publicUrlInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(publicUrlInput as HTMLInputElement, { target: { value: "https://tunnel.example/" } });
    });
    text = container.textContent ?? "";
    expect(text).toContain("https://tunnel.example/whatsapp/webhook");
    expect(text).not.toContain("which Meta cannot reach");

    // Saving with a phone *number* pasted into the Phone number ID is refused
    // with the specific hint, and the API is never called.
    const tokenInput = container.querySelector<HTMLInputElement>("#field-WHATSAPP_CLOUD_ACCESS_TOKEN");
    const phoneInput = container.querySelector<HTMLInputElement>("#field-WHATSAPP_CLOUD_PHONE_NUMBER_ID");
    await act(async () => {
      fireEvent.change(tokenInput as HTMLInputElement, { target: { value: `EAA${"x".repeat(120)}` } });
      fireEvent.change(phoneInput as HTMLInputElement, { target: { value: "15551234567" } });
    });
    const save = Array.from(container.querySelectorAll("button")).find((button) =>
      /Save/.test(button.textContent ?? ""),
    );
    expect(save).toBeTruthy();
    await act(async () => {
      save?.click();
    });
    text = container.textContent ?? "";
    expect(text).toContain("looks like the phone number itself");
    expect(apiMocks.updateMessagingPlatform).not.toHaveBeenCalled();
  });
});
