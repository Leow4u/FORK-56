---
title: Automação de Browser
description: Controle navegadores com múltiplos provedores, navegadores locais da família Chromium via CDP, ou navegadores em nuvem para interação web, preenchimento de formulários, scraping e mais.
sidebar_label: Browser
sidebar_position: 5
---

# Automação de Browser

O Work4You inclui um conjunto completo de ferramentas de automação de browser com várias opções de backend:

- **Modo cloud Browserbase** via [Browserbase](https://browserbase.com) para navegadores em nuvem gerenciados e ferramentas anti-bot
- **Modo cloud Browser Use** via [Browser Use](https://browser-use.com) como um provedor alternativo de navegador em nuvem
- **Modo Browser Use** via a [Browser Use CLI 3.0](https://github.com/browser-use/browser-use) — um novo harness de navegador que é estado da arte para tarefas web; automatiza seu Chrome local ou navegadores em nuvem do Browser Use
- **Modo cloud Firecrawl** via [Firecrawl](https://firecrawl.dev) para navegadores em nuvem com scraping integrado
- **Modo local Camofox** via [Camofox](https://github.com/jo-inc/camofox-browser) para navegação local anti-detecção (baseada em Firefox com fingerprint spoofing)
- **Motor local Lightpanda** via [Lightpanda](https://lightpanda.io) — um navegador headless construído do zero em Zig para máquinas; início instantâneo, 16x menos memória e 9x mais rápido que o Chrome, com fallback automático para Chrome nas ações que ainda não suporta
- **CDP local da família Chromium** — conecte as ferramentas de browser à sua própria instância do Chrome, Brave, Chromium ou Edge usando `/browser connect`
- **Modo browser local** via a CLI `agent-browser` e uma instalação local do Chromium

Em todos os modos, o agente pode navegar em sites, interagir com elementos de página, preencher formulários e extrair informações.

## Visão geral

As páginas são representadas como **árvores de acessibilidade** (snapshots baseados em texto), o que as torna ideais para agentes LLM. Elementos interativos recebem IDs de referência (como `@e1`, `@e2`) que o agente usa para clicar e digitar.

Capacidades principais:

- **Execução em nuvem multi-provedor** — Browserbase, Browser Use ou Firecrawl — sem necessidade de navegador local
- **Integração local da família Chromium** — conecte-se ao seu Chrome, Brave, Chromium ou Edge em execução via CDP para navegação prática
- **Furtividade integrada** — fingerprints aleatórios, resolução de CAPTCHA, proxies residenciais (Browserbase)
- **Isolamento de sessão** — cada tarefa recebe sua própria sessão de navegador
- **Limpeza automática** — sessões inativas são encerradas após um tempo limite
- **Análise por visão** — captura de tela + análise de IA para compreensão visual

## Configuração

:::tip Assinantes Work4You
Se você tem uma assinatura paga do [Work4You Portal](https://portal.work4you.ai), pode usar automação de browser através do **[Tool Gateway](tool-gateway.md)** sem nenhuma chave de API separada. Novas instalações podem rodar `work4you setup --portal` para fazer login e ativar todas as ferramentas do gateway de uma vez; instalações existentes podem escolher **Work4You Subscription** como provedor de browser via `work4you model` ou `work4you tools`.
:::

### Modo cloud Browserbase

Para usar navegadores em nuvem gerenciados pelo Browserbase, adicione:

```bash
# Adicione ao ~/.work4you/.env
BROWSERBASE_API_KEY=***
BROWSERBASE_PROJECT_ID=your-project-id-here
```

Obtenha suas credenciais em [browserbase.com](https://browserbase.com).

### Modo cloud Browser Use

Para usar o Browser Use como seu provedor de navegador em nuvem, adicione:

```bash
# Adicione ao ~/.work4you/.env
BROWSER_USE_API_KEY=***
```

Obtenha sua chave de API em [browser-use.com](https://browser-use.com).

### Modo Browser Use (padrão)

O modo Browser Use usa a [Browser Use CLI 3.0](https://github.com/browser-use/browser-use) — um novo harness de navegador que é estado da arte em tarefas web — em vez das ferramentas de browser integradas. O agente escreve e executa Python no navegador para clicar, digitar, arrastar, extrair dados e interagir com páginas web.

**Este é o modo de browser padrão**: quando `browser.backend` não está definido e a CLI `browser-use` pode ser executada (instalada, ou disponível via `uvx`), o agente recebe a ferramenta única `browser_exec`. Se a CLI não puder rodar, o Work4You volta automaticamente para as ferramentas de browser integradas.

O modo é um **driver** que se combina com o seu backend de browser configurado: ele controla seu Chrome local, um navegador em nuvem de assinatura Work4You, o Browserbase, o Firecrawl, ou navegadores em nuvem do Browser Use — qualquer que seja a fonte de navegador selecionada em `work4you tools` → Browser Automation. A única exceção é o Camofox, que não tem um endpoint CDP para o harness se conectar; instalações Camofox mantêm automaticamente as ferramentas de browser integradas.

**Sessões concorrentes:** `browser_exec` aceita um argumento `session=<name>` que isola o trabalho de browser por nome em cada backend. Cada nome recebe seu próprio daemon de harness (seu próprio socket IPC, log e estado) e, em backends de nuvem, seu próprio navegador — então subagentes paralelos ou chats simultâneos não colidem mais em uma única conexão compartilhada. Omitir `session` usa o daemon padrão compartilhado, o que é adequado para navegação uma de cada vez.

Para optar por sair e forçar as ferramentas de browser integradas, use `/browser use off`, ou:

```yaml
# Adicione ao ~/.work4you/config.yaml
browser:
  backend: "off"
```

(`backend: "browser-use"` continua válido para forçar o modo explicitamente.)

Os navegadores em nuvem do próprio Browser Use precisam de `browser-use auth login` ou `BROWSER_USE_API_KEY`; outras fontes de browser usam suas credenciais existentes sem alteração.

:::note
Como o modo Browser Use executa Python escrito pelo modelo na sua máquina, a
ferramenta `browser_exec` só é oferecida a sessões que também têm acesso a
terminal. Plataformas configuradas sem o toolset de terminal (por exemplo, uma
superfície de mensagens travada) mantêm as ferramentas de browser padrão.
:::

### Modo cloud Firecrawl

Para usar o Firecrawl como seu provedor de navegador em nuvem, adicione:

```bash
# Adicione ao ~/.work4you/.env
FIRECRAWL_API_KEY=fc-***
```

Obtenha sua chave de API em [firecrawl.dev](https://firecrawl.dev). Depois selecione o Firecrawl como seu provedor de browser:

```bash
work4you setup tools
# → Browser Automation → Firecrawl
```

Configurações opcionais:

```bash
# Instância Firecrawl auto-hospedada (padrão: https://api.firecrawl.dev)
FIRECRAWL_API_URL=http://localhost:3002

# TTL da sessão em segundos (padrão: 300)
FIRECRAWL_BROWSER_TTL=600
```

### Roteamento híbrido: nuvem para URLs públicas, local para LAN/localhost

Quando um provedor de nuvem está configurado, o Work4You cria automaticamente um **sidecar local do Chromium**
para URLs que resolvem para um endereço privado/loopback/LAN (`localhost`, `127.0.0.1`,
`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`, `*.local`, `*.lan`, `*.internal`,
loopback IPv6 `::1`, link-local `169.254.x.x`). URLs públicas continuam usando o
provedor de nuvem na mesma conversa.

Isso resolve o fluxo de trabalho comum de "estou desenvolvendo localmente mas usando o Browserbase" —
o agente pode capturar uma tela do seu dashboard em `http://localhost:3000` E extrair dados de
`https://github.com` sem que você precise trocar de provedor ou desativar a proteção SSRF.
O provedor de nuvem nunca vê a URL privada.

O recurso está **ativado por padrão**. Para desativá-lo (todas as URLs vão para o provedor
de nuvem configurado, como antes):

```yaml
# ~/.work4you/config.yaml
browser:
  cloud_provider: browserbase
  auto_local_for_private_urls: false
```

Com o roteamento automático desativado, URLs privadas são rejeitadas com
`"Blocked: URL targets a private or internal address"` a menos que você também defina
`browser.allow_private_urls: true` (o que permite que o provedor de nuvem tente acessá-las —
geralmente não vai funcionar, já que o Browserbase etc. não conseguem alcançar sua LAN).

Requisitos: o sidecar local usa a mesma CLI `agent-browser` do modo local puro, então
você precisa dela instalada (`work4you setup tools → Browser Automation`
a instala automaticamente). Redirecionamentos pós-navegação de uma URL pública para um
endereço privado ainda são bloqueados (você não pode usar um truque de redirecionamento para interno
para alcançar sua LAN pelo caminho público).

### Modo local Camofox

O [Camofox](https://github.com/jo-inc/camofox-browser) é um servidor Node.js auto-hospedado que envolve o Camoufox (um fork do Firefox com fingerprint spoofing em C++). Ele fornece navegação local anti-detecção sem dependências de nuvem.

```bash
# Clone primeiro o servidor de browser Camofox
git clone https://github.com/jo-inc/camofox-browser
cd camofox-browser

# Compile e inicie com Docker usando as configurações padrão do contêiner
# (detecta a arquitetura automaticamente: aarch64 em M1/M2, x86_64 em Intel)
make up

# Pare e remova o contêiner padrão
make down

# Force uma reconstrução limpa (por exemplo, após atualizar VERSION/RELEASE)
make reset

# Apenas baixe os binários sem compilar
make fetch

# Sobrescreva a arquitetura ou versão explicitamente
make up ARCH=x86_64
make up VERSION=135.0.1 RELEASE=beta.24
```

`make up` inicia o contêiner padrão imediatamente. Se você quiser configurações de runtime personalizadas, como um heap maior do Node, VNC, ou um diretório de perfil persistente, compile a imagem primeiro e depois execute-a você mesmo:

```bash
# Compila a imagem sem iniciar o contêiner padrão
make build

# Inicia com persistência, visualização ao vivo via VNC, e um heap maior do Node
mkdir -p ~/.camofox-docker
docker run -d \
  --name camofox-browser \
  --restart unless-stopped \
  -p 9377:9377 \
  -p 6080:6080 \
  -p 5901:5900 \
  -e CAMOFOX_PORT=9377 \
  -e ENABLE_VNC=1 \
  -e VNC_BIND=0.0.0.0 \
  -e VNC_RESOLUTION=1920x1080 \
  -e MAX_OLD_SPACE_SIZE=2048 \
  -v ~/.camofox-docker:/root/.camofox \
  camofox-browser:135.0.1-aarch64
```

Com o VNC habilitado, o navegador roda em modo headed e pode ser observado ao vivo no seu navegador em `http://localhost:6080` (noVNC). Você também pode conectar um cliente VNC nativo a `localhost:5901`.

Se você já rodou `make up`, pare e remova esse contêiner padrão antes de iniciar o personalizado:

```bash
make down
# depois rode o comando docker run personalizado acima
```

Depois defina em `~/.work4you/.env`:

```bash
CAMOFOX_URL=http://localhost:9377
```

Se o Camofox estiver rodando em Docker e você quiser que ele abra aplicativos web servidos pela máquina host, habilite a reescrita de loopback. `CAMOFOX_URL` ainda deve apontar para a API de controle publicada pelo host, mas URLs de página como `http://127.0.0.1:3000` precisam ser abertas de dentro do contêiner como `http://host.docker.internal:3000`:

```yaml
# ~/.work4you/config.yaml
browser:
  camofox:
    rewrite_loopback_urls: true
    loopback_host_alias: host.docker.internal  # padrão; use um IP de LAN se necessário
```

Variáveis de ambiente equivalentes:

```bash
CAMOFOX_REWRITE_LOOPBACK_URLS=true
CAMOFOX_LOOPBACK_HOST_ALIAS=host.docker.internal
```

A reescrita só se aplica a URLs de navegação de página com hosts loopback (`localhost`, `127.0.0.1`, `::1`). Não altera `CAMOFOX_URL`. Deixe desativado para instalações de Camofox fora do Docker, onde o navegador já roda no host e as URLs de loopback estão corretas.

Ou configure via `work4you tools` → Browser Automation → Camofox.

Quando `CAMOFOX_URL` está definido, todas as ferramentas de browser são automaticamente roteadas pelo Camofox em vez do Browserbase ou do agent-browser.

#### Sessões de browser persistentes

Por padrão, cada sessão Camofox recebe uma identidade aleatória — cookies e logins não sobrevivem entre reinicializações do agente. Para habilitar sessões de browser persistentes, adicione o seguinte ao `~/.work4you/config.yaml`:

```yaml
browser:
  camofox:
    managed_persistence: true
```

Depois reinicie completamente o Work4You para que a nova configuração seja carregada.

:::warning O caminho aninhado importa
O Work4You lê `browser.camofox.managed_persistence`, **não** um `managed_persistence` de nível superior. Um erro comum é escrever:

```yaml
# ❌ Errado — o Work4You ignora isso
managed_persistence: true
```

Se a flag for colocada no caminho errado, o Work4You volta silenciosamente para um `userId` efêmero aleatório e seu estado de login será perdido a cada sessão.
:::

##### O que o Work4You faz
- Envia um `userId` determinístico com escopo por profile ao Camofox para que o servidor possa reutilizar o mesmo perfil do Firefox entre sessões.
- Pula a destruição de contexto do lado do servidor na limpeza, para que cookies e logins sobrevivam entre tarefas do agente.
- Restringe o `userId` ao profile ativo do Work4You, então diferentes profiles do Work4You recebem diferentes perfis de navegador (isolamento por profile).

##### O que o Work4You não faz
- Não força a persistência no servidor Camofox. O Work4You apenas envia um `userId` estável; o servidor precisa honrá-lo mapeando esse `userId` para um diretório de perfil Firefox persistente.
- Se sua compilação do servidor Camofox trata toda requisição como efêmera (por exemplo, sempre chama `browser.newContext()` sem carregar um perfil armazenado), o Work4You não consegue fazer essas sessões persistirem. Certifique-se de estar rodando uma compilação do Camofox que implemente persistência de perfil baseada em userId.

##### Verificando se está funcionando

1. Inicie o Work4You e seu servidor Camofox.
2. Abra o Google (ou qualquer site de login) em uma tarefa de browser e faça login manualmente.
3. Encerre a tarefa de browser normalmente.
4. Inicie uma nova tarefa de browser.
5. Abra o mesmo site novamente — você deve continuar logado.

Se o passo 5 fizer você deslogar, o servidor Camofox não está honrando o `userId` estável. Verifique novamente o caminho da sua configuração, confirme que reiniciou completamente o Work4You após editar `config.yaml`, e verifique se a versão do seu servidor Camofox suporta perfis persistentes por usuário.

##### Onde o estado fica

O Work4You deriva o `userId` estável a partir do diretório com escopo por profile `~/.work4you/browser_auth/camofox/` (ou o equivalente sob `$WORK4YOU_HOME` para profiles não padrão). Os dados reais do perfil do navegador ficam do lado do servidor Camofox, indexados por esse `userId`. Para resetar completamente um perfil persistente, limpe-o no servidor Camofox e remova o diretório de estado do profile Work4You correspondente.

#### Sessões Camofox gerenciadas externamente

Quando outro aplicativo controla o navegador Camofox visível (um assistente de desktop, uma integração personalizada, outro agente), configure o Work4You para operar dentro dessa mesma identidade em vez de criar seu próprio perfil isolado.

Três controles regem esse comportamento:

| Configuração | Variável de ambiente | Efeito |
|---------|---------|--------|
| `browser.camofox.user_id` | `CAMOFOX_USER_ID` | `userId` do Camofox que o Work4You usa ao criar abas. Definir isso inclui a sessão no modo "gerenciada externamente". |
| `browser.camofox.session_key` | `CAMOFOX_SESSION_KEY` | `sessionKey` (também conhecido como `listItemId`) enviado na criação da aba. Usado para casar com uma aba existente durante a adoção. Padrão é um valor por tarefa se não definido. |
| `browser.camofox.adopt_existing_tab` | `CAMOFOX_ADOPT_EXISTING_TAB` | Quando verdadeiro, o Work4You chama `GET /tabs?userId=<user_id>` no primeiro uso e reutiliza uma aba existente antes de criar uma nova. |

Variáveis de ambiente têm precedência sobre `config.yaml`. Ambas as formas funcionam:

```yaml
browser:
  camofox:
    user_id: shared-camofox
    session_key: visible-tab
    adopt_existing_tab: true
```

```bash
CAMOFOX_USER_ID=shared-camofox
CAMOFOX_SESSION_KEY=visible-tab
CAMOFOX_ADOPT_EXISTING_TAB=true
```

**O que muda quando `user_id` é definido:**

- O Work4You pula a limpeza destrutiva ao final da tarefa (igual a `managed_persistence: true`). A aba/cookies/perfil do outro aplicativo sobrevivem.
- O Work4You **não** chama `DELETE /sessions/<user_id>` — esse endpoint apaga todos os dados do usuário, então dispará-lo destruiria a sessão do aplicativo externo.

**Como funciona a adoção de aba (quando `adopt_existing_tab: true`):**

1. Na primeira chamada de ferramenta de browser após o início do processo, o Work4You emite `GET /tabs?userId=<user_id>` (timeout de 5 segundos).
2. Se alguma aba na resposta tiver `listItemId == session_key`, o Work4You adota a mais recentemente criada nesse grupo.
3. Caso contrário, o Work4You adota a aba mais recentemente criada para o usuário (qualquer `listItemId`).
4. Se não houver abas ou a requisição falhar, o Work4You volta a criar uma nova aba na próxima operação.

A adoção só é disparada até que `tab_id` seja preenchido para a sessão. Se o aplicativo externo fechar a aba adotada no meio da execução, a próxima chamada de ferramenta de browser exibirá um erro do Camofox — o Work4You não faz nova consulta a cada chamada em busca de uma aba nova.

**Escolhendo `session_key`:** se você quiser que o Work4You se conecte de forma confiável a uma aba existente *específica*, defina `session_key` como o `listItemId` que o aplicativo externo usou ao criá-la. Se você deixar `session_key` sem definição e definir apenas `user_id`, o Work4You gera um `session_key` por tarefa (`task_<id>`) — o Work4You compartilhará cookies e o perfil com o aplicativo externo, mas abrirá sua própria aba ao lado, em vez de reutilizar uma.

**Nota sobre concorrência:** o aplicativo externo e o Work4You podem controlar o mesmo `userId` do Camofox simultaneamente, mas o Camofox não coordena o foco por aba entre clientes. Coordene a propriedade na camada de aplicação (por exemplo, o aplicativo externo pausa enquanto o Work4You está rodando).

#### Visualização ao vivo via VNC

Quando o Camofox roda em modo headed (com uma janela de navegador visível), ele expõe uma porta VNC na resposta de verificação de saúde. O Work4You descobre isso automaticamente e inclui a URL do VNC nas respostas de navegação, para que o agente possa compartilhar um link para você assistir ao navegador ao vivo.

### Motor local Lightpanda

[Lightpanda](https://lightpanda.io) é um navegador headless de código aberto escrito do zero. Ele inicia instantaneamente, roda 9x mais rápido e usa 16x menos memória que o Chrome, o que importa para agentes que ficam em VMs pequenas por longos períodos.

O Lightpanda é um **motor local**, selecionado sob o caminho local `agent-browser` (não um provedor de nuvem). Instale o binário e coloque-o no seu `PATH` (veja o [guia de instalação do Lightpanda](https://lightpanda.io/docs)), depois defina:

```yaml
# Adicione ao ~/.work4you/config.yaml
browser:
  engine: lightpanda
```

Ou via variável de ambiente:

```bash
AGENT_BROWSER_ENGINE=lightpanda
```

O Work4You controla o Lightpanda através do `agent-browser` via CDP, da mesma forma que controla o Chrome local.

**Fallback automático para Chrome.** O Lightpanda ainda não cobre tudo o que o Chrome faz, então a integração não é disruptiva: o Lightpanda lida com as ações que suporta, e o Work4You tenta novamente de forma transparente no Chrome para tudo que ele não suporta. O conjunto suportado cobre o fluxo de trabalho central do agente — navegar, capturar snapshot, clicar, digitar, rolar, voltar, pressionar teclas e avaliar JS. Screenshots também caem de volta para o Chrome porque o Lightpanda não tem renderizador gráfico; `browser_vision` já é pré-roteado direto para o Chrome pelo mesmo motivo.

### Navegador local da família Chromium via CDP (`/browser connect`)

Em vez de um provedor de nuvem, você pode conectar as ferramentas de browser do Work4You à sua própria instância em execução do Chrome, Brave, Chromium ou Edge via o Chrome DevTools Protocol (CDP). Isso é útil quando você quer ver o que o agente está fazendo em tempo real, interagir com páginas que exigem seus próprios cookies/sessões, ou evitar custos de navegador em nuvem.

:::note
`/browser connect` é um **comando de barra da CLI interativa** — não é despachado pelo gateway. Se você tentar rodá-lo dentro de um WebUI, Telegram, Discord ou outro chat de gateway, a mensagem será enviada ao agente como texto simples e o comando não será executado. Inicie o Work4You a partir do terminal (`work4you` ou `work4you chat`) e emita `/browser connect` lá.
:::

Na CLI, use:

```
/browser connect                 # Auto-inicia/conecta a um navegador local da família Chromium em http://127.0.0.1:9222
/browser connect ws://host:port  # Conecta a um endpoint CDP específico
/browser status                  # Verifica a conexão atual
/browser disconnect              # Desconecta e retorna ao modo cloud/local
```

Se um navegador ainda não estiver rodando com depuração remota, o Work4You tentará iniciar automaticamente um navegador suportado da família Chromium com `--remote-debugging-port=9222`. A detecção inclui Brave, Google Chrome, Chromium e Microsoft Edge, com caminhos comuns de instalação no Linux como `/opt/brave-bin/brave` e `/snap/bin/brave`.

:::tip
Para iniciar manualmente um navegador da família Chromium com CDP habilitado, use um user-data-dir dedicado para que a porta de depuração realmente suba mesmo que o navegador já esteja rodando com seu perfil normal:

```bash
# Linux — Brave
brave-browser \
  --remote-debugging-port=9222 \
  --user-data-dir=$HOME/.work4you/chrome-debug \
  --no-first-run \
  --no-default-browser-check &

# Linux — Google Chrome
google-chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=$HOME/.work4you/chrome-debug \
  --no-first-run \
  --no-default-browser-check &

# macOS — Brave
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.work4you/chrome-debug" \
  --no-first-run \
  --no-default-browser-check &

# macOS — Google Chrome
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.work4you/chrome-debug" \
  --no-first-run \
  --no-default-browser-check &
```

Depois inicie a CLI do Work4You e rode `/browser connect`.

**Por que `--user-data-dir`?** Sem ele, iniciar um navegador da família Chromium enquanto uma instância normal já está em execução tipicamente abre uma nova janela no processo existente — e esse processo existente não foi iniciado com `--remote-debugging-port`, então a porta 9222 nunca abre. Um user-data-dir dedicado força um processo de navegador novo onde a porta de depuração realmente escuta. `--no-first-run --no-default-browser-check` pula o assistente de primeira execução para o perfil novo.

**O Chrome 136+ torna o perfil dedicado obrigatório.** Como uma mudança de hardening de segurança, o Chrome 136 e versões posteriores se recusam silenciosamente a abrir a porta de depuração remota quando `--remote-debugging-port` é combinado com o user-data-dir *padrão* — mesmo a partir de um início limpo sem nenhum outro Chrome em execução. O navegador inicia normalmente, mas nada escuta na porta 9222, então `/browser connect` (e qualquer `curl http://127.0.0.1:9222/json/version` manual) falha com conexão recusada. Não há mensagem de erro. A correção é exatamente os comandos acima: sempre passe um `--user-data-dir` apontando para algum lugar diferente do seu diretório de perfil padrão (ex.: `$HOME/.work4you/chrome-debug`). Isso se aplica a compilações do Chrome, Chromium, Edge e Brave que já receberam essa mudança.
:::

Quando conectado via CDP, todas as ferramentas de browser (`browser_navigate`, `browser_click`, etc.) operam na sua instância de navegador ao vivo em vez de criar uma sessão em nuvem.

### WSL2 + Chrome do Windows: prefira MCP em vez de `/browser connect`

Se o Work4You roda dentro do WSL2 mas a janela do Chrome que você quer controlar roda no host Windows, `/browser connect` frequentemente não é o melhor caminho.

Por quê:

- `/browser connect` espera que o próprio Work4You alcance um endpoint CDP utilizável
- sessões modernas de depuração ao vivo do Chrome frequentemente expõem um endpoint local ao host que não é diretamente alcançável a partir do WSL da mesma forma que uma porta clássica `9222` é
- mesmo quando o Chrome do Windows é depurável, a integração mais limpa costuma ser deixar um servidor MCP de browser do lado do Windows se conectar ao Chrome e deixar o Work4You conversar com esse servidor MCP

Para essa configuração, prefira o `chrome-devtools-mcp` através do suporte MCP do Work4You.

Veja o guia MCP para a configuração prática:

- [Use MCP com o Work4You](../../guides/use-mcp-with-work4you.md#wsl2-bridge-work4you-in-wsl-to-windows-chrome)

### Modo browser local

Se você **não** definir nenhuma credencial de nuvem e não usar `/browser connect`, o Work4You ainda pode usar as ferramentas de browser através de uma instalação local do Chromium controlada pelo `agent-browser`.

### Variáveis de ambiente opcionais

```bash
# Proxies residenciais para melhor resolução de CAPTCHA (padrão: "true")
BROWSERBASE_PROXIES=true

# Furtividade avançada com Chromium customizado — requer Scale Plan (padrão: "false")
BROWSERBASE_ADVANCED_STEALTH=false

# Reconexão de sessão após desconexões — requer plano pago (padrão: "true")
BROWSERBASE_KEEP_ALIVE=true

# Timeout de sessão customizado em segundos (máx 21600 = 6 horas) (padrão: padrão do projeto)
# Exemplos: 600 (10min), 1800 (30min), 21600 (6h máx)
BROWSERBASE_SESSION_TIMEOUT=1800

# Timeout de inatividade antes de limpeza automática, em segundos (padrão: 120)
BROWSER_INACTIVITY_TIMEOUT=120

# Motor de browser local. Aplica-se às ferramentas de browser integradas
# (caminho agent-browser). Equivalente a browser.engine no config.yaml.
#   auto       — padrão do agent-browser (atualmente Chrome)
#   lightpanda — Lightpanda
#   chrome     — força Chrome explicitamente
AGENT_BROWSER_ENGINE=auto

# Flags extras de inicialização do Chromium (separadas por vírgula ou quebra de linha). O Work4You injeta
# automaticamente `--no-sandbox,--disable-dev-shm-usage` quando detecta root ou namespaces
# de usuário sem privilégio restritos por AppArmor (Ubuntu 23.10+, DGX Spark, muitas imagens
# de contêiner), então a maioria dos usuários não precisa definir isso. Defina manualmente apenas se
# precisar de uma flag que o Work4You não adiciona automaticamente; defini-la desativa a injeção automática.
AGENT_BROWSER_ARGS=--no-sandbox
```

### Instalar a CLI agent-browser

Você não precisa instalar nada — o `agent-browser` se resolve automaticamente via
`npx agent-browser` no primeiro uso de uma ferramenta de browser. Para evitar o download único via npx,
você pode instalá-lo globalmente antecipadamente (opcional):

```bash
npm install -g agent-browser
```

:::info
O toolset `browser` precisa estar incluído na lista `toolsets` da sua configuração ou habilitado via `work4you config set toolsets '["work4you-cli", "browser"]'`.
:::

## Ferramentas disponíveis

### `browser_navigate`

Navega para uma URL. Deve ser chamada antes de qualquer outra ferramenta de browser. Inicializa a sessão do Browserbase.

```
Navigate to https://github.com/Work4You
```

:::tip
Para recuperação de informação simples, prefira `web_search` ou `web_extract` — são mais rápidas e baratas. Use as ferramentas de browser quando precisar **interagir** com uma página (clicar em botões, preencher formulários, lidar com conteúdo dinâmico).
:::

### `browser_snapshot`

Obtém um snapshot baseado em texto da árvore de acessibilidade da página atual. Retorna elementos interativos com IDs de referência como `@e1`, `@e2` para uso com `browser_click` e `browser_type`.

- **`full=false`** (padrão): visão compacta mostrando apenas elementos interativos
- **`full=true`**: conteúdo completo da página

Snapshots com mais de 15.000 caracteres são automaticamente truncados ou resumidos por um LLM (o mesmo limite por página do `web_extract`). Quando isso acontece, o snapshot completo é salvo em `~/.work4you/cache/web/` e a saída da ferramenta inclui o caminho do arquivo mais uma chamada `read_file` pronta para uso, para que o agente possa percorrer a árvore de acessibilidade completa — incluindo referências de elementos além do corte — sem tirar um novo snapshot.

### `browser_click`

Clica em um elemento identificado pelo seu ID de referência do snapshot.

```
Click @e5 to press the "Sign In" button
```

### `browser_type`

Digita texto em um campo de entrada. Limpa o campo primeiro, depois digita o novo texto.

```
Type "work4you" into the search field @e3
```

### `browser_scroll`

Rola a página para cima ou para baixo para revelar mais conteúdo.

```
Scroll down to see more results
```

### `browser_press`

Pressiona uma tecla do teclado. Útil para enviar formulários ou navegação.

```
Press Enter to submit the form
```

Teclas suportadas: `Enter`, `Tab`, `Escape`, `ArrowDown`, `ArrowUp`, e mais.

### `browser_back`

Navega de volta para a página anterior no histórico do navegador.

### `browser_get_images`

Lista todas as imagens na página atual com suas URLs e texto alternativo. Útil para encontrar imagens a analisar.

### `browser_vision`

Tira uma captura de tela e a analisa com IA de visão. Use isso quando snapshots de texto não capturam informação visual importante — especialmente útil para CAPTCHAs, layouts complexos, ou desafios de verificação visual.

A captura de tela é salva de forma persistente e o caminho do arquivo é retornado junto com a análise de IA. Em plataformas de mensagens (Telegram, Discord, Slack, WhatsApp), você pode pedir ao agente para compartilhar a captura de tela — ela será enviada como um anexo de foto nativo via o mecanismo `MEDIA:`.

```
What does the chart on this page show?
```

As capturas de tela são armazenadas em `~/.work4you/cache/screenshots/` e limpas automaticamente após 24 horas.

### `browser_console`

Obtém a saída do console do navegador (mensagens log/warn/error) e exceções JavaScript não capturadas da página atual. Essencial para detectar erros silenciosos de JS que não aparecem na árvore de acessibilidade.

```
Check the browser console for any JavaScript errors
```

Use `clear=True` para limpar o console após a leitura, para que chamadas subsequentes mostrem apenas mensagens novas.

`browser_console` também avalia JavaScript quando chamado com um argumento `expression` — mesmo formato do console do DevTools, o resultado retorna já interpretado (objetos serializados em JSON viram dicts; valores primitivos permanecem primitivos).

```
browser_console(expression="document.querySelector('h1').textContent")
browser_console(expression="JSON.stringify(performance.timing)")
```

Quando um supervisor CDP está ativo para a sessão atual (típico de qualquer sessão que rodou `browser_navigate` contra um backend com capacidade CDP), a avaliação roda sobre o WebSocket persistente do supervisor — sem custo de inicialização de subprocesso. Caso contrário, recorre ao caminho padrão da CLI agent-browser. O comportamento é idêntico de qualquer forma; só a latência muda.

A avaliação é irrestrita por padrão — o agente pode usar `fetch`, ler storage, consultar valores de formulário e rodar qualquer extração de DOM. Requisições direcionadas a endereços privados/internos ainda são bloqueadas em backends não locais (a proteção SSRF é independente desta configuração). Se você navega em páginas hostis com um perfil logado e quer uma denylist estrita sobre primitivas JS sensíveis (cookies, storage, clipboard, chamadas de rede, valores de formulário), opte por ativar com `browser.restrict_evaluate: true` em `config.yaml`. Observe que a denylist casa por *nomes* de primitiva, então também bloqueia expressões legítimas que apenas contêm palavras como `fetch` ou `cookie`.

### `browser_cdp`

Passagem direta do Chrome DevTools Protocol bruto — a válvula de escape para operações de browser não cobertas pelas outras ferramentas. Use para tratamento de diálogos nativos, avaliação restrita a iframe, controle de cookie/rede, ou qualquer verbo CDP de que o agente precise.

**Disponível apenas quando um endpoint CDP está alcançável no início da sessão** — significando que `/browser connect` se conectou a um Chrome, Brave, Chromium ou Edge em execução, ou `browser.cdp_url` está definido em `config.yaml`. O modo local padrão do agent-browser, o Camofox e os provedores de nuvem (Browserbase, Browser Use, Firecrawl) atualmente não expõem CDP para esta ferramenta — provedores de nuvem têm URLs CDP por sessão, mas o roteamento de sessão ao vivo é um trabalho futuro.

**Referência de métodos CDP:** https://chromedevtools.github.io/devtools-protocol/ — o agente pode usar `web_extract` na página de um método específico para consultar parâmetros e formato de retorno.

Padrões comuns:

```
# Listar abas (nível de navegador, sem target_id)
browser_cdp(method="Target.getTargets")

# Tratar um diálogo JS nativo em uma aba
browser_cdp(method="Page.handleJavaScriptDialog",
            params={"accept": true, "promptText": ""},
            target_id="<tabId>")

# Avaliar JS em uma aba específica
browser_cdp(method="Runtime.evaluate",
            params={"expression": "document.title", "returnByValue": true},
            target_id="<tabId>")

# Obter todos os cookies
browser_cdp(method="Network.getAllCookies")
```

Métodos de nível de navegador (`Target.*`, `Browser.*`, `Storage.*`) omitem `target_id`. Métodos de nível de página (`Page.*`, `Runtime.*`, `DOM.*`, `Emulation.*`) exigem um `target_id` de `Target.getTargets`. Cada chamada sem estado é independente — sessões não persistem entre chamadas.

**Iframes cross-origin:** passe `frame_id` (de `browser_snapshot.frame_tree.children[]` onde `is_oopif=true`) para rotear a chamada CDP através da sessão ao vivo do supervisor para aquele iframe. É assim que `Runtime.evaluate` dentro de um iframe cross-origin funciona no Browserbase, onde conexões CDP sem estado atingiriam a expiração de URL assinada. Exemplo:

```
browser_cdp(
  method="Runtime.evaluate",
  params={"expression": "document.title", "returnByValue": True},
  frame_id="<frame_id from browser_snapshot>",
)
```

Iframes de mesma origem não precisam de `frame_id` — use `document.querySelector('iframe').contentDocument` a partir de um `Runtime.evaluate` de nível superior.

### `browser_dialog`

Responde a um diálogo JS nativo (`alert` / `confirm` / `prompt` / `beforeunload`). Antes desta ferramenta existir, diálogos bloqueavam silenciosamente a thread JavaScript da página e chamadas subsequentes de `browser_*` travavam ou lançavam erro; agora o agente vê diálogos pendentes na saída de `browser_snapshot` e responde explicitamente.

**Fluxo de trabalho:**
1. Chame `browser_snapshot`. Se um diálogo estiver bloqueando a página, ele aparece como `pending_dialogs: [{"id": "d-1", "type": "alert", "message": "..."}]`.
2. Chame `browser_dialog(action="accept")` ou `browser_dialog(action="dismiss")`. Para diálogos `prompt()`, passe `prompt_text="..."` para fornecer a resposta.
3. Tire um novo snapshot — `pending_dialogs` fica vazio; a thread JS da página foi retomada.

**A detecção acontece automaticamente** via um supervisor CDP persistente — um WebSocket por tarefa que se inscreve em eventos de Page/Runtime/Target. O supervisor também popula um campo `frame_tree` no snapshot para que o agente possa ver a estrutura de iframes da página atual, incluindo iframes cross-origin (OOPIF).

**Matriz de disponibilidade:**

| Backend | Detecção via `pending_dialogs` | Resposta (ferramenta `browser_dialog`) |
|---|---|---|
| Chrome local via `/browser connect` ou `browser.cdp_url` | ✓ | ✓ fluxo completo |
| Browserbase | ✓ | ✓ fluxo completo (via ponte XHR injetada) |
| Camofox / agent-browser local padrão | ✗ | ✗ (sem endpoint CDP) |

**Como funciona no Browserbase.** O proxy CDP do Browserbase descarta automaticamente diálogos nativos reais do lado do servidor em ~10ms, então não podemos usar `Page.handleJavaScriptDialog`. O supervisor injeta um pequeno script via `Page.addScriptToEvaluateOnNewDocument` que sobrescreve `window.alert`/`confirm`/`prompt` com um XHR síncrono. Interceptamos esses XHRs via `Fetch.enable` — a thread JS da página fica bloqueada no XHR até chamarmos `Fetch.fulfillRequest` com a resposta do agente. Valores de retorno de `prompt()` voltam ao JS da página sem alteração.

**A política de diálogo** é configurada em `config.yaml` sob `browser.dialog_policy`:

| Política | Comportamento |
|--------|----------|
| `must_respond` (padrão) | Captura, exibe no snapshot, aguarda chamada explícita de `browser_dialog()`. Descarte automático de segurança após `browser.dialog_timeout_s` (padrão 300s), para que um agente com bugs não trave para sempre. |
| `auto_dismiss` | Captura, descarta imediatamente. O agente ainda vê o diálogo no histórico de `browser_state`, mas não precisa agir. |
| `auto_accept` | Captura, aceita imediatamente. Útil ao navegar em páginas com prompts agressivos de `beforeunload`. |

A **frame tree** dentro de `browser_snapshot.frame_tree` é limitada a 30 frames e profundidade de OOPIF 2 para manter os payloads controlados em páginas cheias de anúncios. Uma flag `truncated: true` aparece quando os limites são atingidos; agentes que precisam da árvore completa podem usar `browser_cdp` com `Page.getFrameTree`.

## Exemplos práticos

### Preenchendo um formulário web

```
User: Sign up for an account on example.com with my email john@example.com

Agent workflow:
1. browser_navigate("https://example.com/signup")
2. browser_snapshot()  → sees form fields with refs
3. browser_type(ref="@e3", text="john@example.com")
4. browser_type(ref="@e5", text="SecurePass123")
5. browser_click(ref="@e8")  → clicks "Create Account"
6. browser_snapshot()  → confirms success
```

### Pesquisando conteúdo dinâmico

```
User: What are the top trending repos on GitHub right now?

Agent workflow:
1. browser_navigate("https://github.com/trending")
2. browser_snapshot(full=true)  → reads trending repo list
3. Returns formatted results
```

## Gravação de sessão

Grave automaticamente sessões de browser como arquivos de vídeo WebM:

```yaml
browser:
  record_sessions: true  # padrão: false
```

Quando habilitado, a gravação começa automaticamente no primeiro `browser_navigate` e salva em `~/.work4you/browser_recordings/` quando a sessão fecha. Funciona tanto em modos locais quanto em nuvem (Browserbase). Gravações com mais de 72 horas são limpas automaticamente.

## Modo headed (janela de browser visível)

Por padrão, o navegador local roda headless. Habilite o modo headed para obter uma janela Chromium visível que você pode observar e com a qual interagir:

```yaml
browser:
  headed: true  # padrão: false
```

Ou via variável de ambiente: `AGENT_BROWSER_HEADED=1`.

O modo headed faz duas coisas:

1. **Inicia o Chromium com uma janela visível** (passa `--headed` para o agent-browser em modo local).
2. **Mantém a janela aberta entre turnos.** Normalmente a sessão de browser é limpa após cada resposta do agente; em modo headed, a limpeza por turno é pulada para que você possa observar o agente trabalhar, intervir manualmente (desafios de login, CAPTCHAs), e manter o estado de login ativo ao longo da conversa.

Sessões ociosas ainda são coletadas após `browser.inactivity_timeout` (padrão 120s sem atividade de browser), e todas as sessões são fechadas no desligamento. O modo headed afeta apenas o navegador local — sessões em nuvem (Browserbase) não são afetadas.

## Recursos de furtividade

O Browserbase fornece capacidades automáticas de furtividade:

| Recurso | Padrão | Notas |
|---------|---------|-------|
| Furtividade básica | Sempre ativo | Fingerprints aleatórios, randomização de viewport, resolução de CAPTCHA |
| Proxies residenciais | Ativo | Roteia através de IPs residenciais para melhor acesso |
| Furtividade avançada | Inativo | Compilação Chromium customizada, requer Scale Plan |
| Keep Alive | Ativo | Reconexão de sessão após instabilidades de rede |

:::note
Se recursos pagos não estiverem disponíveis no seu plano, o Work4You recua automaticamente — primeiro desativando o `keepAlive`, depois os proxies — para que a navegação continue funcionando em planos gratuitos.
:::

## Gerenciamento de sessão

- Cada tarefa recebe uma sessão de browser isolada via Browserbase
- Sessões são limpas automaticamente após inatividade (padrão: 2 minutos)
- Uma thread em segundo plano verifica a cada 30 segundos por sessões obsoletas
- Uma limpeza de emergência roda ao encerrar o processo para evitar sessões órfãs
- Sessões são liberadas via a API do Browserbase (status `REQUEST_RELEASE`)

## Limitações

- **Interação baseada em texto** — depende da árvore de acessibilidade, não de coordenadas de pixel
- **Tamanho do snapshot** — páginas grandes podem ser truncadas ou resumidas por LLM em 15.000 caracteres (equivalente ao `web_extract`); o snapshot completo é salvo em `~/.work4you/cache/web/` e a saída aponta para ele para paginação via `read_file`
- **Timeout de sessão** — sessões em nuvem expiram de acordo com as configurações de plano do seu provedor
- **Custo** — sessões em nuvem consomem créditos do provedor; sessões são limpas automaticamente quando a conversa termina ou após inatividade. Use `/browser connect` para navegação local gratuita.
- **Sem download de arquivos** — não é possível baixar arquivos do navegador
