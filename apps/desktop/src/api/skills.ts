import type {
  SkillHubPreview,
  SkillHubScanResult,
  SkillHubSearchResponse,
  SkillHubSourcesResponse,
  SkillInfo,
  StarmapGraph
} from '@/types/work4you'
import type { ActionResponse } from '@/types/work4you'

import { capabilityScoped, type ProfileScope, profileScoped, work4youApi } from './client'

export function getSkills(profile?: ProfileScope): Promise<SkillInfo[]> {
  return window.work4youDesktop.api<SkillInfo[]>({
    ...capabilityScoped(profile),
    path: '/api/skills'
  })
}

/** Raw SKILL.md text (frontmatter included) for ANY skill — bundled, hub, or
 *  learned — backing the Capabilities detail pane's full-skill view. */
export function getSkillContent(
  name: string,
  profile?: ProfileScope
): Promise<{ content: string; name: string; path: string }> {
  return window.work4youDesktop.api<{ content: string; name: string; path: string }>({
    ...capabilityScoped(profile),
    path: `/api/skills/content?name=${encodeURIComponent(name)}`
  })
}

export function setSkillEnabled(
  name: string,
  enabled: boolean,
  profile?: ProfileScope
): Promise<{ ok: boolean; name: string; enabled: boolean }> {
  return window.work4youDesktop.api<{ ok: boolean; name: string; enabled: boolean }>({
    ...capabilityScoped(profile),
    path: '/api/skills/toggle',
    method: 'PUT',
    body: { name, enabled }
  })
}

function profileNameFromScope(profile?: ProfileScope): string | undefined {
  if (!profile) {
    return undefined
  }

  const name = typeof profile === 'object' ? profile.profile : profile
  const trimmed = (name ?? '').trim()

  return trimmed || undefined
}

/** Create a local SKILL.md — same `POST /api/skills` path the web dashboard uses.
 *  Profile goes in the body: the handler reads `SkillCreate.profile`, not the
 *  query string. `capabilityScoped` still tags the Electron route. */
export function createSkill(
  skill: { category?: string; content: string; name: string },
  profile?: ProfileScope
): Promise<{ message?: string; path?: string; success: boolean }> {
  const profileName = profileNameFromScope(profile)

  return window.work4youDesktop.api<{ message?: string; path?: string; success: boolean }>({
    ...capabilityScoped(profile),
    path: '/api/skills',
    method: 'POST',
    body: {
      name: skill.name,
      content: skill.content,
      ...(skill.category ? { category: skill.category } : {}),
      ...(profileName ? { profile: profileName } : {})
    }
  })
}

export function getStarmapGraph(): Promise<StarmapGraph> {
  return work4youApi<StarmapGraph>({
    ...profileScoped(),
    // Backend REST contract — stays /api/learning even though the UI feature is
    // now "star map". Renaming this would break against an un-upgraded backend.
    path: '/api/learning/graph'
  })
}

export interface LearningNodeDetail {
  content: string
  kind: 'memory' | 'skill'
  label: string
  ok: boolean
}

export function getLearningNode(id: string, profile?: ProfileScope): Promise<LearningNodeDetail> {
  return window.work4youDesktop.api<LearningNodeDetail>({
    ...capabilityScoped(profile),
    path: `/api/learning/node?id=${encodeURIComponent(id)}`
  })
}

export function deleteLearningNode(id: string, profile?: ProfileScope): Promise<{ message: string; ok: boolean }> {
  return window.work4youDesktop.api<{ message: string; ok: boolean }>({
    ...capabilityScoped(profile),
    path: '/api/learning/node',
    method: 'DELETE',
    body: { id }
  })
}

export function editLearningNode(
  id: string,
  content: string,
  profile?: ProfileScope
): Promise<{ message: string; ok: boolean }> {
  return window.work4youDesktop.api<{ message: string; ok: boolean }>({
    ...capabilityScoped(profile),
    path: '/api/learning/node',
    method: 'PUT',
    body: { content, id }
  })
}

// ---------------------------------------------------------------------------
// Skills hub — search / preview / scan / install (parity with `work4you skills`
// and the dashboard's Browse-hub tab). Installs spawn background actions whose
// logs are tailed via getActionStatus().
// ---------------------------------------------------------------------------

const HUB_REQUEST_TIMEOUT_MS = 45_000

export function getSkillHubSources(profile?: null | string): Promise<SkillHubSourcesResponse> {
  return work4youApi<SkillHubSourcesResponse>({
    ...profileScoped(profile),
    path: '/api/skills/hub/sources',
    timeoutMs: HUB_REQUEST_TIMEOUT_MS
  })
}

export function searchSkillsHub(
  query: string,
  source = 'all',
  limit = 20,
  profile?: null | string
): Promise<SkillHubSearchResponse> {
  const params = new URLSearchParams({ q: query, source, limit: String(limit) })

  return work4youApi<SkillHubSearchResponse>({
    ...profileScoped(profile),
    path: `/api/skills/hub/search?${params.toString()}`,
    timeoutMs: HUB_REQUEST_TIMEOUT_MS
  })
}

export function previewSkillHub(identifier: string, profile?: null | string): Promise<SkillHubPreview> {
  return work4youApi<SkillHubPreview>({
    ...profileScoped(profile),
    path: `/api/skills/hub/preview?identifier=${encodeURIComponent(identifier)}`,
    timeoutMs: HUB_REQUEST_TIMEOUT_MS
  })
}

export function scanSkillHub(identifier: string, profile?: null | string): Promise<SkillHubScanResult> {
  return work4youApi<SkillHubScanResult>({
    ...profileScoped(profile),
    path: `/api/skills/hub/scan?identifier=${encodeURIComponent(identifier)}`,
    timeoutMs: HUB_REQUEST_TIMEOUT_MS
  })
}

export function installSkillFromHub(identifier: string, profile?: ProfileScope): Promise<ActionResponse> {
  return window.work4youDesktop.api<ActionResponse>({
    ...capabilityScoped(profile),
    path: '/api/skills/hub/install',
    method: 'POST',
    body: { identifier }
  })
}

export function uninstallSkillFromHub(name: string, profile?: ProfileScope): Promise<ActionResponse> {
  return window.work4youDesktop.api<ActionResponse>({
    ...capabilityScoped(profile),
    path: '/api/skills/hub/uninstall',
    method: 'POST',
    body: { name }
  })
}

export function updateSkillsFromHub(profile?: ProfileScope): Promise<ActionResponse> {
  return window.work4youDesktop.api<ActionResponse>({
    ...capabilityScoped(profile),
    path: '/api/skills/hub/update',
    method: 'POST',
    body: {}
  })
}
