import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $desktopVersion, $updateApply, $updateChecking, $updateStatus } from '@/store/updates'

import { AboutSettings } from './about-settings'

const summary = vi.fn()
const run = vi.fn()

beforeEach(() => {
  $desktopVersion.set({
    appVersion: '1.2.3',
    electronVersion: '0.0.0',
    nodeVersion: '0.0.0',
    platform: 'linux',
    work4youRoot: '/tmp/work4you'
  })
  $updateStatus.set({
    behind: 0,
    branch: 'main',
    currentSha: 'abcdef1234567890',
    fetchedAt: Date.now(),
    supported: true
  })
  $updateApply.set({
    applying: false,
    command: null,
    error: null,
    log: [],
    message: '',
    percent: null,
    stage: 'idle'
  })
  $updateChecking.set(false)
  summary.mockReset()
  run.mockReset()
  run.mockResolvedValue({ ok: true })
  window.work4youDesktop = {
    getVersion: vi.fn(async () => ({ appVersion: '1.2.3' })),
    uninstall: { run, summary }
  } as unknown as Window['work4youDesktop']
})

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(window, 'work4youDesktop')
  $desktopVersion.set(null)
  $updateStatus.set(null)
})

describe('About settings', () => {
  it('shows version and updates without the build identity or agent uninstall', () => {
    render(<AboutSettings />)

    expect(screen.getByText('Version 1.2.3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Check now' })).toBeTruthy()
    expect(screen.getByText('Release notes')).toBeTruthy()
    expect(screen.getByText('Automatic updates')).toBeTruthy()
    expect(screen.queryByText(/Branch main/)).toBeNull()
    expect(screen.queryByText(/abcdef1/)).toBeNull()
    expect(screen.queryByText('Danger zone')).toBeNull()
    expect(screen.queryByText('Uninstall GUI + agent, keep my data')).toBeNull()
    expect(screen.queryByText('Uninstall everything')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove the app' })).toBeTruthy()
    expect(summary).not.toHaveBeenCalled()
  })

  it('confirms before removing only the desktop app', async () => {
    render(<AboutSettings />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove the app' }))
    expect(screen.getByText('Remove the app?')).toBeTruthy()
    expect(screen.getByText(/Your agent, chats, and settings stay/)).toBeTruthy()
    expect(run).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove the app' }))

    await waitFor(() => expect(run).toHaveBeenCalledWith('gui'))
    expect(summary).not.toHaveBeenCalled()
  })

  it('hides uninstall when the desktop bridge is absent', () => {
    Reflect.deleteProperty(window, 'work4youDesktop')
    render(<AboutSettings />)

    expect(screen.queryByRole('button', { name: 'Remove the app' })).toBeNull()
  })
})
