import { useState } from 'react'

import { resolveComposioLogoSrc } from '@/lib/composio-logo'
import { brandFor, brandGlyphStyle } from '@/lib/mcp-brands'
import { cn } from '@/lib/utils'

export type ServerStatus = 'off' | 'probing' | 'ok' | 'needs-auth' | 'error' | 'unknown'

export const STATUS_DOT: Record<ServerStatus, string> = {
  ok: 'bg-emerald-500',
  error: 'bg-red-500',
  'needs-auth': 'bg-amber-500',
  probing: 'animate-pulse bg-foreground/40',
  off: 'bg-foreground/20',
  unknown: 'bg-foreground/20'
}

// Catalog avatars (native MCP + Work4You Apps) use the official Composio CDN
// mark. Packaged Electron paints it through the privileged work4you-logo
// scheme because a file:// renderer cannot load logos.composio.dev as <img>.
// Custom MCP URLs still never hit a favicon service — a private host must not
// leak off-box. The status dot is optional: the Connected table reports
// status in its own column, so its avatars go without.
export function McpAvatar({
  className,
  logo,
  name,
  showStatus = true,
  status
}: {
  className?: string
  logo?: string | null
  name: string
  showStatus?: boolean
  status: ServerStatus
}) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const src = failedLogo === logo ? null : resolveComposioLogoSrc(logo)
  const brand = src ? null : brandFor(name)

  return (
    <span
      className={cn(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-md text-[length:var(--conversation-caption-font-size)] font-medium',
        src && 'bg-white',
        !src && !brand && 'bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)',
        className
      )}
      style={!src && brand ? { backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)` } : undefined}
    >
      {src ? (
        <img
          alt=""
          className="size-5 object-contain"
          decoding="async"
          onError={() => setFailedLogo(typeof logo === 'string' ? logo : src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : brand ? (
        <brand.Icon aria-hidden className="size-4" style={brandGlyphStyle(brand)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
      {showStatus && (
        <span
          aria-hidden
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-(--ui-chat-surface-background)',
            STATUS_DOT[status]
          )}
        />
      )}
    </span>
  )
}
