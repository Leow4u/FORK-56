/**
 * Advanced settings helpers — mirrors apps/desktop/src/app/settings/constants.ts
 * (Advanced section keys) and helpers.ts (clearsEnabledToolsets).
 */

import { getNestedValue } from "@/lib/nested";

/** Desktop Settings → Advanced keys (apps/desktop/src/app/settings/constants.ts). */
export const ADVANCED_CONFIG_KEYS = [
  "toolsets",
  "terminal.backend",
  "terminal.timeout",
  "terminal.docker_image",
  "terminal.singularity_image",
  "terminal.modal_image",
  "terminal.daytona_image",
  "tool_output.max_bytes",
  "tool_output.max_lines",
  "tool_output.max_line_length",
  "checkpoints.max_snapshots",
  "agent.max_turns",
  "agent.api_max_retries",
  "agent.service_tier",
  "agent.tool_use_enforcement",
  "delegation.model",
  "delegation.provider",
  "delegation.max_iterations",
  "delegation.max_concurrent_children",
  "delegation.child_timeout_seconds",
  "delegation.reasoning_effort",
  "updates.non_interactive_local_changes",
] as const;

/** Same copy as desktop en.ts settings.config.toolsetsWipeConfirm. */
export const TOOLSETS_WIPE_CONFIRM =
  "Remove all enabled toolsets? This disables memory, terminal, web search, delegation, and most other tools until you re-enable them.";

/**
 * True when an edit clears the entire enabled toolsets list (non-empty → []).
 * Mirrors apps/desktop/src/app/settings/helpers.ts clearsEnabledToolsets.
 */
export function clearsEnabledToolsets(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  const prevToolsets = getNestedValue(prev, "toolsets");
  const nextToolsets = getNestedValue(next, "toolsets");
  const hadToolsets = Array.isArray(prevToolsets) && prevToolsets.length > 0;
  const clearsToolsets =
    Array.isArray(nextToolsets) && nextToolsets.length === 0;
  return hadToolsets && clearsToolsets;
}
