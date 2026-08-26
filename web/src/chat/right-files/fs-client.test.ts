// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetTestLocalStorage } from "../test-local-storage";
import { filterExcludedEntries } from "./excluded-paths";
import { readProjectDir } from "./fs-client";
import {
  filesPaneStorageKey,
  readFilesPaneOpen,
  writeFilesPaneOpen,
} from "./files-pane-state";

const listFsDir = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    listFsDir: (...args: unknown[]) => listFsDir(...args),
    readFsText: vi.fn(),
  },
}));

describe("excluded-paths", () => {
  it("drops always-excluded names", () => {
    const entries = [
      { name: "src", path: "/p/src" },
      { name: "node_modules", path: "/p/node_modules" },
      { name: ".git", path: "/p/.git" },
      { name: "README.md", path: "/p/README.md" },
    ];
    expect(filterExcludedEntries(entries).map((e) => e.name)).toEqual([
      "src",
      "README.md",
    ]);
  });
});

describe("files-pane-state", () => {
  beforeEach(() => {
    resetTestLocalStorage();
  });

  it("defaults to open when unset", () => {
    expect(readFilesPaneOpen("coder")).toBe(true);
  });

  it("persists open state per profile", () => {
    writeFilesPaneOpen(false, "coder");
    expect(readFilesPaneOpen("coder")).toBe(false);
    expect(readFilesPaneOpen("other")).toBe(true);
    expect(filesPaneStorageKey("coder")).toContain("coder");
  });
});

describe("readProjectDir", () => {
  beforeEach(() => {
    listFsDir.mockReset();
  });

  it("returns ENOENT for empty path without calling API", async () => {
    const result = await readProjectDir("  ");
    expect(result.error).toBe("ENOENT");
    expect(listFsDir).not.toHaveBeenCalled();
  });

  it("filters excluded entries from API response", async () => {
    listFsDir.mockResolvedValue({
      entries: [
        { name: "app", path: "/work/app", isDirectory: true },
        { name: "node_modules", path: "/work/node_modules", isDirectory: true },
        { name: "main.ts", path: "/work/main.ts", isDirectory: false },
      ],
    });
    const result = await readProjectDir("/work");
    expect(result.error).toBeUndefined();
    expect(result.entries.map((e) => e.name)).toEqual(["app", "main.ts"]);
    expect(listFsDir).toHaveBeenCalledWith("/work");
  });

  it("propagates API error field", async () => {
    listFsDir.mockResolvedValue({ entries: [], error: "EACCES" });
    const result = await readProjectDir("/secret");
    expect(result.entries).toEqual([]);
    expect(result.error).toBe("EACCES");
  });

  it("maps thrown fetch errors", async () => {
    listFsDir.mockRejectedValue(new Error("network down"));
    const result = await readProjectDir("/work");
    expect(result.error).toBe("network down");
  });
});
