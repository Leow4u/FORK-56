import { useState } from 'react'

import { type IntroCopy, type Translations, useI18n } from '@/i18n'
import { capitalize, normalize } from '@/lib/text'

import introCopyJsonl from './intro-copy.jsonl?raw'

type IntroCopyRecord = IntroCopy & {
  personality: string
}

export type IntroProps = {
  personality?: string
  seed?: number
}

type IntroCatalog = Translations['intro']

const NEUTRAL_PERSONALITIES = new Set(['', 'default', 'none', 'neutral'])

function normalizeKey(value?: string): string {
  return normalize(value)
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ')
}

function isIntroCopyRecord(value: unknown): value is IntroCopyRecord {
  if (!value || typeof value !== 'object') {
    return false
  }

  const record = value as Record<string, unknown>

  return (
    typeof record.personality === 'string' &&
    typeof record.headline === 'string' &&
    typeof record.body === 'string' &&
    Boolean(record.personality.trim()) &&
    Boolean(record.headline.trim()) &&
    Boolean(record.body.trim())
  )
}

function parseIntroCopy(raw: string): Record<string, IntroCopy[]> {
  const byPersonality: Record<string, IntroCopy[]> = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    try {
      const parsed: unknown = JSON.parse(trimmed)

      if (!isIntroCopyRecord(parsed)) {
        continue
      }

      const key = normalizeKey(parsed.personality)
      byPersonality[key] ??= []
      byPersonality[key].push({
        headline: parsed.headline.trim(),
        body: parsed.body.trim()
      })
    } catch {
      // Bad generated copy should not break the whole desktop app.
    }
  }

  return byPersonality
}

const INTRO_COPY_BY_PERSONALITY = parseIntroCopy(introCopyJsonl)

/** A stock personality's greetings in the active language: the catalog's
 *  overlay when it has one, else the English JSONL. Both keep the same
 *  rotation order, so a seed picks the same greeting in every language. */
function stockCopy(intro: IntroCatalog, key: string): readonly IntroCopy[] | undefined {
  const translated = intro.stock[key]

  return translated?.length ? translated : INTRO_COPY_BY_PERSONALITY[key]
}

function resolveCopies(intro: IntroCatalog, personalityKey: string): readonly IntroCopy[] {
  if (NEUTRAL_PERSONALITIES.has(personalityKey)) {
    return stockCopy(intro, personalityKey) || stockCopy(intro, 'none') || stockCopy(intro, 'default') || intro.neutral
  }

  return stockCopy(intro, personalityKey) || intro.custom(titleize(personalityKey))
}

function pickCopy(copies: readonly IntroCopy[], fallback: readonly IntroCopy[], seed = 0): IntroCopy {
  return copies[Math.abs(seed) % copies.length] || fallback[0]
}

export function Intro({ personality, seed }: IntroProps) {
  const [mountSeed] = useState(() => Math.floor(Math.random() * 100000))
  const { t } = useI18n()
  const copy = pickCopy(resolveCopies(t.intro, normalizeKey(personality)), t.intro.neutral, mountSeed + (seed ?? 0))

  return (
    <div
      className="pointer-events-none flex w-full min-w-0 flex-col items-center justify-center px-4 py-6 text-center sm:px-6"
      data-slot="aui_intro"
    >
      <div className="mx-auto w-full min-w-0">
        <p
          className="mb-2 text-xl font-semibold leading-tight tracking-tight text-foreground"
          data-slot="aui_intro_headline"
        >
          {copy.headline}
        </p>

        <p
          className="m-0 text-center text-[length:var(--conversation-caption-font-size)] font-normal leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)"
          data-slot="aui_intro_body"
        >
          {copy.body}
        </p>
      </div>
    </div>
  )
}
