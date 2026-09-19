import { readLocalProfile, readPendingProfile } from './pending-profile'
import {
  composeDisplayName,
  resolveProfileName,
  type PrivyProfileSource,
} from './profile-name'

/** Display label for a Privy user — profile name, then email / OAuth handle / id. */
export function displayName(user: PrivyProfileSource): string {
  const profile = resolveProfileName(user, [
    user.id ? readLocalProfile(user.id) : null,
    readPendingProfile(),
  ])
  const composed = profile
    ? composeDisplayName(profile.firstName, profile.lastName)
    : null
  if (composed) return composed

  const email = user.email?.address
  if (email) return email
  const google = user.google?.email
  if (google) return google
  const github = user.github?.username || user.github?.email
  if (github) return github
  const discord = user.discord?.username
  if (discord) return discord
  return user.id || 'Conta'
}
