import { previewFaviconSrc } from '@work4you/shared'
import { useState } from 'react'

import { ToolIcon } from './tool-icon'

interface PageIconProps {
  icon?: string
  size?: string
}

/** The same favicon transport and fallback in tabs and new-tab shortcuts. */
export function PageIcon({ icon, size = '1rem' }: PageIconProps) {
  const [failed, setFailed] = useState<string>()
  const src = icon && icon !== failed ? previewFaviconSrc(icon) : null

  if (!src) {
    return <ToolIcon className="text-(--ui-text-secondary)" name="globe" size={size} />
  }

  return (
    <img
      alt=""
      className="shrink-0 object-contain"
      decoding="async"
      draggable={false}
      onError={() => setFailed(icon)}
      referrerPolicy="no-referrer"
      src={src}
      style={{ height: size, width: size }}
    />
  )
}
