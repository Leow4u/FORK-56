import { desktopSectionsByLocale } from './desktop-sections.locales'
import { desktopSections } from './desktop-sections.raw'
import { en } from './en'
import type { Locale, ResolvedTranslations, Translations } from './types'

import { af } from './af'
import { ar } from './ar'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { ga } from './ga'
import { hu } from './hu'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { pt } from './pt'
import { ru } from './ru'
import { tr } from './tr'
import { uk } from './uk'
import { zh } from './zh'
import { zhHant } from './zh-hant'

const TRANSLATIONS: Record<Locale, Translations> = {
  en,
  zh,
  'zh-hant': zhHant,
  ja,
  de,
  es,
  fr,
  tr,
  uk,
  af,
  ko,
  it,
  ga,
  pt,
  ru,
  hu,
  ar
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Override leaf by leaf, so a key a locale lacks keeps the English one. */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override === undefined ? base : override) as T
  }

  const merged: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    merged[key] = deepMerge(merged[key], value)
  }

  return merged as T
}

export function resolveTranslations(locale: Locale): ResolvedTranslations {
  // The chat ported from the desktop reads the desktop's catalog: in the
  // locales the desktop speaks, in English otherwise.
  const desktop = deepMerge(desktopSections, (desktopSectionsByLocale as Partial<Record<Locale, unknown>>)[locale])

  return { ...desktop, ...TRANSLATIONS[locale] } as ResolvedTranslations
}
