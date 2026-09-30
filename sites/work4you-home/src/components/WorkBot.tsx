import { useEffect, useRef } from 'react'
import { type FaceHandle, watchFace } from '../lib/workbot-clock'
import { facePose, isDarkColor, projectFacePoint, ringToPath, sampleFaceRing, type WorkbotShape } from '../lib/workbot'

interface WorkBotProps {
  color: string
  mood?: 'idle' | 'work'
  shape: WorkbotShape
  size?: number
}

/** Rosto de Workbot (forma + cor + olhos), igual ao do app. Anima pelo relógio compartilhado. */
export function WorkBot({ color, mood = 'idle', shape, size = 32 }: WorkBotProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const handleRef = useRef<FaceHandle | null>(null)

  useEffect(() => {
    const svg = svgRef.current

    if (!svg) {
      return
    }

    const handle: FaceHandle = { mood, shape, svg }

    handleRef.current = handle

    return watchFace(handle)
    // Registra uma vez; forma e humor mudam no próprio handle (efeito abaixo).
  }, [])

  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.shape = shape
      handleRef.current.mood = mood
    }
  }, [mood, shape])

  const rest = facePose(mood, 0)
  const ring = sampleFaceRing(shape)
  const body = shape === 'cloud' ? ring : ring.map((point) => projectFacePoint(point, rest))
  const eyeY = shape === 'cloud' ? 22 : 17.2
  const dark = isDarkColor(color)
  const eye = dark ? 'rgba(232,220,195,0.95)' : 'rgba(0,0,0,0.85)'
  const light = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)'

  return (
    <svg
      aria-hidden="true"
      height={size}
      ref={svgRef}
      style={{ display: 'block', overflow: 'visible', transformOrigin: '50% 70%' }}
      viewBox="0 0 40 44"
      width={size}
    >
      <path d={ringToPath(body)} data-body="" fill={color} />
      <g data-open="">
        <ellipse cx={15.4} cy={eyeY} data-eye-l="" fill={eye} rx={2.2} ry={mood === 'work' ? 2.6 : 2.3} />
        <ellipse cx={24.6} cy={eyeY} data-eye-r="" fill={eye} rx={2.2} ry={mood === 'work' ? 2.6 : 2.3} />
        <circle cx={14.8} cy={eyeY - 0.7} data-hl-l="" fill={light} r={0.65} />
        <circle cx={24} cy={eyeY - 0.7} data-hl-r="" fill={light} r={0.65} />
      </g>
      <path
        d={`M12.8 ${eyeY}L18 ${eyeY}M22 ${eyeY}L27.2 ${eyeY}`}
        data-shut=""
        fill="none"
        opacity={0}
        stroke={eye}
        strokeLinecap="round"
        strokeWidth={2}
      />
      {mood === 'work'
        ? [16.4, 20, 23.6].map((cx) => <circle cx={cx} cy={41.2} data-dot="" fill={color} key={cx} opacity={0.2} r={1.15} />)
        : null}
    </svg>
  )
}
