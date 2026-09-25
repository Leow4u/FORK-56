import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { $keepAwake } from '@/store/keep-awake'

afterEach(() => {
  cleanup()
  $keepAwake.set(false)
  delete (window as { work4youDesktop?: unknown }).work4youDesktop
})

describe('App settings', () => {
  it('shows keep awake and Quick Entry, and hides the DevTools switch', async () => {
    Object.defineProperty(window, 'work4youDesktop', {
      configurable: true,
      value: {
        quickEntry: {
          getSettings: async () => ({
            enabled: true,
            error: null,
            registered: true,
            shortcut: 'CommandOrControl+Shift+Space'
          }),
          setSettings: async () => ({
            enabled: true,
            error: null,
            registered: true,
            shortcut: 'CommandOrControl+Shift+Space'
          })
        }
      }
    })

    const { AppSettings } = await import('./app-settings')
    render(<AppSettings />)

    expect(screen.getByRole('heading', { name: 'App' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Keep computer awake' })).toBeTruthy()
    expect(await screen.findByRole('switch', { name: 'Quick Entry' })).toBeTruthy()
    expect(screen.queryByText('Disable F12 DevTools')).toBeNull()
  })

  it('toggles keep awake on this computer', async () => {
    const { AppSettings } = await import('./app-settings')
    render(<AppSettings />)

    fireEvent.click(screen.getByRole('switch', { name: 'Keep computer awake' }))

    expect($keepAwake.get()).toBe(true)
  })
})
