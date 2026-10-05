import { afterEach, describe, expect, it } from 'vitest'

import { type Locale, setRuntimeI18nLocale, TRANSLATIONS } from '@/i18n'

import { summarizeToolRun, type ToolCallLike, toolDraftingTitle } from './run-summary'

function tool(toolName: string, args: Record<string, unknown> = {}, result?: unknown): ToolCallLike {
  return { args, result, toolCallId: `${toolName}-${Math.random()}`, toolName }
}

const read = (path: string) => tool('read_file', { path }, { content: '' })
const searched = (query: string) => tool('search_files', { query }, { hits: [] })
const ran = (command: string) => tool('terminal', { command }, { exit_code: 0 })

const settled = (tools: ToolCallLike[]) => summarizeToolRun(tools, false)
const running = (tools: ToolCallLike[]) => summarizeToolRun(tools, true)

// A run only ever holds ephemeral activity: reads, searches, commands. File
// edits and other cards are split out before a run is summarized, so there is
// no "Edited …" clause to test here — that work shows as its own diff card.
describe('summarizeToolRun', () => {
  it('names a lone target and counts the rest', () => {
    expect(settled([searched('toolRuns'), read('a.ts'), read('b.ts'), read('c.ts')])).toBe('Explored 4 files')
  })

  it('reads a whole turn as look, try, then change', () => {
    const edited = tool('write_file', { path: 'docs/resumo.md' }, { ok: true })

    expect(settled([edited, ran('ls'), read('a.ts'), read('b.ts')])).toBe(
      'Explored 2 files, ran 1 command, edited resumo.md'
    )
  })

  it('says a write that started from nothing created its file', () => {
    const created = tool('write_file', { path: 'docs/resumo.md' }, { inline_diff: '@@ -0,0 +1,2 @@\n+# Resumo\n+ok' })
    const edited = tool('patch', { path: 'src/app.ts' }, { diff: '@@ -3,1 +3,1 @@\n-old\n+new' })

    expect(settled([read('a.ts'), created])).toBe('Explored a.ts, created resumo.md')
    expect(settled([created, edited])).toBe('Created resumo.md, edited app.ts')
    // Still running, a write has no diff yet and reads as the edit it is doing.
    expect(running([tool('write_file', { path: 'docs/resumo.md' })])).toBe('Editing resumo.md')
  })

  it('orders clauses explore then run regardless of call order', () => {
    expect(settled([ran('ls'), read('a.ts'), read('b.ts'), ran('pwd'), ran('id')])).toBe(
      'Explored 2 files, ran 3 commands'
    )
  })

  it('counts commands rather than naming them once they have run', () => {
    expect(settled([ran('git status')])).toBe('Ran 1 command')
    expect(settled([read('status.ts'), ran('a'), ran('b'), ran('c'), ran('d'), ran('e')])).toBe(
      'Explored status.ts, ran 5 commands'
    )
  })

  it('puts the running category in the present tense and leaves the rest past', () => {
    expect(running([read('a.ts'), tool('read_file', { path: 'b.ts' }), ran('x'), ran('y')])).toBe(
      'Exploring 2 files, ran 2 commands'
    )
  })

  it('names the command that is still running', () => {
    expect(running([tool('terminal', { command: 'npm run typecheck' })])).toMatch(/^Running /)
  })

  // Sequential calls leave a gap where the run is still going but nothing is
  // pending. Falling back to past tense there contradicted the ticker still
  // scrolling underneath, so the most recent call carries the present tense.
  it('stays in the present tense between two sequential calls', () => {
    expect(running([read('a.ts'), ran('x'), ran('y')])).toBe('Explored a.ts, running 2 commands')
  })

  // A turn can end — or the agent can simply move on — with a call that never
  // got a result. The run is history at that point and has to read as history,
  // or it narrates work that stopped happening and never offers its toggle.
  it('reads a run the turn left unresolved as finished', () => {
    expect(settled([read('a.ts'), tool('search_files', { query: 'toolRuns' })])).toBe('Explored 2 files')
  })
})

// A call with no category of its own used to read "Used 2 tools", which says
// nothing about what happened. By name, the line says what the turn did.
describe('summarizeToolRun naming calls with no category', () => {
  const opened = () => tool('open_preview', { url: 'file:///page.html' }, { ok: true })
  const drove = () => tool('drive_preview', { action: 'click' }, { ok: true })

  it('names a few kinds by what they did, and counts a repeat', () => {
    expect(settled([tool('skill_view', { name: 'web' }, { ok: true })])).toBe('Read skill')
    expect(settled([opened(), drove(), drove()])).toBe('Opened preview, used the preview 2 times')
  })

  it('reads as one sentence after another clause', () => {
    expect(settled([read('a.ts'), opened()])).toBe('Explored a.ts, opened preview')
  })

  it('counts once there are too many kinds to name', () => {
    expect(settled([tool('skill_view', {}, {}), opened(), drove()])).toBe('Used 3 tools')
  })

  it('counts a tool the catalog has no words for, rather than naming it in English', () => {
    expect(settled([tool('custom_tool', {}, {}), drove()])).toBe('Used 2 tools')
  })
})

describe('toolDraftingTitle', () => {
  // Before its arguments arrive a call has no target, and a bare "Editing"
  // left the user asking: editing what?
  it('names a call being drafted the way its row will', () => {
    expect(toolDraftingTitle('write_file')).toBe('Writing file')
    expect(toolDraftingTitle('terminal')).toBe('Running command')
  })

  it("falls back to its kind of work for a tool the catalog doesn't know", () => {
    expect(toolDraftingTitle('custom_tool')).toBe('Using')
  })
})

// The summary stands in for rows that already read in the app's language, so it
// has to as well: every word comes from the active catalog.
describe('summarizeToolRun in every language', () => {
  afterEach(() => setRuntimeI18nLocale('en'))

  it.each(Object.keys(TRANSLATIONS) as Locale[])(
    'builds each clause from the %s catalog and joins them with its separator',
    locale => {
      setRuntimeI18nLocale(locale)
      const copy = TRANSLATIONS[locale].assistant.tool.runSummary
      const { explore, run } = copy.categories
      const second = copy.clause(run.past.charAt(0).toLowerCase() + run.past.slice(1), run.count(1))

      expect(settled([read('a.ts'), read('b.ts'), ran('x')])).toBe(
        [copy.clause(explore.past, explore.count(2)), second].join(copy.separator)
      )
    }
  )

  it.each(Object.keys(TRANSLATIONS) as Locale[])('names calls with no category from the %s catalog', locale => {
    setRuntimeI18nLocale(locale)
    const { runSummary, titles } = TRANSLATIONS[locale].assistant.tool
    const used = titles.drive_preview.done

    expect(
      settled([tool('open_preview', {}, { ok: true }), tool('drive_preview', {}, {}), tool('drive_preview', {}, {})])
    ).toBe(
      [titles.open_preview.done, runSummary.repeated(used.charAt(0).toLowerCase() + used.slice(1), 2)].join(
        runSummary.separator
      )
    )
  })

  // A later clause lower-cases its verb so the line reads as one sentence. A
  // language that puts the object first must not have the object lower-cased
  // in the verb's place.
  it('never lower-cases a target that a later clause leads with', () => {
    setRuntimeI18nLocale('ja')

    expect(settled([read('a.ts'), read('b.ts'), tool('custom_tool', { path: 'README.md' }, {})])).toContain('README.md')
  })
})
