import type { BlueprintCatalogTranslations } from '../types'

/** Portuguese copy for automation blueprint templates (backend catalog is English). */
export const blueprintCatalogPt: BlueprintCatalogTranslations = {
  weekdayOptions: {
    everyday: 'Todos os dias',
    weekdays: 'Dias úteis',
    weekends: 'Fins de semana'
  },
  dayOptions: {
    friday: 'Sexta-feira',
    monday: 'Segunda-feira',
    saturday: 'Sábado',
    sunday: 'Domingo'
  },
  sharedFields: {
    time: {
      label: 'A que horas?',
      help: 'Horário local 24h, ex.: 08:00'
    },
    deliver: {
      label: 'Onde entregar?'
    },
    recurrence: {
      label: 'Repetir em'
    },
    day: {
      label: 'Qual dia?'
    },
    interval_min: {
      label: 'Com que frequência?',
      help: 'intervalo em minutos entre verificações',
      options: {
        '15': 'A cada 15 minutos',
        '30': 'A cada 30 minutos',
        '60': 'A cada hora'
      }
    },
    interval_h: {
      label: 'Com que frequência?',
      help: 'horas entre verificações — respeite limites de taxa',
      options: {
        '1': 'A cada hora',
        '3': 'A cada 3 horas',
        '6': 'A cada 6 horas',
        '12': 'A cada 12 horas',
        '24': 'Uma vez por dia'
      }
    },
    interval_hours: {
      label: 'Com que frequência?',
      help: 'horas entre lembretes',
      options: {
        '1': 'A cada hora',
        '2': 'A cada 2 horas',
        '3': 'A cada 3 horas'
      }
    },
    start_hour: {
      label: 'Hora inicial',
      help: 'primeira hora da janela ativa (24h)'
    },
    end_hour: {
      label: 'Hora final',
      help: 'última hora da janela ativa (24h)'
    },
    count: {
      label: 'Quantos itens?',
      options: {
        '3': '3',
        '5': '5',
        '8': '8'
      }
    }
  },
  items: {
    'morning-brief': {
      title: 'Briefing matinal',
      description:
        'Um resumo curto do dia: agenda, clima e qualquer coisa urgente que precise da sua atenção.'
    },
    'important-mail': {
      title: 'Monitor de e-mail importante',
      description: 'Verifica a caixa de entrada periodicamente e avisa só sobre mensagens que realmente importam.',
      fields: {
        criteria: {
          label: 'Avise-me só se o e-mail…',
          default: 'precisar de resposta hoje, for do meu chefe ou da família, ou mencionar um prazo'
        }
      }
    },
    'weekly-review': {
      title: 'Revisão semanal',
      description: 'Recapitule a semana: o que foi feito, o que ficou em aberto e o que vem pela frente.'
    },
    'workday-start': {
      title: 'Início do dia de trabalho',
      description: 'Um lembrete nos dias úteis com a agenda e as prioridades do dia.'
    },
    'custom-reminder': {
      title: 'Lembrete personalizado',
      description: 'Um lembrete recorrente nas suas palavras, no horário que você escolher.',
      fields: {
        what: {
          label: 'Lembre-me de…',
          default: 'fazer uma pausa e alongar'
        }
      }
    },
    'evening-winddown': {
      title: 'Encerramento do dia',
      description: 'Check-in no fim do dia: agenda de amanhã e o que vale preparar ainda hoje.'
    },
    'news-digest': {
      title: 'Resumo de notícias',
      description:
        'Um digest recorrente sobre um assunto — sem repetir o que já foi enviado; só novidades de verdade.',
      fields: {
        topic: {
          label: 'Sobre qual assunto?',
          default: 'IA e tecnologia',
          help: 'tema, produto, pessoa ou termo de busca'
        }
      }
    },
    'bill-renewal-watch': {
      title: 'Contas e renovações',
      description:
        'Aviso antes de um pagamento recorrente, renovação de assinatura ou vencimento — sem surpresas na fatura.',
      fields: {
        what: {
          label: 'O que vence?',
          default: 'minha assinatura de streaming renova em breve'
        }
      }
    },
    'price-watch': {
      title: 'Preço e disponibilidade',
      description:
        'Acompanha um produto, voo, hotel ou anúncio exato e alerta quando a condição de preço ou disponibilidade for atingida.',
      fields: {
        item: {
          label: 'O que monitorar exatamente?',
          default: 'URL do produto ou descrição exata de voo/hotel/anúncio',
          help: 'URL ou descrição precisa — variante, datas, vendedor'
        },
        condition: {
          label: 'Avise quando…',
          default: 'o preço total cair abaixo do meu alvo',
          help: 'preço limite (informe a moeda), disponibilidade ou mudança de condições'
        }
      }
    },
    'competitor-watch': {
      title: 'Monitor de concorrentes',
      description:
        'Acompanha empresas escolhidas por notícias relevantes — lançamentos, preços, funding, registros — com digest citado.',
      fields: {
        companies: {
          label: 'Quais empresas?',
          default: 'dois ou três concorrentes, pelo nome canônico',
          help: 'nomes e domínios canônicos; apelidos ajudam na deduplicação'
        },
        categories: {
          label: 'Quais eventos importam?',
          default: 'lançamentos de produto, mudanças de preço, funding, parcerias, movimentos de executivos, incidentes'
        }
      }
    },
    'habit-checkin': {
      title: 'Check-in de hábito',
      description: 'Lembrete recorrente para manter um hábito e refletir se você cumpriu hoje.',
      fields: {
        habit: {
          label: 'Qual hábito?',
          default: '20 minutos de leitura'
        }
      }
    },
    'hydration-move': {
      title: 'Água e movimento',
      description: 'Lembretes periódicos durante o dia para beber água, levantar e alongar.',
      fields: {
        start_hour: {
          options: {
            '7': '7h',
            '8': '8h',
            '9': '9h',
            '10': '10h'
          }
        },
        end_hour: {
          options: {
            '16': '16h',
            '17': '17h',
            '18': '18h',
            '19': '19h'
          }
        }
      }
    },
    'meal-plan': {
      title: 'Plano de refeições semanal',
      description:
        'Plano semanal de refeições mais lista de compras consolidada, ajustado à dieta e ao tempo que você tem para cozinhar.',
      fields: {
        diet: {
          label: 'Dieta?',
          options: {
            'no restrictions': 'Sem restrições',
            vegetarian: 'Vegetariana',
            vegan: 'Vegana',
            'high-protein': 'Alta proteína',
            'low-carb': 'Baixo carboidrato'
          }
        },
        meals: {
          label: 'Refeições por dia?',
          options: {
            'dinner only': 'Só jantar',
            'lunch and dinner': 'Almoço e jantar',
            'all three': 'Três refeições'
          }
        },
        effort: {
          label: 'Esforço na cozinha?',
          options: {
            quick: 'Rápido',
            medium: 'Médio',
            ambitious: 'Elaborado'
          }
        }
      }
    },
    'learn-daily': {
      title: 'Aprendizado diário',
      description: 'Uma lição curta por dia sobre um tema que você quer aprender, evoluindo ao longo do tempo.',
      fields: {
        topic: {
          label: 'Aprender sobre…',
          default: 'vocabulário em espanhol'
        }
      }
    },
    'gratitude-journal': {
      title: 'Gratidão e reflexão',
      description: 'Prompt gentil no fim do dia para refletir sobre o que correu bem.'
    },
    'on-this-day': {
      title: 'Curiosidade do dia',
      description: 'Dose diária de curiosidade: fato histórico, curiosidade ou palavra do dia.',
      fields: {
        flavor: {
          label: 'Que tipo?',
          options: {
            'on this day in history': 'Neste dia na história',
            'word of the day': 'Palavra do dia',
            'science fact': 'Fato de ciência',
            'quote of the day': 'Citação do dia'
          }
        }
      }
    }
  }
}
