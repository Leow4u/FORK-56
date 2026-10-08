import { useStore } from '@nanostores/react'
import type * as React from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { TitlebarIcon } from '@/app/shell/titlebar-icon'
import { ZoomableImage } from '@/components/chat/zoomable-image'
import { PageLoader } from '@/components/page-loader'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination'
import { ProfileFace } from '@/components/ui/profile-face'
import { RowButton } from '@/components/ui/row-button'
import { SearchField } from '@/components/ui/search-field'
import { CountSkeleton } from '@/components/ui/skeleton'
import { TextTab, TextTabMeta } from '@/components/ui/text-tab'
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
import { FileText, FolderOpen, Link2, ExternalLink as OpenIcon } from '@/lib/icons'
import { downloadGatewayMediaFile, isRemoteGateway } from '@/lib/media'
import { normalize } from '@/lib/text'
import { fmtDayTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { $activeConnectionId } from '@/store/connections'
import { notify, notifyError } from '@/store/notifications'
import { $profiles, $profileScope, profileLabel, sidebarProfileForScope } from '@/store/profile'
import { getAllSessionMessages, listAllProfileSessions } from '@/work4you'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { LIBRARY_PAGE_MAX_W, PAGE_HEADER_TOP, PAGE_INSET_X } from '../layout-constants'
import { openSession } from '../open-session'
import { PageTitle } from '../page-title'
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
  showProfile: boolean
}

interface ArtifactsViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

export function ArtifactsView(props: ArtifactsViewProps) {
  const scope = useStore($profileScope)
  const connectionId = useStore($activeConnectionId)
  const profile = sidebarProfileForScope(scope)

  // A scope change starts a fresh view synchronously: no previous profile's
  // rows, image failures or pending refresh can carry into the new context.
  return <ScopedArtifactsView {...props} key={JSON.stringify([connectionId, profile])} profile={profile} />
}

function ScopedArtifactsView({
  className,
  profile,
  setStatusbarItemGroup: _setStatusbarItemGroup,
  ...props
}: ArtifactsViewProps & { profile: string }) {
  const { t } = useI18n()
  const a = t.artifacts
  const navigate = useNavigate()
  const [artifacts, setArtifacts] = useState<ArtifactRecord[] | null>(null)
  const [query, setQuery] = useState('')

  const [kindFilter, setKindFilter] = useRouteEnumParam('tab', ARTIFACT_FILTERS, 'all')

  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set())
  const [imagePage, setImagePage] = useState(1)
  const [filePage, setFilePage] = useState(1)
  const [linkPage, setLinkPage] = useState(1)

  const [refreshing, setRefreshing] = useState(false)
  const loadState = useRef({ epoch: 0, inFlight: false })

  const refreshArtifacts = useCallback(async () => {
    if (loadState.current.inFlight) {
      return
    }

    loadState.current.inFlight = true
    const epoch = ++loadState.current.epoch
    const isCurrent = () => epoch === loadState.current.epoch

    setRefreshing(true)

    try {
      const sessions = (await listAllProfileSessions(30, 1, 'exclude', 'recent', profile)).sessions

      if (!isCurrent()) {
        return
      }

      const { artifacts: nextArtifacts, failures } = await loadArtifactsForSessions(sessions, async session =>
        isCurrent() ? (await getAllSessionMessages(session.id, session.profile)).messages : []
      )

      if (!isCurrent()) {
        return
      }

      if (failures.length > 0) {
        const safeLimitFailures = failures.filter(({ error }) =>
          String(error instanceof Error ? error.message : error).includes('safe-load limit')
        ).length

        const otherFailures = failures.length - safeLimitFailures

        const detail = [
          safeLimitFailures ? a.skippedSafeLimit(safeLimitFailures) : '',
          otherFailures ? a.skippedUnreadable(otherFailures) : ''
        ]
          .filter(Boolean)
          .join(' ')

        notify({
          id: 'artifacts-partial-load',
          kind: 'warning',
          title: a.failedLoad,
          message: a.skippedSessions(failures.length, sessions.length),
          detail,
          durationMs: 10_000
        })
      }

      setArtifacts(nextArtifacts.sort((left, right) => right.timestamp - left.timestamp))
    } catch (err) {
      if (isCurrent()) {
        notifyError(err, a.failedLoad)
        setArtifacts([])
      }
    } finally {
      if (isCurrent()) {
        loadState.current.inFlight = false
        setRefreshing(false)
      }
    }
  }, [a, profile])

  useRefreshHotkey(refreshArtifacts)

  useEffect(() => {
    const state = loadState.current

    void refreshArtifacts()

    return () => {
      state.epoch += 1
      state.inFlight = false
    }
  }, [refreshArtifacts])

  useEffect(() => {
    setImagePage(1)
    setFilePage(1)
    setLinkPage(1)
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
    () => visibleArtifacts.filter(artifact => artifact.kind === 'file'),
    [visibleArtifacts]
  )

  const visibleLinkArtifacts = useMemo(
    () => visibleArtifacts.filter(artifact => artifact.kind === 'link'),
    [visibleArtifacts]
  )

  const imagePageCount = Math.max(1, Math.ceil(visibleImageArtifacts.length / 24))
  const filePageCount = Math.max(1, Math.ceil(visibleFileArtifacts.length / 100))
  const linkPageCount = Math.max(1, Math.ceil(visibleLinkArtifacts.length / 100))
  const currentLinkPage = Math.min(linkPage, linkPageCount)
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

  const pagedLinkArtifacts = useMemo(
    () => visibleLinkArtifacts.slice((currentLinkPage - 1) * 100, currentLinkPage * 100),
    [currentLinkPage, visibleLinkArtifacts]
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
  const showProfile = profile === 'all'

  const cellCtx: CellCtx = useMemo(
    () => ({ onOpen: openArtifact, onOpenChat: openChat, showProfile }),
    [openArtifact, openChat, showProfile]
  )

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
      <div className={cn('shrink-0 pb-3', PAGE_HEADER_TOP, PAGE_INSET_X)}>
        <div className={cn('mx-auto w-full', LIBRARY_PAGE_MAX_W)}>
          <PageTitle
            aside={
              <div className="flex min-w-0 flex-1 basis-72 items-center justify-end gap-3">
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
            }
            className="flex-wrap"
          >
            <span className="flex items-center gap-3">
              {profile !== 'all' && <ProfileFace name={profile} size={36} />}
              {t.sidebar.nav.artifacts}
            </span>
          </PageTitle>
          <div className="-mt-5 mb-6 flex items-center gap-2 text-sm text-(--ui-text-tertiary)">
            {profile === 'all' ? t.profiles.allProfiles : <ArtifactProfile className="text-sm" name={profile} />}
            <span aria-hidden>·</span>
            <span>{a.subtitle}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1" data-tour="page-tabs">
              {filterTabs.map(tab => {
                const active = kindFilter === tab.id

                return (
                  <TextTab
                    active={active}
                    aria-pressed={active}
                    key={tab.id}
                    onClick={() => setKindFilter(tab.id)}
                    type="button"
                  >
                    {tab.label}
                    {artifacts ? <TextTabMeta>{tab.count}</TextTabMeta> : <CountSkeleton />}
                  </TextTab>
                )
              })}
            </div>
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
          <div className={cn('h-full overflow-y-auto [scrollbar-gutter:stable]', PAGE_INSET_X)}>
            <div className={cn('mx-auto flex w-full flex-col gap-8 py-4', LIBRARY_PAGE_MAX_W)}>
              {visibleImageArtifacts.length > 0 && (
                <section className="flex flex-col">
                  <ArtifactSectionHeader
                    count={kindFilter === 'all' ? visibleImageArtifacts.length : undefined}
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
                        showProfile={showProfile}
                      />
                    ))}
                  </div>
                </section>
              )}

              {visibleFileArtifacts.length > 0 && (
                <section className="flex flex-col">
                  <ArtifactSectionHeader
                    count={kindFilter === 'all' ? visibleFileArtifacts.length : undefined}
                    pagination={
                      filePageCount > 1 ? (
                        <ArtifactsPagination
                          className="ml-auto justify-end px-0"
                          itemLabel={a.itemsFile}
                          onPageChange={setFilePage}
                          page={currentFilePage}
                          pageSize={100}
                          total={visibleFileArtifacts.length}
                        />
                      ) : null
                    }
                    title={kindFilter === 'all' ? a.tabFiles : null}
                  />
                  <div className="overflow-x-auto">
                    <ArtifactTable artifacts={pagedFileArtifacts} ctx={cellCtx} filter="file" />
                  </div>
                </section>
              )}
              {visibleLinkArtifacts.length > 0 && (
                <section className="flex flex-col">
                  <ArtifactSectionHeader
                    count={kindFilter === 'all' ? visibleLinkArtifacts.length : undefined}
                    pagination={
                      linkPageCount > 1 ? (
                        <ArtifactsPagination
                          className="ml-auto justify-end px-0"
                          itemLabel={a.itemsLink}
                          onPageChange={setLinkPage}
                          page={currentLinkPage}
                          pageSize={100}
                          total={visibleLinkArtifacts.length}
                        />
                      ) : null
                    }
                    title={kindFilter === 'all' ? a.tabLinks : null}
                  />
                  <div className="overflow-x-auto">
                    <ArtifactTable artifacts={pagedLinkArtifacts} ctx={cellCtx} filter="link" />
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

function ArtifactSectionHeader({
  count,
  pagination,
  title
}: {
  count?: number
  pagination?: React.ReactNode
  title: string | null
}) {
  if (!title && !pagination) {
    return null
  }

  return (
    <div className="mb-3 flex min-h-6 items-center gap-3">
      {title ? <h2 className="min-w-0 text-base font-semibold text-foreground">{title}</h2> : null}
      {count !== undefined && <span className="text-sm text-(--ui-text-tertiary)">{count}</span>}
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
  showProfile: boolean
}

function ArtifactProfile({ name, className }: { name?: string; className?: string }) {
  const profiles = useStore($profiles)
  const owner = profiles.find(profile => profile.name === (name || 'default'))

  return (
    <span className={cn('block truncate text-[0.6875rem] text-(--ui-text-tertiary)', className)}>
      {owner ? profileLabel(owner) : name || 'default'}
    </span>
  )
}

function ArtifactImageCard({ artifact, failedImage, onImageError, onOpenChat, showProfile }: ArtifactImageCardProps) {
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
          {showProfile ? <ArtifactProfile name={artifact.profile} /> : null}
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
  'flex h-full w-full min-w-0 items-center gap-3 py-3 text-left text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) font-normal text-(--ui-text-secondary) no-underline underline-offset-4 decoration-current/20 transition-colors hover:text-foreground hover:underline'

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
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">
          {label}
          {isLink && <ExternalLinkIcon />}
        </span>
        <Tip label={artifact.value}>
          <span className="mt-0.5 block truncate text-xs text-(--ui-text-tertiary)">
            {isLink
              ? hostPathLabel(artifact.value)
              : artifact.value.replace(/\\/g, '/').split('/').slice(0, -1).filter(Boolean).at(-1) || artifact.value}
          </span>
        </Tip>
      </span>
    </ArtifactCellAction>
  )
})

const DateCell = memo(function DateCell({ artifact, ctx }: { artifact: ArtifactRecord; ctx: CellCtx }) {
  const { t } = useI18n()
  const copyLabel = artifact.kind === 'link' ? t.artifacts.copyUrl : t.artifacts.copyPath

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <span className="truncate text-xs text-(--ui-text-tertiary)">{formatArtifactTime(artifact.timestamp)}</span>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/artifact:opacity-100 group-focus-within/artifact:opacity-100 [@media(hover:none)]:opacity-100">
        <Tip label={t.artifactCard.open}>
          <Button
            aria-label={t.artifactCard.open}
            onClick={() => void ctx.onOpen(artifact.href)}
            size="icon-xs"
            variant="ghost"
          >
            <OpenIcon />
          </Button>
        </Tip>
        <CopyButton
          appearance="icon"
          buttonSize="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          label={copyLabel}
          text={artifact.value}
          title={copyLabel}
        />
      </div>
    </div>
  )
})

const SessionCell = memo(function SessionCell({ artifact, ctx }: { artifact: ArtifactRecord; ctx: CellCtx }) {
  return (
    <ArtifactCellAction onClick={() => ctx.onOpenChat(artifact.sessionId)} title={artifact.sessionTitle}>
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{artifact.sessionTitle}</span>
        {ctx.showProfile ? <ArtifactProfile name={artifact.profile} /> : null}
      </span>
    </ArtifactCellAction>
  )
})

interface ArtifactColumn {
  Cell: React.ComponentType<{ artifact: ArtifactRecord; ctx: CellCtx }>
  header: (filter: ArtifactFilter, a: Translations['artifacts']) => string
  id: 'date' | 'primary' | 'session'
  width: string
}

const ARTIFACT_COLUMNS: readonly ArtifactColumn[] = [
  {
    Cell: PrimaryCell,
    header: (filter, a) => (filter === 'link' ? a.colTitleLink : a.colTitleFile),
    id: 'primary',
    width: 'w-[44%]'
  },
  {
    Cell: SessionCell,
    header: (_filter, a) => a.chat,
    id: 'session',
    width: 'w-[34%]'
  },
  {
    Cell: DateCell,
    header: (_filter, a) => a.colDate,
    id: 'date',
    width: 'w-[22%]'
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
      <thead className="border-b border-(--ui-stroke-tertiary) text-xs text-(--ui-text-tertiary)">
        <tr>
          {ARTIFACT_COLUMNS.map(col => (
            <th className={cn(col.width, 'pe-4 pb-2 font-normal')} key={col.id}>
              {col.header(filter, t.artifacts)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {artifacts.map(artifact => (
          <tr
            className="group/artifact border-b border-(--ui-stroke-tertiary) transition-colors last:border-0 hover:bg-(--chrome-action-hover) focus-within:bg-(--chrome-action-hover)"
            key={artifact.id}
          >
            {ARTIFACT_COLUMNS.map(col => {
              const Cell = col.Cell

              return (
                <td className={'pe-4 align-middle'} key={col.id}>
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
