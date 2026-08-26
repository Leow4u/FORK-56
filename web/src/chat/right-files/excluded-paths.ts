/** Always hidden in the session cwd tree (mirrors desktop ``ALWAYS_EXCLUDED``). */
export const ALWAYS_EXCLUDED = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "bower_components",
  ".venv",
  "venv",
  "env",
  "__pycache__",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".tox",
  ".gradle",
  ".idea",
  "dist",
  "build",
  "out",
  "target",
  "vendor",
  "Pods",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".output",
  ".turbo",
  ".parcel-cache",
  ".cache",
  ".terraform",
  ".expo",
  ".angular",
  "coverage",
  ".DS_Store",
  "Thumbs.db",
]);

export function filterExcludedEntries<T extends { name: string }>(
  entries: T[],
): T[] {
  return entries.filter((entry) => !ALWAYS_EXCLUDED.has(entry.name));
}
