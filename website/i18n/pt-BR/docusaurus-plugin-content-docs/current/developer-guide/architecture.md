---
sidebar_position: 1
title: "Architecture"
description: "Work4You internals — major subsystems, execution paths, data flow, and where to read next"
---

# Arquitetura

Esta página é o mapa de alto nível dos internals do Work4You. Use-a para se orientar no codebase, depois mergulhe na documentação específica de cada subsistema para detalhes de implementação.

## Visão Geral do Sistema

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        Entry Points                                  │
│                                                                      │
│  CLI (cli.py)    Gateway (gateway/run.py)    ACP (acp_adapter/)     │
│  Batch Runner    API Server                  Python Library          │
└──────────┬──────────────┬───────────────────────┬───────────────────┘
           │              │                       │
           ▼              ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AIAgent (run_agent.py)                          │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Prompt       │  │ Provider     │  │ Tool         │               │
│  │ Builder      │  │ Resolution   │  │ Dispatch     │               │
│  │ (prompt_     │  │ (runtime_    │  │ (model_      │               │
│  │  builder.py) │  │  provider.py)│  │  tools.py)   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                       │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐               │
│  │ Compression  │  │ 3 API Modes  │  │ Tool Registry│               │
│  │ & Caching    │  │ chat_compl.  │  │ (registry.py)│               │
│  │              │  │ codex_resp.  │  │ 70+ tools    │               │
│  │              │  │ anthropic    │  │ 28 toolsets  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└─────────┴─────────────────┴─────────────────┴───────────────────────┘
           │                                    │
           ▼                                    ▼
┌───────────────────┐              ┌──────────────────────┐
│ Session Storage   │              │ Tool Backends         │
│ (SQLite + FTS5)   │              │ Terminal (6 backends) │
│ work4you_state.py   │              │ Browser (5 backends)  │
│ gateway/session.py│              │ Web (4 backends)      │
└───────────────────┘              │ MCP (dynamic)         │
                                   │ File, Vision, etc.    │
                                   └──────────────────────┘
```

## Estrutura de Diretórios

```text
work4you/
├── run_agent.py              # AIAgent — core conversation loop (large file)
├── cli.py                    # Work4YouCLI — interactive terminal UI (large file)
├── model_tools.py            # Tool discovery, schema collection, dispatch
├── toolsets.py               # Tool groupings and platform presets
├── work4you_state.py           # SQLite session/state database with FTS5
├── work4you_constants.py       # WORK4YOU_HOME, profile-aware paths
├── batch_runner.py           # Batch trajectory generation
│
├── agent/                    # Agent internals
│   ├── prompt_builder.py     # System prompt assembly
│   ├── context_engine.py     # ContextEngine ABC (pluggable)
│   ├── context_compressor.py # Default engine — lossy summarization
│   ├── prompt_caching.py     # Anthropic prompt caching
│   ├── auxiliary_client.py   # Auxiliary LLM for side tasks (vision, summarization)
│   ├── model_metadata.py     # Model context lengths, token estimation
│   ├── models_dev.py         # models.dev registry integration
│   ├── anthropic_adapter.py  # Anthropic Messages API format conversion
│   ├── display.py            # KawaiiSpinner, tool preview formatting
│   ├── skill_commands.py     # Skill slash commands
│   ├── memory_manager.py    # Memory manager orchestration
│   ├── memory_provider.py   # Memory provider ABC
│   └── trajectory.py         # Trajectory saving helpers
│
├── work4you_cli/               # CLI subcommands and setup
│   ├── main.py               # Entry point — all `work4you` subcommands (large file)
│   ├── config.py             # DEFAULT_CONFIG, OPTIONAL_ENV_VARS, migration
│   ├── commands.py           # COMMAND_REGISTRY — central slash command definitions
│   ├── auth.py               # PROVIDER_REGISTRY, credential resolution
│   ├── runtime_provider.py   # Provider → api_mode + credentials
│   ├── models.py             # Model catalog, provider model lists
│   ├── model_switch.py       # /model command logic (CLI + gateway shared)
│   ├── setup.py              # Interactive setup wizard (large file)
│   ├── skin_engine.py        # CLI theming engine
│   ├── skills_config.py      # work4you skills — enable/disable per platform
│   ├── skills_hub.py         # /skills slash command
│   ├── tools_config.py       # work4you tools — enable/disable per platform
│   ├── plugins.py            # PluginManager — discovery, loading, hooks
│   ├── callbacks.py          # Terminal callbacks (clarify, sudo, approval)
│   └── gateway.py            # work4you gateway start/stop
│
├── tools/                    # Tool implementations (one file per tool)
│   ├── registry.py           # Central tool registry
│   ├── approval.py           # Dangerous command detection
│   ├── terminal_tool.py      # Terminal orchestration
│   ├── process_registry.py   # Background process management
│   ├── file_tools.py         # read_file, write_file, patch, search_files
│   ├── web_tools.py          # web_search, web_extract
│   ├── browser_tool.py       # 10 browser automation tools
│   ├── code_execution_tool.py # execute_code sandbox
│   ├── delegate_tool.py      # Subagent delegation
│   ├── mcp_tool.py           # MCP client (large file)
│   ├── credential_files.py   # File-based credential passthrough
│   ├── env_passthrough.py    # Env var passthrough for sandboxes
│   ├── ansi_strip.py         # ANSI escape stripping
│   └── environments/         # Terminal backends (local, docker, ssh, modal, daytona, singularity)
│
├── gateway/                  # Messaging platform gateway
│   ├── run.py                # GatewayRunner — message dispatch (large file)
│   ├── session.py            # SessionStore — conversation persistence
│   ├── delivery.py           # Outbound message delivery
│   ├── pairing.py            # DM pairing authorization
│   ├── hooks.py              # Hook discovery and lifecycle events
│   ├── mirror.py             # Cross-session message mirroring
│   ├── status.py             # Token locks, profile-scoped process tracking
│   ├── builtin_hooks/        # Extension point for always-registered hooks (none shipped)
│   └── platforms/            # Built-in adapters: signal, weixin, bluebubbles,
│                             #   qqbot, whatsapp_cloud, yuanbao, webhook, api_server
│
├── plugins/platforms/        # Bundled platform plugins: telegram, discord, slack,
│                             #   whatsapp, matrix, mattermost, email, sms, dingtalk,
│                             #   feishu, wecom, homeassistant, irc, line, teams,
│                             #   google_chat, buzz, ntfy, photon, raft, simplex
│
├── acp_adapter/              # ACP server (VS Code / Zed / JetBrains)
├── cron/                     # Scheduler (jobs.py, scheduler.py)
├── plugins/memory/           # Memory provider plugins
├── plugins/context_engine/   # Context engine plugins
├── skills/                   # Bundled skills (always available)
├── optional-skills/          # Official optional skills (install explicitly)
├── website/                  # Docusaurus documentation site
└── tests/                    # Pytest suite (~25,000 tests across ~1,250 files)
```

## Fluxo de Dados

### Sessão de CLI

```text
User input → Work4YouCLI.process_input()
  → AIAgent.run_conversation()
    → prompt_builder.build_system_prompt()
    → runtime_provider.resolve_runtime_provider()
    → API call (chat_completions / codex_responses / anthropic_messages)
    → tool_calls? → model_tools.handle_function_call() → loop
    → final response → display → save to SessionDB
```

### Mensagem do Gateway

```text
Platform event → Adapter.on_message() → MessageEvent
  → GatewayRunner._handle_message()
    → authorize user
    → resolve session key
    → create AIAgent with session history
    → AIAgent.run_conversation()
    → deliver response back through adapter
```

### Tarefa de Cron

```text
Scheduler tick → load due jobs from jobs.json
  → create fresh AIAgent (no history)
  → inject attached skills as context
  → run job prompt
  → deliver response to target platform
  → update job state and next_run
```

## Ordem de Leitura Recomendada

Se você é novo no codebase:

1. **Esta página** — se orientar
2. **[Agent Loop Internals](./agent-loop.md)** — como o AIAgent funciona
3. **[Prompt Assembly](./prompt-assembly.md)** — construção do system prompt
4. **[Provider Runtime Resolution](./provider-runtime.md)** — como os provedores são selecionados
5. **[Adding Providers](./adding-providers.md)** — guia prático para adicionar um novo provedor
6. **[Tools Runtime](./tools-runtime.md)** — registry de ferramentas, despacho, ambientes
7. **[Session Storage](./session-storage.md)** — schema SQLite, FTS5, linhagem de sessão
8. **[Gateway Internals](./gateway-internals.md)** — gateway de plataformas de mensagens
9. **[Context Compression & Prompt Caching](./context-compression-and-caching.md)** — compressão e caching
10. **[ACP Internals](./acp-internals.md)** — integração com IDE

## Principais Subsistemas

### Agent Loop

O motor de orquestração síncrono (`AIAgent` em `run_agent.py`). Lida com seleção de provedor, construção de prompt, execução de ferramentas, novas tentativas, fallback, callbacks, compressão e persistência. Suporta três modos de API para diferentes backends de provedor.

→ [Agent Loop Internals](./agent-loop.md)

### Sistema de Prompt

Construção e manutenção de prompt ao longo do ciclo de vida da conversa:

- **`system_prompt.py` + `prompt_builder.py`** — monta as camadas ordenadas do system prompt (`stable` → `context` → `volatile`): orientação de identidade/ferramentas/skills, arquivos de contexto, e depois blocos de memória/perfil/timestamp
- **`prompt_caching.py`** — Aplica breakpoints de cache da Anthropic para caching de prefixo
- **`context_compressor.py`** — Resume os turnos intermediários da conversa quando o contexto excede os limites

→ [Prompt Assembly](./prompt-assembly.md), [Context Compression & Prompt Caching](./context-compression-and-caching.md)

### Resolução de Provedor

Um resolvedor de runtime compartilhado usado por CLI, gateway, cron, ACP e chamadas auxiliares. Mapeia tuplas `(provider, model)` para `(api_mode, api_key, base_url)`. Lida com mais de 18 provedores, fluxos OAuth, pools de credenciais e resolução de aliases.

→ [Provider Runtime Resolution](./provider-runtime.md)

### Sistema de Ferramentas

Registry central de ferramentas (`tools/registry.py`) com mais de 70 ferramentas registradas em ~28 toolsets. Cada arquivo de ferramenta se auto-registra no momento da importação. O registry lida com coleta de schema, despacho, verificação de disponibilidade e encapsulamento de erros. As ferramentas de terminal suportam 7 backends (local, Docker, SSH, Daytona, Modal, Singularity, Vercel Sandbox).

→ [Tools Runtime](./tools-runtime.md)

### Persistência de Sessão

Armazenamento de sessão baseado em SQLite com busca full-text FTS5. As sessões têm rastreamento de linhagem (pai/filho entre compressões), isolamento por plataforma e escritas atômicas com tratamento de contenção.

→ [Session Storage](./session-storage.md)

### Gateway de Mensagens

Processo de longa duração com mais de 25 adaptadores de plataforma (nativos + plugins empacotados), roteamento de sessão unificado, autorização de usuário (allowlists + pareamento de DM), despacho de comandos slash, sistema de hooks, ticking de cron e manutenção em segundo plano.

→ [Gateway Internals](./gateway-internals.md)

### Sistema de Plugins

Três fontes de descoberta: `~/.work4you/plugins/` (usuário), `.work4you/plugins/` (projeto) e entry points do pip. Plugins registram ferramentas, hooks e comandos de CLI através de uma API de contexto. Existem dois tipos especializados de plugin: provedores de memória (`plugins/memory/`) e motores de contexto (`plugins/context_engine/`). Ambos são de seleção única — apenas um de cada pode estar ativo por vez, configurado via `work4you plugins` ou `config.yaml`.

→ [Plugin Guide](/developer-guide/plugins), [Memory Provider Plugin](./memory-provider-plugin.md)

### Cron

Tarefas de agente de primeira classe (não tarefas de shell). Os jobs são armazenados em JSON, suportam múltiplos formatos de agendamento, podem anexar skills e scripts, e entregam para qualquer plataforma.

→ [Cron Internals](./cron-internals.md)

### Integração ACP

Expõe o Work4You como um agente nativo de editor via stdio/JSON-RPC para VS Code, Zed e JetBrains.

→ [ACP Internals](./acp-internals.md)

### Trajetórias

Gera trajetórias em formato ShareGPT a partir de sessões de agente para geração de dados de treinamento.

→ [Trajectories & Training Format](./trajectory-format.md)

## Princípios de Design

| Princípio | O que significa na prática |
|-----------|--------------------------|
| **Estabilidade do prompt** | O system prompt não muda no meio da conversa. Nenhuma mutação que quebre o cache, exceto ações explícitas do usuário (`/model`). |
| **Execução observável** | Cada chamada de ferramenta é visível para o usuário via callbacks. Atualizações de progresso no CLI (spinner) e no gateway (mensagens de chat). |
| **Interruptível** | Chamadas de API e execução de ferramentas podem ser canceladas em pleno voo por entrada do usuário ou sinais. |
| **Núcleo agnóstico de plataforma** | Uma única classe AIAgent atende CLI, gateway, ACP, batch e API server. As diferenças de plataforma vivem no ponto de entrada, não no agente. |
| **Acoplamento fraco** | Subsistemas opcionais (MCP, plugins, provedores de memória, ambientes de RL) usam padrões de registry e gating por check_fn, não dependências rígidas. |
| **Isolamento de perfil** | Cada perfil (`work4you -p <name>`) recebe seu próprio WORK4YOU_HOME, configuração, memória, sessões e PID de gateway. Múltiplos perfis rodam simultaneamente. |

## Cadeia de Dependência de Arquivos

```text
tools/registry.py  (no deps — imported by all tool files)
       ↑
tools/*.py  (each calls registry.register() at import time)
       ↑
model_tools.py  (imports tools/registry + triggers tool discovery)
       ↑
run_agent.py, cli.py, batch_runner.py, environments/
```

Essa cadeia significa que o registro de ferramentas acontece no momento da importação, antes que qualquer instância de agente seja criada. Qualquer arquivo `tools/*.py` com uma chamada `registry.register()` de nível superior é descoberto automaticamente — nenhuma lista de importação manual é necessária.
