import type { SessionInfo } from "@/lib/api";

export interface SessionRowDetails {
  metadata: string;
  preview: string | null;
}

export interface SessionRowFormatters {
  messageCount: (count: number) => string;
  toolCallCount: (count: number) => string;
}

const modelLabel = (model: string | null) =>
  model?.split("/").pop()?.trim() || null;
const oneLine = (value: string | null | undefined) =>
  value?.replace(/\s+/g, " ").trim() || null;

/** Desktop sidebar row metadata — same field order as `session-row-details.ts`. */
export function sessionRowDetails(
  session: SessionInfo,
  fmt: SessionRowFormatters,
): SessionRowDetails {
  const preview = oneLine(session.preview);
  const hasOwnTitle = Boolean(session.title?.trim());

  const metadata = [
    session.git_branch?.trim() || null,
    modelLabel(session.model),
    session.message_count > 0 ? fmt.messageCount(session.message_count) : null,
    session.tool_call_count > 0
      ? fmt.toolCallCount(session.tool_call_count)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    metadata,
    preview: hasOwnTitle ? preview : null,
  };
}
