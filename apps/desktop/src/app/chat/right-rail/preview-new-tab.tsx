/**
 * NEW TAB — what an empty Browser shows. The address bar above it takes a URL;
 * below, the conversation's tools. A row selects its tool in the shared
 * content area through the same opener and reveal path as its shortcut.
 *
 * Files and Changes only mean something inside a project — the same gate
 * their panes have — so without one their rows are off and say why.
 */

import { useStore } from '@nanostores/react'

import { SectionHeading } from '@/app/settings/primitives'
import { restoreTreePane } from '@/components/pane-shell/tree/store'
import { Codicon } from '@/components/ui/codicon'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import { PageIcon } from '@/components/ui/page-icon'
import { RowButton } from '@/components/ui/row-button'
import { useI18n } from '@/i18n'
import { $currentRecentPreviews, openPreview } from '@/store/preview'
import { suggestedPreviewSites } from '@/store/preview-recents'
import { $currentCwd } from '@/store/session'

interface NewTabTool {
  icon: string
  label: string
  pane: 'files' | 'review' | 'terminal'
  /** Gated on an open project, like the pane itself. */
  project: boolean
}

export function PreviewNewTab() {
  const { locale, t } = useI18n()
  const hasProject = Boolean(useStore($currentCwd).trim())
  const recents = useStore($currentRecentPreviews)
  const suggestions = suggestedPreviewSites(recents)
  const copy = t.preview.newTab
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' })
  const today = new Date().toDateString()

  const rowClass =
    'flex min-w-0 cursor-pointer items-center gap-3 rounded-(--control-radius) px-3.5 py-3 text-start text-sm text-foreground hover:bg-(--chrome-action-hover) focus-visible:outline-2 focus-visible:outline-ring'

  const tools: NewTabTool[] = [
    { icon: 'files', label: t.shell.panes.files, pane: 'files', project: true },
    { icon: 'git-compare', label: copy.review, pane: 'review', project: true },
    { icon: 'terminal', label: t.shell.panes.terminal, pane: 'terminal', project: false }
  ]

  return (
    <div className="absolute inset-0 overflow-auto bg-background @container">
      <div className="flex flex-col gap-8 px-7 py-7">
        <section aria-label={copy.tools}>
          <SectionHeading title={copy.tools} variant="group" />
          <div className="flex flex-col divide-y divide-(--ui-stroke-tertiary)">
            {tools.map(tool => (
              <RowButton
                className={`${rowClass} disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={tool.project && !hasProject}
                key={tool.pane}
                onClick={() => restoreTreePane(tool.pane)}
              >
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <Codicon className="text-(--ui-text-secondary)" name={tool.icon} size="1rem" />
                </span>
                <span className="min-w-0 flex-1 truncate">{tool.label}</span>
                <Codicon className="text-(--ui-text-tertiary)" name="chevron-right" size="0.875rem" />
              </RowButton>
            ))}
          </div>
          {!hasProject && <p className="mt-3 text-xs text-(--ui-text-tertiary)">{copy.needsProject}</p>}
        </section>
        <section aria-label={copy.suggested}>
          <SectionHeading title={copy.suggested} variant="group" />
          {suggestions.length ? (
            <div className="grid grid-cols-1 gap-2 @min-[420px]:grid-cols-2 @min-[620px]:grid-cols-3">
              {suggestions.map(({ target, icon }) => (
                <RowButton
                  className={rowClass}
                  key={target.url}
                  onClick={() => openPreview(target, 'explicit-link')}
                  title={target.url}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center">
                    <PageIcon icon={icon} size="1.5rem" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{target.label}</span>
                    <span className="block truncate text-xs text-(--ui-text-tertiary)">
                      {new URL(target.url).hostname}
                    </span>
                  </span>
                </RowButton>
              ))}
            </div>
          ) : (
            <p className="text-xs text-(--ui-text-tertiary)">{copy.noSuggestions}</p>
          )}
        </section>
        <section aria-label={copy.recent}>
          <SectionHeading title={copy.recent} variant="group" />
          {recents.length ? (
            <div className="flex flex-col divide-y divide-(--ui-stroke-tertiary)">
              {recents.slice(0, 8).map(({ target, icon, openedAt }) => {
                const opened = new Date(openedAt)
                const extension = target.path?.match(/\.([^.\\/]+)$/)?.[1].toUpperCase()

                const kind =
                  target.kind === 'url'
                    ? copy.page
                    : target.previewKind === 'image'
                      ? copy.image
                      : extension === 'MD'
                        ? 'Markdown'
                        : extension || copy.file

                return (
                  <RowButton
                    className={rowClass}
                    key={`${target.kind}:${target.url}`}
                    onClick={() => openPreview(target, 'explicit-link')}
                    title={target.path || target.url}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center">
                      {target.kind === 'url' ? (
                        <PageIcon icon={icon} />
                      ) : (
                        <FileTypeIcon path={target.path} size="1rem" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{target.label}</span>
                      <span className="block text-xs text-(--ui-text-tertiary)">{kind}</span>
                    </span>
                    <time
                      className="shrink-0 text-xs text-(--ui-text-tertiary)"
                      dateTime={opened.toISOString()}
                      title={opened.toLocaleString(locale)}
                    >
                      {opened.toDateString() === today ? time.format(opened) : date.format(opened)}
                    </time>
                  </RowButton>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-(--ui-text-tertiary)">{copy.noRecents}</p>
          )}
        </section>
      </div>
    </div>
  )
}
