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
import { RowButton } from '@/components/ui/row-button'
import { useI18n } from '@/i18n'
import { $currentCwd } from '@/store/session'

interface NewTabTool {
  icon: string
  label: string
  pane: 'files' | 'review' | 'terminal'
  /** Gated on an open project, like the pane itself. */
  project: boolean
}

export function PreviewNewTab() {
  const { t } = useI18n()
  const hasProject = Boolean(useStore($currentCwd).trim())
  const copy = t.preview.newTab

  const tools: NewTabTool[] = [
    { icon: 'files', label: t.shell.panes.files, pane: 'files', project: true },
    { icon: 'git-compare', label: copy.review, pane: 'review', project: true },
    { icon: 'terminal', label: t.shell.panes.terminal, pane: 'terminal', project: false }
  ]

  return (
    <div className="absolute inset-0 overflow-auto bg-background">
      <section className="flex flex-col px-7 py-7">
        <SectionHeading title={copy.tools} variant="group" />
        <div className="flex flex-col divide-y divide-(--ui-stroke-tertiary)">
          {tools.map(tool => (
            <RowButton
              className="flex min-w-0 cursor-pointer items-center gap-3 px-3.5 py-3 text-left text-sm text-foreground hover:bg-(--chrome-action-hover) disabled:cursor-not-allowed disabled:opacity-50"
              disabled={tool.project && !hasProject}
              key={tool.pane}
              onClick={() => restoreTreePane(tool.pane)}
            >
              <Codicon className="text-(--ui-text-secondary)" name={tool.icon} size="1rem" />
              <span className="min-w-0 flex-1 truncate">{tool.label}</span>
              <Codicon className="text-(--ui-text-tertiary)" name="chevron-right" size="0.875rem" />
            </RowButton>
          ))}
        </div>
        {!hasProject && <p className="mt-3 text-xs text-(--ui-text-tertiary)">{copy.needsProject}</p>}
      </section>
    </div>
  )
}
