import { Box, Text, useStdout } from '@work4you/ink'

import { artWidth, hero, HERO_WIDTH, logo } from '../banner.js'
import { houseModelDisplayName } from '../lib/house-model.js'
import type { Theme } from '../theme.js'
import type { PanelSection, SessionInfo } from '../types.js'

import { WidgetGrid } from './widgetGrid.js'

export function ArtLines({ lines }: { lines: [string, string][] }) {
  // No `opaque`: the banner is top-level content with nothing behind it, so
  // it never needs the opaque space-fill (that's for absolute overlays). On a
  // transparent terminal (terminal.background #00000000) the fill's "default
  // background" spaces composite to black bars instead of the intended
  // see-through — the reported ugly banner. Glyphs paint fine on their own.
  return (
    <Box flexDirection="column" height={lines.length} width={artWidth(lines)}>
      {lines.map(([c, text], i) => (
        <Text color={c} key={i} wrap="truncate-end">
          {text}
        </Text>
      ))}
    </Box>
  )
}

// Custom-skin wordmark only. Default splash is SessionPanel (pixel mark +
// session facts) — no giant logo, no mythology tagline.
const HIDE_BELOW = 34
const COMPACT_FROM = 58

const clip = (s: string, w: number) => (w <= 0 ? '' : s.length > w ? `${s.slice(0, Math.max(0, w - 1))}…` : s)

const centerIn = (s: string, w: number) => {
  const f = clip(s, w)
  const slack = Math.max(0, w - f.length)
  const left = slack >> 1

  return `${' '.repeat(left)}${f}${' '.repeat(slack - left)}`
}

const ruleIn = (label: string, w: number) => {
  const f = clip(label, Math.max(1, w - 4))
  const slack = Math.max(0, w - f.length - 2)
  const left = slack >> 1

  return `${'─'.repeat(left)} ${f} ${'─'.repeat(slack - left)}`
}

function CompactBanner({ cols, t }: { cols: number; t: Theme }) {
  // -4 keeps a margin so exact-edge rows don't trip terminal pending-wrap.
  const w = Math.max(28, cols - 4)

  return (
    <Box flexDirection="column" height={3} marginBottom={1} width={w}>
      <Text color={t.color.primary}>{ruleIn(t.brand.name, w)}</Text>
      <Text color={t.color.muted}>{centerIn(t.brand.name, w)}</Text>
      <Text color={t.color.primary}>{'─'.repeat(w)}</Text>
    </Box>
  )
}

export function Banner({ maxWidth, t }: { maxWidth?: number; t: Theme }) {
  const term = useStdout().stdout?.columns ?? 80
  const cols = Math.max(1, Math.min(term, maxWidth ?? term))

  if (!t.bannerLogo || cols < HIDE_BELOW) {
    return null
  }

  const logoLines = logo(t.color, t.bannerLogo)
  const logoW = artWidth(logoLines)

  if (cols >= logoW + 2) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <WidgetGrid
          cols={cols}
          columns={1}
          gap={0}
          paddingX={0}
          paddingY={0}
          rowGap={0}
          widgets={[
            { children: <ArtLines lines={logoLines} />, id: 'banner-art' },
            {
              children: (
                <Text color={t.color.muted} wrap="truncate-end">
                  {t.brand.icon} {t.brand.name}
                </Text>
              ),
              id: 'banner-tagline'
            }
          ]}
        />
      </Box>
    )
  }

  if (cols >= COMPACT_FROM) {
    return (
      <WidgetGrid
        cols={cols}
        columns={1}
        gap={0}
        paddingX={0}
        paddingY={0}
        rowGap={0}
        widgets={[{ children: <CompactBanner cols={cols} t={t} />, id: 'banner-compact' }]}
      />
    )
  }

  const name = cols >= 52 ? t.brand.name : (t.brand.name.split(' ')[0] ?? t.brand.name)

  return (
    <Box flexDirection="column" marginBottom={1}>
      <WidgetGrid
        cols={cols}
        columns={1}
        gap={0}
        paddingX={0}
        paddingY={0}
        rowGap={0}
        widgets={[
          {
            children: (
              <Text bold color={t.color.primary} wrap="truncate-end">
                {t.brand.icon} {name}
              </Text>
            ),
            id: 'banner-name'
          }
        ]}
      />
    </Box>
  )
}

export function SessionPanel({ info, maxWidth, sid, t }: SessionPanelProps) {
  const term = useStdout().stdout?.columns ?? 100
  const cols = Math.max(20, Math.min(term, maxWidth ?? term))
  const heroLines = hero(t.color, t.bannerHero || undefined)
  const leftW = Math.min((artWidth(heroLines) || HERO_WIDTH) + 4, Math.floor(cols * 0.45))
  const wide = cols >= 48 && leftW + 28 < cols
  const w = Math.max(20, wide ? cols - leftW - 14 : cols - 12)
  const modelShort = houseModelDisplayName(info.model)
  const unconfigured = !info.model.trim() || info.model.trim().toLowerCase() === 'unknown'
  const yolo = Boolean(process.env.WORK4YOU_YOLO_MODE)
  const profile = info.profile_name && info.profile_name !== 'default' ? info.profile_name : ''

  const heroColumn = (
    <Box flexDirection="column" width="100%">
      <ArtLines lines={heroLines} />
    </Box>
  )

  const infoColumn = (
    <Box flexDirection="column" width="100%">
      <Text bold color={t.color.primary} wrap="truncate-end">
        {t.brand.name}
        {info.version ? ` v${info.version}` : ''}
        {info.release_date ? ` (${info.release_date})` : ''}
      </Text>

      {unconfigured ? (
        <Text color={t.color.error} wrap="truncate-end">
          no model configured
          <Text color={t.color.muted}> — run /model or work4you setup</Text>
        </Text>
      ) : (
        <Text color={t.color.accent} wrap="truncate-end">
          {modelShort}
        </Text>
      )}

      <Text color={t.color.muted} wrap="truncate-end">
        {info.cwd || process.cwd()}
      </Text>

      {sid && (
        <Text wrap="truncate-end">
          <Text color={t.color.sessionLabel}>Session: </Text>
          <Text color={t.color.sessionBorder}>{sid}</Text>
        </Text>
      )}

      {yolo && (
        <Text color={t.color.error} wrap="truncate-end">
          YOLO mode — all approval prompts bypassed
        </Text>
      )}

      {profile && (
        <Text wrap="truncate-end">
          <Text color={t.color.accent}>Profile: </Text>
          <Text color={t.color.text}>{profile}</Text>
        </Text>
      )}

      <Text color={t.color.muted}>/help for commands</Text>

      {typeof info.update_behind === 'number' && info.update_behind > 0 && (
        <Text bold color={t.color.warn}>
          ! {info.update_behind} {info.update_behind === 1 ? 'commit' : 'commits'} behind
          <Text bold={false} color={t.color.warn} dimColor>
            {' '}
            - run{' '}
          </Text>
          <Text bold color={t.color.warn}>
            {info.update_command || 'work4you update'}
          </Text>
          <Text bold={false} color={t.color.warn} dimColor>
            {' '}
            to update
          </Text>
        </Text>
      )}

      {info.install_warning && (
        <Text bold color={t.color.warn} wrap="wrap">
          ! {info.install_warning}
        </Text>
      )}
    </Box>
  )

  return (
    <Box borderColor={t.color.border} borderStyle="round" marginBottom={1} paddingX={2} paddingY={1}>
      <WidgetGrid
        cols={wide ? leftW + 2 + w : w}
        columns={wide ? [leftW, { fr: 1 }] : 1}
        gap={2}
        paddingX={0}
        paddingY={0}
        rowGap={1}
        widgets={
          wide
            ? [
                { children: heroColumn, id: 'session-hero' },
                { children: infoColumn, id: 'session-info' }
              ]
            : [
                { children: heroColumn, id: 'session-hero' },
                { children: infoColumn, id: 'session-info' }
              ]
        }
      />
    </Box>
  )
}

export function Panel({ sections, t, title }: PanelProps) {
  return (
    <Box borderColor={t.color.border} borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={t.color.primary}>
          {title}
        </Text>
      </Box>

      {sections.map((sec, si) => (
        <Box flexDirection="column" key={si} marginTop={si > 0 ? 1 : 0}>
          {sec.title && (
            <Text bold color={t.color.accent}>
              {sec.title}
            </Text>
          )}

          {sec.rows?.map(([k, v], ri) => (
            <Text key={ri} wrap="truncate">
              <Text color={t.color.muted}>{k.padEnd(20)}</Text>
              <Text color={t.color.text}>{v}</Text>
            </Text>
          ))}

          {sec.items?.map((item, ii) => (
            <Text color={t.color.text} key={ii} wrap="truncate">
              {item}
            </Text>
          ))}

          {sec.text && <Text color={t.color.muted}>{sec.text}</Text>}
        </Box>
      ))}
    </Box>
  )
}

interface PanelProps {
  sections: PanelSection[]
  t: Theme
  title: string
}

interface SessionPanelProps {
  info: SessionInfo
  maxWidth?: number
  sid?: string | null
  t: Theme
}
