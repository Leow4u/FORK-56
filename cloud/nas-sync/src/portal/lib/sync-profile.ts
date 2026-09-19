import { persistAccountProfile } from './account-profile'
import {
  clearPendingProfile,
  readPendingProfile,
  saveLocalProfile,
} from './pending-profile'
import {
  profileFromCustomMetadata,
  resolveProfileName,
  type PrivyProfileSource,
  type ProfileName,
} from './profile-name'

export async function syncProfileAfterAuth(
  user: PrivyProfileSource | null | undefined,
  getAccessToken: () => Promise<string | null>,
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileName | null> {
  if (!user?.id) return null

  const pending = readPendingProfile()
  const resolved = resolveProfileName(user, [pending])
  if (!resolved) return null

  saveLocalProfile(user.id, resolved)
  if (pending) clearPendingProfile()

  const alreadyOnPrivy = Boolean(profileFromCustomMetadata(user))
  if (alreadyOnPrivy && !pending) return resolved

  const token = await getAccessToken()
  if (!token) return resolved

  await persistAccountProfile(token, resolved, fetchImpl)
  return resolved
}
