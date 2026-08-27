/** Web shim — no Electron multi-window surface. */

export function isSecondaryWindow(): boolean {
  return false;
}

export function isWatchWindow(): boolean {
  return false;
}

export function isAuxiliaryWindow(): boolean {
  return false;
}

export function openSessionInNewWindow(_sessionId: string): void {
  // Browser: resume via /chat?resume= instead.
}
