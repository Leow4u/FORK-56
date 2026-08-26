/** Thin-chat composer attachments — mirrors desktop ``ComposerAttachment``. */

export type ThinAttachmentKind = "file" | "image" | "url";

export interface ThinComposerAttachment {
  id: string;
  occurrenceId: string;
  kind: ThinAttachmentKind;
  label: string;
  detail?: string;
  /** Injected into prompt text (``@file:…`` / ``@url:…``). Images usually omit. */
  refText?: string;
  /** Full data URL used for remote ``attach_bytes`` / ``file.attach``. */
  previewUrl?: string;
  /** Downscaled data URL for chip thumbnails. */
  thumbnailUrl?: string;
  /** Gateway-staged path after successful attach. */
  path?: string;
  attachedSessionId?: string;
  uploadState?: "uploading" | "error";
  /** Original browser filename (for attach_bytes). */
  filename?: string;
}

export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;

const IMAGE_EXTENSION_PATTERN =
  /\.(png|jpe?g|gif|webp|bmp|tiff?|svg|ico)$/i;

const IMAGE_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export function isImageFilename(name: string): boolean {
  return IMAGE_EXTENSION_PATTERN.test(name);
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return isImageFilename(file.name);
}

export function attachmentId(kind: ThinAttachmentKind, value: string): string {
  return `${kind}:${value}`;
}

export function createOccurrenceId(): string {
  return crypto.randomUUID();
}

export function pathLabel(pathOrName: string): string {
  const parts = pathOrName.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || pathOrName || "file";
}

export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : "";
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/** Downscale image for chip thumbnail (keeps full ``previewUrl`` separate). */
export async function makeImageThumbnail(
  dataUrl: string,
  maxEdge = 96,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function extForImageFile(file: File): string {
  if (file.type && IMAGE_MIME_EXT[file.type]) {
    return IMAGE_MIME_EXT[file.type];
  }
  const m = file.name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] || "png").toLowerCase();
}

export function upsertAttachment(
  list: ThinComposerAttachment[],
  attachment: ThinComposerAttachment,
): ThinComposerAttachment[] {
  const idx = list.findIndex(
    (item) =>
      item.id === attachment.id &&
      (attachment.occurrenceId
        ? item.occurrenceId === attachment.occurrenceId
        : true),
  );
  if (idx < 0) return [...list, attachment];
  const next = list.slice();
  next[idx] = { ...next[idx], ...attachment };
  return next;
}

export function removeAttachmentById(
  list: ThinComposerAttachment[],
  id: string,
): { next: ThinComposerAttachment[]; removed: ThinComposerAttachment | null } {
  const removed = list.find((a) => a.id === id) ?? null;
  return {
    next: list.filter((a) => a.id !== id),
    removed,
  };
}

export function removeAttachmentOccurrences(
  list: ThinComposerAttachment[],
  submitted: readonly ThinComposerAttachment[],
): ThinComposerAttachment[] {
  const keys = new Set(
    submitted.map((a) => `${a.id}\0${a.occurrenceId}`),
  );
  return list.filter((a) => !keys.has(`${a.id}\0${a.occurrenceId}`));
}

export function buildPromptTextFromAttachments(
  visibleText: string,
  attachments: readonly ThinComposerAttachment[],
): string {
  const present = attachments.filter(Boolean);
  const contextRefs = present
    .map((a) => a.refText?.trim())
    .filter((r): r is string => Boolean(r));
  const joined =
    [contextRefs.join("\n"), visibleText.trim()].filter(Boolean).join("\n\n") ||
    (present.some((a) => a.kind === "image")
      ? "What do you see in this image?"
      : "");
  return joined;
}

export function friendlyAttachError(err: unknown, label: string): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/too large/i.test(message)) {
    const limitBytes = Number(message.match(/limit (\d+) bytes/)?.[1]);
    const cap =
      Number.isFinite(limitBytes) && limitBytes > 0
        ? ` (max ${Math.floor(limitBytes / (1024 * 1024))} MB)`
        : " (max 25 MB)";
    return new Error(`${label} is too large to upload${cap}.`);
  }
  return err instanceof Error ? err : new Error(message);
}

export const PROMPT_SNIPPETS = [
  {
    key: "codeReview",
    label: "Code review",
    text: "Review the relevant code for correctness, edge cases, and maintainability. Suggest concrete fixes.",
  },
  {
    key: "implementationPlan",
    label: "Implementation plan",
    text: "Propose a step-by-step implementation plan. Call out risks, dependencies, and verification.",
  },
  {
    key: "explainThis",
    label: "Explain this",
    text: "Explain the relevant code or concept clearly, including why it works this way.",
  },
] as const;
