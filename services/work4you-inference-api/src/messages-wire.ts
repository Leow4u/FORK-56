/**
 * Anthropic Messages wire for the portal gateway.
 *
 * Claude traffic arrives as native Messages (the agent SDK) and must leave
 * for OpenRouter's `/messages` in that same shape. Chat Completions SSE is
 * invisible to the Anthropic SDK, which only yields `message_start` /
 * `content_block_delta` / `message_delta`.
 */

export type Usage = Record<string, unknown>

/** Portal attribution. OpenRouter's Messages schema has no `tags` field. */
const PORTAL_ONLY_FIELDS = ['tags'] as const

export function prepareMessagesUpstreamBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  const next: Record<string, unknown> = { ...(body as Record<string, unknown>) }
  for (const key of PORTAL_ONLY_FIELDS) delete next[key]
  return next
}

function asUsage(value: unknown): Usage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Usage
}

/** Usage object carried by one SSE `data:` payload, if any. */
export function usageFromSsePayload(payload: unknown): Usage | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const obj = payload as Record<string, unknown>
  const nested = asUsage(asUsage(obj.message)?.usage)
  const direct = asUsage(obj.usage)
  return mergeUsage(nested, direct)
}

/**
 * Fold a later usage object onto an earlier one.
 *
 * Anthropic splits the bill: `message_start.message.usage` has input tokens,
 * `message_delta.usage` has the final output count and often nothing else.
 * A blind replace would drop the input side. Keys present on `next` win.
 */
export function mergeUsage(prev: Usage | null, next: Usage | null): Usage | null {
  if (!next) return prev
  if (!prev) return { ...next }
  return { ...prev, ...next }
}

/**
 * Map Anthropic usage names onto the OpenRouter chat shape the debit path
 * already prices (`prompt_tokens` / `completion_tokens`).
 */
export function normalizeUsageForBilling(usage: Usage | null): Usage | null {
  if (!usage) return null
  const out: Usage = { ...usage }
  if (out.prompt_tokens == null && out.input_tokens != null) {
    out.prompt_tokens = out.input_tokens
  }
  if (out.completion_tokens == null && out.output_tokens != null) {
    out.completion_tokens = out.output_tokens
  }
  if (out.cache_read_tokens == null && out.cache_read_input_tokens != null) {
    out.cache_read_tokens = out.cache_read_input_tokens
  }
  if (out.cache_write_tokens == null && out.cache_creation_input_tokens != null) {
    out.cache_write_tokens = out.cache_creation_input_tokens
  }
  return out
}

export function billedTokenCount(usage: Usage | null): number {
  const normalized = normalizeUsageForBilling(usage)
  if (!normalized) return 0
  const prompt = Number(normalized.prompt_tokens || 0)
  const completion = Number(normalized.completion_tokens || 0)
  const total =
    (Number.isFinite(prompt) ? prompt : 0) +
    (Number.isFinite(completion) ? completion : 0)
  return total > 0 ? total : 0
}

/**
 * Pull usage out of complete SSE `data:` lines.
 *
 * `flush` parses a trailing line that never received its newline (some
 * upstreams close the body on the last event).
 */
export function consumeSseDataLines(
  buffer: string,
  lastUsage: Usage | null,
  flush: boolean,
): { buffer: string; usage: Usage | null } {
  const parts = buffer.split('\n')
  const rest = flush ? '' : (parts.pop() ?? '')
  let usage = lastUsage
  for (const line of parts) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      usage = mergeUsage(usage, usageFromSsePayload(JSON.parse(payload)))
    } catch {
      /* non-json keepalive or a split frame */
    }
  }
  return { buffer: rest, usage }
}
