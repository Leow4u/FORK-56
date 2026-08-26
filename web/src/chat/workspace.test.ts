// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";

import {
  hasOpenWorkspace,
  readRememberedWorkspaceCwd,
  workspaceLabel,
  workspaceStorageKey,
  writeRememberedWorkspaceCwd,
} from "./workspace";

describe("workspace helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keys by profile", () => {
    expect(workspaceStorageKey("coder")).toContain("coder");
    expect(workspaceStorageKey(null)).toContain("default");
  });

  it("round-trips remembered cwd", () => {
    expect(readRememberedWorkspaceCwd("p")).toBeNull();
    writeRememberedWorkspaceCwd("/opt/data/repo", "p");
    expect(readRememberedWorkspaceCwd("p")).toBe("/opt/data/repo");
    writeRememberedWorkspaceCwd(null, "p");
    expect(readRememberedWorkspaceCwd("p")).toBeNull();
  });

  it("labels basename and empty state", () => {
    expect(workspaceLabel(null)).toBe("No project open");
    expect(workspaceLabel("/a/b/my-app")).toBe("my-app");
    expect(hasOpenWorkspace("/a")).toBe(true);
    expect(hasOpenWorkspace("")).toBe(false);
  });
});
