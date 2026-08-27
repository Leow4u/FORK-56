import { atom } from "nanostores";

export interface ComposerAttachment {
  id: string;
  occurrenceId?: string;
  kind: "file" | "folder" | "image" | "review" | "terminal" | "url";
  label: string;
  detail?: string;
  refText?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  path?: string;
  attachedSessionId?: string;
  uploadState?: "uploading" | "error";
}

export type ComposerAttachmentScope = {
  list: ReturnType<typeof atom<ComposerAttachment[]>>;
  add: (item: ComposerAttachment) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const attachments = atom<ComposerAttachment[]>([]);

function makeScope(): ComposerAttachmentScope {
  return {
    list: attachments,
    add: (item) => attachments.set([...attachments.get(), item]),
    remove: (id) =>
      attachments.set(attachments.get().filter((a) => a.id !== id)),
    clear: () => attachments.set([]),
  };
}

export const mainComposerScope = makeScope();
export const $composerDraft = atom("");
export const $composerAttachments = atom<ComposerAttachment[]>([]);
