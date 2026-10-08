/** Minimized/occluded and visible-but-unfocused (Alt+Tab) both count as away. */
export function isWindowBackgrounded(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  return document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus())
}
