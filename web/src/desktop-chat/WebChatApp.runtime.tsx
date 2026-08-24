import "@desktop/styles.css";
import "./web-chat.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { HashRouter, useSearchParams } from "react-router";

import { ContribWiring, WiredPane } from "@desktop/app/contrib/wiring";
import { sessionRoute } from "@desktop/app/routes";
import { I18nProvider } from "@desktop/i18n";
import { installClipboardShim } from "@desktop/lib/clipboard";
import { queryClient } from "@desktop/lib/query-client";
import { ThemeProvider } from "@desktop/themes/context";

import { installWebDesktopBridge, removeWebDesktopBridge } from "./bridge";

installClipboardShim();

function ChatRouteBootstrap() {
  const [params] = useSearchParams();
  const resume = (params.get("resume") ?? "").trim();

  useEffect(() => {
    if (!resume || typeof window === "undefined") return;
    const target = sessionRoute(resume);
    if (window.location.hash === `#${target}` || window.location.hash === target) {
      return;
    }
    window.location.hash = target;
  }, [resume]);

  return null;
}

function WebChatLayout() {
  return (
    <div className="web-desktop-chat flex h-full min-h-0 w-full min-w-0">
      <ChatRouteBootstrap />
      <aside className="web-desktop-chat__sidebar flex h-full min-h-0 shrink-0 flex-col border-r border-(--ui-border-subtle) bg-(--ui-surface-raised)">
        <WiredPane part="sidebar" />
      </aside>
      <main className="web-desktop-chat__main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--ui-surface-base)">
        <WiredPane part="chatRoutes" />
      </main>
    </div>
  );
}

export function WebChatApp({ isActive }: { isActive?: boolean }) {
  const active = isActive !== false;

  useEffect(() => {
    installWebDesktopBridge();
    return () => {
      removeWebDesktopBridge();
    };
  }, []);

  const shell = useMemo(
    () => (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ThemeProvider>
            <HashRouter useTransitions={false}>
              <ContribWiring>
                <WebChatLayout />
              </ContribWiring>
            </HashRouter>
          </ThemeProvider>
        </I18nProvider>
      </QueryClientProvider>
    ),
    [],
  );

  if (!active) {
    return <div className="hidden" aria-hidden data-web-desktop-chat-host="idle" />;
  }

  return (
    <div
      className="web-desktop-chat-host flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
      data-web-desktop-chat-host="active"
    >
      {shell}
    </div>
  );
}
