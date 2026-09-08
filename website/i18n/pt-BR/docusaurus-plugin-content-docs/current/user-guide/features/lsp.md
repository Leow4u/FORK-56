---
sidebar_position: 16
title: "LSP — Diagnósticos Semânticos"
description: "Servidores de linguagem reais (pyright, gopls, rust-analyzer, …) conectados à verificação de lint pós-escrita usada por write_file e patch."
---

# Language Server Protocol (LSP)

O Work4You executa servidores de linguagem completos — pyright, gopls, rust-analyzer,
typescript-language-server, clangd, e mais ~20 — como subprocessos em
segundo plano e alimenta seus diagnósticos semânticos na verificação de
lint pós-escrita usada por `write_file` e `patch`. Quando o agente edita um
arquivo, ele vê exatamente os erros que aquela edição introduziu — não apenas
erros de sintaxe, mas **erros de tipo, nomes indefinidos, imports ausentes,
e problemas semânticos em todo o projeto** que o servidor de linguagem detecta.

Essa é a mesma arquitetura usada pelos melhores agentes de código. O Work4You
a entrega de forma autocontida: sem necessidade de um editor host, sem plugins para
instalar, sem daemon separado para gerenciar.

## Quando o LSP é executado

O LSP é condicionado à **detecção de workspace git**. Quando o diretório de
trabalho do agente (ou o arquivo sendo editado) está dentro de um repositório git,
o LSP é executado contra aquele workspace. Quando nenhum dos dois está em um repositório git,
o LSP permanece inativo — útil para gateways de mensagens onde o cwd é o
diretório home do usuário e não há projeto para diagnosticar.

A verificação é em camadas: primeiro a verificação de sintaxe em processo (microssegundos),
depois os diagnósticos LSP quando a sintaxe está limpa. Um servidor de linguagem
instável ou ausente nunca pode quebrar uma escrita — todo caminho de falha do LSP
recai silenciosamente para o resultado somente-sintaxe.

Concretamente, a cada `write_file` ou `patch` bem-sucedido:

1. O Work4You captura uma linha de base dos diagnósticos atuais do arquivo.
2. Executa a escrita.
3. Reconsulta o servidor de linguagem, filtra os diagnósticos que já
   estavam na linha de base, e exibe apenas os novos.

O agente vê uma saída como:

```
{
  "bytes_written": 42,
  "dirs_created": false,
  "lint": {"status": "ok", "output": ""},
  "lsp_diagnostics": "LSP diagnostics introduced by this edit:\n<diagnostics file=\"/path/to/foo.py\">\nERROR [42:5] Cannot find name 'foo' [reportUndefinedVariable] (Pyright)\nERROR [50:1] Argument of type \"str\" is not assignable to \"int\" [reportArgumentType] (Pyright)\n</diagnostics>"
}
```

O campo `lint` carrega o resultado da verificação de sintaxe (parse em processo
de microssegundos via `ast.parse`, `json.loads`, etc.); o campo
`lsp_diagnostics` carrega os diagnósticos semânticos do
servidor de linguagem real. Dois canais, sinais independentes — o
agente vê um arquivo sintaticamente limpo com problemas semânticos como
`lint: ok` mais um `lsp_diagnostics` preenchido.

## Linguagens suportadas

| Linguagem | Servidor | Instalação automática |
|----------|--------|--------------|
| Python | `pyright-langserver` | npm |
| TypeScript / JavaScript / JSX / TSX | `typescript-language-server` | npm |
| Vue | `@vue/language-server` | npm |
| Svelte | `svelte-language-server` | npm |
| Astro | `@astrojs/language-server` | npm |
| Go | `gopls` | `go install` |
| Rust | `rust-analyzer` | manual (rustup) |
| C / C++ | `clangd` | manual (LLVM) |
| Bash / Zsh | `bash-language-server` | npm |
| YAML | `yaml-language-server` | npm |
| Lua | `lua-language-server` | manual (releases do GitHub) |
| PHP | `intelephense` | npm |
| OCaml | `ocaml-lsp` | manual (opam) |
| Dockerfile | `dockerfile-language-server-nodejs` | npm |
| Terraform | `terraform-ls` | manual |
| Dart | `dart language-server` | manual (dart sdk) |
| Haskell | `haskell-language-server` | manual (ghcup) |
| Julia | `julia` + LanguageServer.jl | manual |
| Clojure | `clojure-lsp` | manual |
| Nix | `nixd` | manual |
| Zig | `zls` | manual |
| Gleam | `gleam lsp` | manual (gleam install) |
| Elixir | `elixir-ls` | manual |
| Prisma | `prisma language-server` | manual |
| Kotlin | `kotlin-language-server` | manual |
| Java | `jdtls` | manual |
| PowerShell | `PowerShellEditorServices` (host `pwsh`) | manual (zip de release) |

Para entradas "manual", instale o servidor através do gerenciador de
toolchain que fizer sentido para aquela linguagem (rustup, ghcup, opam, brew,
…). O Work4You detecta automaticamente o binário no PATH ou em
`<WORK4YOU_HOME>/lsp/bin/`.

### PowerShell

O PowerShellEditorServices não é um binário único — é um pacote de módulo
PowerShell iniciado por um host `pwsh` (PowerShell 7+) ou
`powershell`. Configuração:

1. Instale o [PowerShell](https://github.com/PowerShell/PowerShell) para que
   `pwsh` (ou o `powershell` do Windows) esteja no PATH.
2. Baixe o zip da última release em
   [PowerShellEditorServices releases](https://github.com/PowerShell/PowerShellEditorServices/releases)
   e extraia-o.
3. Aponte o Work4You para o pacote extraído — o diretório que contém
   `PowerShellEditorServices/Start-EditorServices.ps1`. Pode ser:
   - definir `lsp.servers.powershell.command: ["/path/to/bundle"]` em
     `config.yaml`, ou
   - extraí-lo para `<WORK4YOU_HOME>/lsp/PowerShellEditorServices`, ou
   - exportar `PSES_BUNDLE_PATH=/path/to/bundle`.

`work4you lsp status` reporta `installed` assim que `pwsh` é encontrado; se o
pacote estiver ausente, você verá um aviso único nos logs com o
link de download.

Alguns servidores são instalados junto com uma dependência de par que o npm
não puxa automaticamente. O caso atual é o `typescript-language-server`,
que exige que o SDK `typescript` seja importável a partir da mesma
árvore `node_modules` — o Work4You instala ambos os pacotes juntos quando você
executa `work4you lsp install typescript` ou a instalação automática é acionada no primeiro
uso.

## CLI

```
work4you lsp status          # estado do serviço + status de instalação por servidor
work4you lsp list            # registro, opcionalmente --installed-only
work4you lsp install <id>    # instala um servidor imediatamente
work4you lsp install-all     # tenta cada servidor com uma receita conhecida
work4you lsp restart         # encerra os clientes em execução
work4you lsp which <id>      # imprime o caminho resolvido do binário
```

`work4you lsp status` é o melhor ponto de partida — mostra quais
linguagens receberão diagnósticos semânticos hoje e quais precisam de um
binário instalado.

## Configuração

Os padrões funcionam para configurações típicas; nada a definir se os binários
estiverem no PATH.

```yaml
# config.yaml
lsp:
  # Interruptor principal. Desabilitar pula o subsistema inteiro — nenhum
  # servidor é iniciado, nenhum loop de eventos em segundo plano é executado.
  enabled: true

  # Quanto tempo esperar por diagnósticos após cada escrita.
  wait_mode: document      # "document" ou "full"
  # Segundos máximos para esperar o servidor reverificar o arquivo após uma
  # edição. Somente diagnósticos *recentes* (produzidos para o
  # conteúdo pós-edição) são reportados; se o servidor não terminar dentro
  # desse orçamento, a edição reporta "no LSP data" em vez de erros
  # antigos de antes da edição. Aumente isso para servidores lentos em projetos
  # grandes (tsserver, rust-analyzer em meio à indexação).
  wait_timeout: 5.0

  # Como lidar com binários de servidor ausentes.
  #   auto    — instala via npm/pip/go install em <WORK4YOU_HOME>/lsp/bin
  #   manual  — usa apenas binários já presentes no PATH
  install_strategy: auto

  # Por quanto tempo um cliente de servidor de linguagem não utilizado permanece ativo (segundos).
  # Servidores ociosos são encerrados automaticamente e reiniciados na próxima
  # operação de arquivo relevante. Defina como 0 para desabilitar a limpeza ociosa e manter
  # os servidores ativos pela vida útil do processo. Valores abaixo de 30s são
  # limitados a 30 para que uma varredura nunca encerre um cliente em meio a uma operação.
  idle_timeout: 600

  # Substituições por servidor (todas opcionais).
  servers:
    pyright:
      disabled: false
      command: ["/abs/path/to/pyright-langserver", "--stdio"]
      env: { PYRIGHT_LOG_LEVEL: "info" }
      initialization_options:
        python:
          analysis:
            typeCheckingMode: "strict"
    typescript:
      disabled: true       # pula o TS mesmo quando suas extensões correspondem
```

### Chaves por servidor

* `disabled: true` — pula este servidor completamente mesmo quando suas
  extensões correspondem a um arquivo.
* `command: [bin, ...args]` — fixa um caminho de binário customizado. Ignora
  a instalação automática.
* `env: {KEY: value}` — variáveis de ambiente extras passadas ao processo
  iniciado.
* `initialization_options: {...}` — mesclado no payload
  `initializationOptions` do LSP enviado no handshake de
  `initialize`. Específico do servidor; consulte a documentação do servidor de linguagem.

## Locais de instalação

Quando `install_strategy: auto`, o Work4You instala binários em
`<WORK4YOU_HOME>/lsp/bin/`. Pacotes NPM ficam em
`<WORK4YOU_HOME>/lsp/node_modules/` com links simbólicos de binário um nível acima.
Binários Go vêm de `go install` com `GOBIN` apontado para o
diretório de staging.

Nada é jamais instalado em `/usr/local/`, `~/.local/`, ou qualquer outro
local compartilhado — o diretório de staging pertence totalmente ao Work4You e é
removido quando você redefine o perfil.

## Características de desempenho

Os servidores LSP são **iniciados sob demanda** no primeiro uso. Editar um arquivo Python
em um projeto que nunca viu tráfego `.py` inicia o pyright; o
início leva de 1 a 3 segundos para a maioria dos servidores (o rust-analyzer pode levar 10+
em um projeto não indexado). Edições subsequentes no mesmo workspace reutilizam
o servidor em execução.

A camada LSP adiciona alguns milissegundos a escritas limpas quando nenhum
diagnóstico é emitido. Quando diagnósticos são emitidos, o orçamento de espera é
de `wait_timeout` segundos — tipicamente o servidor responde em
dezenas de milissegundos para pyright/tsserver e alguns segundos para
o rust-analyzer em meio à indexação.

Os diagnósticos são **condicionados à atualidade**: um resultado só conta quando o
servidor o produziu para o conteúdo da edição atual (um push
`publishDiagnostics` no momento ou após a mudança, ou uma solicitação pull
respondida depois dela). Servidores lentos que ainda não reverificaram
resultam em "sem dados" para aquela edição — nunca em erros de ontem
sendo reportados novamente como atuais.

Os servidores são mantidos ativos enquanto estão em uso e encerrados após
`lsp.idle_timeout` segundos (padrão 600) sem atividade de arquivo — um
gateway de longa duração que toca em muitos worktrees não acumula mais
um processo de servidor de linguagem por workspace indefinidamente. Um servidor encerrado é
reiniciado automaticamente na próxima operação de arquivo relevante. Defina
`idle_timeout: 0` para desabilitar a limpeza e manter o índice de cada servidor ativo
pela vida útil do processo.

## Desabilitando

Defina `lsp.enabled: false` em `config.yaml` para desabilitar o subsistema
inteiro. A verificação pós-escrita recai para a verificação de sintaxe em processo
(`ast.parse` para Python, `json.loads` para JSON, etc.), que é
enviada inalterada de versões anteriores.

Para desabilitar uma única linguagem sem desabilitar a camada inteira:

```yaml
lsp:
  servers:
    rust-analyzer:
      disabled: true
```

## Solução de problemas

**`work4you lsp status` mostra um servidor como "missing"**

O binário não está no PATH e não está em `<WORK4YOU_HOME>/lsp/bin/`. Execute
`work4you lsp install <server_id>` para tentar uma instalação automática, ou
instale o binário manualmente através do toolchain normal da linguagem.

**Seção `Backend warnings` em `work4you lsp status`**

Alguns servidores são entregues como wrappers finos em torno de uma CLI externa para os
diagnósticos reais — eles iniciam normalmente e aceitam solicitações, mas nunca emitem
erros quando o binário auxiliar está ausente. O caso mais comum é o
`bash-language-server`, que delega diagnósticos ao `shellcheck`.
Quando `work4you lsp status` mostra uma seção `Backend warnings`, instale
a ferramenta indicada através do gerenciador de pacotes do seu SO:

```
apt install shellcheck      # Debian / Ubuntu
brew install shellcheck     # macOS
scoop install shellcheck    # Windows
```

O mesmo aviso é registrado uma vez no momento de inicialização do servidor em
`~/.work4you/logs/agent.log`.

**O servidor inicia, mas nunca retorna diagnósticos**

Verifique `~/.work4you/logs/agent.log` por entradas `[agent.lsp.client]` —
tanto o stderr do servidor de linguagem quanto erros de protocolo aparecem
lá. Alguns servidores (especialmente o rust-analyzer) precisam terminar uma
indexação de todo o projeto antes de emitir diagnósticos por arquivo; a primeira
edição após o início do servidor pode ser concluída sem diagnósticos, com
edições subsequentes captando-os.

**O servidor travou**

Um servidor que travou é adicionado ao conjunto de quebrados e não será tentado novamente pelo
resto da sessão. Execute `work4you lsp restart` para limpar o conjunto;
a próxima edição reinicia o servidor.

**Editando um arquivo fora de qualquer repositório git**

Por design, o LSP só funciona dentro de um repositório git. Se o projeto ainda não
foi inicializado, execute `git init` para habilitar os diagnósticos LSP. Caso contrário, o
fallback de somente-sintaxe em processo se aplica.
