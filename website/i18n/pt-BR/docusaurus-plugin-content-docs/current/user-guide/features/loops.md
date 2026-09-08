---
sidebar_position: 17
title: "Recurring Loops"
description: "Re-run a prompt on a recurring interval inside your session — Work4You' take on Claude Code's /loop."
---

# Loops recorrentes (`/loop`)

O `/loop` executa novamente um prompt (ou um slash command) em uma cadência recorrente **dentro da sua sessão atual**. Cada despertar (wakeup) é um turno de agente de verdade: o Work4You lê o estado atual em tempo real — o resultado mais recente da CI, a profundidade mais nova da fila, o arquivo como ele está agora —, faz o trabalho, reporta o resultado e fica em silêncio até o próximo tick.

É a versão do Work4You do **`/loop` do Claude Code** (e de seu alias `/proactive`, que também funciona aqui). Enquanto o [`/goal`](./goals.md) é orientado por julgamento — "continue trabalhando até que este objetivo seja alcançado" —, o `/loop` é orientado por temporizador: "faça isso de novo a cada N minutos (ou sempre que fizer sentido) até que algo mande parar."

## Quando usar

- **Monitorar (polling) um estado externo.** "Acompanhe o deploy / a execução de CI / a fila e me avise quando mudar." O caso de uso canônico.
- **Iterar até ficar verde.** "Rode os testes, corrija o que falhar, repita até passarem."
- **Monitoramento durante uma sessão de trabalho.** Fique de olho nas taxas de erro ou no progresso de um job longo enquanto você faz outra coisa na mesma conversa.
- **Manutenção periódica.** Rode novamente uma checagem de lint ou um resumo de status a cada N minutos durante uma sessão longa.

Quando o trabalho deve rodar **sem supervisão** — durante a noite, em um agendamento de verdade, sobrevivendo a reinicializações do seu terminal —, use um [cron job](./cron.md) em vez disso. O `/loop` vive dentro de uma sessão; o cron vive fora de todas elas. E quando a tarefa é um único objetivo com uma definição de "pronto", o [`/goal`](./goals.md) costuma ser a opção mais adequada.

## Início rápido

```
/loop 5m check the deploy status and tell me if it's live yet
```

O que você verá:

1. **Loop aceito** — `↻ Loop set (every 5m): check the deploy status…`
2. **Primeiro despertar em 5m** — enquanto a sessão está ociosa, o Work4You injeta o despertar e executa um turno normal contra o estado atual.
3. **Repetição** — a cada 5 minutos, até que uma condição de parada seja acionada ou você o interrompa.

Você também pode fazer loop de um slash command com a mesma facilidade:

```
/loop 10m /recap
```

## Os dois modos de cadência

**Intervalo fixo — você define o relógio.** Informe um intervalo (`30s`, `5m`, `2h`, `1h30m`) e o loop dispara nesse cronograma. Use quando aquilo que você está observando muda em seu próprio ritmo:

```
/loop 2m poll the build at ci.example.com/job/42 and ping me the moment it finishes
```

**Auto-ajustado (self-paced) — o Work4You define o relógio.** Omita o intervalo e o loop ajusta seu próprio ritmo: ele começa no piso (1 minuto por padrão) e, enquanto as respostas do agente não mudam, recua exponencialmente — 2m, 4m, 8m, até o teto (15 minutos por padrão). No momento em que uma resposta difere da anterior, a cadência volta imediatamente ao piso. A detecção de mudança é uma comparação local de digest (timestamps são ignorados), então esperas ociosas não custam nada extra:

```
/loop keep an eye on the migration and summarize progress
```

A regra prática: **intervalo fixo quando um relógio externo comanda o trabalho; auto-ajustado quando o trabalho comanda o ritmo.**

## Condições de parada

Um loop termina quando qualquer uma destas condições ocorre:

| Condição | Como |
|---|---|
| O agente decide que terminou | O prompt de despertar ensina o agente a encerrar sua resposta com `LOOP_COMPLETE` em sua própria linha quando a tarefa estiver concluída ou sem sentido continuar. |
| Um teto de execuções | `--times N` — para após N despertares. |
| Uma condição baseada em evidência | `--until <condition>` — depois de cada despertar, o mesmo juiz auxiliar que alimenta o `/goal` verifica a resposta em relação à sua condição (fail-open: um juiz quebrado nunca trava o loop). |
| Você | `/loop stop` (ou `/loop pause` para mantê-lo por perto). |
| O orçamento de contenção | `loops.max_ticks` (padrão 100) pausa o loop para que uma sessão sem supervisão não consuma tokens para sempre. `0` = ilimitado. |

Exemplos:

```
/loop 2m poll CI --times 30
/loop 5m watch the queue --until queue depth reaches zero
```

## Comandos

| Comando | O que faz |
|---|---|
| `/loop [interval] <prompt> [--times N] [--until <cond>]` | Inicia (ou substitui) o loop desta sessão. |
| `/loop` ou `/loop status` | Mostra a cadência, os ticks disparados e o tempo até o próximo despertar. |
| `/loop pause` | Para de disparar sem perder o loop. |
| `/loop resume` | Retoma de onde parou. |
| `/loop stop` | Encerra o loop. |
| `/proactive …` | Alias para `/loop` (paridade com o Claude Code). |

Funciona na CLI, na TUI (`work4you --tui`), no chat do web dashboard, no aplicativo desktop e em toda plataforma de gateway (Telegram, Discord, Slack, WhatsApp, …). Em plataformas de mensagens, o gateway dispara despertares mesmo entre suas mensagens — o loop pertence à sessão do chat, e seus resultados chegam como respostas comuns.

## Combinando com `/goal`

Ambos os recursos injetam turnos sintéticos em pontos ociosos, por isso seguem uma regra: **um goal ativo é dono da sessão.** Enquanto um `/goal` está ativamente em curso (o juiz dizendo "continue"), os despertares do loop ficam suspensos. O loop retoma usando o tempo ocioso assim que o goal termina, pausa ou se estaciona em uma barreira de espera (`/goal wait`, ou o veredito automático WAIT do juiz). Um goal estacionado junto com um `/loop` é uma combinação natural: o goal espera pela coisa assíncrona grande enquanto o loop mantém um "batimento cardíaco" em outra coisa.

Uma mensagem real do usuário sempre prevalece sobre ambos — despertares só disparam enquanto a sessão está ociosa e nada seu está enfileirado.

## Detalhes de comportamento

- **Um despertar é um turno normal no papel de usuário.** Sem mutação do system prompt, sem troca de toolset — o cache de prompt permanece intacto.
- **Sobrevive a `/resume` e à compressão.** O estado do loop persiste por sessão e migra através dos limites de compressão de contexto, assim como o `/goal`.
- **Um loop por sessão.** Definir um novo `/loop` substitui o anterior. Rode vários loops executando várias sessões (ou use o cron para uma frota de agendamentos).
- **Interromper um turno de despertar (Ctrl+C) pausa o loop** — recuperável com `/loop resume`, então cancelar realmente significa cancelar.
- **O custo em tokens escala com a cadência.** Cada tick é um turno completo de agente. Ajuste o intervalo à frequência com que o estado realmente muda; prefira o auto-ajuste para esperas ociosas.

## Configuração

```yaml
# ~/.work4you/config.yaml
loops:
  min_interval_seconds: 30       # floor for fixed intervals
  max_ticks: 100                 # backstop budget (0 = unlimited)
  self_paced_floor_seconds: 60   # self-paced starting cadence
  self_paced_ceiling_seconds: 900  # self-paced max backoff
```

O juiz do `--until` passa pela tarefa auxiliar `goal_judge`, então as substituições de `auxiliary.goal_judge.*` (provedor, modelo, max_tokens) também se aplicam às condições de loop.

## `/loop` vs `/goal` vs cron

| | `/loop` | `/goal` | cron |
|---|---|---|---|
| **Gatilho** | Temporizador (ou auto-ajustado) | Veredito do juiz após cada turno | Agendamento, fora de qualquer sessão |
| **Vive em** | Sua sessão atual | Sua sessão atual | Sua própria sessão por execução |
| **Termina quando** | Condição de parada / tetos / você | Goal alcançado / orçamento / você | Você remove o job |
| **Melhor para** | Polling, monitoramento, reexecuções periódicas | Um objetivo, iterar até terminar | Agendamentos sem supervisão e de longo horizonte |
