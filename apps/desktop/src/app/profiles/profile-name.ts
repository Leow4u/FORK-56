// Profile ids double as directory names under ~/.work4you/profiles/, so they
// stay slug-shaped: lowercase, digits, hyphens, underscores, 64 chars max.
const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function isValidProfileName(name: string): boolean {
  return PROFILE_NAME_RE.test(name.trim())
}
