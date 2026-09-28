import { describe, expect, it } from 'vitest'

import { attachmentFolderKey, isComputerProjectPath, safeAttachRelative } from './attached-folder'

describe('attached folder', () => {
  it('treats a computer path as attachable and a cloud machine path as not', () => {
    expect(isComputerProjectPath('/Users/ada/Demo')).toBe(true)
    expect(isComputerProjectPath('C:\\Work\\Demo')).toBe(true)
    expect(isComputerProjectPath('/opt/work4you/attached/Demo')).toBe(false)
    expect(isComputerProjectPath('')).toBe(false)
  })

  it('keeps a relative path inside the chosen folder', () => {
    expect(safeAttachRelative('/Users/ada/Demo', '/Users/ada/Demo/src/app.ts')).toBe('src/app.ts')
    expect(safeAttachRelative('/Users/ada/Demo', '/Users/ada/other/app.ts')).toBeNull()
    expect(safeAttachRelative('/Users/ada/Demo', '/Users/ada/Demo/.env')).toBeNull()
  })

  it('names the remote folder after the computer folder', () => {
    expect(attachmentFolderKey('/Users/ada/My Demo/')).toBe('My-Demo')
  })
})
