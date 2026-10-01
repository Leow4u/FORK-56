import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type I18nConfigClient, I18nProvider } from '@/i18n'
import type { Work4YouConfigRecord } from '@/work4you'

import { LanguageSwitcher } from './language-switcher'

describe('LanguageSwitcher', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows English and does not offer other languages', () => {
    const saveConfig = vi.fn().mockResolvedValue({ ok: true })
    const latestConfig: Work4YouConfigRecord = { display: { language: 'en', skin: 'slate' } }

    const configClient: I18nConfigClient = {
      getConfig: vi.fn().mockResolvedValue(latestConfig),
      saveConfig
    }

    render(
      <I18nProvider configClient={configClient}>
        <LanguageSwitcher />
      </I18nProvider>
    )

    expect(screen.getByText('English')).toBeTruthy()
    expect(screen.queryByText('日本語')).toBeNull()
    expect(screen.queryByText('简体中文')).toBeNull()
    expect(screen.queryByText('繁體中文')).toBeNull()
    expect(screen.queryByText('العربية')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Switch language' })).toBeNull()
    expect(saveConfig).not.toHaveBeenCalled()
  })
})
