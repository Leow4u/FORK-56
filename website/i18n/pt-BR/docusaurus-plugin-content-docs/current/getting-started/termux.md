---
sidebar_position: 3
title: "Android / Termux"
description: "Rode o Work4You diretamente em um celular Android com o Termux"
---

# Work4You no Android com o Termux

:::warning Plataforma de Nível 2
O Termux (Android) é uma [plataforma de Nível 2](./platform-support.md#tier-2). O script instalador e a documentação aqui são mantidos apenas em regime de melhor esforço. Commits na `main` podem quebrar esses pacotes a qualquer momento.
:::

O Work4You pode rodar diretamente em um celular Android através do [Termux](https://termux.dev/).

Isso proporciona uma CLI local funcionando no celular, além dos extras essenciais que atualmente são conhecidos por instalar corretamente no Android.

## O que é suportado no caminho testado?

O pacote testado do Termux instala:

- a CLI do Work4You
- suporte a cron
- suporte a terminal PTY/em segundo plano
- suporte ao gateway do Telegram (execuções manuais / melhor esforço em segundo plano)
- suporte a MCP
- suporte a memória Honcho
- suporte a ACP

Concretamente, isso corresponde a:

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

## O que ainda não faz parte do caminho testado?

Alguns recursos ainda precisam de dependências no estilo desktop/servidor que não são publicadas para Android, ou ainda não foram validados em celulares:

- `.[all]` não é suportado no Android hoje
- o extra `voice` é bloqueado por `faster-whisper -> ctranslate2`, e o `ctranslate2` não publica wheels para Android
- o bootstrap automático de navegador / Playwright é pulado no instalador do Termux
- o isolamento de terminal baseado em Docker não está disponível dentro do Termux
- o Android ainda pode suspender jobs em segundo plano do Termux, então a persistência do gateway é melhor esforço, e não um serviço gerenciado normal

Isso não impede o Work4You de funcionar bem como um agente de CLI nativo de celular — só significa que a instalação móvel recomendada é intencionalmente mais restrita do que a instalação de desktop/servidor.

---

## Opção `pkg` nativa mantida pela comunidade

:::caution Distribuição operada por colaborador
Este repositório APT é **mantido pela comunidade por `@adybag14-cyber` e não é uma distribuição oficial do Work4You**. O Work4You não constrói, assina, hospeda ou audita esses pacotes. Habilitar o repositório significa confiar no repositório operado pelo colaborador e na sua chave de assinatura. O Termux em si permanece uma plataforma de Nível 2 / melhor esforço.
:::

Para usuários que preferem uma instalação nativa via gerenciador de pacotes em vez de compilar dependências Python/Rust no celular, um repositório APT mantido pela comunidade está disponível. O bootstrap e as fontes de empacotamento do repositório são publicados em [`adybag14-cyber/termux-python`](https://github.com/adybag14-cyber/termux-python), com o build do pacote Work4You em [`adybag14-cyber/termux-work4you`](https://github.com/adybag14-cyber/termux-work4you).

Instale a chave/fonte do repositório e o Work4You com:

```bash
curl -fsSL https://raw.githubusercontent.com/adybag14-cyber/termux-python/main/scripts/setup_apt_repo.sh | bash
pkg install work4you
```

A impressão digital da chave de assinatura do repositório atualmente documentada pela distribuição da comunidade é:

```text
EAD24A2124EFA7393A78B7B14699F966313F7A6B
```

Instalações do Work4You gerenciadas via APT são marcadas com o método de instalação `apt`. O Work4You portanto não roda seu autoatualizador via Git contra arquivos de propriedade do pacote; use o gerenciador de pacotes em vez disso:

```bash
pkg update
pkg upgrade work4you
```

Problemas de empacotamento/repositório/assinatura para esta opção devem ser reportados aos repositórios de empacotamento da comunidade acima. Bugs de runtime do Work4You ainda podem ser reportados aqui, tendo em mente que o suporte a Android/Termux é melhor esforço.

---

## Opção 1: Instalador em uma linha

O Work4You agora vem com um caminho de instalador ciente do Termux:

```bash
curl -fsSL https://work4you.ai/install.sh | bash
```

No Termux, o instalador automaticamente:

- usa o `pkg` para pacotes do sistema
- cria o venv com `python -m venv`
- tenta primeiro o extra amplo `.[termux-all]` e recorre ao extra menor `.[termux]` (depois a uma instalação base) — o instalador via curl segue essa mesma ordem automaticamente
- cria um link do `work4you` em `$PREFIX/bin` para que ele fique no seu PATH do Termux
- pula o bootstrap não testado de navegador / WhatsApp

Se você quiser os comandos explícitos ou precisar depurar uma instalação com falha, use o caminho manual abaixo.

---

## Opção 2: Instalação manual (totalmente explícita)

### 1. Atualize o Termux e instale os pacotes do sistema

```bash
pkg update
pkg install -y git python clang rust make pkg-config libffi openssl nodejs ripgrep ffmpeg
```

Por que esses pacotes?

- `python` — runtime + suporte a venv
- `git` — clonar/atualizar o repositório
- `clang`, `rust`, `make`, `pkg-config`, `libffi`, `openssl` — necessários para compilar algumas dependências Python no Android
- `nodejs` — runtime Node opcional para experimentos além do caminho central testado
- `ripgrep` — busca rápida de arquivos
- `ffmpeg` — conversões de mídia / TTS

### 2. Clone o Work4You

```bash
git clone https://github.com/Leow4u/FORK-56.git
cd work4you
```

### 3. Crie um ambiente virtual

```bash
python -m venv venv
source venv/bin/activate
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install --upgrade pip setuptools wheel
```

O `ANDROID_API_LEVEL` é importante para pacotes baseados em Rust/maturin, como o `jiter`.

### 4. Instale o pacote testado do Termux

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

Se você só quiser o agente central mínimo, isso também funciona:

```bash
python -m pip install -e '.' -c constraints-termux.txt
```

### 5. Coloque o `work4you` no seu PATH do Termux

```bash
ln -sf "$PWD/venv/bin/work4you" "$PREFIX/bin/work4you"
```

O `$PREFIX/bin` já está no PATH no Termux, então isso faz o comando `work4you` persistir entre novos shells sem precisar reativar o venv toda vez.

### 6. Verifique a instalação

```bash
work4you version
work4you doctor
```

### 7. Inicie o Work4You

```bash
work4you
```

---

## Configuração de acompanhamento recomendada

### Configure um modelo

```bash
work4you model
```

Ou defina as chaves diretamente em `~/.work4you/.env`.

### Rode o assistente completo de configuração interativa novamente mais tarde

```bash
work4you setup
```

### Instale dependências Node opcionais manualmente

O caminho testado do Termux pula o bootstrap de Node/navegador de propósito. Se você quiser experimentar com ferramentas de navegador mais tarde, o que você precisa depende de qual backend você usa:

- **Provedores de navegador em nuvem** (Browserbase, Browser Use, Firecrawl) hospedam seu próprio Chromium, então o Node.js sozinho já basta — o `agent-browser` é resolvido de forma preguiçosa via `npx agent-browser` no primeiro uso:

  ```bash
  pkg install nodejs-lts
  ```

- **Automação local de navegador** no Termux precisa de uma instalação de verdade do `agent-browser` — o fallback simples via npx é deliberadamente rejeitado no modo local, por ser frágil demais para ser considerado pronto:

  ```bash
  pkg install nodejs-lts
  npm install -g agent-browser && agent-browser install
  ```

A ferramenta de navegador inclui automaticamente os diretórios do Termux (`/data/data/com.termux/files/usr/bin`) na sua busca de PATH, então o `agent-browser` e o `npx` são descobertos sem nenhuma configuração extra de PATH.

Trate as ferramentas de navegador / WhatsApp no Android como experimentais até que se documente o contrário.

---

## Solução de Problemas

### `No solution found` ao instalar `.[all]`

Use o pacote testado do Termux em vez disso:

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

O bloqueio atualmente é o extra `voice`:

- `voice` puxa o `faster-whisper`
- `faster-whisper` depende do `ctranslate2`
- `ctranslate2` não publica wheels para Android

### `uv pip install` falha no Android

Use o caminho do Termux com o venv da stdlib + `pip` em vez disso:

```bash
python -m venv venv
source venv/bin/activate
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install --upgrade pip setuptools wheel
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

### `jiter` / `maturin` reclama sobre `ANDROID_API_LEVEL`

Defina o nível de API explicitamente antes de instalar:

```bash
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

### `work4you doctor` diz que o ripgrep ou o Node estão faltando

Instale-os com pacotes do Termux:

```bash
pkg install ripgrep nodejs
```

### Falhas de build ao instalar pacotes Python

Garanta que o toolchain de build esteja instalado:

```bash
pkg install clang rust make pkg-config libffi openssl
```

Depois tente de novo:

```bash
python -m pip install -e '.[termux]' -c constraints-termux.txt
```

---

## Limitações conhecidas em celulares

- o backend Docker não está disponível
- a transcrição de voz local via `faster-whisper` não está disponível no caminho testado
- a configuração de automação de navegador é intencionalmente pulada pelo instalador
- alguns extras opcionais podem funcionar, mas só `.[termux]` e `.[termux-all]` estão atualmente documentados como os pacotes Android testados

Se você encontrar um novo problema específico do Android, por favor abra uma issue no GitHub com:

- sua versão do Android
- `termux-info`
- `python --version`
- `work4you doctor`
- o comando de instalação exato e a saída completa do erro
