import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

import { McpAvatar, type ServerStatus, STATUS_DOT } from './mcp-avatar'

/** What the Type column says: how the agent reaches the server, that a
 *  Work4You Apps connector is hosted for it, or that it is a CLI login on the
 *  backend host (GitHub CLI). */
export type McpConnectedType = 'http' | 'stdio' | 'hosted' | 'cli'

export interface McpConnectedRow {
  /** Server / app id; anchors the row for deep links (`mcp-server-<id>`). */
  id: string
  logo?: string | null
  name: string
  oauth: boolean
  /** Opens the server's config pane. Hosted apps have none. */
  onOpen?: () => void
  status: ServerStatus
  /** Right-aligned controls: icon actions + switch, or Disconnect. */
  trailing?: ReactNode
  type: McpConnectedType | null
}

/** The Connected view: one flat Server / Type / Status table, every server
 *  listed once. Sections and the Popular pin belong to Discover. */
export function McpConnectedTable({ rows }: { rows: McpConnectedRow[] }) {
  const { t } = useI18n()
  const m = t.settings.mcp

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-(--ui-stroke-quaternary) text-left text-xs text-(--ui-text-tertiary)">
          <th className="h-9 px-2.5 font-normal" scope="col">
            {m.columnServer}
          </th>
          <th className="h-9 w-40 px-2.5 font-normal" scope="col">
            {m.columnType}
          </th>
          <th className="h-9 w-32 px-2.5 font-normal" scope="col">
            {m.columnStatus}
          </th>
          <th className="h-9 w-px px-2.5 font-normal" scope="col">
            <span className="sr-only">{m.columnActions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <McpConnectedTableRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  )
}

function McpConnectedTableRow({ row }: { row: McpConnectedRow }) {
  const { t } = useI18n()
  const m = t.settings.mcp

  const typeLabel: Record<McpConnectedType, string> = {
    cli: m.typeLocalCli,
    hosted: m.typeHostedApp,
    http: m.transportHttp,
    stdio: m.transportStdio
  }

  const server = (
    <span className="flex min-w-0 items-center gap-2.5">
      <McpAvatar
        className="size-6 rounded-[5px] text-[0.7rem]"
        logo={row.logo}
        name={row.id}
        showStatus={false}
        status={row.status}
      />
      <span className="truncate font-semibold text-foreground">{row.name}</span>
    </span>
  )

  return (
    <tr
      className="group/row h-11 border-b border-(--ui-stroke-quaternary) last:border-b-0 hover:bg-(--ui-row-hover-background)"
      id={`mcp-server-${row.id}`}
    >
      <td className="max-w-0 px-2.5">
        {row.onOpen ? (
          <button className="flex w-full min-w-0 items-center text-left" onClick={row.onOpen} type="button">
            {server}
          </button>
        ) : (
          server
        )}
      </td>
      <td className="px-2.5 text-[0.8125rem] text-(--ui-text-secondary)">
        <span className="flex items-center gap-2">
          {row.type ? typeLabel[row.type] : '—'}
          {row.oauth && <Badge variant="muted">{m.authOauth}</Badge>}
        </span>
      </td>
      <td className="px-2.5">
        <StatusCell status={row.status} />
      </td>
      <td className="px-2.5">
        {row.trailing ? <span className="flex items-center justify-end gap-0.5">{row.trailing}</span> : null}
      </td>
    </tr>
  )
}

// A connected server reads as a check, like the reference connectors list;
// anything else spells out what is wrong next to its status dot.
function StatusCell({ status }: { status: ServerStatus }) {
  const { t } = useI18n()
  const m = t.settings.mcp

  if (status === 'ok') {
    return (
      <span className="flex items-center text-(--ui-text-secondary)">
        <Codicon name="check" size="0.875rem" />
        <span className="sr-only">{m.statusConnected}</span>
      </span>
    )
  }

  const label =
    status === 'probing'
      ? m.statusConnecting
      : status === 'needs-auth'
        ? m.statusNeedsAuth
        : status === 'error'
          ? m.statusError
          : status === 'off'
            ? m.statusOff
            : ''

  return (
    <span className="flex items-center gap-1.5 text-xs text-(--ui-text-secondary)">
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[status])} />
      {label}
    </span>
  )
}
