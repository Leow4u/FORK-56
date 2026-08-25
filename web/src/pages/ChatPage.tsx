/**
 * ChatPage — desktop-equivalent structured chat for the web dashboard.
 *
 * Reuses the Electron desktop renderer's chat stack (`ContribWiring` +
 * `ChatView` / `@assistant-ui`) against the dashboard's existing
 * `tui_gateway` backend over `/api/ws`, bridged via `window.work4youDesktop`.
 *
 * Mounted in a *separate* React root: the desktop shell owns a HashRouter,
 * and react-router forbids nesting routers. Embedding HashRouter under the
 * dashboard BrowserRouter throws and unmounts the whole app (black screen).
 */

import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";

function ChatLoading() {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading chat…
    </div>
  );
}

class ChatMountErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[web-chat] desktop chat crashed", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <p>Chat failed to load.</p>
          <p className="max-w-md text-xs opacity-80">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ChatPage({ isActive = true }: { isActive?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<Root | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    const root = createRoot(host);
    rootRef.current = root;

    void (async () => {
      try {
        const mod = await import("@/desktop-chat/WebChatApp");
        if (cancelled) return;
        const { WebChatApp } = mod;
        root.render(
          <ChatMountErrorBoundary>
            <WebChatApp isActive={isActive} />
          </ChatMountErrorBoundary>,
        );
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[web-chat] failed to load desktop chat", err);
        setLoadError(message);
        root.render(
          <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <p>Chat failed to load.</p>
            <p className="max-w-md text-xs opacity-80">{message}</p>
          </div>,
        );
      }
    })();

    return () => {
      cancelled = true;
      rootRef.current = null;
      root.unmount();
      setReady(false);
    };
    // Mount once; isActive updates are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready || loadError) return;
    void import("@/desktop-chat/WebChatApp").then(({ WebChatApp }) => {
      root.render(
        <ChatMountErrorBoundary>
          <WebChatApp isActive={isActive} />
        </ChatMountErrorBoundary>,
      );
    });
  }, [isActive, ready, loadError]);

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      {!ready && !loadError && isActive ? <ChatLoading /> : null}
      <div
        ref={hostRef}
        className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
        data-web-chat-mount=""
      />
    </div>
  );
}
