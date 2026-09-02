import { isTrustedComposioLogoUrl } from '@work4you/shared'
import { useState } from 'react'

import { useComposioLogoSrc } from '@/lib/composio-logo'
import { brandFor, brandGlyphStyle } from '@/lib/mcp-brands'
import { cn } from '@/lib/utils'

export type McpAvatarStatus = 'error' | 'needs-auth' | 'off' | 'ok' | 'probing' | 'unknown'

const STATUS_DOT: Record<McpAvatarStatus, string> = {
  error: 'bg-red-500',
  'needs-auth': 'bg-amber-500',
  off: 'bg-foreground/20',
  ok: 'bg-emerald-500',
  probing: 'animate-pulse bg-foreground/40',
  unknown: 'bg-foreground/20'
}

// Catalog avatars (native MCP + Work4You Apps) use the official Composio CDN
// mark. Packaged Electron paints it from a main-process data URL (Chromium
// net.fetch) because a file:// renderer cannot load logos.composio.dev as
// <img>, and the work4you-logo:// <img> path still lettered on Windows.
// Custom MCP URLs still never hit a favicon service.
export function McpAvatar({
  className,
  logo,
  name,
  status
}: {
  className?: string
  logo?: null | string
  name: string
  status: McpAvatarStatus
}) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const { failed: proxyFailed, src: resolved } = useComposioLogoSrc(failedLogo === logo ? null : logo)
  const remote = typeof logo === 'string' && isTrustedComposioLogoUrl(logo) && failedLogo !== logo
  const src = resolved && failedLogo !== resolved ? resolved : null
  const loading = remote && !src && !proxyFailed
  const brand = src || loading ? null : brandFor(name)

  return (
    <span
      className={cn(
        'relative inline-grid size-8 shrink-0 place-items-center rounded-md text-[length:var(--conversation-caption-font-size)] font-medium',
        (src || loading) && 'bg-white',
        !src && !loading && !brand && 'bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)',
        className
      )}
      style={
        !src && !loading && brand
          ? { backgroundColor: `color-mix(in srgb, ${brand.color} 16%, transparent)` }
          : undefined
      }
    >
      {src ? (
        <img
          alt=""
          className="size-5 object-contain"
          data-mcp-avatar={name}
          decoding="async"
          onError={() => setFailedLogo(typeof logo === 'string' ? logo : src)}
          referrerPolicy="no-referrer"
          src={src}
        />
      ) : loading ? null : brand ? (
        <brand.Icon aria-hidden className="size-4" style={brandGlyphStyle(brand)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-(--ui-chat-surface-background)',
          STATUS_DOT[status]
        )}
      />
    </span>
  )
}
