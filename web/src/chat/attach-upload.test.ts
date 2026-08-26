import { describe, expect, it, vi } from "vitest";

import { syncAttachmentsForSubmit, uploadThinAttachment } from "./attach-upload";
import type { ThinComposerAttachment } from "./attachments";
import type { GatewayClient } from "@/lib/gatewayClient";

function fakeGateway(handler: (method: string, params: unknown) => unknown): GatewayClient {
  return {
    request: vi.fn(async (method: string, params?: unknown) => handler(method, params)),
  } as unknown as GatewayClient;
}

describe("uploadThinAttachment", () => {
  it("uploads images via image.attach_bytes", async () => {
    const gw = fakeGateway((method) => {
      expect(method).toBe("image.attach_bytes");
      return { attached: true, path: "/opt/data/images/upload.png" };
    });

    const attachment: ThinComposerAttachment = {
      id: "image:1",
      occurrenceId: "o1",
      kind: "image",
      label: "shot.png",
      filename: "shot.png",
      previewUrl: "data:image/png;base64,aaaa",
    };

    const staged = await uploadThinAttachment(attachment, {
      gateway: gw,
      sessionId: "s1",
    });
    expect(staged.path).toBe("/opt/data/images/upload.png");
    expect(staged.refText).toBe("@image:/opt/data/images/upload.png");
    expect(staged.attachedSessionId).toBe("s1");
    expect(gw.request).toHaveBeenCalledWith("image.attach_bytes", {
      session_id: "s1",
      content_base64: "aaaa",
      filename: "shot.png",
    });
  });

  it("uploads files via file.attach with data_url", async () => {
    const gw = fakeGateway((method) => {
      expect(method).toBe("file.attach");
      return {
        attached: true,
        path: "/tmp/a.ts",
        ref_text: "@file:`a.ts`",
        name: "a.ts",
      };
    });

    const attachment: ThinComposerAttachment = {
      id: "file:1",
      occurrenceId: "o1",
      kind: "file",
      label: "a.ts",
      filename: "a.ts",
      previewUrl: "data:text/plain;base64,YmFy",
    };

    const staged = await uploadThinAttachment(attachment, {
      gateway: gw,
      sessionId: "s1",
    });
    expect(staged.refText).toBe("@file:`a.ts`");
  });

  it("passes url attachments through", async () => {
    const gw = fakeGateway(() => {
      throw new Error("should not call");
    });
    const attachment: ThinComposerAttachment = {
      id: "url:1",
      occurrenceId: "o1",
      kind: "url",
      label: "https://example.com",
      refText: "@url:https://example.com",
    };
    const staged = await uploadThinAttachment(attachment, {
      gateway: gw,
      sessionId: "s1",
    });
    expect(staged.refText).toBe("@url:https://example.com");
    expect(gw.request).not.toHaveBeenCalled();
  });
});

describe("syncAttachmentsForSubmit", () => {
  it("stages pending attachments in order", async () => {
    const calls: string[] = [];
    const gw = fakeGateway((method) => {
      calls.push(method);
      if (method === "image.attach_bytes") {
        return { attached: true, path: "/img.png" };
      }
      if (method === "file.attach") {
        return {
          attached: true,
          path: "/f.txt",
          ref_text: "@file:`f.txt`",
          name: "f.txt",
        };
      }
      return {};
    });

    const attachments: ThinComposerAttachment[] = [
      {
        id: "image:1",
        occurrenceId: "o1",
        kind: "image",
        label: "a.png",
        filename: "a.png",
        previewUrl: "data:image/png;base64,aa",
      },
      {
        id: "file:1",
        occurrenceId: "o2",
        kind: "file",
        label: "f.txt",
        filename: "f.txt",
        previewUrl: "data:text/plain;base64,Yg==",
      },
    ];

    const staged = await syncAttachmentsForSubmit(attachments, {
      gateway: gw,
      sessionId: "s1",
    });
    expect(calls).toEqual(["image.attach_bytes", "file.attach"]);
    expect(staged[0].path).toBe("/img.png");
    expect(staged[1].refText).toBe("@file:`f.txt`");
  });
});
