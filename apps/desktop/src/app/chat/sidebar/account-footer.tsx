import { useEffect, useState } from 'react'

import { SidebarFooter } from '@/components/ui/sidebar'

// Step 1 of the sidebar user menu: the signed-in Work4You Portal account's
// email as a quiet, non-interactive label at the very bottom of the sidebar,
// below everything that already exists. This is the ACCOUNT (the human's
// Portal login), not a profile — the Profile Rail above is untouched.
//
// Renders nothing when the desktop bridge is absent (web/tests), when the
// user is signed out, or when the shell predates the `email` status field.
// Re-checks on window focus: portal sign-in/out happens in a separate
// BrowserWindow, so focus returning to the main window is the natural
// "state may have changed" signal — no polling, no new IPC surface.
export function AccountFooter() {
  const [email, setEmail] = useState<null | string>(null)

  useEffect(() => {
    let cancelled = false

    const check = () => {
      const cloud = window.work4youDesktop?.cloud

      if (!cloud) {
        return
      }

      void cloud
        .status()
        .then(status => {
          if (!cancelled) {
            setEmail(status.signedIn && status.email ? status.email : null)
          }
        })
        .catch(() => undefined)
    }

    check()
    window.addEventListener('focus', check)

    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!email) {
    return null
  }

  return (
    <SidebarFooter className="shrink-0 border-t border-(--ui-stroke-tertiary) px-3 py-1.5">
      <span className="truncate text-xs text-(--ui-text-tertiary)" title={email}>
        {email}
      </span>
    </SidebarFooter>
  )
}
