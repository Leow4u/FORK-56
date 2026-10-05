import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type I18nConfigClient, I18nProvider } from '@/i18n'
import { stubMenuDomApis, stubResizeObserver } from '@/test/jsdom'
import type { Work4YouConfigRecord } from '@/work4you'

import { LanguageSwitcher } from './language-switcher'

stubResizeObserver()
stubMenuDomApis()

function renderSwitcher() {
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

  return { saveConfig }
}

async function openSwitcher() {
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Switch language' }).hasAttribute('disabled')).toBe(false)
  })

  fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
}

describe('LanguageSwitcher', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('offers English and Brazilian Portuguese, not the other bundled languages', async () => {
    renderSwitcher()
    await openSwitcher()

    expect(screen.getByRole('option', { name: /English/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Português \(Brasil\)/ })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /日本語/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /简体中文/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /繁體中文/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /العربية/ })).toBeNull()
  })

  it('persists the choice through display.language config', async () => {
    const { saveConfig } = renderSwitcher()
    await openSwitcher()

    fireEvent.click(screen.getByRole('option', { name: /Português \(Brasil\)/ }))

    await waitFor(() => expect(saveConfig).toHaveBeenCalledTimes(1))
    expect(saveConfig).toHaveBeenCalledWith({ display: { language: 'pt', skin: 'slate' } })
  })
})
