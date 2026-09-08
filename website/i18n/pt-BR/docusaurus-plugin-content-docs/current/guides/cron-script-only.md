---
sidebar_position: 13
title: "Tarefas Cron Somente-Script (Sem LLM)"
description: "Cron jobs clássicos de watchdog que dispensam o LLM completamente — um script roda no horário agendado e sua saída padrão é entregue na sua plataforma de mensagens. Alertas de memória, alertas de disco, pings de CI, verificações periódicas de saúde."
---

# Tarefas Cron Somente-Script

Às vezes você já sabe exatamente qual mensagem quer enviar. Você não precisa de um agente para raciocinar sobre isso — só precisa de um script rodando em um timer, com sua saída (se houver) chegando ao Telegram / Discord / Slack / Signal.

O Work4You chama isso de **modo sem agente**. É o sistema de cron menos o LLM.

<!-- ascii-guard-ignore -->
```
   ┌──────────────────┐          ┌──────────────────┐
   │ scheduler tick   │  every   │ run script       │
   │ (every N minutes)│ ──────▶ │ (bash or python) │
   └──────────────────┘          └──────────────────┘
                                          │
                                          │ stdout
                                          ▼
                                 ┌──────────────────┐
                                 │ delivery router  │
                                 │ (telegram/disc…) │
                                 └──────────────────┘
```
<!-- ascii-guard-ignore-end -->

- **Sem chamada de LLM.** Zero tokens, zero loop de agente, zero gasto com modelo.
- **O script é a tarefa.** O script decide se deve alertar. Emite saída → mensagem é enviada. Não emite nada → tick silencioso.
- **Bash ou Python.** Arquivos `.sh` / `.bash` rodam sob `bash` a partir do `PATH` quando disponível, caso contrário `/bin/bash`; qualquer outra extensão roda sob o interpretador Python atual. Os caminhos devem resolver dentro de `~/.work4you/scripts/` (formas relativas, absolutas ou com `~` são aceitas desde que permaneçam nesse diretório). Scripts de cron **não** herdam credenciais de provedor do ambiente do processo Work4You.
- **Mesmo agendador.** Vive em `cronjob` junto com as tarefas de LLM — pausar, retomar, listar, logs e direcionamento de entrega funcionam todos da mesma forma.

## Quando Usar

Use o modo sem agente para:

- **Watchdogs de memória / disco / GPU.** Roda a cada 5 minutos, alerta apenas quando um limite é ultrapassado.
- **Hooks de CI.** Deploy concluído → posta o SHA do commit. Build falhou → envia as últimas 100 linhas do log.
- **Métricas periódicas.** "Receita diária do Stripe às 9h" como uma simples chamada de API + impressão formatada.
- **Pollers de eventos externos.** Verifica uma API, alerta em mudança de estado.
- **Heartbeats.** Faz ping em um dashboard a cada N minutos para provar que o host está vivo.

Use uma tarefa cron normal (orientada por LLM) quando precisar que o agente **decida** o que dizer — resumir um documento longo, escolher itens interessantes de um feed, redigir uma mensagem amigável para humanos. O caminho sem agente é para casos em que a saída padrão do script já É a mensagem.

## Criar uma pelo Chat

A grande vantagem do modo sem agente é que o próprio agente pode configurar o watchdog para você — sem editor, sem shell, sem precisar lembrar flags de CLI. Você descreve o que quer, o Work4You escreve o script, agenda e avisa quando ele vai disparar.

### Exemplo de transcrição

> **Você:** me avise no telegram se a RAM passar de 85% a cada 5 minutos
>
> **Work4You:** *(escreve `~/.work4you/scripts/memory-watchdog.sh`, depois chama `cronjob(...)` com `no_agent=true`)*
>
> Configurado. Roda a cada 5 min, alerta no Telegram apenas quando a RAM passar de 85%. Script: `memory-watchdog.sh`. ID da tarefa: `abc123`.

Nos bastidores, o agente faz duas chamadas de ferramenta:

```python
# 1. Write the check script
write_file(
    path="~/.work4you/scripts/memory-watchdog.sh",
    content='''#!/usr/bin/env bash
ram_pct=$(free | awk '/^Mem:/ {printf "%d", $3 * 100 / $2}')
if [ "$ram_pct" -ge 85 ]; then
  echo "RAM ${ram_pct}% on $(hostname)"
fi
# Empty stdout = silent tick; no message sent.
''',
)

# 2. Schedule it — no_agent=True skips the LLM on every tick
cronjob(
    action="create",
    schedule="every 5m",
    script="memory-watchdog.sh",
    no_agent=True,
    deliver="telegram",
    name="memory-watchdog",
)
```

A partir daí, cada tick é gratuito: o agendador roda o script, encaminha sua saída padrão para o Telegram se não estiver vazia, e nunca toca em um modelo.

### O que o agente decide por você

Quando você formula um pedido como "me avise quando X" ou "a cada N minutos verifique Y e me avise se Z", a descrição da ferramenta `cronjob` do Work4You o instrui a recorrer a `no_agent=True` sempre que o conteúdo da mensagem for totalmente determinado pelo script. Ele volta ao caminho normal orientado por LLM quando o pedido exige raciocínio (*"resuma as novas issues"*, *"escolha as manchetes mais interessantes"*, *"redija um lembrete amigável"*).

Você não precisa especificar `--no-agent` você mesmo. Apenas descreva o comportamento.

### Gerenciando watchdogs pelo chat

O agente pode pausar, retomar, editar e remover tarefas da mesma forma que as cria:

> **Você:** pare o watchdog de memória por hoje à noite
>
> **Work4You:** *(chama `cronjob(action='pause', job_id='abc123')`)*
>
> Pausado. Retome com "liga de novo" ou via `work4you cron resume abc123`.

> **Você:** muda para a cada 15 minutos
>
> **Work4You:** *(chama `cronjob(action='update', job_id='abc123', schedule='every 15m')`)*

O ciclo de vida completo (criar / listar / atualizar / pausar / retomar / rodar agora / remover) está disponível para o agente sem que você precise aprender nenhum comando de CLI.

## Criar uma pela CLI

Prefere o shell? O caminho da CLI dá o mesmo resultado com três comandos:

```bash
# 1. Write your script
cat > ~/.work4you/scripts/memory-watchdog.sh <<'EOF'
#!/usr/bin/env bash
# Alert when RAM usage is over 85%. Silent otherwise.
RAM_PCT=$(free | awk '/^Mem:/ {printf "%d", $3 * 100 / $2}')
if [ "$RAM_PCT" -ge 85 ]; then
  echo "⚠ RAM ${RAM_PCT}% on $(hostname)"
fi
# Empty stdout = silent run; no message sent.
EOF
chmod +x ~/.work4you/scripts/memory-watchdog.sh

# 2. Schedule it
work4you cron create "every 5m" \
  --no-agent \
  --script memory-watchdog.sh \
  --deliver telegram \
  --name "memory-watchdog"

# 3. Verify
work4you cron list
work4you cron run <job_id>    # fire it once to test
```

Isso é tudo. Sem prompt, sem skill, sem modelo.


## Como a Saída do Script Mapeia para a Entrega

| Comportamento do script | Resultado |
|-----------------|--------|
| Exit 0, stdout não vazia | stdout é entregue literalmente |
| Exit 0, stdout vazia | Tick silencioso — sem entrega |
| Exit 0, stdout contém `{"wakeAgent": false}` na última linha | Tick silencioso (portão compartilhado com as tarefas de LLM) |
| Código de saída diferente de zero | Alerta de erro é entregue (assim um watchdog quebrado não falha silenciosamente) |
| Timeout do script | Alerta de erro é entregue |

O comportamento "silencioso quando vazio" é a chave do padrão clássico de watchdog: o script é livre para rodar a cada minuto, mas o canal só vê uma mensagem quando algo realmente precisa de atenção.

## Regras dos Scripts

Os scripts devem viver em `~/.work4you/scripts/`. Isso é reforçado tanto no momento de criação da tarefa quanto em tempo de execução — caminhos absolutos, expansão de `~/` e padrões de travessia de caminho (`../`) são rejeitados. O mesmo diretório é compartilhado com o portão de script de pré-verificação usado pelas tarefas de LLM.

A escolha do interpretador é feita pela extensão do arquivo:

| Extensão | Interpretador |
|-----------|-------------|
| `.sh`, `.bash` | `bash` a partir do `PATH` (fallback `/bin/bash`) |
| qualquer outra | `sys.executable` (Python atual) |

Nós intencionalmente NÃO respeitamos shebangs `#!/...` — manter o conjunto de interpretadores explícito e pequeno reduz a superfície em que o agendador confia.

## Sintaxe de Agendamento

Igual a todas as outras tarefas cron:

```bash
work4you cron create "every 5m"        # interval
work4you cron create "every 2h"
work4you cron create "0 9 * * *"       # standard cron: 9am daily
work4you cron create "30m"             # one-shot: run once in 30 minutes
```

Veja a [referência de recurso cron](/user-guide/features/cron) para a sintaxe completa.

## Alvos de Entrega

`--deliver` aceita tudo o que o gateway conhece. Alguns formatos comuns:

```bash
--deliver telegram                       # platform home channel
--deliver telegram:-1001234567890        # specific chat
--deliver telegram:-1001234567890:17585  # specific Telegram forum topic
--deliver discord:#ops
--deliver slack:#engineering
--deliver signal:+15551234567
--deliver local                          # just save to ~/.work4you/cron/output/
```

Nenhum gateway em execução é necessário no momento de execução do script para plataformas com token de bot (Telegram, Discord, Slack, Signal, SMS, WhatsApp) — a ferramenta chama o endpoint REST de cada plataforma diretamente usando as credenciais já presentes em `~/.work4you/.env` / `~/.work4you/config.yaml`.

## Edição e Ciclo de Vida

```bash
work4you cron list                                    # see all jobs
work4you cron pause <job_id>                          # stop firing, keep definition
work4you cron resume <job_id>
work4you cron edit <job_id> --schedule "every 10m"    # adjust cadence
work4you cron edit <job_id> --agent                   # flip to LLM mode
work4you cron edit <job_id> --no-agent --script …     # flip back
work4you cron remove <job_id>                         # delete it
```

Tudo o que funciona nas tarefas de LLM (pausar, retomar, disparo manual, mudanças de alvo de entrega) também funciona nas tarefas sem agente.

## Exemplo Prático: Alerta de Espaço em Disco

```bash
cat > ~/.work4you/scripts/disk-alert.sh <<'EOF'
#!/usr/bin/env bash
# Alert when / or /home is over 90% full.
THRESHOLD=90
df -h / /home 2>/dev/null | awk -v t="$THRESHOLD" '
  NR > 1 && $5+0 >= t {
    printf "⚠ Disk %s full on %s\n", $5, $6
  }
'
EOF
chmod +x ~/.work4you/scripts/disk-alert.sh

work4you cron create "*/15 * * * *" \
  --no-agent \
  --script disk-alert.sh \
  --deliver telegram \
  --name "disk-alert"
```

Silencioso quando ambos os sistemas de arquivos estão abaixo de 90%; dispara exatamente uma linha por sistema de arquivos acima do limite quando um deles enche.

## Comparação com Outros Padrões

| Abordagem | O que roda | Quando usar |
|----------|-----------|-------------|
| `cronjob --no-agent` (esta página) | Seu script no agendamento do Work4You | Watchdogs / alertas / métricas recorrentes que não precisam de raciocínio |
| `cronjob` (padrão, LLM) | Agente com script de pré-verificação opcional | Quando o conteúdo da mensagem exige raciocínio sobre dados |
| Cron do sistema operacional + `curl` para uma [assinatura de webhook](/user-guide/messaging/webhooks) | Seu script no agendamento do sistema operacional | Quando o Work4You pode estar indisponível (a própria coisa que você está monitorando) |

Para watchdogs críticos de saúde do sistema que precisam disparar *mesmo quando o gateway está fora do ar*, use o cron do sistema operacional com um `curl` simples para uma assinatura de webhook do Work4You (ou qualquer endpoint externo de alerta) — esses rodam como processos independentes do sistema operacional e não dependem do Work4You estar ativo. O agendador dentro do gateway é a escolha certa quando o que está sendo monitorado é externo.

## Relacionados

- [Automatize Qualquer Coisa com Cron](/guides/automate-with-cron) — padrões de cron orientados por LLM.
- [Referência de Tarefas Agendadas (Cron)](/user-guide/features/cron) — sintaxe completa de agendamento, ciclo de vida, roteamento de entrega.
- [Assinaturas de Webhook](/user-guide/messaging/webhooks) — pontos de entrada HTTP dispare-e-esqueça para agendadores externos.
- [Internals do Gateway](/developer-guide/gateway-internals) — internals do roteador de entrega.
