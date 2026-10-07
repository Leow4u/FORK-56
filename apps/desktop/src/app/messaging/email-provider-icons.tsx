import { SiGmail, SiIcloud } from '@icons-pack/react-simple-icons'
import type { SVGProps } from 'react'

import { Settings2 } from '@/lib/icons'

/** Brand marks not in current Simple Icons — CC0 paths from simple-icons v9.13 where noted. */

export function OutlookBrandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V10.85l1.24.72h.01q.1.07.18.18.07.12.07.25zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z" />
    </svg>
  )
}

export function YahooBrandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M18.86 1.56 14.27 11.87H19.4L24 1.56H18.86M0 6.71 5.15 18.27 3.3 22.44H7.83 14.69 6.71H10.19l-2.8 6.73L4.62 6.71H0m15.62 6.16c-1.67 0-2.91 1.25-2.91 2.71 0 1.42 1.2 2.61 2.79 2.61 1.68 0 2.93-1.23 2.93-2.69 0-1.47-1.2-2.63-2.81-2.63Z" />
    </svg>
  )
}

/** Fastmail — no Simple Icons slug; stylized F on brand purple. */
export function FastmailBrandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M7 6h10v2.5H10.5v2.8H16V14H10.5v4H7V6z" />
    </svg>
  )
}

export const EMAIL_PROVIDER_ICON_COMPONENTS = {
  custom: Settings2,
  fastmail: FastmailBrandIcon,
  gmail: SiGmail,
  icloud: SiIcloud,
  outlook: OutlookBrandIcon,
  yahoo: YahooBrandIcon
} as const

export const EMAIL_PROVIDER_ICON_COLORS: Record<keyof typeof EMAIL_PROVIDER_ICON_COMPONENTS, string> = {
  custom: '#64748B',
  fastmail: '#0055A4',
  gmail: '#EA4335',
  icloud: '#007AFF',
  outlook: '#0078D4',
  yahoo: '#6001D2'
}
