// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listReviewFiles } from "./git-client";

const gitRepoStatus = vi.fn();
const gitReviewList = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    gitRepoStatus: (...args: unknown[]) => gitRepoStatus(...args),
    gitReviewList: (...args: unknown[]) => gitReviewList(...args),
  },
}));

describe("listReviewFiles", () => {
  beforeEach(() => {
    gitRepoStatus.mockReset();
    gitReviewList.mockReset();
  });

  it("returns not-a-repo when status is null", async () => {
    gitRepoStatus.mockResolvedValue(null);
    const result = await listReviewFiles("/tmp/plain");
    expect(result.isRepo).toBe(false);
    expect(result.files).toEqual([]);
    expect(gitReviewList).not.toHaveBeenCalled();
  });

  it("filters excluded path segments", async () => {
    gitRepoStatus.mockResolvedValue({ branch: "main" });
    gitReviewList.mockResolvedValue({
      base: null,
      files: [
        { path: "src/a.ts", added: 1, removed: 0, status: "M", staged: false },
        {
          path: "node_modules/x/index.js",
          added: 10,
          removed: 0,
          status: "?",
          staged: false,
        },
      ],
    });
    const result = await listReviewFiles("/repo");
    expect(result.isRepo).toBe(true);
    expect(result.files.map((f) => f.path)).toEqual(["src/a.ts"]);
  });

  it("returns empty for blank cwd", async () => {
    const result = await listReviewFiles("  ");
    expect(result.isRepo).toBe(false);
    expect(gitRepoStatus).not.toHaveBeenCalled();
  });
});
