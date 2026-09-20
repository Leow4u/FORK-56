import { describe, expect, it } from 'vitest'

import { resolveUpdateCopy, resolveUpdateFinalizeAction } from './update-copy'

const copy = {
  availableTitle: 'New update available',
  availableBody: 'A new version of Work4You is ready to install.',
  availableTitleBackend: 'Backend update available',
  availableBodyBackend: 'A newer version of the connected Work4You backend is ready to install.',
  availableBodyNoChangelog: 'A newer version is ready. Release notes aren’t available for this install type.',
  availableBodyInstaller:
    'A new Work4You installer is ready. It downloads in the background — click Update now when you are ready. Setup still needs that click; it replaces the app in about a minute.',
  availableBodyChrome:
    'A new Work4You app update is ready. It downloads and unpacks in the background — click Restart to finish when the chip is ready. Your existing runtime stays in place.'
}

describe('resolveUpdateCopy', () => {
  it('client target with commits: client title + client body', () => {
    const r = resolveUpdateCopy({ target: 'client', shownItems: 5, copy })
    expect(r.title).toBe('New update available')
    expect(r.body).toBe('A new version of Work4You is ready to install.')
  })

  it('backend target with commits: names the backend in title and body', () => {
    const r = resolveUpdateCopy({ target: 'backend', shownItems: 5, copy })
    expect(r.title).toBe('Backend update available')
    expect(r.body).toContain('backend')
  })

  it('no changelog (pip/non-git backend): degrades honestly, still names backend target in title', () => {
    const r = resolveUpdateCopy({ target: 'backend', shownItems: 0, copy })
    expect(r.title).toBe('Backend update available')
    // Body must NOT pretend there are notes — it states they're unavailable.
    expect(r.body).toBe(copy.availableBodyNoChangelog)
  })

  it('no changelog on client: same honest degrade', () => {
    const r = resolveUpdateCopy({ target: 'client', shownItems: 0, copy })
    expect(r.title).toBe('New update available')
    expect(r.body).toBe(copy.availableBodyNoChangelog)
  })

  it('packaged installer channel: names the fast installer path, even with no changelog', () => {
    const r = resolveUpdateCopy({ target: 'client', shownItems: 0, copy, channel: 'installer' })
    expect(r.title).toBe('New update available')
    expect(r.body).toBe(copy.availableBodyInstaller)
    expect(r.body).toContain('installer')
  })

  it('packaged chrome channel: names the slim shell path, not the installer minute', () => {
    const r = resolveUpdateCopy({ target: 'client', shownItems: 0, copy, channel: 'chrome' })
    expect(r.title).toBe('New update available')
    expect(r.body).toBe(copy.availableBodyChrome)
    expect(r.body).not.toContain('installer')
    expect(r.body).not.toContain('minute')
  })
})

describe('resolveUpdateFinalizeAction', () => {
  const copy = { restartToFinish: 'Restart to finish', updateNow: 'Update now' }

  it('keeps git Update now enabled', () => {
    expect(resolveUpdateFinalizeAction({ copy })).toEqual({ disabled: false, label: 'Update now' })
  })

  it('disables the packaged button and shows percent until Stage A is ready', () => {
    expect(
      resolveUpdateFinalizeAction({
        channel: 'chrome',
        copy,
        prefetchPercent: 42,
        prefetchReady: false
      })
    ).toEqual({ disabled: true, label: '42%' })
  })

  it('chrome ready becomes Restart to finish; installer stays Update now', () => {
    expect(
      resolveUpdateFinalizeAction({ channel: 'chrome', copy, prefetchPercent: 100, prefetchReady: true })
    ).toEqual({ disabled: false, label: 'Restart to finish' })
    expect(
      resolveUpdateFinalizeAction({ channel: 'installer', copy, prefetchPercent: 100, prefetchReady: true })
    ).toEqual({ disabled: false, label: 'Update now' })
  })

  it('re-enables Update now after a prefetch error so apply can retry', () => {
    expect(
      resolveUpdateFinalizeAction({
        channel: 'chrome',
        copy,
        prefetchError: 'download-failed',
        prefetchReady: false
      })
    ).toEqual({ disabled: false, label: 'Update now' })
  })
})
