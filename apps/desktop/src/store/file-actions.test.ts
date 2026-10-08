import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $notifications, clearNotifications, NOTIFICATION_CATEGORY_ENABLED } from '@/store/notifications'

vi.mock('@/lib/media', () => ({
  downloadGatewayMediaFile: vi.fn()
}))

const media = await import('@/lib/media')
const downloadGatewayMediaFile = vi.mocked(media.downloadGatewayMediaFile)

const { downloadRemoteFile, shouldOfferRemoteFileDownload } = await import('./file-actions')

describe('shouldOfferRemoteFileDownload', () => {
  it('is only for files on a remote backend', () => {
    expect(shouldOfferRemoteFileDownload(false, true)).toBe(true)
    expect(shouldOfferRemoteFileDownload(true, true)).toBe(false)
    expect(shouldOfferRemoteFileDownload(false, false)).toBe(false)
    expect(shouldOfferRemoteFileDownload(true, false)).toBe(false)
  })
})

describe('downloadRemoteFile', () => {
  beforeEach(() => {
    clearNotifications()
    downloadGatewayMediaFile.mockReset()
  })

  afterEach(() => {
    clearNotifications()
  })

  it('saves a remote gateway file through the native download bridge', async () => {
    downloadGatewayMediaFile.mockResolvedValue({ path: '/Users/me/Downloads/notes.md', saved: true })

    await downloadRemoteFile('/home/linux/project/notes.md')

    expect(downloadGatewayMediaFile).toHaveBeenCalledWith('/home/linux/project/notes.md')
    expect($notifications.get()).toEqual([])
  })

  it('restores download feedback when the files category is enabled', async () => {
    NOTIFICATION_CATEGORY_ENABLED.files = true

    try {
      downloadGatewayMediaFile.mockResolvedValue({ path: '/Users/me/Downloads/notes.md', saved: true })
      await downloadRemoteFile('/home/linux/project/notes.md')
      expect($notifications.get()[0]?.message).toBe('Saved')
      downloadGatewayMediaFile.mockRejectedValue(new Error('Download failed'))
      await downloadRemoteFile('/home/linux/project/notes.md')
      expect($notifications.get()[0]).toMatchObject({ kind: 'error', title: 'Download failed' })
    } finally {
      NOTIFICATION_CATEGORY_ENABLED.files = false
    }
  })

  it('stays quiet when the save dialog is canceled', async () => {
    downloadGatewayMediaFile.mockResolvedValue({ canceled: true, saved: false })

    await downloadRemoteFile('/home/linux/project/notes.md')

    expect($notifications.get()).toEqual([])
  })

  it('keeps failed downloads quiet while the files category is disabled', async () => {
    downloadGatewayMediaFile.mockRejectedValue(new Error('Desktop file download bridge is unavailable'))

    await downloadRemoteFile('/home/linux/project/notes.md')

    expect($notifications.get()).toEqual([])
  })
})

// These cases exercise notifications in a foreground app window.
beforeEach(() => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})

afterEach(() => vi.restoreAllMocks())
