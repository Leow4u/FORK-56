// Where a webhook route's result can go, shared by the Webhooks page and the
// Webhooks channel page so both offer the same targets.

export const DELIVER_OPTIONS: readonly string[] = ['log', 'telegram', 'discord', 'slack', 'email', 'github_comment']

/** Deliver targets that accept an explicit chat/channel/address id. Without
 *  one, delivery falls back to the platform's home channel — fine for a
 *  personal setup, silently wrong for anything else, so ask while creating. */
export const CHAT_TARGET_DELIVERS: ReadonlySet<string> = new Set(['telegram', 'discord', 'slack', 'email'])
