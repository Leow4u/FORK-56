import type {
  ProfileCreatePayload,
  ProfileDesktopOverlay,
  ProfileSetupCommand,
  ProfileSoul,
  ProfilesResponse
} from '@/types/work4you'

import { STARTUP_REQUEST_TIMEOUT_MS, work4youApi } from './client'

export function getProfiles(): Promise<ProfilesResponse> {
  return work4youApi<ProfilesResponse>({
    path: '/api/profiles',
    timeoutMs: STARTUP_REQUEST_TIMEOUT_MS
  })
}

export function createProfile(body: ProfileCreatePayload): Promise<{ name: string; ok: boolean; path: string }> {
  return work4youApi<{ name: string; ok: boolean; path: string }>({
    path: '/api/profiles',
    method: 'POST',
    body
  })
}

export function renameProfile(name: string, newName: string): Promise<{ name: string; ok: boolean; path: string }> {
  return work4youApi<{ name: string; ok: boolean; path: string }>({
    path: `/api/profiles/${encodeURIComponent(name)}`,
    method: 'PATCH',
    body: { new_name: newName }
  })
}

export function deleteProfile(name: string): Promise<{ ok: boolean; path: string }> {
  return work4youApi<{ ok: boolean; path: string }>({
    path: `/api/profiles/${encodeURIComponent(name)}`,
    method: 'DELETE'
  })
}

export function getProfileSoul(name: string): Promise<ProfileSoul> {
  return work4youApi<ProfileSoul>({
    path: `/api/profiles/${encodeURIComponent(name)}/soul`
  })
}

export function updateProfileSoul(name: string, content: string): Promise<{ ok: boolean }> {
  return work4youApi<{ ok: boolean }>({
    path: `/api/profiles/${encodeURIComponent(name)}/soul`,
    method: 'PUT',
    body: { content }
  })
}

/** Set a profile's main model (`model.default` + `model.provider` in ITS
 *  config.yaml) without touching the active profile. */
export function updateProfileModel(
  name: string,
  selection: { model: string; provider: string }
): Promise<{ model: string; ok: boolean; provider: string }> {
  return work4youApi<{ model: string; ok: boolean; provider: string }>({
    path: `/api/profiles/${encodeURIComponent(name)}/model`,
    method: 'PUT',
    body: selection
  })
}

/** Set (or, with an empty string, clear) a profile's role description. A
 *  non-empty value is stored as user-authored, so the auto-describer leaves it. */
export function updateProfileDescription(
  name: string,
  description: string
): Promise<{ description: string; description_auto: boolean; ok: boolean }> {
  return work4youApi<{ description: string; description_auto: boolean; ok: boolean }>({
    path: `/api/profiles/${encodeURIComponent(name)}/description`,
    method: 'PUT',
    body: { description }
  })
}

/** Ask the auxiliary LLM to describe a profile from its persona/skills. A
 *  failed generation comes back as `ok: false` with a reason, not an error. */
export function describeProfileAuto(
  name: string,
  opts: { overwrite?: boolean } = {}
): Promise<{ description: null | string; description_auto: boolean; ok: boolean; reason: null | string }> {
  return work4youApi<{ description: null | string; description_auto: boolean; ok: boolean; reason: null | string }>({
    path: `/api/profiles/${encodeURIComponent(name)}/describe-auto`,
    method: 'POST',
    body: { overwrite: opts.overwrite ?? false },
    timeoutMs: STARTUP_REQUEST_TIMEOUT_MS
  })
}

export function getProfileSetupCommand(name: string): Promise<ProfileSetupCommand> {
  return work4youApi<ProfileSetupCommand>({
    path: `/api/profiles/${encodeURIComponent(name)}/setup-command`
  })
}

/** Export a profile to a shareable .tar.gz on the backend's filesystem.
 *  `extraFiles` stages extra root-level files (desktop.json — the appearance/
 *  interface overlay) into the archive alongside the profile's own artifacts. */
export function exportProfileArchive(
  name: string,
  opts: { extraFiles?: Record<string, string>; output?: string } = {}
): Promise<{ archive: string; ok: boolean }> {
  return work4youApi<{ archive: string; ok: boolean }>({
    path: `/api/profiles/${encodeURIComponent(name)}/export`,
    method: 'POST',
    body: { extra_files: opts.extraFiles ?? {}, output: opts.output ?? '' },
    timeoutMs: STARTUP_REQUEST_TIMEOUT_MS
  })
}

/** Import a profile .tar.gz as a new profile. Returns the bundled desktop
 *  appearance overlay too (when the archive carried one) so the caller can
 *  apply theme/layout without another round-trip. */
export function importProfileArchive(
  archive: string,
  name?: string
): Promise<{ desktop: null | ProfileDesktopOverlay; name: string; ok: boolean; path: string }> {
  return work4youApi<{ desktop: null | ProfileDesktopOverlay; name: string; ok: boolean; path: string }>({
    path: '/api/profiles/import',
    method: 'POST',
    body: { archive, name: name || null },
    timeoutMs: STARTUP_REQUEST_TIMEOUT_MS
  })
}
