import { atom, type ReadableAtom } from "nanostores";
import { createContext, useContext, type ReactNode } from "react";

import type { ChatMessage } from "@/lib/chat-messages";

export interface SessionView {
  $runtimeId: ReadableAtom<string | null>;
  $storedId: ReadableAtom<string | null>;
  $messages: ReadableAtom<ChatMessage[]>;
  $busy: ReadableAtom<boolean>;
  $cwd: ReadableAtom<string>;
  $turnStartedAt: ReadableAtom<number | null>;
}

const defaultView: SessionView = {
  $runtimeId: atom<string | null>(null),
  $storedId: atom<string | null>(null),
  $messages: atom<ChatMessage[]>([]),
  $busy: atom(false),
  $cwd: atom(""),
  $turnStartedAt: atom<number | null>(null),
};

const SessionViewContext = createContext<SessionView>(defaultView);

export function SessionViewProvider({
  view,
  children,
}: {
  view: SessionView;
  children: ReactNode;
}) {
  return (
    <SessionViewContext.Provider value={view}>
      {children}
    </SessionViewContext.Provider>
  );
}

export function useSessionView(): SessionView {
  return useContext(SessionViewContext);
}
