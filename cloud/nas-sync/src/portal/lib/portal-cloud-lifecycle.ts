import { cloudAgentChatUrl } from './cloud-agent-chat.ts'

/** One-line product contract: persistent disk, sleepable compute (hybrid B). */
export const CLOUD_PERSISTENCE_TAGLINE =
  'Casa persistente na nuvem: o disco guarda memória, skills e sessões. O compute adormece sem uso e acorda quando volta ao chat.'

export const CLOUD_INSTANCE_PAGE_LEAD =
  'Gerir energia e runtime da instância. Parar ou adormecer não apaga o disco — o histórico mantém-se até eliminar a instância.'

export function cloudAgentStatusHeadline(status: string): string {
  switch (status) {
    case 'online':
      return 'Pronto para conversar'
    case 'starting':
    case 'provisioning':
      return 'A preparar a instância'
    case 'updating':
      return 'A atualizar o runtime'
    case 'stopped':
      return 'Instância parada'
    case 'parked':
      return 'Instância em pausa (plano Free)'
    case 'error':
      return 'Algo correu mal'
    default:
      return 'Estado da Cloud'
  }
}

export function cloudAgentStatusDetail(status: string, canUseCloud: boolean): string {
  switch (status) {
    case 'online':
      return 'O agente pode estar acordado ou em repouso leve — abrir o chat retoma de imediato ou acorda a máquina. Nada no disco se perde.'
    case 'starting':
    case 'provisioning':
      return 'A máquina do plano está a nascer. Esta página atualiza sozinha.'
    case 'updating':
      return 'Nova imagem de runtime — o volume /opt/data e o histórico são preservados.'
    case 'stopped':
      return canUseCloud
        ? 'Paragem manual: o disco mantém-se. Abra o chat para acordar ou use Iniciar na Cloud.'
        : 'No plano Free a instância fica parada; o disco continua guardado.'
    case 'parked':
      return canUseCloud
        ? 'A instância estava em pausa; o plano pago acorda-a de novo (pode demorar um momento).'
        : 'Plano Free: compute em pausa, disco guardado. Upgrade acorda a mesma casa.'
    case 'error':
      return 'Veja detalhes em Instância Cloud ou contacte suporte.'
    default:
      return canUseCloud
        ? 'A Cloud incluída no plano provisiona uma casa persistente — gerencie energia abaixo.'
        : 'Ative um plano pago para a instância Cloud incluída.'
  }
}

/**
 * Card / detail hints under agent status (Portal Cloud page).
 * Returns null when there is nothing useful to say.
 */
export function cloudInstanceLifecycleHint(
  status: string,
  canUseCloud: boolean,
): string | null {
  const s = status.toLowerCase()
  if (canUseCloud && s === 'online') {
    return 'Sem conversas ativas, o compute adormece para poupar custo. O disco e o WORK4YOU_HOME mantêm-se; abrir o chat acorda de novo.'
  }
  if (s === 'parked') {
    return canUseCloud
      ? 'A retomar com o plano pago — disco intacto.'
      : 'Plano Free: instância em pausa. Memória e sessões no volume até voltar a um plano pago.'
  }
  if (!canUseCloud && s === 'stopped') {
    return 'Plano Free: parada. O volume Fly não é apagado.'
  }
  if (canUseCloud && s === 'stopped') {
    return 'Parada manual — dados no disco. Iniciar ou abrir o chat acorda a máquina.'
  }
  return null
}

export function canOpenCloudChat(args: {
  dashboardUrl: string | null | undefined
  status: string
  canUseCloud: boolean
}): { allowed: boolean; chatUrl: string | null; wakeOnOpen: boolean } {
  const chatUrl = cloudAgentChatUrl(args.dashboardUrl)
  if (!chatUrl || !args.canUseCloud) {
    return { allowed: false, chatUrl, wakeOnOpen: false }
  }
  const s = args.status.toLowerCase()
  if (s === 'online') {
    return { allowed: true, chatUrl, wakeOnOpen: false }
  }
  if (s === 'stopped') {
    return { allowed: true, chatUrl, wakeOnOpen: true }
  }
  return { allowed: false, chatUrl, wakeOnOpen: false }
}

export function cloudChatWakeHint(wakeOnOpen: boolean): string | null {
  if (!wakeOnOpen) return null
  return 'A máquina acorda ao abrir o chat (normalmente menos de um minuto). O histórico no disco mantém-se.'
}
