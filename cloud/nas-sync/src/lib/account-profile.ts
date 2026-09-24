import { PrivyClient } from '@privy-io/server-auth'
import {
  type AccountIdentity,
  type AccountProfileName,
  accountIdentityFromPrivyUser,
  parseAccountProfileBody,
} from './account-profile-parse'

export type { AccountIdentity, AccountProfileName }
export { accountIdentityFromPrivyUser, parseAccountProfileBody }

function privyClient() {
  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('PRIVY_APP_ID / PRIVY_APP_SECRET missing')
  }
  return new PrivyClient(appId, appSecret)
}

function asMetadataRecord(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object') return {}
  const next: Record<string, string | number | boolean> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      next[key] = item
    }
  }
  return next
}

export async function readPrivyAccountIdentity(privyDid: string): Promise<AccountIdentity> {
  const client = privyClient()
  const existing = await client.getUser(privyDid)
  return accountIdentityFromPrivyUser(existing)
}

export async function savePrivyAccountProfile(
  privyDid: string,
  profile: AccountProfileName,
): Promise<AccountProfileName> {
  const client = privyClient()
  const existing = await client.getUser(privyDid)
  const metadata = asMetadataRecord(existing.customMetadata)
  metadata.firstName = profile.firstName
  metadata.lastName = profile.lastName
  await client.setCustomMetadata(privyDid, metadata)
  return profile
}
