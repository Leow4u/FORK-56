import { createElement, type ReactNode } from 'react'

import { ErrorBoundary } from '@/components/error-boundary'

interface ContribBoundaryProps {
  children: ReactNode
  id: string
  variant?: 'chip' | 'pane'
}

interface ContribRenderProps {
  render: () => ReactNode
}

export function ContribRender({ render }: ContribRenderProps) {
  return createElement(render)
}

export function ContribBoundary({ children, id }: ContribBoundaryProps) {
  return <ErrorBoundary label={`contrib:${id}`}>{children}</ErrorBoundary>
}
