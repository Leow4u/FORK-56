import { describe, expect, it } from 'vitest'

import { characterPhase, characterPose, paintCharacterFace, reactCharacter } from './bot-character-motion'

function face() {
  const root = document.createElement('span')

  root.dataset.hbMood = 'idle'
  root.innerHTML =
    '<img src="original.webp" data-bot-face="agent"><svg data-character-eyes data-ready="true"><g data-character-eye data-eye-x="128" data-eye-y="140"></g></svg>'

  return root
}

describe('character motion', () => {
  it('closes and reopens the eyes while keeping breathing and posture subtle', () => {
    const poses = Array.from({ length: 100 }, (_, i) => characterPose('idle', i / 15))

    expect(Math.min(...poses.map(p => p.eyes))).toBeLessThan(0.15)
    expect(poses.at(-1)?.eyes).toBe(1)

    for (const pose of poses) {
      expect(Math.abs(pose.tilt)).toBeLessThan(1)
      expect(pose.scaleY).toBeGreaterThan(0.98)
      expect(pose.scaleY).toBeLessThan(1.02)
    }

    expect(new Set(poses.map(p => p.scaleY)).size).toBeGreaterThan(1)
  })

  it('uses the actual work mood for a more attentive gaze and head movement', () => {
    const idle = characterPose('idle', 1)
    const working = characterPose('work', 1)

    expect(working.gazeY).toBeLessThan(idle.gazeY)
    expect(Math.abs(working.tilt)).toBeGreaterThan(Math.abs(idle.tilt))
  })

  it('offsets different profiles and characters while keeping the same identity stable', () => {
    expect(characterPhase('a', 'cap')).toBe(characterPhase('a', 'cap'))
    expect(characterPhase('a', 'cap')).not.toBe(characterPhase('b', 'cap'))
    expect(characterPhase('a', 'cap')).not.toBe(characterPhase('a', 'beret'))
  })

  it('animates individual eyes without changing the original snapshot image', () => {
    const root = face()
    const image = root.querySelector('img')

    paintCharacterFace(root, 1)
    const open = root.querySelector('g')?.getAttribute('transform')

    paintCharacterFace(root, 4.5)
    expect(root.querySelector('g')?.getAttribute('transform')).not.toBe(open)
    expect(image?.getAttribute('src')).toBe('original.webp')
    expect(image?.getAttribute('style')).toBeNull()
  })

  it('keeps reactions local, lets them finish, and clears them for reduced motion', () => {
    const activated = face()
    const sibling = face()

    reactCharacter(activated, 'press', 1000)
    paintCharacterFace(activated, 1.3)
    paintCharacterFace(sibling, 1.3)
    expect(activated.style.transform).not.toBe(sibling.style.transform)

    paintCharacterFace(activated, 2.1)
    paintCharacterFace(sibling, 2.1)
    expect(activated.style.transform).toBe(sibling.style.transform)

    reactCharacter(activated, 'press', 3000)
    paintCharacterFace(activated, 3.1, true)
    expect(activated.style.transform).toBe('')
    expect(activated.querySelector('svg')?.style.visibility).toBe('hidden')
    paintCharacterFace(activated, 3.2)
    paintCharacterFace(sibling, 3.2)
    expect(activated.style.transform).toBe(sibling.style.transform)
  })

  it('keeps the original face visible when the clean plate has not loaded', () => {
    const root = face()
    const overlay = root.querySelector('svg')!

    overlay.dataset.ready = 'false'
    paintCharacterFace(root, 4.5)
    expect(overlay.style.visibility).toBe('hidden')
    expect(root.querySelector('img')?.getAttribute('src')).toBe('original.webp')
    overlay.dataset.ready = 'true'
    paintCharacterFace(root, 4.5)
    expect(overlay.style.visibility).toBe('visible')
  })
})
