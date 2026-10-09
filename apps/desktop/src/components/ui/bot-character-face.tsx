import { type CSSProperties, useEffect, useId, useRef } from 'react'

import type { BotMood } from '@/lib/bot-avatar'
import { characterPhase, reactCharacter } from '@/lib/bot-character-motion'
import type { BotCharacter } from '@/lib/bot-characters'
import { startFaceClock } from '@/lib/bot-face-clock'

interface BotCharacterFaceProps {
  character: BotCharacter
  mood: BotMood
  name: string
  size: number
}

/** Keep the original illustration and its snapshot contract. A small,
 * feathered clean plate under each eye lets the original glossy pupils
 * blink/look around without replacing the character or its accessories. */
export function BotCharacterFace({ character, mood, name, size }: BotCharacterFaceProps) {
  const face = useRef<HTMLSpanElement>(null)
  const id = useId().replace(/:/g, '')
  const eyes = character.eyes

  useEffect(() => {
    const element = face.current

    if (!element) {
      return
    }

    // React to the whole existing hit target, including keyboard activation.
    // The preview can respond to a pointer without becoming another tab stop.
    const target = element.closest('button, a, [role="button"], [role="option"]') ?? element

    const react = (kind: 'greet' | 'press') => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        return
      }

      reactCharacter(element, kind)
      startFaceClock()
    }

    const greet = () => react('greet')
    const press = () => react('press')

    target.addEventListener('pointerenter', greet)
    target.addEventListener('focusin', greet)
    target.addEventListener('click', press)
    startFaceClock()

    return () => {
      target.removeEventListener('pointerenter', greet)
      target.removeEventListener('focusin', greet)
      target.removeEventListener('click', press)
    }
  }, [])

  return (
    <span
      aria-hidden
      className="bot-character-face"
      data-bot-character={character.id}
      data-hb-character={character.id}
      data-hb-mood={mood}
      data-hb-phase={characterPhase(name, character.id)}
      ref={face}
      style={
        {
          '--bot-character-size': `${size}px`,
          display: 'block',
          overflow: 'hidden',
          position: 'relative',
          flexShrink: 0,
          width: 'var(--bot-character-display-size, var(--bot-character-size))',
          height: 'var(--bot-character-display-size, var(--bot-character-size))',
          transformOrigin: '50% 75%'
        } as CSSProperties
      }
    >
      <img
        alt=""
        data-bot-face={name}
        draggable={false}
        height={size}
        src={character.image}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        width={size}
      />
      {eyes && character.cleanImage ? (
        <svg
          aria-hidden
          data-character-eyes
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            pointerEvents: 'none',
            visibility: 'hidden'
          }}
          viewBox="0 0 256 256"
        >
          <defs>
            <radialGradient id={`${id}-feather`}>
              <stop offset="72%" stopColor="white" />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </radialGradient>
            <mask height={256} id={`${id}-clean`} maskUnits="userSpaceOnUse" width={256} x={0} y={0}>
              {eyes.map((eye, i) => (
                <ellipse cx={eye.x} cy={eye.y} fill={`url(#${id}-feather)`} key={i} rx={eye.rx + 7} ry={eye.ry + 8} />
              ))}
            </mask>
            {eyes.map((eye, i) => (
              <mask height={256} id={`${id}-eye-${i}`} key={i} maskUnits="userSpaceOnUse" width={256} x={0} y={0}>
                <ellipse cx={eye.x} cy={eye.y} fill={`url(#${id}-feather)`} rx={eye.rx + 3} ry={eye.ry + 3} />
              </mask>
            ))}
          </defs>
          <image
            height={256}
            href={character.cleanImage}
            mask={`url(#${id}-clean)`}
            onError={event => {
              const overlay = event.currentTarget.ownerSVGElement

              if (overlay) {
                overlay.dataset.ready = 'false'
                overlay.style.visibility = 'hidden'
              }
            }}
            onLoad={event => {
              const overlay = event.currentTarget.ownerSVGElement

              if (overlay) {
                overlay.dataset.ready = 'true'
              }
            }}
            width={256}
          />
          {eyes.map((eye, i) => (
            <g data-character-eye data-eye-x={eye.x} data-eye-y={eye.y} key={i}>
              <image height={256} href={character.image} mask={`url(#${id}-eye-${i})`} width={256} />
            </g>
          ))}
        </svg>
      ) : null}
    </span>
  )
}
