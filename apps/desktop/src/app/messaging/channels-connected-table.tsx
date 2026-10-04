import type { ReactNode } from 'react'

import { StatusDot, type StatusTone } from '@/components/status-dot'
import { Badge } from '@/components/ui/badge'
import { Codicon } from '@/components/ui/codicon'
import { useI18n } from '@/i18n'

import { PlatformAvatar } from './platform-icon'

export interface ChannelsConnectedStatus {
  /** Reads as a check mark, like a connected MCP server. */
  connected: boolean
  label: string
  tone: StatusTone
}

export interface ChannelsConnectedRow {
  id: string
  /** Conversation or Integration — what is on the other end of the channel. */
  kind: string
  name: string
  /** Opens the channel's setup pane. */
  onOpen: () => void
  /** Pairing requests waiting for approval. */
  pending: number
  status: ChannelsConnectedStatus
  /** Right-aligned controls: the on/off switch. */
  trailing?: ReactNode
  /** Approved (paired) users. */
  users: number
}

/** The Connected view: one flat Channel / Type / Users / Status table — the
 *  MCP tab's Connected table, with the channel's kind and its pairing counts
 *  where that one shows the transport. */
export function ChannelsConnectedTable({ rows }: { rows: ChannelsConnectedRow[] }) {
  const { t } = useI18n()
  const m = t.messaging

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-(--ui-stroke-quaternary) text-left text-xs text-(--ui-text-tertiary)">
          <th className="h-9 px-2.5 font-normal" scope="col">
            {m.columnChannel}
          </th>
          <th className="h-9 w-[8.125rem] px-2.5 font-normal" scope="col">
            {m.columnType}
          </th>
          <th className="h-9 w-[7.5rem] px-2.5 font-normal" scope="col">
            {m.columnUsers}
          </th>
          <th className="h-9 w-[5.625rem] px-2.5 font-normal" scope="col">
            {m.columnStatus}
          </th>
          <th className="h-9 w-10 px-2.5 font-normal" scope="col">
            <span className="sr-only">{m.columnActions}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <ChannelsConnectedTableRow key={row.id} row={row} />
        ))}
      </tbody>
    </table>
  )
}

function ChannelsConnectedTableRow({ row }: { row: ChannelsConnectedRow }) {
  const { t } = useI18n()
  const m = t.messaging

  return (
    <tr className="group/row h-11 border-b border-(--ui-stroke-quaternary) last:border-b-0 hover:bg-(--ui-row-hover-background)">
      <td className="max-w-0 px-2.5">
        <button className="flex w-full min-w-0 items-center gap-2.5 text-left" onClick={row.onOpen} type="button">
          <PlatformAvatar className="rounded-[5px]" platformId={row.id} platformName={row.name} variant="solid" />
          <span className="truncate text-[0.84375rem] font-semibold text-foreground">{row.name}</span>
        </button>
      </td>
      <td className="px-2.5 text-[0.8125rem] text-(--ui-text-secondary)">{row.kind}</td>
      <td className="px-2.5 text-[0.8125rem] text-(--ui-text-secondary)">
        <span className="flex items-center gap-2 tabular-nums">
          {row.users > 0 ? row.users : '—'}
          {row.pending > 0 && (
            <Badge aria-label={m.pendingAria(row.pending)} variant="warn">
              {m.pendingBadge(row.pending)}
            </Badge>
          )}
        </span>
      </td>
      <td className="px-2.5">
        {row.status.connected ? (
          <span className="flex items-center text-(--ui-text-secondary)">
            <Codicon name="check" size="0.875rem" />
            <span className="sr-only">{row.status.label}</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-(--ui-text-secondary)">
            <StatusDot tone={row.status.tone} />
            {row.status.label}
          </span>
        )}
      </td>
      <td className="px-2.5">
        {row.trailing ? <span className="flex items-center justify-end gap-0.5">{row.trailing}</span> : null}
      </td>
    </tr>
  )
}
