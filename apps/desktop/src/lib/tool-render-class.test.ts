import { describe, expect, it } from 'vitest'

import { isSilentTool, isSilentToolCall } from './tool-render-class'

describe('isSilentToolCall', () => {
  it('holds for a silent tool that landed and for nothing else', () => {
    for (const toolName of ['todo', 'react_to_message']) {
      expect(isSilentTool(toolName)).toBe(true)
      expect(isSilentToolCall({ toolName })).toBe(true)
      // A failure has something to say, so it is an ordinary row again.
      expect(isSilentToolCall({ isError: true, toolName })).toBe(false)
    }

    expect(isSilentToolCall({ toolName: 'read_file' })).toBe(false)
    expect(isSilentToolCall({})).toBe(false)
  })
})
