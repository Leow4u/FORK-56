import { addDays, pad2, WEEKDAY_LONG } from './dates'
import type { GlyphName } from './glyphs'

/**
 * Transforma um pedido em português numa "ordem de serviço" (seção logo abaixo do hero).
 * Roda só no navegador, com regras simples: não chama modelo nem envia nada.
 */

export interface TaskTag {
  glyph: GlyphName
  label: string
}

export interface TaskTrigger {
  /** Expressão cron quando há agenda; senão "evento", "uma vez" ou "agora". */
  code: string
  human: string
}

export type TaskStatus = 'running' | 'scheduled' | 'waiting'

export interface TaskOrder {
  delivery: TaskTag
  nextRuns: Date[]
  number: string
  request: string
  skill: string
  sources: TaskTag[]
  status: TaskStatus
  steps: string[]
  trigger: TaskTrigger
}

type Frequency =
  | { dom: number; kind: 'monthly' }
  | { dow: number; kind: 'once-dow' | 'weekly' }
  | { kind: 'daily' | 'event' | 'now' | 'today' | 'tomorrow' | 'weekdays' }
  | { kind: 'interval'; n: number; unit: 'h' | 'min' }

type Rule = readonly [RegExp, string, GlyphName]

const DOW: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 }
const EVERY_WEEKDAY = ['todo domingo', 'toda segunda', 'toda terça', 'toda quarta', 'toda quinta', 'toda sexta', 'todo sábado']

const EVENTS: readonly Rule[] = [
  [/(nota|\bnf).*(e-?mail|gmail)|(e-?mail|gmail).*(nota|\bnf)/, 'e-mail com nota fiscal', 'gmail'],
  [/e-?mail|gmail|caixa de entrada/, 'novo e-mail no Gmail', 'gmail'],
  [/formulario|lead|cadastro/, 'novo lead no formulário', 'hubspot'],
  [/whats|zap|mensagem|cliente (mandar|perguntar|chamar|escrever)/, 'nova mensagem no WhatsApp', 'whatsapp'],
  [/pix|pagamento|pagar|boleto/, 'pagamento confirmado', 'doc'],
  [/pedido|venda|compra/, 'novo pedido na loja', 'sheets'],
  [/reuniao|agenda|evento/, 'novo evento na agenda', 'gcal'],
  [/comentario|direct|instagram/, 'nova interação no Instagram', 'instagram'],
]

const CHANNELS: readonly Rule[] = [
  [/\bwhats(app)?\b|\bzap\b/, 'WhatsApp', 'whatsapp'],
  [/\btelegram\b/, 'Telegram', 'telegram'],
  [/\bslack\b/, 'Slack', 'slack'],
  [/\bdiscord\b/, 'Discord', 'discord'],
  [/\bteams\b/, 'Microsoft Teams', 'chat'],
  [/\be-?mail\b|\bgmail\b/, 'E-mail', 'gmail'],
  [/\bsms\b/, 'SMS', 'chat'],
  [/\binstagram\b|\binsta\b/, 'Instagram', 'instagram'],
]

const SOURCES: readonly Rule[] = [
  [/planilha|sheets|excel|xlsx|\bmetas?\b|vendedor/, 'Google Sheets / Excel', 'sheets'],
  [/gmail|e-?mail|caixa de entrada/, 'Gmail', 'gmail'],
  [/agenda|calendario|reuniao|reunioes|compromisso/, 'Google Calendar', 'gcal'],
  [/drive|pasta|contrato|documento/, 'Google Drive', 'gdrive'],
  [/notion/, 'Notion', 'notion'],
  [/hubspot|\bcrm\b|funil|\blead/, 'HubSpot', 'hubspot'],
  [/instagram|\binsta\b|stories|reels|\bpost\b/, 'Instagram', 'instagram'],
  [/nota fiscal|\bnf\b|\bnfe\b|\bpdf\b|boleto|comprovante/, 'PDFs e notas fiscais', 'doc'],
  [/\bsite\b|\bweb\b|internet|noticia|concorrent|preco|dolar|cotacao/, 'Web (busca e navegador)', 'web'],
  [/conversa|mensagens|perguntar|clientes do whats/, 'Conversas do WhatsApp', 'whatsapp'],
  [/boleto|vencid|contas a receber|financeiro|fechamento|faturamento|\bcaixa\b/, 'Planilha do financeiro', 'sheets'],
  [/pedido|estoque|vendas?\b/, 'Pedidos e vendas', 'sheets'],
]

const ACTIONS: readonly (readonly [string, RegExp | null, readonly string[]])[] = [
  ['lembrete', /\bme lembr|\blembrete|\blembra(r)? de\b/, ['guardar o lembrete', 'esperar o horário', 'avisar você']],
  [
    'campanha',
    /campanha|lancamento do produto|\bmarketing\b/,
    ['delegar ao time de IA', 'pesquisar, criar e planejar em paralelo', 'pedir sua aprovação'],
  ],
  [
    'resumo',
    /resum|relatorio|report|balanco|fechamento|fecha(r)? o caixa|agenda do dia|\bpauta\b/,
    ['coletar os dados', 'consolidar os números', 'escrever o resumo'],
  ],
  [
    'atendimento',
    /respond|atend|tira(r)? duvida|duvidas|suporte|\bsac\b/,
    ['ler a mensagem', 'consultar pedido e histórico', 'responder na conversa'],
  ],
  ['cobranca', /cobr|vencid|inadimpl|atrasad/, ['listar vencidos', 'enviar a 2ª via', 'registrar quem pagou']],
  ['publicacao', /public|postar|\bposta\b|\bpost\b|stories|reels/, ['criar texto e imagem', 'pedir sua aprovação', 'publicar']],
  [
    'agendamento',
    /\bagendar?\b(?! do)|\bagende\b|\bmarc(a|ar|ue)\b|reuniao|reunioes/,
    ['checar as agendas', 'propor horários', 'enviar o convite'],
  ],
  [
    'monitoramento',
    /monitor|acompanh|vigi|concorrent|preco|dolar|cotacao|caiu|fora do ar/,
    ['buscar na web', 'comparar com a última leitura', 'avisar se mudar'],
  ],
  ['pesquisa', /pesquis|levant|\bbusca|procur/, ['buscar fontes', 'ler e comparar', 'resumir o que importa']],
  [
    'lancamento',
    /\blanc(a|ar|e)\b|registr|preench|cadastr|atualiz|organiz|\bbaixa\b/,
    ['extrair os dados', 'atualizar os registros', 'conferir os totais'],
  ],
  ['alerta', /lembr|avis|alert|notific|quem nao|se (passar|cair|subir|mudar)/, ['verificar a condição', 'montar a lista', 'avisar']],
  ['traducao', /traduz/, ['ler o documento', 'traduzir', 'revisar os termos']],
  ['redacao', /escrev|redig|proposta|contrato/, ['entender o contexto', 'escrever', 'revisar e entregar']],
]
const FALLBACK_ACTION = ['tarefa', null, ['entender o pedido', 'executar com suas ferramentas', 'confirmar com você']] as const

const NOISE = new Set(
  (
    'a o as os um uma uns umas de da do das dos e em no na nos nas com por pelo pela para pra pro que se me mim eu ' +
    'meu minha meus minhas seu sua seus suas toda todo todas todos cada dia dias semana semanas mes meses hora horas ' +
    'agora hoje amanha quando sempre assim vez ja quem nao sim domingo segunda terca quarta quinta sexta sabado feira ' +
    'feiras uteis util manha tarde noite cedo ate sobre depois antes whatsapp whats zap telegram slack discord teams ' +
    'email gmail sms instagram insta manda mande mandar envia envie enviar avisa avise avisar faz faca fazer cria crie ' +
    'criar monta montar responde responda cobra cobre publica publique lanca lance marca marque monitora monitore ' +
    'pesquisa pesquise bateu bater chegar chegou chega receber recebe recebeu mudar mudou muda passar cair subir fica ' +
    'ficar deixa deixar vai ver isso isto esse essa este esta tambem mais menos muito muita mail minuto minutos confere ' +
    'conferir verifica verificar checa checar fechar fecha lembra lembrar novo nova'
  ).split(' '),
)

function normalize(text: string): string {
  return ` ${text} `
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[“”"'`]/g, ' ')
    .replace(/\s+/g, ' ')
}

function hash(text: string): number {
  let h = 2166136261

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  return Math.abs(h)
}

function parseFrequency(t: string): Frequency {
  if (
    /\b(quando|sempre que|assim que|toda vez que|cada vez que)\b/.test(t) ||
    /\b(que|quem) (perguntar|perguntarem|mandar|mandarem|chamar|chamarem|escrever|escreverem|pedir|pedirem|comprar|comprarem)\b/.test(t)
  ) {
    return { kind: 'event' }
  }

  if (/\b(dias? uteis|dia util|de segunda a sexta|segunda a sexta)\b/.test(t)) {
    return { kind: 'weekdays' }
  }

  const weekly = t.match(
    /\b(todas as|todos os|toda|todo|cada|nas|aos|as|na|no)\s(segunda|terca|quarta|quinta|sexta|sabado|domingo)(s?)(?:-feira)?(s?)\b/,
  )

  if (weekly) {
    const recurring = /^(todas as|todos os|toda|todo|cada|nas|aos|as)$/.test(weekly[1]) || weekly[3] === 's' || weekly[4] === 's'

    return { kind: recurring ? 'weekly' : 'once-dow', dow: DOW[weekly[2]] }
  }

  const monthly = t.match(/\bdia (\d{1,2}) (?:de cada|de todo|todo) mes\b/) ?? t.match(/\btodo dia (\d{1,2})\b/)

  if (monthly) {
    return { kind: 'monthly', dom: Math.max(1, Math.min(28, Number(monthly[1]))) }
  }

  if (/\b(todo mes|todos os meses|mensal|mensalmente|todo inicio de mes|comeco de cada mes)\b/.test(t)) {
    return { kind: 'monthly', dom: 1 }
  }

  if (/\b(toda semana|todas as semanas|semanal|semanalmente)\b/.test(t)) {
    return { kind: 'weekly', dow: 1 }
  }

  if (/\b(todo dia|todos os dias|diariamente|toda manha|toda noite|toda tarde|cada dia|diario)\b/.test(t)) {
    return { kind: 'daily' }
  }

  if (/\b(de hora em hora|toda hora|a cada hora)\b/.test(t)) {
    return { kind: 'interval', n: 1, unit: 'h' }
  }

  const interval = t.match(/\ba cada (\d{1,3}) ?(min|minutos|h|horas)\b/)

  if (interval) {
    return { kind: 'interval', n: Math.max(1, Number(interval[1])), unit: interval[2].startsWith('min') ? 'min' : 'h' }
  }

  return { kind: /\bamanha\b/.test(t) ? 'tomorrow' : 'now' }
}

function parseTime(t: string): [number, number] | null {
  let time: [number, number] | null = null
  let match = t.match(/\b(\d{1,2}) ?(?:h|:) ?(\d{2})\b/)

  if (match) {
    time = [Number(match[1]), Number(match[2])]
  } else if ((match = t.match(/\b(\d{1,2}) ?(?:h|hs|horas?)\b/))) {
    time = [Number(match[1]), 0]
  } else if ((match = t.match(/\bas (\d{1,2})\b/))) {
    time = [Number(match[1]), 0]
  }

  if (time && time[0] < 12 && /\b(da|de|a) (noite|tarde)\b/.test(t)) {
    time[0] += 12
  }

  if (!time) {
    if (/meio[- ]dia/.test(t)) {
      time = [12, 0]
    } else if (/meia[- ]noite/.test(t)) {
      time = [0, 0]
    } else if (/\b(de manha|pela manha|toda manha|cedo)\b/.test(t)) {
      time = [8, 0]
    } else if (/\b(a tarde|de tarde|toda tarde)\b/.test(t)) {
      time = [14, 0]
    } else if (/\b(a noite|de noite|toda noite)\b/.test(t)) {
      time = [20, 0]
    }
  }

  return time ? [Math.min(23, time[0]), Math.min(59, time[1])] : null
}

function nextRuns(freq: Frequency, time: [number, number] | null, now: Date): Date[] {
  const [hours, minutes] = time ?? [9, 0]
  const at = (day: Date) => {
    const run = new Date(day)

    run.setHours(hours, minutes, 0, 0)

    return run
  }

  switch (freq.kind) {
    case 'daily': {
      const first = at(now) <= now ? addDays(at(now), 1) : at(now)

      return [0, 1, 2].map((i) => addDays(first, i))
    }

    case 'weekdays': {
      const runs: Date[] = []
      let day = at(now) <= now ? addDays(at(now), 1) : at(now)

      while (runs.length < 3) {
        if (day.getDay() % 6 !== 0) {
          runs.push(new Date(day))
        }

        day = addDays(day, 1)
      }

      return runs
    }

    case 'weekly':
    case 'once-dow': {
      let first = addDays(at(now), (freq.dow - now.getDay() + 7) % 7)

      if (first <= now) {
        first = addDays(first, 7)
      }

      return (freq.kind === 'weekly' ? [0, 1, 2] : [0]).map((i) => addDays(first, 7 * i))
    }

    case 'monthly': {
      let first = new Date(now.getFullYear(), now.getMonth(), freq.dom, hours, minutes)

      if (first <= now) {
        first = new Date(now.getFullYear(), now.getMonth() + 1, freq.dom, hours, minutes)
      }

      return [0, 1, 2].map((i) => new Date(first.getFullYear(), first.getMonth() + i, freq.dom, hours, minutes))
    }

    case 'interval': {
      const step = (freq.unit === 'min' ? 60 : 3600) * 1000 * freq.n
      let first = Math.ceil(now.getTime() / step) * step

      if (first <= now.getTime()) {
        first += step
      }

      return [0, 1, 2].map((i) => new Date(first + i * step))
    }

    case 'tomorrow':
      return [at(addDays(now, 1))]

    case 'today':
      return [at(now) <= now ? addDays(at(now), 1) : at(now)]

    default:
      return []
  }
}

function describeTrigger(freq: Frequency, time: [number, number] | null, t: string): TaskTrigger & { event?: Rule } {
  const [hours, minutes] = time ?? [9, 0]
  const clock = `${pad2(hours)}:${pad2(minutes)}`

  switch (freq.kind) {
    case 'daily':
      return { code: `${minutes} ${hours} * * *`, human: `todo dia, ${clock}` }

    case 'weekdays':
      return { code: `${minutes} ${hours} * * 1-5`, human: `dias úteis, ${clock}` }

    case 'weekly':
      return { code: `${minutes} ${hours} * * ${freq.dow}`, human: `${EVERY_WEEKDAY[freq.dow]}, ${clock}` }

    case 'once-dow':
      return { code: 'uma vez', human: `${WEEKDAY_LONG[freq.dow]}, ${clock}` }

    case 'monthly':
      return { code: `${minutes} ${hours} ${freq.dom} * *`, human: `todo dia ${freq.dom}, ${clock}` }

    case 'interval':
      if (freq.unit === 'min') {
        return { code: `*/${freq.n} * * * *`, human: `a cada ${freq.n} min` }
      }

      return {
        code: freq.n === 1 ? '0 * * * *' : `0 */${freq.n} * * *`,
        human: freq.n === 1 ? 'de hora em hora' : `a cada ${freq.n} h`,
      }

    case 'tomorrow':
      return { code: 'uma vez', human: `amanhã, ${clock}` }

    case 'today':
      return { code: 'uma vez', human: `hoje, ${clock}` }

    case 'event': {
      const event = EVENTS.find(([pattern]) => pattern.test(t))

      return { code: 'evento', human: `quando chegar: ${event ? event[1] : 'novo evento nos seus canais'}`, event }
    }

    default:
      return { code: 'agora', human: 'agora, uma vez' }
  }
}

const STORES: ReadonlySet<GlyphName> = new Set(['gdrive', 'notion', 'sheets'])

function pickDelivery(t: string, action: string, eventGlyph: GlyphName | null): TaskTag {
  // Canais na ordem em que aparecem; a entrega é o último que não seja a origem do evento.
  const mentioned = CHANNELS.map(([pattern, label, glyph]) => {
    const match = t.match(pattern)

    return match?.index === undefined ? null : { at: match.index, glyph, label }
  })
    .filter((channel) => channel !== null)
    .sort((a, b) => a.at - b.at)
    .filter((channel) => channel.glyph !== eventGlyph)
  const last = mentioned.at(-1)

  if (last) {
    return { glyph: last.glyph, label: last.label }
  }

  if (action === 'atendimento' && eventGlyph === 'whatsapp') {
    return { glyph: 'whatsapp', label: 'WhatsApp, na própria conversa' }
  }

  // Um lançamento é entregue onde os registros vivem: o arquivo citado no pedido.
  const store = SOURCES.find(([pattern, , glyph]) => STORES.has(glyph) && pattern.test(t))
  const fallback: Record<string, TaskTag> = {
    campanha: { glyph: 'notion', label: 'Notion, plano para sua aprovação' },
    cobranca: { glyph: 'whatsapp', label: 'WhatsApp, lembrete com 2ª via' },
    lancamento: { glyph: store?.[2] ?? 'sheets', label: 'Registros atualizados + aviso no app' },
  }

  return fallback[action] ?? { glyph: 'chat', label: 'Chat do Work4You (desktop e celular)' }
}

function pickSources(t: string, action: string, delivery: TaskTag): TaskTag[] {
  const sources: TaskTag[] = []

  for (const [pattern, label, glyph] of SOURCES) {
    if (pattern.test(t) && !sources.some((source) => source.label === label)) {
      sources.push({ glyph, label })
    }
  }

  const relevant = sources
    .filter((source) => {
      if (source.label === 'Gmail' && delivery.label === 'E-mail') {
        return /caixa de entrada|recebid|cheg|inbox/.test(t)
      }

      return !(source.label === 'Instagram' && delivery.label === 'Instagram')
    })
    .slice(0, 3)

  if (relevant.length > 0) {
    return relevant
  }

  if (action === 'publicacao') {
    return [{ glyph: 'memory', label: 'Memória da marca + banco de imagens' }]
  }

  return [{ glyph: 'web', label: action === 'campanha' ? 'Web + memória da marca' : 'Memória + web' }]
}

function skillSlug(t: string, action: string, pattern: RegExp | null, freq: Frequency): string {
  const words = t.split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !/^\d/.test(word) && !NOISE.has(word))
  const object =
    words.find((word) => !pattern?.test(` ${word} `)) ?? words.find((word) => word !== action) ?? ''
  const suffix: Partial<Record<Frequency['kind'], string>> = {
    daily: 'diario',
    monthly: 'mensal',
    weekdays: 'dias-uteis',
    weekly: 'semanal',
  }

  return [action, object, suffix[freq.kind] ?? '']
    .filter(Boolean)
    .join('-')
    .slice(0, 40)
    .replace(/-+$/, '')
}

export function compileTask(raw: string, now: Date): TaskOrder {
  const request = raw.replace(/\s+/g, ' ').trim().slice(0, 180)
  const t = normalize(request)
  let freq = parseFrequency(t)
  let time = freq.kind === 'interval' || freq.kind === 'event' || freq.kind === 'now' ? null : parseTime(t)

  if (freq.kind === 'now' && parseTime(t)) {
    freq = { kind: 'today' }
    time = parseTime(t)
  }

  const { event, ...trigger } = describeTrigger(freq, time, t)
  const [action, pattern, actionSteps] = ACTIONS.find(([, rule]) => rule?.test(t)) ?? FALLBACK_ACTION
  const steps = [...actionSteps]

  if (/\b(time|equipe|bots?|colegas)\b/.test(t) && steps[0] !== 'delegar ao time de IA') {
    steps.unshift('delegar ao time de IA')
  }

  const delivery = pickDelivery(t, action, event ? event[2] : null)
  const status: TaskStatus = freq.kind === 'event' ? 'waiting' : freq.kind === 'now' ? 'running' : 'scheduled'

  return {
    delivery,
    nextRuns: nextRuns(freq, time, now),
    number: String(1000 + (hash(request) % 9000)),
    request,
    skill: skillSlug(t, action, pattern, freq),
    sources: pickSources(t, action, delivery),
    status,
    steps,
    trigger,
  }
}
