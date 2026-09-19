import { parseProfileName, type ProfileName } from './profile-name'

export const ACCOUNT_PROFILE_PATH = '/api/account'

export function accountProfilePayload(profile: ProfileName): {
  firstName: string
  lastName: string
} {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
  }
}

export async function persistAccountProfile(
  token: string,
  profile: ProfileName,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const parsed = parseProfileName(profile)
  if (!parsed || !token) return false
  try {
    const res = await fetchImpl(ACCOUNT_PROFILE_PATH, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(accountProfilePayload(parsed)),
    })
    return res.ok
  } catch {
    return false
  }
}
