/**
 * ChatPage — desktop-equivalent structured chat for the web dashboard.
 *
 * Reuses the Electron desktop renderer's chat stack (`ContribWiring` +
 * `ChatView` / `@assistant-ui`) against the dashboard's existing
 * `tui_gateway` backend over `/api/ws`, bridged via `window.work4youDesktop`.
 */

import { lazy, Suspense } from "react";

const WebChatApp = lazy(async () => {
  const mod = await import("@/desktop-chat/WebChatApp");
  return { default: mod.WebChatApp };
});

function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading chat…
    </div>
  );
}

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  return (
    <Suspense fallback={isActive ? <ChatLoading /> : null}>
      <WebChatApp isActive={isActive} />
    </Suspense>
  );
}
