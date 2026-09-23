/**
 * Node test loader so cloud-entitlement.ts can keep Next-style extensionless
 * imports (`./tiers`) while the test calls the real module.
 */
import { register } from 'node:module'

register('./ts-resolve-hook.mjs', import.meta.url)
