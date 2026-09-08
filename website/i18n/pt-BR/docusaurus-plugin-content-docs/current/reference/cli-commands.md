---
sidebar_position: 1
title: "Referência de Comandos da CLI"
description: "Referência oficial para os comandos de terminal do Work4You e famílias de comandos"
---

# Referência de Comandos da CLI

Esta página cobre os **comandos de terminal** que você executa no seu shell.

Para os slash commands usados dentro do chat, consulte a [Referência de Slash Commands](./slash-commands.md).

## Ponto de entrada global

```bash
work4you [global-options] <command> [subcommand/options]
```

### Opções globais

| Opção | Descrição |
|--------|-------------|
| `--version`, `-V` | Mostra a versão e encerra. |
| `--profile <name>`, `-p <name>` | Seleciona qual perfil do Work4You usar nesta invocação. Sobrepõe o padrão persistente definido por `work4you profile use`. |
| `--resume <session>`, `-r <session>` | Retoma uma sessão anterior pelo ID ou título. A palavra-chave `latest` retoma a sessão mais recente (com escopo no workspace, mesma busca usada por `-c`). |
| `--continue [name]`, `-c [name]` | Retoma a sessão mais recente, ou a sessão mais recente que corresponda a um título. |
| `--in <dir>` | Muda para `<dir>` antes de iniciar ou retomar. Restringe as buscas de `--resume latest` / `-c` ao workspace desse diretório e mantém a sessão lá (ignora a restauração do cwd registrado). |
| `--worktree`, `-w` | Inicia em um git worktree isolado para fluxos de trabalho com agentes em paralelo. |
| `--yolo` | Ignora os prompts de aprovação para comandos perigosos. |
| `--pass-session-id` | Inclui o ID da sessão no system prompt do agente. |
| `--ignore-user-config` | Ignora `~/.work4you/config.yaml` e usa os padrões internos. As credenciais em `.env` continuam sendo carregadas. |
| `--ignore-rules` | Pula a injeção automática de `AGENTS.md`, `SOUL.md`, `.cursorrules`, memória e skills pré-carregadas. |
| `--tui` | Inicia a [TUI](../user-guide/tui.md) em vez da CLI clássica. Equivalente a `WORK4YOU_TUI=1`. Sempre tem prioridade sobre `display.interface`. |
| `--cli` | Força o REPL clássico baseado no prompt_toolkit. Use para sobrepor `display.interface: tui` em uma única invocação. |
| `--dev` | Com `--tui`: executa os fontes TypeScript diretamente via `tsx` em vez do bundle pré-compilado (para contribuidores da TUI). |

## Comandos de nível superior

| Comando | Finalidade |
|---------|-------------|
| `work4you chat` | Chat interativo ou de disparo único com o agente. |
| `work4you model` | Escolhe interativamente o provedor e o modelo padrão. |
| `work4you moa` | Configura presets nomeados de Mixture of Agents selecionáveis no seletor de modelo. |
| `work4you fallback` | Gerencia os provedores de fallback tentados quando o modelo principal falha. |
| `work4you gateway` | Executa ou gerencia o serviço de gateway de mensagens. |
| `work4you proxy` | Proxy local compatível com OpenAI que anexa credenciais OAuth de provedor. Veja [Subscription Proxy](../user-guide/features/subscription-proxy.md). |
| `work4you egress` | Firewall de injeção de credenciais de saída para sandboxes de terminal remotas (iron-proxy). Desativado por padrão. Veja [Egress proxy](../user-guide/egress/iron-proxy.md). |
| `work4you lsp` | Gerencia a integração com o Language Server Protocol (diagnósticos semânticos para write_file/patch). |
| `work4you setup` | Assistente de configuração interativo para toda ou parte da configuração. |
| `work4you whatsapp` | Configura e pareia a ponte do WhatsApp. |
| `work4you whatsapp-cloud` | Configura o adaptador oficial da Meta WhatsApp Business Cloud API (requer conta Business + webhook público). Diferente de `work4you whatsapp` (ponte Baileys de conta pessoal). |
| `work4you slack` | Utilitários do Slack (atualmente: gera o manifesto do app com cada comando como um slash nativo). |
| `work4you auth` | Gerencia credenciais — adicionar, listar, remover, resetar, status, logout. Trata os fluxos OAuth do Codex/Work4You/Anthropic. |
| `work4you login` / `logout` | **Descontinuado** — use `work4you auth` em vez disso. |
| `work4you send` | Envia uma mensagem de disparo único para uma plataforma de mensagens configurada (Telegram, Discord, Slack, Signal, SMS, …). Útil em scripts de shell, jobs de cron, hooks de CI e daemons de monitoramento — sem loop de agente, sem LLM. |
| `work4you peer` | Registra gateways Work4You pares em outras máquinas e envia DMs para o Bot Chat canônico de seus agentes (`work4you peer dm <peer>[/<agent>] "…"`). O transporte por trás da mensageria bot-a-bot entre máquinas. |
| `work4you secrets` | Gerencia fontes externas de segredos (atualmente Bitwarden Secrets Manager) para buscar chaves de API na inicialização do processo em vez de a partir de `~/.work4you/.env`. |
| `work4you migrate` | Diagnostica e (opcionalmente) reescreve `config.yaml` para substituir referências a modelos retirados ou configurações descontinuadas (ex.: `migrate xai`). |
| `work4you status` | Mostra o status do agente, da autenticação e da plataforma. |
| `work4you cron` | Inspeciona e executa um tick do agendador cron. |
| `work4you kanban` | Quadro de colaboração multiperfil (tarefas, links, despachante). |
| `work4you project` | Gerencia workspaces nomeados e com múltiplas pastas (projetos). Ancora o agrupamento de sessões no desktop e, quando vinculado a um quadro kanban, dá às tarefas uma convenção determinística de worktree + branch. O estado é por perfil. |
| `work4you webhook` | Gerencia assinaturas de webhooks dinâmicos para ativação orientada a eventos. |
| `work4you hooks` | Inspeciona, aprova ou remove hooks em shell script declarados em `config.yaml`. |
| `work4you doctor` | Diagnostica problemas de configuração e dependências. |
| `work4you security audit` | Auditoria de cadeia de suprimentos sob demanda (OSV.dev) para o venv, requisitos de plugins e servidores MCP fixados. |
| `work4you approvals` | Ferramentas de prompt de aprovação — extrai propostas de allowlist a partir do histórico de aprovações. |
| `work4you dump` | Resumo de configuração pronto para copiar e colar, para suporte/depuração. |
| `work4you prompt-size` | Mostra uma discriminação em bytes do system prompt + schemas de ferramentas (índice de skills, memória, perfil). Roda offline. |
| `work4you debug` | Ferramentas de depuração — envia logs e informações do sistema para suporte. |
| `work4you backup` | Faz backup do diretório home do Work4You em um arquivo zip. |
| `work4you checkpoints` | Inspeciona / limpa / apaga `~/.work4you/checkpoints/` (o repositório sombra usado por `/rollback`). Execute sem argumentos para uma visão geral de status. |
| `work4you import` | Restaura um backup do Work4You a partir de um arquivo zip. |
| `work4you logs` | Visualiza, acompanha em tempo real e filtra arquivos de log do agente/gateway/erros. |
| `work4you config` | Mostra, edita, migra e consulta arquivos de configuração. |
| `work4you skin` | Lista, alterna e ajusta os skins de exibição. |
| `work4you console` | Abre o console seguro de comandos do Work4You. |
| `work4you pairing` | Aprova ou revoga códigos de pareamento de mensagens. |
| `work4you skills` | Navega, instala, publica, audita e configura skills. |
| `work4you bundles` | Agrupa várias skills sob um único slash command `/<name>`. Veja [Skill Bundles](../user-guide/features/skills.md#skill-bundles). |
| `work4you curator` | Manutenção de skills em segundo plano — status, run, pause, pin. Veja [Curator](../user-guide/features/curator.md). |
| `work4you journey` (aliases `learning`, `memory-graph`) | Linha do tempo de skills e memórias aprendidas ao longo do tempo. |
| `work4you memory` | Configura o provedor de memória externo. Subcomandos específicos de provedor (ex.: `work4you honcho`) são registrados automaticamente quando o respectivo provedor está ativo. |
| `work4you acp` | Executa o Work4You como um servidor ACP para integração com editores. |
| `work4you mcp` | Gerencia configurações de servidores MCP e executa o Work4You como um servidor MCP. |
| `work4you plugins` | Gerencia plugins do Work4You (instalar, ativar, desativar, remover). |
| `work4you portal` | Status do Work4You Portal, link de assinatura e roteamento do Tool Gateway. Veja [Tool Gateway](../user-guide/features/tool-gateway.md). |
| `work4you tools` | Configura as ferramentas ativas por plataforma. |
| `work4you computer-use` | Instala ou verifica o backend Computer Use (cua-driver) (macOS/Windows/Linux). |
| `work4you pets` | Navega, instala e seleciona [petdex](../user-guide/features/pets.md), os bichinhos animados exibidos na CLI, TUI e no app desktop. Subcomandos: `list`, `install`, `select`, `show`, `off`, `scale`, `remove`, `doctor`. |
| `work4you sessions` | Navega, exporta, limpa, renomeia e apaga sessões. |
| `work4you insights` | Mostra análises de tokens/custo/atividade. |
| `work4you claw` | Utilitários de migração do OpenClaw. |
| `work4you import-agent` | Importa uma configuração do Claude Code (`~/.claude`) ou do Codex CLI (`~/.codex`). |
| `work4you dashboard` | Inicia o dashboard web para gerenciar configuração, chaves de API e sessões. |
| `work4you serve` | Inicia o servidor backend do Work4You (headless; alimenta o app desktop e backends remotos). |
| `work4you desktop` (alias `gui`) | Compila e inicia o app desktop nativo em Electron. |
| `work4you profile` | Gerencia perfis — múltiplas instâncias isoladas do Work4You. |
| `work4you completion` | Imprime scripts de autocompletar do shell (bash/zsh/fish). |
| `work4you version` | Mostra informações de versão. |
| `work4you update` | Busca o código mais recente e reinstala as dependências. `--check` mostra uma prévia sem instalar; `--backup` faz um snapshot do `WORK4YOU_HOME` antes do pull. |
| `work4you uninstall` | Remove o Work4You do sistema. |

## `work4you chat`

```bash
work4you chat [options]
```

Opções comuns:

| Opção | Descrição |
|--------|-------------|
| `-q`, `--query "..."` | Prompt não interativo de disparo único. |
| `--query-file PATH` | Lê o prompt de disparo único a partir de um arquivo (`-` = stdin). Nada é interpretado pelo shell, então aspas, `$(...)` e crases chegam literalmente — use isso para corpos de mensagem programáticos ou não confiáveis (DMs de teammates do Bot Mode usam isso). Mutuamente exclusivo com `-q`. |
| `-m`, `--model <model>` | Sobrepõe o modelo para esta execução. |
| `-t`, `--toolsets <csv>` | Ativa um conjunto de toolsets separados por vírgula. |
| `--provider <provider>` | Força um provedor: `auto`, `openrouter`, `work4you`, `openai-codex`, `copilot-acp`, `copilot`, `anthropic`, `gemini`, `huggingface`, `novita` (aliases `novita-ai`, `novitaai`), `openai-api`, `zai`, `kimi-coding`, `kimi-coding-cn`, `minimax`, `minimax-cn`, `minimax-oauth`, `kilocode`, `xiaomi`, `arcee`, `gmi`, `upstage` (alias `solar`), `alibaba`, `alibaba-coding-plan` (alias `alibaba_coding`), `deepseek`, `nvidia`, `ollama-cloud`, `xai` (alias `grok`), `xai-oauth` (alias `grok-oauth`), `qwen-oauth`, `bedrock`, `opencode-zen`, `opencode-go`, `commandcode`, `commandcode-anthropic`, `ai-gateway`, `azure-foundry`, `lmstudio`, `stepfun`, `tencent-tokenhub` (alias `tencent`, `tokenhub`). |
| `-s`, `--skills <name>` | Pré-carrega uma ou mais skills para a sessão (pode ser repetido ou separado por vírgula). |
| `-v`, `--verbose` | Saída detalhada. |
| `-Q`, `--quiet` | Modo programático: suprime banner/spinner/prévias de ferramentas. |
| `--image <path>` | Anexa uma imagem local a uma única consulta. |
| `--resume <session>` / `--continue [name]` | Retoma uma sessão diretamente a partir de `chat`. |
| `--worktree` | Cria um git worktree isolado para esta execução. |
| `--checkpoints` | Ativa checkpoints de arquivos antes de mudanças destrutivas em arquivos. |
| `--yolo` | Pula os prompts de aprovação. |
| `--pass-session-id` | Passa o ID da sessão para o system prompt. |
| `--ignore-user-config` | Ignora `~/.work4you/config.yaml` e usa os padrões internos. As credenciais em `.env` continuam sendo carregadas. Útil para execuções isoladas de CI, relatórios de bugs reproduzíveis e integrações de terceiros. |
| `--ignore-rules` | Pula a injeção automática de `AGENTS.md`, `SOUL.md`, `.cursorrules`, memória persistente e skills pré-carregadas. Combine com `--ignore-user-config` para uma execução totalmente isolada. |
| `--safe-mode` | Modo de solução de problemas: desativa TODAS as personalizações — configuração do usuário, injeção de regras/memória, plugins, shell hooks e servidores MCP (implica `--ignore-user-config` e `--ignore-rules`). Use para isolar se um problema vem da sua configuração ou do próprio Work4You. |
| `--source <tag>` | Tag de origem da sessão para filtragem (padrão: `cli`). Use `tool` para integrações de terceiros que não devem aparecer nas listas de sessões do usuário. |
| `--max-turns <N>` | Número máximo de iterações de chamada de ferramentas por turno de conversa (padrão: 500, ou `agent.max_turns` na configuração). |

Exemplos:

```bash
work4you
work4you chat -q "Summarize the latest PRs"
work4you chat --provider openrouter --model anthropic/claude-sonnet-4.6
work4you chat --toolsets web,terminal,skills
work4you chat --quiet -q "Return only JSON"
work4you chat --worktree -q "Review this repo and open a PR"
work4you chat --ignore-user-config --ignore-rules -q "Repro without my personal setup"
work4you chat --safe-mode -q "Is this bug mine or Work4You'?"
```

### `work4you -z <prompt>` — disparo único via script

Para chamadores programáticos (scripts de shell, CI, cron, processos pai que enviam um prompt), `work4you -z` é o ponto de entrada de disparo único mais puro: **um prompt entra, o texto da resposta final sai, nada mais no stdout ou stderr.** Sem banner, sem spinner, sem prévias de ferramentas, sem linha `Session:` — apenas a resposta final do agente como texto simples.

```bash
work4you -z "What's the capital of France?"
# → Paris.

# Parent scripts can cleanly capture the response:
answer=$(work4you -z "summarize this" < /path/to/file.txt)
```

Sobreposições por execução (sem alterar `~/.work4you/config.yaml`):

| Flag | Variável de ambiente equivalente | Finalidade |
|---|---|---|
| `-m` / `--model <model>` | `WORK4YOU_INFERENCE_MODEL` | Sobrepõe o modelo para esta execução |
| `--provider <provider>` | _(nenhuma)_ | Sobrepõe o provedor para esta execução |
| `--usage-file <path>` | _(nenhuma)_ | Grava um relatório de uso em JSON após a execução (veja abaixo) |

```bash
work4you -z "…" --provider openrouter --model openai/gpt-5.5
# or:
WORK4YOU_INFERENCE_MODEL=anthropic/claude-sonnet-4.6 work4you -z "…"
```

Mesmo agente, mesmas ferramentas, mesmas skills — apenas remove toda camada interativa/cosmética. Se você precisar da saída das ferramentas também na transcrição, use `work4you chat -q`; `-z` é explicitamente para "eu só quero a resposta final".

#### `--usage-file` — relatório de uso em JSON para pipelines

`work4you -z "…" --usage-file /path/report.json` grava um relatório de uso legível por máquina após a execução: `estimated_cost_usd`, `input_tokens` / `output_tokens` / `cache_read_tokens` / `cache_write_tokens` / `reasoning_tokens` / `total_tokens`, `api_calls`, `model`, `provider`, `session_id`, `service_tier`, e as flags `completed` / `failed`. O relatório é gravado **mesmo quando a execução falha**, para que pipelines em lote sempre possam contabilizar os gastos. Não tem efeito fora de `-z`/`--oneshot`, e uma falha na gravação do uso nunca mascara o resultado da própria execução.

```bash
work4you -z "summarize this repo" --usage-file /tmp/usage.json
jq .estimated_cost_usd /tmp/usage.json
```

## `work4you model`

Seletor interativo de provedor + modelo. **Este é o comando para adicionar novos provedores, configurar chaves de API e executar fluxos OAuth.** Execute-o a partir do seu terminal — não de dentro de uma sessão de chat ativa do Work4You.

```bash
work4you model
```

Use isso quando você quiser:
- **adicionar um novo provedor** (OpenRouter, Anthropic, Copilot, DeepSeek, personalizado, etc.)
- fazer login em provedores baseados em OAuth (Anthropic, Copilot, Codex, Work4You Portal)
- inserir ou atualizar chaves de API
- escolher entre listas de modelos específicas de provedor
- configurar um endpoint personalizado/auto-hospedado
- salvar o novo padrão na configuração

:::warning work4you model vs /model — conheça a diferença
**`work4you model`** (executado a partir do seu terminal, fora de qualquer sessão do Work4You) é o **assistente completo de configuração de provedores**. Ele pode adicionar novos provedores, executar fluxos OAuth, solicitar chaves de API e configurar endpoints.

**`/model`** (digitado dentro de uma sessão de chat ativa do Work4You) só pode **alternar entre provedores e modelos que você já configurou**. Ele não pode adicionar novos provedores, executar OAuth ou solicitar chaves de API.

**Se você precisa adicionar um novo provedor:** Saia da sua sessão do Work4You primeiro (`Ctrl+C` ou `/quit`), depois execute `work4you model` a partir do prompt do seu terminal.
:::

### Slash command `/model` (durante a sessão)

Alterna entre modelos já configurados sem sair de uma sessão:

```
/model                              # Show current model and available options
/model claude-sonnet-4              # Switch model (auto-detects provider)
/model zai:glm-5                    # Switch provider and model
/model custom:qwen-2.5              # Use model on your custom endpoint
/model custom                       # Auto-detect model from custom endpoint
/model custom:local:qwen-2.5        # Use a named custom provider
/model openrouter:anthropic/claude-sonnet-4  # Switch back to cloud
```

Por padrão, as alterações de `/model` se aplicam **apenas à sessão atual**. Adicione `--global` para persistir a alteração em `config.yaml` (ou defina `model.persist_switch_by_default: true` para que toda alternância persista):

```
/model claude-sonnet-4 --global     # Switch and save as new default
```

:::info E se eu só vir modelos da OpenRouter?
Se você configurou apenas a OpenRouter, `/model` mostrará apenas modelos da OpenRouter. Para adicionar outro provedor (Anthropic, DeepSeek, Copilot, etc.), saia da sua sessão e execute `work4you model` a partir do terminal.
:::

Em uma alternância com `--global`, as mudanças de provedor e URL base são persistidas em `config.yaml` junto com o modelo. Ao trocar de um endpoint personalizado, a URL base antiga é limpa para evitar que "vaze" para outros provedores.

## `work4you gateway`

```bash
work4you gateway <subcommand>
```

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `run` | Executa o gateway em primeiro plano. Recomendado para WSL, Docker e Termux. |
| `start` | Inicia o serviço systemd/launchd instalado em segundo plano. |
| `stop` | Para o serviço (ou o processo em primeiro plano). |
| `restart` | Reinicia o serviço. |
| `status` | Mostra o status do serviço. |
| `list` | Lista **todos os perfis** e se o gateway de cada perfil está em execução (com PID quando disponível). Útil quando você executa vários perfis lado a lado e quer uma visão única. |
| `install` | Instala como serviço systemd (Linux) ou launchd (macOS) em segundo plano. |
| `uninstall` | Remove o serviço instalado. |
| `setup` | Configuração interativa da plataforma de mensagens. |
| `migrate-legacy` | Remove unidades legadas `work4you.service` deixadas por instalações anteriores à renomeação. Unidades de perfil (`work4you-gateway-<profile>.service`) e serviços não relacionados nunca são afetados. Flags: `--dry-run`, `-y`/`--yes`. |
| `enroll` | Experimental: registra este gateway com um conector de relay e salva as credenciais de relay para plataformas conectadas via relay. Veja [Work4You Relay](/user-guide/messaging/relay). |

Opções:

| Opção | Descrição |
|--------|-------------|
| `--all` | Em `start` / `restart` / `stop`: atua sobre o gateway de **todos os perfis**, não apenas o `WORK4YOU_HOME` ativo. Útil se você executa vários perfis lado a lado e quer reiniciá-los todos após `work4you update`. |
| `--no-supervise` | Em `run`: dentro da imagem Docker s6-overlay, opta por não usar a auto-supervisão e usa a semântica de primeiro plano pré-s6 — o gateway roda como processo principal do container, sem reinício automático. Sem efeito fora da imagem s6. Equivalente a definir `WORK4YOU_GATEWAY_NO_SUPERVISE=1`. |
| `--external-supervisor` | Em `run`: declara que um gerenciador de processos fornecido por um wrapper é o dono do gateway em primeiro plano. Use isso quando `sudo`, `env -i`, ou outro wrapper remove o marcador de ambiente nativo do launchd/systemd. Reinícios e atualizações feitos pelo chat saem de volta para esse gerenciador em vez de gerar um substituto destacado. |

`--external-supervisor` é um contrato de política de reinício: um
reinício feito pelo chat ou uma atualização com reinício de serviço
sai com o status `75`, então o supervisor do wrapper precisa
relançar o gateway após essa saída não-zero. Para systemd, use
`Restart=on-failure` ou `Restart=always` e não inclua `75` em
`RestartPreventExitStatus`; para launchd, configure `KeepAlive` para
relançar após saídas malsucedidas. Sem essa política, um reinício
solicitado deixa o gateway parado.

`work4you gateway enroll` aceita `--token`, `--connector-url`, `--gateway-id` e `--wake-url`. Ele troca o token de registro com o conector e grava os valores resultantes `GATEWAY_RELAY_ID`, `GATEWAY_RELAY_SECRET`, `GATEWAY_RELAY_DELIVERY_KEY`, o opcional `GATEWAY_RELAY_URL` e (quando `--wake-url` é informado) `GATEWAY_RELAY_WAKE_URL` no `.env` do perfil ativo.

:::tip Usuários de WSL
Use `work4you gateway run` em vez de `work4you gateway start` — o suporte a systemd do WSL não é confiável. Envolva em tmux para persistência: `tmux new -s work4you 'work4you gateway run'`. Veja o [FAQ do WSL](/reference/faq#wsl-gateway-keeps-disconnecting-or-work4you-gateway-start-fails) para detalhes.
:::

## `work4you lsp`

```bash
work4you lsp <subcommand>
```

Gerencia a integração com o Language Server Protocol. O LSP executa
servidores de linguagem reais (pyright, gopls, rust-analyzer, …) em
segundo plano e alimenta seus diagnósticos na verificação pós-escrita
usada por `write_file` e `patch`. Condicionado à detecção do workspace
git — o LSP só roda quando o cwd ou o arquivo editado está dentro de
um worktree git.

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `status` | Mostra o estado do serviço, os servidores configurados, o status de instalação. |
| `list` | Imprime o registro de servidores suportados. Passe `--installed-only` para pular os que faltam. |
| `install <id>` | Instala imediatamente o binário de um servidor. |
| `install-all` | Instala todo servidor com uma receita de auto-instalação conhecida. |
| `restart` | Encerra os clientes em execução para que a próxima edição os relance. |
| `which <id>` | Imprime o caminho do binário resolvido para um servidor. |

Veja [LSP — Diagnósticos Semânticos](/user-guide/features/lsp) para
o guia completo, as linguagens suportadas e as opções de configuração.

## `work4you setup`

```bash
work4you setup [model|tts|terminal|gateway|tools|agent] [--non-interactive] [--reset] [--quick] [--reconfigure] [--portal]
```

**Caminho mais fácil:** `work4you setup --portal` — faz OAuth no Work4You Portal e habilita o [Tool Gateway](../user-guide/features/tool-gateway.md) de uma vez só.

**Primeira execução:** inicia o assistente de primeira execução.

**Usuário recorrente (já configurado):** vai direto para o assistente completo de reconfiguração — cada prompt mostra seu valor atual como padrão, pressione Enter para manter ou digite um novo valor. Sem menu.

Pule direto para uma seção em vez do assistente completo:

| Seção | Descrição |
|---------|-------------|
| `model` | Configuração de provedor e modelo. |
| `terminal` | Configuração de backend de terminal e sandbox. |
| `gateway` | Configuração da plataforma de mensagens. |
| `tools` | Ativar/desativar ferramentas por plataforma. |
| `agent` | Configurações de comportamento do agente. |

Opções:

| Opção | Descrição |
|--------|-------------|
| `--quick` | Em execuções de usuário recorrente: só pergunta sobre itens ausentes ou não definidos. Pula itens que você já configurou. |
| `--non-interactive` | Usa valores padrão/de ambiente sem prompts. |
| `--reset` | Reseta a configuração para os padrões antes da configuração. |
| `--reconfigure` | Alias de compatibilidade retroativa — `work4you setup` sem argumentos em uma instalação existente agora faz isso por padrão. |
| `--portal` | Configuração de disparo único do Work4You Portal: faz login via OAuth, define o Work4You como provedor de inferência e habilita o [Tool Gateway](../user-guide/features/tool-gateway.md). Pula o resto do assistente. |

## `work4you portal`

```bash
work4you portal [status|open|tools]
```

Inspeciona a autenticação do Work4You Portal, o roteamento do Tool Gateway e acessa a página de assinatura. Uma invocação sem subcomando executa `status`.

| Subcomando | Descrição |
|------------|-------------|
| `status` (padrão) | Estado de autenticação do Portal + resumo do roteamento do Tool Gateway por ferramenta. Também mostrado quando nenhum subcomando é informado. |
| `open` | Abre `portal.work4you.ai/manage-subscription` no seu navegador padrão. |
| `tools` | Lista cada parceiro do Tool Gateway (Firecrawl, FAL, OpenAI TTS, Browser Use, Modal) e quais são roteados via Work4You. |

Para a configuração do próprio gateway, veja [Tool Gateway](../user-guide/features/tool-gateway.md). Para o caminho de configuração de disparo único, veja `work4you setup --portal` acima.

## `work4you whatsapp`

```bash
work4you whatsapp
```

Executa o fluxo de pareamento/configuração do WhatsApp, incluindo a seleção de modo e o pareamento por QR code.

## `work4you slack`

```bash
work4you slack manifest              # print manifest to stdout
work4you slack manifest --write      # write to ~/.work4you/slack-manifest.json
work4you slack manifest --long-description-file AGENTS.md --write
work4you slack manifest --slashes-only  # just the features.slash_commands array
```

Gera um manifesto de app do Slack que registra cada comando do gateway em
`COMMAND_REGISTRY` (`/btw`, `/stop`, `/model`, …) como um slash command
nativo do Slack — equiparando-se ao Discord e ao Telegram. Cole a
saída na configuração do seu app do Slack em
[https://api.slack.com/apps](https://api.slack.com/apps) → seu app →
**Features → App Manifest → Edit**, depois **Save**. O Slack solicita
reinstalação se os escopos ou slash commands tiverem mudado.

| Flag | Padrão | Finalidade |
|------|---------|---------|
| `--write [PATH]` | stdout | Grava em um arquivo em vez de stdout. `--write` isolado grava em `$WORK4YOU_HOME/slack-manifest.json`. |
| `--name NAME` | `Work4You` | Nome de exibição do bot no Slack. |
| `--description DESC` | texto padrão | Descrição do bot mostrada no diretório de apps do Slack. |
| `--long-description TEXT` | não definido | Define `display_information.long_description` diretamente (175–4.000 caracteres). Incompatível com `--slashes-only`. |
| `--long-description-file PATH` | não definido | Lê a descrição longa de um arquivo de texto UTF-8, preservando seu conteúdo exatamente. Mutuamente exclusivo com `--long-description` e incompatível com `--slashes-only`. |
| `--slashes-only` | desligado | Emite apenas `features.slash_commands`, para mesclar em um manifesto mantido manualmente. |

Execute `work4you slack manifest --write` novamente após `work4you update` para
pegar quaisquer comandos novos.


## `work4you send`

```bash
work4you send --to <target> "message text"
work4you send --to <target> --file <path>
echo "message" | work4you send --to <target>
work4you send --list [platform]
```

Envia uma mensagem de disparo único para uma plataforma de mensagens configurada, sem iniciar um agente ou um loop de gateway. Reutiliza as credenciais já configuradas do gateway (`~/.work4you/.env` + `~/.work4you/config.yaml`), para que scripts de operação, jobs de cron, hooks de CI e daemons de monitoramento possam postar atualizações de status sem reimplementar o cliente REST de cada plataforma.

Para plataformas com token de bot (Telegram, Discord, Slack, Signal, SMS, WhatsApp-CloudAPI) não é necessário um gateway em execução — `work4you send` fala diretamente com o endpoint REST da plataforma. Plataformas via plugin que precisam de um adaptador persistente ainda exigem um gateway ativo.

| Opção | Descrição |
|--------|-------------|
| `-t`, `--to <TARGET>` | Destino de entrega. Formatos: `platform` (usa o canal padrão), `platform:chat_id`, `platform:chat_id:thread_id`, ou `platform:#channel-name`. Exemplos: `telegram`, `telegram:-1001234567890`, `discord:#ops`, `slack:C0123ABCD`, `signal:+15551234567`. |
| `-f`, `--file <PATH>` | Lê o corpo da mensagem a partir de `PATH` (apenas arquivos de texto — logs, relatórios, markdown). Passe `-` para forçar a leitura do stdin. Para enviar uma imagem ou outro arquivo binário, use `MEDIA:<path>` (veja abaixo). |
| `-s`, `--subject <LINE>` | Adiciona uma linha de assunto/cabeçalho antes do corpo da mensagem. |
| `-l`, `--list [platform]` | Lista os destinos configurados em todas as plataformas (ou apenas na plataforma informada). |
| `-q`, `--quiet` | Suprime a saída no stdout em caso de sucesso — útil em scripts (confie apenas no código de saída). |
| `--json` | Emite o resultado bruto em JSON em vez de saída legível por humanos. |

Se nem um argumento posicional `message` nem `--file` forem informados, `work4you send` lê a partir do stdin quando este não é um TTY. Códigos de saída: `0` em caso de sucesso, `1` em falha de entrega/backend, `2` em erros de uso.

### Enviando imagens e outras mídias

`--file` é apenas para corpos de *texto*. Para entregar uma imagem, documento, vídeo ou arquivo de áudio como um anexo nativo da plataforma, referencie-o dentro do texto da mensagem com a diretiva `MEDIA:<local_path>`:

```bash
work4you send --to telegram "MEDIA:/tmp/screenshot.png"
work4you send --to telegram "Build chart for today MEDIA:/tmp/chart.png"   # with caption
work4you send --to discord:#ops "MEDIA:/tmp/report.pdf"
```

Por padrão, arquivos de imagem são enviados como fotos (plataformas como o Telegram recomprimem essas imagens). Adicione `[[as_document]]` à mensagem para entregá-las como anexos de arquivo sem compressão:

```bash
work4you send --to telegram "[[as_document]] MEDIA:/tmp/screenshot.png"
```

Exemplos:

```bash
work4you send --to telegram "deploy finished"
echo "RAM 92%" | work4you send --to telegram:-1001234567890
work4you send --to discord:#ops --file /tmp/report.md
work4you send --to slack:#eng --subject "[CI]" --file build.log
work4you send --list                  # all platforms
work4you send --list telegram         # filter by platform
```



## `work4you peer`

```bash
work4you peer add <name> --url http://host:port --key <API_SERVER_KEY>
work4you peer list
work4you peer dm <peer>[/<agent>] "message"
work4you peer remove <name>
```

DMs bot-a-bot entre máquinas. Registra outro gateway do Work4You (qualquer máquina
executando a plataforma `api_server`) como um *peer*, depois envia mensagens para seus agentes:
`work4you peer dm` resolve a sessão canônica de **Bot Chat** do agente remoto
via o API server do peer, executa um turno de agente lá, e imprime a resposta
no stdout — o equivalente entre máquinas do comando local de mensagem para bot
`work4you -p <bot> chat --in ~ -c "Bot Chat" …`.

`<peer>` sozinho tem como alvo o agente principal do gateway peer;
`<peer>/<agent>` tem como alvo um perfil nomeado em um peer multiplexado (roteado via
seu espelho `/p/<profile>/`).

| Subcomando | Descrição |
|--------|-------------|
| `add <name> --url <URL> [--key <KEY>] [--note TEXT]` | Registra ou atualiza um peer. A URL vai para `config.yaml` (`bot_peers`); a chave é armazenada como `WORK4YOU_PEER_<NAME>_KEY` em `~/.work4you/.env`. |
| `list` | Lista os peers e se cada um tem uma chave configurada. |
| `dm <peer>[/<agent>] [message]` | Envia mensagem ao Bot Chat canônico do agente peer e imprime a resposta (`--json` para saída legível por máquina; a mensagem recorre ao stdin se não for informada). |
| `remove <name>` | Remove um peer do registro (a entrada da chave no `.env` permanece intacta). |

Quando pelo menos um peer está registrado, o protocolo de mensagens do Bot Mode
(`agent.bot_mode_protocol`) ensinado a cada Bot Chat canônico inclui automaticamente
a lista de peers e o padrão `work4you peer dm`, de modo que os agentes descobrem
colegas de equipe em outras máquinas sem edições no SOUL. Veja
[Bot Mode](../user-guide/bot-mode.md).

Códigos de saída: `0` em caso de sucesso, `1` em falha de entrega/peer, `2` em erros de uso.

## `work4you secrets`

```bash
work4you secrets bitwarden <subcommand>
work4you secrets bw <subcommand>          # short alias
```

Busca chaves de API de um gerenciador de segredos externo na inicialização do processo, em vez de armazená-las em `~/.work4you/.env`. Atualmente suporta o **Bitwarden Secrets Manager**. Veja o guia completo: [Integração com Bitwarden](../user-guide/secrets/bitwarden.md).

Subcomandos de `bitwarden` (alias `bw`):

| Subcomando | Descrição |
|------------|-------------|
| `setup` | Assistente interativo: instala o binário `bws` fixado, armazena um token de acesso e escolhe um projeto. Aceita `--project-id`, `--access-token` e `--server-url` para uso não interativo. |
| `status` | Mostra a configuração atual, o caminho/versão do binário e o status de validação do token. |
| `token` | Rotaciona o token de acesso: valida o novo token junto ao Bitwarden antes de armazená-lo em `.env` (um token rejeitado não altera nada). Aceita `--access-token` para uso não interativo e `--no-verify` para pular a checagem. |
| `sync` | Busca segredos agora e reporta o que mudou. Adicione `--apply` para de fato exportar os segredos para o ambiente do shell atual (o padrão é dry-run). |
| `install` | Baixa e verifica o binário `bws` fixado. `--force` baixa novamente mesmo que já exista uma cópia gerenciada. |
| `disable` | Desativa a integração com o Bitwarden. |


## `work4you migrate`

```bash
work4you migrate <type>
```

Diagnostica e (opcionalmente) reescreve o `config.yaml` ativo para substituir referências a modelos retirados ou configurações descontinuadas. Um backup com timestamp do `config.yaml` original é feito antes de qualquer reescrita (pule com `--no-backup`).

| Subcomando | Descrição |
|------------|-------------|
| `xai` | Verifica o `config.yaml` em busca de referências a modelos xAI programados para descontinuação em 15 de maio de 2026 e (com `--apply`) os reescreve no local pelos substitutos oficiais, conforme o guia de migração da xAI. O padrão é dry-run. |

Flags comuns para subcomandos de migração:

| Flag | Descrição |
|------|-------------|
| `--apply` | Reescreve o `config.yaml` no local (padrão: dry-run, sem gravações). |
| `--no-backup` | Pula o backup com timestamp do `config.yaml` ao aplicar. |

> Não confunda com `work4you claw migrate` (importação de disparo único da configuração do OpenClaw para o Work4You) — `work4you migrate` é o comando de nível superior para reescrita de configuração.


## `work4you proxy`

```bash
work4you proxy <subcommand>
```

Executa um servidor HTTP local compatível com OpenAI que encaminha requisições para um provedor upstream autenticado via OAuth (ex.: Work4You Portal, xAI). Aplicativos externos podem apontar para o proxy com qualquer bearer token; o proxy anexa suas credenciais OAuth reais na saída. Veja [Subscription Proxy](../user-guide/features/subscription-proxy.md) para o guia completo.

| Subcomando | Descrição |
|------------|-------------|
| `start` | Executa o proxy em primeiro plano. Flags: `--provider <work4you\|xai>` (padrão `work4you`), `--host <addr>` (padrão `127.0.0.1`; use `0.0.0.0` para expor na rede local), `--port <int>` (padrão `8645`). |
| `status` | Mostra quais upstreams do proxy estão prontos (credenciais presentes, OAuth válido). |
| `providers` | Lista os provedores upstream disponíveis para o proxy. |


## `work4you security`

```bash
work4you security <subcommand>
```

Varredura de vulnerabilidades sob demanda contra o [OSV.dev](https://osv.dev). Cobre o venv do Work4You (distribuições PyPI instaladas), dependências Python declaradas por plugins em `~/.work4you/plugins/`, e servidores MCP `npx`/`uvx` fixados em `config.yaml`. NÃO varre pacotes instalados globalmente nem extensões de editor/navegador.

| Subcomando | Descrição |
|------------|-------------|
| `audit` | Executa uma auditoria de cadeia de suprimentos de disparo único. |

Flags de `audit`:

| Flag | Padrão | Descrição |
|------|---------|-------------|
| `--json` | desligado | Emite JSON legível por máquina em vez de texto legível por humanos. |
| `--fail-on <level>` | `critical` | Sai com código não-zero quando qualquer achado atinge esta severidade (`low`, `moderate`, `high`, `critical`). |
| `--skip-venv` | desligado | Pula a varredura do venv Python do Work4You. |
| `--skip-plugins` | desligado | Pula a varredura dos arquivos de requisitos dos plugins. |
| `--skip-mcp` | desligado | Pula a varredura dos servidores MCP fixados em `config.yaml`. |


## `work4you login` / `work4you logout` *(Descontinuado)*

:::caution
`work4you login` foi removido. Use `work4you auth` para gerenciar credenciais OAuth, `work4you model` para selecionar um provedor, ou `work4you setup` para a configuração interativa completa.
:::

## `work4you auth`

Gerencia pools de credenciais para rotação de chaves de um mesmo provedor. Veja [Credential Pools](/user-guide/features/credential-pools) para a documentação completa.

```bash
work4you auth                                              # Interactive wizard
work4you auth list                                         # Show all pools
work4you auth list openrouter                              # Show specific provider
work4you auth add openrouter --api-key sk-or-v1-xxx        # Add API key
work4you auth add anthropic --type oauth                   # Add OAuth credential
work4you auth remove openrouter 2                          # Remove by index
work4you auth reset openrouter                             # Clear cooldowns
work4you auth status anthropic                             # Show auth status for a provider
work4you auth logout anthropic                             # Log out and clear stored auth state
work4you auth spotify                                      # Authenticate Work4You with Spotify via PKCE
```

Subcomandos: `add`, `list`, `remove`, `reset`, `status`, `logout`, `spotify`. Quando chamado sem subcomando, inicia o assistente interativo de gerenciamento.

## `work4you status`

```bash
work4you status [--all] [--deep]
```

| Opção | Descrição |
|--------|-------------|
| `--all` | Mostra todos os detalhes em um formato compartilhável e com dados sensíveis ocultados. |
| `--deep` | Executa verificações mais profundas, que podem demorar mais. |

## `work4you cron`

```bash
work4you cron <list|create|edit|pause|resume|run|remove|status|tick>
```

| Subcomando | Descrição |
|------------|-------------|
| `list` | Mostra os jobs agendados. |
| `create` / `add` | Cria um job agendado a partir de um prompt, opcionalmente anexando uma ou mais skills via `--skill` repetido. |
| `edit` | Atualiza o agendamento, prompt, nome, entrega, contagem de repetições ou skills anexadas de um job. Suporta `--clear-skills`, `--add-skill` e `--remove-skill`. |
| `pause` | Pausa um job sem apagá-lo. |
| `resume` | Retoma um job pausado e calcula sua próxima execução futura. |
| `run` | Dispara um job no próximo tick do agendador. |
| `remove` | Apaga um job agendado. |
| `status` | Verifica se o agendador cron está em execução. |
| `tick` | Executa os jobs pendentes uma vez e encerra. |

O **gatilho** do cron é conectável via a chave de configuração `cron.provider`. Vazio
(o padrão) usa o ticker interno em processo. Defina para `chronos` (o
provedor gerenciado pela NAS para gateways hospedados com scale-to-zero) — configurado via as
chaves `cron.chronos.*` (`portal_url`, `callback_url`, `expected_audience`,
`nas_jwks_url`) — ou nomeie um provedor personalizado em `plugins/cron/<name>/` ou
`$WORK4YOU_HOME/plugins/<name>/`. Um provedor desconhecido ou indisponível volta ao
padrão interno, então o cron nunca fica sem um gatilho. Veja o
documento de [internals do cron](../developer-guide/cron-internals.md#gateway-integration).

## `work4you kanban`

```bash
work4you kanban [--board <slug>] <action> [options]
```

Quadro de colaboração multiperfil e multiprojeto. Cada instalação pode hospedar vários quadros (um por projeto, repositório ou domínio); cada quadro é uma fila independente com seu próprio banco SQLite e escopo de despachante. Novas instalações começam com um quadro chamado `default`, cujo banco é `~/.work4you/kanban.db` para compatibilidade retroativa; quadros adicionais ficam em `~/.work4you/kanban/boards/<slug>/kanban.db`. O despachante embutido no gateway varre todos os quadros a cada tick.

**Flags globais (aplicam-se a toda ação abaixo):**

| Flag | Finalidade |
|------|---------|
| `--board <slug>` | Opera em um quadro específico. Padrão: o quadro atual (definido via `work4you kanban boards switch`, a variável de ambiente `WORK4YOU_KANBAN_BOARD`, ou `default`). |

**Esta é a superfície humana / de scripting.** Os workers de agente iniciados pelo despachante operam o quadro através de um [toolset](/user-guide/features/kanban#how-workers-interact-with-the-board) dedicado `kanban_*` (`kanban_show`, `kanban_complete`, `kanban_request_review`, `kanban_request_changes`, `kanban_block`, `kanban_create`, `kanban_link`, `kanban_comment`, `kanban_heartbeat`; perfis orquestradores também recebem `kanban_list` e `kanban_unblock`) em vez de chamar `work4you kanban` via shell. Os workers têm `WORK4YOU_KANBAN_BOARD` fixado em seu ambiente, então fisicamente não conseguem ver outros quadros.

| Ação | Finalidade |
|--------|---------|
| `init` | Cria `kanban.db` se não existir. Idempotente. |
| `boards list` / `boards ls` | Lista todos os quadros com contagem de tarefas. `--json`, `--all` (inclui arquivados). |
| `boards create <slug>` | Cria um novo quadro. Flags: `--name`, `--description`, `--icon`, `--color`, `--switch` (torna ativo). O slug é kebab-case, convertido automaticamente para minúsculas. |
| `boards switch <slug>` / `boards use` | Persiste `<slug>` como o quadro ativo (grava em `~/.work4you/kanban/current`). |
| `boards show` / `boards current` | Imprime o nome, o caminho do banco e as contagens de tarefas do quadro atualmente ativo. |
| `boards rename <slug> "<name>"` | Altera o nome de exibição de um quadro. O slug é imutável. |
| `boards rm <slug>` | Arquiva (padrão) ou apaga definitivamente um quadro. `--delete` pula a etapa de arquivamento. Quadros arquivados vão para `boards/_archived/<slug>-<ts>/`. Recusado para `default`. |
| `create "<title>"` | Cria uma nova tarefa no quadro ativo. Flags: `--body`, `--assignee`, `--parent` (repetível), `--workspace scratch\|worktree\|dir:<path>`, `--tenant`, `--priority`, `--triage`, `--idempotency-key`, `--max-runtime`, `--max-retries`, `--skill` (repetível). |
| `list` / `ls` | Lista tarefas no quadro ativo. Filtre com `--mine`, `--assignee`, `--status`, `--tenant`, `--archived`, `--json`. |
| `show <id>` | Mostra uma tarefa com comentários e eventos. `--json` para saída legível por máquina. |
| `assign <id> <profile>` | Atribui ou reatribui. Use `none` para desatribuir. Recusado enquanto a tarefa está em execução. |
| `link <parent> <child>` | Adiciona uma dependência. Ciclos são detectados. Ambas as tarefas precisam estar no mesmo quadro. |
| `unlink <parent> <child>` | Remove uma dependência. |
| `claim <id>` | Reivindica atomicamente uma tarefa pronta. Imprime o caminho do workspace resolvido. |
| `comment <id> "<text>"` | Adiciona um comentário. O próximo worker que reivindicar a tarefa o lê como parte de sua resposta de `kanban_show()`. |
| `complete <id>` | Marca a tarefa como concluída. Flags: `--result`, `--summary`, `--metadata`. |
| `block <id> "<reason>"` | Marca a tarefa como bloqueada, aguardando entrada humana. Também adiciona o motivo como um comentário. |
| `request-review <id>` | Move uma tarefa para `review` com um handoff de revisor — NÃO é um bloqueio. Flags: `--summary`, `--metadata`, `--reviewer` (reatribui antes do envio para revisão). |
| `request-changes <id> <reason>` | Veredito do revisor para uma execução de revisão ativa: encerra a tentativa de revisão e devolve a tarefa ao implementador original. |
| `reopen-review <id>...` | Devolve tarefa(s) em revisão para alterações (`review` → ready/todo). Flag: `--reason` (adicionado como comentário). |
| `schedule <id> "<reason>"` | Estaciona trabalho com atraso/acompanhamento futuro em `scheduled`, para que não seja mostrado como um bloqueio humano. |
| `unblock <id>` | Restaura uma tarefa bloqueada à sua fase de origem (`review` ou `ready`), ou `todo` enquanto restarem dependências em aberto. |
| `archive <id>` | Oculta da lista padrão. `gc` removerá os workspaces temporários. |
| `tail <id>` | Acompanha o fluxo de eventos de uma tarefa. |
| `dispatch` | Uma passada do despachante no quadro ativo. Flags: `--dry-run`, `--max N`, `--failure-limit N`, `--json`. |
| `context <id>` | Imprime o contexto completo que um worker veria (título + corpo + resultados dos pais + comentários). |
| `specify <id>` / `specify --all` | Transforma uma tarefa na coluna de triagem em uma especificação concreta (título + corpo com objetivo, abordagem, critérios de aceite) via o LLM auxiliar, e a promove para `todo`. Flags: `--tenant` (restringe `--all` a um tenant), `--author`, `--json`. Configure o modelo em `auxiliary.triage_specifier` no `config.yaml`. |
| `decompose <id>` / `decompose --all` | Divide uma tarefa da coluna de triagem em um grafo de tarefas filhas roteadas a perfis especializados de acordo com a descrição. Recorre à promoção estilo `specify` de tarefa única quando o LLM decide que a tarefa não se beneficia do desmembramento. Mesmas flags que `specify`. Configure o modelo do decompositor em `auxiliary.kanban_decomposer` no `config.yaml`; `kanban.orchestrator_profile` controla apenas quem fica dono da tarefa raiz/orquestração após o desmembramento. Também roda automaticamente a cada tick do despachante quando `kanban.auto_decompose: true` (o padrão). Veja [Orquestração automática vs. manual](/user-guide/features/kanban#auto-vs-manual-orchestration). |
| `gc` | Remove workspaces temporários de tarefas arquivadas. |

Exemplos:

```bash
# Create a second board and put a task on it without switching away.
work4you kanban boards create atm10-server --name "ATM10 Server" --icon 🎮
work4you kanban --board atm10-server create "Restart server" --assignee ops

# Switch the active board for subsequent calls.
work4you kanban boards switch atm10-server
work4you kanban list                  # shows atm10-server tasks

# Archive a board (recoverable) or hard-delete it.
work4you kanban boards rm atm10-server
work4you kanban boards rm atm10-server --delete
```

Ordem de resolução do quadro (maior precedência primeiro): flag `--board <slug>` → variável de ambiente `WORK4YOU_KANBAN_BOARD` → arquivo `~/.work4you/kanban/current` → `default`.

Todas as ações também estão disponíveis como slash command no gateway (`/kanban …`), com a mesma superfície de argumentos — incluindo os subcomandos `boards` e a flag `--board`.

Para o design completo — comparação com Cline Kanban / Paperclip / NanoClaw / Gemini Enterprise, oito padrões de colaboração, quatro histórias de usuário, prova de correção de concorrência — veja `docs/work4you-kanban-v1-spec.pdf` no repositório ou o [guia do usuário do Kanban](/user-guide/features/kanban).

## `work4you egress`

Firewall de injeção de credenciais de saída para sandboxes de terminal remotas. Envolve o daemon [iron-proxy](https://github.com/ironsh/iron-proxy) — um proxy que intercepta TLS e troca tokens de proxy opacos por credenciais reais de API upstream na borda da rede, para que as sandboxes nunca guardem chaves reais. Desativado por padrão; veja a página completa de [Egress proxy](../user-guide/egress/iron-proxy.md) para configuração + arquitetura.

```bash
work4you egress install                  # download the pinned iron-proxy binary
work4you egress install --force          # re-download even if already installed

work4you egress setup                    # interactive wizard: CA, mappings, config
work4you egress setup --tunnel-port N    # override the tunnel listener port (default 9090)
work4you egress setup --from-bitwarden   # use Bitwarden Secrets Manager as credential source
work4you egress setup --no-bitwarden     # explicitly switch back to env-based credentials
work4you egress setup --rotate-tokens    # mint fresh proxy tokens (default preserves existing)

work4you egress start                    # spawn the managed proxy daemon
work4you egress stop                     # SIGTERM (then SIGKILL after 5s grace)
work4you egress restart                  # stop (if running) then start — needed for secret changes
work4you egress reload                   # hot-reload the ruleset in-place (no restart, no dropped
                                       #   connections) via the loopback management API

work4you egress status                   # binary + config + pid + listening + mappings
work4you egress status --show-tokens     # print proxy tokens in full (default: redacted)

work4you egress disable                  # flip proxy.enabled = false (does not stop a running proxy)
work4you egress config                   # print the path to proxy.yaml for inspection
```

### Fluxos comuns

```bash
# First-time setup
export OPENROUTER_API_KEY=…
work4you egress setup && work4you egress start
work4you config set terminal.backend docker   # if not already

# Switching credential source after the fact
work4you egress setup --from-bitwarden       # env → bitwarden
work4you egress setup --no-bitwarden         # bitwarden → env
# (just `setup` without either flag preserves the existing mode)

# Rotating all tokens (e.g. after a suspected token leak)
work4you egress setup --rotate-tokens    # setup offers to restart the running daemon for you
# (running sandboxes still hold old tokens; restart them too)

# Adding a new upstream
# Edit ~/.work4you/config.yaml proxy.extra_allowed_hosts: [api.example.com]
work4you egress setup
work4you egress restart                  # one-command apply (stop + start)
```

### Atalhos de diagnóstico

```bash
work4you egress status                     # current state in one view
cat ~/.work4you/proxy/proxy.yaml           # the rendered iron-proxy config
tail -20 ~/.work4you/proxy/iron-proxy.log  # daemon-level diagnostics
tail -f ~/.work4you/proxy/iron-proxy.log | jq  # daemon + per-request log (line-delimited JSON; v0.39 combines both streams)
```

Modos de falha comuns + recuperação são cobertos em [Egress proxy → Troubleshooting](../user-guide/egress/iron-proxy.md#troubleshooting).

## `work4you project`

```bash
work4you project <create|list|show|add-folder|remove-folder|rename|set-primary|use|archive|restore|bind-board>
```

Projetos são workspaces com nome próprio que podem abranger várias pastas/repositórios. Eles ancoram o agrupamento de sessões no desktop e, quando vinculados a um quadro kanban, dão às tarefas uma convenção determinística de worktree + branch. O estado é por perfil.

| Subcomando | Descrição |
|------------|-------------|
| `create` | Cria um novo projeto. |
| `list` (alias `ls`) | Lista os projetos. |
| `show` | Mostra os detalhes de um projeto. |
| `add-folder` | Adiciona uma pasta/repositório a um projeto. |
| `remove-folder` | Remove uma pasta de um projeto. |
| `rename` | Renomeia um projeto. |
| `set-primary` | Define a pasta principal. |
| `use` | Define o projeto ativo. |
| `archive` | Arquiva um projeto (recuperável). |
| `restore` | Restaura um projeto arquivado. |
| `bind-board` | Vincula um quadro kanban a este projeto. |

## `work4you webhook`

```bash
work4you webhook <subscribe|list|remove|test>
```

Gerencia assinaturas de webhooks dinâmicos para ativação de agente orientada a eventos. Requer que a plataforma de webhook esteja ativada na configuração — se não estiver configurada, imprime instruções de configuração.

| Subcomando | Descrição |
|------------|-------------|
| `subscribe` / `add` | Cria uma rota de webhook. Retorna a URL e o segredo HMAC para configurar no seu serviço. |
| `list` / `ls` | Mostra todas as assinaturas criadas pelo agente. |
| `remove` / `rm` | Apaga uma assinatura dinâmica. Rotas estáticas do config.yaml não são afetadas. |
| `test` | Envia um POST de teste para verificar se uma assinatura está funcionando. |

### `work4you webhook subscribe`

```bash
work4you webhook subscribe <name> [options]
```

| Opção | Descrição |
|--------|-------------|
| `--prompt` | Modelo de prompt com referências ao payload no formato `{dot.notation}`. |
| `--events` | Tipos de evento aceitos, separados por vírgula (ex.: `issues,pull_request`). Vazio = todos. |
| `--description` | Descrição legível por humanos. |
| `--skills` | Nomes de skills separados por vírgula para carregar na execução do agente. |
| `--deliver` | Destino de entrega: `log` (padrão), `telegram`, `discord`, `slack`, `github_comment`. |
| `--deliver-chat-id` | ID do chat/canal de destino para entrega entre plataformas. |
| `--secret` | Segredo HMAC personalizado. Gerado automaticamente se omitido. |
| `--deliver-only` | Pula o agente — entrega o `--prompt` renderizado como a mensagem literal. Custo zero de LLM, entrega em menos de um segundo. Requer que `--deliver` seja um destino real (não `log`). |
| `--script` | Script de filtro/transformação em `~/.work4you/scripts/`. O payload do webhook é passado como JSON no stdin; a saída JSON no stdout substitui o payload, e um stdout vazio, `[SILENT]`, ou um código de saída não-zero ignora o webhook. Veja [Script Filters and Transforms](../user-guide/messaging/webhooks.md#script-filters-and-transforms). |

As assinaturas persistem em `~/.work4you/webhook_subscriptions.json` e são recarregadas a quente pelo adaptador de webhook sem reiniciar o gateway.

## `work4you doctor`

```bash
work4you doctor [--fix]
```

| Opção | Descrição |
|--------|-------------|
| `--fix` | Tenta reparos automáticos quando possível. |

## `work4you dump`

```bash
work4you dump [--show-keys]
```

Exibe um resumo compacto, em texto simples, de toda a sua configuração do Work4You. Projetado para ser colado no Discord, em issues do GitHub ou no Telegram ao pedir suporte — sem cores ANSI, sem formatação especial, apenas dados.

| Opção | Descrição |
|--------|-------------|
| `--show-keys` | Mostra prefixos ocultados de chaves de API (primeiros e últimos 4 caracteres) em vez de apenas `set`/`not set`. |

### O que inclui

| Seção | Detalhes |
|---------|---------|
| **Cabeçalho** | Versão do Work4You, data de lançamento, hash do commit git |
| **Ambiente** | SO, versão do Python, versão do SDK da OpenAI |
| **Identidade** | Nome do perfil ativo, caminho do WORK4YOU_HOME |
| **Modelo** | Modelo e provedor padrão configurados |
| **Terminal** | Tipo de backend (local, docker, ssh, etc.) |
| **Chaves de API** | Verificação de presença para as 22 chaves de API de provedores/ferramentas |
| **Recursos** | Toolsets ativados, contagem de servidores MCP, provedor de memória |
| **Serviços** | Status do gateway, plataformas de mensagens configuradas |
| **Carga de trabalho** | Contagem de jobs cron, contagem de skills instaladas |
| **Sobreposições de configuração** | Quaisquer valores de configuração que difiram dos padrões |

### Exemplo de saída

```
--- work4you dump ---
version:          0.8.0 (2026.4.8) [af4abd2f]
os:               Linux 6.14.0-37-generic x86_64
python:           3.11.14
openai_sdk:       2.24.0
profile:          default
work4you_home:      ~/.work4you
model:            anthropic/claude-opus-4.6
provider:         openrouter
terminal:         local

api_keys:
  openrouter           set
  openai               not set
  anthropic            set
  work4you                 not set
  firecrawl            set
  ...

features:
  toolsets:           all
  mcp_servers:        0
  memory_provider:    built-in
  gateway:            running (systemd)
  platforms:          telegram, discord
  cron_jobs:          3 active / 5 total
  skills:             42

config_overrides:
  agent.max_turns: 250
  compression.threshold: 0.85
  display.streaming: True
--- end dump ---
```

### Quando usar

- Reportar um bug no GitHub — cole o dump na sua issue
- Pedir ajuda no Discord — compartilhe em um bloco de código
- Comparar sua configuração com a de outra pessoa
- Verificação rápida de sanidade quando algo não está funcionando

:::tip
`work4you dump` é feito especificamente para compartilhamento. Para diagnósticos interativos, use `work4you doctor`. Para uma visão geral visual, use `work4you status`.
:::

## `work4you debug`

```bash
work4you debug share [options]
```

Envia um relatório de depuração (informações do sistema + logs recentes) para um serviço de paste e obtém uma URL compartilhável. Útil para pedidos de suporte rápidos — inclui tudo que quem for te ajudar precisa para diagnosticar o problema.

| Opção | Descrição |
|--------|-------------|
| `--lines <N>` | Número de linhas de log a incluir por arquivo de log (padrão: 200). |
| `--expire <days>` | Validade do paste em dias (padrão: 7). |
| `--work4you` | Envia para o armazenamento interno de diagnóstico do Work4You em vez de um serviço público de paste. Use isso quando o suporte do Work4You pedir um pacote de diagnóstico privado. |
| `--local` | Imprime o relatório localmente em vez de enviá-lo. |
| `--no-redact` | Desativa a ocultação de segredos no momento do envio. Por padrão, os envios têm dados sensíveis ocultados. |

O relatório inclui informações do sistema (SO, versão do Python, versão do Work4You), logs recentes do agente, gateway, dashboard/GUI-TUI e desktop (limite de 512 KB por arquivo), e o status ocultado das chaves de API. Por padrão, os envios têm dados sensíveis ocultados para que segredos não sejam incluídos.

Os envios padrão usam serviços públicos de paste tentados em ordem: paste.rs, dpaste.com. `--work4you` envia o mesmo pacote de depuração para o armazenamento privado de diagnóstico do Work4You; o link do visualizador retornado é para a equipe do Work4You e se auto-apaga após 14 dias.

### Exemplos

```bash
work4you debug share              # Upload debug report, print URL
work4you debug share --lines 500  # Include more log lines
work4you debug share --expire 30  # Keep paste for 30 days
work4you debug share --work4you       # Upload a private diagnostics bundle for Work4You support
work4you debug share --local      # Print report to terminal (no upload)
```

## `work4you backup`

```bash
work4you backup [options]
```

Cria um arquivo zip da sua configuração, skills, sessões e dados do Work4You. O backup exclui o próprio código-fonte do work4you.

| Opção | Descrição |
|--------|-------------|
| `-o`, `--output <path>` | Caminho de saída para o arquivo zip (padrão: `~/work4you-backup-<timestamp>.zip`). |
| `-q`, `--quick` | Snapshot rápido: apenas arquivos de estado críticos (config.yaml, state.db, .env, auth, jobs cron). Muito mais rápido que um backup completo. |
| `-l`, `--label <name>` | Rótulo para o snapshot (usado apenas com `--quick`). |

O backup usa a API `backup()` do SQLite para cópia segura, funcionando corretamente mesmo com o Work4You em execução (seguro para o modo WAL).

**O que é excluído do zip:**

- `*.db-wal`, `*.db-shm`, `*.db-journal` — os arquivos auxiliares de WAL/memória compartilhada/journal do SQLite. O arquivo `*.db` já recebeu um snapshot consistente via `sqlite3.backup()`; incluir os arquivos auxiliares ativos junto com ele permitiria que uma restauração visse um estado parcialmente commitado.
- `checkpoints/` — caches de trajetória por sessão. Indexados por hash e regenerados por sessão; de qualquer forma não seriam portados corretamente para outra instalação.
- O próprio código do `work4you` (este é um backup de dados de usuário, não um snapshot de repositório).

### Exemplos

```bash
work4you backup                           # Full backup to ~/work4you-backup-*.zip
work4you backup -o /tmp/work4you.zip        # Full backup to specific path
work4you backup --quick                   # Quick state-only snapshot
work4you backup --quick --label "pre-upgrade"  # Quick snapshot with label
```

## `work4you checkpoints`

```bash
work4you checkpoints [COMMAND]
```

Inspeciona e gerencia o repositório git sombra em `~/.work4you/checkpoints/` — a camada de armazenamento por trás do comando `/rollback` durante a sessão. Seguro para executar a qualquer momento; não requer que o agente esteja em execução.

| Subcomando | Descrição |
|------------|-------------|
| `status` (padrão) | Mostra o tamanho total, a contagem de projetos e a discriminação por projeto. `work4you checkpoints` isolado equivale a isto. |
| `list` | Alias para `status`. |
| `prune` | Força uma varredura de limpeza — apaga projetos órfãos e obsoletos, faz GC no repositório, aplica o limite de tamanho. Ignora o marcador de idempotência de 24h. |
| `clear` | Apaga toda a base de checkpoints. Irreversível; pede confirmação a menos que `-f` seja usado. |
| `clear-legacy` | Apaga apenas os arquivos `legacy-<timestamp>/` produzidos pela migração v1→v2. |

### Opções

| Opção | Subcomando | Descrição |
|--------|------------|-------------|
| `--limit N` | `status`, `list` | Máximo de projetos a listar (padrão 20). |
| `--retention-days N` | `prune` | Descarta projetos cujo `last_touch` seja mais antigo que N dias (padrão 7). |
| `--max-size-mb N` | `prune` | Após a passada de órfãos/obsoletos, descarta o commit mais antigo de cada projeto até o tamanho total do repositório ficar ≤ N MB (padrão 500). |
| `--keep-orphans` | `prune` | Pula a exclusão de projetos cujo diretório de trabalho não existe mais. |
| `-f`, `--force` | `clear`, `clear-legacy` | Pula o prompt de confirmação. |

### Exemplos

```bash
work4you checkpoints                                  # status overview
work4you checkpoints prune --retention-days 3         # aggressive cleanup
work4you checkpoints prune --max-size-mb 200          # tighten size cap once
work4you checkpoints clear-legacy -f                  # drop v1 archive dirs
work4you checkpoints clear -f                         # wipe everything
```

Veja [Checkpoints e `/rollback`](../user-guide/checkpoints-and-rollback.md) para a arquitetura completa e os comandos durante a sessão.

## `work4you import`

```bash
work4you import <zipfile> [options]
```

Restaura um backup do Work4You criado anteriormente no seu diretório home do Work4You. Todos os arquivos no pacote sobrescrevem os arquivos existentes no seu diretório home do Work4You; `--force` apenas pula o prompt de confirmação que dispara quando o destino já possui uma instalação do Work4You.

| Opção | Descrição |
|--------|-------------|
| `-f`, `--force` | Pula o prompt de confirmação de instalação existente. |

:::warning
Pare o gateway antes de importar para evitar conflitos com processos em execução.
:::

### Exemplos
```bash
work4you import ~/work4you-backup-20260423.zip           # Prompts before overwriting existing config
work4you import ~/work4you-backup-20260423.zip --force   # Overwrite without prompting
```

## `work4you logs`

```bash
work4you logs [log_name] [options]
```

Visualiza, acompanha em tempo real e filtra os arquivos de log do Work4You. Todos os logs são armazenados em `~/.work4you/logs/` (ou `<profile>/logs/` para perfis não padrão).

### Arquivos de log

| Nome | Arquivo | O que captura |
|------|------|-----------------|
| `agent` (padrão) | `agent.log` | Toda a atividade do agente — chamadas de API, despacho de ferramentas, ciclo de vida da sessão (INFO e acima) |
| `errors` | `errors.log` | Apenas avisos e erros — um subconjunto filtrado de agent.log |
| `gateway` | `gateway.log` | Atividade do gateway de mensagens — conexões de plataforma, despacho de mensagens, eventos de webhook |
| `gui` | `gui.log` | Eventos de dashboard / gateway-TUI / ponte PTY / websocket |
| `desktop` | `desktop.log` | App desktop Electron — inicialização, saída da geração do backend, e tracebacks Python recentes |

### Opções

| Opção | Descrição |
|--------|-------------|
| `log_name` | Qual log visualizar: `agent` (padrão), `errors`, `gateway`, ou `list` para mostrar os arquivos disponíveis com seus tamanhos. |
| `-n`, `--lines <N>` | Número de linhas a mostrar (padrão: 50). |
| `-f`, `--follow` | Acompanha o log em tempo real, como `tail -f`. Pressione Ctrl+C para parar. |
| `--level <LEVEL>` | Nível mínimo de log a mostrar: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |
| `--session <ID>` | Filtra linhas contendo uma substring do ID da sessão. |
| `--since <TIME>` | Mostra linhas de um tempo relativo atrás: `30m`, `1h`, `2d`, etc. Suporta `s` (segundos), `m` (minutos), `h` (horas), `d` (dias). |
| `--component <NAME>` | Filtra por componente: `gateway`, `agent`, `tools`, `cli`, `cron`. |

### Exemplos

```bash
# View the last 50 lines of agent.log (default)
work4you logs

# Follow agent.log in real time
work4you logs -f

# View the last 100 lines of gateway.log
work4you logs gateway -n 100

# Show only warnings and errors from the last hour
work4you logs --level WARNING --since 1h

# Filter by a specific session
work4you logs --session abc123

# Follow errors.log, starting from 30 minutes ago
work4you logs errors --since 30m -f

# List all log files with their sizes
work4you logs list
```

### Filtragem

Os filtros podem ser combinados. Quando vários filtros estão ativos, uma linha de log precisa passar por **todos** eles para ser exibida:

```bash
# WARNING+ lines from the last 2 hours containing session "tg-12345"
work4you logs --level WARNING --since 2h --session tg-12345
```

Linhas sem um timestamp interpretável são incluídas quando `--since` está ativo (elas podem ser linhas de continuação de uma entrada de log com múltiplas linhas). Linhas sem um nível detectável são incluídas quando `--level` está ativo.

### Rotação de logs

O Work4You usa o `RotatingFileHandler` do Python. Logs antigos são rotacionados automaticamente — procure por `agent.log.1`, `agent.log.2`, etc. O subcomando `work4you logs list` mostra todos os arquivos de log, incluindo os rotacionados.


## `work4you prompt-size`

```bash
work4you prompt-size [--platform <name>] [--json]
```

Reporta o orçamento fixo de prompt para uma sessão nova — o que é enviado em toda
chamada de API *antes* de qualquer conteúdo de conversa. Útil quando um adaptador ou
proxy posterior tem um orçamento de prompt mais restrito que a janela de contexto do modelo, ou quando
você quer ver qual bloco (índice de skills, memória, perfil) domina.

Ele monta o mesmo system prompt que o agente montaria, depois o decompõe em:

- **Total do system prompt** — o prompt completo montado (identidade, orientações, índice
  de skills, arquivos de contexto, memória, perfil, timestamp).
- **Índice de skills** — o bloco `<available_skills>`. Este costuma ser o maior
  bloco individual quando muitas skills estão instaladas.
- **Memória** e **perfil do usuário** — seus snapshots de `MEMORY.md` / `USER.md`.
- **Camadas do prompt** — estável / contexto / volátil, correspondendo a como o Work4You organiza
  o prompt em camadas para facilitar o cache.
- **Schemas de ferramentas** — o JSON de todas as ferramentas ativadas (a outra metade do
  payload fixo de cada chamada).

Roda inteiramente offline — sem chamada de API, funciona sem nenhuma credencial configurada.

```bash
# Human-readable breakdown for the CLI platform (default)
work4you prompt-size

# Simulate a messaging platform's prompt (different platform hint)
work4you prompt-size --platform telegram

# Machine-readable output for scripts
work4you prompt-size --json
```

:::tip
O índice de skills e os schemas de ferramentas escalam com quantas skills e ferramentas você tem
ativadas. Para reduzir o prompt, desative toolsets não usados (`work4you tools`) ou
desinstale skills que você não precisa (`work4you skills`). Arquivos de contexto (AGENTS.md,
.cursorrules) no seu diretório atual também contam para o total.
:::

## `work4you config`

```bash
work4you config <subcommand>
```

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `show` | Mostra os valores de configuração atuais. |
| `edit` | Abre o `config.yaml` no seu editor. |
| `get <key> [--json]` | Imprime um único valor de configuração por chave com notação de ponto (ex.: `work4you config get model.default`). `--json` emite saída legível por máquina. |
| `set <key> <value>` | Define um valor de configuração. |
| `unset <key>` | Remove uma chave de configuração, revertendo-a para o padrão interno. |
| `path` | Imprime o caminho do arquivo de configuração. |
| `env-path` | Imprime o caminho do arquivo `.env`. |
| `check` | Verifica configurações ausentes ou desatualizadas. |
| `migrate` | Adiciona opções recém-introduzidas interativamente. |

## `work4you pairing`

```bash
work4you pairing <list|approve|revoke|clear-pending>
```

| Subcomando | Descrição |
|------------|-------------|
| `list` | Mostra usuários pendentes e aprovados. |
| `approve <platform> <code>` | Aprova um código de pareamento. |
| `revoke <platform> <user-id>` | Revoga o acesso de um usuário. |
| `clear-pending` | Limpa códigos de pareamento pendentes. |

## `work4you skills`

```bash
work4you skills <subcommand>
```

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `browse` | Navegador paginado para registros de skills. |
| `search` | Pesquisa em registros de skills. |
| `install` | Instala uma skill. |
| `inspect` | Visualiza uma skill sem instalá-la. |
| `list` | Lista as skills instaladas. |
| `check` | Verifica se há atualizações upstream para as skills de hub instaladas. |
| `update` | Reinstala as skills de hub com alterações upstream disponíveis. |
| `audit` | Reescaneia as skills de hub instaladas. |
| `uninstall` | Remove uma skill instalada via hub. |
| `reset` | Destrava uma skill empacotada marcada como `user_modified`, limpando sua entrada no manifesto. Com `--restore`, também substitui a cópia do usuário pela versão empacotada. |
| `opt-out` | Impede que skills empacotadas sejam semeadas no perfil ativo. Grava um marcador `.no-bundled-skills` para que o instalador, `work4you update` e qualquer sincronização pulem a semeadura de skills empacotadas. Seguro por padrão — nada em disco é tocado. Com `--remove`, também apaga skills empacotadas já presentes que estejam **sem modificações** (skills editadas pelo usuário, instaladas via hub, e escritas manualmente nunca são removidas; mostra uma prévia e pede confirmação primeiro, `--yes` para pular). |
| `opt-in` | Desfaz `opt-out` removendo o marcador `.no-bundled-skills`, para que as skills empacotadas voltem a ser semeadas no próximo `work4you update`. Com `--sync`, semeia novamente imediatamente. |
| `publish` | Publica uma skill em um registro. |
| `snapshot` | Exporta/importa configurações de skills. |
| `tap` | Gerencia fontes personalizadas de skills. |
| `config` | Configuração interativa de ativar/desativar skills por plataforma. |

Exemplos comuns:

```bash
work4you skills browse
work4you skills browse --source official
work4you skills search react --source skills-sh
work4you skills search https://mintlify.com/docs --source well-known
work4you skills inspect official/security/1password
work4you skills inspect skills-sh/vercel-labs/json-render/json-render-react
work4you skills install official/migration/openclaw-migration
work4you skills install skills-sh/anthropics/skills/pdf --force
work4you skills install https://sharethis.chat/SKILL.md                     # Direct URL (+ referenced support files)
work4you skills install https://example.com/SKILL.md --name my-skill        # Override name when frontmatter has none
work4you skills check
work4you skills update
work4you skills config
work4you skills reset google-workspace
work4you skills reset google-workspace --restore --yes
work4you skills opt-out                  # stop future bundled-skill seeding (nothing deleted)
work4you skills opt-out --remove --yes   # also delete UNMODIFIED bundled skills
work4you skills opt-in --sync            # undo: remove marker and re-seed now
```

Notas:
- `--force` pode sobrepor bloqueios de política não perigosos para skills de terceiros/comunidade.
- `--force` não sobrepõe um veredito de varredura `dangerous`.
- `--source skills-sh` pesquisa no diretório público `skills.sh`.
- `--source well-known` permite apontar o Work4You para um site que exponha `/.well-known/skills/index.json`.
- `--source browse-sh` pesquisa o catálogo do [browse.sh](https://browse.sh) com mais de 200 skills de automação de navegador específicas de site. Os identificadores têm o formato `browse-sh/airbnb.com/search-listings-ddgioa`.
- Passar uma URL `http(s)://…/*.md` instala o `SKILL.md` mais os arquivos explicitamente referenciados em `references/`, `templates/`, `scripts/`, `assets/` e `examples/`. Quando o frontmatter não tem `name:` e o slug da URL não é um identificador válido, um terminal interativo pergunta por um nome; superfícies não interativas (`/skills install` dentro da TUI, plataformas de gateway) exigem `--name <x>` em vez disso.

## `work4you bundles`

```bash
work4you bundles <subcommand>
```

Skill bundles agrupam várias skills sob um único slash command `/<bundle-name>`. Invocar o bundle carrega cada skill referenciada em uma única mensagem combinada do usuário. Armazenamento: `~/.work4you/skill-bundles/<slug>.yaml`. Veja [Skill Bundles](../user-guide/features/skills.md#skill-bundles) para o schema YAML e o comportamento.

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `list` | Lista os bundles instalados (padrão quando nenhum subcomando é informado) |
| `show <name>` | Mostra o nome, a descrição, as skills e o caminho de arquivo de um bundle |
| `create <name>` | Cria um novo bundle. Passe `--skill <id>` (repetível) ou omita para entrada interativa. `--description`, `--instruction`, `--force` disponíveis. |
| `delete <name>` | Remove um arquivo de bundle |
| `reload` | Reescaneia `~/.work4you/skill-bundles/` e reporta bundles adicionados/removidos |

Exemplos:

```bash
work4you bundles create backend-dev \
  --skill github-code-review \
  --skill test-driven-development \
  --skill github-pr-workflow \
  -d "Backend feature work"

work4you bundles list
work4you bundles show backend-dev
work4you bundles delete backend-dev
```

Em uma sessão de chat, `/bundles` lista os bundles instalados e `/<bundle-name>` carrega um.

## `work4you curator`

```bash
work4you curator <subcommand>
```

O curator é uma tarefa auxiliar em segundo plano baseada em modelo que revisa periodicamente as skills criadas pelo agente, remove as obsoletas, consolida sobreposições e arquiva skills obsoletas. Skills empacotadas e instaladas via hub nunca são tocadas. Os arquivamentos são recuperáveis; a exclusão automática nunca acontece.

| Subcomando | Descrição |
|------------|-------------|
| `status` | Mostra o status do curator e estatísticas das skills |
| `run` | Dispara uma revisão do curator agora (bloqueia até a passada do LLM terminar) |
| `run --background` | Inicia a passada do LLM em uma thread em segundo plano e retorna imediatamente |
| `run --dry-run` | Apenas prévia — produz o relatório de revisão sem nenhuma alteração |
| `backup` | Faz um snapshot manual em tar.gz de `~/.work4you/skills/` (o curator também tira snapshots automaticamente antes de cada execução real) |
| `rollback` | Restaura `~/.work4you/skills/` a partir de um snapshot (padrão: o mais recente) |
| `rollback --list` | Lista os snapshots disponíveis |
| `rollback --id <ts>` | Restaura um snapshot específico pelo id |
| `rollback -y` | Pula o prompt de confirmação |
| `pause` | Pausa o curator até ser retomado |
| `resume` | Retoma um curator pausado |
| `pin <skill>` | Fixa uma skill para que o curator nunca a transite automaticamente |
| `unpin <skill>` | Desfixa uma skill |
| `restore <skill>` | Restaura uma skill arquivada |
| `archive <skill>` | Arquiva uma skill manualmente |
| `prune` | Remove manualmente as skills que o curator normalmente limparia |
| `list-archived` | Lista as skills arquivadas (recuperáveis via `restore`) |

Em uma instalação nova, a primeira passada agendada é adiada por um `interval_hours` completo (7 dias por padrão) — o gateway não fará a curadoria imediatamente no primeiro tick após `work4you update`. Use `work4you curator run --dry-run` para pré-visualizar antes disso acontecer.

Veja [Curator](../user-guide/features/curator.md) para comportamento e configuração.

## `work4you moa`

Configura presets nomeados de Mixture of Agents. Os presets aparecem como modelos selecionáveis sob um provedor `Mixture of Agents` em todo seletor de modelo; `/moa <prompt>` executa um prompt através do preset padrão.

```bash
work4you moa list
work4you moa configure [name]
work4you moa delete <name>
```

`work4you moa configure` reutiliza o seletor de provedor → modelo do Work4You para cada modelo de referência e o agregador. Um preset é uma configuração de modo de execução, não um modelo ou provedor principal.

## `work4you fallback`

```bash
work4you fallback <subcommand>
```

Gerencia a cadeia de provedores de fallback. Os provedores de fallback são tentados em ordem quando o modelo principal falha com erros de limite de taxa, sobrecarga ou conexão.

| Subcomando | Descrição |
|------------|-------------|
| `list` (alias: `ls`) | Mostra a cadeia de fallback atual (padrão quando nenhum subcomando é informado) |
| `add` | Escolhe um provedor + modelo (mesmo seletor de `work4you model`) e anexa à cadeia |
| `remove` (alias: `rm`) | Escolhe uma entrada para apagar da cadeia |
| `clear` | Remove todas as entradas de fallback |

Veja [Fallback Providers](../user-guide/features/fallback-providers.md).

## `work4you hooks`

```bash
work4you hooks <subcommand>
```

Inspeciona os hooks em shell script declarados em `~/.work4you/config.yaml`, testa-os contra payloads sintéticos e gerencia a allowlist de consentimento de primeiro uso em `~/.work4you/shell-hooks-allowlist.json`.

| Subcomando | Descrição |
|------------|-------------|
| `list` (alias: `ls`) | Lista os hooks configurados com matcher, timeout e status de consentimento |
| `test <event>` | Dispara cada hook que corresponde a `<event>` contra um payload sintético |
| `revoke` (aliases: `remove`, `rm`) | Remove as entradas de allowlist de um comando (entra em vigor no próximo reinício) |
| `doctor` | Verifica cada hook configurado: bit de execução, allowlist, desvio de mtime, validade do JSON e tempo de execução sintética |

Veja [Hooks](../user-guide/features/hooks.md) para assinaturas de eventos e formatos de payload.

## `work4you memory`

```bash
work4you memory <subcommand>
```

Configura e gerencia plugins de provedor de memória externo. Provedores disponíveis: honcho, openviking, mem0, hindsight, holographic, retaindb, byterover, supermemory. Apenas um provedor externo pode estar ativo por vez. A memória interna (MEMORY.md/USER.md) está sempre ativa.

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `setup` | Seleção e configuração interativa de provedor. |
| `status` | Mostra a configuração atual do provedor de memória. |
| `off` | Desativa o provedor externo (apenas interno). |

:::info Subcomandos específicos de provedor
Quando um provedor de memória externo está ativo, ele pode registrar seu próprio comando de nível superior `work4you <provider>` para gerenciamento específico do provedor (ex.: `work4you honcho` quando o Honcho está ativo). Provedores inativos não expõem seus subcomandos. Execute `work4you --help` para ver o que está atualmente conectado.
:::

## `work4you acp`

```bash
work4you acp
```

Inicia o Work4You como um servidor ACP (Agent Client Protocol) via stdio para integração com editores.

Pontos de entrada relacionados:

```bash
work4you-acp
python -m acp_adapter
```

Instale o suporte primeiro:

```bash
cd ~/.work4you/work4you && uv pip install -e '.[acp]'
```

Veja [Integração ACP com Editores](../user-guide/features/acp.md) e [Internals do ACP](../developer-guide/acp-internals.md).

## `work4you mcp`

```bash
work4you mcp <subcommand>
```

Gerencia configurações de servidores MCP (Model Context Protocol) e executa o Work4You como um servidor MCP.

| Subcomando | Descrição |
|------------|-------------|
| *(nenhum)* ou `picker` | Seletor interativo de catálogo — navegue pelos MCPs aprovados pelo Work4You e instale/ative/desative. |
| `catalog` | Lista os MCPs aprovados pelo Work4You (texto simples, com suporte a script). |
| `install <name>` | Instala uma entrada do catálogo (ex.: `work4you mcp install n8n`). |
| `serve [-v\|--verbose]` | Executa o Work4You como um servidor MCP — expõe conversas para outros agentes. |
| `add <name> [--url URL] [--command CMD] [--auth oauth\|header] [--args ...]` | Adiciona um servidor MCP personalizado com descoberta automática de ferramentas. `--args` passa o restante do argv para o comando stdio, então coloque-o por último. |
| `remove <name>` (alias: `rm`) | Remove um servidor MCP da configuração. |
| `list` (alias: `ls`) | Lista os servidores MCP configurados. |
| `test <name>` | Testa a conexão com um servidor MCP. |
| `configure <name>` (alias: `config`) | Alterna a seleção de ferramentas para um servidor. |
| `login <name>` | Força a reautenticação de um servidor MCP baseado em OAuth. |

Veja [Referência de Configuração MCP](./mcp-config-reference.md), [Usando MCP com o Work4You](../guides/use-mcp-with-work4you.md), e [Modo Servidor MCP](../user-guide/features/mcp.md#running-work4you-as-an-mcp-server).

## `work4you plugins`

```bash
work4you plugins [subcommand]
```

Gerenciamento unificado de plugins — plugins gerais, provedores de memória e engines de contexto em um só lugar. Executar `work4you plugins` sem subcomando abre uma tela interativa composta com duas seções:

- **General Plugins** — checkboxes de múltipla seleção para ativar/desativar plugins instalados
- **Provider Plugins** — configuração de seleção única para o Provedor de Memória e a Engine de Contexto. Pressione ENTER em uma categoria para abrir um seletor de opção única.

| Subcomando | Descrição |
|------------|-------------|
| *(nenhum)* | UI interativa composta — alternâncias de plugins gerais + configuração de plugins de provedor. |
| `install <identifier> [--force] [--ref COMMIT_SHA]` | Instala um plugin a partir de uma URL Git, `owner/repo`, ou um nome simples de índice. Nomes simples (sem barra) são resolvidos através do índice de plugins da comunidade para `owner/repo` mais o commit fixado pelo índice; nomes ambíguos listam candidatos e encerram. `--ref` aceita apenas um SHA de commit completo com 40 caracteres, instala essa revisão imutável exata, e sobrepõe qualquer fixação do índice. |
| `search [term] [--json] [--capability CAP] [--refresh]` | Pesquisa no índice de plugins da comunidade (correspondência aproximada em nome/descrição/tags; omita `term` para navegar). Buscado em `plugins.index_url` (padrão: o índice de plugins do Work4You), com cache em `~/.work4you/cache/` por 24h, recorrendo ao cache desatualizado e depois à semente embutida quando offline. Indexado ≠ auditado — a inclusão é apenas uma revisão de metadados. |
| `update <name>` | Busca as últimas alterações para um plugin instalado sem fixação. Plugins fixados devem ser reinstalados com `--force --ref <new-commit>` para avançar. |
| `remove <name>` (aliases: `rm`, `uninstall`) | Remove um plugin instalado. |
| `enable <name>` | Ativa um plugin desativado. |
| `disable <name>` | Desativa um plugin sem removê-lo. |
| `list` (alias: `ls`) | Lista os plugins instalados com o status de ativação/desativação. |
| `doctor [path-or-id] [--ci]` | Valida um plugin nativo através do analisador de manifesto real, do carregador e do caminho de registro. `--ci` sai com código 1 em caso de erros. |
| `pack install <path-or-url> [--force]` | Instala um pacote de plugins (`work4you-pack.yaml`) — um conjunto declarativo de plugins, cada um fixado em um SHA de commit exato de 40 caracteres. Mostra uma tela de revisão obrigatória (cada plugin, origem, referência fixada, capacidades declaradas), pede uma confirmação para o conteúdo do pacote, depois executa instalações fixadas comuns. As capacidades declaradas de cada plugin ainda passam pelo consentimento padrão por plugin — um pacote nunca concede em massa. Falhas parciais são reportadas por plugin; sai com código não-zero quando qualquer plugin falha. Apenas interativo (sem `--yes`). |
| `pack export [--enabled-only] [--name NAME]` | Emite um YAML de pacote no stdout a partir da instalação atual: repositório + SHA exato de cada plugin instalado via git, mais a configuração sanitizada e não sensível de `plugins.entries`. Plugins apenas locais (sem procedência git) são listados como comentários de aviso, nunca como entradas instaláveis. Segredos, concessões de capacidade e gates `allow_*` são sempre removidos. |
| `pack show <path-or-url>` | Simulação: analisa, valida e exibe um pacote sem instalar nada. |

As seleções de plugins de provedor são salvas em `config.yaml`:
- `memory.provider` — provedor de memória ativo (vazio = apenas interno)
- `context.engine` — engine de contexto ativa (`"compressor"` = padrão interno)

A lista de plugins gerais desativados é armazenada em `config.yaml` sob `plugins.disabled`.
Instalações via git também registram apenas sua origem canônica, a revisão instalada exata e
o status de fixação no arquivo auxiliar `plugins/.install-metadata.json`, local ao perfil. Ele não
contém configuração de plugin, valores de ambiente, segredos ou concessões de capacidade.

Veja [Plugins](../user-guide/features/plugins.md) e [Construindo um Plugin do Work4You](../developer-guide/plugins/index.md).

## `work4you tools`

```bash
work4you tools [--summary]
```

| Opção | Descrição |
|--------|-------------|
| `--summary` | Imprime o resumo atual de ferramentas ativadas e encerra. |

Sem `--summary`, isso inicia a UI interativa de configuração de ferramentas por plataforma.

## `work4you computer-use`

```bash
work4you computer-use <subcommand>
```

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `install` | Executa o instalador upstream do cua-driver (macOS, Windows e Linux). |
| `install --upgrade` | Executa o instalador novamente mesmo que o cua-driver já esteja no PATH. O script upstream sempre busca a versão mais recente, então isso realiza uma atualização in-place. |
| `status` | Imprime se `cua-driver` está no `$PATH` e qual versão está instalada. |
| `doctor [--include CHECK] [--skip CHECK] [--json]` | Executa o relatório de saúde do cua-driver e mostra suas verificações de plataforma. |
| `permissions status [--json]` | Reporta as permissões de Acessibilidade e Gravação de Tela no macOS. |
| `permissions grant` | Solicita ao macOS que conceda Acessibilidade e Gravação de Tela ao Cua Driver. |

`work4you computer-use install` é o ponto de entrada estável para instalar o binário
[cua-driver](https://github.com/trycua/cua) usado pelo toolset
`computer_use`. Ele executa o mesmo instalador upstream que
`work4you tools` invoca quando você ativa o Computer Use pela primeira vez, então é seguro
usá-lo para executar novamente a instalação se a alternância do toolset não a disparar
(por exemplo, em configurações de usuário recorrente).

Se o cua-driver já estiver presente, o Work4You verifica sua versão e manifesto de
runtime. Uma instalação compatível 0.20.0 ou mais recente é mantida no lugar. Uma instalação padrão
antiga ou incompleta é reparada com o instalador upstream atual. O Work4You nunca
substitui um binário personalizado selecionado através de
`WORK4YOU_CUA_DRIVER_CMD`; atualize esse binário diretamente ou remova a sobreposição.
`work4you computer-use status` reporta quando o reparo é necessário.

O toolset interno `computer_use` é a integração recomendada do Work4You.
Registrar ferramentas MCP brutas do Cua é uma alternativa quando você precisa do vocabulário
de ferramentas de baixo nível do Cua. `cua-driver skills install` detecta o Work4You e vincula o
pacote de skills do Cua ao diretório de skills do Work4You automaticamente.

O modo de permissão, a aprovação do manifesto de capacidades e a concessão do perfil
existente pertencem ao lançamento em tempo de execução. No modo restrito, o Work4You passa as
flags canônicas do Cua `--capability-manifest` e `--approve-capability-manifest`. Todo
transporte MCP possui uma sessão de ciclo de vida privada dentro do seu runtime. Nomes de sessão
públicos rotulam o cursor e o estado da sessão; eles não possuem nem compartilham o runtime.

`work4you update` executa automaticamente o instalador upstream novamente ao final
da atualização se o cua-driver estiver no PATH, então a maioria dos usuários não precisará
chamar `--upgrade` manualmente. Use-o quando o upstream lançar uma correção que você quer
imediatamente, sem esperar a próxima atualização do Work4You.

## `work4you pets`

```bash
work4you pets <list|install|select|show|off|scale|remove|doctor>
```

[Petdex](https://github.com/crafter-station/petdex) é uma galeria pública de bichinhos de sprite animados para agentes de codificação. Instale um e o Work4You o mostra reagindo à atividade do agente na CLI, na TUI e no app desktop.

| Subcomando | Descrição |
|------------|-------------|
| `list` | Navega pela galeria do petdex. |
| `install` | Instala um bichinho da galeria. |
| `select` | Define o bichinho ativo (grava em `display.pet.*`). |
| `show` | Anima o bichinho ativo no terminal. |
| `off` | Desativa a exibição do bichinho. |
| `scale` | Redimensiona o bichinho em todos os lugares (`display.pet.scale`). |
| `remove` | Apaga um bichinho instalado. |
| `doctor` | Verifica a configuração do bichinho + suporte a gráficos do terminal. |

Você também pode gerar um bichinho totalmente novo a partir de uma descrição em texto com o slash command `/hatch`. Veja [Pets](../user-guide/features/pets.md).

## `work4you sessions`

```bash
work4you sessions <subcommand>
```

Subcomandos:

| Subcomando | Descrição |
|------------|-------------|
| `list` | Lista as sessões recentes. |
| `browse` | Seletor interativo de sessões com busca e retomada. Cada linha mostra uma tag de status de ciclo de vida (`done` / `intr` / `err` / `empty`, derivada da mensagem final da sessão) e sua contagem de mensagens. Pressione `d` em uma linha destacada (enquanto o filtro de busca estiver vazio) para apagar essa sessão após uma confirmação s/N; enquanto um filtro está ativo, `d` digita na busca em vez disso. |
| `export <output> [--session-id ID]` | Exporta sessões para JSONL. |
| `delete <session-id>` | Apaga uma sessão. |
| `prune` | Apaga sessões que correspondem a filtros: limites de tempo `--older-than`/`--newer-than`/`--before`/`--after` (durações como `5h`/`2d`, dias simples, ou timestamps ISO); atributos `--source`, `--title`, `--model`, `--provider`, `--branch`, `--end-reason`, `--user`, `--chat-id`, `--chat-type`, `--cwd`; limites numéricos `--min/--max-messages`, `--min/--max-tokens`, `--min/--max-cost`, `--min/--max-tool-calls`; além de `--include-archived`, `--dry-run`, `--yes`. Padrão: mais antigo que 90 dias. |
| `archive` | Arquiva em massa (oculta sem apagar) sessões que correspondem aos mesmos filtros de `prune`. Requer pelo menos um filtro. |
| `stats` | Mostra estatísticas do armazenamento de sessões. |
| `rename <session-id> <title>` | Define ou altera o título de uma sessão. |
| `optimize` | Recupera espaço em disco: mescla segmentos do índice FTS5 + VACUUM. Não destrutivo — nenhum dado de sessão é alterado. |
| `optimize-storage` | Migra o índice de busca de texto completo para o layout compacto de conteúdo externo v23; em bancos grandes isso recupera uma fração significativa do `state.db`. |
| `repair` | Repara um esquema malformado do `state.db` (ex.: `table messages_fts already exists`) para que sessões ocultas reapareçam; um backup é feito primeiro. |
| `repair-routing` | Reconecta conversas do gateway isoladas em linhas de sessão que perderam sua identidade de roteamento (um chat "voltando no tempo" após um reinício). Dry-run por padrão; `--apply` executa as adoções (pare o gateway primeiro); `--max-gap-seconds N` ajusta a janela de contiguidade. Apenas casos inequívocos são reparados. Veja [Sessões → Reparar Sessões de Gateway Isoladas](../user-guide/sessions.md#repair-stranded-gateway-sessions). |
| `recover` | Recuperação offline e não destrutiva de um `state.db` danificado para um banco de dados limpo separado. |
| `retitle-skills` | Regenera títulos para sessões abertas com um `/skill`, usando o que o usuário realmente digitou; lista as alterações a menos que `--apply` seja informado. |

## `work4you insights`

```bash
work4you insights [--days N] [--source platform]
```

| Opção | Descrição |
|--------|-------------|
| `--days <n>` | Analisa os últimos `n` dias (padrão: 30). |
| `--source <platform>` | Filtra por origem, como `cli`, `telegram`, ou `discord`. |

## `work4you claw`

```bash
work4you claw migrate [options]
```

Migra sua configuração do OpenClaw para o Work4You. Lê de `~/.openclaw` (ou um caminho personalizado) e grava em `~/.work4you`. Detecta automaticamente nomes de diretório legados (`~/.clawdbot`, `~/.moltbot`) e nomes de arquivo de configuração (`clawdbot.json`, `moltbot.json`).

| Opção | Descrição |
|--------|-------------|
| `--dry-run` | Mostra uma prévia do que seria migrado sem gravar nada. |
| `--preset <name>` | Preset de migração: `full` (todas as configurações compatíveis) ou `user-data` (exclui configuração de infraestrutura). Nenhum dos presets importa segredos — passe `--migrate-secrets` explicitamente. |
| `--overwrite` | Sobrescreve arquivos existentes do Work4You em conflitos (padrão: recusa aplicar quando o plano tem conflitos). |
| `--migrate-secrets` | Inclui chaves de API na migração. Necessário mesmo sob `--preset full`. |
| `--no-backup` | Pula o snapshot zip pré-migração de `~/.work4you/` (por padrão, um único arquivo de ponto de restauração é gravado em `~/.work4you/backups/pre-migration-*.zip` antes de aplicar; restaurável com `work4you import`). |
| `--source <path>` | Diretório personalizado do OpenClaw (padrão: `~/.openclaw`). |
| `--workspace-target <path>` | Diretório de destino para instruções do workspace (AGENTS.md). |
| `--skill-conflict <mode>` | Trata colisões de nomes de skills: `skip` (padrão), `overwrite`, ou `rename`. |
| `--yes` | Pula o prompt de confirmação. |

### O que é migrado

A migração cobre mais de 30 categorias entre persona, memória, skills, provedores de modelo, plataformas de mensagens, comportamento do agente, políticas de sessão, servidores MCP, TTS, e mais. Os itens são **importados diretamente** para equivalentes do Work4You ou **arquivados** para revisão manual.

**Importados diretamente:** SOUL.md, MEMORY.md, USER.md, AGENTS.md, skills (4 diretórios de origem), modelo padrão, provedores personalizados, servidores MCP, tokens e allowlists de plataformas de mensagens (Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost), padrões do agente (esforço de raciocínio, compressão, atraso humano, fuso horário, sandbox), políticas de reset de sessão, regras de aprovação, configuração de TTS, configurações de navegador, configurações de ferramentas, timeout de execução, allowlist de comandos, configuração de gateway, e chaves de API de 3 fontes.

**Arquivados para revisão manual:** Jobs cron, plugins, hooks/webhooks, backend de memória (QMD), configuração de registro de skills, UI/identidade, logging, configuração multiagente, vínculos de canal, IDENTITY.md, TOOLS.md, HEARTBEAT.md, BOOTSTRAP.md.

A **resolução de chaves de API** verifica três fontes em ordem de prioridade: valores de configuração → `~/.openclaw/.env` → `auth-profiles.json`. Todos os campos de token tratam strings simples, templates de ambiente (`${VAR}`) e objetos SecretRef.

Para o mapeamento completo de chaves de configuração, detalhes do tratamento de SecretRef, e o checklist pós-migração, veja o **[guia de migração completo](../guides/migrate-from-openclaw.md)**.

### Exemplos

```bash
# Preview what would be migrated
work4you claw migrate --dry-run

# Full migration (all compatible settings, no secrets)
work4you claw migrate --preset full

# Full migration including API keys
work4you claw migrate --preset full --migrate-secrets

# Migrate user data only (no secrets), overwrite conflicts
work4you claw migrate --preset user-data --overwrite

# Migrate from a custom OpenClaw path
work4you claw migrate --source /home/user/old-openclaw
```

## `work4you import-agent`

```bash
work4you import-agent [claude-code|codex] [options]
```

Importa uma configuração do **Claude Code** (`~/.claude`) ou do **OpenAI Codex CLI** (`~/.codex`) para o Work4You. Mapeia instruções de `CLAUDE.md`/`AGENTS.md` para entradas de memória, regras de permissão allow/deny de `Bash(...)` para `command_allowlist`/`approvals.deny`, servidores MCP para `mcp_servers` em `config.yaml`, e diretórios de skills para `~/.work4you/skills/`. Sempre mostra uma prévia antes de aplicar; chaves de API e credenciais nunca são importadas.

| Opção | Descrição |
| --- | --- |
| `agent` | `claude-code` ou `codex` (padrão: detecção automática). |
| `--source <path>` | Diretório de origem personalizado (padrão: `~/.claude` ou `~/.codex`). |
| `--dry-run` | Apenas prévia — nada é gravado. |
| `--overwrite` | Substitui servidores MCP/skills em conflito (padrão: pula). |
| `--yes`, `-y` | Pula os prompts de confirmação. |

Veja o **[guia de importação](../user-guide/import-from-other-agents.md)** para as tabelas completas de mapeamento.

## `work4you serve`

```bash
work4you serve [options]
```

Inicia o **servidor backend** do Work4You — o gateway JSON-RPC/WebSocket ao qual o [app desktop](/user-guide/desktop) e clientes remotos se conectam. É o mesmo servidor que `work4you dashboard` executa, mas **headless**: ele nunca abre uma UI de navegador. O app desktop inicia seu próprio backend `work4you serve`; use este comando diretamente quando quiser um backend headless em um host remoto. Aceita as mesmas opções `--host` / `--port` / `--insecure` / `--skip-build` / `--stop` / `--status` que `work4you dashboard` abaixo (uma vinculação que não seja loopback aciona o mesmo portão de autenticação). Requer o extra `[web]`; o socket embutido de Chat também precisa de `[pty]` em um host POSIX.

## `work4you dashboard`

```bash
work4you dashboard [options]
```

Inicia o dashboard web — uma UI baseada em navegador para gerenciar configuração, chaves de API e monitorar sessões. (Para um backend headless sem UI de navegador — ex.: o que o app desktop inicia — use [`work4you serve`](#work4you-serve) acima.) Requer `cd ~/.work4you/work4you && uv pip install -e ".[web]"` (FastAPI + Uvicorn). A aba de Chat embutida no navegador está sempre disponível e precisa adicionalmente do extra `pty` (`cd ~/.work4you/work4you && uv pip install -e ".[web,pty]"`) mais um ambiente PTY POSIX, como Linux, macOS ou WSL2. Veja [Web Dashboard](/user-guide/features/web-dashboard) para a documentação completa.

| Opção | Padrão | Descrição |
|--------|---------|-------------|
| `--port` | `9119` | Porta para executar o servidor web |
| `--host` | `127.0.0.1` | Endereço de vinculação |
| `--no-open` | — | Não abre o navegador automaticamente |
| `--insecure` | desligado | **Descontinuado / sem efeito.** Anteriormente ignorava a autenticação em uma vinculação que não fosse loopback. Desde o endurecimento de segurança de junho de 2026, uma vinculação pública *sempre* requer um provedor de autenticação (senha ou OAuth). Vincule a `127.0.0.1` e use um túnel para manter local. |
| `--skip-build` | desligado | Pula a etapa de build da UI web e serve o `dist` existente diretamente. Útil para contextos não interativos (Tarefas Agendadas do Windows, CI) onde o npm não está disponível. Faça o build antes com `cd web && npm run build`. |
| `--isolated` | desligado | Quando iniciado a partir de um perfil nomeado (`worker dashboard`), executa um servidor dedicado por perfil em vez de rotear para o dashboard da máquina. |
| `--stop` | — | Para os processos `work4you dashboard` em execução e encerra. |
| `--status` | — | Lista os processos `work4you dashboard` em execução e encerra. |

### `work4you dashboard register`

Registra esta instalação como um dashboard auto-hospedado junto à sua conta do Work4You Portal. Cria um cliente OAuth, grava `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` em `~/.work4you/.env`, e imprime como acionar o portão de login. Requer estar logado (`work4you setup`).

| Opção | Descrição |
|--------|-------------|
| `--name` | Rótulo legível por humanos para o dashboard (padrão: gerado automaticamente). |
| `--redirect-uri` | URI de redirecionamento OAuth HTTPS público (ex.: `https://work4you.example.com/auth/callback`). Omita para uso apenas em localhost. |
| `--portal-url` | Sobrepõe a URL base do Work4You Portal para o registro (padrão: o portal em que você está logado). Também configurável via `WORK4YOU_DASHBOARD_PORTAL_URL`. |

```bash
# Default — opens browser to http://127.0.0.1:9119
work4you dashboard

# Custom port, no browser
work4you dashboard --port 8080 --no-open

# From a profile alias — routes to the machine dashboard with the
# profile preselected in the sidebar switcher (attach if running)
worker dashboard
```

## `work4you profile`

```bash
work4you profile <subcommand>
```

Gerencia perfis — múltiplas instâncias isoladas do Work4You, cada uma com sua própria configuração, sessões, skills e diretório home.

| Subcomando | Descrição |
|------------|-------------|
| `list` | Lista todos os perfis. |
| `use <name>` | Define um perfil padrão persistente. |
| `create <name> [--clone] [--clone-all] [--clone-from <source>] [--no-alias]` | Cria um novo perfil. `--clone` copia configuração, `.env`, `SOUL.md`, e skills do perfil ativo. `--clone-all` copia todo o estado. `--clone-from` especifica um perfil de origem e implica clone de configuração, a menos que combinado com `--clone-all`. |
| `delete <name> [-y]` | Apaga um perfil. |
| `show <name>` | Mostra os detalhes de um perfil (diretório home, configuração, etc.). |
| `alias <name> [--remove] [--name NAME]` | Gerencia scripts wrapper para acesso rápido ao perfil. |
| `rename <old> <new>` | Renomeia um perfil. |
| `export <name> [-o FILE]` | Exporta um perfil para um arquivo `.tar.gz` (backup local). |
| `import <archive> [--name NAME]` | Importa um perfil a partir de um arquivo `.tar.gz` (restauração local). |
| `install <source> [--name N] [--alias] [--force] [-y]` | Instala uma distribuição de perfil a partir de uma URL git ou diretório local. |
| `update <name> [--force-config] [-y]` | Rebusca uma distribuição; preserva os dados do usuário (memórias, sessões, autenticação). |
| `info <name>` | Mostra o manifesto de distribuição de um perfil (versão, requisitos, origem). |

Exemplos:

```bash
work4you profile list
work4you profile create work --clone
work4you profile use work
work4you profile alias work --name h-work
work4you profile export work -o work-backup.tar.gz
work4you profile import work-backup.tar.gz --name restored
work4you profile install github.com/user/my-distro --alias
work4you profile update work
work4you -p work chat -q "Hello from work profile"
```

## `work4you completion`

```bash
work4you completion [bash|zsh|fish]
```

Imprime um script de autocompletar do shell no stdout. Adicione a saída no seu perfil de shell para autocompletar por Tab de comandos, subcomandos e nomes de perfil do Work4You.

Exemplos:

```bash
# Bash
work4you completion bash >> ~/.bashrc

# Zsh
work4you completion zsh >> ~/.zshrc

# Fish
work4you completion fish > ~/.config/fish/completions/work4you.fish
```

## `work4you update`

```bash
work4you update [--gateway] [--check] [--no-backup] [--backup] [--yes]
```

Busca o código `work4you` mais recente e reinstala as dependências no venv gerenciado, depois reexecuta os hooks pós-instalação (servidores MCP, sincronização de skills, instalação de autocompletar). Seguro para executar em uma instalação em produção. Use `--check` para ver se seu checkout está atrás de `origin/main` sem instalar.

`work4you update` busca a branch de atualização configurada (padrão: `main`). Se seu checkout está em outra branch, o Work4You pode fazer checkout da branch de atualização antes de buscar. Faça commit do trabalho da branch antes de atualizar quando quiser mantê-lo fora do fluxo de autostash da atualização.

| Opção | Descrição |
|--------|-------------|
| `--gateway` | Modo interno usado pelo comando de mensagens `/update`. Usa IPC baseado em arquivo para prompts e streaming de progresso, em vez de ler do stdin do terminal. Não é uma flag de reinício de gateway. |
| `--check` | Verifica se há uma atualização disponível sem buscar, instalar dependências ou reiniciar nada. |
| `--no-backup` | Pula todos os backups pré-atualização nesta execução (tanto o snapshot rápido de estado quanto o zip completo), independentemente de `updates.pre_update_backup`. |
| `--backup` | Força um backup **completo** pré-atualização nesta execução: o snapshot rápido de estado mais um zip completo do `WORK4YOU_HOME` (configuração, autenticação, sessões, skills, dados de pareamento). O modo padrão é `quick` — apenas um snapshot leve de estado. Defina o modo permanente via `updates.pre_update_backup: quick | full | off` em `config.yaml`. |
| `--yes`, `-y` | Assume "sim" para prompts interativos, como migração de configuração e restauração de stash. A entrada de chave de API é pulada; execute `work4you config migrate` separadamente para isso. |

Comportamento adicional:

- **Reinício do gateway.** Após uma atualização bem-sucedida, o Work4You tenta reiniciar automaticamente todos os perfis de gateway em execução, para que peguem o novo código. Use `work4you gateway restart` quando quiser reiniciar um gateway sem aplicar uma atualização.
- **Alterações locais no código-fonte.** Para instalações via git, arquivos rastreados sujos e arquivos não rastreados são automaticamente colocados em stash antes do checkout de branch ou do pull (`git stash push --include-untracked`). Atualizações em terminal interativo perguntam antes de restaurar o stash. Atualizações não interativas o restauram por padrão; defina `updates.non_interactive_local_changes: discard` apenas em instalações gerenciadas onde edições locais de código-fonte devem ser descartadas após um pull bem-sucedido. Se a restauração do stash gerar conflitos ou o pull falhar, o stash é deixado no lugar para recuperação manual.
- **Instabilidade do lockfile do npm.** Antes de colocar em stash ou trocar de branch, o Work4You faz uma limpeza de melhor esforço das diferenças rastreadas de `package-lock.json` produzidas por etapas de npm install/build. Faça commit ou coloque manualmente em stash as edições intencionais do lockfile antes de executar `work4you update`.
- **Snapshot de dados de pareamento.** Mesmo com `--backup` desligado, `work4you update` faz um snapshot leve de `~/.work4you/pairing/` e das regras de comentários do Feishu antes do `git pull`. Você pode reverter isso com `work4you backup restore --state pre-update` se um pull sobrescrever um arquivo que você estava editando.
- **Aviso de `work4you.service` legado.** Se o Work4You detectar uma unidade systemd `work4you.service` anterior à renomeação (em vez da atual `work4you-gateway.service`), ele imprime uma dica de migração única para que você evite problemas de flap-loop.
- **Códigos de saída.** `0` em caso de sucesso, `1` em erros de pull/instalação/pós-instalação, `2` em alterações inesperadas na árvore de trabalho que bloqueiam o `git pull`.

## Comandos de manutenção

| Comando | Descrição |
|---------|-------------|
| `work4you version` | Imprime informações de versão. |
| `work4you update` | Busca as últimas alterações e reinstala as dependências. |

| `work4you uninstall [--full] [--gui] [--dry-run] [--yes]` | Remove o Work4You, opcionalmente apagando toda a configuração/dados. `--gui` remove apenas o Chat GUI do desktop, deixando o agente intacto; `--full` também apaga configuração/dados; `--dry-run` imprime o que seria removido sem alterar nada; `--yes` pula os prompts. |

## Veja também

- [Referência de Slash Commands](./slash-commands.md)
- [Interface da CLI](../user-guide/cli.md)
- [Sessões](../user-guide/sessions.md)
- [Sistema de Skills](../user-guide/features/skills.md)
- [Skins e Temas](../user-guide/features/skins.md)
