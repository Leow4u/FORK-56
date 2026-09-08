---
sidebar_position: 2
title: "ACP Internals"
description: "How the ACP adapter works: lifecycle, sessions, event bridge, approvals, and tool rendering"
---

# Internals do ACP

O adaptador ACP envolve o `AIAgent` síncrono do Work4You em um servidor stdio JSON-RPC assíncrono.

Arquivos de implementação principais:

- `acp_adapter/entry.py`
- `acp_adapter/server.py`
- `acp_adapter/session.py`
- `acp_adapter/events.py`
- `acp_adapter/permissions.py`
- `acp_adapter/tools.py`
- `acp_adapter/auth.py`

## Fluxo de inicialização

```text
work4you acp / work4you-acp / python -m acp_adapter
  -> acp_adapter.entry.main()
  -> parse --version / --check / --setup before server startup
  -> load ~/.work4you/.env
  -> configure stderr logging
  -> construct Work4YouACPAgent
  -> acp.run_agent(agent, use_unstable_protocol=True)
```

O stdout é reservado para o transporte JSON-RPC do ACP. Logs legíveis por humanos vão para o stderr.

## Componentes principais

### `Work4YouACPAgent`

`acp_adapter/server.py` implementa o protocolo de agente ACP.

Responsabilidades:

- initialize / authenticate
- métodos de sessão new/load/resume/fork/list/cancel
- execução de prompts
- troca de modelo por sessão
- conectar callbacks síncronos do AIAgent às notificações assíncronas do ACP

### `SessionManager`

`acp_adapter/session.py` rastreia as sessões ACP ativas.

Cada sessão armazena:

- `session_id`
- `agent`
- `cwd`
- `model`
- `history`
- `cancel_event`

O gerenciador é thread-safe e suporta:

- create
- get
- remove
- fork
- list
- cleanup
- atualizações de cwd

### Ponte de eventos

`acp_adapter/events.py` converte callbacks do AIAgent em eventos `session_update` do ACP.

Callbacks conectados:

- `tool_progress_callback`
- `thinking_callback` (atualmente definido como `None` na ponte ACP — o raciocínio é encaminhado através do `step_callback` em vez disso)
- `step_callback`

Como o `AIAgent` roda em uma thread worker enquanto o I/O do ACP vive no event loop principal, a ponte usa:

```python
asyncio.run_coroutine_threadsafe(...)
```

### Ponte de permissões

`acp_adapter/permissions.py` adapta os prompts de aprovação de terminal perigosos em requisições de permissão do ACP.

Mapeamento:

- `allow_once` -> Work4You `once`
- `allow_always` -> Work4You `always`
- opções de rejeição -> Work4You `deny`

Timeouts e falhas na ponte negam por padrão.

### Auxiliares de renderização de ferramentas

`acp_adapter/tools.py` mapeia as ferramentas do Work4You para os tipos de ferramenta do ACP e constrói conteúdo voltado para o editor.

Exemplos:

- `patch` / `write_file` -> diffs de arquivo
- `terminal` -> texto de comando de shell
- `read_file` / `search_files` -> pré-visualizações de texto
- resultados grandes -> blocos de texto truncados para segurança da UI

## Ciclo de vida da sessão

```text
new_session(cwd)
  -> create SessionState
  -> create AIAgent(platform="acp", enabled_toolsets=["work4you-acp"])
  -> bind task_id/session_id to cwd override

prompt(..., session_id)
  -> extract text from ACP content blocks
  -> reset cancel event
  -> install callbacks + approval bridge
  -> run AIAgent in ThreadPoolExecutor
  -> update session history
  -> emit final agent message chunk
```

### Cancelamento

`cancel(session_id)`:

- define o evento de cancelamento da sessão
- chama `agent.interrupt()` quando disponível
- faz a resposta do prompt retornar `stop_reason="cancelled"`

### Fork (bifurcação)

`fork_session()` copia profundamente o histórico de mensagens para uma nova sessão ativa, preservando o estado da conversa enquanto dá ao fork seu próprio ID de sessão e cwd.

## Comportamento de provedor/autenticação

O ACP não implementa seu próprio armazenamento de autenticação.

Em vez disso, ele reutiliza o resolvedor de runtime do Work4You:

- `acp_adapter/auth.py`
- `work4you_cli/runtime_provider.py`

Assim, o ACP anuncia e usa o provedor/credenciais do Work4You configurados no momento. Ele também sempre anuncia um método de autenticação de configuração via terminal (`work4you-setup`, argumentos `--setup`) para que clientes ACP de primeira execução possam abrir a configuração interativa de modelo/provedor do Work4You antes de iniciar uma sessão ACP normal.

## Vínculo com o diretório de trabalho

Sessões ACP carregam um cwd do editor.

O gerenciador de sessões vincula esse cwd ao ID da sessão ACP por meio de sobreposições de terminal/arquivo com escopo de tarefa, de modo que as ferramentas de arquivo e terminal operem em relação ao workspace do editor.

## Chamadas de ferramenta duplicadas com o mesmo nome

A ponte de eventos rastreia IDs de ferramenta em FIFO por nome de ferramenta, não apenas um ID por nome. Isso é importante para:

- chamadas paralelas com o mesmo nome
- chamadas repetidas com o mesmo nome em um único passo

Sem filas FIFO, os eventos de conclusão se anexariam à invocação de ferramenta errada.

## Restauração do callback de aprovação

O ACP instala temporariamente um callback de aprovação na ferramenta de terminal durante a execução do prompt, e depois restaura o callback anterior. Isso evita deixar handlers de aprovação específicos da sessão ACP instalados globalmente para sempre.

## Limitações atuais

- Sessões ACP são persistidas no `~/.work4you/state.db` compartilhado (SessionDB) e restauradas de forma transparente entre reinícios do processo; elas aparecem em `session_search`
- blocos de prompt que não são texto são atualmente ignorados na extração de texto da requisição
- a UX específica do editor varia conforme a implementação do cliente ACP

## Arquivos relacionados

- `tests/acp/` — suíte de testes do ACP
- `toolsets.py` — definição do toolset `work4you-acp`
- `work4you_cli/main.py` — subcomando de CLI `work4you acp`
- `pyproject.toml` — dependência opcional `[acp]` + script `work4you-acp`
