import { describe, expect, it } from 'vitest'

import { group, split } from '@/components/pane-shell/tree/model'

import { interactedChat, previewAreaAnchor } from './preview-tile'

const tree = split('row', [
  group(['workspace', 'session-tile:stacked'], { active: 'workspace', id: 'main' }),
  group(['session-tile:side'], { active: 'session-tile:side', id: 'tile' }),
  group(['preview-tile:file:file:///work/a.html', 'review'], { active: 'review', id: 'area' })
])

describe('interactedChat — the conversation the content area follows', () => {
  it('names the primary chat when the user works in it', () => {
    expect(interactedChat(tree, 'main', 'selected', 'selected')).toBeNull()
  })

  it('names the session tile the user works in', () => {
    expect(interactedChat(tree, 'tile', 'side', 'selected')).toBe('side')
  })

  it('names a session tile stacked into the primary zone when it is in front', () => {
    const stacked = split('row', [
      group(['workspace', 'session-tile:stacked'], { active: 'session-tile:stacked', id: 'main' })
    ])

    expect(interactedChat(stacked, 'main', 'stacked', 'selected')).toBe('stacked')
  })

  // Clicking the content area, a tool or the sidebar is not working in a
  // different conversation: the area keeps the one it follows.
  it('names no chat for anything that is not a chat', () => {
    expect(interactedChat(tree, 'area', 'selected', 'selected')).toBeUndefined()
    expect(interactedChat(tree, null, 'selected', 'selected')).toBeUndefined()
    expect(interactedChat(null, 'main', 'selected', 'selected')).toBeUndefined()
  })
})

describe('previewAreaAnchor — where a preview entering the layout lands', () => {
  const layout = split('row', [
    group(['workspace'], { active: 'workspace', id: 'main' }),
    group(['preview-tile:file:a', 'preview-tile:file:b'], { active: 'preview-tile:file:a', id: 'area' }),
    group(['preview-tile:url:browser'], { active: 'preview-tile:url:browser', id: 'side' })
  ])

  it("lands beside the tab in front, else beside the conversation's other tabs", () => {
    expect(previewAreaAnchor('file:new', layout, 'url:browser', ['file:a'])).toBe('preview-tile:url:browser')
    expect(previewAreaAnchor('file:new', layout, null, ['file:b'])).toBe('preview-tile:file:b')
  })

  // Coming back to a conversation whose front tab never entered the layout (an
  // agent opened it off screen): the tab entering can't anchor on itself.
  it('never anchors a tab on its own pane', () => {
    expect(previewAreaAnchor('file:a', layout, 'file:a', ['file:a'])).toBe('preview-tile:file:b')
  })

  it('has no anchor while there is no area yet', () => {
    expect(
      previewAreaAnchor('file:new', split('row', [group(['workspace'], { id: 'main' })]), null, [])
    ).toBeUndefined()
    expect(previewAreaAnchor('file:new', null, null, [])).toBeUndefined()
  })
})
