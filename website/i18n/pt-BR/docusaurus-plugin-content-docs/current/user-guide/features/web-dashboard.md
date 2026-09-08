---
sidebar_position: 15
title: "Web Dashboard"
description: "Browser-based administration panel for managing configuration, API keys, MCP servers, messaging pairing, webhooks, the gateway, memory, credentials, sessions, logs, analytics, cron jobs, and skills"
---

# Web Dashboard

O web dashboard é uma interface baseada em navegador para gerenciar sua instalação do Work4You. Em vez de editar arquivos YAML ou executar comandos de CLI, você pode configurar ajustes, gerenciar chaves de API e monitorar sessões a partir de uma interface web limpa.

:::tip
A autenticação em modo hospedado (hosted-mode) usa OAuth do Work4You Portal; se você também quiser que o dashboard converse com um backend real, `work4you setup --portal` conecta também o modelo e o gateway de ferramentas. Veja [Work4You Portal](/integrations/work4you-portal).
:::

## Início rápido

```bash
work4you dashboard
```

Isso inicia um servidor web local e abre `http://127.0.0.1:9119` no seu navegador. O dashboard roda inteiramente na sua máquina — nenhum dado sai do localhost.

### Opções

| Flag | Padrão | Descrição |
|------|---------|-------------|
| `--port` | `9119` | Porta em que o servidor web roda |
| `--host` | `127.0.0.1` | Endereço de bind |
| `--no-open` | — | Não abrir o navegador automaticamente |
| `--insecure` | desligado | **Obsoleta / sem efeito (no-op).** Antes ignorava a autenticação em um bind não-loopback; agora não desativa mais a autenticação — um bind público sempre exige um provedor de autenticação (senha ou OAuth) |
| `--isolated` | desligado | Quando iniciado a partir de um perfil nomeado (`worker dashboard`), roda um servidor dedicado por perfil em vez de rotear para o dashboard da máquina |

```bash
# Porta personalizada
work4you dashboard --port 8080

# Vincular a todas as interfaces (use com cautela em redes compartilhadas)
work4you dashboard --host 0.0.0.0

# Iniciar sem abrir o navegador
work4you dashboard --no-open
```

## Gerenciando múltiplos perfis

O dashboard é uma superfície de gerenciamento em **nível de máquina**: um único servidor gerencia
todos os [perfis](../profiles.md) na máquina. Um seletor de perfil na
barra lateral (visível sempre que existe mais de um perfil) decide qual
perfil as páginas de gerenciamento leem e escrevem — Config, API Keys, Skills,
MCP, Models e a aba Chat seguem todos esse seletor. Enquanto um perfil diferente
do perfil próprio do dashboard está selecionado, um banner âmbar nomeia o perfil
gerenciado, para que o alvo de escrita nunca fique ambíguo.

A seleção fica na URL (`?profile=<name>`), então links diretos como
`http://127.0.0.1:9119/skills?profile=worker` chegam com o seletor
pré-selecionado e sobrevivem a atualizações de página (refresh).

Iniciar o dashboard a partir de um alias de perfil roteia para o dashboard
da máquina em vez de iniciar um segundo servidor:

```bash
worker dashboard
# → já em execução: abre o navegador em ?profile=worker
# → não em execução: inicia o dashboard da máquina com "worker" pré-selecionado
```

Passe `--isolated` para optar por não usar isso e rodar um servidor dedicado restrito
a esse perfil (o comportamento anterior à unificação — útil se você deliberadamente
expõe dashboards de perfis diferentes com autenticações diferentes).

A aba **Chat** também segue o seletor: um chat restrito a um perfil gera seu
processo filho PTY com o `WORK4YOU_HOME` do perfil selecionado, então a conversa roda
com o modelo, as skills, a memória e o histórico de sessões daquele perfil. Trocar de
perfil inicia uma nova sessão de terminal.

O que permanece por perfil e **não** é absorvido pelo seletor: processos de
gateway (gerencie-os via `work4you -p <name> gateway …`), o banco de dados de
sessão de cada perfil e os agendadores de cron (a página Cron já agrega
entre perfis com seu próprio filtro).

## Pré-requisitos

A instalação padrão do `work4you` não inclui a stack HTTP nem o helper de PTY — esses são extras opcionais. O **web dashboard** precisa de FastAPI e Uvicorn (extra `web`). A aba **Chat** também precisa de `ptyprocess` para gerar a TUI incorporada por trás de um pseudo-terminal (extra `pty` no POSIX). Instale ambos com:

```bash
cd ~/.work4you/work4you && uv pip install -e ".[web,pty]"
```

O extra `web` traz FastAPI/Uvicorn; o extra `pty` traz `ptyprocess` (POSIX) ou `pywinpty` (Windows nativo — observe que a TUI incorporada em si ainda requer WSL). `cd ~/.work4you/work4you && uv pip install -e ".[all]"` inclui ambos os extras e é o caminho mais fácil se você também quiser mensageria/voz/etc.

Quando você executa `work4you dashboard` sem as dependências, ele informa o que instalar. Se o frontend ainda não foi compilado e o `npm` está disponível, ele é compilado automaticamente na primeira execução.

A aba Chat faz parte de toda execução de `work4you dashboard` — o painel de chat embutido no navegador (rodando a TUI sobre PTY/WebSocket) está sempre disponível, sem necessidade de nenhuma flag extra.

## Páginas

### Status

A página inicial mostra uma visão geral ao vivo da sua instalação:

- **Versão do agente** e data de lançamento
- **Status do gateway** — em execução/parado, PID, plataformas conectadas e seu estado
- **Sessões ativas** — contagem de sessões ativas nos últimos 5 minutos
- **Sessões recentes** — lista das 20 sessões mais recentes com modelo, contagem de mensagens, uso de tokens e uma prévia da conversa

A página de status se atualiza automaticamente a cada 5 segundos.

#### Banner de pressão de recursos

Quando a máquina host está com pouca memória ou disco disponível, um banner aparece no topo
do dashboard (alimentado pelo mesmo polling de status — sem requisições extras):

- **"Your agent is almost out of memory and may restart"** — a memória
  disponível do sistema caiu para níveis *elevated* (< 128 MiB ou < 15%) ou *critical*
  (< 64 MiB ou < 5%), conforme amostrado pelo heartbeat de 30 segundos do gateway.
- **"Your agent restarted unexpectedly, most likely because it ran out of
  memory"** — o ledger de ciclo de vida registrou uma saída não limpa sob pressão
  de memória na inicialização anterior (uma suspeita de OOM kill).
- **Avisos de disco** — o volume que hospeda `~/.work4you` está quase cheio
  (*elevated* abaixo de 512 MB livres, *critical* abaixo de 256 MB livres).

Apenas o aviso ativo mais grave é exibido por vez (disk critical > memory
critical > OOM restart > disk elevated > memory elevated). As dispensas (dismissals) são
restritas à inicialização atual do gateway: dispensar um aviso revela o próximo
ativo, um reinício do gateway ou uma escalada (elevated → critical) reabre o
aviso, e um heartbeat desatualizado não renderiza nada, em vez de um alerta falso.

### Chat

A aba **Chat** incorpora a TUI completa do Work4You (a mesma interface que você obtém em `work4you --tui`) diretamente no navegador. Tudo o que você pode fazer na TUI do terminal — slash commands, seletor de modelo, cards de chamada de ferramenta, streaming de markdown, prompts de clarify/sudo/aprovação, temas de skin — funciona de forma idêntica aqui, porque o dashboard está rodando o binário real da TUI e renderizando sua saída ANSI através do [xterm.js](https://xtermjs.org/) com seu renderizador WebGL, para um layout de célula em pixel perfeito.

**Como funciona:**

- `/api/pty` abre um WebSocket autenticado com o token de sessão do dashboard
- O servidor gera `work4you --tui` por trás de um pseudo-terminal POSIX
- As teclas digitadas viajam até o PTY; a saída ANSI é transmitida de volta ao navegador
- O renderizador WebGL do xterm.js pinta cada célula em uma grade de pixel inteiro; o rastreamento do mouse (SGR 1006), caracteres largos (Unicode 11) e glifos de desenho de caixas são renderizados nativamente
- Redimensionar a janela do navegador redimensiona a TUI através do addon `@xterm/addon-fit`

**Retomar uma sessão existente:** na aba **Sessions**, clique no ícone de play (▶) ao lado de qualquer sessão. Isso leva a `/chat?resume=<id>` e inicia a TUI com `--resume`, carregando o histórico completo.

**Seletor de sessão (painel lateral direito):** a aba Chat carrega sua própria lista de conversas no estilo ChatGPT em um painel fino à direita, ao lado do terminal, para que você possa trocar de conversa sem sair da página. O painel empilha o seletor de modelo no topo e a lista de sessões logo abaixo; o terminal ocupa a maior parte da tela. A lista mostra as sessões mais recentes do perfil ativo — título (recorrendo a uma prévia de mensagem quando ausente), horário relativo da última atividade, contagem de mensagens e o canal de origem para sessões que não são da CLI. Clique em qualquer linha para retomá-la no lugar (o terminal reinicia com o histórico daquela conversa); a sessão ativa fica destacada. **New chat** inicia uma sessão nova, e um controle de atualização (refresh) recarrega a lista. O painel é somente leitura para troca de sessão — excluir, renomear, exportar e limpeza em lote continuam na aba **Sessions**. Em telas estreitas, ele se recolhe em um painel deslizante (slide-over).

**Pré-requisitos:**

- Node.js (mesmo requisito de `work4you --tui`; o bundle da TUI é compilado na primeira execução)
- `ptyprocess` — instalado pelo extra `pty` (`cd ~/.work4you/work4you && uv pip install -e ".[web,pty]"`, ou `[all]` cobre ambos)
- Kernel POSIX (Linux, macOS ou WSL2). O painel de terminal `/chat` precisa especificamente de um PTY POSIX — o Python nativo do Windows não tem equivalente, então em uma instalação nativa do Windows o restante do dashboard (sessions, jobs, metrics, editor de config) funciona, mas a aba `/chat` mostrará um banner instruindo a usar o WSL2 para esse recurso.

Feche a aba do navegador e o PTY é encerrado (reaped) de forma limpa no servidor. Reabrir gera uma sessão nova.

Para apontar o [Work4You Desktop](#connecting-work4you-desktop-to-a-remote-backend) para um dashboard rodando em outra máquina em vez do seu backend embutido próprio, veja a seção de backend remoto abaixo.

### Conectando o Work4You Desktop a um backend remoto

O Work4You Desktop normalmente inicia seu próprio backend local, mas também pode se conectar a um dashboard rodando em uma máquina remota (uma VM, um servidor caseiro, etc.) via **Settings → Gateways → Remote gateway**. Essa é a fonte mais comum de relatos do tipo "o Desktop diz que o backend está pronto, mas o chat nunca funciona", porque a checagem de prontidão do Desktop verifica menos do que a conexão de chat ao vivo realmente precisa.

:::info Pré-requisito: um `work4you dashboard` precisa estar em execução no host remoto
O "backend remoto" ao qual o Desktop se conecta **é** um processo `work4you dashboard` rodando na máquina remota — o mesmo servidor documentado nesta página. Ele precisa estar de pé e acessível antes que qualquer um dos passos abaixo importe; o Desktop se conecta a ele, não o inicia para você. Mantenha-o rodando sob `systemd`/`tmux`/etc. para que sobreviva a logout e reinicializações. O **gateway** (Telegram/Discord/Slack/etc.) é um processo de longa duração *separado* — inicie-o de forma independente se você depende de canais de mensagens; ele não é o que o aplicativo desktop conecta.
:::

O probe "remote backend is ready" do Desktop só atinge `GET /api/status`, que é um endpoint público — ele responde assim que *qualquer* dashboard está rodando no host. A conexão de chat ao vivo é um WebSocket **separado** para `/api/ws` (e `/api/pty`), e esse socket é protegido por mais duas checagens que o probe de status nunca toca:

1. **Você precisa estar autenticado.** Quando o dashboard está vinculado a um endereço não-loopback, ele ativa seu gate de autenticação. Proteja-o com um usuário e senha (o [provedor de usuário/senha](#usernamepassword-provider-no-oauth-idp) embutido); o Desktop faz login uma vez e reutiliza a sessão resultante para o WebSocket via um ticket de uso único. Sem um provedor configurado, um dashboard não-loopback **falha fechado (fails closed) na inicialização**.
2. **O host de bind precisa permitir o cliente e corresponder ao cabeçalho Host.** Um bind loopback (`127.0.0.1`) só aceita clientes loopback, então uma máquina remota é rejeitada na camada de socket independentemente das credenciais. Vincule a um endereço não-loopback (`--host 0.0.0.0`) para que a proteção de IP de origem (peer-IP guard) deixe o cliente remoto passar. A URL remota que você digita no Desktop precisa alcançar o dashboard pelo mesmo host ao qual ele se vinculou — a proteção contra DNS rebinding exige que o cabeçalho Host corresponda.

#### Configuração do dashboard remoto

Defina um usuário e senha, depois execute o dashboard vinculado a um endereço alcançável. Para um serviço `systemd`:

```ini
[Service]
EnvironmentFile=%h/.work4you/.env
ExecStart=/path/to/venv/bin/python -m work4you_cli.main dashboard \
    --host 0.0.0.0 --port 9119 --no-open
```

com `~/.work4you/.env` contendo:

```bash
WORK4YOU_DASHBOARD_BASIC_AUTH_USERNAME=admin
WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD=choose-a-strong-password
WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET=<32+ random bytes; openssl rand -base64 32>
```

Depois, no Desktop, informe a **Remote URL** (por exemplo, `http://VM_IP:9119`) e **Sign in** com esse usuário e senha. Veja a seção [provedor de usuário/senha](#usernamepassword-provider-no-oauth-idp) para a configuração completa.

:::tip Verifique se o gate está ativo antes de tentar novamente no Desktop
De qualquer máquina, verifique se o dashboard anuncia o provedor de usuário/senha:

```bash
curl -s http://VM_IP:9119/api/status | jq '.auth_required, .auth_providers'
# true
# ["basic"]
```

- `auth_required: true` e `"basic"` na lista de providers → o fluxo de **Sign in** do Desktop vai funcionar.
- `auth_required: false` → o bind é loopback, ou o gate não foi ativado. Vincule a um endereço não-loopback.
- `auth_required: true` mas sem provider `"basic"` → as variáveis de ambiente de usuário/senha não foram carregadas. Corrija isso primeiro.
:::

Se `/api/status` mostrar que o gate está ativo com o provider `"basic"` e o Desktop *ainda assim* falhar ao conectar depois do login, o problema está além da configuração básica — pegue um `desktop.log` recente (Settings → Gateways → Open logs) mais os logs do dashboard da mesma janela de tentativa e procure pelo código de fechamento do `/api/ws` (4403 = WS de chat rejeitado pelo guard de requisição, por exemplo incompatibilidade de Host/peer; 4401 = o ticket do WS não autenticou).

### Config

Um editor baseado em formulário para o `config.yaml`. Todos os mais de 150 campos de configuração são descobertos automaticamente a partir de `DEFAULT_CONFIG` e organizados em categorias com abas:

![Config admin page — section filters on the left, auto-discovered fields on the right](/img/dashboard/admin-config.png)


- **model** — modelo padrão, provedor, URL base, configurações de reasoning
- **terminal** — backend (local/docker/ssh/modal), timeout, preferências de shell
- **display** — skin, progresso de ferramentas, exibição de resume, configurações do spinner
- **agent** — máximo de iterações, timeout do gateway, service tier
- **delegation** — limites de subagentes, esforço de reasoning
- **memory** — seleção de provedor, configurações de injeção de contexto
- **approvals** — modo de aprovação de comandos perigosos (smart/manual/off)
- E mais — toda seção do config.yaml tem os campos de formulário correspondentes

Campos com valores válidos conhecidos (backend do terminal, skin, modo de aprovação, etc.) são renderizados como dropdowns. Booleanos são renderizados como toggles. Todo o resto é um campo de texto.

**Ações:**

- **Save** — grava as alterações no `config.yaml` imediatamente
- **Reset to defaults** — reverte todos os campos para seus valores padrão (não salva até você clicar em Save)
- **Export** — baixa a configuração atual como JSON
- **Import** — envia um arquivo de configuração JSON para substituir os valores atuais

:::tip
As alterações de configuração entram em vigor na próxima sessão do agente ou no reinício do gateway. O web dashboard edita o mesmo arquivo `config.yaml` que `work4you config set` e o gateway leem.
:::

### API Keys

Gerencia o arquivo `.env` onde chaves de API e credenciais são armazenadas. As chaves são agrupadas por categoria:

- **LLM Providers** — OpenRouter, Anthropic, OpenAI, DeepSeek, etc.
- **Tool API Keys** — Browserbase, Firecrawl, Tavily, ElevenLabs, etc.
- **Messaging Platforms** — tokens de bot do Telegram, Discord, Slack, etc.
- **Agent Settings** — variáveis de ambiente não secretas, como `API_SERVER_ENABLED`

Cada chave mostra:
- Se está definida no momento (com uma prévia redigida do valor)
- Uma descrição do que ela é
- Um link para a página de cadastro/obtenção de chave do provedor
- Um campo de entrada para definir ou atualizar o valor
- Um botão de exclusão para removê-la

Chaves avançadas/raramente usadas ficam ocultas por padrão, atrás de um toggle.

### Sessions

Navegue e inspecione todas as sessões do agente. Cada linha mostra o título da sessão, o ícone da plataforma de origem (CLI, Telegram, Discord, Slack, cron), o nome do modelo, a contagem de mensagens, a contagem de chamadas de ferramenta e há quanto tempo ela esteve ativa. Sessões ao vivo são marcadas com um selo pulsante.

- **Filter** — as abas **Chats / Automation / All** delimitam a lista: *Chats* (o padrão) mostra conversas humanas e oculta o ruído de automação (cron, tool, API, sessões ACP); *Automation* mostra somente essas; *All* mostra tudo. Um dropdown de origem exata restringe ainda mais para um único canal (por exemplo, apenas Telegram). A busca respeita o filtro ativo.
- **Search** — busca de texto completo em todo o conteúdo das mensagens usando FTS5. Os resultados mostram trechos destacados e rolam automaticamente até a primeira mensagem correspondente quando expandidos.
- **Stats** — uma barra de resumo mostra o total de sessões, quantas estão ativas no armazenamento, a contagem de arquivadas, o total de mensagens e uma divisão por origem.
- **Expand** — clique em uma sessão para carregar seu histórico completo de mensagens. As mensagens são coloridas por função (user, assistant, system, tool) e renderizadas como Markdown com realce de sintaxe.
- **Tool calls** — mensagens do assistente com chamadas de ferramenta mostram blocos recolhíveis com o nome da função e os argumentos JSON.
- **Rename** — define ou limpa o título de uma sessão diretamente na linha (ícone de lápis).
- **Export** — baixa uma sessão (metadados + histórico completo de mensagens) como JSON (ícone de download).
- **Prune** — o botão "Prune old sessions" no cabeçalho exclui sessões encerradas com mais de N dias.
- **Delete** — remove uma sessão e seu histórico de mensagens com o ícone de lixeira.

![Sessions admin page — stats bar, prune, and per-row rename / export / delete](/img/dashboard/admin-sessions.png)

### Logs

Visualize os arquivos de log do agente, do gateway e de erros, com filtragem e acompanhamento ao vivo (live tailing).

- **File** — alterna entre os arquivos de log `agent`, `errors` e `gateway`
- **Level** — filtra por nível de log: ALL, DEBUG, INFO, WARNING ou ERROR
- **Component** — filtra pelo componente de origem: all, gateway, agent, tools, cli ou cron
- **Lines** — escolhe quantas linhas exibir (50, 100, 200 ou 500)
- **Auto-refresh** — ativa o acompanhamento ao vivo, que verifica novas linhas de log a cada 5 segundos
- **Color-coded** — as linhas de log são coloridas por severidade (vermelho para erros, amarelo para avisos, apagado para debug)

### Analytics

Análises de uso e custo calculadas a partir do histórico de sessões. Selecione um período (7, 30 ou 90 dias) para ver:

- **Summary cards** — total de tokens (entrada/saída), percentual de acerto de cache, custo total estimado ou real, e contagem total de sessões com média diária
- **Daily token chart** — gráfico de barras empilhadas mostrando o uso de tokens de entrada e saída por dia, com tooltips ao passar o mouse mostrando as divisões e o custo
- **Daily breakdown table** — data, contagem de sessões, tokens de entrada, tokens de saída, taxa de acerto de cache e custo de cada dia
- **Per-model breakdown** — tabela mostrando cada modelo usado, sua contagem de sessões, uso de tokens e custo estimado

### Cron

Crie e gerencie cron jobs agendados que executam prompts do agente em um cronograma recorrente.

- **Create** — preencha um nome (opcional), o prompt, uma expressão cron (por exemplo, `0 9 * * *`) e o destino de entrega (local, Telegram, Discord, Slack ou e-mail)
- **Job list** — cada job mostra seu nome, prévia do prompt, expressão de agendamento, selo de estado (enabled/paused/error), destino de entrega, horário da última execução e horário da próxima execução
- **Pause / Resume** — alterna um job entre os estados ativo e pausado
- **Edit** — abre um modal pré-preenchido para alterar o prompt, o agendamento, o nome ou o destino de entrega de um job
- **Trigger now** — executa imediatamente um job fora do seu cronograma normal
- **Delete** — remove permanentemente um cron job

### Profiles

Crie e gerencie [perfis](../profiles.md) — instâncias isoladas do Work4You com sua própria configuração, skills e sessões.

- **Profile cards** — cada um mostra seu modelo/provedor, contagem de skills, estado do gateway, descrição e selos (active, default, alias)
- **Create** — nome + opções opcionais de clonar do padrão / clonar tudo / sem skills empacotadas, descrição e modelo; a página dedicada Profile Builder (`/profiles/new`) oferece o fluxo completo (modelo, MCPs, skills)
- **Manage skills & tools** — leva à página Skills restrita a esse perfil (define o seletor de perfil da barra lateral)
- **Set as active** — altera o padrão fixo que **futuras execuções de CLI/gateway** vão usar (o mesmo que `work4you profile use`). Isso *não* muda o que o dashboard gerencia — isso é função do seletor de perfil
- **Edit model / description / SOUL** — editores inline que gravam nesse perfil
- **Rename / Delete** — apenas para perfis nomeados

### Skills

Navegue, pesquise e ative/desative skills e toolsets instalados, e instale novos a partir do hub. As skills são carregadas de `~/.work4you/skills/` e agrupadas por categoria.

- **Search** — filtra skills e toolsets instalados por nome, descrição ou categoria
- **Category filter** — clique nos pills de categoria para restringir a lista (por exemplo, MLOps, MCP, Red Teaming, AI)
- **Toggle** — habilita ou desabilita skills individuais com um switch. As alterações entram em vigor na próxima sessão.
- **Toolsets** — uma visão separada mostra os toolsets embutidos (operações de arquivo, navegação web, etc.) com seu status ativo/inativo, requisitos de configuração e lista de ferramentas incluídas
- **Browse hub** — uma terceira visão pesquisa o hub de skills em todas as fontes (o mesmo que `work4you skills search`), instala qualquer resultado pelo identificador com um log de instalação ao vivo, e oferece um botão "Update all" para atualizar as skills instaladas.

![Skills admin page — the Browse hub view: search, install, and update](/img/dashboard/admin-skills-hub.png)

### MCP

Gerencie servidores [MCP](./mcp) sem a CLI. O mesmo bloco `mcp_servers`
no `config.yaml` que `work4you mcp` lê.

**Seus servidores MCP:**

- **Add** — registra um servidor HTTP/SSE (URL) ou um servidor stdio (comando + argumentos), com variáveis de ambiente `KEY=VALUE` opcionais para servidores stdio
- **Enable / disable** — ativa ou desativa um servidor sem excluí-lo. Um servidor desativado permanece na configuração, então você pode reativá-lo depois. Entra em vigor no próximo reinício do gateway.
- **Test** — conecta a um servidor, lista suas ferramentas e desconecta — verifica a conexão antes de o agente depender dela
- **Remove** — exclui um servidor da configuração
- Valores de ambiente com formato de segredo são redigidos na visão de lista

**Catalog:** navegue pelo catálogo de servidores MCP aprovados pelo Work4You (o catálogo `optional-mcps/`
empacotado) e instale qualquer um deles com um clique. Entradas que precisam de chaves de API
solicitam-nas inline; os valores vão para o `.env`. Este é o mesmo catálogo que
`work4you mcp catalog` / `work4you mcp install` usam.

![MCP admin page — your servers with enable/disable toggles, plus the install catalog](/img/dashboard/admin-mcp.png)

### Webhooks

Gerencia [assinaturas de webhook](/user-guide/messaging/webhooks) dinâmicas. A
plataforma de webhook precisa estar habilitada nas configurações de mensageria primeiro; a página mostra
uma dica quando não está.

- **Create** — nome, descrição, filtro de evento, destino de entrega, modo de entrega direta opcional e um prompt de agente. Na criação, a página exibe a URL da rota e o segredo HMAC de uso único para copiar.
- **Enable / disable** — ativa ou desativa uma assinatura. Rotas desativadas permanecem no arquivo de assinaturas, mas o gateway rejeita seus eventos recebidos (403). O gateway recarrega o arquivo automaticamente (hot-reload), então a alteração entra em vigor no próximo evento — sem necessidade de reinício.
- **List** — cada assinatura mostra sua URL, eventos e destino de entrega
- **Delete** — remove uma assinatura

![Webhooks admin page — subscriptions with enable/disable toggles](/img/dashboard/admin-webhooks.png)

### Pairing

Aprove e revogue usuários de mensageria sem a CLI — como um administrador
remoto integra usuários de Telegram/Discord/etc. a um gateway pareado. Paridade total com
`work4you pairing`.

- **Pending requests** — cada uma mostra plataforma, código, usuário e idade, com um botão Approve
- **Approved users** — cada um mostra plataforma e usuário, com um botão Revoke
- **Clear pending** — descarta todos os códigos de pareamento pendentes

![Pairing admin page](/img/dashboard/admin-pairing.png)

### Channels

Conecte o Work4You a qualquer plataforma de mensagens pelo navegador — paridade total com
`work4you setup gateway`. A página lista todo canal suportado (Telegram,
Discord, Slack, Matrix, Mattermost, WhatsApp, Signal, BlueBubbles/iMessage,
Email, SMS/Twilio, DingTalk, Feishu/Lark, WeCom, WeChat, QQ Bot, Yuanbao, além
do servidor de API e endpoints de webhook) com seu status de conexão ao vivo.

- **Configure** — abre um formulário por plataforma com exatamente os campos que aquele canal precisa (token de bot, token de app, URL do servidor, lista de permissões, etc.). Segredos são renderizados como campos de senha e armazenados de forma redigida; deixar um campo em branco mantém o valor existente. Campos obrigatórios são marcados e validados. Um link "Setup guide" aponta para a documentação de credenciais da plataforma.
- **Enable / disable** — ativa ou desativa um canal. A credencial permanece no disco; somente o estado ativo muda.
- **Test** — verifica se o canal está configurado, habilitado e reportando uma conexão ao vivo do gateway.
- **Restart gateway** — as credenciais são gravadas em `~/.work4you/.env` e a flag de habilitação no `config.yaml`; o gateway conecta cada canal habilitado no próximo reinício, que você pode disparar diretamente pela página.

![Channels admin page — every messaging platform with status, enable toggles, and per-platform setup forms](/img/dashboard/admin-channels.png)

### System

Um painel de administração consolidado para operações de toda a instalação:

- **Host** — estatísticas do sistema ao vivo: SO / kernel, arquitetura, hostname, versões do Python e do Work4You, contagem de núcleos de CPU + utilização, memória, uso de disco do diretório home do Work4You, tempo de atividade e carga média. (CPU/memória/disco vêm do `psutil` quando instalado; os campos de identidade são sempre exibidos.) A versão do Work4You mostra um **selo de status de atualização** (atualizado / N commits atrás) e um botão **Check for updates**. Quando uma atualização está disponível em uma instalação via git, um botão **Update now** abre um diálogo de confirmação — mostrando quantos commits serão puxados — antes de executar `work4you update` em segundo plano. Em instalações Docker/Nix, o dashboard não pode aplicar a atualização no local, então mostra o comando correto fora de banda (out-of-band) em vez disso.
- **Work4You Portal** — status de login, o provedor de inferência ativo e a tabela de roteamento do Tool Gateway (quais ferramentas rodam via o Portal vs. localmente), com um link para gerenciar sua assinatura. Espelho somente leitura de `work4you portal`.
- **Skill curator** — o status de manutenção de skills em segundo plano (ativo / pausado, intervalo, última execução) com pausar/retomar e um botão de executar agora. Espelha `work4you curator`.
- **Gateway** — inicia, para e reinicia o gateway de mensageria, com status ao vivo (em execução/parado, PID, estado)
- **Memory** — escolhe o provedor de memória externo (ou apenas o embutido), e reseta os armazenamentos embutidos `MEMORY.md` / `USER.md`
- **Credential pool** — adiciona e remove as chaves de API rotativas pelas quais o agente circula (por provedor). As chaves são redigidas na lista; o valor bruto só chega ao agente.
- **Operations** — executa `doctor`, uma auditoria de segurança, cria um backup, restaura a partir de um arquivo de backup, atualiza skills, mostra a divisão de tamanho do system prompt, gera um dump de suporte, ou migra a configuração de ajustes descontinuados. Cada ação inicia uma tarefa em segundo plano cujo log ao vivo é transmitido para a página.
- **Checkpoints** — vê o tamanho do armazenamento sombra (shadow store) do `/rollback` e faz sua limpeza
- **Shell hooks** — lista os hooks configurados com seu status de consentimento + executável, **cria** um hook (evento, comando, matcher, timeout, com uma concessão de consentimento opt-in), e remove um. Hooks executam comandos arbitrários, então o formulário de criação traz um aviso de segurança e o hook só dispara depois que o consentimento é concedido.

![System admin page — host stats and Work4You Portal status](/img/dashboard/admin-system-top.png)

![System admin page — skill curator, gateway, memory, and credential pool](/img/dashboard/admin-system-curator.png)

![System admin page — operations, checkpoints, and shell hooks](/img/dashboard/admin-system-ops.png)

Criando um shell hook (observe a caixa de consentimento e o aviso de execução de comandos arbitrários):

![New shell hook modal](/img/dashboard/admin-hook-create.png)

:::warning Security
O web dashboard lê e grava seu arquivo `.env`, que contém chaves de API e segredos. Por padrão, ele se vincula a `127.0.0.1` — acessível somente a partir da sua máquina local, sem exigir login. Vincular a qualquer endereço não-loopback (incluindo `0.0.0.0`) ativa o [gate de autenticação](#authentication-gated-mode): o servidor se recusa a iniciar até que um provedor de autenticação (usuário/senha ou OAuth) seja configurado.
:::

## Slash Command `/reload`

O PR do dashboard também adiciona um slash command `/reload` à CLI interativa. Depois de alterar chaves de API pelo web dashboard (ou editando o `.env` diretamente), use `/reload` em uma sessão de CLI ativa para captar as alterações sem reiniciar:

```
You → /reload
  Reloaded .env (3 var(s) updated)
```

Isso relê `~/.work4you/.env` no ambiente do processo em execução. Útil quando você adicionou uma nova chave de provedor pelo dashboard e quer usá-la imediatamente.

## REST API

O web dashboard expõe uma REST API que o frontend consome. Você também pode chamar esses endpoints diretamente para automação:

:::tip Endpoints restritos por perfil
As famílias de endpoints de gerenciamento — `/api/config`, `/api/env`, `/api/skills`,
`/api/tools/toolsets`, `/api/mcp` e `/api/model/{info,options,auxiliary,set}` —
aceitam um parâmetro de query opcional `?profile=<name>` (ou `"profile"` no
corpo JSON para gravações) que restringe a leitura/escrita ao `WORK4YOU_HOME` daquele
perfil. Omitido = o próprio perfil do dashboard. Nomes de perfil desconhecidos
retornam `404`. O WebSocket `/api/pty` aceita o mesmo parâmetro para iniciar
um chat sob o perfil selecionado.
:::

### GET /api/status

Retorna a versão do agente, o status do gateway, os estados das plataformas e a contagem de sessões ativas.

A resposta também traz dois blocos de recursos consultivos (eles nunca afetam o
veredito de saúde `components`/`overall`):

- **`memory`** — extraído do heartbeat de 30 segundos do gateway e do
  ledger de ciclo de vida. Campos: `pressure` (`ok` / `elevated` / `critical` /
  `unknown`), `gateway_rss_mb`, `system_total_mb`, `system_available_mb`,
  `swap_used_mb`, `sampled_at`, `boot_id`, `last_boot_unclean`,
  `last_boot_suspected_oom`. Pressure é `elevated` abaixo de 128 MiB (ou 15%) de
  memória disponível do sistema e `critical` abaixo de 64 MiB (ou 5%) — os mesmos
  níveis nos quais uma saída não limpa subsequente seria sinalizada como uma suspeita de
  OOM kill. Heartbeats com mais de 150 segundos (ou com data futura) mantêm seus
  números, mas rebaixam `pressure` para `unknown`, então a última amostra de um gateway
  morto não pode se passar por uma leitura ao vivo.
- **`disk`** — uma amostra ao vivo de `shutil.disk_usage()` do volume que hospeda
  `~/.work4you`. Campos: `pressure`, `free_mb`, `total_mb`, `used_percent`,
  `sampled_at`. Pressure é `elevated` abaixo de 512 MB livres (ou ≥85% usado com
  menos de 4 GB de folga) e `critical` abaixo de 256 MB livres (ou ≥95% usado com
  menos de 1 GB de folga).

Ambos os coletores são fail-safe: qualquer erro de amostragem rebaixa o bloco para
`{"pressure": "unknown"}` em vez de falhar o endpoint de status. Os números
são grosseiros (MB inteiros, porcentagem inteira), já que `/api/status` é público.

### GET /api/sessions

Retorna as 20 sessões mais recentes com metadados (modelo, contagens de tokens, timestamps, prévia).

### GET /api/config

Retorna o conteúdo atual do `config.yaml` como JSON.

### GET /api/config/defaults

Retorna os valores de configuração padrão.

### GET /api/config/schema

Retorna um schema descrevendo cada campo de configuração — tipo, descrição, categoria e opções de seleção quando aplicável. O frontend usa isso para renderizar o widget de entrada correto para cada campo.

### PUT /api/config

Salva uma nova configuração. Corpo: `{"config": {...}}`.

### GET /api/env

Retorna todas as variáveis de ambiente conhecidas com seu status definido/não definido, valores redigidos, descrições e categorias.

### PUT /api/env

Define uma variável de ambiente. Corpo: `{"key": "VAR_NAME", "value": "secret"}`.

### DELETE /api/env

Remove uma variável de ambiente. Corpo: `{"key": "VAR_NAME"}`.

### GET /api/sessions/\{session_id\}

Retorna metadados de uma única sessão.

### GET /api/sessions/\{session_id\}/messages

Retorna uma página limitada do histórico de mensagens, incluindo chamadas de ferramenta e timestamps. Por padrão, retorna as 500 mensagens mais recentes em ordem cronológica. Use `limit` (máximo 500), `offset` e `order=oldest|latest` para paginação explícita.

### GET /api/sessions/search

Busca de texto completo no conteúdo das mensagens. Parâmetro de query: `q`. Retorna os IDs das sessões correspondentes com trechos destacados.

### DELETE /api/sessions/\{session_id\}

Exclui uma sessão e seu histórico de mensagens.

### GET /api/logs

Retorna linhas de log. Parâmetros de query: `file` (agent/errors/gateway), `lines` (quantidade), `level`, `component`.

### GET /api/analytics/usage

Retorna análises de uso de tokens, custo e sessões. Parâmetro de query: `days` (padrão 30). A resposta inclui divisões diárias e agregados por modelo.

### GET /api/cron/jobs

Retorna todos os cron jobs configurados com seu estado, agendamento e histórico de execuções.

### POST /api/cron/jobs

Cria um novo cron job. Corpo: `{"prompt": "...", "schedule": "0 9 * * *", "name": "...", "deliver": "local"}`.

### POST /api/cron/jobs/\{job_id\}/pause

Pausa um cron job.

### POST /api/cron/jobs/\{job_id\}/resume

Retoma um cron job pausado.

### POST /api/cron/jobs/\{job_id\}/trigger

Dispara imediatamente um cron job fora do seu agendamento.

### DELETE /api/cron/jobs/\{job_id\}

Exclui um cron job.

### GET /api/skills

Retorna todas as skills com seu nome, descrição, categoria e status de habilitação.

### PUT /api/skills/toggle

Habilita ou desabilita uma skill. Corpo: `{"name": "skill-name", "enabled": true}`.

### GET /api/tools/toolsets

Retorna todos os toolsets com seu label, descrição, lista de ferramentas e status ativo/configurado.

### Admin endpoints

Esses endpoints alimentam as páginas MCP, Channels, Webhooks, Pairing e System. Todos ficam atrás do
mesmo gate de autenticação que o restante de `/api/`.

| Method & path | Purpose |
|---------------|---------|
| `GET /api/mcp/servers` | Lista os servidores MCP configurados (valores de ambiente redigidos) |
| `POST /api/mcp/servers` | Adiciona um servidor. Corpo: `{name, url?, command?, args?, env?, auth?}` |
| `POST /api/mcp/servers/{name}/test` | Conecta, lista ferramentas, desconecta |
| `PUT /api/mcp/servers/{name}/enabled` | Habilita / desabilita um servidor |
| `DELETE /api/mcp/servers/{name}` | Remove um servidor |
| `GET /api/mcp/catalog` | Navega pelo catálogo MCP aprovado pelo Work4You |
| `POST /api/mcp/catalog/install` | Instala uma entrada do catálogo (com o ambiente necessário) |
| `GET /api/messaging/platforms` | Lista todo canal de mensageria com status + campos de configuração por plataforma |
| `PUT /api/messaging/platforms/{id}` | Configura um canal. Corpo: `{enabled?, env?, clear_env?}` (env grava no `.env`, enabled no `config.yaml`) |
| `POST /api/messaging/platforms/{id}/test` | Reporta se um canal está configurado, habilitado e conectado |
| `GET /api/pairing` | Lista usuários de mensageria pendentes + aprovados |
| `POST /api/pairing/approve` | Aprova um código. Corpo: `{platform, code}` |
| `POST /api/pairing/revoke` | Revoga um usuário. Corpo: `{platform, user_id}` |
| `POST /api/pairing/clear-pending` | Descarta todos os códigos pendentes |
| `GET /api/webhooks` | Lista assinaturas + status de habilitação por plataforma |
| `POST /api/webhooks` | Cria uma assinatura (retorna o segredo de uso único) |
| `DELETE /api/webhooks/{name}` | Remove uma assinatura |
| `GET /api/credentials/pool` | Lista as chaves de rotação agrupadas (redigidas) |
| `POST /api/credentials/pool` | Adiciona uma chave. Corpo: `{provider, api_key, label?}` |
| `DELETE /api/credentials/pool/{provider}/{index}` | Remove uma chave (índice baseado em 1) |
| `GET /api/memory` | Provedor ativo + provedores disponíveis + tamanhos dos arquivos embutidos |
| `PUT /api/memory/provider` | Seleciona um provedor (vazio = apenas embutido) |
| `POST /api/memory/reset` | Reseta a memória embutida. Corpo: `{target: all\|memory\|user}` |
| `POST /api/gateway/start` · `/stop` · `/restart` | Ciclo de vida do gateway (em segundo plano) |
| `POST /api/ops/doctor` · `/security-audit` · `/backup` · `/import` | Diagnóstico e manutenção (em segundo plano; acompanhe via `/api/actions/{name}/status`) |
| `GET /api/ops/hooks` | Shell hooks configurados + status da lista de permissões |
| `GET /api/ops/checkpoints` · `POST .../prune` | Inspeciona / limpa o armazenamento do `/rollback` |
| `POST /api/ops/hooks` · `DELETE /api/ops/hooks` | Cria / remove um shell hook (protegido por consentimento) |
| `GET /api/system/stats` | Estatísticas do host — SO, CPU, memória, disco, tempo de atividade |
| `GET /api/work4you/update/check` | Reporta a disponibilidade de atualização (commits atrás, método de instalação) sem aplicar. Para instalações via git que estão atrasadas, também retorna uma lista `commits` (`sha`, `summary`, `author`, `at`) do que mudou. `?force=1` invalida o cache de 6h |
| `GET /api/curator` · `PUT .../paused` · `POST .../run` | Status do skill curator + pausar/retomar + executar |
| `GET /api/portal` | Autenticação do Work4You Portal + roteamento do Tool Gateway (somente leitura) |
| `POST /api/ops/prompt-size` · `/dump` · `/config-migrate` | Diagnóstico (em segundo plano) |
| `PUT /api/webhooks/{name}/enabled` | Habilita / desabilita uma rota de webhook |
| `POST /api/skills/hub/install` · `/uninstall` · `/update` | Ações do hub de skills (em segundo plano) |
| `GET /api/skills/hub/search` | Pesquisa o hub de skills em todas as fontes |
| `GET /api/sessions/stats` | Estatísticas do armazenamento de sessões |
| `PATCH /api/sessions/{id}` | Renomeia / arquiva uma sessão |
| `GET /api/sessions/{id}/export` | Exporta uma sessão (metadados + mensagens) como JSON |
| `POST /api/sessions/prune` | Exclui sessões encerradas com mais de N dias |
| `PUT /api/cron/jobs/{id}` | Edita o prompt / agendamento / nome / entrega de um cron job |

## Autenticação (modo com gate)

Quando o dashboard é vinculado a um endereço público ou não-loopback — qualquer coisa além de `127.0.0.1` / `localhost` —, o Work4You ativa um gate de autenticação. Toda requisição precisa carregar um cookie de sessão verificado, ou é redirecionada para a página de login. Três provedores vêm prontos:

- **[Usuário/senha](#usernamepassword-provider-no-oauth-idp)** — a forma mais simples de colocar autenticação em um dashboard self-hosted / on-prem / homelab. Sem provedor de identidade externo. **Use apenas em uma rede confiável ou atrás de uma VPN — não para exposição na internet pública.**
- **[OAuth (Work4You Portal)](#default-provider-work4you-research)** — para implantações hospedadas e qualquer dashboard acessível pela internet pública, e o caminho recomendado para uma [conexão remota do Work4You Desktop](#connecting-work4you-desktop-to-a-remote-backend). Todo login é verificado contra sua conta Work4You, então este é o provedor adequado para uso voltado à internet.
- **[OIDC self-hosted](#self-hosted-oidc-provider)** — para trazer seu próprio provedor de identidade via OpenID Connect padrão (Keycloak, Auth0, Okta, Google, GitHub via uma ponte OIDC, etc.). Sem envolvimento do Work4You Portal; adequado para exposição na internet pública quando protegido por um servidor OIDC compatível.

Dashboards administrados pelo próprio operador e vinculados a loopback não são afetados — sem autenticação, sem página de login.

### Quando o gate entra em ação

| Flags | Gate de autenticação | Caso de uso |
|-------|-----------|----------|
| `work4you dashboard` (padrão — vincula a `127.0.0.1`) | DESLIGADO | Desenvolvimento local |
| `work4you dashboard --host 0.0.0.0` | **LIGADO** | Remoto / produção — proteja com o provedor de usuário/senha ou OAuth |

O gate fica ligado se e somente se o host de bind não for `127.0.0.1`, `::1` ou `localhost`. Vincular a `0.0.0.0` (ou qualquer endereço RFC1918 / LAN) ativa o gate. A flag legada `--insecure` **não desativa mais o gate** — ela é aceita por compatibilidade retroativa, mas ignorada, com um aviso.

:::danger `--insecure` não tem efeito — não desativa a autenticação
Desde o endurecimento de segurança de junho de 2026, `--insecure` não contorna mais a autenticação do dashboard: um bind não-loopback sempre exige um provedor de autenticação (o provedor de usuário/senha ou OAuth). Se você quer um dashboard sem autenticação, vincule a `127.0.0.1` e alcance-o por um túnel SSH ou Tailscale.
:::

### Semântica fail-closed

Se o gate deveria entrar em ação, mas **nenhum** `DashboardAuthProvider` está registrado (nenhum plugin do Work4You, nenhum plugin personalizado), `work4you dashboard` se recusa a vincular, com uma mensagem de erro explícita. Não existe um fallback "nega por padrão, mas aceita tudo" — um dashboard com gate mal configurado nunca inicia.

Quando você executa `work4you dashboard --host 0.0.0.0` **interativamente** (um terminal de verdade) e nenhum provedor está configurado ainda, o Work4You não simplesmente falha — ele se oferece para configurar um na hora: escolha **username & password** (grava `dashboard.basic_auth` no `config.yaml` e você já está rodando em segundos) ou **OAuth** (direciona você para `work4you dashboard register`). Chamadores não interativos — Docker/s6, CI, execuções via pipe — pulam o prompt e caem direto no erro fail-closed acima, então uma implantação sem supervisão nunca inicia sem autenticação.

### Provedor padrão: Work4You

O plugin `plugins/dashboard_auth/work4you` empacotado é **sempre instalado** e carregado automaticamente. Ele registra automaticamente um `DashboardAuthProvider` chamado `work4you` quando um client ID está configurado.

Como todo login é verificado contra o Work4You Portal e protegido pela sua conta Work4You, **o provedor Work4You é o adequado para expor um dashboard à internet pública.**

#### Registrando um dashboard

Para usar o provedor Work4You, você precisa de um client ID OAuth (formato `agent:{id}`). Há duas formas de obter um:

- **CLI — `work4you dashboard register`.** Execute-o na máquina onde o dashboard reside. Ele resolve seu login existente no Work4You (execute `work4you setup` primeiro, se ainda não estiver logado), registra um cliente OAuth self-hosted junto ao Portal, e grava `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` em `~/.work4you/.env` para você. Flags opcionais: `--name` (um rótulo legível, gerado automaticamente caso contrário) e `--redirect-uri` (uma URL de callback HTTPS pública, para um host voltado à internet).

  ```bash
  work4you dashboard register
  # ✓ Registered dashboard "swift_falcon"
  # …writes WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID to ~/.work4you/.env
  ```

- **GUI — a página Local Dashboards.** Abra [`/local-dashboards`](https://portal.work4you.ai/local-dashboards) no Work4You Portal para registrar, nomear, gerenciar e revogar dashboards self-hosted pelo navegador. Copie o client ID `agent:{id}` resultante para `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` (env) ou `dashboard.oauth.client_id` (config.yaml). É também aqui que você revoga um dashboard registrado via CLI.

#### Configuração

O plugin lê de duas superfícies, com a variável de ambiente prevalecendo quando definida como não vazia:

**`config.yaml`** — a superfície canônica:

```yaml
dashboard:
  oauth:
    client_id: agent:01HXYZ…             # required to engage the gate
```

**Variáveis de ambiente** — sobrescritas do operador:

| Env var | Overrides | Format | Provisioned by |
|---------|-----------|--------|----------------|
| `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` | `dashboard.oauth.client_id` | `agent:{instance_id}` | `work4you dashboard register` |

Seguindo a convenção do Work4You (`~/.work4you/.env` serve apenas para chaves de API / segredos), **`config.yaml` é o lugar recomendado para definir esses valores** para desenvolvimento local, on-prem e qualquer implantação que você controla diretamente. O caminho da variável de ambiente existe para que a injeção de segredos de uma plataforma de hospedagem possa enviar `client_id`s por implantação sem que ninguém precise editar o `config.yaml` dentro da imagem — esse é seu propósito principal.

Valores de ambiente vazios são tratados como não definidos, então um segredo provisionado mas não preenchido em uma plataforma não pode sombrear acidentalmente uma entrada válida no `config.yaml`.

Se nenhuma das duas fontes fornecer um client_id, o plugin reporta o motivo específico e o erro de bind fail-closed do dashboard diz exatamente o que corrigir:

```
Refusing to bind dashboard to 0.0.0.0 — the auth gate engages on
non-loopback binds, but no auth providers are registered.

Bundled providers reported these issues:
  • work4you: WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID is not set (and
    dashboard.oauth.client_id in config.yaml is empty). …

Configure an auth provider before exposing the dashboard:
  • Password: set dashboard.basic_auth.username + password_hash in config.yaml
  • OAuth: run `work4you dashboard register` (Work4You Portal) or install a
    DashboardAuthProvider plugin.
There is no unauthenticated public-bind option — to keep it local, bind
127.0.0.1 and tunnel in (SSH / Tailscale).
```

#### Exemplo prático: Work4You

De uma instalação do Work4You já logada até um dashboard protegido pelo Work4You em três passos.

**1. Faça login e registre o dashboard.** `work4you dashboard register` usa seu login existente no Work4You para provisionar um cliente OAuth e grava `WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID` em `~/.work4you/.env` para você:

```bash
work4you setup            # if you're not already logged into Work4You Portal
work4you dashboard register
# ✓ Registered dashboard "swift_falcon"
# …writes WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID to ~/.work4you/.env
```

**2. Execute o dashboard em um endereço alcançável.** Um bind não-loopback ativa o gate OAuth, e o `client_id` recém-gravado ativa o provedor `work4you`:

```bash
work4you dashboard --host 0.0.0.0 --port 9119 --no-open
```

**3. Faça login.** Abra `http://<host>:9119/`, você será redirecionado para `/login`. Clique em **Sign in with Work4You** → autentique-se no Portal → volte para o dashboard autenticado. Verifique o gate a partir de qualquer máquina:

```bash
curl -s http://<host>:9119/api/status | jq '.auth_required, .auth_providers'
# true
# ["work4you"]
```

`GET /api/auth/me` então retorna a sessão verificada (`provider: work4you`). Para um host voltado à internet, registre com `--redirect-uri https://work4you.example.com/auth/callback` e defina `WORK4YOU_DASHBOARD_PUBLIC_URL` para que o callback OAuth resolva para sua URL pública (veja [Sobrescrita de URL pública](#public-url-override)).

### Provedor de usuário/senha (sem IDP OAuth)

Se você não quer configurar um provedor de identidade OAuth — uma implantação self-hosted do tipo "apenas coloque uma senha no meu dashboard" —, o plugin `plugins/dashboard_auth/basic` empacotado registra um `DashboardAuthProvider` chamado `basic` que autentica com **usuário e senha** em vez de um redirecionamento OAuth.

Ele se conecta ao mesmo gate que o provedor OAuth: o gate entra em ação em um bind não-loopback, a página de login renderiza um formulário de credenciais para esse provedor (em vez de um botão "Log in with X"), e tudo depois do login — cookies de sessão, renovação transparente, tickets de WS, logout, o log de auditoria — é idêntico ao caminho OAuth. As sessões são tokens stateless assinados por HMAC que o próprio provedor emite, então não há **banco de dados nem IDP externo**. O hashing de senha usa `scrypt` da biblioteca padrão (sem dependência de terceiros).

:::warning Use isso apenas em redes confiáveis — não na internet pública
O provedor de usuário/senha é destinado a dashboards self-hosted / on-prem / homelab em uma rede **confiável**, ou acessíveis apenas por **VPN**. Ele protege uma única credencial compartilhada sem provedor de identidade externo, MFA ou contas por usuário por trás dela, então **não é adequado para expor um dashboard diretamente à internet pública**. Para um dashboard voltado à internet, use o [provedor Work4You](#default-provider-work4you-research) (ou seu próprio provedor [OIDC self-hosted](#self-hosted-oidc-provider) / [OAuth personalizado](#custom-providers)) em vez disso.
:::

#### Configuração

Assim como o provedor Work4You, ele lê de `config.yaml` (canônico), com as variáveis de ambiente prevalecendo quando definidas como não vazias. Ele se ativa somente quando `username` mais `password_hash` (preferido) ou `password` estão configurados — caso contrário, é um no-op, então usuários OAuth e operadores loopback não são afetados.

**`config.yaml`:**

```yaml
dashboard:
  basic_auth:
    username: admin
    # Preferred — no plaintext at rest. Compute with:
    #   python -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('PW'))"
    password_hash: "scrypt$16384$8$1$…$…"
    # ...or a plaintext password (hashed in-memory at load; less safe at rest):
    # password: "s3cret"
    secret: "<32+ random bytes, base64 or hex>"  # token-signing key
    session_ttl_seconds: 43200                    # optional; access-token lifetime (default 12h)
```

**Sobrescritas de ambiente:**

| Env var | Overrides | Notes |
|---------|-----------|-------|
| `WORK4YOU_DASHBOARD_BASIC_AUTH_USERNAME` | `dashboard.basic_auth.username` | necessário para ativar |
| `WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD_HASH` | `dashboard.basic_auth.password_hash` | preferido (sem texto puro em repouso) |
| `WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD` | `dashboard.basic_auth.password` | texto puro; **prevalece sobre um `password_hash` do config**, para que você possa rotacionar via env |
| `WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET` | `dashboard.basic_auth.secret` | chave de assinatura do token |
| `WORK4YOU_DASHBOARD_BASIC_AUTH_TTL_SECONDS` | `dashboard.basic_auth.session_ttl_seconds` | tempo de vida do access token |

:::caution Defina um `secret` explícito para sessões estáveis
Quando `secret` está vazio, uma chave de assinatura aleatória por processo é gerada. Isso é aceitável para um único processo, mas significa que **toda sessão é invalidada a cada reinício** e sessões **não se estendem entre múltiplos workers**. Defina um `secret` explícito para implantações que sobrevivem a reinícios / com múltiplos workers.
:::

O endpoint `/auth/password-login` tem limite de taxa por IP de cliente (padrão 10 tentativas/minuto → HTTP 429) e retorna um único `401 Invalid credentials` genérico tanto para usuários desconhecidos quanto para senhas erradas, então não pode ser usado como um oráculo de enumeração de usuários.

#### Exemplo prático: usuário/senha

Do zero a um dashboard protegido por senha em uma rede confiável, em três passos.

**1. Defina as credenciais em `~/.work4you/.env`.** Faça o hash da senha para que nenhum texto puro fique em repouso, e defina um segredo de assinatura estável para que as sessões sobrevivam a reinícios:

```bash
# Compute a scrypt hash of your chosen password:
HASH=$(python -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('choose-a-strong-password'))")

cat >> ~/.work4you/.env <<EOF
WORK4YOU_DASHBOARD_BASIC_AUTH_USERNAME=admin
WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD_HASH=$HASH
WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 ~/.work4you/.env
```

**2. Execute o dashboard em um endereço alcançável.** Um bind não-loopback ativa o gate, e o usuário + hash ativam o provedor `basic`:

```bash
work4you dashboard --host 0.0.0.0 --port 9119 --no-open
```

**3. Faça login.** Abra `http://<host>:9119/`, você será redirecionado para `/login` — um **formulário de credenciais** (não um botão "Sign in with X"). Digite `admin` / sua senha → chegue ao dashboard autenticado. Verifique o gate a partir de qualquer máquina:

```bash
curl -s http://<host>:9119/api/status | jq '.auth_required, .auth_providers'
# true
# ["basic"]
```

`GET /api/auth/me` então retorna a sessão verificada (`provider: basic`). Mantenha isso atrás de uma VPN — veja o aviso acima; para um host público, use o provedor [Work4You](#default-provider-work4you-research) ou [OIDC self-hosted](#self-hosted-oidc-provider) em vez disso.

#### Escrevendo seu próprio provedor de senha

`basic` é apenas uma implementação de um ponto de extensão. Qualquer plugin pode registrar um provedor de senha: defina `supports_password = True` na sua subclasse de `DashboardAuthProvider` e implemente `complete_password_login(*, username, password) -> Session` (lance `InvalidCredentialsError` em caso de rejeição, `ProviderError` se seu armazenamento de apoio estiver fora do ar). Os métodos OAuth `start_login` / `complete_login` podem ser deixados como stubs `NotImplementedError` para um provedor puramente de senha. Esse é o caminho para bind LDAP, um banco de dados de credenciais, ou qualquer outro esquema de autenticação que não seja por redirecionamento — o framework cuida do formulário, da rota, dos cookies e da renovação para você.

### Provedor OIDC self-hosted

Se você roda seu próprio provedor de identidade, o plugin `plugins/dashboard_auth/self_hosted` empacotado autentica o dashboard contra ele usando **OpenID Connect padrão** — sem código específico por IDP, sem envolvimento do Work4You Portal. Ele é verificado contra, e funciona com, qualquer servidor OIDC compatível:

> **Authentik · Keycloak · Zitadel · Authelia · Auth0 · Okta · Google · …**

Assim como o provedor Work4You, ele carrega automaticamente e só se registra quando está configurado, então é um no-op para dashboards loopback.

#### Configuração

Configure um **issuer** e um **client_id** (um cliente PKCE público — sem client secret). O plugin busca o `authorization_endpoint`, `token_endpoint` e `jwks_uri` do IDP a partir de `{issuer}/.well-known/openid-configuration`, então você nunca codifica URLs de endpoint diretamente.

**`config.yaml`** — a superfície canônica:

```yaml
dashboard:
  oauth:
    provider: self-hosted
    self_hosted:
      issuer: https://auth.example.com/application/o/work4you/   # required
      client_id: work4you-dashboard                              # required
      scopes: "openid profile email"                           # optional (this is the default)
```

**Variáveis de ambiente** — sobrescritas do operador (env prevalece sobre `config.yaml` quando definida como não vazia; um valor vazio é tratado como não definido):

| Env var | Overrides | Notes |
|---------|-----------|-------|
| `WORK4YOU_DASHBOARD_OIDC_ISSUER` | `dashboard.oauth.self_hosted.issuer` | URL do issuer OIDC — obrigatória |
| `WORK4YOU_DASHBOARD_OIDC_CLIENT_ID` | `dashboard.oauth.self_hosted.client_id` | ID do cliente público — obrigatório |
| `WORK4YOU_DASHBOARD_OIDC_SCOPES` | `dashboard.oauth.self_hosted.scopes` | Padrão `openid profile email` |

No seu IDP, registre uma aplicação/cliente **pública** com o grant authorization-code + PKCE (S256) e adicione o callback do dashboard como uma redirect URI permitida. O callback é `<dashboard public URL>/auth/callback` (veja [Sobrescrita de URL pública](#public-url-override) para como o dashboard deriva sua URL pública atrás de um proxy).

#### O que ele verifica

O provedor verifica o **ID token** OpenID Connect (RS256/ES256) contra o `jwks_uri` descoberto, com as claims `iss` e `aud` fixadas ao seu `issuer` e `client_id` configurados. Claims OIDC padrão são mapeadas para a sessão do dashboard:

| Session field | Claim(s) |
|---------------|----------|
| `user_id` | `sub` (obrigatório) |
| `email` | `email` |
| `display_name` | `name` → `preferred_username` → `nickname` → `email` |
| `org_id` | `org_id` / `organization`, senão `groups` unidos |

O ID token é o que estabelece a identidade — o access token é tratado como opaco (a especificação OIDC não exige que seja um JWT). URLs de endpoint precisam ser HTTPS (issuer loopback `http://` é permitido para IDPs de desenvolvimento local), e o `issuer` anunciado pelo documento de descoberta precisa coincidir com o configurado por você (uma diferença de barra final é tolerada). Refresh tokens, quando o IDP os emite, são usados para reautenticação silenciosa via o grant `refresh_token` padrão; o logout chama o `revocation_endpoint` RFC 7009 do IDP quando anunciado.

> **Clientes confidenciais** (aqueles com `client_secret`) ainda não são suportados — configure um cliente público + PKCE, que é a escolha típica para um dashboard voltado ao navegador.

#### Exemplo prático: Keycloak

O [Keycloak](https://www.keycloak.org/) é um dos servidores OIDC self-hosted mais fáceis de configurar para um teste local — ele roda como um único container em modo dev (banco de dados em memória) e expõe descoberta OIDC padrão. Este passo a passo leva você do zero a um login funcional no dashboard em poucos minutos.

**1. Rode o Keycloak com um realm pré-configurado.** Salve esta exportação de realm como `realm-work4you.json` — ela define um realm `work4you`, um **cliente público PKCE** (`work4you-dashboard`) e um usuário de teste, todos importados na inicialização, então não há nada para clicar na UI de administração:

```json
{
  "realm": "work4you",
  "enabled": true,
  "clients": [
    {
      "clientId": "work4you-dashboard",
      "name": "Work4You Dashboard",
      "enabled": true,
      "publicClient": true,
      "standardFlowEnabled": true,
      "protocol": "openid-connect",
      "redirectUris": ["http://localhost:9119/auth/callback"],
      "webOrigins": ["http://localhost:9119"],
      "attributes": { "pkce.code.challenge.method": "S256" }
    }
  ],
  "users": [
    {
      "username": "testuser",
      "enabled": true,
      "emailVerified": true,
      "email": "testuser@example.com",
      "firstName": "Test",
      "lastName": "User",
      "credentials": [
        { "type": "password", "value": "testpassword", "temporary": false }
      ]
    }
  ]
}
```

Inicie-o (Keycloak 26+), montando esse arquivo no diretório de importação:

```bash
docker run --rm -p 8080:8080 \
  -e KC_BOOTSTRAP_ADMIN_USERNAME=admin \
  -e KC_BOOTSTRAP_ADMIN_PASSWORD=admin \
  -v "$PWD/realm-work4you.json:/opt/keycloak/data/import/realm-work4you.json:ro" \
  quay.io/keycloak/keycloak:26.0 \
  start-dev --import-realm
```

Uma vez ativo, o realm anuncia a descoberta OIDC padrão em
`http://localhost:8080/realms/work4you/.well-known/openid-configuration` (issuer
`http://localhost:8080/realms/work4you`). O console de administração fica em
`http://localhost:8080/` (`admin` / `admin`).

**2. Aponte o dashboard para ele.** O plugin self-hosted permite um issuer loopback `http://` (HTTPS é obrigatório para qualquer issuer não-loopback), então o Keycloak local funciona como está:

```bash
export WORK4YOU_DASHBOARD_OIDC_ISSUER="http://localhost:8080/realms/work4you"
export WORK4YOU_DASHBOARD_OIDC_CLIENT_ID="work4you-dashboard"
export WORK4YOU_DASHBOARD_PUBLIC_URL="http://localhost:9119"
work4you dashboard --host 0.0.0.0 --port 9119 --no-open
```

`WORK4YOU_DASHBOARD_PUBLIC_URL` informa ao dashboard que seu callback OAuth é
`http://localhost:9119/auth/callback` — a redirect URI que o realm registrou
acima. Vincular a `0.0.0.0` (um bind não-loopback) é o que
ativa o gate OAuth.

**3. Faça login.** Abra `http://localhost:9119/`, você será redirecionado para `/login`. Clique em **Sign in with Self-Hosted OIDC** → autentique-se no Keycloak como `testuser` / `testpassword` → volte para o dashboard autenticado. A barra lateral mostra `Logged in as Test User via self-hosted`, e `GET /api/auth/me` retorna a sessão verificada (`provider: self-hosted`, `email: testuser@example.com`).

> Se você vincular ou navegar em um host/porta diferente, adicione o
> `…/auth/callback` daquela origem às **Valid redirect URIs** do cliente, no console
> de administração do Keycloak (Clients → work4you-dashboard → Settings). O mesmo padrão funciona
> para Authentik, Zitadel, Authelia e outros servidores OIDC — apenas a URL do
> issuer e a UI de registro do cliente diferem.

### Sobrescrita de URL pública

Por padrão, o dashboard reconstrói a URL de callback OAuth a partir da requisição — `X-Forwarded-Host` + `X-Forwarded-Proto` + `X-Forwarded-Prefix` (quando o uvicorn está configurado com `proxy_headers=True`, o que `start_server` habilita sob o gate). Isso funciona sem ajustes atrás de um proxy reverso que define os três cabeçalhos corretamente.

Para implantações atrás de proxies reversos que não encaminham esses cabeçalhos de forma confiável (configurações manuais de nginx, ingresses on-prem, implantações de domínio personalizado com cadeias de proxy parciais), defina `dashboard.public_url` (ou `WORK4YOU_DASHBOARD_PUBLIC_URL`) com a **URL pública completa** pela qual o dashboard é acessado:

```yaml
dashboard:
  public_url: "https://dashboard.example.com/work4you"
```

Quando definida, a URL de callback OAuth se torna `<public_url>/auth/callback` literalmente — `X-Forwarded-Prefix` é ignorado nesse caminho de código porque o operador declarou explicitamente a URL pública. Isso é intencional: empilhar o prefixo por cima duplicaria o prefixo no caso comum em que ele já está embutido em `public_url`.

Mesma precedência dos outros ajustes do dashboard — env prevalece sobre `config.yaml`:

| Surface | Override path | When to use |
|---------|---------------|-------------|
| `dashboard.public_url` no `config.yaml` | `WORK4YOU_DASHBOARD_PUBLIC_URL` | Desenvolvimento local / on-prem (canônico) |
| Variável de ambiente `WORK4YOU_DASHBOARD_PUBLIC_URL` | — | Segredos de plataforma de hospedagem / CI |
| (não definido) | — | Padrão — reconstrói a partir dos cabeçalhos `X-Forwarded-*` |

A validação rejeita valores sem o esquema `http://` / `https://`, sem um host, ou contendo caracteres de aspas / colchetes angulares / espaço em branco / controle. Um valor malformado cai silenciosamente para a reconstrução por cabeçalho, para que o fluxo de login continue funcionando em vez de encaminhar o usuário a uma URL hostil.

> **Nota:** `public_url` sobrescreve apenas a URL de callback OAuth. A flag de cookie `Secure` ainda é controlada por `request.url.scheme` (X-Forwarded-Proto sob proxy_headers), então um `public_url` do tipo `http://` em uma implantação pública com terminação TLS produzirá cookies não-Secure. Essa é uma armadilha do operador — combine `public_url` com terminação TLS adequada a montante.

### Fluxo OAuth

O provedor implementa o [Work4You Portal OAuth contract v1](https://github.com/Work4You/work4you-account-service/blob/main/docs/agent-dashboard-oauth-contract.md) — grant de authorization-code com PKCE (S256):

1. O usuário acessa `/` sem um cookie de sessão → o gate redireciona para `/login`.
2. A página de login mostra um botão "Continue with Work4You" → `/auth/login?provider=work4you`.
3. O servidor guarda o estado PKCE em um cookie de curta duração, redireciona o usuário para `https://portal.work4you.ai/oauth/authorize?…`.
4. O usuário se autentica no Portal, chega em `/auth/callback?code=…&state=…`.
5. O servidor troca o código por um access token em `POST /api/oauth/token`, verifica a assinatura do JWT contra o JWKS do Portal (`/.well-known/jwks.json`), e define o cookie `work4you_session_at`.
6. O usuário é redirecionado para `/` (ou para o caminho de deep-link original via o parâmetro de query `next=`).

Access tokens têm um TTL de 15 minutos. **Não há refresh token no contract v1** — quando o token expira, o wrapper de fetch do SPA detecta o envelope 401 e navega em página completa de volta para `/login` para reexecutar o fluxo.

### Cookies definidos

| Name | Lifetime | Notes |
|------|----------|-------|
| `work4you_session_at` | TTL do token (15 min) | HttpOnly, SameSite=Lax, Secure quando HTTPS |
| `work4you_session_pkce` | 10 min | HttpOnly; guarda o verifier PKCE + a dica de provedor durante o round trip |
| `work4you_session_rt` | não usado na v1 | Reservado para compatibilidade futura; não gravado quando `refresh_token` está vazio |

Todos os três são `Path=/` e `SameSite=Lax`. A flag `Secure` é definida quando o dashboard é acessado via HTTPS (detectado pelo esquema da URL da requisição — respeita `X-Forwarded-Proto` de um terminador TLS a montante sob `proxy_headers=True`).

### Logout

O widget da barra lateral mostra `Logged in as <user_id…> via work4you` com um ícone de logout. Clicar nele faz um POST para `/auth/logout`, que limpa todos os cookies de autenticação do dashboard e redireciona de volta para `/login`.

### Log de auditoria

Todo início, sucesso, falha de login e falha de verificação de sessão é gravado como uma linha JSON em `$WORK4YOU_HOME/logs/dashboard-auth.log`. Campos sensíveis (`access_token`, `refresh_token`, `code`, `code_verifier`, `state`, cabeçalho `Authorization`) são redigidos antes do registro.

### Provedores personalizados

Para conectar um provedor OAuth que não seja o Work4You (por exemplo, Google, GitHub, OIDC personalizado), crie um plugin que registre um `DashboardAuthProvider`:

```python
# ~/.work4you/plugins/dashboard-auth-myidp/__init__.py
from work4you_cli.dashboard_auth import DashboardAuthProvider, Session, LoginStart

class MyIdPProvider(DashboardAuthProvider):
    name = "myidp"
    display_name = "My Identity Provider"

    def start_login(self, *, redirect_uri): ...
    def complete_login(self, *, code, state, code_verifier, redirect_uri): ...
    def verify_session(self, *, access_token): ...
    def refresh_session(self, *, refresh_token): ...
    def revoke_session(self, *, refresh_token): ...

def register(ctx):
    ctx.register_dashboard_auth_provider(MyIdPProvider())
```

A página de login lista todos os provedores registrados; múltiplos provedores podem ser empilhados e o usuário escolhe um em `/login`.

### Autenticação não interativa (bearer token)

Além do login humano interativo (cookies de sessão + renovação), a ABC `DashboardAuthProvider` suporta uma capacidade **não interativa, serviço-a-serviço** via `supports_token = True` + `verify_token(token=...)`. Quando um provedor opta por isso, um `Authorization: Bearer <token>` de entrada é verificado e, em caso de sucesso, um `TokenPrincipal` é anexado à requisição (`request.state.token_principal`) para os endpoints que aquele provedor marca como autenticáveis por token — sem cookie, sem redirecionamento, sem renovação.

O primeiro consumidor empacotado é o provedor **drain** (`plugins/dashboard_auth/drain`): o `work4you-account-service` provisiona um segredo por agente via `WORK4YOU_DASHBOARD_DRAIN_SECRET`, e o provedor verifica os bearer tokens de entrada contra ele com uma comparação de tempo constante, registrando `/api/gateway/drain` como autenticável por token. Ele **falha fechado (fails closed)** — um segredo fraco/curto (< 256 bits) é rejeitado no registro e o endpoint permanece desabilitado; é um no-op quando a variável de ambiente não está definida. Ajustes de comportamento (`scope`, `min_secret_chars`) ficam em `dashboard.drain_auth` no `config.yaml`.

Provedores personalizados podem implementar `supports_token`/`verify_token` da mesma forma para expor seus próprios endpoints autenticáveis por máquina.

### Verificando se o gate está ligado

```bash
# Quick env-var path.
WORK4YOU_DASHBOARD_OAUTH_CLIENT_ID=agent:test \
  work4you dashboard --host 0.0.0.0

# Or the equivalent via config.yaml (recommended for local dev / on-prem):
#
#   dashboard:
#     oauth:
#       client_id: agent:test
#
# then just:
work4you dashboard --host 0.0.0.0

# Hit /api/status to see the gate state:
curl -s http://127.0.0.1:9119/api/status | jq '.auth_required, .auth_providers'
# true
# ["work4you"]
```

A StatusPage em React do dashboard mostra os mesmos campos em "Web server". Um AuthWidget na barra lateral exibe a identidade atual assim que você fizer login.

## Conectando o Work4You Desktop a um backend remoto

O Work4You Desktop pode operar um backend do Work4You rodando em outra máquina (uma VPS, um servidor doméstico, um Mini atrás do Tailscale). No aplicativo, isso fica em **Settings → Gateways → Remote gateway**, que pede uma **Remote URL** e uma forma de **Sign in**. (Para o próprio aplicativo desktop — instalação, configurações, chat — veja a página do [Work4You Desktop](/user-guide/desktop).)

Você protege o dashboard remoto com um dos provedores de autenticação embutidos, e o aplicativo desktop faz login contra qualquer um que o backend anuncie. Para um backend acessível além da sua própria máquina — uma VPS, um host público, qualquer coisa voltada à internet —, o provedor recomendado é **OAuth (Work4You Portal)** (registre-o com [`work4you dashboard register`](#registering-a-dashboard) e faça login com *Sign in with Work4You*). O [provedor de usuário/senha](#usernamepassword-provider-no-oauth-idp) embutido é a opção mais rápida quando o backend está em uma LAN confiável ou acessível apenas por VPN, mas **não é adequado para exposição direta à internet pública**. Vincular o dashboard a um endereço não-loopback ativa seu gate de autenticação; uma vez logado, o Desktop reutiliza a sessão para o WebSocket de chat automaticamente — não há token para copiar e colar.

A receita abaixo usa o caminho de usuário/senha porque é o mais rápido de configurar em uma rede confiável; para o caminho OAuth, veja [Provedor padrão: Work4You](#default-provider-work4you-research).

### No backend (a máquina remota)

```bash
# 1. Set the dashboard login credentials in ~/.work4you/.env (secrets file, 0600).
cat >> ~/.work4you/.env <<'EOF'
WORK4YOU_DASHBOARD_BASIC_AUTH_USERNAME=admin
WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD=choose-a-strong-password
# Recommended: a stable signing secret so sessions survive restarts.
WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET=$(openssl rand -base64 32)
EOF
chmod 600 ~/.work4you/.env

# 2. Run the dashboard bound to a reachable address. The non-loopback bind
#    engages the auth gate; the username/password provider handles login.
work4you dashboard --no-open --host 0.0.0.0 --port 9119
```

Prefere não ter texto puro em repouso? Use `WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD_HASH` com um hash scrypt em vez disso — veja [Provedor de usuário/senha](#usernamepassword-provider-no-oauth-idp) para a configuração completa.

Se você roda o dashboard como um serviço systemd, `~/.work4you/.env` é captado automaticamente quando a unit tem `EnvironmentFile=%h/.work4you/.env`, então as credenciais já estão no ambiente na inicialização.

:::warning
O dashboard lê e grava seu `.env` (chaves de API, segredos) e pode executar comandos do agente. A configuração de **usuário/senha** mostrada aqui é para uma rede confiável — nunca exponha um dashboard protegido por senha diretamente à internet aberta. Coloque-o atrás de uma VPN. O [Tailscale](https://tailscale.com/) é a opção mais limpa: vincule ao IP do Tailscale da máquina (`--host <tailscale-ip>`) e use `http://<tailscale-ip>:9119` como a Remote URL. Somente dispositivos na sua tailnet podem alcançá-lo. Para alcançar um backend pela internet pública, use o provedor **OAuth (Work4You Portal)** em vez disso.
:::

### No Work4You Desktop

**Settings → Gateways → Remote gateway:**

- **Remote URL** — `http://<backend-host>:9119` (prefixos de caminho como `/work4you` são suportados se você o expuser com um proxy reverso)
- **Sign in** — o aplicativo detecta o gateway de usuário/senha e mostra um botão **Sign in**; clique nele e digite as credenciais do passo 1
- **Save and reconnect** — muda o shell do desktop para o backend remoto

A sessão se renova automaticamente e sobrevive a reinícios quando `WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET` está definido no backend.

### Sobrescrita por variável de ambiente

Em vez do ajuste dentro do aplicativo, você pode apontar o desktop para um backend com uma variável de ambiente antes de iniciá-lo. Quando `WORK4YOU_DESKTOP_REMOTE_URL` está definida, ela sobrescreve a URL salva no aplicativo (o painel de configurações de Gateway mostra um selo "env override" e desabilita a edição); você ainda faz **Sign in** com seu usuário e senha pelo painel.

| Env var | Value |
|---------|-------|
| `WORK4YOU_DESKTOP_REMOTE_URL` | `http://<backend-host>:9119` |

### Solução de problemas

- **"Remote gateway incomplete"** — você não digitou uma URL remota.
- **Login falha com 401 / "Invalid credentials"** — o usuário ou a senha não coincidem com `WORK4YOU_DASHBOARD_BASIC_AUTH_USERNAME` / `WORK4YOU_DASHBOARD_BASIC_AUTH_PASSWORD` do backend. O backend retorna o mesmo erro genérico para usuário desconhecido e senha errada, então verifique ambos. Confirme o gate com `curl -s http://<host>:9119/api/status | jq '.auth_required, .auth_providers'` — deve reportar `true` e incluir `"basic"`.
- **Sem botão "Sign in" — ele pede um token de sessão em vez disso** — o provedor de usuário/senha não está ativo (`/api/status` não vai listar `"basic"`). Certifique-se de que o usuário e uma senha (ou hash de senha) estão definidos e que o processo do dashboard os carregou.
- **Desconectado a cada reinício** — defina `WORK4YOU_DASHBOARD_BASIC_AUTH_SECRET` com um valor estável; caso contrário, a chave de assinatura é regenerada a cada inicialização.
- **Conexão recusada / expira** — o backend se vinculou a `127.0.0.1` (o padrão) em vez de um endereço alcançável, ou um firewall/VPN está bloqueando a porta. Vincule a `0.0.0.0` ou ao IP do Tailscale e abra a porta para sua rede confiável.

## CORS

O servidor web restringe o CORS somente a origens localhost:

- `http://localhost:9119` / `http://127.0.0.1:9119` (produção)
- `http://localhost:3000` / `http://127.0.0.1:3000`
- `http://localhost:5173` / `http://127.0.0.1:5173` (servidor de desenvolvimento Vite)

Se você rodar o servidor em uma porta personalizada, essa origem é adicionada automaticamente.

## Desenvolvimento

Se você está contribuindo com o frontend do web dashboard:

```bash
# Terminal 1: start the backend API
work4you dashboard --no-open

# Terminal 2: start the Vite dev server with HMR
cd web/
npm install
npm run dev
```

O servidor de desenvolvimento Vite em `http://localhost:5173` encaminha requisições `/api` para o backend FastAPI em `http://127.0.0.1:9119`.

O frontend é construído com React 19, TypeScript, Tailwind CSS v4, e componentes no estilo shadcn/ui. Os builds de produção geram saída em `work4you_cli/web_dist/`, que o servidor FastAPI serve como um SPA estático.

## Compilação automática na atualização

Quando você executa `work4you update`, o frontend web é recompilado automaticamente se o `npm` estiver disponível. Isso mantém o dashboard sincronizado com as atualizações de código. Se o `npm` não estiver instalado, a atualização pula a compilação do frontend e `work4you dashboard` a compila no primeiro lançamento.

## Temas e plugins

O dashboard vem com oito temas embutidos e pode ser estendido com temas definidos pelo usuário, abas de plugin e rotas de API de backend — tudo plug-and-play, sem necessidade de clonar o repositório.

**Troque de tema ao vivo** pela barra de cabeçalho — clique no ícone de paleta ao lado do seletor de idioma. A seleção persiste no `config.yaml` em `dashboard.theme` e é restaurada ao carregar a página.

**Altere a fonte independentemente** pelo mesmo seletor — a seção **Font** abaixo da lista de temas sobrescreve a fonte da UI de qualquer tema ativo. A escolha persiste entre trocas de tema (`config.yaml` → `dashboard.font`); escolha **Theme default** para limpá-la e voltar à fonte própria do tema ativo.

Temas embutidos:

| Theme | Character |
|-------|-----------|
| **Work4You Teal** (`default`) | Teal escuro + creme, fontes do sistema, espaçamento confortável |
| **Work4You Teal (Large)** (`default-large`) | Igual ao default, com texto de 18px e espaçamento mais generoso |
| **Work4You Blue** (`work4you-blue`) | Acentos azuis da marca Work4You, com espaçamento arejado |
| **Midnight** (`midnight`) | Azul-violeta profundo, Inter + JetBrains Mono |
| **Ember** (`ember`) | Carmesim + bronze quentes, serifada Spectral + IBM Plex Mono |
| **Mono** (`mono`) | Escala de cinza, IBM Plex, compacto |
| **Cyberpunk** (`cyberpunk`) | Verde neon sobre preto, Share Tech Mono |
| **Rosé** (`rose`) | Rosa + marfim, serifada Fraunces, espaçoso |

Para construir seu próprio tema, adicionar uma aba de plugin, injetar em slots do shell, ou expor endpoints REST específicos de plugin, veja **[Extending the Dashboard](./extending-the-dashboard)** — o guia completo cobre:

- Schema YAML de tema — paleta, tipografia, layout, assets, componentStyles, colorOverrides, customCSS
- Variantes de layout — `standard`, `cockpit`, `tiled`
- Manifesto de plugin, SDK, slots de shell, slots restritos a página (injeta widgets em páginas embutidas sem sobrescrevê-las), rotas FastAPI de backend
- Um passo a passo completo combinando tema e plugin (demo do cockpit Strike Freedom)
- Descoberta, recarregamento e solução de problemas
