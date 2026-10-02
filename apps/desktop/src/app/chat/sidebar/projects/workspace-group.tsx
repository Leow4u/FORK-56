import { useStore } from '@nanostores/react'
import type * as React from 'react'

import { Codicon } from '@/components/ui/codicon'
import { ProfileGlyph } from '@/components/ui/profile-glyph'
import { ProfileStateDot } from '@/components/ui/profile-state-dot'
import { useI18n } from '@/i18n'
import { useStoreSelector } from '@/lib/use-session-slice'
import { setWorkspaceNodeOpen } from '@/store/layout'
import { $profileBackendStates, newSessionInProfile, selectProfile } from '@/store/profile'
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

// One profile in the all-profiles view, drawn as a card: a band in the
// profile's color, its mark with the backend state, label, session count and
// spend, a preview of its most recent sessions, and a visible "new session
// here" foot so the per-profile create isn't a hover-only secret.
export function SidebarWorkspaceGroup({ group, renderRows }: SidebarWorkspaceGroupProps) {
  const { t } = useI18n()
  const s = t.sidebar
  const p = t.profiles
  // Totals for the whole profile, not the loaded page — a selector so a refresh
  // that leaves this profile's spend unchanged doesn't repaint its header.
  const usage = useStoreSelector($sessionProfilesUsage, all => all[group.id])
  const rankIds = useStore($sidebarSessionRankIds)
  const backendState = useStoreSelector($profileBackendStates, all => all[group.id] ?? 'asleep')
  const [open, toggleOpen] = useWorkspaceNodeOpen(group.id)

  // The profile ranks by whatever the sort key says before it trims itself, so
  // the rows it hides are the ones the sort ranked last. Clicking its label is
  // how you see the rest.
  const visibleSessions = rankSessions(group.sessions, rankIds).slice(0, PROJECT_PREVIEW_COUNT)

  const newSessionHere = () => {
    // A fresh session in that profile, keeping the all-profiles browse view.
    // Reveal the profile first so the new row lands somewhere visible.
    setWorkspaceNodeOpen(group.id, true)
    newSessionInProfile(group.id)
  }

  return (
    <SidebarRowStack
      className="overflow-hidden rounded-md border border-(--ui-border) bg-(--ui-bg-secondary)/50"
      data-slot="profile-card"
      style={{ boxShadow: `inset 3px 0 0 ${group.color ?? 'var(--ui-text-quaternary)'}` }}
    >
      <SidebarGroupRow
        actions={<WorkspaceAddButton label={s.newSessionIn(group.label)} onClick={newSessionHere} />}
        className="pl-1"
        // Clicking a profile scopes the sidebar to it. Capitalized to sit level
        // with the project labels it alternates with (`Home`, and whatever the
        // user named theirs) — profile keys are stored lowercase.
        label={
          <>
            <SidebarRowLink
              aria-label={t.profiles.switchToProfile(group.label)}
              labelClassName="capitalize hover:text-foreground hover:underline"
              onClick={() => selectProfile(group.id)}
            >
              {group.label}
            </SidebarRowLink>
            <span className="shrink-0 whitespace-nowrap text-[0.625rem] text-(--ui-text-quaternary)">
              {p.sessionCount(group.sessions.length)}
            </span>
          </>
        }
        lead={
          <SidebarRowLead className="relative overflow-visible">
            {/* Fills the lead cell like a project's icon does: the glyph's own
                16px would sit 2px proud of the 14px column. */}
            <ProfileGlyph
              className="size-full"
              color={group.color ?? null}
              isDefault={group.id === 'default'}
              name={group.label}
            />
            <ProfileStateDot
              className="-bottom-1 -right-1 size-1.5 ring-1"
              label={p.state[backendState]}
              state={backendState}
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
      <button
        className="flex items-center gap-1.5 border-t border-dashed border-(--ui-border) px-3 py-1 text-left text-[0.6875rem] text-(--ui-text-tertiary) transition-colors hover:bg-(--ui-control-hover-background) hover:text-foreground"
        onClick={newSessionHere}
        type="button"
      >
        <Codicon name="add" size="0.7rem" />
        {p.newSessionHere}
      </button>
    </SidebarRowStack>
  )
}
