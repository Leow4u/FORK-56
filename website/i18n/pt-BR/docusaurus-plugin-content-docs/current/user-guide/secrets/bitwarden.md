# Bitwarden Secrets Manager

Busque chaves de API no [Bitwarden Secrets Manager](https://bitwarden.com/products/secrets-manager/) na inicialização do processo, em vez de armazená-las em texto plano dentro de `~/.work4you/.env`. Um único segredo de bootstrap (um token de acesso de conta de máquina) substitui N chaves por provedor, e rotacionar uma credencial se torna uma única alteração no aplicativo web do Bitwarden.

## Como funciona

1. Você cria uma **conta de máquina** no Bitwarden Secrets Manager, dá a ela acesso de leitura a um projeto e gera um **token de acesso**.
2. O Work4You armazena esse único token em `~/.work4you/.env` como `BWS_ACCESS_TOKEN`.
3. Toda vez que `work4you` (ou o gateway, ou um cron job) inicia, depois que `~/.work4you/.env` é carregado, o Work4You chama `bws secret list <project_id>` e define as chaves retornadas em `os.environ`.
4. Por padrão, o Work4You **sobrescreve** valores já presentes no seu ambiente, então o Bitwarden é a fonte de verdade — rotacione uma chave uma vez no aplicativo web e todo processo do Work4You a capta na próxima inicialização. Altere `override_existing: false` na configuração se quiser que `.env` vença em vez disso.

O binário `bws` é baixado automaticamente para `~/.work4you/bin/` no primeiro uso — sem `apt`, sem `brew`, sem `sudo`.

## Por que contas de máquina (e por que nenhum prompt de 2FA)

O Bitwarden Secrets Manager é projetado para cargas de trabalho não interativas: contas de máquina não podem ser protegidas por 2FA porque não há um humano no processo. O token de acesso é a credencial. Qualquer pessoa que o tenha pode ler todos os segredos aos quais a conta de máquina tem acesso, então trate-o como um bearer token de alto valor — armazene-o em `.env` (não em `config.yaml`), e revogue e regenere pelo aplicativo web do Bitwarden se ele algum dia vazar.

Você configura a conta de máquina *no aplicativo web*, onde seu 2FA normal se aplica. Depois disso, o token é autônomo.

## Configuração

### 1. Crie uma conta de máquina e um token de acesso

No [aplicativo web do Bitwarden](https://vault.bitwarden.com) (ou [vault.bitwarden.eu](https://vault.bitwarden.eu) para contas da UE):

1. Mude para **Secrets Manager** no seletor de produtos.
2. Crie ou escolha um **Project** (por exemplo, "Work4You keys").
3. Adicione suas chaves de provedor como segredos. O **Name** do segredo se torna o nome da variável de ambiente — use `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, etc.
4. **Machine accounts → New machine account → My Work4You machine** → aba **Projects** → conceda acesso de leitura ao seu projeto.
5. Aba **Access tokens** → **Create access token** → expiração **Never** (ou escolha uma data) → copie o token (começa com `0.`). O Bitwarden não consegue recuperá-lo novamente — guarde a cópia.

O Secrets Manager está incluído no plano gratuito do Bitwarden, com limites; não é necessário um plano pago para experimentar isso.

### 2. Execute o assistente

```bash
work4you secrets bitwarden setup
```

Ele vai:

1. Baixar e verificar `bws v2.0.0` em `~/.work4you/bin/bws`.
2. Solicitar o token de acesso (a entrada fica oculta). Armazenado em `~/.work4you/.env` como `BWS_ACCESS_TOKEN`.
3. Perguntar a qual região do Bitwarden sua conta de máquina pertence — **US Cloud**, **EU Cloud**, ou **self-hosted / URL personalizada**. Armazenado em `config.yaml` como `secrets.bitwarden.server_url` e passado ao `bws` como `BWS_SERVER_URL`.
4. Listar os projetos que a conta de máquina pode ver; escolha um. Armazenado em `config.yaml` como `secrets.bitwarden.project_id`.
5. Fazer uma busca de teste dos segredos do projeto e mostrar quais variáveis de ambiente serão resolvidas.
6. Ativar `secrets.bitwarden.enabled: true`.

A configuração não interativa também é suportada via flags:

```bash
work4you secrets bitwarden setup \
  --access-token "$BWS_ACCESS_TOKEN" \
  --server-url https://vault.bitwarden.eu \
  --project-id <project-uuid>
```

### 3. Confirme

```bash
work4you secrets bitwarden status
```

A partir de agora, toda invocação de `work4you` busca segredos atualizados na inicialização. Você verá um resumo de uma linha no stderr na primeira vez que os segredos forem aplicados em um processo.

## CLI

| Comando | O que faz |
|---|---|
| `work4you secrets bitwarden setup` | Assistente interativo (instala o binário, solicita o token, escolhe o projeto, testa a busca) |
| `work4you secrets bitwarden status` | Mostra a configuração + versão do binário + presença/validação do token |
| `work4you secrets bitwarden token` | Rotaciona o token de acesso: valida o novo token contra o Bitwarden, depois o armazena em `.env` |
| `work4you secrets bitwarden sync` | Dry-run: busca os segredos agora e mostra o que seria aplicado |
| `work4you secrets bitwarden sync --apply` | Busca e exporta para o ambiente do shell atual |
| `work4you secrets bitwarden install` | Apenas baixa o binário `bws` fixado (sem necessidade de autenticação) |
| `work4you secrets bitwarden disable` | Ativa `enabled: false`; mantém o token + id do projeto no lugar |

## Rotacionando um token expirado ou revogado

Quando o token da conta de máquina expira, é revogado, ou a conta é excluída, a inicialização mostra:

```
Bitwarden Secrets Manager: Bitwarden rejected the machine-account access token (BWS_ACCESS_TOKEN) — it was likely revoked, expired, or belongs to another region.  (...)
Bitwarden Secrets Manager: → Run `work4you secrets bitwarden token` to paste a fresh access token ...
```

Corrija sem executar o assistente inteiro novamente:

```bash
work4you secrets bitwarden token                     # masked prompt
work4you secrets bitwarden token --access-token 0.…  # non-interactive
```

O comando testa o Bitwarden com o novo token **antes** de escrever qualquer coisa — um token rejeitado deixa seu `.env` atual intocado. Em caso de sucesso, ele armazena o token, limpa os caches de busca e avisa se o projeto configurado não estiver visível para a nova conta de máquina.

## Configuração

Padrões em `~/.work4you/config.yaml`:

```yaml
secrets:
  bitwarden:
    enabled: false
    access_token_env: BWS_ACCESS_TOKEN
    project_id: ""
    server_url: ""
    cache_ttl_seconds: 300
    encrypted_cache:
      enabled: false
      max_stale_seconds: 0
    override_existing: true
    auto_install: true
```

| Chave | Padrão | O que faz |
|---|---|---|
| `enabled` | `false` | Chave geral. Quando falso, o Bitwarden nunca é contatado. |
| `access_token_env` | `BWS_ACCESS_TOKEN` | Nome da variável de ambiente que contém o token de bootstrap. Mude isso se você já usa `BWS_ACCESS_TOKEN` para outra coisa. |
| `project_id` | `""` | UUID do projeto de onde sincronizar. |
| `server_url` | `""` | Região do Bitwarden ou endpoint self-hosted. Vazio = padrão do `bws` (US Cloud, `https://vault.bitwarden.com`). Defina como `https://vault.bitwarden.eu` para EU Cloud, ou sua própria URL para self-hosted. Encaminhado ao subprocesso `bws` como `BWS_SERVER_URL`. |
| `cache_ttl_seconds` | `300` | Por quanto tempo um resultado de busca em processo ou em disco é reutilizado. Defina como `0` para desabilitar a reutilização de cache fresco. |
| `encrypted_cache.enabled` | `false` | Armazena a última busca bem-sucedida em um cache criptografado com AES-GCM em `~/.work4you/cache/bws_cache.enc.json`. |
| `encrypted_cache.max_stale_seconds` | `0` | Quando o cache criptografado está habilitado, permite que esse cache seja usado apenas após falhas de rede/timeout, até essa idade. Falhas de autenticação nunca usam segredos obsoletos. Uma gravação criptografada bem-sucedida remove o antigo `cache/bws_cache.json` em texto plano. |
| `override_existing` | `true` | Quando verdadeiro, os valores do Bitwarden sobrescrevem qualquer coisa já presente no ambiente (para que a rotação no aplicativo web realmente tenha efeito). Altere para `false` se quiser que exportações de `.env` / shell vençam localmente. |
| `auto_install` | `true` | Quando verdadeiro, `bws` é baixado automaticamente para `~/.work4you/bin/` no primeiro uso. |

## Modos de falha

O Bitwarden nunca bloqueia a inicialização do Work4You. Se algo der errado, você verá um aviso de uma linha no stderr e o Work4You continua com as credenciais que `.env` já tinha:

| Sintoma | Causa | Correção |
|---|---|---|
| `BWS_ACCESS_TOKEN is not set` | Habilitado na configuração, mas o token foi removido de `.env` | Execute `work4you secrets bitwarden setup` novamente |
| `Bitwarden rejected the machine-account access token … invalid_client` | Token revogado, expirado, conta de máquina excluída — ou o token pertence a outra região (por exemplo, um token da UE chegando ao endpoint de identidade dos EUA) | Execute `work4you secrets bitwarden token` para colar um token novo; para incompatibilidades de região, execute o assistente novamente e escolha EU/self-hosted (ou defina `secrets.bitwarden.server_url`) |
| `bws exited 1: invalid access token` | Token revogado ou incorreto | Execute `work4you secrets bitwarden token` com um novo token |
| `bws timed out` | Rede bloqueada ou API do Bitwarden lenta | Verifique a conectividade com `api.bitwarden.com` (ou seu `server_url`) |
| `bws binary not available` | `auto_install: false` e `bws` não está no PATH | Instale manualmente em [github.com/bitwarden/sdk-sm/releases](https://github.com/bitwarden/sdk-sm/releases) ou reative `auto_install` |
| `Checksum mismatch` | Download corrompido ou adulterado | Execute novamente, vai tentar de novo; se persistir, abra uma issue |

Os avisos de inicialização agora incluem uma linha de correção com `→` dizendo exatamente qual comando resolve a falha.

## Notas de segurança

- O token de bootstrap (`BWS_ACCESS_TOKEN`) é, por si só, sensível — qualquer pessoa que o tenha pode ler todos os segredos aos quais a conta de máquina tem acesso. Trate-o como qualquer outra chave de API.
- O Work4You se recusará a deixar o Bitwarden sobrescrever o próprio token de bootstrap, mesmo com `override_existing: true`. Se você armazenar `BWS_ACCESS_TOKEN` como um segredo dentro do projeto, ele é silenciosamente ignorado durante a aplicação.
- O download do binário `bws` é verificado contra o checksum SHA-256 publicado no mesmo release do GitHub. Uma incompatibilidade aborta a instalação.
- A versão fixada (`bws v2.0.0` no momento em que este texto foi escrito) é atualizada por meio de PRs neste repositório — o Work4You não atualiza automaticamente o `bws` para a "última versão", porque os formatos de release do upstream podem mudar.

## Quando NÃO usar isso

- **Configurações pessoais de máquina única**, onde `~/.work4you/.env` já é suficiente. Você estaria trocando uma credencial por outra e adicionando uma dependência de rede na inicialização.
- **Ambientes air-gapped** que não conseguem alcançar `api.bitwarden.com`.
- **CI/CD**, onde o mecanismo existente de injeção de segredos (secrets do GitHub Actions, Vault, etc.) já está configurado — escolha um caminho, não dois.

O bom caso de uso para isso é frotas com múltiplas máquinas, boxes de desenvolvimento compartilhados, VPSes de gateway, ou qualquer configuração em que você queira rotação e revogação centralizadas em várias instalações do Work4You.
