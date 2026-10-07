import { afterEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'work4you.desktop.dictationLanguage'

describe('dictation language', () => {
  afterEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('follows the app language until the user picks one', async () => {
    const { setRuntimeI18nLocale } = await import('@/i18n/runtime')
    const { $dictationLanguage, dictationLanguageHint } = await import('@/store/dictation-language')

    expect($dictationLanguage.get()).toBe('app')

    // The app language is a hint (config's stt.language can still win)...
    for (const [locale, code] of [
      ['en', 'en'],
      ['pt', 'pt'],
      ['zh-hant', 'zh']
    ] as const) {
      setRuntimeI18nLocale(locale)
      expect(dictationLanguageHint()).toEqual({ ui_language: code })
    }

    // ...a picked one is binding.
    expect(dictationLanguageHint('es')).toEqual({ language: 'es' })
  })

  it('restores a stored choice and falls back to the app language on anything else', async () => {
    for (const [stored, expected] of [
      ['pt', 'pt'],
      ['ja', 'ja'],
      ['klingon', 'app']
    ] as const) {
      window.localStorage.setItem(STORAGE_KEY, stored)
      vi.resetModules()

      const { $dictationLanguage } = await import('@/store/dictation-language')

      expect($dictationLanguage.get()).toBe(expected)
    }
  })
})
