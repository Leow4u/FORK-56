import { describe, expect, it } from 'vitest'

import {
  documentExtensionLabel,
  formatByteSize,
  isDeliveredDocumentPath,
  isMarkdownDocumentPath,
  pathExtension
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
