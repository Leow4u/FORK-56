/**
 * Format a token count as a human-readable string (e.g. 1M, 128K, 4096).
 * Strips trailing ".0" for clean round numbers.
 */
export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

/**
 * Compact user-facing counts (Desktop `compactNumber`). 999 → "999",
 * 1000 → "1k", 1230 → "1.2k", 1_500_000 → "1.5M".
 */
export function compactNumber(value: null | number | undefined): string {
  const num = Number(value ?? 0);

  if (!Number.isFinite(num) || num <= 0) {
    return "0";
  }

  const scaled = (v: number, suffix: string) =>
    `${v.toFixed(1).replace(/\.0$/, "")}${suffix}`;

  if (num >= 999_950) {
    return scaled(num / 1_000_000, "M");
  }

  if (num >= 999.5) {
    return scaled(num / 1_000, "k");
  }

  return `${Math.round(num)}`;
}
