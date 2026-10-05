import { useStore } from '@nanostores/react'
import { useEffect, useState } from 'react'

import { useI18n } from '@/i18n'
import { AlertCircle, Clock, type IconComponent } from '@/lib/icons'
import { $petActivity, $petState, type PetState } from '@/store/pet'

/**
 * Speech bubble + status glyph for the popped-out pet overlay — the
 * "notification" half of the mascot. It externalizes what the agent is doing
 * (Codex-style) so a glance at the desktop pet replaces switching back to the
 * window. The in-window pet doesn't show it (the app itself is the surface);
 * only the overlay renders it.
 *
 * Text is derived purely from the same `$petState` / `$petActivity` the sprite
 * already reacts to, so it never drifts from the animation. The bubble is shown
 * only when there's something worth saying (working / reviewing / a transient
 * done/error beat / waiting on the user) and is hidden at plain idle.
 */

type Tone = 'error' | 'wait'

/** The moods the bubble speaks for — each has its phrasings in `ui.pets.bubble`. */
type Mood = 'failed' | 'review' | 'run' | 'waiting'

interface Spec {
  glyph?: IconComponent
  tone?: Tone
}

// Glyph + tone per mood. The phrasings live in the catalog (`ui.pets.bubble`)
// and are picked at random (no immediate repeat) for a bit of life. Keep them
// short — the bubble is tiny and never wraps.
const SPECS: Record<Mood, Spec> = {
  run: {},
  review: {},
  failed: { glyph: AlertCircle, tone: 'error' },
  waiting: { glyph: Clock, tone: 'wait' }
}

const isMood = (state: PetState): state is Mood => state in SPECS

const TONE_COLOR: Record<Tone, string> = {
  error: 'var(--ui-red)',
  wait: 'var(--ui-yellow)'
}

// Random pick that avoids repeating the line we're already showing.
function pick(lines: readonly string[], prev: string): string {
  if (lines.length <= 1) {
    return lines[0] ?? ''
  }

  let next = prev

  while (next === prev) {
    next = lines[Math.floor(Math.random() * lines.length)]
  }

  return next
}

export function PetBubble() {
  const { t } = useI18n()
  const state = useStore($petState)
  const activity = useStore($petActivity)
  const [line, setLine] = useState('')

  // Finish beats are carried by the sprite/mail icon; idle only speaks up when
  // it's actually the user's turn. Everything else maps to a mood spec.
  const mood: Mood | null = isMood(state) ? state : state === 'idle' && activity.awaitingInput ? 'waiting' : null
  // Stable per mood + language (catalog arrays), so the effect below re-runs
  // only when either actually changes.
  const lines = mood ? t.ui.pets.bubble[mood] : null

  const rotating = mood === 'run' || mood === 'review'

  // Pick a fresh line on every mood change, then keep rotating (random, no
  // repeat) only while the agent is actively working/thinking.
  useEffect(() => {
    if (!lines) {
      setLine('')

      return
    }

    setLine(prev => pick(lines, prev))

    if (!rotating || lines.length <= 1) {
      return
    }

    const id = window.setInterval(() => setLine(prev => pick(lines, prev)), 2600)

    return () => window.clearInterval(id)
  }, [lines, rotating])

  if (!mood || !lines) {
    return null
  }

  const spec = SPECS[mood]
  const Glyph = spec.glyph
  const text = line || lines[0]
  const hasText = Boolean(text)

  return (
    <div
      style={{
        alignItems: 'center',
        // Solid, theme-driven surface (the prior --ui-bg-card mixes in
        // `transparent`, so the bubble was see-through).
        background: 'var(--ui-bg-elevated)',
        border: '1px solid var(--ui-stroke-secondary)',
        borderRadius: hasText ? 10 : 999,
        boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
        color: 'var(--foreground)',
        display: 'inline-flex',
        fontSize: 11,
        fontWeight: 500,
        gap: hasText ? 5 : 0,
        lineHeight: 1,
        // Glyph-only bubbles collapse to a tight, symmetric badge.
        padding: hasText ? '5px 8px' : 5,
        pointerEvents: 'none',
        whiteSpace: 'nowrap'
      }}
    >
      {Glyph && (
        <span style={{ display: 'inline-flex' }}>
          <Glyph style={{ color: spec.tone ? TONE_COLOR[spec.tone] : 'currentColor', height: 13, width: 13 }} />
        </span>
      )}
      {text}
    </div>
  )
}
