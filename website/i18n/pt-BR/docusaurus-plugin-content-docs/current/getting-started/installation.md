---
sidebar_position: 2
title: "Instalação"
description: "Instale o Work4You no Linux, macOS, WSL2, Windows nativo ou Android via Termux"
---

# Instalação

Coloque o Work4You para rodar em menos de dois minutos!

:::tip Suporte de Plataforma
Para a matriz completa de suporte de plataforma (quais sistemas operacionais, métodos de distribuição e
recursos restritos por plataforma são suportados), veja **[Suporte de Plataforma](./platform-support.md)**.
:::

## Instalação Rápida
### Com o instalador do Work4You Desktop no macOS ou Windows (recomendado)
Para instalar facilmente as aplicações de linha de comando e desktop, [baixe o instalador do Work4You Desktop](https://work4you.ai/) do nosso site e execute-o.

### Sem o Work4You Desktop:
Para uma instalação somente de linha de comando, sem o Work4You Desktop, execute:

#### Linux / macOS / WSL2 / Android (Termux)
```bash
curl -fsSL https://work4you.ai/install.sh | bash
```

#### Windows (nativo)

Execute no powershell:
```powershell
iex (irm https://work4you.ai/install.ps1) 
```

Se você quiser instalar e executar o Work4You Desktop depois de uma instalação somente de linha de comando, basta rodar
```bash
work4you desktop
```

### O Que o Instalador Faz

O instalador cuida de tudo automaticamente — todas as dependências (Python, Node.js, ripgrep, ffmpeg), o clone do repositório, o ambiente virtual, a configuração global do comando `work4you` e a configuração do provedor de LLM. No final, você já está pronto para conversar.

#### Layout da Instalação

Onde o instalador coloca as coisas depende de você estar instalando como usuário comum ou como root:

| Instalador                              | O código fica em                  | Binário do `work4you`                         | Diretório de dados                       |
| -------------------------------------- | ------------------------------ | --------------------------------------- | ------------------------------------ |
| Por usuário (instalador git)               | `~/.work4you/work4you/`      | `~/.local/bin/work4you` (link simbólico)         | `~/.work4you/`                         |
| Modo root (`sudo curl … \| sudo bash`) | `/usr/local/lib/work4you/` | `/usr/local/bin/work4you`                 | `/root/.work4you/` (ou `$WORK4YOU_HOME`) |

O **layout FHS** do modo root (`/usr/local/lib/…`, `/usr/local/bin/work4you`) corresponde a onde outras ferramentas de desenvolvimento do sistema ficam no Linux. É útil para implantações em máquinas compartilhadas, onde uma única instalação do sistema deve atender todos os usuários. A configuração por usuário (autenticação, skills, sessões) continua em `~/.work4you/` de cada usuário ou no `WORK4YOU_HOME` explícito.

### Depois da Instalação

Recarregue o seu shell e comece a conversar:

```bash
source ~/.bashrc   # ou: source ~/.zshrc
work4you             # Comece a conversar!
```

Para reconfigurar configurações individuais depois, use os comandos dedicados:

```bash
work4you model          # Escolha seu provedor de LLM e modelo
work4you tools           # Configure quais ferramentas estão habilitadas
work4you gateway setup  # Configure plataformas de mensagens
work4you config set     # Defina valores de configuração individuais
work4you config get     # Consulte valores de configuração individuais
work4you setup          # Ou execute o assistente completo para configurar tudo de uma vez
```

:::tip Caminho mais rápido: Work4You Portal
Uma única assinatura cobre mais de 300 modelos, além do [Tool Gateway](/user-guide/features/tool-gateway) (busca na web, geração de imagem, TTS, navegador na nuvem). Pule o malabarismo com chaves por ferramenta:

```bash
work4you setup --portal
```

Isso faz seu login, define o Work4You como seu provedor e ativa o Tool Gateway em um único comando.
:::

:::tip Já roda o Work4You em outra máquina?
Você não precisa reconstruir sua configuração do zero. Restaure um backup completo com `work4you import` (veja [Exportando o Work4You para outra máquina](/reference/faq#exporting-work4you-to-another-machine)), ou traga um único agente com `work4you profile import` (veja [Movendo um único perfil para outra máquina](/reference/faq#moving-a-single-profile-to-another-machine)). Note que a exportação de um perfil exclui credenciais por design, então uma exportação sozinha não é um backup completo — [`work4you backup` vs `work4you profile export`](/reference/faq#work4you-backup-vs-work4you-profile-export) explica qual usar.
:::

---

## Pré-requisitos

**Instalador:** Em plataformas que não são Windows, o único pré-requisito é o **Git**. No Linux, também garanta que `curl` e `xz-utils` estejam disponíveis (o instalador baixa o Node.js como um arquivo `.tar.xz`). O aplicativo desktop também exige o `g++` (ou `build-essential` no Debian/Ubuntu) para compilar módulos nativos. O instalador cuida automaticamente de tudo o mais:

- **uv** (gerenciador de pacotes Python rápido)
- **Python 3.11** (via uv, sem necessidade de sudo)
- **Node.js v22** (para automação de navegador e a ponte do WhatsApp)
- **ripgrep** (busca de arquivos rápida)
- **ffmpeg** (conversão de formato de áudio para TTS)

:::info
Você **não** precisa instalar Python, Node.js, ripgrep ou ffmpeg manualmente. O instalador detecta o que está faltando e instala para você. Só garanta que o `git` esteja disponível (`git --version`). No Linux, garanta que `curl` e `xz-utils` estejam instalados (`sudo apt install curl xz-utils` no Debian/Ubuntu). Para o aplicativo desktop, instale também o `build-essential` (`sudo apt install build-essential`).
:::

:::tip Usuários de Nix
O Nix **não é mais um caminho de instalação explicitamente suportado** (apenas melhor esforço). Se você já usa Nix (no NixOS, macOS ou Linux), há um caminho de configuração dedicado com um flake do Nix, um módulo declarativo do NixOS e um modo de contêiner opcional. Veja o guia **[Configuração Nix & NixOS](./nix-setup.md)**.
:::

---

## Instalação Manual / para Desenvolvedores

Se você quiser clonar o repositório e instalar a partir do código-fonte — para contribuir, rodar a partir de um branch específico, ou ter controle total sobre o ambiente virtual — veja a seção [Configuração de Desenvolvimento](../developer-guide/contributing.md#development-setup) no guia de Contribuição.

---

## Instalações Sem Sudo / com Usuário de Serviço do Sistema

Rodar o Work4You como um usuário dedicado sem privilégios (por exemplo, uma conta de serviço systemd `work4you`, ou qualquer usuário sem acesso a `sudo`) é suportado. A única coisa no caminho de instalação que realmente precisa de root é a etapa `--with-deps` do Playwright, que instala via `apt` as bibliotecas compartilhadas (`libnss3`, `libxkbcommon`, etc.) usadas pelo Chromium. O instalador detecta se o sudo está disponível e se adapta graciosamente quando não está — ele instalará o binário do Chromium no próprio cache do Playwright do usuário de serviço e imprimirá o comando exato que um administrador precisa executar separadamente.

**Divisão recomendada (Debian/Ubuntu):**

1. **Uma vez, como um usuário admin com sudo**, instale as bibliotecas do sistema que o Chromium precisa:
   ```bash
   sudo npx playwright install-deps chromium
   ```
   (Você pode rodar isso de qualquer lugar — o `npx` vai buscar o Playwright na hora.)

2. **Como o usuário de serviço sem privilégios**, execute o instalador normal. Ele vai detectar a falta de sudo, pular o `--with-deps`, e instalar o Chromium no cache local do Playwright do usuário:
   ```bash
   curl -fsSL https://work4you.ai/install.sh | bash
   ```

   Se você quiser pular a etapa do Playwright inteiramente — por exemplo, porque está rodando sem interface gráfica e não precisa de automação de navegador — passe `--skip-browser`:
   ```bash
   curl -fsSL https://work4you.ai/install.sh | bash -s -- --skip-browser
   ```

   O instalador também pré-instala o [`cua-driver`](../user-guide/features/computer-use.md) para que o conjunto de ferramentas Computer Use funcione assim que você o ativar; passe `--skip-computer-use` para não fazer isso (ele será instalado sob demanda quando você ativar a ferramenta).

3. **Deixe o `work4you` disponível nos shells do usuário de serviço.** O instalador grava o lançador em `~/.local/bin/work4you`. Contas de serviço do sistema costumam ter um PATH mínimo que não inclui `~/.local/bin`. Adicione esse caminho ao ambiente do usuário, ou crie um link simbólico do lançador para um local do sistema:
   ```bash
   # Opção A — adicionar ao perfil do usuário de serviço
   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

   # Opção B — link simbólico em todo o sistema (executar como admin)
   sudo ln -s /home/work4you/.work4you/work4you/venv/bin/work4you /usr/local/bin/work4you
   ```

4. **Verifique:** `work4you doctor` deve agora rodar sem problemas. Se você receber `ModuleNotFoundError: No module named 'dotenv'`, você está invocando o arquivo-fonte do repositório `work4you` (`~/.work4you/work4you/work4you`) com o Python do sistema em vez do lançador do venv (`~/.work4you/work4you/venv/bin/work4you`) — corrija o passo 3.

5. **Rodando o gateway de mensagens a partir dessa conta?** Um serviço em nível de usuário para no logout e não inicia no boot, a menos que você habilite o linger para o usuário de serviço:

   ```bash
   sudo loginctl enable-linger <service-user>
   ```

   Veja [Gateway de Mensagens](/user-guide/messaging/) para a configuração do serviço propriamente dita.

O mesmo padrão funciona no Arch (o instalador usa o pacman com a mesma lógica de detecção de sudo), Fedora/RHEL e openSUSE — essas distros não suportam `--with-deps` de forma alguma, então um administrador sempre instala as bibliotecas do sistema separadamente. Os comandos `dnf`/`zypper` relevantes são impressos pelo instalador.

---

## Solução de Problemas

| Problema | Solução |
|---------|----------|
| `work4you: command not found` | Recarregue seu shell (`source ~/.bashrc`) ou verifique o PATH |
| `API key not set` | Execute `work4you model` para configurar seu provedor, ou `work4you config set OPENROUTER_API_KEY your_key` |
| Configuração faltando após atualização | Execute `work4you config check` e depois `work4you config migrate` |

Para mais diagnósticos, execute `work4you doctor` — ele vai dizer exatamente o que está faltando e como corrigir.

## Detecção automática do método de instalação

O Work4You detecta automaticamente se foi instalado via instalador git, Docker ou NixOS, e o `work4you update` imprime o comando de atualização correspondente para esse caminho. Não há variável de ambiente para configurar — a detecção é baseada no layout da instalação (checkout em `~/.work4you/work4you/`, carimbo da imagem Docker, ou caminho do store do Nix). O `work4you doctor` também mostra o método detectado no seu resumo de ambiente.
