import { getRuntimeI18nLocale } from '@/i18n/runtime'
import type { Locale } from '@/i18n/types'
import { type Codec, persistentAtom } from '@/lib/persisted'

/**
 * The language the user speaks when dictating, a device preference.
 *
 * `app` (the default) follows the app language set in Appearance. Every
 * transcription carries it: without one the backend's configured hint
 * applies, English as shipped, and Whisper told to expect English turned
 * Portuguese speech into English text.
 */
export const DICTATION_LANGUAGES = ['pt', 'en', 'es', 'fr', 'de', 'it', 'ja', 'zh', 'ar'] as const

export type DictationLanguageCode = (typeof DICTATION_LANGUAGES)[number]
export type DictationLanguage = 'app' | DictationLanguageCode

/** Endonyms: a language reads in its own name, whatever the app language. */
export const DICTATION_LANGUAGE_NAMES: Record<DictationLanguageCode, string> = {
  ar: 'العربية',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
  zh: '中文'
}

const STORAGE_KEY = 'work4you.desktop.dictationLanguage'

export function isDictationLanguageCode(value: string): value is DictationLanguageCode {
  return (DICTATION_LANGUAGES as readonly string[]).includes(value)
}

const languageCodec: Codec<DictationLanguage> = {
  decode: raw => (isDictationLanguageCode(raw) ? raw : 'app'),
  encode: value => value
}

export const $dictationLanguage = persistentAtom<DictationLanguage>(STORAGE_KEY, 'app', languageCodec)

export function setDictationLanguage(language: DictationLanguage) {
  $dictationLanguage.set(language)
}

/** The code STT providers take for an app language ("zh-hant" → "zh"). */
export function appLanguageCode(locale: Locale = getRuntimeI18nLocale()): string {
  return locale.split('-')[0]
}

/** What a transcription is told about the language spoken (snake_case: the
 *  request body). A picked language is binding. The app language only
 *  replaces the backend's shipped English: an `stt.language` the user set in
 *  config.yaml, auto-detect included, still applies. */
export interface DictationLanguageHint {
  language?: string
  ui_language?: string
}

export function dictationLanguageHint(choice: DictationLanguage = $dictationLanguage.get()): DictationLanguageHint {
  return choice === 'app' ? { ui_language: appLanguageCode() } : { language: choice }
}
