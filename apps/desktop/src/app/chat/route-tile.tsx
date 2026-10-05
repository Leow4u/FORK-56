/**
 * ROUTE (PAGE) TILES — a full-page view rendered as a layout-tree pane BESIDE
 * the main thread, the page analog of session tiles. Built-in pages
 * (Capabilities / Messaging / Artifacts) render their view; plugin pages render
 * their `ROUTES_AREA` contribution. Lifecycle mirrors session tiles:
 * `openRouteTile(path)` -> `watchRouteTiles` registers a pane docked beside
 * main -> tree adoption lands it on the chosen edge; closing removes it.
 */

import { lazy, type ReactNode, Suspense } from 'react'

import { ContribBoundary, ContribRender } from '@/contrib/react/boundary'
import { useContributions } from '@/contrib/react/use-contributions'
import { translateNow, type Translations, useI18n } from '@/i18n'
import { $routeTiles, closeRouteTile, type RouteTile } from '@/store/route-tiles'

import { ARTIFACTS_ROUTE, contributedRoutes, CRON_ROUTE, MESSAGING_ROUTE, ROUTES_AREA, SKILLS_ROUTE } from '../routes'

import { paneMirror } from './pane-mirror'

const SkillsView = lazy(async () => ({ default: (await import('../skills')).SkillsView }))
const MessagingView = lazy(async () => ({ default: (await import('../messaging')).MessagingView }))
const ArtifactsView = lazy(async () => ({ default: (await import('../artifacts')).ArtifactsView }))
const CronView = lazy(async () => ({ default: (await import('../cron')).CronView }))

interface BuiltinPage {
  render: () => ReactNode
  /** The pane title from the live catalog — what the tab renders. */
  title: (copy: Translations) => string
  /** The same title's catalog path, for the registered name: tiles register
   *  outside React (at boot, before the display language is applied). */
  titleKey: string
}

// Built-in page views + their pane titles, keyed by route.
const BUILTIN_PAGES: Record<string, BuiltinPage> = {
  [ARTIFACTS_ROUTE]: {
    render: () => <ArtifactsView />,
    title: copy => copy.commandCenter.nav.artifacts.title,
    titleKey: 'commandCenter.nav.artifacts.title'
  },
  [CRON_ROUTE]: { render: () => <CronView />, title: copy => copy.sidebar.nav.cron, titleKey: 'sidebar.nav.cron' },
  [MESSAGING_ROUTE]: {
    render: () => <MessagingView />,
    title: copy => copy.commandCenter.nav.messaging.title,
    titleKey: 'commandCenter.nav.messaging.title'
  },
  [SKILLS_ROUTE]: {
    render: () => <SkillsView />,
    title: copy => copy.commandCenter.nav.skills.title,
    titleKey: 'commandCenter.nav.skills.title'
  }
}

/** Humanize a route path into a tab title: `/my-atlas` → `My Atlas`. */
const humanizePath = (path: string): string =>
  path
    .replace(/^\/+/, '')
    .split(/[/-]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') || path

/** A plugin page's title: the contribution's own `title`, else a humanized
 *  path — never the internal `${source}:${id}` key. */
const contributedTitle = (path: string): string =>
  contributedRoutes().find(r => r.path === path)?.title ?? humanizePath(path)

/** Title for a route tile: the built-in name, else the plugin page's. */
function routeTitle(path: string): string {
  const builtin = BUILTIN_PAGES[path]

  return builtin ? translateNow(builtin.titleKey) : contributedTitle(path)
}

/** A built-in page's tab label, rendered from the live `t` — the registered
 *  name was resolved when the tile synced, which can predate the language. */
function BuiltinPageTitle({ page }: { page: BuiltinPage }) {
  const { t } = useI18n()

  return page.title(t)
}

function RouteTilePane({ path }: { path: string }) {
  const { t } = useI18n()
  const builtin = BUILTIN_PAGES[path]

  // Subscribe so a plugin page tile appears the moment its route registers.
  useContributions(ROUTES_AREA)
  const contrib = builtin ? null : contributedRoutes().find(r => r.path === path)

  if (builtin) {
    return (
      <ContribBoundary id={path}>
        <Suspense fallback={null}>
          <ContribRender render={builtin.render} />
        </Suspense>
      </ContribBoundary>
    )
  }

  if (contrib) {
    return (
      <ContribBoundary id={path}>
        <ContribRender render={contrib.render} />
      </ContribBoundary>
    )
  }

  return (
    <div className="grid h-full place-items-center font-mono text-[11px] text-(--ui-text-quaternary)">
      {t.shell.panes.noPageAt(path)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Route tile -> pane contribution sync (call once from the app root).
// ---------------------------------------------------------------------------

/** Keep pane contributions mirroring `$routeTiles`. Call once from the root. */
export const watchRouteTiles = paneMirror<RouteTile>({
  source: $routeTiles,
  key: t => t.path,
  prefix: 'route-tile',
  dir: t => t.dir,
  minWidth: '22rem',
  title: routeTitle,
  // Plugin pages keep their registered title (null falls back to it).
  tabTitle: path => (BUILTIN_PAGES[path] ? <BuiltinPageTitle page={BUILTIN_PAGES[path]} /> : null),
  render: path => <RouteTilePane path={path} />,
  close: closeRouteTile
})
