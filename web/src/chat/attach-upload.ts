import type { GatewayClient } from "@/lib/gatewayClient";

import {
  base64FromDataUrl,
  friendlyAttachError,
  pathLabel,
  type ThinComposerAttachment,
} from "./attachments";

export interface ImageAttachResponse {
  attached?: boolean;
  path?: string;
  message?: string;
  count?: number;
}

export interface FileAttachResponse {
  attached?: boolean;
  path?: string;
  ref_path?: string;
  ref_text?: string;
  uploaded?: boolean;
  message?: string;
  name?: string;
}

/**
 * Stage one composer attachment onto the live gateway session.
 * Web is always remote relative to the agent host → bytes upload path.
 */
export async function uploadThinAttachment(
  attachment: ThinComposerAttachment,
  opts: {
    gateway: GatewayClient;
    sessionId: string;
  },
): Promise<ThinComposerAttachment> {
  const { gateway, sessionId } = opts;
  const label = attachment.label || pathLabel(attachment.filename || "file");

  try {
    if (attachment.kind === "image") {
      const dataUrl = attachment.previewUrl;
      if (!dataUrl?.includes(";base64,")) {
        throw new Error(`Could not read ${label}`);
      }
      const contentBase64 = base64FromDataUrl(dataUrl);
      if (!contentBase64) {
        throw new Error(`Could not read ${label}`);
      }
      const filename =
        attachment.filename ||
        pathLabel(attachment.path || "") ||
        "image.png";

      const result = await gateway.request<ImageAttachResponse>(
        "image.attach_bytes",
        {
          session_id: sessionId,
          content_base64: contentBase64,
          filename,
        },
      );

      if (!result?.attached) {
        throw new Error(result?.message || `Could not attach ${label}`);
      }

      const attachedPath = result.path || attachment.path;
      return {
        ...attachment,
        attachedSessionId: sessionId,
        label: attachedPath ? pathLabel(attachedPath) : attachment.label,
        path: attachedPath,
        refText: attachedPath ? `@image:${attachedPath}` : attachment.refText,
        uploadState: undefined,
      };
    }

    if (attachment.kind === "file") {
      const dataUrl = attachment.previewUrl;
      if (!dataUrl?.includes(";base64,")) {
        throw new Error(`Could not read ${label}`);
      }

      const result = await gateway.request<FileAttachResponse>("file.attach", {
        name: attachment.filename || label,
        path: attachment.filename || label,
        session_id: sessionId,
        data_url: dataUrl,
      });

      if (!result?.attached || !result.ref_text) {
        throw new Error(result?.message || `Could not attach ${label}`);
      }

      return {
        ...attachment,
        attachedSessionId: sessionId,
        path: result.path,
        refText: result.ref_text,
        label: result.name || attachment.label,
        uploadState: undefined,
      };
    }

    // url — no staging; refText already set
    return { ...attachment, attachedSessionId: sessionId, uploadState: undefined };
  } catch (err) {
    throw friendlyAttachError(err, label);
  }
}

export async function syncAttachmentsForSubmit(
  attachments: readonly ThinComposerAttachment[],
  opts: {
    gateway: GatewayClient;
    sessionId: string;
    onProgress?: (next: ThinComposerAttachment) => void;
  },
): Promise<ThinComposerAttachment[]> {
  const out: ThinComposerAttachment[] = [];
  for (const attachment of attachments) {
    if (
      attachment.kind === "url" ||
      (attachment.attachedSessionId === opts.sessionId &&
        attachment.uploadState !== "error" &&
        (attachment.kind !== "file" || attachment.refText) &&
        (attachment.kind !== "image" || attachment.path))
    ) {
      out.push(attachment);
      continue;
    }

    const uploading = { ...attachment, uploadState: "uploading" as const };
    opts.onProgress?.(uploading);
    try {
      const staged = await uploadThinAttachment(attachment, opts);
      opts.onProgress?.(staged);
      out.push(staged);
    } catch (err) {
      const failed = { ...attachment, uploadState: "error" as const };
      opts.onProgress?.(failed);
      throw err;
    }
  }
  return out;
}

export async function detachImageIfNeeded(
  attachment: ThinComposerAttachment,
  opts: { gateway: GatewayClient; sessionId: string | null },
): Promise<void> {
  if (
    attachment.kind !== "image" ||
    !attachment.path ||
    !opts.sessionId ||
    attachment.attachedSessionId !== opts.sessionId
  ) {
    return;
  }
  try {
    await opts.gateway.request("image.detach", {
      session_id: opts.sessionId,
      path: attachment.path,
    });
  } catch {
    // Best-effort — chip is already gone locally.
  }
}
