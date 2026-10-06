import { type BillingApi, createBillingApi } from '@work4you/shared/billing-client'
import { createContext, useContext, useMemo } from 'react'

import { useGatewayRequest } from '@/app/gateway/hooks/use-gateway-request'

export {
  type BillingApi,
  type BillingChargeResult,
  type BillingErrorKind,
  type BillingRefusal,
  type BillingRequestGateway,
  type BillingResult,
  createBillingApi,
  type UpdateAutoReloadInput
} from '@work4you/shared/billing-client'

// An override for the gateway-backed api — DEV fixtures provide a simulated
// implementation here so every consumer (hooks, rows) transparently runs against it
// with no fixture awareness of their own. `null` (the default) = the real gateway api.
const BillingApiContext = createContext<BillingApi | null>(null)

export const BillingApiProvider = BillingApiContext.Provider

export function useBillingApi(): BillingApi {
  const override = useContext(BillingApiContext)
  const { requestGateway } = useGatewayRequest()
  const real = useMemo(() => createBillingApi(requestGateway), [requestGateway])

  return override ?? real
}
