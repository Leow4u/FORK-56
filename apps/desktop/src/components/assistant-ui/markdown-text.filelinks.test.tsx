import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MarkdownTextContent } from './markdown-text'

// Regression for #82140: a plain filesystem href in assistant markdown
// (`[report](/home/user/report.md)`) rendered as a bare dead anchor —
// file:// is blocked in the renderer, and on a remote gateway the path
// isn't on this disk at all. Such links must route through the preview
// pipeline (PreviewAttachment → normalizeOrLocalPreviewTarget), which
// resolves the path at VIEW time against the session's backend: local
// connections read the file directly, remote connections fetch it over the
// authenticated /api/fs bridge. Media-extension paths keep their inline
// player instead.
describe('MarkdownLink filesystem hrefs', () => {
  afterEach(cleanup)

  it('routes an absolute file path link through the preview attachment', async () => {
    render(<MarkdownTextContent isRunning={false} text="Wrote it: [report](/home/user/report.md)" />)

    // PreviewAttachment paints the filename + an Open preview button —
    // that's the view-time door, not a dead <a>.
    await screen.findByText('report.md')
    expect(screen.getByRole('button', { name: 'Open preview' })).toBeTruthy()
    expect(document.querySelector('a[href="/home/user/report.md"]')).toBeNull()
  })

  it('routes file:// and ~/ links the same way', async () => {
    render(
      <MarkdownTextContent isRunning={false} text={'See [notes](file:///srv/data/notes.txt) and [todo](~/todo.md)'} />
    )

    await screen.findByText('notes.txt')
    await screen.findByText('todo.md')
    expect(screen.getAllByRole('button', { name: 'Open preview' })).toHaveLength(2)
  })

  it('renders a media player for a media-extension path link', async () => {
    const { container } = render(<MarkdownTextContent isRunning={false} text="[clip](/tmp/demo.mp4)" />)

    await waitFor(() => expect(container.querySelector('video')).not.toBeNull())
    expect(container.querySelector('a[href="/tmp/demo.mp4"]')).toBeNull()
  })

  it('leaves anchors, relative markdown, and http links out of the preview pipeline', () => {
    render(
      <MarkdownTextContent
        isRunning={false}
        text={'[frag](#section-2) and [rel](docs/guide.md) and [site](https://example.com)'}
      />
    )

    // Fragment anchors survive untouched; relative `.md` and http stay on
    // Streamdown's existing path — they do not become document cards.
    expect(screen.queryByRole('button', { name: 'Open preview' })).toBeNull()
    expect(document.querySelector('a[href="#section-2"]')).not.toBeNull()
  })

  it('routes a relative office/pdf/zip link to a document card instead of [blocked]', async () => {
    render(<MarkdownTextContent isRunning={false} text={'Baixar a planilha [nomes_rg_cpf.xlsx](nomes_rg_cpf.xlsx)'} />)

    expect(await screen.findByText('nomes_rg_cpf.xlsx')).toBeTruthy()
    expect(screen.getByText('Spreadsheet · XLSX')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open preview' })).toBeTruthy()
    expect(screen.queryByText(/blocked/i)).toBeNull()
    expect(document.querySelector('a[href="nomes_rg_cpf.xlsx"]')).toBeNull()
  })

  it.each([
    '[Baixar o arquivo Excel](nomes.xlsx "planilha")',
    '[Baixar o arquivo Excel](nomes.xls)',
    '[Baixar o arquivo Excel](nomes.csv)',
    '<a href="nomes.xlsx">Baixar o arquivo Excel</a>',
    '[Baixar o arquivo Excel](sandbox:/tmp/nomes.xlsx)',
    '[Baixar o arquivo Excel](<nome rg cpf.xlsx>)'
  ])('turns the live Excel download markdown into a card instead of [blocked]: %s', async text => {
    render(<MarkdownTextContent isRunning={false} text={text} />)

    expect(await screen.findByRole('button', { name: 'Open preview' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy()
    expect(screen.getByText(/Spreadsheet · /)).toBeTruthy()
    expect(screen.queryByText(/blocked/i)).toBeNull()
    expect(document.body.textContent).not.toContain('Baixar o arquivo Excel [blocked]')
  })

  it('does not mint a document card for an extensionless download href', () => {
    render(<MarkdownTextContent isRunning={false} text="[Baixar o arquivo Excel](download)" />)

    expect(screen.queryByRole('button', { name: 'Open preview' })).toBeNull()
    expect(screen.queryByText('Spreadsheet · XLSX')).toBeNull()
  })
})
