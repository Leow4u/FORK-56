import { useEffect, useId } from 'react'

import {
  blobMarkup,
  type BotMood,
  CLOUD_BODY_PATH,
  defaultShapeFor,
  faceEyeY,
  facePose,
  isBlobShape,
  isDarkColor,
  ringToPath,
  sampleFaceRing,
  sigilGeometry
} from '@/lib/bot-avatar'
import { botCharacter } from '@/lib/bot-characters'
import { startFaceClock } from '@/lib/bot-face-clock'

// The bot's face: the one drawing of a Work4You profile as a character, shared
// by the WorkBots roster, the sidebar profile rail and the settings scope
// chips. Three render paths:
//   - an image (uploaded / generated / pet) is a plain <img>;
//   - a blobatar shape is the library's whole face, inlined as SVG;
//   - everything else is the "math face": a filled outline with two eyes
//     that the shared clock (`lib/bot-face-clock`) animates in place.
// The data-* attributes are a contract: the clock finds faces by
// `data-hb-math` and moves the `data-hb-*` parts; the roster's PNG backfill
// finds any face by `data-bot-face`.

export interface BotFaceProps {
  color: string
  image?: null | string
  mood?: BotMood
  name?: string
  shape: string
  size?: number
}

/** The colored body of the avatar (no eyes), for shapes the clock does not
 *  rebuild: platonic solids are a filled silhouette plus translucent internal
 *  edge lines (the projected wireframe); legacy flat shapes keep their old
 *  geometry so stored picks still render. */
export function shapeNode(shape: string, color: string, botName = 'agent') {
  if (shape.startsWith('sigil-')) {
    const seed = Number(shape.slice(6)) || 0
    const { ring, strokes } = sigilGeometry(botName, seed)

    return (
      <g>
        {ring ? <path d={ring} fill="none" opacity={0.5} stroke={color} strokeWidth={1.2} /> : null}
        <path d={strokes} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} />
      </g>
    )
  }

  const stroke = { fill: color, stroke: color, strokeLinejoin: 'round' as const, strokeWidth: 7 }

  const edge = {
    fill: 'none',
    stroke: 'rgba(0,0,0,0.4)',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.4
  }

  const face = { fill: color, stroke: 'rgba(0,0,0,0.4)', strokeLinejoin: 'round' as const, strokeWidth: 1.4 }

  switch (shape) {
    // ── platonic solids ──
    case 'tetrahedron':
      return (
        <g>
          <path d="M20 5 L36 33 L4 33 Z" {...face} />
          <path d="M20 5 L20 25 M4 33 L20 25 M36 33 L20 25" {...edge} />
        </g>
      )

    case 'cube':
      return (
        <g>
          <path d="M20 4 L33 11 L33 29 L20 36 L7 29 L7 11 Z" {...face} />
          <path d="M7 11 L20 18 L33 11 M20 18 L20 36" {...edge} />
        </g>
      )

    case 'octahedron':
      return (
        <g>
          <path d="M20 3 L36 20 L20 37 L4 20 Z" {...face} />
          <path d="M4 20 L36 20 M20 3 L20 37" {...edge} />
        </g>
      )

    case 'dodecahedron':
      return (
        <g>
          <path
            d="M20 3 L30 6.2 L36.2 14.7 L36.2 25.3 L30 33.8 L20 37 L10 33.8 L3.8 25.3 L3.8 14.7 L10 6.2 Z"
            {...face}
          />
          <path
            d={
              'M20 12 L27.6 17.5 L24.7 26.5 L15.3 26.5 L12.4 17.5 Z ' +
              'M20 12 L20 3 M27.6 17.5 L36.2 14.7 M24.7 26.5 L30 33.8 M15.3 26.5 L10 33.8 M12.4 17.5 L3.8 14.7'
            }
            {...edge}
          />
        </g>
      )

    case 'icosahedron':
      return (
        <g>
          <path d="M20 3 L34.7 11.5 L34.7 28.5 L20 37 L5.3 28.5 L5.3 11.5 Z" {...face} />
          <path
            d={
              'M20 11 L27.8 24.5 L12.2 24.5 Z ' +
              'M20 11 L20 3 M20 11 L34.7 11.5 M20 11 L5.3 11.5 ' +
              'M27.8 24.5 L34.7 11.5 M27.8 24.5 L34.7 28.5 M27.8 24.5 L20 37 ' +
              'M12.2 24.5 L5.3 11.5 M12.2 24.5 L5.3 28.5 M12.2 24.5 L20 37'
            }
            {...edge}
          />
        </g>
      )

    // ── legacy flat shapes (stored picks from earlier versions) ──
    case 'squircle':
      return <rect fill={color} height={34} rx={11} width={34} x={3} y={3} />

    case 'pill':
      return <rect fill={color} height={26} rx={13} width={36} x={2} y={7} />

    case 'triangle':
      return <path d="M20 5.5 L36 33.5 L4 33.5 Z" {...stroke} />

    case 'hexagon':
      return <path d="M20 3.5 L34.5 11.75 L34.5 28.25 L20 36.5 L5.5 28.25 L5.5 11.75 Z" {...stroke} />

    case 'cloud':
      return <path d={CLOUD_BODY_PATH} fill={color} />

    case 'drop':
      return <path d="M20 3 C20 3 6 20 6 27 a14 13.5 0 0 0 28 0 C34 20 20 3 20 3 Z" fill={color} />

    default:
      return <circle cx={20} cy={20} fill={color} r={17.5} />
  }
}

/**
 * Live face. Photos use <img>. Shape avatars stay SVG so the clock can move
 * them (a baked PNG cannot).
 */
export function BotFace({ color, image, mood = 'idle', name = 'agent', shape, size = 36 }: BotFaceProps) {
  const surfaceId = useId().replace(/:/g, '')
  // A mounting face is what wakes a parked clock.
  useEffect(() => {
    startFaceClock()
  }, [])

  if (image) {
    return (
      <img
        alt=""
        aria-hidden
        src={image}
        style={{ borderRadius: '22%', display: 'block', height: size, objectFit: 'cover', width: size }}
      />
    )
  }

  const character = botCharacter(shape)

  if (character) {
    return (
      <img
        alt=""
        aria-hidden
        data-bot-character={character.id}
        data-bot-face={name}
        draggable={false}
        height={size}
        src={character.image}
        style={{ display: 'block', objectFit: 'contain' }}
        width={size}
      />
    )
  }

  let drawn = shape

  // Blobatar shapes: the library draws the whole face (body + eyes + its own
  // name-derived palette). Inline SVG via innerHTML so the roster PNG
  // backfill's `svg[data-bot-face=…]` query still finds it; the math clock
  // ignores it (no data-hb-math). Falls back to the math face when the
  // renderer refuses the input.
  if (isBlobShape(drawn)) {
    const markup = blobMarkup(drawn, name, size)

    if (markup) {
      return (
        <span
          aria-hidden
          dangerouslySetInnerHTML={{ __html: markup }}
          style={{ display: 'block', height: size, lineHeight: 0, width: size }}
        />
      )
    }

    drawn = defaultShapeFor(name)
  }

  // Sigils are line art (no filled body) — the math clock rebuilds filled
  // outlines, which would turn a stored sigil pick into a blank circle. Keep
  // the legacy static render for them so old picks still draw.
  if (drawn.startsWith('sigil-')) {
    return (
      <svg aria-hidden data-bot-face={name} height={size} viewBox="0 0 40 40" width={size}>
        {shapeNode(drawn, color, name)}
        <g>
          <circle cx={16} cy={14} fill={color} r={2.4} />
          <circle cx={24} cy={14} fill={color} r={2.4} />
        </g>
      </svg>
    )
  }

  const working = mood === 'work'
  const dark = isDarkColor(color)
  const eyeFill = dark ? 'rgba(232,220,195,0.95)' : 'rgba(0,0,0,0.85)'
  // Catchlight contrast follows the pupil, not the body: dark pupils get the
  // white sparkle, light (cream) pupils on dark bodies get a dark one — a
  // white dot on a cream pupil is invisible, which read as "no eye dots" on
  // maroon/ink/oxblood avatars.
  const hlFill = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'
  const rest = facePose(working ? 'work' : 'idle', 0)
  // Shape-aware initial eye line — the cloud body sits lower, so its eyes
  // (and their catchlights) start at the cloud position instead of jumping
  // there on the first clock paint.
  const eyeY0 = faceEyeY(drawn)
  const bodyPath = drawn === 'cloud' ? CLOUD_BODY_PATH : ringToPath(sampleFaceRing(drawn))

  return (
    <svg
      aria-hidden
      data-bot-face={name}
      data-hb-math="1"
      data-hb-mood={working ? 'work' : 'idle'}
      data-hb-shape={drawn || 'circle'}
      height={size}
      style={{ display: 'block', overflow: 'visible' }}
      viewBox="0 0 40 44"
      width={size}
    >
      <defs>
        <linearGradient id={`${surfaceId}-shade`} x1="20%" x2="75%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity={0.3} />
          <stop offset="38%" stopColor="white" stopOpacity={0} />
          <stop offset="66%" stopColor="black" stopOpacity={0.02} />
          <stop offset="100%" stopColor="black" stopOpacity={0.27} />
        </linearGradient>
        <radialGradient cx="28%" cy="16%" id={`${surfaceId}-light`} r="72%">
          <stop offset="0%" stopColor="white" stopOpacity={0.5} />
          <stop offset="25%" stopColor="white" stopOpacity={0.12} />
          <stop offset="65%" stopColor="white" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${surfaceId}-rim`} x1="0%" x2="85%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity={0.8} />
          <stop offset="35%" stopColor="white" stopOpacity={0.2} />
          <stop offset="60%" stopColor="black" stopOpacity={0.03} />
          <stop offset="100%" stopColor="black" stopOpacity={0.45} />
        </linearGradient>
        <clipPath id={`${surfaceId}-body`}>
          <path d={bodyPath} data-hb-surface="1" />
        </clipPath>
        <filter id={`${surfaceId}-soft-edge`}>
          <feGaussianBlur stdDeviation={0.7} />
        </filter>
      </defs>
      <path d={bodyPath} data-hb-body="1" fill={color} />
      <path d={bodyPath} data-hb-surface="1" fill={`url(#${surfaceId}-shade)`} />
      <path d={bodyPath} data-hb-surface="1" fill={`url(#${surfaceId}-light)`} />
      <g clipPath={`url(#${surfaceId}-body)`}>
        <path
          d={bodyPath}
          data-hb-surface="1"
          fill="none"
          filter={`url(#${surfaceId}-soft-edge)`}
          stroke={`url(#${surfaceId}-rim)`}
          strokeWidth={3.5}
        />
      </g>
      <g data-hb-open="1">
        <ellipse cx={15.4} cy={eyeY0} data-hb-el="1" fill={eyeFill} rx={1.9} ry={working ? 3.3 : 3} />
        <ellipse cx={24.6} cy={eyeY0} data-hb-er="1" fill={eyeFill} rx={1.9} ry={working ? 3.3 : 3} />
        <circle cx={14.8} cy={eyeY0 - 0.7} data-hb-hl-l="1" fill={hlFill} r={0.65} />
        <circle cx={24} cy={eyeY0 - 0.7} data-hb-hl-r="1" fill={hlFill} r={0.65} />
      </g>
      <path
        d={`M12.8 ${eyeY0} L18 ${eyeY0} M22 ${eyeY0} L27.2 ${eyeY0}`}
        data-hb-shut="1"
        fill="none"
        opacity={0}
        stroke={eyeFill}
        strokeLinecap="round"
        strokeWidth={2}
      />
      {working ? (
        <g>
          <circle cx={16.4} cy={41.2} data-hb-dot="1" fill={color} opacity={rest.d0} r={1.15} />
          <circle cx={20} cy={41.2} data-hb-dot="1" fill={color} opacity={rest.d1} r={1.15} />
          <circle cx={23.6} cy={41.2} data-hb-dot="1" fill={color} opacity={rest.d2} r={1.15} />
        </g>
      ) : null}
    </svg>
  )
}
