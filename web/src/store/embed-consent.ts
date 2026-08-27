import { atom } from "nanostores";

export type EmbedMode = "always" | "ask" | "off";

export const $embedMode = atom<EmbedMode>("ask");
export const $embedAllowed = atom<string[]>([]);

export function allowProvider(provider: string) {
  const current = $embedAllowed.get();
  if (!current.includes(provider)) {
    $embedAllowed.set([...current, provider]);
  }
}
