/**
 * GitHub draft matching — used by tests and any future Connect-aware pill.
 *
 * GitHub account attachment is Capabilities → MCP (Work4You Apps). Local
 * `gh` / `git` workflow lives in the bundled github-* skills. This module
 * no longer prefixes `/github-auth` (that skill is optional, not a second
 * connector).
 */

/** Whole-word "github" mention or a pasted github.com link. Same completed-
 * word discipline as the MCP provider: a keyword still under the caret is a
 * word in progress, not intent — but a pasted host counts immediately. */
const KEYWORD_RE = /(?<![\p{L}\p{N}])github(?![\p{L}\p{N}])(?=[\s\S])/iu
const HOST_RE = /https?:\/\/([^\s/,)\]}"'<>]*@)?([\w.-]*\.)?github\.com(?=[/\s:,)\]}"'<>]|$)/i

/** Pure matcher, exported for tests. */
export function githubHit(text: string): boolean {
  if (HOST_RE.test(text)) {
    return true
  }

  // Keyword matching runs with URLs removed: "github" inside a pasted
  // lookalike domain (notgithub.com, github.com.evil.example) is the URL's
  // business, and the host matcher above already rejected it.
  const withoutUrls = text.replace(/https?:\/\/[^\s]+/gi, ' ')
  const match = KEYWORD_RE.exec(withoutUrls.toLowerCase())

  // Completed word: at least one character follows the mention.
  return match !== null && match.index + 'github'.length < withoutUrls.length
}
