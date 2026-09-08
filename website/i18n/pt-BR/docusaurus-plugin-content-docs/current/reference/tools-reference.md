---
sidebar_position: 3
title: "Referência de Ferramentas Integradas"
description: "Referência oficial das ferramentas integradas do Work4You, agrupadas por conjunto de ferramentas"
---

# Referência de Ferramentas Integradas

Esta página documenta as ferramentas integradas do Work4You, agrupadas por conjunto de ferramentas (toolset). A disponibilidade varia conforme a plataforma, as credenciais e os conjuntos de ferramentas habilitados.

**Contagem rápida (registro atual):** ~84 ferramentas — 10 ferramentas de navegador (core) + 2 ferramentas de navegador protegidas por CDP, 4 ferramentas de arquivo, 4 ferramentas do Home Assistant, 2 ferramentas de terminal (`terminal`, `process`), 9 ferramentas de GUI de desktop (`read_terminal`, `close_terminal`, `open_preview`, `close_preview`, `read_preview`, `read_window_below`, `focus_pane`, `react_to_message`, `tour` — apenas em sessões do aplicativo desktop), 2 ferramentas web, 5 ferramentas do Feishu, 7 ferramentas do Spotify (registradas pelo plugin `spotify` empacotado), 5 ferramentas do Yuanbao, 12 ferramentas de kanban (registradas quando o dispatcher do kanban gera o agente), 3 ferramentas de projeto (sessões desktop/GUI), 2 ferramentas do Discord, 3 ferramentas de vídeo (`video_generate`, `xai_video_edit`, `xai_video_extend`) e um punhado de ferramentas independentes (`memory`, `clarify`, `delegate_task`, `execute_code`, `cronjob`, `session_search`, `skill_view`/`skill_manage`/`skills_list`, `text_to_speech`, `image_generate`, `vision_analyze`, `video_analyze`, `todo`, `computer_use`, `x_search`).

:::tip Ferramentas MCP
Além das ferramentas integradas, o Work4You pode carregar ferramentas dinamicamente a partir de servidores MCP. As ferramentas MCP aparecem com o prefixo `mcp__<server>__` (por exemplo, `mcp__github__create_issue` para o servidor MCP `github`). Veja [Integração MCP](/user-guide/features/mcp) para configuração.
:::

## Conjunto de ferramentas `browser`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `browser_back` | Navega de volta para a página anterior no histórico do navegador. Requer que browser_navigate tenha sido chamado antes. | — |
| `browser_click` | Clica em um elemento identificado pelo ID de referência do snapshot (por exemplo, '@e5'). Os IDs de referência aparecem entre colchetes na saída do snapshot. Requer que browser_navigate e browser_snapshot tenham sido chamados antes. | — |
| `browser_console` | Obtém a saída do console do navegador e erros de JavaScript da página atual. Retorna mensagens console.log/warn/error/info e exceções JS não tratadas. Use isso para detectar erros silenciosos de JavaScript, chamadas de API que falharam e avisos da aplicação. Requi… | — |
| `browser_get_images` | Obtém uma lista de todas as imagens da página atual com suas URLs e texto alternativo. Útil para encontrar imagens a analisar com a ferramenta de visão. Requer que browser_navigate tenha sido chamado antes. | — |
| `browser_navigate` | Navega para uma URL no navegador. Inicializa a sessão e carrega a página. Deve ser chamado antes de outras ferramentas de navegador. Para recuperação simples de informações, prefira web_search ou web_extract (mais rápidos e baratos). Use ferramentas de navegador quando você precisar… | — |
| `browser_press` | Pressiona uma tecla do teclado. Útil para enviar formulários (Enter), navegar (Tab) ou atalhos de teclado. Requer que browser_navigate tenha sido chamado antes. | — |
| `browser_scroll` | Rola a página em uma direção. Use isso para revelar mais conteúdo que pode estar abaixo ou acima da janela de visualização atual. Requer que browser_navigate tenha sido chamado antes. | — |
| `browser_snapshot` | Obtém um snapshot em texto da árvore de acessibilidade da página atual. Retorna elementos interativos com IDs de referência (como @e1, @e2) para browser_click e browser_type. full=false (padrão): visão compacta com elementos interativos. full=true: comp… | — |
| `browser_type` | Digita texto em um campo de entrada identificado pelo seu ID de referência. Limpa o campo primeiro, depois digita o novo texto. Requer que browser_navigate e browser_snapshot tenham sido chamados antes. | — |
| `browser_vision` | Tira uma captura de tela da página atual para que você possa inspecioná-la visualmente. Use isso quando precisar entender a aparência da página — especialmente para CAPTCHAs, desafios de verificação visual, layouts complexos, ou casos em que o snapshot de texto perde informações visuais importantes. Em modelos com visão nativa, a captura é anexada diretamente; caso contrário, recorre a um modelo de visão auxiliar… | — |

## Conjunto de ferramentas `browser` (ferramentas protegidas por CDP)

Essas duas ferramentas vivem no conjunto de ferramentas `browser`, mas só se registram quando um endpoint de Chrome DevTools Protocol está acessível no início da sessão — via `/browser connect`, configuração `browser.cdp_url`, uma sessão Browserbase, ou Camofox.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `browser_cdp` | Envia um comando bruto de Chrome DevTools Protocol. Válvula de escape para operações de navegador não cobertas pelas ferramentas `browser_*` de alto nível. Veja https://chromedevtools.github.io/devtools-protocol/ | Endpoint CDP |
| `browser_dialog` | Responde a um diálogo nativo de JavaScript (alert / confirm / prompt / beforeunload). Chame `browser_snapshot` primeiro — diálogos pendentes aparecem no campo `pending_dialogs`. Depois chame `browser_dialog(action='accept'\|'dismiss')`. | Endpoint CDP |

## Conjunto de ferramentas `clarify`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `clarify` | Faz uma pergunta ao usuário quando você precisa de esclarecimento, feedback ou uma decisão antes de prosseguir. Suporta três modos: 1. **Múltipla escolha de seleção única** — até 4 opções; o usuário escolhe uma ou digita sua própria resposta via uma 5ª opção "Outro". 2. **Múltipla escolha de seleção múltipla** — `multi_select=true` renderiza caixas de seleção e retorna uma lista das opções selecionadas. 3. **Aberta** — sem opções; o usuário digita uma resposta livre. As opções são ordenadas da melhor para a pior, então a primeira é rotulada `(Recomendado)` em todas as superfícies e é o destaque padrão; o rótulo é apenas de apresentação e é removido da resposta que o agente lê. Na CLI clássica, a seleção múltipla usa caixas de seleção alternadas com a barra de espaço; em plataformas de mensagens sem UI nativa de caixas de seleção, o usuário responde com números separados por vírgula/espaço (por exemplo, "1, 3") ou o texto da opção. | — |

### Fazendo várias perguntas de uma vez

A ferramenta `clarify` também aceita um array `questions` (2 a 5 perguntas independentes, cada uma com suas próprias `choices` e `multi_select`), para que o agente possa agrupar várias necessidades de esclarecimento em um único prompt em vez de perguntar sequencialmente. O resultado é um array `responses` na mesma ordem, com o `id` de cada pergunta (quando fornecido) ecoado de volta.

Comportamento por superfície:

- **Desktop** mostra todas as perguntas em um único card. As escolhas e respostas digitadas ficam preparadas localmente, e um único botão **Confirmar e continuar** (habilitado quando todas as perguntas tiverem resposta) envia o lote inteiro. As respostas preparadas permanecem editáveis até essa confirmação. Pular cancela o lote inteiro.
- **TUI e CLI** mostram uma lista de status compacta (`✓` respondida / `▸` ativa / `·` pendente) com apenas as opções da pergunta ativa expandidas. Enter trava a resposta ativa e pula para a próxima pergunta não respondida; Tab move entre perguntas para responder em qualquer ordem; Esc cancela o lote.
- **Plataformas de mensagens** (Telegram, Discord, …) recorrem a fazer as perguntas uma de cada vez através do prompt de pergunta única existente. Se o usuário parar de responder, as perguntas restantes não são enviadas.

Se o prompt expirar no meio do processo, as respostas que o usuário já travou são mantidas: o resultado da ferramenta as carrega junto com `"timed_out": true`, com as entradas não respondidas deixadas em branco, para que o agente possa distinguir uma omissão deliberada da ausência do usuário.

## Conjunto de ferramentas `code_execution`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `execute_code` | Executa um script Python que pode chamar ferramentas do Work4You programaticamente. Use isso quando precisar de 3+ chamadas de ferramentas com lógica de processamento entre elas, precisar filtrar/reduzir saídas grandes de ferramentas antes que entrem no seu contexto, precisar de ramificação condicional (… | — |

## Conjunto de ferramentas `cronjob`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `cronjob` | Gerenciador unificado de tarefas agendadas. Use `action="create"`, `"list"`, `"update"`, `"pause"`, `"resume"`, `"run"` ou `"remove"` para gerenciar tarefas. Suporta tarefas apoiadas por skills com uma ou mais skills anexadas, e `skills=[]` na atualização remove as skills anexadas. As execuções de cron acontecem em sessões novas, sem o contexto da conversa atual. | — |

## Conjunto de ferramentas `delegation`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `delegate_task` | Gera subagentes em contextos isolados; cada um tem sua própria conversa, sessão de terminal e conjunto de ferramentas, e apenas seu resumo final retorna para você. Forneça 'goal' para uma tarefa única ou 'tasks' para um lote paralelo (limites e regras de aninhamento… | — |

## Conjunto de ferramentas `feishu_doc`

Restrito ao manipulador de respostas inteligentes a comentários de documentos do Feishu (`gateway/platforms/feishu_comment.py`). Não exposto no `work4you-cli` nem no adaptador de chat regular do Feishu.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `feishu_doc_read` | Lê o conteúdo de texto completo de um documento Feishu/Lark (Docx, Doc ou Sheet) dado seu file_type e token. | Credenciais do app Feishu |

## Conjunto de ferramentas `feishu_drive`

Restrito ao manipulador de comentários de documentos do Feishu. Controla operações de leitura/escrita de comentários em arquivos do drive.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `feishu_drive_add_comment` | Adiciona um comentário de nível superior em um documento ou arquivo do Feishu/Lark. | Credenciais do app Feishu |
| `feishu_drive_list_comments` | Lista comentários de documento inteiro em um arquivo do Feishu/Lark, dos mais recentes primeiro. | Credenciais do app Feishu |
| `feishu_drive_list_comment_replies` | Lista as respostas em uma thread de comentário específica do Feishu (documento inteiro ou seleção local). | Credenciais do app Feishu |
| `feishu_drive_reply_comment` | Publica uma resposta em uma thread de comentário do Feishu, com menção `@` opcional. | Credenciais do app Feishu |

## Conjunto de ferramentas `file`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `patch` | Edições direcionadas de busca-e-substituição em arquivos. Use isso em vez de sed/awk no terminal. Usa correspondência aproximada (9 estratégias) para que pequenas diferenças de espaçamento/indentação não quebrem a operação. Retorna um diff unificado. Executa verificações de sintaxe automaticamente após editar… | — |
| `read_file` | Lê um arquivo de texto com números de linha e paginação. Use isso em vez de cat/head/tail no terminal. Formato de saída: 'LINE_NUM\|CONTENT'. Sugere nomes de arquivo semelhantes se não encontrado. Use offset e limit para arquivos grandes. Leituras que excedem ~100 mil caracteres são truncadas em um limite de linha e retornam um next_offset. Notebooks Jupyter (.ipynb), documentos Word (.docx) e planilhas Excel (.xlsx) a… | — |
| `search_files` | Busca conteúdo de arquivos ou localiza arquivos por nome. Use isso em vez de grep/rg/find/ls no terminal. Baseado em Ripgrep, mais rápido que os equivalentes de shell. Busca de conteúdo (target='content'): busca por regex dentro dos arquivos. Modos de saída: correspondências completas com linha… | — |
| `write_file` | Escreve conteúdo em um arquivo, substituindo completamente o conteúdo existente. Use isso em vez de echo/cat heredoc no terminal. Cria diretórios pai automaticamente. SOBRESCREVE o arquivo inteiro — use 'patch' para edições direcionadas. Executa verificações de sintaxe automaticamente em .py/.json/.yaml/.toml e outras linguagens com linting; apenas erros NOVOS introduzidos pela escrita são exibidos. | — |

## Conjunto de ferramentas `homeassistant`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `ha_call_service` | Chama um serviço do Home Assistant para controlar um dispositivo. Use ha_list_services para descobrir serviços disponíveis e seus parâmetros para cada domínio. | — |
| `ha_get_state` | Obtém o estado detalhado de uma única entidade do Home Assistant, incluindo todos os atributos (brilho, cor, ponto de ajuste de temperatura, leituras de sensor, etc.). | — |
| `ha_list_entities` | Lista entidades do Home Assistant. Opcionalmente filtra por domínio (light, switch, climate, sensor, binary_sensor, cover, fan, etc.) ou por nome de área (sala de estar, cozinha, quarto, etc.). | — |
| `ha_list_services` | Lista serviços (ações) disponíveis do Home Assistant para controle de dispositivos. Mostra quais ações podem ser executadas em cada tipo de dispositivo e quais parâmetros aceitam. Use isso para descobrir como controlar dispositivos encontrados via ha_list_entities. | — |

## Conjunto de ferramentas `computer_use`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `computer_use` | Controle de desktop em segundo plano via cua-driver — capturas de tela (SOM / vision / AX), clicar / arrastar / rolar / digitar / tecla / esperar, list_apps, focus_app. NÃO rouba o cursor ou o foco de teclado do usuário. Funciona com qualquer modelo capaz de usar ferramentas. macOS, Windows e Linux. | `cua-driver` no `$PATH` (instale via `work4you tools`). |


:::note
**Ferramentas Honcho** (`honcho_profile`, `honcho_search`, `honcho_context`, `honcho_reasoning`, `honcho_conclude`) não são mais integradas. Estão disponíveis via o plugin de provedor de memória Honcho em `plugins/memory/honcho/`. Veja [Provedores de Memória](../user-guide/features/memory-providers.md) para instalação e uso.
:::

## Conjunto de ferramentas `image_gen`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `image_generate` | Gera imagens a partir de prompts de texto (texto-para-imagem) ou edita/transforma uma imagem existente (imagem-para-imagem) via o backend configurado pelo usuário (FAL.ai, OpenAI, autenticação OpenAI Codex, xAI, Krea). Passe `image_url` para editar uma imagem e `reference_image_urls` para referências de estilo; omita ambos para texto-para-imagem. O modelo é configurado pelo usuário e não é selecionável pelo agente. Retorna uma única URL de imagem ou caminho local. | FAL_KEY / OPENAI_API_KEY / OAuth do Codex / OAuth do xAI / KREA_API_KEY |

## Conjunto de ferramentas `kanban`

Registrado quando o agente é (a) gerado pelo dispatcher do kanban (variável de ambiente `WORK4YOU_KANBAN_TASK` definida) ou (b) executado em um perfil que habilita explicitamente o conjunto de ferramentas `kanban`. Workers restritos a uma tarefa usam ferramentas de ciclo de vida para sua tarefa atribuída; perfis orquestradores adicionalmente recebem ferramentas de roteamento de quadro como `kanban_list` e `kanban_unblock`. Veja [Kanban Multi-Agente](/user-guide/features/kanban) para o fluxo de trabalho completo.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `kanban_show` | Mostra a tarefa kanban ativa atribuída a este worker (título, descrição, comentários, dependências). | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_list` | Lista as tarefas do quadro com filtros. Apenas para orquestrador; oculto de workers de tarefa gerados pelo dispatcher. | perfil com conjunto de ferramentas `kanban` |
| `kanban_complete` | Marca a tarefa atual como concluída com um payload de handoff estruturado (resultados, artefatos, follow-ups). | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_block` | Bloqueia a tarefa atual em uma pergunta para o usuário — o dispatcher pausa, exibe a pergunta e retoma assim que um humano responder. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_request_review` | Entrega a implementação a um revisor com `summary`, `metadata` estruturada opcional e um perfil de revisor opcional. Move a mesma tarefa para `review`; não é um bloqueio e não afeta a contagem de block-loop. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_request_changes` | Veredito do revisor para uma execução de revisão ativamente reivindicada. Encerra a execução de revisão, reaplica o gating do pai e roteia a tarefa de volta ao implementador original sem usar um bloqueio. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_heartbeat` | Envia um heartbeat de progresso durante uma operação de longa duração para que o dispatcher saiba que o worker ainda está ativo. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_comment` | Adiciona um comentário à thread da tarefa sem alterar seu estado — útil para expor descobertas intermediárias. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_create` | Gera tarefas-filhas a partir da tarefa atual. Usado por orquestradores e workers que geram follow-ups. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_link` | Vincula tarefas com uma aresta de dependência pai → filho. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_unblock` | Move uma tarefa bloqueada para `ready` quando todos os pais estão concluídos, ou `todo` enquanto algum pai permanecer aberto. Apenas para orquestrador; oculto de workers de tarefa gerados pelo dispatcher. | perfil com conjunto de ferramentas `kanban` |
| `kanban_attach` | Anexa um arquivo a uma tarefa passando seus bytes inline (base64). Armazenado como um anexo real no diretório de anexos da tarefa, limitado a 25 MB. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_attach_url` | Anexa um arquivo a uma tarefa por URL — o Work4You o baixa no lado do servidor e o armazena como um anexo real (limitado a 25 MB). Apenas URLs http/https. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |
| `kanban_attachments` | Lista os arquivos anexados a uma tarefa: id, nome do arquivo, tipo de conteúdo, tamanho, quem enviou e o caminho absoluto em disco. | `WORK4YOU_KANBAN_TASK` ou conjunto de ferramentas `kanban` |

## Conjunto de ferramentas `project`

Ferramentas para conduzir [Projects](../user-guide/cli.md) do desktop — espaços de trabalho nomeados e com múltiplas pastas. Registrado quando o conjunto de ferramentas `project` está habilitado (principalmente nas superfícies do aplicativo desktop / dashboard).

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `project_create` | Cria um Project de desktop (um espaço de trabalho nomeado) e muda este chat para ele. Passe `path` para ancorá-lo a um repositório/pasta. | — |
| `project_list` | Lista os Projects do desktop e qual está ativo. | — |
| `project_switch` | Muda este chat para um Project existente (por nome, slug ou id); move o espaço de trabalho da sessão para a pasta primária do projeto. | — |

## Conjunto de ferramentas `memory`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `memory` | Salva informações importantes na memória persistente que sobrevive entre sessões. Sua memória aparece no seu prompt de sistema no início da sessão -- é assim que você lembra coisas sobre o usuário e seu ambiente entre conversas. QUANDO SA… | — |

## Conjunto de ferramentas `session_search`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `session_search` | Busca em sessões passadas armazenadas no banco de dados de sessão local, ou percorre dentro de uma delas. Recuperação baseada em FTS5; retorna mensagens reais do banco de dados (sem chamadas de LLM). Quatro formatos: descoberta (passe `query`), rolagem (passe `session_id` + `around_message_id`), leitura (passe apenas `session_id`), navegação (sem argumentos). | — |

## Conjunto de ferramentas `skills`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `skill_manage` | Gerencia skills (criar, atualizar, excluir). As skills são sua memória procedural — abordagens reutilizáveis para tipos de tarefas recorrentes. Novas skills vão para ~/.work4you/skills/; skills existentes podem ser modificadas onde quer que estejam. Ações: create (SKILL.m completo… | — |
| `skill_view` | As skills permitem carregar informações sobre tarefas e fluxos de trabalho específicos, além de scripts e templates. Carrega o conteúdo completo de uma skill ou acessa seus arquivos vinculados (referências, templates, scripts). A primeira chamada retorna o conteúdo do SKILL.md mais um… | — |
| `skills_list` | Lista as skills disponíveis (nome + descrição). Use skill_view(name) para carregar o conteúdo completo. | — |

## Conjunto de ferramentas `terminal`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `process` | Gerencia processos em segundo plano iniciados com terminal(background=true). Ações: 'list' (mostrar todos), 'poll' (verificar status + nova saída), 'log' (saída completa com paginação), 'wait' (bloquear até terminar ou expirar), 'kill' (encerrar), 'write' (env… | — |
| `terminal` | Executa comandos de shell em um ambiente Linux. O sistema de arquivos persiste entre chamadas. Defina `background=true` para servidores de longa duração. Defina `notify_on_complete=true` (com `background=true`) para receber uma notificação automática quando o processo terminar — sem necessidade de polling. NÃO use cat/head/tail — use read_file. NÃO use grep/rg/find — use search_files. | — |

## Conjunto de ferramentas `desktop_ui`

Habilitado para sessões cuja origem é o aplicativo desktop do Work4You, em qualquer backend ao qual
esteja conectado (local, SSH, URL ou Work4You Cloud). Ausente na CLI, TUI,
mensageria e sessões de cron.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `read_terminal` | Lê o que está atualmente exibido no painel de terminal integrado da GUI de desktop do Work4You (o shell incorporado ao lado deste chat). | — |
| `close_terminal` | Fecha a aba de terminal somente leitura de um processo em segundo plano na GUI de desktop do Work4You. NÃO mata o processo — apenas descarta a aba/visualização; use process(action='kill') para pará-lo. | — |
| `open_preview` | Abre uma URL da web, URL de servidor de desenvolvimento local, ou caminho de arquivo no painel de pré-visualização ao lado do chat no aplicativo desktop do Work4You. | — |
| `close_preview` | Fecha o painel de pré-visualização ao lado do chat, ou uma aba dentro dele. Omita `url` para fechar o painel inteiro; passe uma URL ou caminho de arquivo para fechar aquela aba. | — |
| `read_preview` | Lê o que está atualmente exibido no painel de pré-visualização da GUI de desktop do Work4You — o texto da página do Browser integrado ao app (URL + título + texto renderizado, paginável com `start`/`count`), ou a identidade de uma aba de arquivo/artefato. | — |
| `read_window_below` | Identifica a janela do SO diretamente abaixo da janela de desktop do Work4You — nome do app, título, limites (apenas metadados, nunca pixels). No macOS, os títulos de outros apps só aparecem quando a Gravação de Tela já foi concedida; a ferramenta nunca solicita isso. | — |
| `focus_pane` | Revela e foca um painel no aplicativo desktop do Work4You (chat, arquivos, terminal, revisão, sessões). | — |
| `react_to_message` | Reage a uma mensagem com um único emoji, no estilo tapback do iMessage. Opcional via Configurações → Aparência (`display.message_reactions`). | — |
| `tour` | Dá um tour guiado ao vivo: escurece a tela, destaca um elemento e anexa um popover narrado (driver.js). Funciona na própria UI do app Work4You e em qualquer página aberta no painel de pré-visualização; `targets` descobre o que está na tela, `show` narra passo a passo, `start` entrega ao usuário controles de Próximo/Anterior. | — |

### Tours

A ferramenta `tour` descobre seus próprios alvos — chame `action='targets'` e ela retorna todo elemento endereçável na tela com um seletor, um rótulo e uma flag `stable`. Seletores estáveis se baseiam na identidade (`data-tour`, `id`, `data-testid`, `aria-label`) e sobrevivem a uma re-renderização; caminhos posicionais `nth-child` não sobrevivem, então os estáveis são ordenados primeiro e devem ser preferidos.

Para dar a um elemento um identificador durável próprio, marque-o assim:

```html
<div data-tour="composer">…</div>
```

Os identificadores são aplicados no **primitivo**, não no ponto de chamada, então uma única edição nomeia todas as instâncias. Os que já existem:

| Identificador | O que nomeia |
|---|---|
| `overlay-nav` | a navegação esquerda de qualquer overlay de rota (configurações, cron, perfis, agentes) |
| `nav-<id>` | uma linha nessa navegação — `nav-models`, `nav-appearance`, … |
| `field-<schemaKey>` | uma linha de configurações, pela sua chave de config — `field-model`, `field-provider`, … |
| `page-tabs` | as abas de filtro em qualquer página `PageSearchShell` (artefatos, skills, …) |
| `artifact-card` | um card de artefato na grade |

Ao adicionar uma superfície, marque seu primitivo compartilhado da mesma forma, em vez de marcar telas uma a uma — isso mantém o vocabulário do tour pequeno e evita que os seletores se deteriorem.

O mesmo motor alimenta tours curados (não-agente) no aplicativo desktop, para que um recurso possa lançar seu próprio walkthrough:

```ts
import { startTour, showTourStep, stopTour } from '@/lib/tour'

startTour([
  { selector: '[data-tour="composer"]', title: 'Composer', text: 'Digite aqui.' },
  { selector: '[data-tour="files"]', title: 'Arquivos', text: 'Navegue pelo seu projeto.' }
])
```

Um passo também pode mover o app para onde seu alvo vive, e o tour recoloca as coisas quando termina:

```ts
startTour([
  { navigate: '/artifacts', selector: '[data-tour="page-tabs"]', title: 'Filtros', text: '…' },
  { pane: 'sessions', selector: '[data-slot="sidebar"]', title: 'Sessões', text: '…' }
])
```

`navigate` recebe um caminho de rota e `pane` um nome de painel do desktop. Ambos são executados ao entrar no passo, alvos que montam tardiamente são aguardados, e fechar o tour — por qualquer via, incluindo Esc — retorna a onde ele começou.

Passe `'preview'` como segundo argumento para executar contra a página no painel de pré-visualização em vez do app.

## Conjunto de ferramentas `todo`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `todo` | Gerencia sua lista de tarefas para a sessão atual. Use para tarefas complexas com 3+ etapas ou quando o usuário fornecer múltiplas tarefas. Chame sem parâmetros para ler a lista atual. Escrita: - Forneça o array 'todos' para criar/atualizar itens - merge=… | — |

## Conjunto de ferramentas `vision`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `vision_analyze` | Analisa imagens usando IA de visão. Em modelos principais com capacidade de visão, retorna os pixels brutos da imagem como um resultado de ferramenta multimodal, para que o modelo os veja nativamente no seu próximo turno. Em modelos principais somente-texto, recorre a um modelo de visão auxiliar que descreve a imagem e retorna a descrição como texto. A assinatura da ferramenta é idêntica em ambos os casos. | — |

## Conjunto de ferramentas `video`

Conjunto de ferramentas opcional (não carregado no conjunto padrão `work4you-cli`). Adicione via `--toolsets video` ou inclua `video` na sua configuração `toolsets:`.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `video_analyze` | Analisa conteúdo de vídeo a partir de uma URL ou caminho de arquivo — legendas, divisões de cena, marcações de tempo importantes e descrições visuais. | — |

## Conjunto de ferramentas `video_gen`

Conjunto de ferramentas opcional (não carregado no conjunto padrão `work4you-cli`). Adicione via `--toolsets video_gen` ou habilite em `work4you tools` → Video Generation, o que também o guia na escolha de um backend.

Os backends são disponibilizados como plugins em `plugins/video_gen/<name>/`:

- **xAI Grok-Imagine** — texto-para-vídeo e imagem-para-vídeo (OAuth do SuperGrok ou `XAI_API_KEY`).
- **FAL.ai** — Veo 3.1, Pixverse v6, Kling O3 (requer `FAL_KEY`).

A ferramenta única `video_generate` cobre ambas as modalidades — passe `image_url` para animar uma imagem estática, omita para gerar apenas a partir de texto. O backend ativo é roteado automaticamente para o endpoint correto. A descrição da ferramenta é reconstruída no início da sessão para refletir as capacidades reais do backend ativo (modalidades, proporções de tela, resoluções, faixa de duração, número máximo de imagens de referência, suporte a áudio). Veja [Plugins de Provedor de Geração de Vídeo](/developer-guide/video-gen-provider-plugin) para criar backends.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `video_generate` | Gera um vídeo a partir de um prompt de texto (texto-para-vídeo) ou anima uma imagem estática (imagem-para-vídeo) usando o backend de geração de vídeo configurado pelo usuário. Passe `image_url` para animar essa imagem; omita para gerar apenas a partir de texto. O backend é roteado automaticamente para o endpoint correto. Retorna uma URL HTTP ou um caminho de arquivo absoluto no campo `video`. | Plugin `video_gen` ativo + sua credencial (por exemplo, `XAI_API_KEY`, `FAL_KEY`) |
| `xai_video_edit` | Edita um vídeo existente com o xAI Imagine. Específico do provedor (separado de `video_generate`). `video_url` deve ser a URL pública HTTPS de MP4 de um resultado anterior do Imagine. | Credenciais do xAI Imagine (OAuth do SuperGrok ou `XAI_API_KEY`) |
| `xai_video_extend` | Estende um vídeo existente com o xAI Imagine. Específico do provedor (separado de `video_generate`). `video_url` deve ser a URL pública HTTPS de MP4 de um resultado anterior do Imagine. | Credenciais do xAI Imagine (OAuth do SuperGrok ou `XAI_API_KEY`) |

## Conjunto de ferramentas `web`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `web_search` | Busca na web por informações. Retorna até 5 resultados por padrão, com títulos, URLs e descrições. Aceita um `limit` opcional (1-100, padrão 5). A consulta é passada ao backend configurado, então operadores como `site:domain`, `filetype:pdf`, `intitle:word`, `-term` e `"frase exata"` podem funcionar quando o backend os suportar. | EXA_API_KEY ou PARALLEL_API_KEY ou FIRECRAWL_API_KEY ou TAVILY_API_KEY |
| `web_extract` | Extrai conteúdo de URLs de páginas web. Retorna conteúdo limpo da página em markdown/texto (sem sumarização por LLM — rápido). Também funciona com URLs de PDF (artigos do arxiv, documentos) — passe o link do PDF diretamente. Páginas dentro do orçamento de caracteres (padrão 15000) retornam por inteiro; páginas maiores retornam uma janela de início+fim com um rodapé apontando para o texto completo salvo em disco. Máximo de 5 URLs por chamada. | EXA_API_KEY ou PARALLEL_API_KEY ou FIRECRAWL_API_KEY ou TAVILY_API_KEY |

## Conjunto de ferramentas `x_search`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `x_search` | Busca posts, perfis e threads no X (Twitter) usando a ferramenta integrada `x_search` do Responses da xAI. Descoberta pública somente leitura no X para discussões atuais, reações ou afirmações no X público (não páginas web em geral). Não publica, responde, curte, envia DM, faz upload de mídia, exclui ou inspeciona a conta autenticada do X — isso requer uma superfície de API do X autenticada separada (por exemplo, a skill `xurl`). Desativado por padrão — ative via `work4you tools` → 🐦 X (Twitter) Search. O schema só é registrado quando as credenciais da xAI estão configuradas (protegido por check_fn). | XAI_API_KEY **ou** login OAuth do xAI Grok (SuperGrok / Premium+) |

## Conjunto de ferramentas `tts`

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `text_to_speech` | Converte texto em áudio de fala. Retorna um caminho MEDIA: que a plataforma entrega como mensagem de voz. No Telegram toca como uma bolha de voz, no Discord/WhatsApp como um anexo de áudio. No modo CLI, salva em ~/voice-memos/. Voz e provedor… | — |

## Conjunto de ferramentas `discord`

Registrado no conjunto de ferramentas da plataforma `work4you-discord` (somente gateway). Usa o mesmo token de bot que o adaptador de mensagens.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `discord` | Lê e participa de um servidor Discord. As ações incluem `search_members`, `fetch_messages`, `send_message`, `react`, `fetch_channel`, `list_channels`, e mais. | `DISCORD_BOT_TOKEN` |

## Conjunto de ferramentas `discord_admin`

Registrado no conjunto de ferramentas da plataforma `work4you-discord`. Ações de moderação exigem que o bot tenha as permissões correspondentes no Discord.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `discord_admin` | Gerencia um servidor Discord via API REST: lista guilds/canais/cargos, cria/edita/exclui canais, gerencia concessões de cargo, timeouts, expulsões e banimentos. | `DISCORD_BOT_TOKEN` + permissões do bot |

## Conjunto de ferramentas `spotify`

Registrado pelo plugin `spotify` empacotado. Requer um token OAuth — execute `work4you auth spotify` uma vez para autorizar.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `spotify_playback` | Controla a reprodução do Spotify, inspeciona o estado de reprodução ativo, ou busca faixas tocadas recentemente. | OAuth do Spotify |
| `spotify_devices` | Lista dispositivos Spotify Connect ou transfere a reprodução para outro dispositivo. | OAuth do Spotify |
| `spotify_queue` | Inspeciona a fila do Spotify do usuário ou adiciona um item a ela. | OAuth do Spotify |
| `spotify_search` | Busca no catálogo do Spotify por faixas, álbuns, artistas, playlists, programas ou episódios. | OAuth do Spotify |
| `spotify_playlists` | Lista, inspeciona, cria, atualiza e modifica playlists do Spotify. | OAuth do Spotify |
| `spotify_albums` | Busca metadados de álbuns do Spotify ou faixas de álbuns. | OAuth do Spotify |
| `spotify_library` | Lista, salva ou remove as faixas ou álbuns salvos do usuário no Spotify. | OAuth do Spotify |

## Conjunto de ferramentas `work4you-yuanbao`

Registrado apenas no conjunto de ferramentas da plataforma `work4you-yuanbao`. Yuanbao é o aplicativo de chat da Tencent; essas ferramentas controlam suas APIs de DM/grupo/figurinhas.

| Ferramenta | Descrição | Requer ambiente |
|------|-------------|----------------------|
| `yb_query_group_info` | Consulta informações básicas sobre um grupo (chamado "派/Pai" no app): nome, dono, contagem de membros. | Credenciais do Yuanbao |
| `yb_query_group_members` | Consulta membros de um grupo (para menções `@`, encontrar um usuário por nome, listar bots). | Credenciais do Yuanbao |
| `yb_send_dm` | Envia uma mensagem privada/direta a um usuário em um grupo, com arquivos de mídia opcionais. | Credenciais do Yuanbao |
| `yb_search_sticker` | Busca no catálogo de figurinhas (TIM face) integrado do Yuanbao por palavra-chave. | Credenciais do Yuanbao |
| `yb_send_sticker` | Envia uma figurinha integrada para o chat atual do Yuanbao. | Credenciais do Yuanbao |

