import { composioLogoImgSrc } from '@work4you/shared'
import { type ReactNode, useState } from 'react'

import { WIDGET_SHELL_CLASS } from '@/components/chat/widget-shell'
import { Loader2 } from '@/lib/icons'
import { brandFor, brandGlyphStyle } from '@/lib/mcp-brands'
import { cn } from '@/lib/utils'

const SHELL_CLASS = `${WIDGET_SHELL_CLASS} text-[length:var(--conversation-text-font-size)] text-(--ui-text-primary)`

/** Official toolkit mark → curated glyph → letter. Never fetches a private MCP favicon. */
export function McpSetupMark({ className, logo, name }: { className?: string; logo?: null | string; name: string }) {
  const [failedLogo, setFailedLogo] = useState<null | string>(null)
  const src = failedLogo === logo ? null : composioLogoImgSrc(logo)
  const brand = src ? null : brandFor(name)
  const initial = (name.trim().charAt(0) || '?').toUpperCase()

  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid size-9 shrink-0 place-items-center rounded-lg text-sm font-medium',
        src && 'bg-white',
        !src && !brand && 'bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)',
        className
      )}
      style={!src && brand ? { backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)` } : undefined}
    >
      {src ? (
        <img
          alt=""
          className="size-6 object-contain"
          decoding="async"
          onError={() => setFailedLogo(typeof logo === 'string' ? logo : src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : brand ? (
        <brand.Icon aria-hidden className="size-5" style={brandGlyphStyle(brand)} />
      ) : (
        initial
      )}
    </span>
  )
}

export function McpSetupCard({
  action,
  children,
  decline,
  header,
  label,
  logo,
  markName,
  muted,
  ready = true,
  statusIcon,
  subtitle,
  title
}: {
  action?: ReactNode
  children?: ReactNode
  decline?: ReactNode
  header?: string
  label: string
  logo?: null | string
  markName: string
  muted?: boolean
  ready?: boolean
  statusIcon?: ReactNode
  subtitle?: string
  title: string
}) {
  return (
    <div aria-label={label} className={cn(SHELL_CLASS, 'my-1.5 grid gap-3')} data-slot="mcp-setup-inline" role="group">
      {header ? <p className="text-[0.6875rem] text-(--ui-text-tertiary)">{header}</p> : null}
      <div className="flex items-center gap-3">
        <McpSetupMark logo={logo} name={markName} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium leading-(--conversation-line-height)',
              muted && 'italic text-(--ui-text-tertiary)'
            )}
          >
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-(--ui-text-secondary)">{subtitle}</p>
          ) : null}
        </div>
        {ready ? action : <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-(--ui-text-tertiary)" />}
        {statusIcon}
      </div>
      {children}
      {decline}
    </div>
  )
}
