---
sidebar_position: 4
title: "Toolsets Reference"
description: "Referência para os toolsets core, compostos, de plataforma e dinâmicos do Work4You"
---

# Toolsets Reference

Toolsets são pacotes nomeados de ferramentas que controlam o que o agente pode fazer. Eles são o mecanismo principal para configurar a disponibilidade de ferramentas por plataforma, por sessão ou por tarefa.

## Como os Toolsets funcionam

Cada ferramenta pertence a exatamente um toolset. Ao habilitar um toolset, todas as ferramentas desse pacote ficam disponíveis para o agente. Os toolsets vêm em três tipos:

- **Core** — Um único grupo lógico de ferramentas relacionadas (por exemplo, `file` reúne `read_file`, `write_file`, `patch`, `search_files`)
- **Composite** — Combina múltiplos toolsets core para um cenário comum (por exemplo, `debugging` reúne ferramentas de arquivo, terminal e web)
- **Platform** — Uma configuração completa de ferramentas para um contexto de implantação específico (por exemplo, `work4you-cli` é o padrão para sessões interativas de CLI)

## Configurando Toolsets

### Por sessão (CLI)

```bash
work4you chat --toolsets web,file,terminal
work4you chat --toolsets debugging        # composite — expande para file + terminal + web
work4you chat --toolsets all              # tudo
```

### Por plataforma (config.yaml)

```yaml
toolsets:
  - work4you-cli          # padrão para CLI
  # - work4you-telegram   # sobrescrita para o gateway do Telegram
```

### Gerenciamento interativo

```bash
work4you tools                            # UI em modo texto (curses) para habilitar/desabilitar por plataforma
```

Ou dentro da sessão:

```
/tools list
/tools disable browser
/tools enable homeassistant
```

## Core Toolsets

| Toolset | Ferramentas | Finalidade |
|---------|-------|---------|
| `browser` | `browser_back`, `browser_cdp`, `browser_click`, `browser_console`, `browser_dialog`, `browser_get_images`, `browser_navigate`, `browser_press`, `browser_scroll`, `browser_snapshot`, `browser_type`, `browser_vision`, `web_search` | Automação de navegador principal. Inclui `web_search` como alternativa para buscas rápidas. `browser_cdp` e `browser_dialog` são habilitados em tempo de execução — registrados apenas quando um endpoint CDP está acessível no início da sessão (via `/browser connect`, config `browser.cdp_url`, Browserbase ou Camofox). `browser_dialog` funciona em conjunto com os campos `pending_dialogs` e `frame_tree` que `browser_snapshot` adiciona quando um supervisor CDP está conectado. |
| `clarify` | `clarify` | Faz uma pergunta ao usuário quando o agente precisa de esclarecimento. |
| `code_execution` | `execute_code` | Executa scripts Python que chamam ferramentas do Work4You de forma programática. |
| `coding` | composite (`file` + `terminal` + `search` + `web` + `skills` + `browser` + `todo` + `memory` + `session_search` + `clarify` + `code_execution` + `delegation` + `vision`) | Pacote voltado para codificação em trabalho de software: edição de arquivos, terminal, busca, documentação web, skills, navegador, delegação e execução de código. |
| `cronjob` | `cronjob` | Agenda e gerencia tarefas recorrentes. |
| `debugging` | composite (`file` + `terminal` + `web`) | Pacote de depuração — arquivo, processo/terminal, extração/busca web. |
| `delegation` | `delegate_task` | Cria instâncias isoladas de subagentes para trabalho em paralelo. |
| `discord` | `discord` | Ações de texto/embed/DM do Discord principal (somente gateway). Ativo no toolset `work4you-discord`. |
| `discord_admin` | `discord_admin` | Moderação do Discord (banimentos, mudanças de cargo, gerenciamento de canais). Ativo no toolset `work4you-discord`; exige que o bot tenha as permissões relevantes do Discord. |
| `feishu_doc` | `feishu_doc_read` | Lê o conteúdo de documentos do Feishu/Lark. Usado pelo manipulador de resposta inteligente a comentários em documentos do Feishu. |
| `feishu_drive` | `feishu_drive_add_comment`, `feishu_drive_list_comments`, `feishu_drive_list_comment_replies`, `feishu_drive_reply_comment` | Operações de comentários no drive do Feishu/Lark. Restrito ao agente de comentários; não exposto no `work4you-cli` nem em outros toolsets de mensageria. |
| `file` | `patch`, `read_file`, `search_files`, `write_file` | Leitura, escrita, busca e edição de arquivos. |
| `homeassistant` | `ha_call_service`, `ha_get_state`, `ha_list_entities`, `ha_list_services` | Controle de casa inteligente via Home Assistant. Disponível apenas quando `HASS_TOKEN` está definido. |
| `computer_use` | `computer_use` | Controle de desktop em segundo plano via cua-driver — não rouba o cursor/foco. Funciona com qualquer modelo capaz de usar ferramentas. macOS, Windows e Linux; requer `cua-driver` no `$PATH`. |
| `context_engine` | (variável) | Ferramentas em tempo de execução expostas pelo plugin de context-engine ativo (vazio até que um plugin o preencha). |
| `image_gen` | `image_generate` | Geração de texto para imagem via FAL.ai (com backends opcionais OpenAI / xAI). |
| `video_gen` | `video_generate`, `xai_video_edit`, `xai_video_extend` | Texto para vídeo e imagem para vídeo via backends registrados por plugin (xAI Grok-Imagine, FAL.ai Veo 3.1 / Pixverse v6 / Kling O3). Passe `image_url` para animar uma imagem; omita para texto-para-vídeo. `xai_video_edit` / `xai_video_extend` são ferramentas específicas do provedor para edição/extensão, habilitadas com credenciais do xAI Imagine. |
| `kanban` | `kanban_attach`, `kanban_attach_url`, `kanban_attachments`, `kanban_block`, `kanban_comment`, `kanban_complete`, `kanban_create`, `kanban_heartbeat`, `kanban_link`, `kanban_list`, `kanban_request_changes`, `kanban_request_review`, `kanban_show`, `kanban_unblock` | Ferramentas de coordenação multiagente. Registradas para workers de tarefas gerados pelo dispatcher (`WORK4YOU_KANBAN_TASK`) e para perfis que listam explicitamente o toolset `kanban` pelo nome (o curinga `all`/`*` **não** o habilita). Os workers marcam tarefas como concluídas, solicitam revisão formal, bloqueiam, enviam heartbeat, comentam e criam/vinculam tarefas de acompanhamento; perfis orquestradores recebem adicionalmente ferramentas de roteamento de quadro como list/unblock. Filhos de `delegate_task` não são donos de execução no Kanban: seu esquema remove/desabilita este toolset e as proteções em tempo de execução rejeitam mutações diretas no quadro, mesmo que as variáveis de ambiente `WORK4YOU_KANBAN_*` do pai estejam presentes. |
| `memory` | `memory` | Gerenciamento de memória persistente entre sessões. |
| `desktop_ui` | `close_preview`, `close_terminal`, `focus_pane`, `open_preview`, `react_to_message`, `read_preview`, `read_terminal`, `read_window_below`, `tour` | Recursos que atuam sobre o próprio aplicativo desktop do Work4You — ler/fechar o painel de terminal embutido, abrir/ler/fechar o navegador integrado, identificar a janela do sistema operacional por trás do aplicativo, revelar um painel, reagir a uma mensagem, executar um tour guiado (destacar + narrar elementos da interface no aplicativo ou no painel de pré-visualização). Habilitado para sessões cuja origem é o aplicativo desktop, seja qual for o backend ao qual está conectado (local, SSH, URL ou Work4You Cloud). Nunca presente em CLI, TUI, mensageria ou sessões de cron. |
| `project` | `project_create`, `project_list`, `project_switch` | Cria e alterna entre [Projects](../user-guide/cli.md) do desktop (espaços de trabalho nomeados com múltiplas pastas). Somente sessões GUI / desktop. |
| `safe` | `image_generate`, `vision_analyze`, `web_extract`, `web_search` (via `includes`) | Pesquisa somente leitura + geração de mídia. Sem escrita de arquivos, sem terminal, sem execução de código. |
| `search` | `web_search` | Somente busca web (sem extração). |
| `session_search` | `session_search` | Busca em sessões de conversas anteriores. |
| `skills` | `skill_manage`, `skill_view`, `skills_list` | CRUD e navegação de skills. |
| `spotify` | `spotify_albums`, `spotify_devices`, `spotify_library`, `spotify_playback`, `spotify_playlists`, `spotify_queue`, `spotify_search` | Controle nativo do Spotify (reprodução, fila, busca, playlists, álbuns, biblioteca). Registrado pelo plugin `spotify` empacotado. |
| `terminal` | `process`, `terminal` | Execução de comandos de shell e gerenciamento de processos em segundo plano. |
| `todo` | `todo` | Gerenciamento de lista de tarefas dentro de uma sessão. |
| `tts` | `text_to_speech` | Geração de áudio a partir de texto (text-to-speech). |
| `vision` | `vision_analyze` | Análise de imagens via modelos com capacidade de visão. |
| `video` | `video_analyze` | Ferramentas de análise e compreensão de vídeo (opt-in, não incluído no toolset padrão — adicione explicitamente via `--toolsets`). |
| `web` | `web_extract`, `web_search` | Busca web e extração de conteúdo de páginas. |
| `x_search` | `x_search` | Descoberta pública somente leitura no X via a ferramenta `x_search` integrada das Responses do xAI. Use a skill `xurl` para leituras autenticadas na API do X e ações de conta. Desativado por padrão; habilite via `work4you tools`. O esquema só é registrado quando há credenciais do xAI configuradas (OAuth do SuperGrok ou `XAI_API_KEY`). |
| `yuanbao` | `yb_query_group_info`, `yb_query_group_members`, `yb_search_sticker`, `yb_send_dm`, `yb_send_sticker` | Ações de DM/grupo do Yuanbao e busca de figurinhas. Registrado apenas em `work4you-yuanbao`. |

## Platform Toolsets

Toolsets de plataforma definem a configuração completa de ferramentas para um destino de implantação. A maioria das plataformas de mensageria usa o mesmo conjunto que `work4you-cli`:

| Toolset | Diferenças em relação a `work4you-cli` |
|---------|-------------------------------|
| `work4you-cli` | Toolset completo — o padrão para sessões interativas de CLI. Inclui file, terminal, web, browser, memory, skills, vision, image_gen, todo, tts, delegation, code_execution, cronjob, session_search, clarify, computer_use, Home Assistant e as ferramentas de kanban (todas habilitadas em tempo de execução via check_fn). |
| `work4you-acp` | Remove `clarify`, `cronjob`, `image_generate`, `text_to_speech`, `computer_use`, as quatro ferramentas do Home Assistant e as ferramentas de kanban. Focado em tarefas de codificação em contexto de IDE. |
| `work4you-api-server` | Remove `clarify`, `text_to_speech`, `computer_use` e as ferramentas de kanban. Mantém todo o resto — adequado para acesso programático onde a interação com o usuário não é possível. |
| `work4you-cron` | Igual a `work4you-cli`. |
| `work4you-telegram` | Igual a `work4you-cli`. |
| `work4you-discord` | Adiciona `discord` e `discord_admin` sobre `work4you-cli`. |
| `work4you-slack` | Igual a `work4you-cli`. |
| `work4you-whatsapp` | Igual a `work4you-cli`. |
| `work4you-signal` | Igual a `work4you-cli`. |
| `work4you-matrix` | Igual a `work4you-cli`. |
| `work4you-mattermost` | Igual a `work4you-cli`. |
| `work4you-email` | Igual a `work4you-cli`. |
| `work4you-sms` | Igual a `work4you-cli`. |
| `work4you-bluebubbles` | Igual a `work4you-cli`. |
| `work4you-dingtalk` | Igual a `work4you-cli`. |
| `work4you-feishu` | Adiciona as cinco ferramentas `feishu_doc_*` / `feishu_drive_*` (usadas apenas pelo manipulador de comentários em documentos, não pelo adaptador de chat regular). |
| `work4you-qqbot` | Igual a `work4you-cli`. |
| `work4you-wecom` | Igual a `work4you-cli`. |
| `work4you-wecom-callback` | Igual a `work4you-cli`. |
| `work4you-weixin` | Igual a `work4you-cli`. |
| `work4you-yuanbao` | Adiciona as cinco ferramentas `yb_*` (DM/grupo/figurinha) sobre `work4you-cli`. |
| `work4you-homeassistant` | Igual a `work4you-cli` (as ferramentas do Home Assistant já estão presentes por padrão e são ativadas quando `HASS_TOKEN` está definido). |
| `work4you-webhook` | Subconjunto seguro e restrito — apenas `web_search`, `web_extract`, `vision_analyze` e `clarify`. Execuções disparadas por webhook não têm acesso a terminal, arquivos ou navegador. |
| `work4you-gateway` | Toolset orquestrador interno do gateway — união de todos os toolsets `work4you-<platform>`; usado quando o gateway precisa aceitar qualquer origem de mensagem. |

## Dynamic Toolsets

### Toolsets de servidor MCP

Cada servidor MCP configurado gera um toolset `mcp-<server>` em tempo de execução. Por exemplo, se você configurar um servidor MCP `github`, um toolset `mcp-github` é criado contendo todas as ferramentas que esse servidor expõe.

```yaml
# config.yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
```

Isso cria um toolset `mcp-github` que você pode referenciar em `--toolsets` ou em configurações de plataforma.

### Toolsets de plugin

Plugins podem registrar seus próprios toolsets via `ctx.register_tool()` durante a inicialização do plugin. Eles aparecem junto com os toolsets integrados e podem ser habilitados/desabilitados da mesma forma.

### Toolsets personalizados

Defina toolsets personalizados em `config.yaml` para criar pacotes específicos do projeto:

```yaml
toolsets:
  - work4you-cli
custom_toolsets:
  data-science:
    - file
    - terminal
    - code_execution
    - web
    - vision
```

### Curingas

- `all` ou `*` — expande para todo toolset registrado (integrado + dinâmico + plugin)

Algumas ferramentas têm uma verificação de disponibilidade adicional além da associação a um toolset e **não** são ativadas apenas por `all`/`*`:

- Ferramentas **com restrição de capacidade** (browser, `computer_use`, `code_execution`, Feishu, Home Assistant, cronjob) aparecem apenas quando o pré-requisito de backend/credencial correspondente está configurado.
- Ferramentas **com restrição de fluxo de trabalho** — o toolset `kanban` — são deliberadamente opt-in. `all`/`*` **não** habilita o kanban; você precisa listar `kanban` explicitamente (ou ser um worker gerado pelo dispatcher com `WORK4YOU_KANBAN_TASK` definido). As ferramentas de kanban alteram o estado compartilhado do quadro, então permanecem desativadas por padrão mesmo sob `all`.

## Relação com `work4you tools`

O comando `work4you tools` fornece uma interface em modo texto (curses) para ativar ou desativar ferramentas individuais por plataforma. Isso opera no nível da ferramenta (mais granular que os toolsets) e é persistido em `config.yaml`. Ferramentas desabilitadas são filtradas mesmo que seu toolset esteja habilitado.

Veja também: [Tools Reference](./tools-reference.md) para a lista completa de ferramentas individuais e seus parâmetros.
