import { describe, expect, it } from 'vitest'

import {
  AVATAR_SHAPES,
  BLOB_KIND_TRAIT,
  BLOB_KINDS,
  blobMarkup,
  blobShapeString,
  botAppearance,
  defaultShapeFor,
  facePose,
  isBlobShape,
  isDarkColor,
  parseBlobShape,
  PRIMARY_BOT_APPEARANCE,
  projectFacePoint,
  ringToPath,
  sampleFaceRing
} from './bot-avatar'
import { profileColor } from './profile-color'

describe('blob shape strings', () => {
  it('round-trip through parse/build', () => {
    expect(isBlobShape('blobatar')).toBe(true)
    expect(isBlobShape('blobatar:seed123')).toBe(true)
    expect(isBlobShape('blobatar::sun')).toBe(true)
    expect(isBlobShape('circle')).toBe(false)
    expect(isBlobShape(undefined)).toBe(false)

    // Unlocked: seed follows the name.
    expect(parseBlobShape('blobatar', 'inbox-triage')).toEqual({ kind: '', seed: 'inbox-triage', seedPart: '' })
    // Locked seed.
    expect(parseBlobShape('blobatar:abc123', 'inbox-triage')).toEqual({ kind: '', seed: 'abc123', seedPart: 'abc123' })
    // Pinned silhouette, unlocked seed.
    expect(parseBlobShape('blobatar::cloud', 'inbox-triage')).toEqual({
      kind: 'cloud',
      seed: 'inbox-triage',
      seedPart: ''
    })
    // Unknown silhouette is ignored, never trusted.
    expect(parseBlobShape('blobatar:abc:mystery', 'x').kind).toBe('')

    expect(blobShapeString('', '')).toBe('blobatar')
    expect(blobShapeString('abc', '')).toBe('blobatar:abc')
    expect(blobShapeString('abc', 'sun')).toBe('blobatar:abc:sun')
    expect(blobShapeString('', 'sun')).toBe('blobatar::sun')

    for (const kind of BLOB_KINDS) {
      expect(parseBlobShape(blobShapeString('s', kind), 'n').kind).toBe(kind)
      expect(BLOB_KIND_TRAIT[kind]).toBeGreaterThan(0)
    }
  })

  it('blobMarkup tags the face for the PNG backfill and is stable per seed', () => {
    const markup = blobMarkup('blobatar', 'inbox-triage', 56)

    expect(markup).toContain('<svg data-bot-face="inbox-triage" ')
    expect(markup).toBe(blobMarkup('blobatar', 'inbox-triage', 56))
    // A locked seed draws the same face whatever the bot is called.
    expect(blobMarkup('blobatar:abc', 'one', 32)?.replace('"one"', '"two"')).toBe(blobMarkup('blobatar:abc', 'two', 32))
    // Pinning a silhouette changes the drawing.
    expect(blobMarkup('blobatar::sun', 'inbox-triage', 32)).not.toBe(blobMarkup('blobatar::round', 'inbox-triage', 32))
  })
})

describe('botAppearance', () => {
  it('rolls a shape and the profile hue from the name when nothing is stored', () => {
    const look = botAppearance('perfil-novo')

    expect(look.shape).toBe(defaultShapeFor('perfil-novo'))
    expect(AVATAR_SHAPES).toContain(look.shape)
    expect(look.color).toBe(profileColor('perfil-novo'))
    expect(look.image).toBeNull()
    // Deterministic: the same name always draws the same bot.
    expect(botAppearance('perfil-novo')).toEqual(look)
  })

  it('gives the primary profile its fixed friendly look until the person customizes it', () => {
    expect(botAppearance('default')).toEqual({ ...PRIMARY_BOT_APPEARANCE, image: null })
    expect(botAppearance('Default ')).toEqual({ ...PRIMARY_BOT_APPEARANCE, image: null })
    // A stored look without `custom` is an auto-seed, not a choice: ignored.
    expect(botAppearance('default', { color: '#000000', shape: 'drop' })).toEqual({
      ...PRIMARY_BOT_APPEARANCE,
      image: null
    })
    // An image always wins, custom or not.
    expect(botAppearance('default', { image: 'data:image/png;base64,x' }).image).toBe('data:image/png;base64,x')
    // An explicit editor save wins.
    expect(botAppearance('default', { color: '#000000', custom: true, shape: 'drop' })).toEqual({
      color: '#000000',
      image: null,
      shape: 'drop'
    })
  })

  it('lets stored picks override the rolled look', () => {
    expect(botAppearance('research', { color: '#ef4444', shape: 'blobatar::sun' })).toEqual({
      color: '#ef4444',
      image: null,
      shape: 'blobatar::sun'
    })
    expect(botAppearance('research', { shape: 'cloud' }).color).toBe(profileColor('research'))
  })
})

describe('face geometry', () => {
  it('samples a closed outline for every shape and projects it in place', () => {
    for (const shape of [...AVATAR_SHAPES, 'blob', 'pebble', 'cube', 'sigil-3', 'unknown']) {
      const ring = sampleFaceRing(shape)

      expect(ring.length).toBeGreaterThanOrEqual(40)

      // Outlines live in the 40×40 box; a few corners (the triangle's apex,
      // the blob's lobes) poke just past it, which the face's visible
      // overflow absorbs.
      for (const [x, y] of ring) {
        expect(x).toBeGreaterThanOrEqual(-6)
        expect(x).toBeLessThanOrEqual(46)
        expect(y).toBeGreaterThanOrEqual(-6)
        expect(y).toBeLessThanOrEqual(46)
      }

      const path = ringToPath(ring)

      expect(path.startsWith('M')).toBe(true)
      expect(path.endsWith('Z')).toBe(true)
    }

    expect(ringToPath([])).toBe('')
    // No pose → the point stays put; a turned head narrows it toward the axis.
    expect(projectFacePoint(30, 20, 0, 0, 0)).toEqual([30, 20])
    expect(projectFacePoint(30, 20, 90, 0, 0)[0]).toBeLessThan(30)
  })

  it('poses: idle breathes quietly, work leans with thinking dots and blinks faster', () => {
    const idle = facePose('idle', 0)
    const work = facePose('work', 0)

    expect(idle.d0 + idle.d1 + idle.d2).toBe(0)
    expect(Math.abs(idle.turn)).toBeLessThan(2)
    expect(work.turn).toBeLessThan(-2)
    expect(work.d0).toBeGreaterThan(0)
    // Blinks exist in both moods.
    expect(facePose('idle', 3.1).blink).toBe(true)
    expect(facePose('work', 1.3).blink).toBe(true)
    expect(facePose('idle', 1).blink).toBe(false)
  })
})

describe('isDarkColor', () => {
  it('flips the eyes on dark bodies only', () => {
    expect(isDarkColor('#000000')).toBe(true)
    expect(isDarkColor('#3b40c8')).toBe(true)
    expect(isDarkColor('#f5f5f4')).toBe(false)
    expect(isDarkColor('#f97316')).toBe(false)
  })
})
