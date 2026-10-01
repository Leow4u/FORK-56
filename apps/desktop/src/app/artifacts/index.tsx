import type * as React from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { TitlebarIcon } from '@/app/shell/titlebar-icon'
import { ZoomableImage } from '@/components/chat/zoomable-image'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { SearchField } from '@/components/ui/search-field'
import { CountSkeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { RowButton } from '@/components/ui/row-button'
import { Tip } from '@/components/ui/tooltip'
import { type Translations, useI18n } from '@/i18n'
import { resolveBrandIcon } from '@/lib/brand-icon'
import {
  ExternalLink,
  ExternalLinkIcon,
  hostPathLabel,
  shortHostLabel,
  urlSlugTitleLabel,
  useLinkTitle
} from '@/lib/external-link'
import { FileText, FolderOpen, Link2 } from '@/lib/icons'
import { downloadGatewayMediaFile, isRemoteGateway } from '@/lib/media'
import { normalize } from '@/lib/text'
import { fmtDayTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import { getAllSessionMessages, listAllProfileSessions } from '@/work4you'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { PAGE_INSET_X } from '../layout-constants'
import { openSession } from '../open-session'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

import {
  ARTIFACT_FILTERS,
  type ArtifactFilter,
  artifactImageSrc,
  type ArtifactRecord,
  loadArtifactsForSessions
} from './artifact-utils'

function formatArtifactTime(timestamp: number): string {
  return fmtDayTime.format(new Date(timestamp))
}

function pageRangeLabel(total: number, page: number, pageSize: number, a: Translations['artifacts']): string {
  if (total === 0) {
    return a.zero
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)

  return a.rangeOf(start, end, total)
}

function paginationItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pageCount - 1, page + 1)

  if (start > 2) {
    pages.push('ellipsis')
  }

  for (let nextPage = start; nextPage <= end; nextPage += 1) {
    pages.push(nextPage)
  }

  if (end < pageCount - 1) {
    pages.push('ellipsis')
  }

  pages.push(pageCount)

  return pages
}

type CellCtx = {
  onOpen: (href: string) => void | Promise<void>
  onOpenChat: (sessionId: string) => void
}

const itemsLabel = (f: ArtifactFilter, a: Translations['artifacts']) =>
  f === 'link' ? a.itemsLink : f === 'file' ? a.itemsFile : a.itemsGeneric

interface ArtifactsViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

export function ArtifactsView({
  className,
  setStatusbarItemGroup: _setStatusbarItemGroup,
  ...props
}: ArtifactsViewProps) {
  const { t } = useI18n()
  const a = t.artifacts
  const navigate = useNavigate()
  const [artifacts, setArtifacts] = useState<ArtifactRecord[] | null>(null)
  const [query, setQuery] = useState('')

  const [kindFilter, setKindFilter] = useRouteEnumParam('tab', ARTIFACT_FILTERS, 'all')

  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set())
  const [imagePage, setImagePage] = useState(1)
  const [filePage, setFilePage] = useState(1)

  const [refreshing, setRefreshing] = useState(false)
  const refreshInFlightRef = useRef(false)

  const refreshArtifacts = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true
    setRefreshing(true)

    try {
      const sessions = (await listAllProfileSessions(30, 1)).sessions

      const { artifacts: nextArtifacts, failures } = await loadArtifactsForSessions(
        sessions,
        async session => (await getAllSessionMessages(session.id, session.profile)).messages
      )

      if (failures.length > 0) {
        const safeLimitFailures = failures.filter(({ error }) =>
          String(error instanceof Error ? error.message : error).includes('safe-load limit')
        ).length

        const otherFailures = failures.length - safeLimitFailures

        const detail = [
          safeLimitFailures ? `${safeLimitFailures} exceeded the safe transcript load limit.` : '',
          otherFailures ? `${otherFailures} could not be read.` : ''
        ]
          .filter(Boolean)
          .join(' ')

        notify({
          id: 'artifacts-partial-load',
          kind: 'warning',
          title: a.failedLoad,
          message: `Skipped ${failures.length} of ${sessions.length} recent sessions while indexing artifacts.`,
          detail,
          durationMs: 10_000
        })
      }

      setArtifacts(nextArtifacts.sort((left, right) => right.timestamp - left.timestamp))
    } catch (err) {
      notifyError(err, a.failedLoad)
      setArtifacts([])
    } finally {
      refreshInFlightRef.current = false
      setRefreshing(false)
    }
  }, [a])

  useRefreshHotkey(refreshArtifacts)

  useEffect(() => {
    void refreshArtifacts()
  }, [refreshArtifacts])

  useEffect(() => {
    setImagePage(1)
    setFilePage(1)
  }, [artifacts, kindFilter, query])

  const visibleArtifacts = useMemo(() => {
    if (!artifacts) {
      return []
    }

    const q = normalize(query)

    return artifacts.filter(artifact => {
      if (kindFilter !== 'all' && artifact.kind !== kindFilter) {
        return false
      }

      if (!q) {
        return true
      }

      return (
        artifact.label.toLowerCase().includes(q) ||
        artifact.value.toLowerCase().includes(q) ||
        artifact.sessionTitle.toLowerCase().includes(q)
      )
    })
  }, [artifacts, kindFilter, query])

  const visibleImageArtifacts = useMemo(
    () => visibleArtifacts.filter(artifact => artifact.kind === 'image'),
    [visibleArtifacts]
  )

  const visibleFileArtifacts = useMemo(
    () => visibleArtifacts.filter(artifact => artifact.kind !== 'image'),
    [visibleArtifacts]
  )

  const imagePageCount = Math.max(1, Math.ceil(visibleImageArtifacts.length / 24))
  const filePageCount = Math.max(1, Math.ceil(visibleFileArtifacts.length / 100))
  const currentImagePage = Math.min(imagePage, imagePageCount)
  const currentFilePage = Math.min(filePage, filePageCount)

  const pagedImageArtifacts = useMemo(
    () => visibleImageArtifacts.slice((currentImagePage - 1) * 24, currentImagePage * 24),
    [currentImagePage, visibleImageArtifacts]
  )

  const pagedFileArtifacts = useMemo(
    () => visibleFileArtifacts.slice((currentFilePage - 1) * 100, currentFilePage * 100),
    [currentFilePage, visibleFileArtifacts]
  )

  // Rotating placeholder nudges from real data — search matches file paths and
  // session titles, not just labels; show it.
  const searchHints = useMemo(() => {
    if (!artifacts?.length) {
      return undefined
    }

    const extensions = [
      ...new Set(artifacts.map(artifact => /\.(\w{2,4})$/.exec(artifact.value)?.[1]?.toLowerCase()).filter(Boolean))
    ].slice(0, 3) as string[]

    const titles = [...new Set(artifacts.map(artifact => artifact.sessionTitle).filter(Boolean))].slice(0, 2)

    const hints = [
      ...extensions.map(ext => t.common.tryHint(`.${ext}`)),
      ...titles.map(title => t.common.tryHint(title))
    ]

    return hints.length > 0 ? hints : undefined
  }, [artifacts, t])

  const counts = useMemo(() => {
    const all = artifacts || []

    return {
      all: all.length,
      image: all.filter(artifact => artifact.kind === 'image').length,
      file: all.filter(artifact => artifact.kind === 'file').length,
      link: all.filter(artifact => artifact.kind === 'link').length
    }
  }, [artifacts])

  const openArtifact = useCallback(
    async (href: string) => {
      try {
        // A gateway-local file resolves to file:// in remote mode (the file
        // lives on the gateway, not this disk). Opening that locally fails —
        // and an OAuth remote connection has no query token to build a download
        // URL. Fetch the bytes over the authenticated fs bridge instead.
        if (isRemoteGateway() && /^file:/i.test(href)) {
          await downloadGatewayMediaFile(href)

          return
        }

        if (window.work4youDesktop?.openExternal) {
          await window.work4youDesktop.openExternal(href)
        } else {
          window.open(href, '_blank', 'noopener,noreferrer')
        }
      } catch (err) {
        notifyError(err, a.openFailed)
      }
    },
    [a]
  )

  const markImageFailed = useCallback((id: string) => {
    setFailedImageIds(current => {
      if (current.has(id)) {
        return current
      }

      return new Set(current).add(id)
    })
  }, [])

  // Stable ctx: recreating it (or its onOpenChat closure) every render made
  // every artifact cell re-render whenever the page did — and a link cell's
  // async title fetch re-rendered the page repeatedly. openArtifact is already
  // a useCallback; navigate is stable, so onOpenChat can be too.
  const openChat = useCallback((sessionId: string) => openSession(sessionId, navigate), [navigate])
  const cellCtx: CellCtx = useMemo(() => ({ onOpen: openArtifact, onOpenChat: openChat }), [openArtifact, openChat])

  const filterTabs = [
    { id: 'all' as const, label: a.tabAll, count: counts.all },
    { id: 'image' as const, label: a.tabImages, count: counts.image },
    { id: 'file' as const, label: a.tabFiles, count: counts.file },
    { id: 'link' as const, label: a.tabLinks, count: counts.link }
  ]

  return (
    <section
      {...props}
      className={cn('flex h-full min-w-0 flex-col overflow-hidden bg-(--ui-chat-surface-background)', className)}
    >
      <div className={cn('shrink-0 pt-[calc(var(--titlebar-height)+0.75rem)] pb-3', PAGE_INSET_X)}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-foreground">{t.sidebar.nav.artifacts}</h1>
            <Tip label={refreshing ? a.refreshing : a.refresh}>
              <Button
                aria-label={refreshing ? a.refreshing : a.refresh}
                className="text-(--ui-text-tertiary) hover:bg-(--chrome-action-hover) hover:text-foreground"
                disabled={refreshing}
                onClick={() => void refreshArtifacts()}
                size="icon-titlebar"
                variant="ghost"
              >
                {refreshing ? <TitlebarIcon name="loading" spinning /> : <TitlebarIcon name="refresh" />}
              </Button>
            </Tip>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1" data-tour="page-tabs">
              {filterTabs.map(tab => {
                const active = kindFilter === tab.id

                return (
                  <Button
                    aria-pressed={active}
                    key={tab.id}
                    onClick={() => setKindFilter(tab.id)}
                    size="sm"
                    type="button"
                    variant={active ? 'chip' : 'text'}
                  >
                    {tab.label}
                    {artifacts ? (
                      <span className="text-[0.72em] font-normal text-(--ui-text-tertiary)">{tab.count}</span>
                    ) : (
                      <CountSkeleton />
                    )}
                  </Button>
                )
              })}
            </div>
            {counts.all > 0 && (
              <SearchField
                containerClassName="w-full max-w-xs"
                hints={searchHints}
                onChange={setQuery}
                placeholder={a.search}
                recede={false}
                shape="pill"
                value={query}
              />
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {!artifacts ? (
          <PageLoader label={a.indexing} />
        ) : visibleArtifacts.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <div className="text-sm font-medium">{a.noArtifactsTitle}</div>
              <div className="mt-1 text-xs text-muted-foreground">{a.noArtifactsDesc}</div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">
            <div className={cn('mx-auto flex w-full max-w-5xl flex-col gap-8 py-4', PAGE_INSET_X)}>
              {visibleImageArtifacts.length > 0 && (
                <section className="flex flex-col">
                  <ArtifactSectionHeader
                    pagination={
                      imagePageCount > 1 ? (
                        <ArtifactsPagination
                          className="ml-auto justify-end px-0"
                          itemLabel={a.itemsImage}
                          onPageChange={setImagePage}
                          page={currentImagePage}
                          pageSize={24}
                          total={visibleImageArtifacts.length}
                        />
                      ) : null
                    }
                    title={kindFilter === 'all' ? a.tabImages : null}
                  />
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] items-start gap-x-6 gap-y-5">
                    {pagedImageArtifacts.map(artifact => (
                      <ArtifactImageCard
                        artifact={artifact}
                        failedImage={failedImageIds.has(artifact.id)}
                        key={artifact.id}
                        onImageError={markImageFailed}
                        onOpenChat={sessionId => openSession(sessionId, navigate)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {visibleFileArtifacts.length > 0 && (
                <section className="flex flex-col">
                  <ArtifactSectionHeader
                    pagination={
                      filePageCount > 1 ? (
                        <ArtifactsPagination
                          className="ml-auto justify-end px-0"
                          itemLabel={itemsLabel(kindFilter, a)}
                          onPageChange={setFilePage}
                          page={currentFilePage}
                          pageSize={100}
                          total={visibleFileArtifacts.length}
                        />
                      ) : null
                    }
                    title={restSectionTitle(kindFilter, visibleFileArtifacts, a)}
                  />
                  <div className="overflow-x-auto rounded-lg border border-(--ui-stroke-tertiary) bg-(--ui-chat-bubble-background)">
                    <ArtifactTable artifacts={pagedFileArtifacts} ctx={cellCtx} filter={kindFilter} />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

interface ArtifactsPaginationProps {
  className?: string
  itemLabel: string
  onPageChange: (page: number) => void
  page: number
  pageSize: number
  total: number
}

function restSectionTitle(
  filter: ArtifactFilter,
  items: readonly ArtifactRecord[],
  a: Translations['artifacts']
): string | null {
  if (filter !== 'all' || items.length === 0) {
    return null
  }

  const kind = items[0]?.kind

  if (!kind || items.some(item => item.kind !== kind)) {
    return null
  }

  return kind === 'link' ? a.tabLinks : a.tabFiles
}

function ArtifactSectionHeader({ pagination, title }: { pagination?: React.ReactNode; title: string | null }) {
  if (!title && !pagination) {
    return null
  }

  return (
    <div className="mb-2 flex min-h-6 items-center gap-3">
      {title ? (
        <h2 className="min-w-0 text-[length:var(--conversation-text-font-size)] font-medium text-(--ui-text-secondary)">
          {title}
        </h2>
      ) : null}
      {pagination}
    </div>
  )
}

function ArtifactsPagination({ className, itemLabel, onPageChange, page, pageSize, total }: ArtifactsPaginationProps) {
  const { t } = useI18n()
  const a = t.artifacts
  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  if (pageCount <= 1) {
    return null
  }

  return (
    <div className={cn('flex h-6 items-center justify-between gap-2 px-1', className)}>
      <div className="shrink-0 text-[0.62rem] text-muted-foreground">
        {pageRangeLabel(total, page, pageSize, a)} {itemLabel}
      </div>
      {pageCount > 1 && (
        <Pagination className="mx-0 w-auto min-w-0 justify-end">
          <PaginationContent className="gap-0.5">
            <PaginationItem>
              <PaginationPrevious disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} />
            </PaginationItem>
            {paginationItems(page, pageCount).map((item, index) => (
              <PaginationItem key={`${item}-${index}`}>
                {item === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationButton
                    aria-label={a.goToPage(itemLabel, item)}
                    isActive={page === item}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </PaginationButton>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                disabled={page >= pageCount}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}

interface ArtifactImageCardProps {
  artifact: ArtifactRecord
  failedImage: boolean
  onImageError: (id: string) => void
  onOpenChat: (sessionId: string) => void
}

function ArtifactImageCard({ artifact, failedImage, onImageError, onOpenChat }: ArtifactImageCardProps) {
  const { t } = useI18n()
  const a = t.artifacts
  const [src, setSrc] = useState('')

  useEffect(() => {
    let active = true

    setSrc('')
    void artifactImageSrc(artifact.value)
      .then(nextSrc => {
        if (active) {
          setSrc(nextSrc)
        }
      })
      .catch(() => {
        if (active) {
          onImageError(artifact.id)
        }
      })

    return () => {
      active = false
    }
  }, [artifact.href, artifact.id, artifact.value, onImageError])

  return (
    <article className="min-w-0" data-tour="artifact-card">
      <div className="overflow-hidden rounded-lg">
        {!failedImage && src ? (
          <ZoomableImage
            alt={artifact.sessionTitle}
            className="h-48 w-full cursor-zoom-in object-cover"
            containerClassName="block w-full"
            decoding="async"
            loading="lazy"
            onError={() => onImageError(artifact.id)}
            slot="artifact-media"
            src={src}
          />
        ) : (
          <div className={cn('h-48 bg-(--ui-bg-quinary)', failedImage && 'cursor-default')} />
        )}
      </div>

      <div className="mt-2 min-w-0">
        <RowButton className="block w-full min-w-0 text-left" onClick={() => onOpenChat(artifact.sessionId)}>
          <div className="truncate text-[length:var(--conversation-caption-font-size)] font-medium">
            {artifact.sessionTitle}
          </div>
          <div className="mt-0.5 text-[0.6875rem] text-(--ui-text-tertiary)">
            {formatArtifactTime(artifact.timestamp)}
          </div>
        </RowButton>
        <div className="mt-1">
          <Button onClick={() => onOpenChat(artifact.sessionId)} size="xs" type="button" variant="textStrong">
            <FolderOpen className="size-3" />
            {a.chat}
          </Button>
        </div>
      </div>
    </article>
  )
}

const artifactActionClass =
  'flex h-full w-full min-w-0 items-center gap-2 px-2.5 py-1.5 text-left text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) font-normal text-(--ui-text-secondary) no-underline underline-offset-4 decoration-current/20 transition-colors hover:text-foreground hover:underline'

function ArtifactCellAction({
  children,
  href,
  onClick,
  title
}: {
  children: React.ReactNode
  href?: string
  onClick?: () => void
  title?: string
}) {
  if (href) {
    return (
      <ExternalLink className={artifactActionClass} href={href} showExternalIcon={false} title={title}>
        {children}
      </ExternalLink>
    )
  }

  return (
    <RowButton className={artifactActionClass} onClick={onClick}>
      {children}
    </RowButton>
  )
}

const PrimaryCell = memo(function PrimaryCell({ artifact, ctx }: { artifact: ArtifactRecord; ctx: CellCtx }) {
  const isLink = artifact.kind === 'link'
  const brand = isLink ? resolveBrandIcon(shortHostLabel(artifact.href)) : null
  const Icon = brand ?? (isLink ? Link2 : FileText)
  const fetchedTitle = useLinkTitle(isLink ? artifact.href : null)
  const label = isLink ? fetchedTitle || urlSlugTitleLabel(artifact.href) : artifact.label

  return (
    <ArtifactCellAction
      href={isLink ? artifact.href : undefined}
      onClick={isLink ? undefined : () => void ctx.onOpen(artifact.href)}
      title={label}
    >
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center self-start rounded-md bg-(--ui-bg-tertiary) text-(--ui-text-tertiary)">
        <Icon className="size-3.5" />
      </span>
      <span className={cn('min-w-0 flex-1', isLink ? 'wrap-anywhere' : 'truncate')}>
        {label}
        {isLink && <ExternalLinkIcon />}
      </span>
    </ArtifactCellAction>
  )
})

const LocationCell = memo(function LocationCell({ artifact }: { artifact: ArtifactRecord; ctx: CellCtx }) {
  const { t } = useI18n()
  const isLink = artifact.kind === 'link'
  const value = isLink ? hostPathLabel(artifact.value) : artifact.value
  const copyLabel = isLink ? t.artifacts.copyUrl : t.artifacts.copyPath

  return (
    <div className="group/location flex min-w-0 items-center gap-1.5">
      <Tip label={artifact.value}>
        <div
          className={cn(
            'min-w-0 flex-1 truncate text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)',
            isLink ? 'font-normal' : 'font-mono'
          )}
        >
          {value}
        </div>
      </Tip>
      <CopyButton
        appearance="icon"
        buttonSize="icon-xs"
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/location:opacity-100"
        iconClassName="size-3.5"
        label={copyLabel}
        text={artifact.value}
        title={copyLabel}
      />
    </div>
  )
})

const SessionCell = memo(function SessionCell({ artifact, ctx }: { artifact: ArtifactRecord; ctx: CellCtx }) {
  return (
    <ArtifactCellAction onClick={() => ctx.onOpenChat(artifact.sessionId)} title={artifact.sessionTitle}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{artifact.sessionTitle}</span>
        <span className="truncate text-[0.6875rem] font-normal text-(--ui-text-tertiary)">
          {formatArtifactTime(artifact.timestamp)}
        </span>
      </span>
    </ArtifactCellAction>
  )
})

interface ArtifactColumn {
  Cell: React.ComponentType<{ artifact: ArtifactRecord; ctx: CellCtx }>
  bodyClassName: string
  header: (filter: ArtifactFilter, a: Translations['artifacts']) => string
  id: 'location' | 'primary' | 'session'
  width: (filter: ArtifactFilter) => string
}

const ARTIFACT_COLUMNS: readonly ArtifactColumn[] = [
  {
    Cell: PrimaryCell,
    bodyClassName: 'p-0',
    header: (filter, a) =>
      filter === 'link' ? a.colTitleLink : filter === 'file' ? a.colTitleFile : a.colTitleDefault,
    id: 'primary',
    width: filter => (filter === 'link' ? 'w-[50%]' : 'w-[35%]')
  },
  {
    Cell: LocationCell,
    bodyClassName: 'px-2.5 py-1.5',
    header: (filter, a) =>
      filter === 'link' ? a.colLocationLink : filter === 'file' ? a.colLocationFile : a.colLocationDefault,
    id: 'location',
    width: filter => (filter === 'link' ? 'w-[30%]' : 'w-[41%]')
  },
  {
    Cell: SessionCell,
    bodyClassName: 'p-0',
    header: (_filter, a) => a.colSession,
    id: 'session',
    width: filter => (filter === 'link' ? 'w-[20%]' : 'w-[24%]')
  }
]

function ArtifactTable({
  artifacts,
  ctx,
  filter
}: {
  artifacts: readonly ArtifactRecord[]
  ctx: CellCtx
  filter: ArtifactFilter
}) {
  const { t } = useI18n()

  return (
    <table className="w-full min-w-176 table-fixed text-left text-[length:var(--conversation-caption-font-size)]">
      <thead className="border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-quinary) text-[0.625rem] uppercase tracking-[0.08em] text-(--ui-text-tertiary)">
        <tr>
          {ARTIFACT_COLUMNS.map(col => (
            <th className={cn(col.width(filter), 'px-2.5 py-1.5 font-medium')} key={col.id}>
              {col.header(filter, t.artifacts)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {artifacts.map(artifact => (
          <tr className="group/artifact" key={artifact.id}>
            {ARTIFACT_COLUMNS.map(col => {
              const Cell = col.Cell

              return (
                <td className={cn('align-middle', col.bodyClassName)} key={col.id}>
                  <Cell artifact={artifact} ctx={ctx} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
