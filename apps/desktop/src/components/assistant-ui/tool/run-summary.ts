import { translateNow } from '@/i18n'
import { summarizeShellCommand } from '@/lib/summarize-command'
import { firstStringField } from '@/lib/text'

import {
  catalogToolTitle,
  diffCreatesFile,
  fileEditBasename,
  inlineDiffFromResult,
  isFileEditTool,
  parseMaybeObject
} from './fallback-model'

/**
 * The little a summary needs from a tool call, stated structurally so both
 * shapes of tool part satisfy it — the stored `ChatMessagePart` and the live
 * one assistant-ui hands to a renderer.
 */
export interface ToolCallLike {
  args?: unknown
  result?: unknown
  toolCallId?: string
  toolName: string
}

export function isToolCallPart<T extends { type: string }>(part: T): part is Extract<T, { type: 'tool-call' }> {
  return part.type === 'tool-call'
}

type RunCategory = 'create' | 'delegate' | 'edit' | 'explore' | 'other' | 'run'

// Clause order is fixed so the same run always reads the same way, whichever
// category happens to be live. It follows the shape most work takes — look,
// try, then change — so a whole turn reads "Explored 8 files, ran 3 commands,
// edited resumo.md" rather than leading with the last thing it did.
const CATEGORY_ORDER: readonly RunCategory[] = ['explore', 'run', 'create', 'edit', 'delegate', 'other']

// The words live in the catalog (`assistant.tool.runSummary`), so a summary
// reads in the app's language like the rows it stands in for.
const categoryVerb = (category: RunCategory, tense: 'past' | 'present') =>
  translateNow(`assistant.tool.runSummary.categories.${category}.${tense}`)

const categoryCount = (category: RunCategory, count: number) =>
  translateNow(`assistant.tool.runSummary.categories.${category}.count`, count)

const EXPLORE_TOOLS = new Set([
  'list_files',
  'read_file',
  'search_files',
  'session_search',
  'session_search_recall',
  'vision_analyze',
  'web_extract',
  'web_search'
])

function toolCategory(toolName: string): RunCategory {
  if (isFileEditTool(toolName)) {
    return 'edit'
  }

  if (toolName === 'terminal' || toolName === 'execute_code') {
    return 'run'
  }

  if (toolName === 'delegate_task') {
    return 'delegate'
  }

  if (EXPLORE_TOOLS.has(toolName) || toolName.startsWith('browser_')) {
    return 'explore'
  }

  return 'other'
}

/**
 * The category a call counts under once it has run: a file edit whose diff
 * starts from nothing made the file — "created resumo.md", not "edited". A
 * call still running has no diff yet, so it reads as an edit until it lands.
 */
function runCategory(tool: ToolCallLike): RunCategory {
  const category = toolCategory(tool.toolName)

  return category === 'edit' && diffCreatesFile(inlineDiffFromResult(tool.result)) ? 'create' : category
}

function isPending(tool: ToolCallLike): boolean {
  return tool.result === undefined
}

/**
 * What the status line calls a call the model is still writing. Its arguments
 * haven't arrived, so there is nothing to name yet: the row's own words for it
 * ("Writing file", "Running command") where the catalog has them, else the
 * verb its kind of work reads with ("Using") — never a bare "Editing" that
 * leaves the user wondering what.
 */
export function toolDraftingTitle(toolName: string): string {
  return catalogToolTitle(toolName, 'pending') || categoryVerb(toolCategory(toolName), 'present')
}

/** The thing a tool acted on, as the header should name it. */
function toolTarget(tool: ToolCallLike): string {
  const args = parseMaybeObject(tool.args)

  if (toolCategory(tool.toolName) === 'run') {
    return summarizeShellCommand(firstStringField(args, ['command', 'code']))
  }

  const path = firstStringField(args, ['path', 'file', 'filepath'])

  return path ? fileEditBasename(path) : firstStringField(args, ['query', 'url'])
}

/**
 * One clause per category. A category holding a single thing says what it was
 * ("Edited wiring.tsx"); anything else counts ("explored 3 files"). A settled
 * command is the exception — "ran 5 commands" is the useful reading, and a
 * command line only earns its space while it's the thing you're waiting on.
 *
 * Only the first clause opens the line, so later ones lower-case their verb —
 * the verb, not the clause: a language that puts the object first must not
 * have a file name lower-cased under it.
 */
function clause(category: RunCategory, tools: ToolCallLike[], live: boolean, first: boolean): string {
  const named = category === 'other' && !live ? namedOtherClause(tools, first) : ''

  if (named) {
    return named
  }

  const tensed = categoryVerb(category, live ? 'present' : 'past')
  const verb = first ? tensed : lowerFirst(tensed)
  const target = tools.length === 1 ? toolTarget(tools[0]) : ''

  if (target && (live || category !== 'run')) {
    return translateNow('assistant.tool.runSummary.clause', verb, target)
  }

  return translateNow('assistant.tool.runSummary.clause', verb, categoryCount(category, tools.length))
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

// Past two kinds, naming each would crowd out the clauses that say what
// changed, and the count says enough.
const NAMED_OTHER_KINDS = 2

/**
 * Calls with no category of their own, by name when there are few kinds of
 * them: "opened preview, used the preview 3 times" says more than "used 4
 * tools". Only the catalog's names — a tool it doesn't know would read in
 * English whatever the app's language — so '' sends the clause back to the
 * count.
 */
function namedOtherClause(tools: readonly ToolCallLike[], first: boolean): string {
  const runs = new Map<string, number>()

  for (const tool of tools) {
    runs.set(tool.toolName, (runs.get(tool.toolName) ?? 0) + 1)
  }

  if (runs.size > NAMED_OTHER_KINDS) {
    return ''
  }

  const named: string[] = []

  for (const [toolName, count] of runs) {
    const title = catalogToolTitle(toolName, 'done')

    if (!title) {
      return ''
    }

    const action = first && named.length === 0 ? title : lowerFirst(title)

    named.push(count > 1 ? translateNow('assistant.tool.runSummary.repeated', action, count) : action)
  }

  return named.join(translateNow('assistant.tool.runSummary.separator'))
}

/**
 * Collapse a run of tool calls into the single grey line that stands in for it
 * — "Explored 3 files, ran 5 commands". While the run is live, the category
 * holding its most recent call speaks in the present tense so the line reads as
 * work in progress rather than work already done.
 *
 * Whether the run is `live` is the caller's to say, not something readable off
 * the calls: a call can be left without a result by a turn that ended or an
 * agent that moved on, and a run like that has to read as finished rather than
 * narrate work that stopped happening.
 *
 * A run of rows only ever holds ephemeral activity — file edits and other cards
 * are split out before this sees them (`splitRunItems`) and carry their own
 * +N/−M. A whole turn's work is summarized here too, edits included: that line
 * says what the turn did, from the first read to the last file it wrote.
 */
export function summarizeToolRun(tools: readonly ToolCallLike[], live: boolean): string {
  // Which clause narrates in the present tense: normally the outstanding call,
  // but sequential calls leave gaps where the run is still going and nothing is
  // pending. The most recent call covers those, and it's the one the ticker is
  // showing anyway.
  const narrating = live ? (tools.find(isPending) ?? tools.at(-1)) : undefined
  const liveCategory = narrating ? runCategory(narrating) : null

  const byCategory = new Map<RunCategory, ToolCallLike[]>()

  for (const tool of tools) {
    const category = runCategory(tool)
    const group = byCategory.get(category)

    if (group) {
      group.push(tool)
    } else {
      byCategory.set(category, [tool])
    }
  }

  const present = CATEGORY_ORDER.filter(category => byCategory.has(category))

  return present
    .map((category, index) => clause(category, byCategory.get(category) ?? [], category === liveCategory, index === 0))
    .join(translateNow('assistant.tool.runSummary.separator'))
}
