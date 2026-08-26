import { describe, expect, it } from "vitest";

import {
  isSteerableEntry,
  makeQueuedEntry,
  queuePreview,
} from "./composer-queue";

describe("composer-queue", () => {
  it("builds entries with ids", () => {
    const entry = makeQueuedEntry({ text: "hello", displayText: "hello" });
    expect(entry.id).toMatch(/^q-/);
    expect(entry.text).toBe("hello");
  });

  it("marks slash and attachment entries non-steerable", () => {
    expect(
      isSteerableEntry(makeQueuedEntry({ text: "/help" })),
    ).toBe(false);
    expect(
      isSteerableEntry(
        makeQueuedEntry({
          text: "hi",
          attachments: [
            {
              id: "1",
              occurrenceId: "o1",
              kind: "image",
              label: "a.png",
            },
          ],
        }),
      ),
    ).toBe(false);
    expect(isSteerableEntry(makeQueuedEntry({ text: "steer me" }))).toBe(
      true,
    );
  });

  it("previews attachment-only entries", () => {
    expect(
      queuePreview(
        makeQueuedEntry({
          text: "",
          attachments: [
            {
              id: "1",
              occurrenceId: "o1",
              kind: "file",
              label: "a.ts",
            },
          ],
        }),
      ),
    ).toBe("1 attachment");
  });
});
