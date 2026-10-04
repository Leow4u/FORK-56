import { type StatusTone } from '@/components/status-dot'
import type { Translations } from '@/i18n'
import { cn } from '@/lib/utils'
import type { MessagingPlatformInfo } from '@/work4you'

// Status color of a dot: the app's success green, amber for "needs a
// restart / setup", red for failures, quiet gray for off.
const DOT_TONE: Record<StatusTone, string> = {
  bad: 'bg-destructive',
  good: 'bg-emerald-500',
  muted: 'bg-(--ui-text-quaternary)',
  warn: 'bg-amber-500'
}

export function ToneDot({ tone }: { tone: StatusTone }) {
  return <span aria-hidden className={cn('inline-block size-[7px] shrink-0 rounded-full', DOT_TONE[tone])} />
}

export const stateLabel = (state: null | string | undefined, m: Translations['messaging']) =>
  state ? m.states[state] || state.replace(/_/g, ' ') : m.unknown

// Channels that wait for other programs to call them (an endpoint, a
// listener): once up they are listening, not "connected" to anything.
const LISTENER_CHANNELS = new Set(['a2a', 'api_server', 'msgraph_webhook', 'webhook'])

export function stateTone({ enabled, state }: MessagingPlatformInfo): StatusTone {
  if (!enabled) {
    return 'muted'
  }

  if (state === 'connected') {
    return 'good'
  }

  if (state === 'fatal' || state === 'startup_failed') {
    return 'bad'
  }

  return 'warn'
}

/** The one status the channel's page shows. Off wins over everything (a
 *  stale "connected" from the last run must not outrank it), then what keeps
 *  the channel from connecting, then the runtime's own state. */
export function detailStatus(
  platform: MessagingPlatformInfo,
  m: Translations['messaging']
): { label: string; tone: StatusTone } {
  if (!platform.enabled) {
    return { label: m.notConnected, tone: 'muted' }
  }

  if (!platform.configured) {
    return { label: m.needsSetup, tone: 'warn' }
  }

  if (!platform.gateway_running && platform.state !== 'startup_failed') {
    return { label: m.gatewayStopped, tone: 'warn' }
  }

  if (platform.state === 'connected' && LISTENER_CHANNELS.has(platform.id)) {
    return { label: m.stateListening, tone: 'good' }
  }

  return { label: stateLabel(platform.state, m), tone: stateTone(platform) }
}
