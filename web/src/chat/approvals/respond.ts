import type { GatewayClient } from "@/lib/gatewayClient";

import type { ApprovalChoice } from "./types";

export async function respondApproval(
  gateway: GatewayClient,
  params: {
    choice: ApprovalChoice;
    requestId: string;
    sessionId: string | null;
    all?: boolean;
  },
): Promise<{ resolved: number } | null> {
  return gateway.request<{ resolved: number }>("approval.respond", {
    choice: params.choice,
    request_id: params.requestId || undefined,
    session_id: params.sessionId || undefined,
    ...(params.all ? { all: true } : {}),
  });
}

export async function ackApprovalReceived(
  gateway: GatewayClient,
  params: { requestId: string; sessionId: string | null },
): Promise<void> {
  await gateway.request("approval.received", {
    request_id: params.requestId,
    session_id: params.sessionId || undefined,
  });
}

export async function fetchPendingApproval(
  gateway: GatewayClient,
  sessionId: string | null,
): Promise<Record<string, unknown> | null> {
  const result = await gateway.request<{ approvals?: Record<string, unknown>[] }>(
    "approval.pending",
    { session_id: sessionId || undefined },
  );
  const first = result?.approvals?.[0];
  return first && typeof first === "object" ? first : null;
}

export async function respondClarify(
  gateway: GatewayClient,
  params: {
    requestId: string;
    answer: string;
    questionId?: string;
  },
): Promise<{ status?: string; remaining?: number } | null> {
  return gateway.request("clarify.respond", {
    request_id: params.requestId,
    answer: params.answer,
    ...(params.questionId ? { question_id: params.questionId } : {}),
  });
}

export async function respondSudo(
  gateway: GatewayClient,
  params: { requestId: string; password: string },
): Promise<{ status?: string } | null> {
  return gateway.request("sudo.respond", {
    request_id: params.requestId,
    password: params.password,
  });
}

export async function respondSecret(
  gateway: GatewayClient,
  params: { requestId: string; value: string },
): Promise<{ status?: string } | null> {
  return gateway.request("secret.respond", {
    request_id: params.requestId,
    value: params.value,
  });
}
