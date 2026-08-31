/**
 * Chat host activation latch.
 *
 * The dashboard keeps `ChatPage` mounted persistently (hidden with CSS) so the
 * JSON-RPC gateway WebSocket survives tab switches. The downside is that the
 * connect effect would otherwise open `/api/ws` the moment the dashboard loads
 * *any* page, even one the user never navigates the chat into.
 *
 * The fix is to only open the gateway once a surface that needs the live
 * event stream has actually been active (`/chat` or `/agents`), while keeping
 * activation **sticky** so the socket still persists across later tab
 * switches. This helper computes that latch: once `true`, it stays `true`.
 */
export function latchChatActivation(previous: boolean, isActive: boolean): boolean {
  return previous || isActive;
}

/** Routes whose first visit should mount the persistent chat gateway host. */
export function shouldKeepChatHost(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, "") || "/";
  return normalized === "/chat" || normalized === "/agents";
}
