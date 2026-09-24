'use client'

import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const OAuthAuthorizePage = dynamic(
  () => import('@/portal/pages/OAuthAuthorizePage').then(mod => mod.OAuthAuthorizePage),
  { ssr: false }
)

export default function Page() {
  return (
    <Suspense fallback={<p>A carregar…</p>}>
      <OAuthAuthorizePage />
    </Suspense>
  )
}
