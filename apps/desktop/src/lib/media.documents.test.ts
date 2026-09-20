import { describe, expect, it } from 'vitest'

import {
  documentExtensionLabel,
  documentKindLabel,
  formatByteSize,
  isDeliveredDocumentPath,
  isMarkdownDocumentPath,
  isRelativeDeliveredDocumentHref,
  pathExtension,
  resolveDeliveredDocumentHref
} from './media'

describe('pathExtension', () => {
  it('reads the last extension, ignoring query strings and Windows paths', () => {
    expect(pathExtension('/tmp/report.md')).toBe('md')
    expect(pathExtension('/tmp/report.md?x=1')).toBe('md')
    expect(pathExtension('C:\\Users\\a\\report.MD')).toBe('md')
    expect(pathExtension('file:///tmp/orcamento.xlsx')).toBe('xlsx')
  })

  it('returns empty when there is no real extension', () => {
    expect(pathExtension('/tmp/README')).toBe('')
    expect(pathExtension('.gitignore')).toBe('')
  })
})

describe('delivered document classification', () => {
  it('keeps markdown detection to markdown extensions', () => {
    expect(isMarkdownDocumentPath('/tmp/report.md')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/notes.markdown')).toBe(true)
    expect(isMarkdownDocumentPath('/tmp/archive.zip')).toBe(false)
    expect(isMarkdownDocumentPath('/tmp/sheet.xlsx')).toBe(false)
  })

  it('routes markdown, PDF, Office, and zip as delivered documents', () => {
    expect(isDeliveredDocumentPath('/tmp/report.md')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/brief.pdf')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/sheet.xlsx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/legacy.xls')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/macro.xlsm')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/rows.csv')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/calc.ods')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/letter.docx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/deck.pptx')).toBe(true)
    expect(isDeliveredDocumentPath('/tmp/archive.zip')).toBe(true)
  })

  it('leaves images, audio, video, and extension-less names out', () => {
    expect(isDeliveredDocumentPath('/tmp/clip.mp4')).toBe(false)
    expect(isDeliveredDocumentPath('/tmp/pic.png')).toBe(false)
    expect(isDeliveredDocumentPath('/tmp/note.mp3')).toBe(false)
    expect(isDeliveredDocumentPath('/tmp/README')).toBe(false)
    expect(isDeliveredDocumentPath('/tmp/notes.txt')).toBe(false)
  })

  it('labels long markdown aliases as MD and others as uppercase', () => {
    expect(documentExtensionLabel('/tmp/notes.markdown')).toBe('MD')
    expect(documentExtensionLabel('/tmp/sheet.xlsx')).toBe('XLSX')
    expect(documentExtensionLabel('/tmp/brief.pdf')).toBe('PDF')
  })

  it('names the delivered-document kind for the card subtitle', () => {
    expect(documentKindLabel('nomes_rg_cpf.xlsx')).toBe('Spreadsheet')
    expect(documentKindLabel('nomes.xls')).toBe('Spreadsheet')
    expect(documentKindLabel('nomes.csv')).toBe('Spreadsheet')
    expect(documentKindLabel('/tmp/brief.pdf')).toBe('PDF')
    expect(documentKindLabel('letter.docx')).toBe('Document')
    expect(documentKindLabel('deck.pptx')).toBe('Presentation')
    expect(documentKindLabel('archive.zip')).toBe('Archive')
  })
})

describe('relative delivered-document hrefs', () => {
  it('accepts relative office/pdf/zip names the model actually emits', () => {
    expect(isRelativeDeliveredDocumentHref('nomes_rg_cpf.xlsx')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('nomes.xls')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('nomes.csv')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('./brief.pdf')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('out/letter.docx')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('deck.pptx')).toBe(true)
    expect(isRelativeDeliveredDocumentHref('archive.zip')).toBe(true)
  })

  it('leaves markdown, http, fragments, and absolute paths to their own routers', () => {
    expect(isRelativeDeliveredDocumentHref('docs/guide.md')).toBe(false)
    expect(isRelativeDeliveredDocumentHref('https://example.com/sheet.xlsx')).toBe(false)
    expect(isRelativeDeliveredDocumentHref('#preview/nomes.xlsx')).toBe(false)
    expect(isRelativeDeliveredDocumentHref('/tmp/sheet.xlsx')).toBe(false)
    expect(isRelativeDeliveredDocumentHref('C:\\Users\\a\\sheet.xlsx')).toBe(false)
    expect(isRelativeDeliveredDocumentHref('download')).toBe(false)
  })
})

describe('resolveDeliveredDocumentHref', () => {
  it('unwraps titled-link leftovers, sandbox wrappers, and angle brackets', () => {
    expect(resolveDeliveredDocumentHref('nomes.xlsx')).toBe('nomes.xlsx')
    expect(resolveDeliveredDocumentHref('<nome rg cpf.xlsx>')).toBe('nome rg cpf.xlsx')
    expect(resolveDeliveredDocumentHref('sandbox:/tmp/nomes.xlsx')).toBe('/tmp/nomes.xlsx')
    expect(resolveDeliveredDocumentHref('sandbox:nomes.xls')).toBe('nomes.xls')
  })

  it('leaves extensionless download hrefs and http alone so harden can keep blocking them', () => {
    expect(resolveDeliveredDocumentHref('download')).toBeNull()
    expect(resolveDeliveredDocumentHref('https://example.com/a.xlsx')).toBeNull()
    expect(resolveDeliveredDocumentHref('docs/guide.md')).toBeNull()
  })
})

describe('formatByteSize', () => {
  it('picks a unit without inventing fractional bytes', () => {
    expect(formatByteSize(0)).toBe('0 B')
    expect(formatByteSize(512)).toBe('512 B')
    expect(formatByteSize(1024)).toBe('1.0 KB')
    expect(formatByteSize(10 * 1024)).toBe('10 KB')
    expect(formatByteSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
