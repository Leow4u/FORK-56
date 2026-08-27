/**
 * Pure reasoning-effort helpers shared by the dashboard ReasoningPicker.
 *
 * Kept DOM-free so the node-environment vitest harness can cover the
 * resolution logic without loading React or the UI kit.
 *
 * Values mirror work4you_constants.VALID_REASONING_EFFORTS plus `none`
 * (thinking-off). An empty/unset config value means the Work4You default,
 * which is `medium`.
 */

export interface EffortOption {
  value: string;
  label: string;
}

export const EFFORT_OPTIONS: ReadonlyArray<EffortOption> = [
  { value: "none", label: "Off (no thinking)" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
  { value: "max", label: "Max" },
  { value: "ultra", label: "Ultra" },
];

export const VALID_EFFORTS: ReadonlySet<string> = new Set(
  EFFORT_OPTIONS.map((o) => o.value),
);

/** Work4You default when config leaves reasoning effort unset. */
export const DEFAULT_REASONING_EFFORT = "medium";

/** Compact labels for composer model-pill chrome (desktop SHORT_LABELS). */
const SHORT_LABELS: Record<string, string> = {
  none: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "XHigh",
  max: "Max",
  ultra: "Ultra",
};

/** Normalize a raw `agent.reasoning_effort` config value to a selectable
 *  option. Empty/unknown → `medium` (Work4You' default when unset). */
export function normalizeEffort(raw: unknown): string {
  const value = String(raw ?? "").trim().toLowerCase();
  if (!value) return "medium";
  return VALID_EFFORTS.has(value) ? value : "medium";
}

export function reasoningEffortLabel(effort: string): string {
  const key = String(effort ?? "").trim().toLowerCase();
  return key ? (SHORT_LABELS[key] ?? effort) : "";
}

/** Model pill label — name · [Fast] Med (desktop formatModelStatusLabel). */
export function formatModelStatusLabel(
  model: string,
  options?: {
    reasoningEffort?: string;
    fastMode?: boolean;
  },
): string {
  const trimmed = model.trim();
  const base = trimmed.includes("/")
    ? (trimmed.split("/").pop() ?? trimmed)
    : trimmed;
  const name = base || "Auto";
  if (!trimmed) return name;
  const parts: string[] = [];
  if (options?.fastMode || /-fast$/i.test(base)) {
    parts.push("Fast");
  }
  parts.push(
    reasoningEffortLabel(options?.reasoningEffort || "medium") || "Med",
  );
  return `${name} · ${parts.join(" ")}`;
}
