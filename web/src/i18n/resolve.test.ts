import { describe, expect, it } from 'vitest'

import { resolveTranslations } from './resolve'

describe('resolveTranslations', () => {
  it("reads the chat's activity lines in the locales the desktop speaks", () => {
    const pt = resolveTranslations('pt')

    expect(pt.assistant.thread.thinking).toBe('Pensando')
    expect(pt.assistant.tool.runSummary.categories.explore.past).toBe('Explorou')
    expect(pt.assistant.tool.countNouns.match(3)).toBe('3 ocorrências')
    expect(pt.settings.appearance.activityDensityBalanced).toBe('Equilibrado')
    // The web's own sections still come from the web locale.
    expect(pt.common).toBeDefined()
  })

  it('falls back to English per key, and wholesale for locales the desktop lacks', () => {
    const de = resolveTranslations('de')

    expect(de.assistant.thread.thinking).toBe('Thinking')
    expect(resolveTranslations('en').assistant.thread.thinking).toBe('Thinking')
  })
})
