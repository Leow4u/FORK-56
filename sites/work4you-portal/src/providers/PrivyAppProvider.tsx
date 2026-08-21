import { PrivyProvider } from '@privy-io/react-auth'
import type { ReactNode } from 'react'

/** Public Privy App ID for work4you-portal (dashboard). Override with VITE_PRIVY_APP_ID. */
export const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined)?.trim() ||
  'cmt2aamzt00el0ckz9lrlqdkt'

interface PrivyAppProviderProps {
  children: ReactNode
}

export function PrivyAppProvider({ children }: PrivyAppProviderProps) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'github', 'discord', 'passkey'],
        appearance: {
          theme: '#F5F4EE',
          accentColor: '#4D5943',
          logo: '/brand/work4you-logo.png',
          landingHeader: 'Entrar na Work4You',
          loginMessage: 'Um agente de IA que aprende sua empresa.',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'off' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  )
}
