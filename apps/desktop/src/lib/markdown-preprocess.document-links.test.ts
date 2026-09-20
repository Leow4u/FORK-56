import { describe, expect, it } from 'vitest'

import { preprocessMarkdown } from './markdown-preprocess'
import { previewMarkdownHref } from './preview-targets'

describe('preprocessMarkdown document links', () => {
  it('rewrites relative office/pdf/zip hrefs to the preview hash before harden', () => {
    const out = preprocessMarkdown('Baixar a planilha [nomes_rg_cpf.xlsx](nomes_rg_cpf.xlsx)')

    expect(out).toContain(previewMarkdownHref('nomes_rg_cpf.xlsx'))
    expect(out).not.toContain('(nomes_rg_cpf.xlsx)')
  })

  it('still rewrites absolute filesystem hrefs', () => {
    const out = preprocessMarkdown('Wrote it: [report](/home/user/report.md)')

    expect(out).toContain(previewMarkdownHref('/home/user/report.md'))
  })

  it('does not rewrite relative markdown, fragments, or http', () => {
    const out = preprocessMarkdown('[rel](docs/guide.md) [frag](#section-2) [site](https://example.com/a.xlsx)')

    expect(out).toContain('(docs/guide.md)')
    expect(out).toContain('(#section-2)')
    expect(out).toContain('(https://example.com/a.xlsx)')
    expect(out).not.toContain('#preview/')
  })
})
