---
sidebar_position: 3
title: "Configuração com Nix & NixOS"
description: "Instale e implante o Work4You com Nix — do `nix run` rápido ao módulo NixOS totalmente declarativo com modo container"
---

# Configuração com Nix & NixOS

:::warning Plataforma de Nível 2
Nix e NixOS são [plataformas de Nível 2](./platform-support.md#tier-2). O flake e o módulo NixOS documentados aqui são mantidos apenas em regime de melhor esforço. Commits na `main` podem quebrar esses pacotes a qualquer momento.

Para uma configuração suportada, use um dos caminhos padrão de [instalação](./installation.md) — Docker ou um ambiente FHS.
:::

O Work4You disponibiliza um flake Nix, um módulo NixOS e um módulo Home Manager.

| Nível | Para quem é | O que você ganha |
|-------|-------------|--------------|
| **`nix run` / `nix profile install`** | Qualquer usuário de Nix (macOS, Linux) | Binário pré-compilado com todas as dependências — depois use o fluxo de trabalho padrão da CLI |
| **Módulo Home Manager** | Um agente para uma pessoa, em qualquer distribuição ou no macOS | Configuração declarativa e um serviço de usuário, sem root |
| **Módulo NixOS (nativo)** | Implantações em servidores NixOS | Configuração declarativa, serviço systemd reforçado, segredos gerenciados |
| **Módulo NixOS (container)** | Agentes que precisam de auto-modificação | Tudo acima, mais um container Ubuntu persistente onde o agente pode fazer `apt`/`pip`/`npm install` |

:::info O que é diferente em relação à instalação padrão
O instalador `curl | bash` gerencia o Python, o Node e as dependências por conta própria. O flake Nix substitui tudo isso — cada dependência Python é uma derivação Nix construída pelo [uv2nix](https://github.com/pyproject-nix/uv2nix), e as ferramentas de runtime (Node.js, git, ripgrep, ffmpeg) são embutidas no PATH do binário. Não há pip em tempo de execução, nem ativação de venv, nem `npm install`.

**Para usuários fora do NixOS**, isso só muda a etapa de instalação. Tudo o que vem depois (`work4you setup`, `work4you gateway install`, edição de configuração) funciona de forma idêntica à instalação padrão.

**Para usuários do módulo NixOS**, todo o ciclo de vida é diferente: a configuração vive em `configuration.nix`, os segredos passam por sops-nix/agenix, o serviço é uma unidade systemd, e os comandos de configuração da CLI são bloqueados. Você gerencia o work4you da mesma forma que gerencia qualquer outro serviço NixOS.
:::

## Pré-requisitos

- **Nix com flakes habilitado** — [Determinate Nix](https://install.determinate.systems) recomendado (habilita flakes por padrão)
- **Chaves de API** para os serviços que você quer usar (no mínimo: uma chave OpenRouter ou Anthropic)

---

## Início Rápido (Qualquer Usuário de Nix)

Sem necessidade de clone. O Nix busca, compila e executa tudo:

```bash
# Execute o app desktop
nix run github:Leow4u/FORK-56#desktop

# Ou instale de forma persistente
nix profile install github:Leow4u/FORK-56#desktop

# execute o tui
nix run github:Leow4u/FORK-56 -- setup
nix run github:Leow4u/FORK-56 -- --tui

# ou instale-o no seu profile
nix profile install github:Leow4u/FORK-56
work4you setup
work4you --tui
```

Depois do `nix profile install`, `work4you`, `work4you`, e `work4you-acp` ficam disponíveis no seu PATH. A partir daqui, o fluxo de trabalho é idêntico à [instalação padrão](./installation.md) — o `work4you setup` guia você pela seleção de provedor, o `work4you gateway install` configura um serviço de usuário launchd (macOS) ou systemd, e a configuração fica em `~/.work4you/`.

:::warning Plataformas de mensagens (Discord, Telegram, Slack)
O pacote padrão inclui TODAS as bibliotecas que o work4you pode precisar. Se você quiser uma variante menor, confira as outras saídas do flake.

O pacote `default` adiciona ~700 MB ao closure. Se você só precisa de plataformas de mensagens, `#messaging` adiciona apenas ~33 MB.

:::

<details>
<summary><strong>Executando a partir de um clone local</strong></summary>

```bash
git clone https://github.com/Leow4u/FORK-56.git
cd work4you
nix develop
work4you setup
```

</details>

---

## Módulo NixOS

O flake exporta `nixosModules.default` — um módulo de serviço NixOS completo que gerencia de forma declarativa a criação de usuário, diretórios, geração de configuração, segredos, documentos e o ciclo de vida do serviço.

:::note
Este módulo precisa do NixOS. O Work4You é um agente para uma pessoa. Se você quer um agente para uma pessoa e não um serviço de sistema, use o [módulo Home Manager](#home-manager-module). Esse módulo roda no NixOS e em cada outro sistema que o Home Manager suporta.
:::

### Adicione a Entrada do Flake

```nix
# /etc/nixos/flake.nix (ou o flake do seu sistema)
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    work4you.url = "github:Leow4u/FORK-56";
  };

  outputs = { nixpkgs, work4you, ... }: {
    nixosConfigurations.your-host = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        work4you.nixosModules.default
        ./configuration.nix
      ];
    };
  };
}
```

### Configuração Mínima

```nix
# configuration.nix
{ config, ... }: {
  services.work4you = {
    enable = true;
    settings.model.default = "anthropic/claude-sonnet-4";
    environmentFiles = [ config.sops.secrets."work4you-env".path ];
    addToSystemPackages = true;
  };
}
```

É só isso. O `nixos-rebuild switch` cria o usuário `work4you`, gera o `config.yaml`, conecta os segredos e inicia o gateway — um serviço de longa duração que conecta o agente às plataformas de mensagens (Telegram, Discord, etc.) e escuta mensagens recebidas.

:::warning Segredos são obrigatórios
A linha `environmentFiles` acima assume que você tem o [sops-nix](https://github.com/Mic92/sops-nix) ou o [agenix](https://github.com/ryantm/agenix) configurado. O arquivo deve conter ao menos uma chave de provedor de LLM (ex.: `OPENROUTER_API_KEY=sk-or-...`). Veja [Gerenciamento de Segredos](#secrets-management) para a configuração completa. Se você ainda não tem um gerenciador de segredos, pode usar um arquivo simples como ponto de partida — apenas garanta que ele não seja legível por todos:

```bash
echo "OPENROUTER_API_KEY=sk-or-your-key" | sudo install -m 0600 -o work4you /dev/stdin /var/lib/work4you/env
```

```nix
services.work4you.environmentFiles = [ "/var/lib/work4you/env" ];
```
:::

:::tip addToSystemPackages
Definir `addToSystemPackages = true` faz duas coisas: coloca a CLI `work4you` no PATH do sistema **e** define `WORK4YOU_HOME` em nível de sistema, para que a CLI interativa compartilhe estado (sessões, skills, cron) com o serviço de gateway. Sem isso, executar `work4you` no seu shell cria um diretório `~/.work4you/` separado.
:::

### CLI com Suporte a Container

:::info
Quando `container.enable = true` e `addToSystemPackages = true`, **todo** comando `work4you` no host é automaticamente roteado para dentro do container gerenciado. Isso significa que sua sessão de CLI interativa roda dentro do mesmo ambiente que o serviço de gateway — com acesso a todos os pacotes e ferramentas instalados no container.

- O roteamento é transparente: `work4you chat`, `work4you sessions list`, `work4you version`, etc. todos executam dentro do container por baixo dos panos
- Todas as flags da CLI são repassadas como estão
- Se o container não estiver rodando, a CLI tenta novamente por um curto período (5s com um spinner para uso interativo, 10s silenciosamente para scripts) e então falha com um erro claro — sem fallback silencioso
- Para desenvolvedores trabalhando no código-fonte do work4you, defina `WORK4YOU_DEV=1` para contornar o roteamento de container e rodar o checkout local diretamente

Defina `container.hostUsers` para criar um symlink `~/.work4you` apontando para o diretório de estado do serviço, de modo que a CLI do host e o container compartilhem sessões, configuração e memórias:

```nix
services.work4you = {
  container.enable = true;
  container.hostUsers = [ "your-username" ];
  addToSystemPackages = true;
};
```

Usuários listados em `hostUsers` são automaticamente adicionados ao grupo `work4you` para acesso a permissões de arquivos.

**Usuários de Podman:** O serviço NixOS executa o container como root. Usuários de Docker obtêm acesso via o socket do grupo `docker`, mas containers rootful do Podman exigem sudo. Conceda sudo sem senha para o seu runtime de container:

```nix
security.sudo.extraRules = [{
  users = [ "your-username" ];
  commands = [{
    command = "/run/current-system/sw/bin/podman";
    options = [ "NOPASSWD" ];
  }];
}];
```

A CLI detecta automaticamente quando o sudo é necessário e o usa de forma transparente. Sem isso, você precisará rodar `sudo work4you chat` manualmente.
:::

### Verifique se Está Funcionando

Depois do `nixos-rebuild switch`, verifique se o serviço está rodando:

```bash
# Verifique o status do serviço
systemctl status work4you

# Acompanhe os logs (Ctrl+C para parar)
journalctl -u work4you -f

# Se addToSystemPackages for true, teste a CLI
work4you version
work4you config       # mostra a configuração gerada
```

### Escolhendo um Modo de Implantação

O módulo suporta dois modos, controlados por `container.enable`:

| | **Nativo** (padrão) | **Container** |
|---|---|---|
| Como roda | Serviço systemd reforçado no host | Container Ubuntu persistente com `/nix/store` montado via bind mount |
| Segurança | `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp` | Isolamento de container, roda como usuário sem privilégios dentro |
| Agente pode auto-instalar pacotes | Não — apenas ferramentas no PATH fornecido pelo Nix | Sim — instalações de `apt`, `pip`, `npm` persistem entre reinicializações |
| Superfície de configuração | Igual | Igual |
| Quando escolher | Implantações padrão, segurança máxima, reprodutibilidade | O agente precisa de instalação de pacotes em tempo de execução, ambiente mutável, ferramentas experimentais |

Para habilitar o modo container, adicione uma linha:

```nix
{
  services.work4you = {
    enable = true;
    container.enable = true;
    # ... o resto da configuração é idêntico
  };
}
```

:::info
O modo container habilita automaticamente `virtualisation.docker.enable` via `mkDefault`. Se você usar Podman em vez disso, defina `container.backend = "podman"` e `virtualisation.docker.enable = false`.
:::

---

## Configuração

### Configurações Declarativas

A opção `settings` aceita um attrset arbitrário que é renderizado como `config.yaml`. Ela suporta merge profundo entre múltiplas definições de módulo (via `lib.recursiveUpdate`), então você pode dividir a configuração entre arquivos:

```nix
# base.nix
services.work4you.settings = {
  model.default = "anthropic/claude-sonnet-4";
  toolsets = [ "all" ];
  terminal = { backend = "local"; timeout = 180; };
};

# personality.nix
services.work4you.settings = {
  display = { compact = false; personality = "kawaii"; };
  memory = { memory_enabled = true; user_profile_enabled = true; };
};
```

Ambos passam por merge profundo no momento da avaliação. Chaves declaradas no Nix sempre prevalecem sobre chaves em um `config.yaml` já existente no disco, mas **chaves adicionadas pelo usuário que o Nix não toca são preservadas**. Isso significa que, se o agente ou uma edição manual adicionar chaves como `skills.disabled` ou `streaming.enabled`, elas sobrevivem ao `nixos-rebuild switch`.

:::note Nomenclatura de modelo
`settings.model.default` usa o identificador de modelo que seu provedor espera. Com o [OpenRouter](https://openrouter.ai) (o padrão), esses se parecem com `"anthropic/claude-sonnet-4"` ou `"google/gemini-3-flash"`. Se você estiver usando um provedor diretamente (Anthropic, OpenAI), defina `settings.model.base_url` para apontar para a API deles e use os IDs de modelo nativos deles (ex.: `"claude-sonnet-4-20250514"`). Quando nenhum `base_url` é definido, o Work4You usa o OpenRouter por padrão.
:::

:::tip Descobrindo chaves de configuração disponíveis
Execute `nix build .#configKeys && cat result` para ver cada chave de configuração folha extraída do `DEFAULT_CONFIG` do Python. Você pode colar o seu `config.yaml` existente no attrset `settings` — a estrutura mapeia 1:1.
:::

<details>
<summary><strong>Exemplo completo: todas as configurações comumente personalizadas</strong></summary>

```nix
{ config, ... }: {
  services.work4you = {
    enable = true;
    container.enable = true;

    # ── Modelo ──────────────────────────────────────────────────────────
    settings = {
      model = {
        base_url = "https://openrouter.ai/api/v1";
        default = "anthropic/claude-opus-4.6";
      };
      toolsets = [ "all" ];
      max_turns = 100;
      terminal = { backend = "local"; cwd = "."; timeout = 180; };
      compression = {
        enabled = true;
        threshold = 0.85;
        summary_model = "google/gemini-3-flash-preview";
      };
      memory = { memory_enabled = true; user_profile_enabled = true; };
      display = { compact = false; personality = "kawaii"; };
      agent = { max_turns = 60; verbose = false; };
    };

    # ── Segredos ────────────────────────────────────────────────────────
    environmentFiles = [ config.sops.secrets."work4you-env".path ];

    # ── Documentos ──────────────────────────────────────────────────────
    # USER.md é memória, então vai para WORK4YOU_HOME. Arquivos de workspace usam
    # `documents`, e essa opção precisa de um `workingDirectory` explícito.
    work4youHomeFiles = {
      "memories/USER.md" = ./documents/USER.md;
    };

    # ── Servidores MCP ────────────────────────────────────────────────────
    mcpServers.filesystem = {
      command = "npx";
      args = [ "-y" "@modelcontextprotocol/server-filesystem" "/data/workspace" ];
    };

    # ── Opções de container ──────────────────────────────────────────────
    container = {
      image = "ubuntu:24.04";
      backend = "docker";
      hostUsers = [ "your-username" ];
      extraVolumes = [ "/home/user/projects:/projects:rw" ];
      extraOptions = [ "--gpus" "all" ];
    };

    # ── Ajuste do serviço ─────────────────────────────────────────────────
    addToSystemPackages = true;
    extraArgs = [ "--verbose" ];
    restart = "always";
    restartSec = 5;
  };
}
```

</details>

### Válvula de Escape: Traga Sua Própria Configuração

Se você preferir gerenciar o `config.yaml` totalmente fora do Nix, use `configFile`:

```nix
services.work4you.configFile = /etc/work4you/config.yaml;
```

Isso ignora o `settings` por completo — sem merge, sem geração. O arquivo é copiado como está para `$WORK4YOU_HOME/config.yaml` em cada ativação.

### Folha de Referência de Personalização

Referência rápida para as coisas mais comuns que os usuários de Nix querem personalizar:

| Eu quero... | Opção | Exemplo |
|---|---|---|
| Mudar o modelo de LLM | `settings.model.default` | `"anthropic/claude-sonnet-4"` |
| Usar um endpoint de provedor diferente | `settings.model.base_url` | `"https://openrouter.ai/api/v1"` |
| Adicionar chaves de API | `environmentFiles` | `[ config.sops.secrets."work4you-env".path ]` |
| Dar uma identidade ao agente | `work4youHomeFiles."SOUL.md"` | `"You are a terse ops assistant."` |
| Adicionar contexto de projeto ao workspace | `documents."AGENTS.md"` | `./documents/AGENTS.md` |
| Executar o backend do app desktop ou do dashboard | `backend.mode` | `"serve"` ou `"dashboard"` |
| Adicionar servidores de ferramentas MCP | `mcpServers.<name>` | Veja [Servidores MCP](#mcp-servers) |
| Habilitar Discord/Telegram/Slack | `extraDependencyGroups` | `[ "messaging" ]` |
| Montar diretórios do host no container | `container.extraVolumes` | `[ "/data:/data:rw" ]` |
| Passar acesso a GPU para o container | `container.extraOptions` | `[ "--gpus" "all" ]` |
| Usar Podman em vez de Docker | `container.backend` | `"podman"` |
| Compartilhar estado entre a CLI do host e o container | `container.hostUsers` | `[ "sidbin" ]` |
| Disponibilizar ferramentas extras para o agente | `extraPackages` | `[ pkgs.pandoc pkgs.imagemagick ]` |
| Usar uma imagem base personalizada | `container.image` | `"ubuntu:24.04"` |
| Sobrescrever o pacote work4you | `package` | `inputs.work4you.packages.${system}.default.override { ... }` |
| Mudar o diretório de estado | `stateDir` | `"/opt/work4you"` |
| Definir o diretório de trabalho do agente | `workingDirectory` | `"/home/user/projects"` |

---

## Gerenciamento de Segredos

:::danger Nunca coloque chaves de API em `settings` ou `environment`
Valores em expressões Nix acabam em `/nix/store`, que é legível por todos. Sempre use `environmentFiles` com um gerenciador de segredos.
:::

Tanto `environment` (variáveis não secretas) quanto `environmentFiles` (arquivos secretos) são mesclados em `$WORK4YOU_HOME/.env` no momento da ativação (`nixos-rebuild switch`). O Work4You lê esse arquivo em cada inicialização, então as mudanças entram em vigor com um `systemctl restart work4you` — sem necessidade de recriar o container.

### sops-nix

```nix
{
  sops = {
    defaultSopsFile = ./secrets/work4you.yaml;
    age.keyFile = "/home/user/.config/sops/age/keys.txt";
    secrets."work4you-env" = { format = "yaml"; };
  };

  services.work4you.environmentFiles = [
    config.sops.secrets."work4you-env".path
  ];
}
```

O arquivo de segredos contém pares chave-valor:

```yaml
# secrets/work4you.yaml (criptografado com sops)
work4you-env: |
    OPENROUTER_API_KEY=sk-or-...
    TELEGRAM_BOT_TOKEN=123456:ABC...
    ANTHROPIC_API_KEY=sk-ant-...
```

### agenix

```nix
{
  age.secrets.work4you-env.file = ./secrets/work4you-env.age;

  services.work4you.environmentFiles = [
    config.age.secrets.work4you-env.path
  ];
}
```

### OAuth / Preenchimento de Autenticação

Para plataformas que exigem OAuth (ex.: Discord), use `authFile` para preencher credenciais na primeira implantação:

```nix
{
  services.work4you = {
    authFile = config.sops.secrets."work4you/auth.json".path;
    # authFileForceOverwrite = true;  # sobrescreve a cada ativação
  };
}
```

O arquivo só é copiado se o `auth.json` ainda não existir (a menos que `authFileForceOverwrite = true`). Renovações de token OAuth em tempo de execução são gravadas no diretório de estado e preservadas entre rebuilds.

---

## Documentos

O Work4You lê arquivos de dois diretórios. Assim, há duas opções. Use a opção referente ao diretório para o qual o arquivo deve ir.

`documents` instala no **diretório de trabalho** do agente, que é o `workingDirectory`. O agente lê o contexto do seu projeto a partir desse workspace:

```nix
{
  services.work4you = {
    # documents precisa desta opção. Leia a observação abaixo.
    workingDirectory = "/var/lib/work4you/workspace";
    documents = {
      "AGENTS.md" = ./documents/AGENTS.md;   # referência de caminho, copiado do Nix store
      "notes/oncall.md" = "Page #infra before restarting anything.";
    };
  };
}
```

:::warning documents precisa de um workingDirectory explícito
O módulo recusa `documents` até que você defina `workingDirectory`. O padrão
dessa opção é diferente em cada módulo. É o seu diretório home no Home
Manager, e `${stateDir}/workspace` no NixOS. Assim, um padrão não definido coloca os
arquivos em um diretório que você não selecionou. Um diretório com o mesmo caminho do
padrão é uma seleção correta, e ela satisfaz a regra.
:::

`work4youHomeFiles` instala em **`WORK4YOU_HOME`**. O Work4You lê o arquivo de identidade e os arquivos de memória do agente a partir desse diretório. `SOUL.md` e `memories/` funcionam somente a partir de lá. Um `SOUL.md` em `documents` vira um arquivo de workspace. O Work4You não carrega esse arquivo como identidade:

```nix
{
  services.work4you.work4youHomeFiles = {
    "SOUL.md" = "You are a helpful AI assistant.";
    "memories/USER.md" = ./documents/USER.md;
  };
}
```

Cada valor é uma string ou um caminho. Uma chave em qualquer uma das opções pode conter subdiretórios, e o módulo cria os diretórios pai. Cada ativação instala os arquivos novamente.

`work4youHomeFiles` não precisa de `workingDirectory`, porque o módulo é dono do diretório `WORK4YOU_HOME`. A maioria dos usuários quer `work4youHomeFiles`.

---

## Servidores MCP

A opção `mcpServers` configura de forma declarativa servidores [MCP (Model Context Protocol)](https://modelcontextprotocol.io). Cada servidor usa transporte **stdio** (comando local) ou **HTTP** (URL remota).

### Transporte Stdio (Servidores Locais)

```nix
{
  services.work4you.mcpServers = {
    filesystem = {
      command = "npx";
      args = [ "-y" "@modelcontextprotocol/server-filesystem" "/data/workspace" ];
    };
    github = {
      command = "npx";
      args = [ "-y" "@modelcontextprotocol/server-github" ];
      env.GITHUB_PERSONAL_ACCESS_TOKEN = "\${GITHUB_TOKEN}"; # resolvido a partir do .env
    };
  };
}
```

:::tip
Variáveis de ambiente nos valores de `env` são resolvidas a partir de `$WORK4YOU_HOME/.env` em tempo de execução. Use `environmentFiles` para injetar segredos — nunca coloque tokens diretamente na configuração Nix.
:::

### Transporte HTTP (Servidores Remotos)

```nix
{
  services.work4you.mcpServers.remote-api = {
    url = "https://mcp.example.com/v1/mcp";
    headers.Authorization = "Bearer \${MCP_REMOTE_API_KEY}";
    timeout = 180;
  };
}
```

### Transporte HTTP com OAuth

Defina `auth = "oauth"` para servidores que usam OAuth 2.1. O Work4You implementa o fluxo PKCE completo — descoberta de metadados, registro dinâmico de cliente, troca de token e renovação automática.

```nix
{
  services.work4you.mcpServers.my-oauth-server = {
    url = "https://mcp.example.com/mcp";
    auth = "oauth";
  };
}
```

Os tokens são armazenados em `$WORK4YOU_HOME/mcp-tokens/<server-name>.json` e persistem entre reinicializações e rebuilds.

<details>
<summary><strong>Autorização OAuth inicial em servidores headless</strong></summary>

A primeira autorização OAuth exige um fluxo de consentimento baseado em navegador. Em uma implantação headless, o Work4You imprime a URL de autorização em stdout/logs em vez de abrir um navegador.

**Opção A: Bootstrap interativo** — execute o fluxo uma vez via `docker exec` (container) ou `sudo -u work4you` (nativo):

```bash
# Modo container
docker exec -it work4you \
  work4you mcp add my-oauth-server --url https://mcp.example.com/mcp --auth oauth

# Modo nativo
sudo -u work4you WORK4YOU_HOME=/var/lib/work4you/.work4you \
  work4you mcp add my-oauth-server --url https://mcp.example.com/mcp --auth oauth
```

O container usa `--network=host`, então o listener de callback OAuth em `127.0.0.1` fica acessível a partir do navegador do host.

**Opção B: Pré-preencher tokens** — complete o fluxo em uma estação de trabalho, depois copie os tokens:

```bash
work4you mcp add my-oauth-server --url https://mcp.example.com/mcp --auth oauth
scp ~/.work4you/mcp-tokens/my-oauth-server{,.client}.json \
    server:/var/lib/work4you/.work4you/mcp-tokens/
# Garanta: chown work4you:work4you, chmod 0600
```

</details>

### Sampling (Requisições de LLM Iniciadas pelo Servidor)

Alguns servidores MCP podem solicitar completions de LLM ao agente:

```nix
{
  services.work4you.mcpServers.analysis = {
    command = "npx";
    args = [ "-y" "analysis-server" ];
    sampling = {
      enabled = true;
      model = "google/gemini-3-flash";
      max_tokens_cap = 4096;
      timeout = 30;
      max_rpm = 10;
    };
  };
}
```

---

## Modo Gerenciado

Quando o work4you roda via o módulo NixOS, os seguintes comandos da CLI ficam **bloqueados** com um erro descritivo apontando para `configuration.nix`:

| Comando bloqueado | Motivo |
|---|---|
| `work4you setup` | A configuração é declarativa — edite `settings` na sua configuração Nix |
| `work4you config edit` | A configuração é gerada a partir de `settings` |
| `work4you config set <key> <value>` | A configuração é gerada a partir de `settings` |
| `work4you gateway install` | O serviço systemd é gerenciado pelo NixOS |
| `work4you gateway uninstall` | O serviço systemd é gerenciado pelo NixOS |

Isso evita divergência entre o que o Nix declara e o que está no disco. A detecção usa dois sinais:

1. **A variável de ambiente `WORK4YOU_MANAGED`.** O serviço a define, e o processo do gateway a lê.
2. **O arquivo marcador `.managed`** em `WORK4YOU_HOME`. O script de ativação o escreve, e um shell interativo o lê. Assim, a CLI também bloqueia um comando como `docker exec -it work4you work4you config set ...`.

Ambos os sinais contêm o nome do sistema que gerencia a instalação. Assim, a recusa nomeia o comando de rebuild correto. O módulo NixOS dá `sudo nixos-rebuild switch`. O módulo Home Manager dá `home-manager switch`.

---

## Módulo Home Manager

O flake também exporta `homeManagerModules.default`. O Work4You é um agente para uma pessoa. As credenciais, a memória, as sessões e os jobs de cron pertencem todos a essa pessoa. Assim, um serviço de usuário é a forma correta em uma máquina pessoal. Ele roda em cada distribuição que o Home Manager suporta, e não apenas no NixOS.

O conjunto de opções é o mesmo que o módulo NixOS usa. É `services.work4you`, com as mesmas opções `settings`, `environmentFiles`, `documents`, `mcpServers`, `extraPlugins` e `backend`. Cada exemplo acima funciona aqui sem alteração. Apenas as partes necessárias são diferentes:

| | Módulo NixOS | Módulo Home Manager |
|---|---|---|
| Roda como | um usuário de sistema que você declara, com `user`, `group` e `createUser` | você |
| Diretório de estado | `stateDir` e `/.work4you` | `work4youHome`, definido diretamente. O padrão é `~/.work4you`. |
| Serviço | `systemd.services` | `systemd.user.services` no Linux, `launchd.agents` no macOS |
| CLI no PATH | `addToSystemPackages`, que exporta `WORK4YOU_HOME` para todo o sistema | `installPackage`, que a exporta apenas para a sua sessão |
| Modo container | suportado | não suportado, porque precisa de root e do socket do Docker |

### Adicione a Entrada do Flake

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";
    work4you.url = "github:Leow4u/FORK-56";
  };
}
```

Depois importe o módulo na sua configuração do Home Manager. A configuração pode ser standalone. Ela também pode estar sob `home-manager.users.<name>` em uma configuração NixOS ou nix-darwin:

```nix
{
  imports = [ work4you.homeManagerModules.default ];

  services.work4you = {
    enable = true;
    gateway.enable = true;
    settings.model.default = "anthropic/claude-sonnet-4";
    environmentFiles = [ config.sops.secrets."work4you-env".path ];
  };
}
```

O `home-manager switch` cria `~/.work4you`, escreve o `config.yaml`, monta o `.env` e inicia o gateway como um serviço de usuário.

:::warning Habilite o linger, ou o serviço para no logout
ATENÇÃO: Habilite o linger para a sua conta. Sem o linger, o systemd para o gerenciador de usuário quando sua última sessão termina, e o gateway para junto. O Home Manager não pode definir o linger, porque o linger é uma propriedade da conta:

```nix
# NixOS
users.users.your-username.linger = true;
```

```bash
# em qualquer outro lugar
sudo loginctl enable-linger your-username
```

O macOS não tem uma opção equivalente. Um agente `launchd` com `RunAtLoad` inicia no login e continua rodando.
:::

### Executando o Backend do Desktop / Dashboard

`gateway.enable` roda o gateway de mensagens para Telegram, Discord, Slack e as outras plataformas. O Work4You Desktop e o dashboard web se conectam a um processo *diferente*, que é o `work4you serve` ou o `work4you dashboard`. `backend.mode` roda esse processo junto com o gateway:

```nix
{
  services.work4you = {
    enable = true;
    gateway.enable = true;      # plataformas de mensagens
    backend.mode = "dashboard"; # + o dashboard do navegador em 127.0.0.1:9119
    backend.port = 9119;
  };
}
```

`serve` roda sem interface de usuário. Ele fornece os sockets `/api/ws` e `/api/pty` aos quais o Work4You Desktop se conecta, e não constrói a aplicação web. `dashboard` fornece tudo isso, e também serve o painel de administração do navegador. Ambos os processos usam um único `WORK4YOU_HOME` junto com o gateway. Assim, as sessões, as skills, a memória e os jobs de cron são os mesmos para todos eles. `backend.mode` funciona da mesma forma no módulo NixOS, mas não no modo container.

:::warning Vincular a um endereço diferente de loopback
O endereço padrão é `127.0.0.1`. Cada outro endereço ativa o portão de autenticação do dashboard. O servidor também recusa cada requisição com um cabeçalho `Host` diferente do endereço ao qual o servidor foi vinculado. Isso é uma defesa contra DNS rebinding. Vincule ao nome ou ao endereço que o seu cliente usa.
:::

### Verifique se Está Funcionando

```bash
# Linux
systemctl --user status work4you
journalctl --user -u work4you -f

# macOS
launchctl list | grep work4you
tail -f ~/Library/Logs/work4you.log

work4you version
work4you config     # mostra a configuração que o Nix escreveu
```

---

## Arquitetura do Container

:::info
Esta seção só é relevante se você estiver usando `container.enable = true`. Pule-a para implantações em modo nativo.
:::

Quando o modo container está habilitado, o work4you roda dentro de um container Ubuntu persistente com o binário compilado pelo Nix montado somente leitura a partir do host via bind mount:

```
Host                                    Container
────                                    ─────────
/nix/store/...-work4you-0.1.0  ──►  /nix/store/... (ro)
~/.work4you -> /var/lib/work4you/.work4you       (ponte de symlink, por hostUsers)
/var/lib/work4you/                    ──►  /data/          (rw)
  ├── current-package -> /nix/store/...    (symlink, atualizado a cada rebuild)
  ├── .gc-root -> /nix/store/...           (previne nix-collect-garbage)
  ├── .container-identity                  (hash sha256, dispara recriação)
  ├── .work4you/                             (WORK4YOU_HOME)
  │   ├── .env                             (mesclado a partir de environment + environmentFiles)
  │   ├── config.yaml                      (gerado pelo Nix, mesclado profundamente a cada ativação)
  │   ├── .managed                         (arquivo marcador)
  │   ├── .container-mode                  (metadados de roteamento: backend, exec_user, etc.)
  │   ├── state.db, sessions/, memories/   (estado em tempo de execução)
  │   └── mcp-tokens/                      (tokens OAuth para servidores MCP)
  ├── home/                                ──►  /home/work4you    (rw)
  └── workspace/                           (diretório de trabalho do agente)
      ├── AGENTS.md                        (a partir da opção documents)
      └── (arquivos criados pelo agente)

Camada gravável do container (apt/pip/npm):   /usr, /usr/local, /tmp
```

O binário compilado pelo Nix funciona dentro do container Ubuntu porque o `/nix/store` é montado via bind mount — ele traz seu próprio interpretador e todas as dependências, então não há dependência das bibliotecas de sistema do container. O ponto de entrada do container resolve através de um symlink `current-package`: `/data/current-package/bin/work4you gateway run --replace`. No `nixos-rebuild switch`, apenas o symlink é atualizado — o container continua rodando.

### O Que Persiste Através de Quê

| Evento | Container recriado? | `/data` (estado) | `/home/work4you` | Camada gravável (`apt`/`pip`/`npm`) |
|---|---|---|---|---|
| `systemctl restart work4you` | Não | Persiste | Persiste | Persiste |
| `nixos-rebuild switch` (mudança de código) | Não (symlink atualizado) | Persiste | Persiste | Persiste |
| Reinicialização do host | Não | Persiste | Persiste | Persiste |
| `nix-collect-garbage` | Não (GC root) | Persiste | Persiste | Persiste |
| Mudança de imagem (`container.image`) | **Sim** | Persiste | Persiste | **Perdida** |
| Mudança de volume/opções | **Sim** | Persiste | Persiste | **Perdida** |
| Mudança em `environment`/`environmentFiles` | Não | Persiste | Persiste | Persiste |

O container só é recriado quando o **hash de identidade** dele muda. O hash cobre: versão do schema, imagem, `extraVolumes`, `extraOptions`, e o script de ponto de entrada. Mudanças em variáveis de ambiente, configurações, documentos, ou no próprio pacote work4you **não** disparam recriação.

:::warning Perda da camada gravável
Quando o hash de identidade muda (upgrade de imagem, novos volumes, novas opções de container), o container é destruído e recriado a partir de um pull novo de `container.image`. Qualquer pacote `apt install`, `pip install`, ou `npm install` na camada gravável é perdido. O estado em `/data` e `/home/work4you` é preservado (esses são bind mounts).

Se o agente depende de pacotes específicos, considere embuti-los em uma imagem personalizada (`container.image = "my-registry/work4you-base:latest"`) ou fazer um script da instalação deles no `SOUL.md` do agente.
:::

### Proteção do GC Root

O script `preStart` cria um GC root em `${stateDir}/.gc-root` apontando para o pacote work4you atual. Isso previne que o `nix-collect-garbage` remova o binário em execução. Se o GC root de alguma forma quebrar, reiniciar o serviço o recria.

---

## Plugins

O módulo NixOS suporta instalação declarativa de plugins — sem necessidade de `work4you plugins install` imperativo.

### Plugins de Diretório (`extraPlugins`)

Para plugins que são apenas uma árvore de código-fonte com `plugin.yaml` + `__init__.py` (ex.: [work4you-lcm](https://github.com/stephenschoettler/work4you-lcm)):

```nix
services.work4you.extraPlugins = [
  (pkgs.fetchFromGitHub {
    owner = "stephenschoettler";
    repo = "work4you-lcm";
    rev = "v0.7.0";
    hash = "sha256-...";
  })
];
```

Os plugins são vinculados por symlink em `$WORK4YOU_HOME/plugins/` no momento da ativação. O Work4You os descobre através da sua varredura de diretório normal. Remover um plugin da lista e rodar `nixos-rebuild switch` remove o symlink.

### Plugins de Entry-Point (`extraPythonPackages`)

Para plugins empacotados via pip que se registram através de `[project.entry-points."work4you.plugins"]` (ex.: [rtk-work4you](https://github.com/ogallotti/rtk-work4you)):

```nix
services.work4you.extraPythonPackages = [
  (pkgs.python312Packages.buildPythonPackage {
    pname = "rtk-work4you";
    version = "1.0.0";
    src = pkgs.fetchFromGitHub {
      owner = "ogallotti";
      repo = "rtk-work4you";
      rev = "v1.0.0";
      hash = "sha256-...";
    };
    format = "pyproject";
    build-system = [ pkgs.python312Packages.setuptools ];
  })
];
```

O `site-packages` do pacote é adicionado ao PYTHONPATH no wrapper do work4you. O `importlib.metadata` descobre o entry point no início da sessão.

### Grupos de Dependências Opcionais (`extraDependencyGroups`)

Para extras opcionais declarados no `pyproject.toml` do work4you, use `extraDependencyGroups` para incluí-los no venv selado em tempo de build. Isso é necessário para qualquer extra que não esteja no conjunto `[all]` padrão — no Nix, a instalação em tempo de execução no store somente leitura não é possível.

```nix
# Habilite Discord, Telegram, Slack
services.work4you.extraDependencyGroups = [ "messaging" ];
```

```nix
# Habilite um provedor de memória
services.work4you = {
  extraDependencyGroups = [ "hindsight" ];
  settings.memory.provider = "hindsight";
};
```

Isso é resolvido pelo uv junto com as dependências principais — sem patching de PYTHONPATH, sem risco de colisão. Grupos disponíveis:

| Grupo | O que habilita |
|-------|-----------------|
| `messaging` | Discord, Telegram, Slack |
| `matrix` | Matrix/Element (mautrix com criptografia; apenas Linux) |
| `dingtalk` | DingTalk |
| `feishu` | Feishu/Lark |
| `voice` | Reconhecimento de fala local (faster-whisper) |
| `edge-tts` | Provedor Edge TTS |
| `tts-premium` | ElevenLabs TTS |
| `anthropic` | SDK nativo da Anthropic (não necessário via OpenRouter) |
| `bedrock` | AWS Bedrock (boto3) |
| `azure-identity` | Autenticação Azure Entra ID |
| `honcho` | Provedor de memória Honcho |
| `hindsight` | Provedor de memória Hindsight |
| `modal` | Backend de terminal Modal |
| `daytona` | Backend de terminal Daytona |
| `exa` | Busca web Exa |
| `firecrawl` | Busca web Firecrawl |
| `fal` | Geração de imagens FAL |

Ou use os pacotes de flake pré-compilados `#messaging` ou `#full` em vez da configuração por extra (veja [Início Rápido](#quick-start-any-nix-user)).

**Quando usar qual:**

| Necessidade | Opção |
|------|--------|
| Habilitar um extra opcional do pyproject.toml | `extraDependencyGroups` |
| Adicionar um plugin Python externo que não está no pyproject.toml | `extraPythonPackages` |
| Adicionar um binário de sistema (pandoc, jq, etc.) | `extraPackages` |
| Adicionar uma árvore de código-fonte de plugin baseada em diretório | `extraPlugins` |

### Combinando Ambos

Um plugin de diretório com dependências Python de terceiros precisa de ambas as opções:

```nix
services.work4you = {
  extraPlugins = [ my-plugin-src ];          # código-fonte do plugin
  extraPythonPackages = [ pkgs.python312Packages.redis ];  # sua dependência Python
  extraPackages = [ pkgs.redis ];            # binário de sistema que ele precisa
};
```

### Usando o Overlay

Flakes externos podem sobrescrever o pacote diretamente:

```nix
{
  inputs.work4you.url = "github:Leow4u/FORK-56";
  outputs = { work4you, nixpkgs, ... }: {
    nixpkgs.overlays = [ work4you.overlays.default ];
    # Então:
    #   pkgs.work4you.override { extraPythonPackages = [...]; }
    #   pkgs.work4you.override { extraDependencyGroups = [ "hindsight" ]; }
  };
}
```

### Configuração de Plugin

Os plugins ainda precisam ser habilitados no `config.yaml`. Adicione-os via as configurações declarativas:

```nix
services.work4you.settings.plugins.enabled = [
  "work4you-lcm"
  "rtk-rewrite"
];
```

:::note
Uma verificação de colisão em tempo de build previne que pacotes de plugin sobreponham dependências principais do work4you. Se um plugin fornecer um pacote que já está no venv selado, o `nixos-rebuild` falha com um erro claro.
:::

---

## Desenvolvimento

### Shell de Desenvolvimento

O flake fornece um shell de desenvolvimento com Python 3.12, uv, Node.js, e todas as ferramentas de runtime:

```bash
cd work4you
nix develop

# O shell fornece:
#   - Python 3.12 + uv (dependências instaladas em .venv na primeira entrada)
#   - Node.js 26, ripgrep, git, openssh, ffmpeg no PATH
#   - Otimização por stamp-file: reentrada é quase instantânea se as dependências não mudaram
```

```bash
work4you setup
work4you chat
```

### direnv (Recomendado)

O `.envrc` incluído ativa o shell de desenvolvimento automaticamente:

```bash
cd work4you
direnv allow    # uma única vez
# Entradas subsequentes são quase instantâneas (o stamp file pula a instalação de dependências)
```

### Verificações do Flake

O flake inclui verificação em tempo de build que roda no CI e localmente:

```bash
# Execute todas as verificações
nix flake check

# Verificações individuais
nix build .#checks.x86_64-linux.package-contents   # binários existem + versão
nix build .#checks.x86_64-linux.entry-points-sync  # sincronia pyproject.toml ↔ pacote Nix
nix build .#checks.x86_64-linux.cli-commands        # subcomandos gateway/config
nix build .#checks.x86_64-linux.managed-guard       # WORK4YOU_MANAGED bloqueia mutação
nix build .#checks.x86_64-linux.bundled-skills      # skills presentes no pacote
nix build .#checks.x86_64-linux.config-roundtrip    # script de merge preserva chaves do usuário
```

<details>
<summary><strong>O que cada verificação testa</strong></summary>

| Verificação | O que testa |
|---|---|
| `package-contents` | Os binários `work4you` e `work4you` existem e `work4you version` roda |
| `entry-points-sync` | Cada entrada `[project.scripts]` no `pyproject.toml` tem um binário empacotado no pacote Nix |
| `cli-commands` | `work4you --help` expõe os subcomandos `gateway` e `config` |
| `managed-guard` | `WORK4YOU_MANAGED=true work4you config set ...` imprime o erro do NixOS |
| `bundled-skills` | O diretório de skills existe, contém arquivos SKILL.md, `WORK4YOU_BUNDLED_SKILLS` é definido no wrapper |
| `config-roundtrip` | 7 cenários de merge: instalação nova, override do Nix, preservação de chave do usuário, merge misto, merge aditivo de MCP, merge profundo aninhado, idempotência |

</details>

---

## Referência de Opções

### Principal

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `enable` | `bool` | `false` | Habilita o serviço work4you |
| `package` | `package` | `work4you` | O pacote work4you a ser usado |
| `user` | `str` | `"work4you"` | Usuário de sistema |
| `group` | `str` | `"work4you"` | Grupo de sistema |
| `createUser` | `bool` | `true` | Cria automaticamente o usuário/grupo |
| `stateDir` | `str` | `"/var/lib/work4you"` | Diretório de estado (pai do `WORK4YOU_HOME`) |
| `workingDirectory` | `str` | `"${stateDir}/workspace"` | Diretório de trabalho do agente |
| `addToSystemPackages` | `bool` | `false` | Adiciona a CLI `work4you` ao PATH do sistema e define `WORK4YOU_HOME` em nível de sistema |

### Configuração

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `settings` | `attrs` (merge profundo) | `{}` | Configuração declarativa renderizada como `config.yaml`. Suporta aninhamento arbitrário; múltiplas definições são mescladas via `lib.recursiveUpdate` |
| `configFile` | `null` ou `path` | `null` | Caminho para um `config.yaml` existente. Sobrescreve `settings` por completo se definido |

### Segredos & Ambiente

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `environmentFiles` | `listOf str` | `[]` | Caminhos para arquivos de ambiente com segredos. Mesclados em `$WORK4YOU_HOME/.env` no momento da ativação |
| `environment` | `attrsOf str` | `{}` | Variáveis de ambiente não secretas. **Visíveis no Nix store** — não coloque segredos aqui |
| `authFile` | `null` ou `path` | `null` | Seed de credenciais OAuth. Copiado apenas na primeira implantação |
| `authFileForceOverwrite` | `bool` | `false` | Sempre sobrescreve `auth.json` a partir de `authFile` na ativação |

### Documentos

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `documents` | `attrsOf (either str path)` | `{}` | Arquivos de workspace. Cada chave é um caminho relativo a `workingDirectory`. Você deve definir essa opção para usar esta. |
| `work4youHomeFiles` | `attrsOf (either str path)` | `{}` | Arquivos que vão para `WORK4YOU_HOME`. `SOUL.md` e `memories/` devem estar aqui, ou o Work4You não os carrega. |

### Servidores MCP

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `mcpServers` | `attrsOf submodule` | `{}` | Definições de servidor MCP, mescladas em `settings.mcp_servers` |
| `mcpServers.<name>.command` | `null` ou `str` | `null` | Comando do servidor (transporte stdio) |
| `mcpServers.<name>.args` | `listOf str` | `[]` | Argumentos do comando |
| `mcpServers.<name>.env` | `attrsOf str` | `{}` | Variáveis de ambiente para o processo do servidor |
| `mcpServers.<name>.url` | `null` ou `str` | `null` | URL de endpoint do servidor (transporte HTTP/StreamableHTTP) |
| `mcpServers.<name>.headers` | `attrsOf str` | `{}` | Cabeçalhos HTTP, ex.: `Authorization` |
| `mcpServers.<name>.auth` | `null` ou `"oauth"` | `null` | Método de autenticação. `"oauth"` habilita OAuth 2.1 PKCE |
| `mcpServers.<name>.enabled` | `bool` | `true` | Habilita ou desabilita esse servidor |
| `mcpServers.<name>.timeout` | `null` ou `int` | `null` | Timeout de chamada de ferramenta em segundos (padrão: 120) |
| `mcpServers.<name>.connect_timeout` | `null` ou `int` | `null` | Timeout de conexão em segundos (padrão: 60) |
| `mcpServers.<name>.tools` | `null` ou `submodule` | `null` | Filtragem de ferramentas (listas `include`/`exclude`) |
| `mcpServers.<name>.sampling` | `null` ou `submodule` | `null` | Configuração de sampling para requisições de LLM iniciadas pelo servidor |

### Comportamento do Serviço

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `extraArgs` | `listOf str` | `[]` | Argumentos extras para `work4you gateway` |
| `extraPackages` | `listOf package` | `[]` | Pacotes extras disponíveis para o agente. Adicionados ao profile por usuário do usuário work4you, então comandos de terminal, skills e jobs de cron veem todos eles |
| `extraPlugins` | `listOf package` | `[]` | Pacotes de plugin de diretório para vincular por symlink em `$WORK4YOU_HOME/plugins/`. Cada um deve conter `plugin.yaml` |
| `extraPythonPackages` | `listOf package` | `[]` | Pacotes Python adicionados ao PYTHONPATH para descoberta de plugin via entry-point. Construa com `python312Packages` |
| `extraDependencyGroups` | `listOf str` | `[]` | Extras opcionais do pyproject.toml a incluir no venv selado (ex.: `["hindsight"]`). Resolvido pelo uv — sem colisões |
| `restart` | `str` | `"always"` | A política `Restart=` do systemd. O macOS não a usa. |
| `restartSec` | `int` | `5` | O valor `RestartSec=` do systemd. O macOS não o usa. |

### Backend (`work4you serve` / `work4you dashboard`)

Esta opção roda o processo ao qual o Work4You Desktop e o dashboard web se conectam, junto com o gateway. Você não pode usá-la com `container.enable`.

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `backend.mode` | `enum ["none" "serve" "dashboard"]` | `"none"` | `serve` roda sem interface de usuário e fornece `/api/ws` e `/api/pty`. `dashboard` também serve o painel do navegador. |
| `backend.host` | `str` | `"127.0.0.1"` | O endereço ao qual vincular. Cada endereço diferente de loopback ativa o portão de autenticação. |
| `backend.port` | `port` | `9119` | A porta à qual vincular |
| `backend.extraArgs` | `listOf str` | `[]` | Mais argumentos para o comando de backend |

### Somente Home Manager

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `work4youHome` | `str` | `"${config.home.homeDirectory}/.work4you"` | `WORK4YOU_HOME` diretamente. O módulo NixOS o constrói a partir de `stateDir`. |
| `installPackage` | `bool` | `true` | Adiciona a CLI `work4you` a `home.packages`, e exporta `WORK4YOU_HOME` para os seus shells |
| `gateway.enable` | `bool` | `false` | Roda o gateway de mensagens. No módulo NixOS o gateway é o serviço, então esse módulo não tem essa opção. |

### Container (somente NixOS)

| Opção | Tipo | Padrão | Descrição |
|---|---|---|---|
| `container.enable` | `bool` | `false` | Habilita o modo container OCI |
| `container.backend` | `enum ["docker" "podman"]` | `"docker"` | Runtime de container |
| `container.image` | `str` | `"ubuntu:24.04"` | Imagem base (baixada via pull em tempo de execução) |
| `container.extraVolumes` | `listOf str` | `[]` | Montagens de volume extras (`host:container:mode`) |
| `container.extraOptions` | `listOf str` | `[]` | Argumentos extras passados para `docker create` |
| `container.hostUsers` | `listOf str` | `[]` | Usuários interativos que recebem um symlink `~/.work4you` para o stateDir do serviço e são automaticamente adicionados ao grupo `work4you` |

---

## Layout de Diretórios

### Modo Nativo

```
/var/lib/work4you/                     # stateDir (pertence a work4you:work4you, 0750)
├── .work4you/                         # WORK4YOU_HOME
│   ├── SOUL.md                      # de work4youHomeFiles: a identidade do agente
│   ├── config.yaml                  # gerado pelo Nix (merge profundo a cada rebuild)
│   ├── .managed                     # Marcador: mutação de configuração via CLI bloqueada
│   ├── .env                         # Mesclado a partir de environment + environmentFiles
│   ├── auth.json                    # Credenciais OAuth (semeadas, depois autogerenciadas)
│   ├── gateway.pid
│   ├── state.db
│   ├── mcp-tokens/                  # Tokens OAuth para servidores MCP
│   ├── sessions/
│   ├── memories/
│   ├── skills/
│   ├── cron/
│   └── logs/
├── home/                            # HOME do agente
└── workspace/                       # Diretório de trabalho do agente
    ├── AGENTS.md                    # da opção documents
    └── (arquivos criados pelo agente)
```

### Home Manager

```
~/.work4you/                           # work4youHome (WORK4YOU_HOME), 0700
├── SOUL.md                          # de work4youHomeFiles
├── config.yaml                      # escrito pelo Nix, mesclado a cada ativação
├── .managed                         # marcador: nomeia o sistema que gerencia isso
├── .env                             # escrito novamente a partir de environment + environmentFiles
├── auth.json                        # Credenciais OAuth: semeadas, depois o Work4You é dono
├── memories/  sessions/  skills/  cron/  logs/  plugins/
└── (estado em tempo de execução)

~/                                   # workingDirectory, sua home por padrão
└── AGENTS.md                        # da opção documents
```

### Modo Container

Mesmo layout, montado no container:

| Caminho no container | Caminho no host | Modo | Observações |
|---|---|---|---|
| `/nix/store` | `/nix/store` | `ro` | Binário do Work4You + todas as dependências Nix |
| `/data` | `/var/lib/work4you` | `rw` | Todo o estado, configuração, workspace |
| `/home/work4you` | `${stateDir}/home` | `rw` | Home persistente do agente — `pip install --user`, caches de ferramentas |
| `/usr`, `/usr/local`, `/tmp` | (camada gravável) | `rw` | Instalações de `apt`/`pip`/`npm` — persiste entre reinicializações, perdida na recriação |

---

## Atualizando

```bash
# Atualize a entrada do flake (execute a partir do diretório que contém o flake.nix)
cd /etc/nixos && nix flake update work4you

# Refaça o build
sudo nixos-rebuild switch          # para o módulo NixOS
home-manager switch                # para o módulo Home Manager
```

No modo container, o symlink `current-package` é atualizado e o agente pega o novo binário no restart. Sem recriação de container, sem perda de pacotes instalados.

---

## Solução de Problemas

:::tip Usuários de Podman
Todos os comandos `docker` abaixo funcionam da mesma forma com `podman`. Substitua conforme necessário se você definiu `container.backend = "podman"`.
:::

### Logs do Serviço

```bash
# Ambos os modos usam a mesma unidade systemd
journalctl -u work4you -f

# Modo container: também disponível diretamente
docker logs -f work4you
```

### Inspeção do Container

```bash
systemctl status work4you
docker ps -a --filter name=work4you
docker inspect work4you --format='{{.State.Status}}'
docker exec -it work4you bash
docker exec work4you readlink /data/current-package
docker exec work4you cat /data/.container-identity
```

### Forçar Recriação do Container

Se você precisar resetar a camada gravável (Ubuntu limpo):

```bash
sudo systemctl stop work4you
docker rm -f work4you
sudo rm /var/lib/work4you/.container-identity
sudo systemctl start work4you
```

### Verifique se os Segredos Foram Carregados

Se o agente inicia mas não consegue se autenticar com o provedor de LLM, verifique se o arquivo `.env` foi mesclado corretamente:

```bash
# Modo nativo
sudo -u work4you cat /var/lib/work4you/.work4you/.env

# Modo container
docker exec work4you cat /data/.work4you/.env
```

### Verificação do GC Root

```bash
nix-store --query --roots $(docker exec work4you readlink /data/current-package)
```

### Problemas Comuns

| Sintoma | Causa | Solução |
|---|---|---|
| `Cannot save configuration: managed by NixOS` | Guardas da CLI ativas | Edite `configuration.nix` e rode `nixos-rebuild switch` |
| `No adapter available for discord` (ou telegram/slack) | Dependências de mensagens ausentes no venv Nix selado | Instale a variante `#messaging`: `nix profile install ...#messaging`. Para o módulo NixOS: `extraDependencyGroups = [ "messaging" ]`. Verifique `journalctl -u work4you` em busca de `FeatureUnavailable` ou `requirements not met` para o erro subjacente. |
| Container recriado inesperadamente | `extraVolumes`, `extraOptions`, ou `image` mudaram | Esperado — a camada gravável é resetada. Reinstale os pacotes ou use uma imagem personalizada |
| `work4you version` mostra versão antiga | Container não reiniciado | `systemctl restart work4you` |
| Permissão negada em `/var/lib/work4you` | O diretório de estado é `0750 work4you:work4you` | Use `docker exec` ou `sudo -u work4you` |
| `nix-collect-garbage` removeu o work4you | GC root ausente | Reinicie o serviço (o preStart recria o GC root) |
| `no container with name or ID "work4you"` (Podman) | Container rootful do Podman não visível para usuário comum | Adicione sudo sem senha para o podman (veja a seção [Modo Container](#container-mode)) |
| `unable to find user work4you` | Container ainda iniciando (o entrypoint ainda não criou o usuário) | Aguarde alguns segundos e tente novamente — a CLI tenta novamente automaticamente |
| Ferramenta adicionada via `extraPackages` não encontrada no terminal | Requer `nixos-rebuild switch` para atualizar o profile por usuário | Refaça o build e reinicie: `nixos-rebuild switch && systemctl restart work4you` |
