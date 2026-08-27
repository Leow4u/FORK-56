import { createContext, useContext, type ReactNode } from "react";

import type { ChatMessage } from "@/lib/chat-messages";
import { atom, type ReadableAtom } from "nanostores";

import type { ComposerTarget } from "./focus";

export interface ComposerScope {
  $awaitingInput: ReadableAtom<boolean>;
  attachments: { list: ReadableAtom<unknown[]> };
  $messages: ReadableAtom<ChatMessage[]>;
  target: ComposerTarget;
}

const noopAtom = atom(false);
const emptyMessages = atom<ChatMessage[]>([]);
const emptyAttachments = atom<unknown[]>([]);

export const MAIN_COMPOSER_SCOPE: ComposerScope = {
  $awaitingInput: noopAtom,
  $messages: emptyMessages,
  attachments: { list: emptyAttachments },
  target: "main",
};

const ComposerScopeContext = createContext<ComposerScope>(MAIN_COMPOSER_SCOPE);

export function ComposerScopeProvider({
  scope,
  children,
}: {
  scope: ComposerScope;
  children: ReactNode;
}) {
  return (
    <ComposerScopeContext.Provider value={scope}>
      {children}
    </ComposerScopeContext.Provider>
  );
}

export function useComposerScope(): ComposerScope {
  return useContext(ComposerScopeContext);
}
