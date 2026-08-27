/** Web shim — edit-in-place uses a plain textarea; focus bus is a no-op. */

export type ComposerTarget = "edit" | "main" | (string & {});
export type ComposerInsertMode = "block" | "inline" | "prefix";

export function requestComposerFocus(_target?: ComposerTarget) {}
export function requestComposerInsert(
  _text: string,
  _opts?: { target?: ComposerTarget; mode?: ComposerInsertMode },
) {}
export function requestComposerSubmit(_text: string) {}
export function focusComposerInput(_target?: ComposerTarget) {}
export function markActiveComposer(_target: ComposerTarget) {}
export function releaseActiveComposer(_target: ComposerTarget) {}

export function onComposerFocusRequest(
  _handler: (detail: { target: ComposerTarget; typeChar?: string }) => void,
): () => void {
  return () => {};
}

export function onComposerInsertRequest(
  _handler: (detail: {
    target: ComposerTarget;
    text: string;
    mode: ComposerInsertMode;
  }) => void,
): () => void {
  return () => {};
}
