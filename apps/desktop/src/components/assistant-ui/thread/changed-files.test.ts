import { describe, expect, it } from 'vitest'

import { deriveChangedFiles } from './changed-files'

describe('deriveChangedFiles', () => {
  it('sums diffs for the same path and keeps first-touch order', () => {
    const files = deriveChangedFiles([
      {
        type: 'tool-call',
        toolName: 'patch',
        args: { path: 'src/a.ts' },
        result: { inline_diff: '+one\n-old\n+two' }
      },
      {
        type: 'tool-call',
        toolName: 'write_file',
        args: { path: 'deck.pptx' },
        result: { path: 'deck.pptx' }
      },
      {
        type: 'tool-call',
        toolName: 'patch',
        args: { path: 'src/a.ts' },
        result: { inline_diff: '+three' }
      }
    ])

    expect(files).toEqual([
      { added: 3, name: 'a.ts', path: 'src/a.ts', removed: 1 },
      { added: 0, name: 'deck.pptx', path: 'deck.pptx', removed: 0 }
    ])
  })

  // What a row keeps of a diff is capped at ~80 lines, so a big file's +N
  // comes from the counts the gateway took over the whole edit.
  it('takes the whole edit line counts over the capped diff', () => {
    expect(
      deriveChangedFiles([
        {
          type: 'tool-call',
          toolName: 'write_file',
          args: { path: 'site/index.html' },
          result: {
            diff_stats: { added: 300, removed: 0 },
            inline_diff: '@@ -0,0 +1,300 @@\n+<p>0</p>\n+<p>1</p>'
          }
        }
      ])
    ).toEqual([{ added: 300, name: 'index.html', path: 'site/index.html', removed: 0 }])
  })

  it('skips failed or still-running edits', () => {
    expect(
      deriveChangedFiles([
        { type: 'tool-call', toolName: 'write_file', args: { path: 'a.ts' }, isError: true },
        { type: 'tool-call', toolName: 'write_file', args: { path: 'b.ts' }, result: { success: false } },
        { type: 'tool-call', toolName: 'read_file', args: { path: 'c.ts' }, result: { content: 'x' } }
      ])
    ).toEqual([])
  })
})
