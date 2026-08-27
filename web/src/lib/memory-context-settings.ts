/**
 * Memory & Context settings helpers — mirrors apps/desktop/src/app/settings/constants.ts
 * (Memory & Context section keys).
 *
 * `memory.provider` and `context.engine` are omitted here: Settings → Memory & Context
 * renders them via ProvidersCard (plugins hub + provider setup), matching the web
 * product split where Plugins stays operator-facing.
 */

/** Memory toggles and character budgets (above ProvidersCard). */
export const MEMORY_TOGGLE_KEYS = [
  "memory.memory_enabled",
  "memory.user_profile_enabled",
  "memory.memory_char_limit",
  "memory.user_char_limit",
] as const;

/** Context compression knobs (below ProvidersCard). */
export const MEMORY_COMPRESSION_KEYS = [
  "compression.enabled",
  "compression.threshold",
  "compression.target_ratio",
  "compression.protect_last_n",
] as const;

/** All config.yaml keys curated in this section except provider/engine pickers. */
export const MEMORY_CONTEXT_CONFIG_KEYS = [
  ...MEMORY_TOGGLE_KEYS,
  ...MEMORY_COMPRESSION_KEYS,
] as const;
