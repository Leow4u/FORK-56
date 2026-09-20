import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { isDeliveredDocumentPath, isMarkdownDocumentPath, mediaMarkdownHref } from '@/lib/media'

import { MarkdownTextContent } from './markdown-text'

// Regression for #84951: a `.md` delivered via MEDIA has no entry in
// MEDIA_BY_EXT, so it classified as a generic 'file' and rendered as a
// download-style link. Markdown is renderable content — it must route to the
// preview rail (which renders .md with a rendered/source toggle) instead.
// The same rail already handles PDF (iframe) and Office/zip (binary
// empty-state), so those MEDIA deliveries use the same preview card.
describe('documents delivered via MEDIA', () => {
  afterEach(cleanup)

  it('classifies markdown extensions as markdown documents', () => {
    expect(isMarkdownDocumentPath('/tmp/report.md')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/notes.markdown')).toBe(true)
    expect(isMarkdownDocumentPath('C:\\Users\\a\\report.MD')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/report.md?x=1')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/archive.zip')).toBe(false)
    expect(isMarkdownDocumentPath('/tmp/clip.mp4')).toBe(false)
    expect(isMarkdownDocumentPath('/tmp/README')).toBe(false)
  })

  it('classifies pdf/office/zip as delivered documents without widening markdown', () => {
    expect(isDeliveredDocumentPath('/tmp/brief.pdf')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/sheet.xlsx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/letter.docx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/deck.pptx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/archive.zip')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/brief.pdf')).toBe(false)
  })

  it('renders a MEDIA .md as a preview attachment, not a download link', async () => {
    const href = mediaMarkdownHref('/home/user/out/report.md')

    render(<MarkdownTextContent isRunning={false} text={`[report.md](${href})`} />)

    // PreviewAttachment renders an "open preview" toggle; the old
    // MediaAttachment 'file' fallback rendered a bare "Open ..." anchor.
    expect(await screen.findByRole('button', { name: 'Open preview' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.queryByText(/^Loading /)).toBeNull()
    expect(screen.getByText('report.md')).toBeTruthy()
  })

  it.each(['brief.pdf', 'sheet.xlsx', 'legacy.xls', 'rows.csv', 'letter.docx', 'deck.pptx', 'archive.zip'])(
    'renders a MEDIA %s as a preview attachment, not a download link',
    async name => {
      const href = mediaMarkdownHref(`/home/user/out/${name}`)

      render(<MarkdownTextContent isRunning={false} text={`[${name}](${href})`} />)

      expect(await screen.findByRole('button', { name: 'Open preview' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
      expect(screen.queryByText(/^Loading /)).toBeNull()
      expect(screen.getByText(name)).toBeTruthy()
    }
  )

  it('still renders a non-document MEDIA file through the media fallback', async () => {
    const href = mediaMarkdownHref('/home/user/out/notes.txt')

    render(<MarkdownTextContent isRunning={false} text={`[notes.txt](${href})`} />)

    expect(await screen.findByText(/notes\.txt/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Open preview' })).toBeNull()
  })
})
