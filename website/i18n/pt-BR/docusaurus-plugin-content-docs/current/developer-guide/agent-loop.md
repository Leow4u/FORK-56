---
sidebar_position: 3
title: "Agent Loop Internals"
description: "Detailed walkthrough of AIAgent execution, API modes, tools, callbacks, and fallback behavior"
---

# Internals do Agent Loop

O motor de orquestração central é a classe `AIAgent` do `run_agent.py` — um arquivo grande que lida com tudo, desde a montagem de prompts até o despacho de ferramentas e o failover de provedores.

## Responsabilidades Principais

`AIAgent` é responsável por:

- Montar o system prompt efetivo e os schemas de ferramentas via `prompt_builder.py`
- Selecionar o provedor/modo de API correto (chat_completions, codex_responses, anthropic_messages)
- Fazer chamadas ao modelo interrompíveis com suporte a cancelamento
- Executar chamadas de ferramenta (sequencialmente ou concorrentemente via thread pool)
- Manter o histórico de conversa no formato de mensagem da OpenAI
- Lidar com compressão, novas tentativas e troca de modelo de fallback
- Rastrear orçamentos de iteração entre agentes pai e filhos
- Descarregar (flush) a memória persistente antes que o contexto seja perdido

## Dois Pontos de Entrada

```python
# Simple interface — returns final response string
response = agent.chat("Fix the bug in main.py")

# Full interface — returns dict with messages, metadata, usage stats
result = agent.run_conversation(
    user_message="Fix the bug in main.py",
    system_message=None,           # auto-built if omitted
    conversation_history=None,      # auto-loaded from session if omitted
    task_id="task_abc123"
)
```

`chat()` é um wrapper fino em torno de `run_conversation()` que extrai o campo `final_response` do dicionário resultante.

## Modos de API

O Work4You suporta três modos de execução de API, resolvidos a partir da seleção de provedor, argumentos explícitos e heurísticas de base URL:

| Modo de API | Usado para | Tipo de cliente |
|----------|----------|-------------|
| `chat_completions` | Endpoints compatíveis com OpenAI (OpenRouter, custom, a maioria dos provedores) | `openai.OpenAI` |
| `codex_responses` | OpenAI Codex / Responses API | `openai.OpenAI` com formato Responses |
| `anthropic_messages` | Anthropic Messages API nativa | `anthropic.Anthropic` via adaptador |

O modo determina como as mensagens são formatadas, como as chamadas de ferramenta são estruturadas, como as respostas são analisadas e como o caching/streaming funciona. Os três convergem para o mesmo formato de mensagem interno (dicts `role`/`content`/`tool_calls` estilo OpenAI) antes e depois das chamadas de API.

**Ordem de resolução do modo:**
1. Argumento explícito `api_mode` no construtor (maior prioridade)
2. Detecção específica do provedor (ex.: provedor `anthropic` → `anthropic_messages`)
3. Heurísticas de base URL (ex.: `api.anthropic.com` → `anthropic_messages`)
4. Padrão: `chat_completions`

## Ciclo de Vida do Turno

Cada iteração do loop do agente segue esta sequência:

```text
run_conversation()
  1. Generate task_id if not provided
  2. Append user message to conversation history
  3. Build or reuse cached system prompt (prompt_builder.py)
  4. Check if preflight compression is needed (>50% context)
  5. Build API messages from conversation history
     - chat_completions: OpenAI format as-is
     - codex_responses: convert to Responses API input items
     - anthropic_messages: convert via anthropic_adapter.py
  6. Inject ephemeral prompt layers (budget warnings, context pressure)
  7. Apply prompt caching markers if on Anthropic
  8. Make interruptible API call (_interruptible_api_call)
  9. Parse response:
     - If tool_calls: execute them, append results, loop back to step 5
     - If text response: persist session, flush memory if needed, return
```

### Formato de Mensagem

Todas as mensagens usam formato compatível com OpenAI internamente:

```python
{"role": "system", "content": "..."}
{"role": "user", "content": "..."}
{"role": "assistant", "content": "...", "tool_calls": [...]}
{"role": "tool", "tool_call_id": "...", "content": "..."}
```

O conteúdo de raciocínio (de modelos que suportam thinking estendido) é armazenado em `assistant_msg["reasoning"]` e opcionalmente exibido via `reasoning_callback`.

### Regras de Alternância de Mensagens

O loop do agente impõe uma alternância estrita de papéis de mensagem:

- Após a mensagem system: `User → Assistant → User → Assistant → ...`
- Durante chamadas de ferramenta: `Assistant (with tool_calls) → Tool → Tool → ... → Assistant`
- **Nunca** duas mensagens assistant seguidas
- **Nunca** duas mensagens user seguidas
- **Apenas** o papel `tool` pode ter entradas consecutivas (resultados de ferramentas paralelas)

Os provedores validam essas sequências e rejeitam históricos malformados.

## Chamadas de API Interrompíveis

As requisições de API são envolvidas em `_interruptible_api_call()`, que executa a chamada HTTP real em uma thread de segundo plano enquanto monitora um evento de interrupção:

```text
┌────────────────────────────────────────────────────┐
│  Main thread                  API thread           │
│                                                    │
│   wait on:                     HTTP POST           │
│    - response ready     ───▶   to provider         │
│    - interrupt event                               │
│    - timeout                                       │
└────────────────────────────────────────────────────┘
```

Quando interrompida (usuário envia nova mensagem, comando `/stop` ou sinal):
- A thread de API é abandonada (a resposta é descartada)
- O agente pode processar a nova entrada ou encerrar de forma limpa
- Nenhuma resposta parcial é injetada no histórico de conversa

## Execução de Ferramentas

### Sequencial vs. Concorrente

Quando o modelo retorna chamadas de ferramenta:

- **Chamada de ferramenta única** → executada diretamente na thread principal
- **Múltiplas chamadas de ferramenta** → executadas concorrentemente via `ThreadPoolExecutor`
  - Exceção: ferramentas marcadas como interativas (ex.: `clarify`) forçam execução sequencial
  - Os resultados são reinseridos na ordem original das chamadas de ferramenta, independentemente da ordem de conclusão

### Fluxo de Execução

```text
for each tool_call in response.tool_calls:
    1. Resolve handler from tools/registry.py
    2. Fire pre_tool_call plugin hook
    3. Check if dangerous command (tools/approval.py)
       - If dangerous: invoke approval_callback, wait for user
    4. Execute handler with args + task_id
    5. Fire post_tool_call plugin hook
    6. Append {"role": "tool", "content": result} to history
```

### Ferramentas de Nível de Agente

Algumas ferramentas são interceptadas por `run_agent.py` *antes* de chegar a `handle_function_call()`:

| Ferramenta | Por que é interceptada |
|------|--------------------|
| `todo` | Lê/escreve estado de tarefa local ao agente |
| `memory` | Escreve em arquivos de memória persistente com limites de caracteres |
| `session_search` | Consulta o histórico de sessão via o banco de dados de sessão do agente |
| `delegate_task` | Cria subagente(s) com contexto isolado |

Essas ferramentas modificam o estado do agente diretamente e retornam resultados de ferramenta sintéticos sem passar pelo registry.

## Superfícies de Callback

`AIAgent` suporta callbacks específicos de plataforma que permitem progresso em tempo real nas integrações de CLI, gateway e ACP:

| Callback | Quando é disparado | Usado por |
|----------|-----------|---------|
| `tool_progress_callback` | Antes/depois de cada execução de ferramenta | Spinner do CLI, mensagens de progresso do gateway |
| `thinking_callback` | Quando o modelo começa/para de pensar | Indicador "thinking..." do CLI |
| `reasoning_callback` | Quando o modelo retorna conteúdo de raciocínio | Exibição de raciocínio do CLI, blocos de raciocínio do gateway |
| `clarify_callback` | Quando a ferramenta `clarify` é chamada | Prompt de entrada do CLI, mensagem interativa do gateway |
| `step_callback` | Após cada turno completo do agente | Rastreamento de etapas do gateway, progresso do ACP |
| `stream_delta_callback` | A cada token de streaming (quando habilitado) | Exibição de streaming do CLI |
| `tool_gen_callback` | Quando uma chamada de ferramenta é analisada a partir do stream | Pré-visualização de ferramenta no spinner do CLI |
| `status_callback` | Mudanças de estado (thinking, executing, etc.) | Atualizações de status do ACP |

## Orçamento e Comportamento de Fallback

### Orçamento de Iteração

O agente rastreia iterações via `IterationBudget`:

- Padrão: 500 iterações (configurável via `agent.max_turns`)
- Cada agente tem seu próprio orçamento. Subagentes recebem orçamentos independentes limitados a `delegation.max_iterations` (padrão 50) — as iterações totais entre pai + subagentes podem exceder o limite do pai
- Aos 100%, o agente para e retorna um resumo do trabalho realizado

### Modelo de Fallback

Quando o modelo primário falha (limite de taxa 429, erro de servidor 5xx, erro de autenticação 401/403):

1. Verifica a lista `fallback_providers` na configuração
2. Tenta cada fallback em ordem
3. Em caso de sucesso, continua a conversa com o novo provedor
4. Em caso de 401/403, tenta renovar as credenciais antes de fazer failover

O sistema de fallback também cobre tarefas auxiliares de forma independente — visão, compressão e extração web têm cada uma sua própria cadeia de fallback configurável via a seção de configuração `auxiliary.*`.

## Compressão e Persistência

### Quando a Compressão é Acionada

- **Preflight** (antes da chamada de API): Se a conversa exceder 50% da janela de contexto do modelo
- **Compressão automática do gateway**: Se a conversa exceder 85% (mais agressiva, executa entre turnos)

### O Que Acontece Durante a Compressão

1. A memória é descarregada em disco primeiro (evitando perda de dados)
2. Os turnos intermediários da conversa são resumidos em um resumo compacto
3. As últimas N mensagens são preservadas intactas (`compression.protect_last_n`, padrão: 20)
4. Pares de mensagem de chamada/resultado de ferramenta são mantidos juntos (nunca divididos)
5. Um novo ID de linhagem de sessão é gerado (a compressão cria uma sessão "filha")

### Persistência de Sessão

Após cada turno:
- As mensagens são salvas no armazenamento de sessão (SQLite via `work4you_state.py`)
- As mudanças de memória são descarregadas para `MEMORY.md` / `USER.md`
- A sessão pode ser retomada mais tarde via `/resume` ou `work4you chat --resume`

## Arquivos-Fonte Principais

| Arquivo | Propósito |
|------|---------|
| `run_agent.py` | Classe AIAgent — o loop completo do agente |
| `agent/prompt_builder.py` | Montagem do system prompt a partir de memória, skills, arquivos de contexto, personalidade |
| `agent/context_engine.py` | ContextEngine ABC — gerenciamento de contexto plugável |
| `agent/context_compressor.py` | Motor padrão — algoritmo de sumarização com perdas |
| `agent/prompt_caching.py` | Marcadores de prompt caching da Anthropic e métricas de cache |
| `agent/auxiliary_client.py` | Cliente LLM auxiliar para tarefas paralelas (visão, sumarização) |
| `model_tools.py` | Coleta de schema de ferramentas, despacho `handle_function_call()` |

## Documentação Relacionada

- [Provider Runtime Resolution](./provider-runtime.md)
- [Prompt Assembly](./prompt-assembly.md)
- [Context Compression & Prompt Caching](./context-compression-and-caching.md)
- [Tools Runtime](./tools-runtime.md)
- [Architecture Overview](./architecture.md)
