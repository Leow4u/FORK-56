import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { DesktopUpdateStatus } from '@/global'
import { I18nProvider } from '@/i18n/context'
import {
  $desktopVersion,
  $packagedUpdateResult,
  $updateApply,
  $updateOverlayOpen,
  $updateOverlayTarget,
  $updateStatus,
  resetUpdateApplyState
} from '@/store/updates'

import { BlockerView, formatBlockerCommandLine, UpdatesOverlay } from './updates-overlay'

async function renderWithI18n(ui: React.ReactNode) {
  await act(async () => {
    render(
      <I18nProvider configClient={{ getConfig: async () => ({}), saveConfig: async () => ({ ok: true }) }}>
        <Dialog open>
          <DialogContent>{ui}</DialogContent>
        </Dialog>
      </I18nProvider>
    )
  })
}

async function renderUpdatesOverlay() {
  await act(async () => {
    render(
      <I18nProvider configClient={{ getConfig: async () => ({}), saveConfig: async () => ({ ok: true }) }}>
        <UpdatesOverlay />
      </I18nProvider>
    )
  })
}

describe('formatBlockerCommandLine', () => {
  it('redacts the full ambiguous tail after a sensitive CLI, environment, or header marker', () => {
    const secretParts = ['first-part', 'second-part']
    const secret = secretParts.join(' ')

    const commands = [
      `python.exe watcher.py --token ${secret} --mode inspect`,
      ['python.exe watcher.py --password="', secret, '" --mode inspect'].join(''),
      `AUTH_TOKEN=${secret} python.exe watcher.py --mode inspect`,
      `python.exe watcher.py Authorization: Bearer ${secret} --mode inspect`
    ]

    for (const commandLine of commands) {
      const formatted = formatBlockerCommandLine(commandLine)

      expect(formatted).not.toContain(secretParts[0])
      expect(formatted).not.toContain(secretParts[1])
      expect(formatted).not.toContain('--mode inspect')
      expect(formatted.endsWith('[REDACTED]')).toBe(true)
    }
  })

  it('redacts a sensitive query value and bounds the remaining diagnostic output', () => {
    const queryValue = ['private', 'value'].join('-')

    const commandLine =
      `python.exe watcher.py https://example.test/?api_key=${queryValue}&mode=inspect ` + 'x'.repeat(600)

    const formatted = formatBlockerCommandLine(commandLine)

    expect(formatted).not.toContain(queryValue)
    expect(formatted).toContain('api_key=[REDACTED]&mode=inspect')
    expect(Array.from(formatted).length).toBeLessThanOrEqual(500)
    expect(formatted.endsWith('…')).toBe(true)
  })
})

describe('ApplyingView', () => {
  afterEach(() => {
    cleanup()
    $updateOverlayOpen.set(false)
    $updateOverlayTarget.set('client')
    $updateStatus.set(null)
    $desktopVersion.set(null)
    $packagedUpdateResult.set(null)
    resetUpdateApplyState()
  })

  it('shows the current operation and measured progress while applying', async () => {
    $updateOverlayOpen.set(true)
    $updateStatus.set({
      supported: true,
      updateAvailable: true,
      behind: 1,
      channel: 'installer',
      commits: []
    } as DesktopUpdateStatus)
    $updateApply.set({
      applying: true,
      stage: 'fetch',
      message: 'Downloading the signed Work4You installer',
      percent: 42,
      error: null,
      command: null,
      log: [
        { at: 1, message: 'Downloading the signed Work4You installer', stage: 'fetch' },
        { at: 2, message: 'Downloading the signed Work4You installer', stage: 'fetch' },
        { at: 3, message: 'Downloading the signed Work4You installer', stage: 'fetch' }
      ]
    })

    await renderUpdatesOverlay()

    expect(screen.getByRole('heading', { name: /downloading/i })).toBeTruthy()
    const bar = screen.getByRole('progressbar', { name: /downloading/i })
    expect(bar.querySelector('[class*="midground"]')).toBeTruthy()
    expect(screen.getByText('Downloading the signed Work4You installer')).toBeTruthy()
    expect(screen.queryByText(/this window will close/i)).toBeNull()
    expect(screen.queryByText(/don't reopen/i)).toBeNull()
  })

  it('keeps the handoff message visible while restarting', async () => {
    $updateOverlayOpen.set(true)
    $updateStatus.set({
      supported: true,
      updateAvailable: true,
      behind: 0,
      channel: 'chrome',
      commits: []
    } as DesktopUpdateStatus)
    $updateApply.set({
      applying: true,
      stage: 'restart',
      message: 'Restarting Work4You to swap the desktop shell. This window closes briefly and comes back on its own.',
      percent: 100,
      error: null,
      command: null,
      log: []
    })

    await renderUpdatesOverlay()

    expect(screen.getByRole('heading', { name: 'Restarting Work4You…' })).toBeTruthy()
    expect(screen.getByText(/swap the desktop shell/i)).toBeTruthy()
    expect(screen.getByText(/comes back on its own/i)).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Restarting Work4You…' })).toBeTruthy()
  })

  it('shows a failed background download with an enabled retry action', async () => {
    $updateOverlayOpen.set(true)
    $updateStatus.set({
      supported: true,
      updateAvailable: true,
      channel: 'installer',
      prefetchPercent: 42,
      prefetchError: 'The download was interrupted.'
    })

    await renderUpdatesOverlay()

    expect(screen.getByRole('alert').textContent).toBe('The download was interrupted.')
    expect((screen.getByRole('button', { name: 'Retry download' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('explains the macOS replacement and offers to open the installer', async () => {
    $desktopVersion.set({
      appVersion: '1.0.0',
      electronVersion: '1',
      nodeVersion: '1',
      platform: 'darwin',
      work4youRoot: '/app'
    })
    $updateOverlayOpen.set(true)
    $updateStatus.set({ supported: true, updateAvailable: true, channel: 'installer', prefetchReady: true })

    await renderUpdatesOverlay()

    expect(screen.getByRole('button', { name: 'Open installer' })).toBeTruthy()
    expect(screen.getByText(/quit Work4You, drag it to Applications/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Restart to finish' })).toBeNull()
  })

  it('preserves measured zero progress rather than inventing completion', async () => {
    $updateOverlayOpen.set(true)
    $updateStatus.set({ supported: true, updateAvailable: true, channel: 'installer' })
    $updateApply.set({
      applying: true,
      stage: 'fetch',
      message: 'Connecting to the download server',
      percent: 0,
      error: null,
      command: null,
      log: []
    })

    await renderUpdatesOverlay()

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')
  })

  it('offers saved installer recovery after a persisted failed update', async () => {
    const previousBridge = window.work4youDesktop
    const openRecoveryInstaller = vi.fn(async () => ({ ok: true }))
    window.work4youDesktop = { updates: { openRecoveryInstaller } } as unknown as Window['work4youDesktop']
    $packagedUpdateResult.set({
      attemptId: 'failed-install',
      stage: 'failed',
      releaseTag: 'desktop-v1.0.0',
      expectedCommit: 'a'.repeat(40),
      previousCommit: 'b'.repeat(40),
      installerPath: '/cache/current.exe',
      recoveryInstallerPath: '/cache/previous.exe'
    })
    $updateOverlayOpen.set(true)
    $updateStatus.set({ supported: true, updateAvailable: true, channel: 'installer' })
    $updateApply.set({
      applying: false,
      stage: 'error',
      error: 'packaged-update-failed',
      message: 'The installer failed.',
      percent: null,
      command: null,
      log: []
    })

    try {
      await renderUpdatesOverlay()
      fireEvent.click(screen.getByRole('button', { name: 'Show previous installer' }))
      await vi.waitFor(() => expect(openRecoveryInstaller).toHaveBeenCalledWith({ previous: true }))
      expect(screen.getByRole('button', { name: 'Show installer' })).toBeTruthy()
    } finally {
      window.work4youDesktop = previousBridge
    }
  })
})

describe('BlockerView', () => {
  afterEach(() => {
    cleanup()
    $updateOverlayOpen.set(false)
    $updateOverlayTarget.set('client')
    $updateStatus.set(null)
    resetUpdateApplyState()
  })

  it('uses the blocker view for a foreign process instead of the generic update error', async () => {
    $updateOverlayTarget.set('client')
    $updateOverlayOpen.set(true)
    $updateStatus.set({
      supported: true,
      updateAvailable: true,
      behind: 1,
      commits: []
    } as DesktopUpdateStatus)
    $updateApply.set({
      applying: false,
      stage: 'error',
      message: 'Update aborted: another Work4You process is using this installation.',
      percent: null,
      error: 'venv-blocked',
      command: null,
      blockers: [
        {
          pid: 58636,
          name: 'python.exe',
          cmdline: 'python.exe fenbi_session_refresh.py',
          kind: 'other',
          safeToStop: false
        }
      ],
      log: []
    })

    await renderUpdatesOverlay()

    expect(screen.getByText('Close other processes to update Work4You')).toBeTruthy()
    expect(screen.getByText('python.exe')).toBeTruthy()
    expect(screen.queryByText('Update didn’t finish')).toBeNull()
  })

  it('identifies foreign blockers without offering automatic termination', async () => {
    const onStopAndUpdate = vi.fn()

    await renderWithI18n(
      <BlockerView
        blockers={[
          {
            pid: 58636,
            name: 'python.exe',
            cmdline: 'python.exe fenbi_session_refresh.py',
            kind: 'other',
            safeToStop: false
          }
        ]}
        onDismiss={() => {}}
        onStopAndUpdate={onStopAndUpdate}
      />
    )

    expect(screen.getByText('Close other processes to update Work4You')).toBeTruthy()
    expect(screen.getByText('python.exe')).toBeTruthy()
    expect(screen.getByText('PID 58636')).toBeTruthy()
    expect(screen.getByText(/can’t safely close these processes automatically/i)).toBeTruthy()
    expect(screen.getByText(/python.exe fenbi_session_refresh\.py/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /close previews/i })).toBeNull()
    expect(onStopAndUpdate).not.toHaveBeenCalled()
  })

  it('keeps mixed blocker cleanup limited to safe previews', async () => {
    const onStopAndUpdate = vi.fn()

    await renderWithI18n(
      <BlockerView
        blockers={[
          {
            pid: 47484,
            name: 'python.exe',
            cmdline: 'python.exe -m http.server 8766',
            kind: 'local-preview',
            safeToStop: true,
            label: 'Example Preview',
            port: 8766
          },
          {
            pid: 58636,
            name: 'python.exe',
            cmdline: 'python.exe fenbi_session_refresh.py',
            kind: 'other',
            safeToStop: false
          }
        ]}
        onDismiss={() => {}}
        onStopAndUpdate={onStopAndUpdate}
      />
    )

    expect(screen.getByText(/can close the local previews listed below/i)).toBeTruthy()
    expect(screen.getByText('Example Preview')).toBeTruthy()
    expect(screen.getByText('python.exe')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close previews and check again' }))
    expect(onStopAndUpdate).toHaveBeenCalledTimes(1)
  })

  it('explains safe local previews and offers one-click close-and-update', async () => {
    const onStopAndUpdate = vi.fn()

    await renderWithI18n(
      <BlockerView
        blockers={[
          {
            pid: 47484,
            name: 'python.exe',
            cmdline: 'python.exe -m http.server 8766',
            kind: 'local-preview',
            safeToStop: true,
            label: 'Example Preview',
            port: 8766
          }
        ]}
        onDismiss={() => {}}
        onStopAndUpdate={onStopAndUpdate}
      />
    )

    expect(screen.getByText('Close local previews to update Work4You?')).toBeTruthy()
    expect(screen.getByText('Example Preview')).toBeTruthy()
    expect(screen.getByText('Port 8766')).toBeTruthy()
    expect(screen.getByText(/will not modify or delete your files/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Close previews and update' }))
    expect(onStopAndUpdate).toHaveBeenCalledTimes(1)
  })
})
