declare module "@desktop/styles.css";

declare module "@/desktop-chat/WebChatApp" {
  import type { ReactNode } from "react";

  export function WebChatApp(props: { isActive?: boolean }): ReactNode;
}

declare module "@desktop/app/contrib/wiring" {
  import type { ReactNode } from "react";

  export function ContribWiring(props: { children?: ReactNode }): ReactNode;
  export function WiredPane(props: { part: string }): ReactNode;
}

declare module "@desktop/app/routes" {
  export function sessionRoute(sessionId: string): string;
}

declare module "@desktop/i18n" {
  import type { ReactNode } from "react";

  export function I18nProvider(props: { children?: ReactNode }): ReactNode;
}

declare module "@desktop/lib/clipboard" {
  export function installClipboardShim(): void;
}

declare module "@desktop/lib/query-client" {
  import type { QueryClient } from "@tanstack/react-query";

  export const queryClient: QueryClient;
}

declare module "@desktop/themes/context" {
  import type { ReactNode } from "react";

  export function ThemeProvider(props: { children?: ReactNode }): ReactNode;
}
