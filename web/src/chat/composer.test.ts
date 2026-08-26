import { describe, expect, it } from "vitest";

import {
  attachmentId,
  buildPromptTextFromAttachments,
  createOccurrenceId,
  friendlyAttachError,
  isImageFilename,
  pathLabel,
  removeAttachmentOccurrences,
  upsertAttachment,
  type ThinComposerAttachment,
} from "./attachments";
import { resolveComposerBusyAction } from "./composer";

describe("resolveComposerBusyAction", () => {
  it("returns send when idle", () => {
    expect(resolveComposerBusyAction(false, "hello")).toBe("send");
  });

  it("returns stop when busy and empty", () => {
    expect(resolveComposerBusyAction(true, "   ")).toBe("stop");
  });

  it("returns steer when busy with plain text", () => {
    expect(resolveComposerBusyAction(true, "fix the bug")).toBe("steer");
  });

  it("returns queue when busy with slash command", () => {
    expect(resolveComposerBusyAction(true, "/help")).toBe("queue");
  });

  it("returns queue when busy with attachments even with plain text", () => {
    expect(resolveComposerBusyAction(true, "look", true)).toBe("queue");
  });

  it("returns queue when busy with attachments and empty text", () => {
    expect(resolveComposerBusyAction(true, "", true)).toBe("queue");
  });

  it("returns queue when busy with a blocking approval/sudo/secret prompt", () => {
    expect(resolveComposerBusyAction(true, "continue", false, true)).toBe(
      "queue",
    );
  });
});

describe("attachments helpers", () => {
  it("detects image filenames", () => {
    expect(isImageFilename("a.PNG")).toBe(true);
    expect(isImageFilename("notes.txt")).toBe(false);
  });

  it("builds prompt text with refs and image-only default", () => {
    const image: ThinComposerAttachment = {
      id: attachmentId("image", "x"),
      occurrenceId: createOccurrenceId(),
      kind: "image",
      label: "x.png",
    };
    expect(buildPromptTextFromAttachments("", [image])).toBe(
      "What do you see in this image?",
    );

    const file: ThinComposerAttachment = {
      id: attachmentId("file", "a"),
      occurrenceId: createOccurrenceId(),
      kind: "file",
      label: "a.ts",
      refText: "@file:`a.ts`",
    };
    expect(buildPromptTextFromAttachments("please review", [file])).toBe(
      "@file:`a.ts`\n\nplease review",
    );
  });

  it("upserts and removes occurrences", () => {
    const a: ThinComposerAttachment = {
      id: "image:1",
      occurrenceId: "occ-1",
      kind: "image",
      label: "a.png",
    };
    const list = upsertAttachment([], a);
    expect(list).toHaveLength(1);
    const next = removeAttachmentOccurrences(list, [a]);
    expect(next).toHaveLength(0);
  });

  it("friendlyAttachError rewrites size caps", () => {
    const err = friendlyAttachError(
      new Error("image too large (30000000 bytes; limit 26214400 bytes)"),
      "photo.png",
    );
    expect(err.message).toContain("photo.png");
    expect(err.message).toContain("too large");
  });

  it("pathLabel returns basename", () => {
    expect(pathLabel("/tmp/foo/bar.txt")).toBe("bar.txt");
  });
});
