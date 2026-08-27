import { useCallback, useState } from "react";

import type { GatewayClient } from "@/lib/gatewayClient";

import {
  IMAGE_MAX_BYTES,
  attachmentId,
  createOccurrenceId,
  fileToDataUrl,
  isImageFile,
  makeImageThumbnail,
  pathLabel,
  removeAttachmentById,
  removeAttachmentOccurrences,
  upsertAttachment,
  type ThinComposerAttachment,
} from "./attachments";
import { detachImageIfNeeded } from "./attach-upload";

export interface UseComposerAttachmentsOptions {
  gateway: GatewayClient | null;
  sessionId: string | null;
  onError?: (message: string) => void;
  onInsertText?: (text: string) => void;
}

export function useComposerAttachments({
  gateway,
  sessionId,
  onError,
  onInsertText,
}: UseComposerAttachmentsOptions) {
  const [attachments, setAttachments] = useState<ThinComposerAttachment[]>([]);

  const report = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError],
  );

  const addAttachment = useCallback((attachment: ThinComposerAttachment) => {
    setAttachments((prev) => upsertAttachment(prev, attachment));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const removeSubmitted = useCallback(
    (submitted: readonly ThinComposerAttachment[]) => {
      setAttachments((prev) => removeAttachmentOccurrences(prev, submitted));
    },
    [],
  );

  const patchAttachment = useCallback((next: ThinComposerAttachment) => {
    setAttachments((prev) => upsertAttachment(prev, next));
  }, []);

  const removeAttachment = useCallback(
    async (id: string) => {
      let removed: ThinComposerAttachment | null = null;
      setAttachments((prev) => {
        const result = removeAttachmentById(prev, id);
        removed = result.removed;
        return result.next;
      });
      if (removed && gateway) {
        await detachImageIfNeeded(removed, { gateway, sessionId });
      }
    },
    [gateway, sessionId],
  );

  const attachBrowserFile = useCallback(
    async (file: File) => {
      if (file.size <= 0) {
        report("File is empty");
        return;
      }
      if (file.size > IMAGE_MAX_BYTES && isImageFile(file)) {
        report(`${file.name} is too large (max 25 MB).`);
        return;
      }
      // Non-image files: still enforce a generous client cap (same 25 MB for
      // remote upload comfort; gateway file.attach has its own limits).
      if (!isImageFile(file) && file.size > IMAGE_MAX_BYTES) {
        report(`${file.name} is too large (max 25 MB).`);
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        const label = pathLabel(file.name);
        if (isImageFile(file)) {
          const thumbnailUrl = await makeImageThumbnail(dataUrl);
          const value = `blob:${file.name}:${file.size}:${file.lastModified}`;
          addAttachment({
            id: attachmentId("image", value),
            occurrenceId: createOccurrenceId(),
            kind: "image",
            label,
            previewUrl: dataUrl,
            thumbnailUrl,
            filename: file.name,
          });
          return;
        }

        addAttachment({
          id: attachmentId("file", `blob:${file.name}:${file.size}:${file.lastModified}`),
          occurrenceId: createOccurrenceId(),
          kind: "file",
          label,
          previewUrl: dataUrl,
          filename: file.name,
        });
      } catch (err) {
        report(err instanceof Error ? err.message : "Could not read file");
      }
    },
    [addAttachment, report],
  );

  const attachFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        await attachBrowserFile(file);
      }
    },
    [attachBrowserFile],
  );

  const attachImages = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter(isImageFile);
      if (!list.length) {
        report("No images selected");
        return;
      }
      for (const file of list) {
        await attachBrowserFile(file);
      }
    },
    [attachBrowserFile, report],
  );

  const pasteClipboardImage = useCallback(async () => {
    try {
      if (!navigator.clipboard?.read) {
        report("Clipboard image paste is not available in this browser");
        return;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const ext = type.split("/")[1] || "png";
        const file = new File([blob], `clipboard.${ext}`, { type });
        await attachBrowserFile(file);
        return;
      }
      report("No image found on the clipboard");
    } catch (err) {
      report(
        err instanceof Error
          ? err.message
          : "Could not read clipboard (permission denied?)",
      );
    }
  }, [attachBrowserFile, report]);

  const addUrl = useCallback(
    (raw: string) => {
      let url = raw.trim();
      if (!url) return;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) {
        url = `https://${url}`;
      }
      try {
        // Validate
         
        new URL(url);
      } catch {
        report("Invalid URL");
        return;
      }
      const label = url.length > 48 ? `${url.slice(0, 45)}…` : url;
      addAttachment({
        id: attachmentId("url", url),
        occurrenceId: createOccurrenceId(),
        kind: "url",
        label,
        detail: url,
        refText: `@url:${url}`,
      });
    },
    [addAttachment, report],
  );

  const insertSnippet = useCallback(
    (text: string) => {
      onInsertText?.(text);
    },
    [onInsertText],
  );

  return {
    attachments,
    setAttachments,
    addAttachment,
    clearAttachments,
    removeSubmitted,
    patchAttachment,
    removeAttachment,
    attachFiles,
    attachImages,
    pasteClipboardImage,
    addUrl,
    insertSnippet,
    attachBrowserFile,
  };
}
