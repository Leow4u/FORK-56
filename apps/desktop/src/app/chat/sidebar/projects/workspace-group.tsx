import { useStore } from '@nanostores/react'
import type * as React from 'react'

import { ProfileGlyph } from '@/components/ui/profile-glyph'
import { useI18n } from '@/i18n'
import { useStoreSelector } from '@/lib/use-session-slice'
import { setWorkspaceNodeOpen } from '@/store/layout'
import { newSessionInProfile, selectProfile } from '@/store/profile'
import { $sessionProfilesUsage } from '@/store/session'
import { $sidebarSessionRankIds } from '@/store/sidebar-sort'
import type { SessionInfo } from '@/work4you'

import { SidebarGroupRow, SidebarRowLead, SidebarRowLink, SidebarRowStack } from '../chrome'
import { rankSessions } from '../order'

import { PROJECT_PREVIEW_COUNT, useWorkspaceNodeOpen } from './model'
import type { SidebarSessionGroup } from './workspace-groups'
import { WorkspaceAddButton } from './workspace-header'

interface SidebarWorkspaceGroupProps {
  group: SidebarSessionGroup
  renderRows: (sessions: SessionInfo[]) => React.ReactNode
}

// One profile in the all-profiles view: its label, spend, and a preview of its
// most recent sessions.
export function SidebarWorkspaceGroup({ group, renderRows }: SidebarWorkspaceGroupProps) {
  const { t } = useI18n()
  const s = t.sidebar
  // Totals for the whole profile, not the loaded page — a selector so a refresh
  // that leaves this profile's spend unchanged doesn't repaint its header.
  const usage = useStoreSelector($sessionProfilesUsage, all => all[group.id])
  const rankIds = useStore($sidebarSessionRankIds)
  const [open, toggleOpen] = useWorkspaceNodeOpen(group.id)

  // The profile ranks by whatever the sort key says before it trims itself, so
  // the rows it hides are the ones the sort ranked last. Clicking its label is
  // how you see the rest.
  const visibleSessions = rankSessions(group.sessions, rankIds).slice(0, PROJECT_PREVIEW_COUNT)

  return (
    <SidebarRowStack>
      <SidebarGroupRow
        // A fresh session in that profile, keeping the all-profiles browse view.
        // Reveal the profile first so the new row lands somewhere visible.
        actions={
          <WorkspaceAddButton
            label={s.newSessionIn(group.label)}
            onClick={() => {
              setWorkspaceNodeOpen(group.id, true)
              newSessionInProfile(group.id)
            }}
          />
        }
        // Clicking a profile scopes the sidebar to it. Capitalized to sit level
        // with the project labels it alternates with (`Home`, and whatever the
        // user named theirs) — profile keys are stored lowercase.
        label={
          <SidebarRowLink
            aria-label={t.profiles.switchToProfile(group.label)}
            labelClassName="capitalize hover:text-foreground hover:underline"
            onClick={() => selectProfile(group.id)}
          >
            {group.label}
          </SidebarRowLink>
        }
        lead={
          <SidebarRowLead>
            {/* Fills the lead cell like a project's icon does: the glyph's own
                16px would sit 2px proud of the 14px column. */}
            <ProfileGlyph
              className="size-full"
              color={group.color ?? null}
              isDefault={group.id === 'default'}
              name={group.label}
            />
          </SidebarRowLead>
        }
        toggle={{ ariaLabel: s.projects.toggle(group.label, !open), onToggle: toggleOpen, open }}
        totals={{ costUsd: usage?.cost_usd ?? 0, tokens: usage?.tokens ?? 0 }}
      />
      {open &&
        (visibleSessions.length === 0 ? (
          <div className="min-h-7 pl-2 text-[0.75rem] leading-7 text-(--ui-text-quaternary)">{s.noSessions}</div>
        ) : (
          renderRows(visibleSessions)
        ))}
    </SidebarRowStack>
  )
}
