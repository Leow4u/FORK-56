// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'

import { ConfirmDialog } from './confirm-dialog'

afterEach(cleanup)

describe('ConfirmDialog', () => {
  it('wears the composer card on the confirmation shell', () => {
    render(
      <I18nProvider configClient={null} initialLocale="en">
        <ConfirmDialog
          confirmLabel="Delete"
          description="This will permanently delete the session."
          destructive
          onClose={() => undefined}
          onConfirm={() => undefined}
          open
          title="Delete session?"
        />
      </I18nProvider>
    )

    const dialog = document.querySelector('[data-slot="dialog-content"]')
    const title = screen.getByRole('heading', { name: 'Delete session?' })
    const description = screen.getByText('This will permanently delete the session.')

    expect(title).toBeTruthy()
    expect(title.className).toContain('text-[length:var(--conversation-text-font-size)]')
    expect(title.className).toContain('font-medium')
    expect(title.className).toContain('tracking-normal')
    expect(title.className).not.toContain('font-semibold')
    expect(title.className).not.toContain('tracking-tight')
    expect(title.className).not.toContain('0.9375rem')
    expect(description.className).toContain('text-[length:var(--conversation-caption-font-size)]')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy()
    expect(dialog?.className).toContain('rounded-(--ui-stage-radius)')
    expect(dialog?.className).toContain('bg-(--ui-bg-elevated)')
  })
})
