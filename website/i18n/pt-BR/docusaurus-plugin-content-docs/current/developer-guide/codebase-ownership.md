---
title: "Codebase Ownership Map"
description: "Which directories belong to which subsystem, and where the right docs entry point lives for each"
---

# Mapa de Propriedade do Codebase

Work4You é um repositório grande, e a maioria das contribuições toca exatamente um subsistema. Esta página mapeia cada subsistema para seus diretórios de origem e o ponto de entrada da documentação que você deve ler antes de alterá-lo. Use-a para encontrar o documento inicial correto, o lugar certo para uma mudança e o diretório de testes correto (os testes espelham o código-fonte: código em `tools/` é testado em `tests/tools/`, plugins em `tests/plugins/<type>/`, e assim por diante).

| Subsistema | Diretórios de origem | Ponto de entrada da documentação |
|-----------|-------------------|------------------|
| Núcleo do agente (loop, transportes, compressão) | `agent/`, `run_agent.py` | [Agent Loop](agent-loop.md), [Context Compression & Caching](context-compression-and-caching.md) |
| Montagem de prompt | `agent/prompt_builder.py`, `agent/system_prompt.py` | [Prompt Assembly](prompt-assembly.md) |
| Provedores de modelo e transportes | `agent/transports/`, `plugins/model-providers/`, `work4you_cli/models.py` | [Adding Providers](adding-providers.md), [Model Provider Plugins](model-provider-plugin.md), [Provider Runtime](provider-runtime.md) |
| Ferramentas nativas | `tools/` | [Adding Tools](adding-tools.md), [Tools Runtime](tools-runtime.md) |
| Gateway de mensagens | `gateway/`, `plugins/platforms/` | [Gateway Internals](gateway-internals.md), [Adding Platform Adapters](adding-platform-adapters.md) |
| CLI | `work4you_cli/` | [Extending the CLI](extending-the-cli.md) |
| Sistema de plugins | `plugins/` | [Build a Work4You Plugin](plugins/index.md) |
| Skills (empacotadas e opcionais) | `skills/`, `optional-skills/` | [Creating Skills](creating-skills.md) |
| Cron / tarefas agendadas | `cron/` | [Cron Internals](cron-internals.md) |
| Armazenamento de sessão | `work4you_state.py` | [Session Storage](session-storage.md) |
| Pilha de navegador | `tools/browser_tool.py`, `tools/browser_supervisor.py`, `tools/browser_cdp_tool.py` | [Browser Supervisor](browser-supervisor.md) |
| Firewall de egress | `agent/proxy_sources/iron_proxy.py` | [Egress Internals](egress-internals.md) |
| ACP (integração com IDE) | `acp_adapter/` | [ACP Internals](acp-internals.md) |
| Aplicativo desktop | `apps/desktop/` | [Desktop Plugin SDK](desktop-plugin-sdk.md), [Worktree UI Development](worktree-ui-dev.md) |
| TUI | `ui-tui/`, `tui_gateway/` | [Worktree UI Development](worktree-ui-dev.md) |
| Site de documentação | `website/` | [Contributing](contributing.md) |
| Testes | `tests/`, `tests-js/` | [Contributing → Before Submitting](contributing.md#before-submitting) |

Algumas convenções que decorrem deste mapa:

- **As mudanças devem permanecer dentro do seu subsistema.** Um plugin que precisa editar arquivos do núcleo é um sinal de problema de design — em vez disso, amplie a superfície genérica de plugins (veja a rubrica de contribuição no `AGENTS.md` do repositório).
- **Execute o diretório de testes espelhado para cada diretório de origem que você tocar.** Uma mudança em `plugins/platforms/telegram/` precisa que `tests/plugins/platforms/` passe, não apenas o arquivo de teste que você lembrou de checar.
- **Quando dois subsistemas estão envolvidos, o mais restrito é o dono da mudança.** Prefira um ajuste em um adaptador ou plugin a um desvio no núcleo do agente; o núcleo é uma cintura estreita, e cada adição ali tem um custo pago em cada chamada de API.
