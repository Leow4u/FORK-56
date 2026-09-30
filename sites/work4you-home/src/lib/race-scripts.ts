import { addDays, clock, dayMonth, WEEKDAY_LONG, WEEKDAY_SHORT } from './dates'
import type { GlyphName } from './glyphs'

/**
 * Roteiros da demonstração do hero: o mesmo pedido vai para um chatbot comum
 * (que responde em texto) e para o Work4You (que executa). Dados fictícios.
 * Para editar uma demonstração, mude só este arquivo.
 */

export type RaceKey = 'boletos' | 'campanha' | 'clientes' | 'vendas'

export interface RaceStep {
  detail: string
  glyph: GlyphName
  /** incoming: mensagem que chega (não conta como tarefa). parallel: subagentes rodando juntos. */
  kind?: 'incoming' | 'parallel'
  /** Tempo real do passo, em segundos. */
  seconds: number
  tool: string
}

export type RaceReceipt =
  | { foot: string; head: string; kind: 'whatsapp'; text: string; time: string }
  | { approved: string; head: string; kind: 'approval'; question: string; text: string }
  | { head: string; kind: 'slack'; text: string }

export interface RaceScenario {
  ask: string
  chip: string
  key: RaceKey
  receipt: RaceReceipt
  steps: RaceStep[]
  talk: string
}

export function buildRaceScenarios(now: Date): RaceScenario[] {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const weekday = today.getDay()
  const lastMonday = addDays(today, -((weekday + 6) % 7) - 7)
  const lastSunday = addDays(lastMonday, 6)
  const nextMonday = addDays(today, (8 - weekday) % 7 || 7)
  const inTwoDays = addDays(today, 2)

  return [
    {
      key: 'vendas',
      chip: 'Resumo de vendas',
      ask: 'Toda segunda às 8h, me manda no WhatsApp um resumo das vendas da semana.',
      talk:
        'Claro! Aqui vai um passo a passo para montar esse resumo toda segunda:\n\n' +
        '1. Abra a planilha de vendas e filtre os últimos 7 dias.\n' +
        '2. Some o faturamento e compare com a semana anterior.\n' +
        '3. Anote os produtos que mais venderam.\n' +
        '4. Copie os números para uma mensagem e envie no WhatsApp.\n\n' +
        'Dica: crie um lembrete no celular para toda segunda às 8h.\n\n' +
        'Como não tenho acesso à sua planilha nem ao seu WhatsApp, essa parte fica com você. ' +
        'Quer que eu escreva um modelo de mensagem?',
      steps: [
        { glyph: 'clock', tool: 'cron.criar', detail: 'toda segunda, 08:00 · 0 8 * * 1', seconds: 0.4 },
        { glyph: 'sheets', tool: 'sheets.ler', detail: 'Vendas 2026 › semana · 1.284 linhas', seconds: 2.6 },
        { glyph: 'chart', tool: 'analisar', detail: 'faturamento, ticket médio, top 5', seconds: 6.8 },
        { glyph: 'compare', tool: 'comparar', detail: 'semana anterior → +12,4%', seconds: 1.9 },
        { glyph: 'whatsapp', tool: 'whatsapp.enviar', detail: 'Diretoria · resumo + gráfico', seconds: 1.2 },
        { glyph: 'memory', tool: 'memória.salvar', detail: 'skill resumo-semanal-vendas', seconds: 0.3 },
      ],
      receipt: {
        kind: 'whatsapp',
        head: 'Entregue no WhatsApp · Diretoria',
        text:
          `Resumo da semana (${dayMonth(lastMonday)} a ${dayMonth(lastSunday)})\n` +
          'Faturamento: R$ 84.320 (+12,4%)\n' +
          'Pedidos: 312 · ticket médio R$ 270\n' +
          'Destaque: Kit Café Especial (+38%)',
        time: clock(now),
        foot: `Próximo envio: ${WEEKDAY_SHORT[nextMonday.getDay()]}, ${dayMonth(nextMonday)} · 08:00`,
      },
    },
    {
      key: 'clientes',
      chip: 'Clientes no WhatsApp',
      ask: 'Responde os clientes do WhatsApp que perguntarem do status do pedido.',
      talk:
        'Boa ideia! Para responder seus clientes sobre o status do pedido:\n\n' +
        '1. Abra cada conversa no WhatsApp Business.\n' +
        '2. Procure o número do pedido no seu sistema.\n' +
        '3. Copie o código de rastreio no site da transportadora.\n' +
        '4. Cole a resposta na conversa. Respostas rápidas ajudam a ganhar tempo.\n\n' +
        'Eu não consigo ler suas conversas nem consultar seus pedidos. ' +
        'Posso sugerir um texto padrão para você copiar e colar?',
      steps: [
        { glyph: 'whatsapp', tool: 'whatsapp.ouvir', detail: 'mensagens que citam “pedido”', seconds: 0.2 },
        { glyph: 'message', tool: 'mensagem', detail: 'Ana: “meu pedido 4471 já saiu?”', seconds: 0, kind: 'incoming' },
        { glyph: 'sheets', tool: 'pedidos.buscar', detail: '#4471 · enviado ontem · Correios', seconds: 0.9 },
        { glyph: 'truck', tool: 'rastreio.consultar', detail: 'BR123456789 · em trânsito', seconds: 1.6 },
        { glyph: 'whatsapp', tool: 'whatsapp.responder', detail: 'Ana · status e previsão', seconds: 0.7 },
        { glyph: 'memory', tool: 'memória.salvar', detail: 'Ana: cliente recorrente', seconds: 0.2 },
      ],
      receipt: {
        kind: 'whatsapp',
        head: 'Respondido no WhatsApp · Ana',
        text:
          'Oi, Ana! Seu pedido #4471 saiu ontem pelos Correios e deve chegar ' +
          `${WEEKDAY_LONG[inTwoDays.getDay()]} (${dayMonth(inTwoDays)}).\nRastreio: BR123456789`,
        time: clock(now),
        foot: 'Tempo até a resposta: 3,2 s',
      },
    },
    {
      key: 'boletos',
      chip: 'Boletos vencidos',
      ask: 'Cobra os clientes com boleto vencido e me avisa quem já pagou.',
      talk:
        'Posso ajudar com um modelo de cobrança educada:\n\n' +
        '“Olá, [nome]! Tudo bem? O boleto com vencimento em [data] ainda consta em aberto. ' +
        'Segue a segunda via para pagamento.”\n\n' +
        'Para enviar, filtre os vencidos na planilha de contas a receber, gere a segunda via no banco, ' +
        'mande a mensagem para cada cliente e confira os pagamentos no extrato depois.\n\n' +
        'Não consigo acessar seu banco, suas planilhas nem enviar mensagens. Quer outras versões do texto?',
      steps: [
        { glyph: 'sheets', tool: 'sheets.ler', detail: 'Contas a receber · 7 vencidos', seconds: 1.4 },
        { glyph: 'gmail', tool: 'gmail.buscar', detail: 'comprovantes da semana · 2 achados', seconds: 2.2 },
        { glyph: 'reconcile', tool: 'conciliar', detail: '2 pagos → baixa na planilha', seconds: 0.9 },
        { glyph: 'whatsapp', tool: 'whatsapp.enviar', detail: '5 lembretes com a 2ª via', seconds: 3.1 },
        {
          glyph: 'gcal',
          tool: 'agenda.criar',
          detail: `retorno ${WEEKDAY_SHORT[inTwoDays.getDay()]}, ${dayMonth(inTwoDays)} · 10:00`,
          seconds: 0.4,
        },
        { glyph: 'slack', tool: 'slack.enviar', detail: '#financeiro · resumo da cobrança', seconds: 0.6 },
      ],
      receipt: {
        kind: 'slack',
        head: 'Postado no Slack · #financeiro',
        text:
          'Cobrança de hoje\n' +
          '• 5 lembretes enviados com a 2ª via\n' +
          '• 2 pagamentos conciliados: R$ 3.420,00\n' +
          `• Retorno com quem não pagou: ${WEEKDAY_LONG[inTwoDays.getDay()]}, 10:00`,
      },
    },
    {
      key: 'campanha',
      chip: 'Campanha com time de IA',
      ask: 'Monta a campanha de lançamento do produto novo com o time de marketing.',
      talk:
        'Uma boa campanha de lançamento costuma ter cinco etapas:\n\n' +
        '1. Pesquisa de mercado e concorrentes.\n' +
        '2. Proposta de valor e mensagem principal.\n' +
        '3. Calendário de conteúdo por canal.\n' +
        '4. Captação de leads com landing page.\n' +
        '5. Métricas e acompanhamento.\n\n' +
        'Posso detalhar cada etapa em um documento para você e seu time executarem. ' +
        'Quer começar pela pesquisa de mercado?',
      steps: [
        { glyph: 'team', tool: 'delegar', detail: '4 bots do time Marketing, em paralelo', seconds: 0.5 },
        { glyph: 'branch', tool: 'Pesquisa', detail: '3 concorrentes · 12 referências', seconds: 48, kind: 'parallel' },
        { glyph: 'branch', tool: 'Mídias Sociais', detail: 'calendário de 14 dias · 9 posts', seconds: 74, kind: 'parallel' },
        { glyph: 'branch', tool: 'Leads', detail: 'landing + formulário no HubSpot', seconds: 131, kind: 'parallel' },
        { glyph: 'branch', tool: 'Análise', detail: 'KPIs, metas e painel', seconds: 36, kind: 'parallel' },
        { glyph: 'notion', tool: 'notion.criar', detail: 'Lançamento · plano com tudo ligado', seconds: 1.1 },
      ],
      receipt: {
        kind: 'approval',
        head: 'Aguardando você · Notion',
        text: 'Plano de lançamento pronto: pesquisa, 9 posts, landing page e metas.',
        question: 'Posso agendar os 9 posts para a revisão do time?',
        approved: 'Aprovado. Os 9 posts foram agendados para a revisão do time.',
      },
    },
  ]
}
