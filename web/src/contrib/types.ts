import type { ReactNode } from 'react'

export type ContributionSource = 'core' | (string & {})

export interface Contribution {
  id: string
  area: string
  source?: ContributionSource
  title?: string
  order?: number
  when?: () => boolean
  enabled?: boolean
  render?: () => ReactNode
  data?: unknown
}
