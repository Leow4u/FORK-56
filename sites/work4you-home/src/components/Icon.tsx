import type { ReactNode } from 'react'
import type { IconName } from '../lib/glyphs'

const PATHS: Record<IconName, ReactNode> = {
  bot: (
    <>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 3v4M9 12v1M15 12v1" />
    </>
  ),
  branch: <path d="M6 3v9a4 4 0 0 0 4 4h8M15 12l4 4-4 4" />,
  chart: <path d="M4 20v-9M10 20V5M16 20v-7M21 20H3" />,
  chat: <path d="M4 5h16v11H10l-6 4zM8 10h8" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.4} />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  compare: <path d="M5 8h13l-3-3M19 16H6l3 3" />,
  doc: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  doubleCheck: <path d="M2 13l4 4 8-9M11 16l1 1 8-9" strokeWidth={2} />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" strokeWidth={2.1} />,
  go: <path d="M5 12h14M13 6l6 6-6 6" strokeWidth={2.1} />,
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19.5h20" />
    </>
  ),
  memory: <path d="M6 3h12v18l-6-4-6 4zM12 7v6M9 10h6" />,
  message: <path d="M4 5h16v11H10l-6 4z" />,
  reconcile: <path d="M3 12.5l3.5 3.5L13 9.5M11 15.5l1.5 1.5L21 8.5" />,
  replay: <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v5h5" strokeWidth={2} />,
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M16 14.3c2.9.3 5 2.6 5 5.7" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h12v10H2zM14 9h4l3 3.5V16h-7" />
      <circle cx="6" cy="18" r="1.8" />
      <circle cx="17" cy="18" r="1.8" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  windows: (
    <path
      d="M3 3h8.4v8.4H3zM12.6 3H21v8.4h-8.4zM3 12.6h8.4V21H3zM12.6 12.6H21V21h-8.4z"
      fill="currentColor"
      stroke="none"
    />
  ),
}

interface IconProps {
  className?: string
  name: IconName
}

/** Ícones de traço do site; herdam a cor do texto. */
export function Icon({ className, name }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
    >
      {PATHS[name]}
    </svg>
  )
}
