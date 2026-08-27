/** Web shim — read-aloud uses browser APIs in a follow-up; store state only. */

export async function playReadAloud(_messageId: string, _text: string): Promise<void> {
  return;
}

export async function playSpeechText(
  _text: string,
  _opts?: { messageId?: string; source?: string },
): Promise<void> {
  return;
}

export function stopReadAloud(): void {}

export function stopVoicePlayback(): void {}
