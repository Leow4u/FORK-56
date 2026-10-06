import { useI18n, type Locale } from "@/i18n";

/**
 * Account-area strings. Feature-owned so the area ships in the two languages
 * its users read today without churning every dashboard locale file; any
 * other locale reads English.
 */
export interface AccountCopy {
  locale: string;
  title: string;
  sections: {
    overview: string;
    billing: string;
    usage: string;
    profile: string;
  };
  menu: {
    account: string;
    settings: string;
    profile: string;
    upgrade: string;
    docs: string;
    logOut: string;
    planFree: string;
  };
  status: {
    loading: string;
    loggedOutTitle: string;
    loggedOutMessage: string;
    openPortal: string;
    retry: string;
    refresh: string;
    close: string;
  };
  overview: {
    plan: string;
    balance: string;
    autoReload: string;
    autoReloadOn: string;
    autoReloadOff: string;
    managePlan: string;
    viewPlans: string;
    seeUsage: string;
    signedInAs: string;
  };
  plan: {
    title: string;
    free: string;
    perMonth: string;
    renews: (date: string) => string;
    allowanceResets: (date: string) => string;
    freeCaption: string;
    noSubscription: string;
    changesTo: (tier: string, date: string) => string;
    cancels: (date: string) => string;
    undo: string;
    viewPlans: string;
    changePlan: string;
    adjustOnPortal: string;
    hidePlans: string;
    teamManaged: string;
  };
  tiers: {
    title: string;
    current: string;
    scheduled: string;
    choose: string;
    downgrade: string;
    creditsPerMonth: (amount: string) => string;
    confirmDowngradeTitle: (tier: string) => string;
    confirmDowngradeBody: (date: string) => string;
    confirmDowngrade: string;
    previewing: string;
    scheduling: string;
    cancel: string;
    upgradeNote: string;
  };
  credits: {
    title: string;
    description: string;
    custom: string;
    buy: (amount: string) => string;
    charging: string;
    polling: string;
    success: (amount: string) => string;
    ambiguousTitle: string;
    ambiguousMessage: string;
    failedTitle: string;
    declined: string;
    expired: string;
    authRequired: string;
    genericFailure: (reason: string) => string;
    noCard: string;
    notAdmin: string;
    disabled: string;
    invalidAmount: string;
    minimum: (amount: string) => string;
    maximum: (amount: string) => string;
  };
  autoReload: {
    title: string;
    description: (reloadTo: string, threshold: string) => string;
    offDescription: string;
    threshold: string;
    reloadTo: string;
    enable: string;
    disable: string;
    edit: string;
    save: string;
    saving: string;
    saved: string;
    reloadAboveThreshold: string;
    distinctCard: (card: string) => string;
    unavailable: string;
  };
  payment: {
    title: string;
    noCard: string;
    add: string;
    update: string;
  };
  usage: {
    title: string;
    subscriptionCredits: string;
    left: (remaining: string, total: string) => string;
    over: (amount: string) => string;
    resets: (date: string) => string;
    resetsNextCycle: string;
    topupCredits: string;
    neverExpire: string;
    monthlyCap: string;
    capUsed: (spent: string, limit: string) => string;
    defaultCeiling: string;
    remoteSpending: string;
    allowance: string;
    allowanceAvailable: string;
    allowanceUsed: string;
  };
  profile: {
    title: string;
    name: string;
    email: string;
    organization: string;
    noName: string;
    edit: string;
  };
  refusal: {
    stepUpTitle: string;
    stepUpMessage: string;
    authorize: string;
    waiting: string;
    verifyTitle: string;
    verifyMessage: (code: string) => string;
    openVerification: string;
    granted: string;
    notGranted: string;
    noCardTitle: string;
    noCardMessage: string;
    roleTitle: string;
    roleMessage: string;
    remoteOffTitle: string;
    remoteOffMessage: string;
    capTitle: string;
    capMessage: string;
    busyTitle: string;
    busyMessage: string;
    sessionTitle: string;
    sessionMessage: string;
    connectionTitle: string;
    connectionMessage: string;
    genericTitle: string;
  };
}

const en: AccountCopy = {
  locale: "en-US",
  title: "Account",
  sections: {
    overview: "Overview",
    billing: "Billing",
    usage: "Usage",
    profile: "Profile",
  },
  menu: {
    account: "Account",
    settings: "Settings",
    profile: "Profile",
    upgrade: "Upgrade plan",
    docs: "Docs",
    logOut: "Log out",
    planFree: "Free plan",
  },
  status: {
    loading: "Loading your account…",
    loggedOutTitle: "Connect your Work4You account",
    loggedOutMessage:
      "This agent isn't signed in to the Work4You portal, so plan and billing details aren't available here.",
    openPortal: "Open portal",
    retry: "Try again",
    refresh: "Refresh",
    close: "Close",
  },
  overview: {
    plan: "Plan",
    balance: "Balance",
    autoReload: "Auto-reload",
    autoReloadOn: "On",
    autoReloadOff: "Off",
    managePlan: "Manage plan",
    viewPlans: "View plans",
    seeUsage: "See usage",
    signedInAs: "Signed in as",
  },
  plan: {
    title: "Current plan",
    free: "Free",
    perMonth: "/mo",
    renews: (date) => `Renews ${date}`,
    allowanceResets: (date) => `Allowance resets ${date}`,
    freeCaption: "Includes a monthly allowance",
    noSubscription: "No active subscription — paid models use top-up credits.",
    changesTo: (tier, date) => `Changes to ${tier} on ${date}.`,
    cancels: (date) => `Cancels on ${date}.`,
    undo: "Keep current plan",
    viewPlans: "View plans",
    changePlan: "Change plan",
    adjustOnPortal: "Adjust plan on the portal",
    hidePlans: "Hide plans",
    teamManaged: "Plan changes for this account are managed on the portal.",
  },
  tiers: {
    title: "Plans",
    current: "Current plan",
    scheduled: "Scheduled",
    choose: "Choose",
    downgrade: "Downgrade",
    creditsPerMonth: (amount) => `${amount} credits/mo`,
    confirmDowngradeTitle: (tier) => `Switch to ${tier}?`,
    confirmDowngradeBody: (date) =>
      `Nothing is charged now. Your current plan stays active until ${date}, then switches.`,
    confirmDowngrade: "Schedule change",
    previewing: "Checking the change…",
    scheduling: "Scheduling…",
    cancel: "Cancel",
    upgradeNote: "Upgrades open secure checkout on the Work4You portal.",
  },
  credits: {
    title: "Buy credits",
    description: "One-time top-up. Top-up credits never expire.",
    custom: "Custom amount",
    buy: (amount) => `Buy ${amount}`,
    charging: "Charging your card…",
    polling: "Waiting for confirmation…",
    success: (amount) => `${amount} added to your balance.`,
    ambiguousTitle: "Charge still processing",
    ambiguousMessage:
      "The charge may still settle. Check your balance before trying again.",
    failedTitle: "Charge failed",
    declined: "Your card was declined. Try another card on the portal.",
    expired: "Your card has expired. Update it on the portal.",
    authRequired:
      "Your bank requires verification (3DS). Finish it on the portal.",
    genericFailure: (reason) => `The charge didn't go through (${reason}).`,
    noCard: "Add a payment method to buy credits.",
    notAdmin: "Buying credits needs an org admin or owner.",
    disabled:
      "Remote spending is off for this account. An admin can turn it on in the portal.",
    invalidAmount: "Enter a dollar amount with at most 2 decimals.",
    minimum: (amount) => `Minimum is ${amount}.`,
    maximum: (amount) => `Maximum is ${amount}.`,
  },
  autoReload: {
    title: "Auto-reload",
    description: (reloadTo, threshold) =>
      `Adds ${reloadTo} when your balance falls below ${threshold}.`,
    offDescription:
      "Keep your balance topped up automatically when it runs low.",
    threshold: "When balance falls below",
    reloadTo: "Reload amount",
    enable: "Turn on",
    disable: "Turn off",
    edit: "Edit",
    save: "Save",
    saving: "Saving…",
    saved: "Auto-reload updated.",
    reloadAboveThreshold: "The reload amount must be greater than the threshold.",
    distinctCard: (card) =>
      `Auto-reload charges ${card}. Reconcile it on the portal.`,
    unavailable: "Auto-reload is managed on the portal.",
  },
  payment: {
    title: "Payment method",
    noCard: "No card on file",
    add: "Add card",
    update: "Update",
  },
  usage: {
    title: "Usage",
    subscriptionCredits: "Subscription credits",
    left: (remaining, total) => `${remaining} of ${total} left`,
    over: (amount) => `${amount} over`,
    resets: (date) => `Resets ${date}`,
    resetsNextCycle: "Resets next cycle",
    topupCredits: "Top-up credits",
    neverExpire: "Never expire",
    monthlyCap: "Monthly spend cap",
    capUsed: (spent, limit) => `${spent} of ${limit} used`,
    defaultCeiling: "Default ceiling",
    remoteSpending: "Monthly remote spending",
    allowance: "This month's allowance",
    allowanceAvailable: "Available",
    allowanceUsed: "Used for this cycle",
  },
  profile: {
    title: "Profile",
    name: "Name",
    email: "Email",
    organization: "Organization",
    noName: "Not set",
    edit: "Edit profile on the portal",
  },
  refusal: {
    stepUpTitle: "Approval needed",
    stepUpMessage:
      "Allow this agent to manage billing for your account, then try again.",
    authorize: "Allow",
    waiting: "Starting approval…",
    verifyTitle: "Confirm in your browser",
    verifyMessage: (code) =>
      code
        ? `Open the approval page and confirm the code ${code}.`
        : "Open the approval page to confirm.",
    openVerification: "Open approval page",
    granted: "Billing approved. You can continue.",
    notGranted: "Approval finished without allowing billing.",
    noCardTitle: "No payment method",
    noCardMessage: "Add a card on the portal to buy credits or use auto-reload.",
    roleTitle: "Admin role required",
    roleMessage: "Ask an org admin, or manage billing on the portal.",
    remoteOffTitle: "Remote spending is off",
    remoteOffMessage:
      "A billing admin can turn it on from the portal.",
    capTitle: "Monthly spend cap reached",
    capMessage: "Raise the cap on the portal to keep spending.",
    busyTitle: "Too many requests",
    busyMessage: "Try again in a minute. This isn't a payment failure.",
    sessionTitle: "Session expired",
    sessionMessage: "Sign in to the agent again to manage billing.",
    connectionTitle: "Couldn't reach billing",
    connectionMessage: "The agent couldn't reach the billing service.",
    genericTitle: "Billing request failed",
  },
};

const pt: AccountCopy = {
  locale: "pt-BR",
  title: "Conta",
  sections: {
    overview: "Visão geral",
    billing: "Billing",
    usage: "Uso",
    profile: "Perfil",
  },
  menu: {
    account: "Conta",
    settings: "Configurações",
    profile: "Perfil",
    upgrade: "Fazer upgrade",
    docs: "Documentação",
    logOut: "Sair",
    planFree: "Plano Free",
  },
  status: {
    loading: "Carregando sua conta…",
    loggedOutTitle: "Conecte sua conta Work4You",
    loggedOutMessage:
      "Este agente não está conectado ao portal Work4You, então os dados de plano e billing não estão disponíveis aqui.",
    openPortal: "Abrir portal",
    retry: "Tentar novamente",
    refresh: "Atualizar",
    close: "Fechar",
  },
  overview: {
    plan: "Plano",
    balance: "Saldo",
    autoReload: "Recarga automática",
    autoReloadOn: "Ligada",
    autoReloadOff: "Desligada",
    managePlan: "Gerenciar plano",
    viewPlans: "Ver planos",
    seeUsage: "Ver uso",
    signedInAs: "Conectado como",
  },
  plan: {
    title: "Plano atual",
    free: "Free",
    perMonth: "/mês",
    renews: (date) => `Renova em ${date}`,
    allowanceResets: (date) => `Allowance reinicia em ${date}`,
    freeCaption: "Inclui uma franquia mensal",
    noSubscription:
      "Sem assinatura ativa — modelos pagos usam créditos avulsos.",
    changesTo: (tier, date) => `Muda para ${tier} em ${date}.`,
    cancels: (date) => `Cancela em ${date}.`,
    undo: "Manter plano atual",
    viewPlans: "Ver planos",
    changePlan: "Mudar plano",
    adjustOnPortal: "Ajustar plano no portal",
    hidePlans: "Ocultar planos",
    teamManaged: "As mudanças de plano desta conta são feitas no portal.",
  },
  tiers: {
    title: "Planos",
    current: "Plano atual",
    scheduled: "Agendado",
    choose: "Escolher",
    downgrade: "Fazer downgrade",
    creditsPerMonth: (amount) => `${amount} em créditos/mês`,
    confirmDowngradeTitle: (tier) => `Mudar para ${tier}?`,
    confirmDowngradeBody: (date) =>
      `Nada é cobrado agora. Seu plano atual continua até ${date} e depois muda.`,
    confirmDowngrade: "Agendar mudança",
    previewing: "Verificando a mudança…",
    scheduling: "Agendando…",
    cancel: "Cancelar",
    upgradeNote: "O upgrade abre o checkout seguro no portal Work4You.",
  },
  credits: {
    title: "Comprar créditos",
    description: "Recarga avulsa. Créditos avulsos não expiram.",
    custom: "Outro valor",
    buy: (amount) => `Comprar ${amount}`,
    charging: "Cobrando seu cartão…",
    polling: "Aguardando confirmação…",
    success: (amount) => `${amount} adicionados ao seu saldo.`,
    ambiguousTitle: "Cobrança ainda em processamento",
    ambiguousMessage:
      "A cobrança ainda pode ser confirmada. Confira o saldo antes de tentar de novo.",
    failedTitle: "A cobrança falhou",
    declined: "Seu cartão foi recusado. Tente outro cartão no portal.",
    expired: "Seu cartão expirou. Atualize-o no portal.",
    authRequired:
      "Seu banco exige verificação (3DS). Conclua no portal.",
    genericFailure: (reason) => `A cobrança não foi concluída (${reason}).`,
    noCard: "Adicione um método de pagamento para comprar créditos.",
    notAdmin: "Comprar créditos exige um admin ou dono da organização.",
    disabled:
      "Os gastos remotos estão desligados nesta conta. Um admin pode ligá-los no portal.",
    invalidAmount: "Informe um valor em dólares com no máximo 2 casas decimais.",
    minimum: (amount) => `O mínimo é ${amount}.`,
    maximum: (amount) => `O máximo é ${amount}.`,
  },
  autoReload: {
    title: "Recarga automática",
    description: (reloadTo, threshold) =>
      `Adiciona ${reloadTo} quando o saldo fica abaixo de ${threshold}.`,
    offDescription:
      "Mantenha o saldo recarregado automaticamente quando ele estiver baixo.",
    threshold: "Quando o saldo ficar abaixo de",
    reloadTo: "Valor da recarga",
    enable: "Ligar",
    disable: "Desligar",
    edit: "Editar",
    save: "Salvar",
    saving: "Salvando…",
    saved: "Recarga automática atualizada.",
    reloadAboveThreshold: "O valor da recarga deve ser maior que o limite.",
    distinctCard: (card) =>
      `A recarga automática cobra ${card}. Ajuste no portal.`,
    unavailable: "A recarga automática é gerenciada no portal.",
  },
  payment: {
    title: "Método de pagamento",
    noCard: "Nenhum cartão cadastrado",
    add: "Adicionar cartão",
    update: "Atualizar",
  },
  usage: {
    title: "Uso",
    subscriptionCredits: "Créditos da assinatura",
    left: (remaining, total) => `${remaining} de ${total} restantes`,
    over: (amount) => `${amount} acima`,
    resets: (date) => `Reinicia em ${date}`,
    resetsNextCycle: "Reinicia no próximo ciclo",
    topupCredits: "Créditos avulsos",
    neverExpire: "Não expiram",
    monthlyCap: "Limite mensal de gastos",
    capUsed: (spent, limit) => `${spent} de ${limit} usados`,
    defaultCeiling: "Limite padrão",
    remoteSpending: "Gastos remotos do mês",
    allowance: "Allowance deste mês",
    allowanceAvailable: "Disponível",
    allowanceUsed: "Usada neste ciclo",
  },
  profile: {
    title: "Perfil",
    name: "Nome",
    email: "E-mail",
    organization: "Organização",
    noName: "Não definido",
    edit: "Editar perfil no portal",
  },
  refusal: {
    stepUpTitle: "Autorização necessária",
    stepUpMessage:
      "Permita que este agente gerencie o billing da sua conta e tente de novo.",
    authorize: "Permitir",
    waiting: "Iniciando autorização…",
    verifyTitle: "Confirme no navegador",
    verifyMessage: (code) =>
      code
        ? `Abra a página de autorização e confirme o código ${code}.`
        : "Abra a página de autorização para confirmar.",
    openVerification: "Abrir página de autorização",
    granted: "Billing autorizado. Você já pode continuar.",
    notGranted: "A autorização terminou sem permitir o billing.",
    noCardTitle: "Nenhum método de pagamento",
    noCardMessage:
      "Adicione um cartão no portal para comprar créditos ou usar a recarga automática.",
    roleTitle: "Exige perfil de admin",
    roleMessage: "Peça a um admin da organização ou gerencie no portal.",
    remoteOffTitle: "Gastos remotos desligados",
    remoteOffMessage: "Um admin de billing pode ligá-los no portal.",
    capTitle: "Limite mensal atingido",
    capMessage: "Aumente o limite no portal para continuar.",
    busyTitle: "Muitas solicitações",
    busyMessage: "Tente de novo em um minuto. Isto não é falha de pagamento.",
    sessionTitle: "Sessão expirada",
    sessionMessage: "Entre de novo no agente para gerenciar o billing.",
    connectionTitle: "Não foi possível acessar o billing",
    connectionMessage: "O agente não conseguiu falar com o serviço de billing.",
    genericTitle: "A solicitação de billing falhou",
  },
};

const ACCOUNT_COPY: Partial<Record<Locale, AccountCopy>> = { en, pt };

export function accountCopyFor(locale: Locale): AccountCopy {
  return ACCOUNT_COPY[locale] ?? en;
}

export function useAccountCopy(): AccountCopy {
  return accountCopyFor(useI18n().locale);
}
