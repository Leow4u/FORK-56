import beretClean from '@/assets/bot-characters/beret-clean.webp'
import beret from '@/assets/bot-characters/beret.webp'
import bowtieClean from '@/assets/bot-characters/bowtie-clean.webp'
import bowtie from '@/assets/bot-characters/bowtie.webp'
import capClean from '@/assets/bot-characters/cap-clean.webp'
import cap from '@/assets/bot-characters/cap.webp'
import glassesClean from '@/assets/bot-characters/glasses-clean.webp'
import glasses from '@/assets/bot-characters/glasses.webp'
import headphonesClean from '@/assets/bot-characters/headphones-clean.webp'
import headphones from '@/assets/bot-characters/headphones.webp'
import sunglasses from '@/assets/bot-characters/sunglasses.webp'

interface CharacterEye {
  x: number
  y: number
  rx: number
  ry: number
}

/** Eye registration in the original 256px illustration. The clean plate
 * only paints beneath these small patches, keeping the approved art intact. */
interface CharacterArtwork {
  id: string
  shape: string
  color: string
  image: string
  cleanImage: string | null
  eyes: readonly CharacterEye[] | null
}

/** Ready-made faces. Stable shape IDs travel through the existing profile
 * metadata; the bundled artwork also works offline and on remote gateways. */
export const BOT_CHARACTERS = [
  {
    id: 'headphones',
    shape: 'character:headphones',
    color: '#2585ef',
    image: headphones,
    cleanImage: headphonesClean,
    eyes: [
      { x: 136, y: 139, rx: 10, ry: 16 },
      { x: 176, y: 137, rx: 9, ry: 16 }
    ]
  },
  {
    id: 'sunglasses',
    shape: 'character:sunglasses',
    color: '#f57870',
    image: sunglasses,
    cleanImage: null,
    eyes: null
  },
  {
    id: 'glasses',
    shape: 'character:glasses',
    color: '#f2c532',
    image: glasses,
    cleanImage: glassesClean,
    eyes: [
      { x: 113, y: 143, rx: 11, ry: 18 },
      { x: 186, y: 138, rx: 11, ry: 18 }
    ]
  },
  {
    id: 'beret',
    shape: 'character:beret',
    color: '#945cf5',
    image: beret,
    cleanImage: beretClean,
    eyes: [
      { x: 128, y: 147, rx: 10, ry: 17 },
      { x: 172, y: 144, rx: 10, ry: 17 }
    ]
  },
  {
    id: 'bowtie',
    shape: 'character:bowtie',
    color: '#36cda1',
    image: bowtie,
    cleanImage: bowtieClean,
    eyes: [
      { x: 108, y: 119, rx: 11, ry: 18 },
      { x: 153, y: 118, rx: 11, ry: 18 }
    ]
  },
  {
    id: 'cap',
    shape: 'character:cap',
    color: '#ff861f',
    image: cap,
    cleanImage: capClean,
    eyes: [
      { x: 115, y: 144, rx: 10, ry: 17 },
      { x: 156, y: 139, rx: 10, ry: 17 }
    ]
  }
] as const satisfies readonly CharacterArtwork[]

export type BotCharacterId = (typeof BOT_CHARACTERS)[number]['id']
export type BotCharacter = (typeof BOT_CHARACTERS)[number]

export function botCharacter(shape: null | string | undefined) {
  return BOT_CHARACTERS.find(character => character.shape === shape)
}
