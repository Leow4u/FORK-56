import beret from '@/assets/bot-characters/beret.webp'
import bowtie from '@/assets/bot-characters/bowtie.webp'
import cap from '@/assets/bot-characters/cap.webp'
import glasses from '@/assets/bot-characters/glasses.webp'
import headphones from '@/assets/bot-characters/headphones.webp'
import sunglasses from '@/assets/bot-characters/sunglasses.webp'

/** Ready-made faces. Stable shape IDs travel through the existing profile
 * metadata; the bundled artwork also works offline and on remote gateways. */
export const BOT_CHARACTERS = [
  { id: 'headphones', shape: 'character:headphones', color: '#2585ef', image: headphones },
  { id: 'sunglasses', shape: 'character:sunglasses', color: '#f57870', image: sunglasses },
  { id: 'glasses', shape: 'character:glasses', color: '#f2c532', image: glasses },
  { id: 'beret', shape: 'character:beret', color: '#945cf5', image: beret },
  { id: 'bowtie', shape: 'character:bowtie', color: '#36cda1', image: bowtie },
  { id: 'cap', shape: 'character:cap', color: '#ff861f', image: cap }
] as const

export type BotCharacterId = (typeof BOT_CHARACTERS)[number]['id']

export function botCharacter(shape: null | string | undefined) {
  return BOT_CHARACTERS.find(character => character.shape === shape)
}
