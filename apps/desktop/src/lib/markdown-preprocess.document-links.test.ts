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

  it('rewrites the titled Excel download the live app still blocks', () => {
    const out = preprocessMarkdown('[Baixar o arquivo Excel](nomes.xlsx "planilha")')

    expect(out).toContain(previewMarkdownHref('nomes.xlsx'))
    expect(out).not.toContain('(nomes.xlsx "planilha")')
  })

  it('rewrites .xls, .csv, HTML <a>, sandbox, and angle-bracket names', () => {
    expect(preprocessMarkdown('[Baixar o arquivo Excel](nomes.xls)')).toContain(previewMarkdownHref('nomes.xls'))
    expect(preprocessMarkdown('[Baixar o arquivo Excel](nomes.csv)')).toContain(previewMarkdownHref('nomes.csv'))
    expect(preprocessMarkdown('<a href="nomes.xlsx">Baixar o arquivo Excel</a>')).toContain(
      previewMarkdownHref('nomes.xlsx')
    )
    expect(preprocessMarkdown('[Baixar o arquivo Excel](sandbox:/tmp/nomes.xlsx)')).toContain(
      previewMarkdownHref('/tmp/nomes.xlsx')
    )
    expect(preprocessMarkdown('[Baixar o arquivo Excel](<nome rg cpf.xlsx>)')).toContain(
      previewMarkdownHref('nome rg cpf.xlsx')
    )
  })

  it('does not invent a card for an extensionless download href', () => {
    const out = preprocessMarkdown('[Baixar o arquivo Excel](download)')

    expect(out).toContain('(download)')
    expect(out).not.toContain('#preview/')
  })
})
