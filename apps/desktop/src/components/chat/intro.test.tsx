import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type I18nConfigClient, I18nProvider, TRANSLATIONS } from '@/i18n'

import { Intro } from './intro'
import introCopyJsonl from './intro-copy.jsonl?raw'

/** The English JSONL, grouped per personality in rotation order. */
function englishStock(): Record<string, { headline: string; body: string }[]> {
  const byPersonality: Record<string, { headline: string; body: string }[]> = {}

  for (const line of introCopyJsonl.split(/\r?\n/).filter(Boolean)) {
    const { personality, headline, body } = JSON.parse(line) as { personality: string; headline: string; body: string }

    ;(byPersonality[personality] ??= []).push({ headline, body })
  }

  return byPersonality
}

function renderIn(language: string, personality: string) {
  const configClient: I18nConfigClient = {
    getConfig: vi.fn().mockResolvedValue({ display: { language } }),
    saveConfig: vi.fn().mockResolvedValue({ ok: true })
  }

  return render(
    <I18nProvider configClient={configClient} initialLocale={language}>
      <Intro personality={personality} seed={0} />
    </I18nProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Intro', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('does not paint a Work4You is ready kicker above the personality headline', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)

    const intro = container.querySelector('[data-slot="aui_intro"]')
    const headline = intro?.querySelector('[data-slot="aui_intro_headline"]')
    const body = intro?.querySelector('[data-slot="aui_intro_body"]')

    expect(intro?.querySelector('[data-slot="aui_intro_ready"]')).toBeNull()
    expect(headline?.textContent?.trim()).toBe('Ready when you are')
    expect(headline?.textContent?.trim()).not.toBe('WORK4YOU')
    expect(body?.textContent?.trim().length).toBeGreaterThan(20)
    expect(screen.queryByText('Work4You is ready')).toBeNull()
    expect(screen.queryByLabelText('WORK4YOU')).toBeNull()
    expect(container.querySelector('.fit-text')).toBeNull()
  })

  it('keeps personality headlines even when they mention ready', () => {
    const { container } = render(<Intro personality="none" seed={0} />)

    expect(container.querySelector('[data-slot="aui_intro_ready"]')).toBeNull()
    expect(container.querySelector('[data-slot="aui_intro_headline"]')?.textContent?.trim()).toBe('Work4You is ready.')
  })

  it('keeps the empty-state copy quiet and sentence-case', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)
    const headline = container.querySelector('[data-slot="aui_intro_headline"]')

    expect(headline?.className).not.toMatch(/uppercase/)
    expect(headline?.className).not.toMatch(/Collapse/)
    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
  })

  it('ranks splash headline above body by weight', () => {
    const { container } = render(<Intro personality="helpful" seed={0} />)

    const headline = container.querySelector('[data-slot="aui_intro_headline"]')
    const body = container.querySelector('[data-slot="aui_intro_body"]')

    expect(headline?.className).toMatch(/text-xl/)
    expect(headline?.className).toMatch(/font-semibold/)
    expect(headline?.className).toMatch(/text-foreground/)

    expect(body?.className).toMatch(/conversation-caption-font-size/)
    expect(body?.className).toMatch(/font-normal/)
    expect(body?.className).not.toMatch(/text-xl/)
    expect(body?.className).not.toMatch(/font-semibold/)
    expect(body?.className).not.toMatch(/tracking-tight/)
  })
})

describe('Intro in the active language', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('greets a stock personality in the language, at the same rotation slot as English', async () => {
    const greeting = TRANSLATIONS.pt.intro.stock.helpful[0]

    renderIn('pt', 'helpful')

    expect(await screen.findByText(greeting.headline)).toBeTruthy()
    expect(screen.getByText(greeting.body)).toBeTruthy()
  })

  it('keeps the English greeting for a language without one', async () => {
    const english = englishStock().helpful[0]

    renderIn('ja', 'helpful')

    expect(await screen.findByText(english.headline)).toBeTruthy()
    expect(screen.getByText(english.body)).toBeTruthy()
  })

  it("gives a personality outside the stock list the language's own greeting", async () => {
    renderIn('pt', 'mentor')

    expect(await screen.findByText(TRANSLATIONS.pt.intro.custom('Mentor')[0].headline)).toBeTruthy()
  })

  it('covers every English slot of every stock personality in Portuguese', () => {
    for (const [personality, english] of Object.entries(englishStock())) {
      const translated = TRANSLATIONS.pt.intro.stock[personality] ?? []

      expect({ personality, slots: translated.length }).toEqual({ personality, slots: english.length })

      for (const greeting of translated) {
        expect(greeting.headline.trim()).not.toBe('')
        expect(greeting.body.trim()).not.toBe('')
      }
    }
  })
})
