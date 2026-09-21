import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as MediaModule from '@/lib/media'
import type * as PreviewStore from '@/store/preview'
import { $previewTabs } from '@/store/preview'

import { PreviewAttachment } from './preview-attachment'

const normalizeOrLocalPreviewTarget = vi.fn()
const openPreview = vi.fn()
const downloadDeliveredFile = vi.fn()

vi.mock('@/lib/local-preview', () => ({
  normalizeOrLocalPreviewTarget: (...args: unknown[]) => normalizeOrLocalPreviewTarget(...args)
}))

vi.mock('@/lib/media', async () => {
  const actual = await vi.importActual<typeof MediaModule>('@/lib/media')

  return {
    ...actual,
    downloadDeliveredFile: (...args: unknown[]) => downloadDeliveredFile(...args)
  }
})

vi.mock('@/store/preview', async () => {
  const actual = await vi.importActual<typeof PreviewStore>('@/store/preview')

  return {
    ...actual,
    openPreview: (...args: unknown[]) => openPreview(...args)
  }
})

describe('PreviewAttachment', () => {
  afterEach(() => {
    cleanup()
    $previewTabs.set([])
    normalizeOrLocalPreviewTarget.mockReset()
    openPreview.mockReset()
    downloadDeliveredFile.mockReset()
  })

  it('paints a document card without opening the rail', () => {
    render(<PreviewAttachment source="tool-result" target="/tmp/sheet.xlsx" />)

    const card = document.querySelector('[data-slot="aui_document-card"]')

    expect(screen.getByText('sheet.xlsx')).toBeTruthy()
    expect(screen.getByText('Spreadsheet · XLSX')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open preview' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('data-variant')).toBe('chip')
    expect(screen.getByRole('button', { name: 'Download' }).getAttribute('data-variant')).toBe('chip')
    expect(card?.getAttribute('data-document-kind')).toBe('spreadsheet')
    expect(card?.getAttribute('data-document-tone')).toBe('green')
    expect(card?.className).toContain('border')
    expect(normalizeOrLocalPreviewTarget).not.toHaveBeenCalled()
    expect(openPreview).not.toHaveBeenCalled()
  })

  it('labels a PDF as Document · PDF with Open visible', () => {
    render(<PreviewAttachment source="tool-result" target="/tmp/brief.pdf" />)

    const card = document.querySelector('[data-slot="aui_document-card"]')

    expect(screen.getByText('brief.pdf')).toBeTruthy()
    expect(screen.getByText('Document · PDF')).toBeTruthy()
    expect(screen.queryByText('PDF · PDF')).toBeNull()
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(card?.getAttribute('data-document-kind')).toBe('document')
    expect(card?.getAttribute('data-document-tone')).toBe('red')
  })

  it('opens the existing preview rail when the card body is clicked', async () => {
    const preview = {
      kind: 'file' as const,
      label: 'brief.pdf',
      path: '/tmp/brief.pdf',
      previewKind: 'pdf' as const,
      source: '/tmp/brief.pdf',
      url: 'file:///tmp/brief.pdf'
    }

    normalizeOrLocalPreviewTarget.mockResolvedValue(preview)

    render(<PreviewAttachment source="tool-result" target="/tmp/brief.pdf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open preview' }))

    await waitFor(() => expect(openPreview).toHaveBeenCalledWith(preview, 'tool-result'))
    expect(normalizeOrLocalPreviewTarget).toHaveBeenCalledWith('/tmp/brief.pdf', undefined)
  })

  it('downloads from the card without opening the rail', async () => {
    downloadDeliveredFile.mockResolvedValue({ saved: true })

    render(<PreviewAttachment source="tool-result" target="/tmp/archive.zip" />)
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => expect(downloadDeliveredFile).toHaveBeenCalledWith('/tmp/archive.zip'))
    expect(openPreview).not.toHaveBeenCalled()
    expect(normalizeOrLocalPreviewTarget).not.toHaveBeenCalled()
  })
})
