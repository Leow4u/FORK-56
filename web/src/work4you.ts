import {
  api,
  type McpCatalogEntry,
  type McpOAuthFlow,
  type McpServer,
} from "@/lib/api";
import type { GatewayClient } from "@/lib/gatewayClient";

/** Desktop transcript components expect `Work4YouGateway` — web uses `GatewayClient`. */
export type Work4YouGateway = GatewayClient;

export type { McpCatalogEntry, McpOAuthFlow };

export async function getSession(_sessionId: string): Promise<null> {
  return null;
}

export async function getOlderSessionMessages(
  _sessionId: string,
  _beforeRowId: number,
): Promise<{ messages: unknown[]; hasMore: boolean }> {
  return { messages: [], hasMore: false };
}

export const addMcpServer = (
  body: Parameters<typeof api.addMcpServer>[0],
): Promise<McpServer> => api.addMcpServer(body);

export const authMcpServer = (name: string): Promise<McpOAuthFlow> =>
  api.authMcpServer(name);

export const getMcpOAuthFlow = (flowId: string): Promise<McpOAuthFlow> =>
  api.getMcpOAuthFlow(flowId);

export const cancelMcpOAuthFlow = (
  flowId: string,
): Promise<{ ok: boolean; status: string }> => api.cancelMcpOAuthFlow(flowId);

export const removeMcpServer = (name: string): Promise<{ ok: boolean }> =>
  api.removeMcpServer(name);

export const setMcpServerEnabled = (
  name: string,
  enabled: boolean,
): Promise<{ ok: boolean; name: string; enabled: boolean }> =>
  api.setMcpServerEnabled(name, enabled);

export const getMcpCatalog = (): ReturnType<typeof api.getMcpCatalog> =>
  api.getMcpCatalog();

export const installMcpCatalogEntry = (
  name: string,
  env: Record<string, string> = {},
): ReturnType<typeof api.installMcpCatalogEntry> =>
  api.installMcpCatalogEntry(name, env, true);

export const getActionStatus = (
  name: string,
  lines = 200,
): ReturnType<typeof api.getActionStatus> => api.getActionStatus(name, lines);
