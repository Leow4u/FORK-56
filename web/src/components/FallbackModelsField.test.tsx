// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getModelOptions: vi.fn(async () => ({
    providers: [
      {
        name: "GitHub Copilot",
        slug: "copilot",
        models: ["gpt-5-mini", "gpt-5.4-mini"],
      },
      {
        name: "OpenAI Codex",
        slug: "openai-codex",
        models: ["gpt-5.4-mini"],
      },
      { name: "Work4You", slug: "work4you", models: ["work4you-4"] },
    ],
  })),
}));

vi.mock("@/lib/api", () => ({ api: apiMocks }));

vi.mock("@work4you/ui/ui/components/spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

let container: HTMLDivElement;
let root: Root;

const CHAIN = [
  { provider: "copilot", model: "gpt-5-mini" },
  { provider: "openai-codex", model: "gpt-5.4-mini" },
];

async function renderField(value: unknown, onChange = vi.fn()) {
  const { FallbackModelsField } = await import("./FallbackModelsField");
  act(() => {
    root.render(<FallbackModelsField value={value} onChange={onChange} />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return onChange;
}

describe("normalizeFallbackEntries", () => {
  it("parses {provider, model} objects", async () => {
    const { normalizeFallbackEntries } = await import("./FallbackModelsField");
    expect(
      normalizeFallbackEntries([
        { provider: "copilot", model: "gpt-5-mini" },
      ]),
    ).toEqual([{ provider: "copilot", model: "gpt-5-mini" }]);
  });

  it("parses legacy provider/model strings", async () => {
    const { normalizeFallbackEntries } = await import("./FallbackModelsField");
    expect(normalizeFallbackEntries(["openrouter/llama-3"])).toEqual([
      { provider: "openrouter", model: "llama-3" },
    ]);
  });
});

describe("FallbackModelsField", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    apiMocks.getModelOptions.mockClear();
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

  it("renders each entry as its own row (never \"[object Object]\")", async () => {
    await renderField(CHAIN);

    expect(container.querySelectorAll('[aria-label="Remove"]')).toHaveLength(2);
    expect(container.textContent).toContain("Add fallback");
    expect(container.textContent).not.toContain("[object Object]");
    expect(apiMocks.getModelOptions).toHaveBeenCalled();
  });

  it("shows an empty-state hint when there are no fallbacks", async () => {
    await renderField([]);

    expect(container.textContent).toMatch(/No fallback models/);
    expect(container.querySelectorAll('[aria-label="Remove"]')).toHaveLength(0);
  });

  it("removing a row emits the remaining entries", async () => {
    const onChange = await renderField(CHAIN);
    const removeButtons = container.querySelectorAll('[aria-label="Remove"]');
    act(() => {
      (removeButtons[0] as HTMLButtonElement).click();
    });

    expect(onChange.mock.calls.at(-1)?.[0]).toEqual([
      { provider: "openai-codex", model: "gpt-5.4-mini" },
    ]);
  });

  it("adding a blank row does not persist a partial entry", async () => {
    const onChange = await renderField(CHAIN);
    const addButton = [...container.querySelectorAll("button")].find((btn) =>
      btn.textContent?.includes("Add fallback"),
    );
    expect(addButton).toBeTruthy();

    act(() => {
      addButton!.click();
    });

    expect(onChange.mock.calls.at(-1)?.[0]).toEqual(CHAIN);
    expect(container.querySelectorAll('[aria-label="Remove"]')).toHaveLength(3);
  });
});
