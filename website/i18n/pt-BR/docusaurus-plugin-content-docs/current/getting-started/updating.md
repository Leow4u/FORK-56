---
sidebar_position: 3
title: "Atualizando & Desinstalando"
description: "Como atualizar o Work4You para a versão mais recente ou desinstalá-lo"
---

# Atualizando & Desinstalando

## Atualizando

Atualize para a versão mais recente com um único comando:

```bash
work4you update
```

Isso puxa o código mais recente da `main`, atualiza as dependências e solicita que você configure quaisquer opções novas que foram adicionadas desde a sua última atualização.

:::tip
O `work4you update` detecta automaticamente novas opções de configuração e pede para você adicioná-las. Se você pulou essa solicitação, pode rodar manualmente `work4you config check` para ver as opções faltantes, e depois `work4you config migrate` para adicioná-las interativamente.
:::

### O que acontece durante uma atualização

Quando você roda `work4you update`, os seguintes passos ocorrem:

1. **Snapshot pré-atualização** — um snapshot leve do estado é salvo por padrão (cobre dados de pareamento, tarefas cron, `config.yaml`, `.env`, `auth.json`, e outros arquivos de estado que são modificados em tempo de execução; arquivos individuais acima de 1 GiB são pulados, para que um banco de sessões grande nunca deixe a atualização lenta). Controlado por `updates.pre_update_backup` (`quick` por padrão, `full` para um zip de todo o `WORK4YOU_HOME`, `off` para desativar). Recuperável através do fluxo de restauração de snapshot descrito em [Snapshots e rollback](../user-guide/checkpoints-and-rollback.md).
2. **Git pull** — puxa o código mais recente do branch `main` e atualiza os submódulos
3. **Validação de sintaxe pós-pull + rollback automático** — depois do pull, o Work4You compila os nove arquivos críticos que toda invocação do `work4you` importa na inicialização. Se algum falhar ao ser interpretado (por exemplo, um marcador órfão de conflito de merge, um arquivo truncado por acidente), o Work4You roda `git reset --hard <pre-pull-sha>` para reverter a instalação, mantendo seu shell inicializável. Rode `work4you update` novamente assim que a correção upstream chegar.
4. **Instalação de dependências** — roda `uv pip install -e ".[all]"` para pegar dependências novas ou alteradas
5. **Migração de configuração** — detecta novas opções de configuração adicionadas desde a sua versão e pede para você defini-las
6. **Reinício automático do gateway** — gateways em execução são atualizados depois que a atualização termina, para que o novo código entre em vigor imediatamente. Gateways gerenciados por serviço (systemd no Linux, launchd no macOS) são reiniciados pelo gerenciador de serviços. Gateways manuais são relançados automaticamente quando o Work4You consegue mapear o PID em execução de volta para um perfil.

### Atualizando contra um branch não padrão: `--branch`

Por padrão, o `work4you update` acompanha o `origin/main`. Passe `--branch <name>` para atualizar contra um branch diferente — útil para canais de QA, branches de recursos, ou testes de release candidate:

```bash
work4you update --branch release-candidate
work4you update --check --branch experimental   # visualiza apenas o quanto está atrasado
```

Se o seu checkout local está em um branch diferente, o Work4You empilha (stash) automaticamente qualquer trabalho não commitado, troca o HEAD para o branch de destino, e então puxa. Branches que não existem localmente são rastreados automaticamente a partir de `origin/<name>` (`git checkout -B <name> origin/<name>`). Branches que não existem em lugar nenhum falham de forma limpa — suas alterações em stash são restauradas antes de sair, para que você nunca fique preso em um estado estranho. A lógica de sincronização fork-upstream, exclusiva da `main`, é automaticamente pulada em branches que não são a `main`.

### Checkout parado em um branch de recurso

Se o checkout de origem foi deixado parado em um branch de recurso (por ferramentas, um experimento de worktree, ou um checkout manual), o `work4you update` só volta a trocá-lo automaticamente para o alvo da atualização quando isso é comprovadamente seguro: a árvore de trabalho está limpa **e** cada commit no branch parado já está contido na `origin/main` (o `git cherry` não reporta nada não mesclado). Nesse caso, a atualização avisa isso — `Checkout was parked on '<branch>' (fully merged) — switched back to main` — e permanece na `main` depois.

Quando o branch parado tem alterações não commitadas ou commits não mesclados, o Work4You **não** o toca. A atualização de código é marcada como **SKIPPED (pulada)** com um aviso bem visível nomeando o branch, o quanto está atrasado em relação à `origin/main`, e os comandos exatos para resolver — em vez de fingir que a atualização deu certo. A linha de conclusão sempre mostra o branch real e o HEAD (`✓ Update complete! [main @ 30fcf9580]`), para que o desvio fique visível de imediato. Defina `updates.auto_switch_parked_branch: false` no `config.yaml` para desativar completamente a troca automática (o aviso de pulo ainda dispara).

### Alterações locais em atualizações não interativas

Quando você roda `work4you update` em um terminal, o Work4You empilha (stash) quaisquer alterações não commitadas da árvore de código-fonte, puxa, e depois **pergunta** se deve restaurá-las — exatamente como sempre fez. Nada muda para atualizações interativas.

Quando a atualização roda **sem um terminal** — pelo botão "Update" do app desktop/chat ou por uma atualização disparada pelo gateway — não há prompt para responder. A configuração `updates.non_interactive_local_changes` decide o que acontece com suas alterações em stash:

```yaml
# ~/.work4you/config.yaml
updates:
  non_interactive_local_changes: stash   # padrão: mantém + restaura automaticamente
  # non_interactive_local_changes: discard  # descarta as edições locais de código-fonte
```

- `stash` (padrão) — empilha automaticamente, puxa, e depois restaura automaticamente suas alterações sobre o código atualizado. Nada é perdido; se uma restauração encontra conflitos, eles são preservados em um git stash para recuperação manual.
- `discard` — empilha automaticamente e descarta o stash depois do pull, para que a atualização sempre chegue em uma árvore limpa. Use isso apenas em máquinas onde você nunca pretende manter edições locais no código-fonte do Work4You. Ele descarta o stash (não faz `git reset --hard` + `git clean -fd`), então caminhos ignorados como `node_modules`, `venv` e artefatos de build nunca são tocados.

No aplicativo desktop, isso fica em **Settings → Advanced → In-App Update Local Changes**.

### Somente visualização: `work4you update --check`

Quer saber se uma atualização está disponível antes de puxar? Rode `work4you update --check` — ele busca e compara commits contra a `origin/main`. Nenhum arquivo é modificado, nenhum gateway é reiniciado. Útil em scripts e tarefas cron que dependem de "há uma atualização disponível".

### Backup completo pré-atualização: `--backup`

Para perfis de alto valor (gateways de produção, instalações de equipe compartilhadas), você pode optar por um backup completo pré-pull do `WORK4YOU_HOME` (configuração, autenticação, sessões, skills, pareamento):

```bash
work4you update --backup
```

Ou torne isso o padrão para toda execução:

```yaml
# ~/.work4you/config.yaml
updates:
  pre_update_backup: full
```

`updates.pre_update_backup` é um único controle com três modos: `quick` (padrão — o snapshot de estado leve descrito acima), `full` (o snapshot rápido mais um zip completo do `WORK4YOU_HOME`; pode adicionar minutos em instalações grandes), e `off` (nenhum backup pré-atualização — `--no-backup` faz o mesmo para uma única execução). Valores booleanos legados ainda funcionam: `true` significa `full`, `false` significa `off`.

:::tip Está mudando para uma nova máquina?
Backups de atualização protegem uma atualização no local. Se você está migrando toda a sua configuração para um hardware diferente, use `work4you backup` + `work4you import` em vez disso — veja [Exportando o Work4You para outra máquina](/reference/faq#exporting-work4you-to-another-machine) e [`work4you backup` vs `work4you profile export`](/reference/faq#work4you-backup-vs-work4you-profile-export).
:::

### Windows: outro `work4you.exe` está em execução

No Windows, o `work4you update` vai se recusar a rodar se detectar outro processo `work4you.exe` segurando o executável de entrada do venv aberto — mais comumente o backend gerado pelo aplicativo Work4You Desktop, um REPL `work4you` aberto em outro terminal, ou um gateway em execução:

```
$ work4you update
✗ Another work4you.exe is running:
    PID 12345  work4you.exe

  Updating now would fail to overwrite ...\venv\Scripts\work4you.exe because
  Windows blocks REPLACE on a running executable.

  Close Work4You Desktop, exit any open `work4you` REPLs, and
  stop the gateway (`work4you gateway stop`) before retrying.
  Override with `work4you update --force` if you've already
  confirmed those processes will not write to the venv.
```

Feche os processos listados e rode novamente. Se você tem certeza de que o processo concorrente não vai interferir (raro — geralmente só útil quando um shim de antivírus está mal atribuído), passe `--force` para pular a verificação. Nesse caso, o atualizador ainda vai tentar renomear o `.exe` novamente com backoff exponencial e, em bloqueios persistentes, agendar a substituição para o próximo reboot via `MoveFileEx(MOVEFILE_DELAY_UNTIL_REBOOT)`, para que a atualização possa se completar.

Uma segunda proteção, separada, se recusa a tocar no venv enquanto qualquer processo estiver rodando a partir do seu interpretador Python (o backend do aplicativo Desktop, um gateway, um REPL Python). Esses processos mantêm arquivos de extensão nativa (`.pyd`) travados, e uma sincronização de dependência que morre no meio do caminho por um erro de acesso negado deixa a instalação presa entre versões. Essa proteção **não** é ignorada pelo `--force`; se você tem certeza de que os detentores detectados são falsos positivos, use o explícito `work4you update --force-venv`.

#### A recriação do venv no Windows é transacional

Quando o instalador do Windows precisa recriar um `venv` existente, ele primeiro move o diretório antigo para um nome único `venv.stale.*`, depois cria e verifica o substituto. A árvore antiga só é excluída depois que a instalação de dependências é concluída e as importações de base passam na nova árvore — até lá, ela é a fonte do rollback (registrada em `venv.pending-backup`).

Se a movimentação não puder ser concluída, o instalador para e deixa o `venv` ativo intocado. Se o `uv` falhar ou reportar sucesso sem criar o interpretador, qualquer substituição parcial é movida para `venv.failed.*` e o venv anterior é restaurado. Isso mantém as verificações de saúde e de bloqueio utilizáveis depois de uma instalação com falha.

Um diretório `venv.stale.*` ou `venv.failed.*` pode permanecer quando outro processo ainda possui um handle de arquivo. Feche o Work4You Desktop, gateways, e processos Python que estão usando a instalação, depois tente instalar/atualizar de novo; diretórios parados são limpos em regime de melhor esforço depois de uma recriação bem-sucedida.

A saída esperada se parece com isto:

```
$ work4you update
Updating Work4You...
📥 Pulling latest code...
Already up to date.  (or: Updating abc1234..def5678)
📦 Updating dependencies...
✅ Dependencies updated
🔍 Checking for new config options...
✅ Config is up to date  (or: Found 2 new options — running migration...)
🔄 Restarting gateways...
✅ Gateway restarted
✅ Work4You updated successfully!
```

### Validação Pós-Atualização Recomendada

O `work4you update` cuida do caminho principal de atualização, mas uma verificação rápida confirma que tudo chegou intacto:

1. `git status --short` — se a árvore estiver inesperadamente suja, inspecione antes de continuar
2. `work4you doctor` — verifica configuração, dependências e saúde do serviço
3. `work4you --version` — confirme se a versão foi atualizada como esperado
4. Se você usa o gateway: `work4you gateway status`
5. Se o `doctor` reportar problemas de auditoria do npm: rode `npm audit fix` no diretório sinalizado

:::warning Árvore de trabalho suja depois da atualização
Se `git status --short` mostrar alterações inesperadas depois do `work4you update`, pare e inspecione-as antes de continuar. Isso geralmente significa que modificações locais foram reaplicadas sobre o código atualizado, ou que um passo de dependência atualizou arquivos de lock.
:::

### Se seu terminal desconectar no meio da atualização

O `work4you update` se protege contra a perda acidental do terminal:

- A atualização ignora `SIGHUP`, então fechar sua sessão SSH ou janela de terminal não mata mais o processo no meio da instalação. Os processos filhos `pip` e `git` herdam essa proteção, então o ambiente Python não pode ficar semi-instalado por uma conexão perdida.
- Toda a saída é espelhada em `~/.work4you/logs/update.log` enquanto a atualização roda. Se o seu terminal desaparecer, reconecte-se e inspecione o log para ver se a atualização terminou e se o reinício do gateway funcionou:

```bash
tail -f ~/.work4you/logs/update.log
```

- `Ctrl-C` (SIGINT) e desligamento do sistema (SIGTERM) ainda são respeitados — esses são cancelamentos deliberados, não acidentes.

Você não precisa mais empacotar o `work4you update` dentro do `screen` ou `tmux` para sobreviver a uma queda de terminal.

### Verificando sua versão atual

```bash
work4you version
```

Compare com o release mais recente na [página de releases do GitHub](https://github.com/Leow4u/FORK-56/releases).

### Atualizando a partir de Plataformas de Mensagens

Você também pode atualizar diretamente pelo Telegram, Discord, Slack, WhatsApp ou Teams enviando:

```
/update
```

Isso puxa o código mais recente, atualiza as dependências e reinicia os gateways em execução. O bot ficará brevemente offline durante o reinício (tipicamente 5–15 segundos) e depois volta.

### Atualização Manual

Se você instalou manualmente (não pelo instalador rápido):

```bash
cd /path/to/work4you
# Ative o venv que você criou durante a instalação (fora da árvore de código-fonte)
export VIRTUAL_ENV="$HOME/.work4you/venvs/work4you-dev"
export PATH="$VIRTUAL_ENV/bin:$PATH"

# Puxe o código mais recente
git pull origin main

# Reinstale (pega novas dependências)
uv pip install -e ".[all]"

# Verifique novas opções de configuração
work4you config check
work4you config migrate   # Adicione interativamente quaisquer opções faltantes
```

### Instruções de rollback

Se uma atualização introduzir um problema, você pode voltar para uma versão anterior:

```bash
cd /path/to/work4you

# Liste as versões recentes
git log --oneline -10

# Volte para um commit específico
git checkout <commit-hash>
uv pip install -e ".[all]"

# Reinicie o gateway se estiver em execução
work4you gateway restart
```

Para voltar a uma tag de release específica (substitua pela sua tag anterior — por exemplo, um release recente como `v2026.5.16`, ou qualquer tag anterior de `git tag --sort=-version:refname`):

```bash
git checkout vX.Y.Z
uv pip install -e ".[all]"
```

:::warning
Voltar para uma versão anterior pode causar incompatibilidades de configuração se novas opções foram adicionadas. Rode `work4you config check` depois de reverter e remova quaisquer opções não reconhecidas do `config.yaml` se você encontrar erros.
:::

### Nota para usuários de Nix

O Nix não é mais um caminho de instalação explicitamente suportado (apenas melhor esforço) — veja [Configuração Nix](./nix-setup.md). Se você instalou via flake do Nix, as atualizações são gerenciadas pelo gerenciador de pacotes Nix:

```bash
# Atualize o input do flake
nix flake update work4you

# Ou reconstrua com o mais recente
nix profile upgrade work4you
```

Instalações Nix são imutáveis — o rollback é feito pelo sistema de gerações do Nix:

```bash
nix profile rollback
```

Veja [Configuração Nix](./nix-setup.md) para mais detalhes.

---

## Desinstalando

```bash
work4you uninstall
```

O desinstalador dá a você a opção de manter seus arquivos de configuração (`~/.work4you/`) para uma futura reinstalação.

:::tip Está mudando para uma nova máquina em vez de sair de vez?
Leve sua configuração com você antes de remover qualquer coisa: `work4you backup` captura todo o diretório `~/.work4you`, incluindo credenciais, enquanto o `work4you profile export` empacota um único perfil com credenciais excluídas por design (então uma exportação sozinha não é um backup completo). Veja [`work4you backup` vs `work4you profile export`](/reference/faq#work4you-backup-vs-work4you-profile-export).
:::

### Desinstalação Manual

```bash
rm -f ~/.local/bin/work4you
rm -rf /path/to/work4you
rm -rf ~/.work4you            # Opcional — mantenha se você planeja reinstalar
```

:::info
Se você instalou o gateway como um serviço do sistema, pare e desative-o primeiro:
```bash
work4you gateway stop
# Linux: systemctl --user disable work4you-gateway
# macOS: launchctl remove ai.work4you.gateway
```
:::
