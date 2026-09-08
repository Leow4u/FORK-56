---
sidebar_position: 8
title: "Referência de Configuração do MCP"
description: "Referência das chaves de configuração MCP do Work4You, semântica de filtragem, e política de ferramentas utilitárias"
---

# Referência de Configuração do MCP

Esta página é a referência compacta que acompanha a documentação principal do MCP.

Para orientação conceitual, veja:
- [MCP (Model Context Protocol)](/user-guide/features/mcp)
- [Usando MCP com o Work4You](/guides/use-mcp-with-work4you)

## Formato da configuração raiz

```yaml
mcp_servers:
  <server_name>:
    command: "..."      # servidores stdio
    args: []
    env: {}

    # OU
    url: "..."          # servidores HTTP
    headers: {}

    # Configurações opcionais de TLS para HTTP/SSE:
    ssl_verify: true                # bool ou caminho para um pacote de CA (PEM)
    client_cert: "/path/to/cert.pem"  # certificado de cliente mTLS (veja abaixo)
    # client_key: "/path/to/key.pem"  # opcional, quando a chave está em um arquivo separado

    enabled: true
    timeout: 120
    connect_timeout: 60
    supports_parallel_tool_calls: false
    tools:
      include: []
      exclude: []
      resources: true
      prompts: true
```

## Chaves do servidor

| Chave | Tipo | Aplica-se a | Significado |
|---|---|---|---|
| `command` | string | stdio | Executável a ser iniciado |
| `args` | list | stdio | Argumentos para o subprocesso |
| `env` | mapping | stdio | Ambiente passado para o subprocesso |
| `url` | string | HTTP | Endpoint MCP remoto |
| `headers` | mapping | HTTP | Cabeçalhos para requisições ao servidor remoto |
| `ssl_verify` | bool ou string | HTTP | Verificação TLS. `true` (padrão) usa CAs do sistema, `false` desativa a verificação (inseguro), ou uma string com o caminho para um pacote de CA personalizado (PEM) |
| `client_cert` | string ou list | HTTP | Certificado de cliente mTLS. String = caminho para um arquivo PEM contendo cert + chave. List `[cert, key]` = arquivos separados. List `[cert, key, password]` = chave criptografada |
| `client_key` | string | HTTP | Caminho para a chave privada do cliente, quando `client_cert` é uma string e a chave está em um arquivo separado |
| `enabled` | bool | ambos | Pula o servidor inteiramente quando falso |
| `timeout` | number | ambos | Timeout de chamada de ferramenta em segundos (padrão: `300`) |
| `connect_timeout` | number | ambos | Timeout de conexão inicial em segundos (padrão: `60`) |
| `protocol` | string | ambos | Negociação de era de protocolo: `auto` (padrão — handshake legado `initialize` primeiro, recorrendo à sondagem stateless `server/discover` de 2026-07-28 quando o servidor rejeita o handshake como somente-moderno), `stateless` (sonda `server/discover` primeiro; uma nova tentativa legada), ou `legacy` (apenas handshake, sem fallback) |
| `supports_parallel_tool_calls` | bool | ambos | Permite que ferramentas deste servidor rodem concorrentemente |
| `skip_preflight` | bool | HTTP | Ignora a sondagem fail-fast de content-type para endpoints Streamable HTTP válidos cujas respostas HEAD/GET retornam um content-type que não é MCP (padrão: `false`) |
| `transport` | string | HTTP | Defina como `sse` para usar o transporte SSE em vez do Streamable HTTP |
| `keepalive_interval` | number | ambos | Cadência do ping de liveness em segundos (padrão: `180`, piso de 5s). Defina abaixo do TTL de sessão do servidor para servidores que fazem GC de sessões ociosas rapidamente |
| `idle_timeout_seconds` | number | stdio | Reciclagem opcional do servidor stdio após tempo ocioso (`0` desativa). Também pode viver sob um mapeamento `lifecycle:` |
| `max_lifetime_seconds` | number | stdio | Reciclagem opcional do servidor stdio após idade (`0` desativa). Também pode viver sob um mapeamento `lifecycle:` |
| `tools` | mapping | ambos | Filtragem e política de ferramentas utilitárias |
| `auth` | string | HTTP | Método de autenticação. Defina como `oauth` para habilitar OAuth 2.1 com PKCE |
| `sampling` | mapping | ambos | Política de requisição de LLM iniciada pelo servidor (veja o guia MCP) |
| `elicitation` | mapping | ambos | Requisições de entrada do usuário iniciadas pelo servidor. `enabled` (padrão `true`) e `timeout` em segundos (padrão `300`). Requisições em modo formulário passam pela superfície de aprovação; requisições em modo URL são recusadas (veja o guia MCP) |
| `trust` | string | ambos | Nível de confiança: `full` (padrão) ou `untrusted`. Em um servidor `untrusted`, toda chamada de ferramenta com capacidade de escrita (qualquer ferramenta sem a anotação `readOnlyHint: true`) exige aprovação do usuário através da superfície de aprovação padrão antes de ser executada. `readOnlyHint` é uma *dica* fornecida pelo servidor — um servidor mentiroso pode, no máximo, pular a aprovação para ferramentas que afirma serem somente leitura, nunca ganhar acesso extra — portanto marque como `untrusted` qualquer servidor que você não controla totalmente. Valores não reconhecidos são tratados como `untrusted` (fail-closed) |

## Referências a variáveis de ambiente

Valores de string em qualquer lugar de uma entrada de servidor (`env`, `headers`, `args`, `url`, …) podem referenciar variáveis de ambiente com `${VAR}` ou o formato SecretRef estilo Cursor `${env:VAR}` — ambos resolvem para a mesma variável, então trechos MCP copiados de configurações do Cursor / Claude funcionam sem alterações:

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "${env:GITHUB_TOKEN}"   # igual a "${GITHUB_TOKEN}"
```

Os valores são resolvidos a partir do escopo de segredos do perfil ativo (recorrendo ao ambiente do processo como fallback), então coloque o segredo em `~/.work4you/.env`. Uma variável não definida mantém seu placeholder literal.

### Variáveis de contexto

Além das variáveis de ambiente, as variáveis de contexto estilo Cursor também são interpoladas (os nomes diferenciam maiúsculas de minúsculas):

| Variável | Resolve para |
|---|---|
| `${userHome}` | O diretório home do usuário atual |
| `${workspaceFolder}` | A raiz do espaço de trabalho da sessão (o cwd do terminal da sessão quando conhecido, senão o cwd do processo) |
| `${workspaceFolderBasename}` | O nome-base de `${workspaceFolder}` |
| `${pathSeparator}` / `${/}` | O separador de caminho do SO (`os.sep`) |

```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"]
    env:
      CACHE_DIR: "${userHome}${/}.cache${/}mcp"
```

Qualquer outra referência `${...}` recai para a busca de variável de ambiente acima.

## Chaves da política `tools`

| Chave | Tipo | Significado |
|---|---|---|
| `include` | string ou list | Lista de permissões (whitelist) de ferramentas MCP nativas do servidor. As entradas podem ser nomes exatos ou globs estilo fnmatch (`*_radar_*`, `get_zones_*`) |
| `exclude` | string ou list | Lista de bloqueios (blacklist) de ferramentas MCP nativas do servidor. Mesma semântica de nome exato / glob que `include` |
| `resources` | bool-like | Habilita/desabilita `list_resources` + `read_resource` |
| `prompts` | bool-like | Habilita/desabilita `list_prompts` + `get_prompt` |

## Semântica de filtragem

### `include`

Se `include` estiver definido, apenas essas ferramentas MCP nativas do servidor são registradas.

```yaml
tools:
  include: [create_issue, list_issues]
```

### `exclude`

Se `exclude` estiver definido e `include` não estiver, toda ferramenta MCP nativa do servidor, exceto aquelas nomeadas, é registrada.

```yaml
tools:
  exclude: [delete_customer]
```

### Precedência

Se ambos estiverem definidos, `include` prevalece.

```yaml
tools:
  include: [create_issue]
  exclude: [create_issue, delete_issue]
```

Resultado:
- `create_issue` ainda é permitido
- `delete_issue` é ignorado porque `include` tem precedência

## Política de ferramentas utilitárias

O Work4You pode registrar esses wrappers utilitários por servidor MCP:

Resources:
- `list_resources`
- `read_resource`

Prompts:
- `list_prompts`
- `get_prompt`

### Desativar resources

```yaml
tools:
  resources: false
```

### Desativar prompts

```yaml
tools:
  prompts: false
```

### Registro sensível à capacidade

Mesmo quando `resources: true` ou `prompts: true`, o Work4You só registra essas ferramentas utilitárias se a sessão MCP realmente expuser a capacidade correspondente.

Então isto é normal:
- você habilita prompts
- mas nenhuma ferramenta utilitária de prompt aparece
- porque o servidor não suporta prompts

## `enabled: false`

```yaml
mcp_servers:
  legacy:
    url: "https://mcp.legacy.internal"
    enabled: false
```

Comportamento:
- nenhuma tentativa de conexão
- nenhuma descoberta
- nenhum registro de ferramenta
- a configuração permanece no lugar para reutilização posterior

## Comportamento de resultado vazio

Se a filtragem remover todas as ferramentas nativas do servidor e nenhuma ferramenta utilitária for registrada, o Work4You não cria um conjunto de ferramentas MCP vazio para aquele servidor.

## Exemplos de configuração

### Lista de permissões segura do GitHub

```yaml
mcp_servers:
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "***"
    tools:
      include: [list_issues, create_issue, update_issue, search_code]
      resources: false
      prompts: false
```

### Lista de bloqueios do Stripe

```yaml
mcp_servers:
  stripe:
    url: "https://mcp.stripe.com"
    headers:
      Authorization: "Bearer ***"
    tools:
      exclude: [delete_customer, refund_payment]
```

### Servidor de documentação somente-resource

```yaml
mcp_servers:
  docs:
    url: "https://mcp.docs.example.com"
    tools:
      include: []
      resources: true
      prompts: false
```

### Certificado de cliente TLS (mTLS)

Para servidores HTTP/SSE que exigem um certificado de cliente, defina `client_cert` (e opcionalmente `client_key`):

```yaml
mcp_servers:
  # Certificado + chave combinados em um único arquivo PEM
  internal_api:
    url: "https://mcp.internal.example.com/mcp"
    client_cert: "~/secrets/mcp-client.pem"

  # Arquivos separados de certificado e chave
  partner_api:
    url: "https://mcp.partner.example.com/mcp"
    client_cert: "~/secrets/client.crt"
    client_key: "~/secrets/client.key"

  # Chave criptografada com uma senha (forma de lista com 3 elementos)
  bank_api:
    url: "https://mcp.bank.example.com/mcp"
    client_cert: ["~/secrets/client.crt", "~/secrets/client.key", "my-passphrase"]

  # Pacote de CA personalizado (CA privada / servidor autoassinado)
  lab_api:
    url: "https://mcp.lab.local/mcp"
    ssl_verify: "~/secrets/lab-ca.pem"
    client_cert: "~/secrets/lab-client.pem"
```

Observações:
- Os caminhos suportam expansão de `~`. Arquivos ausentes falham rapidamente no momento da conexão com uma mensagem de erro específica do servidor.
- `ssl_verify: false` desativa completamente a verificação do certificado do servidor. Não use isso com serviços reais.
- Funciona tanto em transportes Streamable HTTP quanto SSE.

## Recarregando a configuração

Após alterar a configuração do MCP, recarregue os servidores com:

```text
/reload-mcp
```

## Nomenclatura de ferramentas

Ferramentas MCP nativas do servidor se tornam:

```text
mcp__<server>__<tool>
```

Exemplos:
- `mcp__github__create_issue`
- `mcp__filesystem__read_file`
- `mcp__my_api__query_data`

Ferramentas utilitárias seguem o mesmo padrão de prefixação:
- `mcp__<server>__list_resources`
- `mcp__<server>__read_resource`
- `mcp__<server>__list_prompts`
- `mcp__<server>__get_prompt`

O delimitador de sublinhado duplo (`mcp__…__…`) corresponde à convenção usada pelo Claude Code, Codex e OpenCode, e desambigua a fronteira servidor/ferramenta mesmo quando qualquer um dos componentes contém sublinhados.

### Sanitização de nome

Qualquer caractere que não seja uma letra, dígito ou sublinhado (hífens, pontos, espaços, etc.) tanto em nomes de servidor quanto em nomes de ferramenta é substituído por um sublinhado antes do registro. Isso garante que os nomes das ferramentas sejam identificadores válidos para APIs de function-calling de LLM.

Por exemplo, um servidor chamado `my-api` expondo uma ferramenta chamada `list-items.v2` se torna:

```text
mcp__my_api__list_items_v2
```

Tenha isso em mente ao escrever filtros `include` / `exclude` — use o nome **original** da ferramenta MCP (com hífens/pontos), não a versão sanitizada.

## Autenticação OAuth 2.1

Para servidores HTTP que exigem OAuth, defina `auth: oauth` na entrada do servidor:

```yaml
mcp_servers:
  protected_api:
    url: "https://mcp.example.com/mcp"
    auth: oauth
```

Comportamento:
- O Work4You usa o fluxo OAuth 2.1 PKCE do SDK MCP (descoberta de metadados, identificação de cliente, troca de token e renovação)
- Na primeira conexão, uma janela do navegador é aberta para autorização
- Os tokens são persistidos em `~/.work4you/mcp-tokens/<server>.json` e reutilizados entre sessões
- A renovação do token é automática; a reautorização só acontece quando a renovação falha
- Aplica-se apenas ao transporte HTTP/StreamableHTTP (servidores baseados em `url`)

### Identificação do cliente: CIMD e DCR

O Work4You se identifica para servidores de autorização com um **Client ID Metadata Document** (CIMD), o mecanismo que a especificação MCP `2026-07-28` adotou no lugar do Dynamic Client Registration. O documento é publicado em
`https://work4you.github.io/work4you/docs/oauth/client-metadata.json`, e essa URL *é* o `client_id` — o servidor de autorização o busca para conhecer o nome, o logo e as URIs de redirecionamento permitidas do Work4You. Nada é registrado por instalação, e nada é específico do usuário.

A escolha final pertence ao servidor de autorização: o SDK envia a URL do documento como o `client_id` apenas quando o servidor anuncia `client_id_metadata_document_supported: true` em seus metadados, e caso contrário registra via DCR exatamente como antes. O DCR está obsoleto na especificação MCP, mas ainda é o que quase todo servidor implantado usa hoje.

#### Portas de callback

O documento declara um conjunto fixo de URIs de redirecionamento loopback, e a especificação exige que a URI de redirecionamento em uma requisição de autorização seja uma *correspondência exata de string* com uma delas — então um fluxo CIMD não pode usar a porta alta aleatória que o Work4You normalmente escolhe. O Work4You, portanto, fixa o callback em uma das portas `27890`–`27894`.

Essa fixação precisa ser escolhida antes que as capacidades do servidor sejam conhecidas, porque a URI de redirecionamento é fixada no início do fluxo, enquanto os metadados do servidor só chegam no meio do processo. Então o Work4You fixa a porta para qualquer fluxo que *poderia* acabar usando CIMD, e reverte para uma porta aleatória para o resto:

- Um servidor ao qual o Work4You já se conectou antes, cujos metadados em cache não anunciam CIMD, mantém a porta aleatória que sempre usou.
- Um servidor que o Work4You nunca alcançou recebe uma porta fixa nesse primeiro login, já que adivinhar é a única forma de o CIMD poder ser usado.
- Qualquer coisa que moveria o callback para outro lugar também reverte: um `oauth.client_id` pré-registrado, um `oauth.client_secret`, um `oauth.client_name` ou `oauth.token_endpoint_auth_method` personalizado, uma substituição de `oauth.redirect_uri` ou `oauth.redirect_port`, um login conduzido pelo dashboard ou pelo desktop, um registro de cliente existente em disco, ou as cinco portas estarem ocupadas por outros processos.

Cada porta fixada é vinculada assim que é escolhida e mantida até que o redirecionamento do navegador chegue, então dois logins concorrentes — um segundo perfil, ou outro servidor no mesmo processo — não podem cair no mesmo listener.

#### Quando um servidor rejeita o documento

Se um servidor busca o documento e o recusa no endpoint de *token* (`invalid_client`), o Work4You registra a rejeição, a grava em `~/.work4you/mcp-tokens/<server>.cimd-off`, e usa DCR para aquele servidor a partir de então.

Um servidor que não consegue buscar ou validar o documento de forma alguma aborta no endpoint de *autorização*, antes que qualquer redirecionamento aconteça. Não há sinal que o Work4You possa observar ali, então o navegador mostra um erro de invalid-client e o login expira após cinco minutos. A mensagem de timeout nomeia o documento e aponta para `cimd: false`. Executar `work4you mcp login <server>` limpa a rejeição registrada, então um documento corrigido recebe outra chance.

#### Chaves opcionais por servidor

```yaml
mcp_servers:
  protected_api:
    url: "https://mcp.example.com/mcp"
    auth: oauth
    oauth:
      client_metadata_url: "https://example.com/my-cimd.json"  # documento auto-hospedado
      cimd: false                                              # forçar DCR
      user_agent: "My-MCP-Client/1.0"                          # User-Agent da requisição de token
```

`client_metadata_url` deve ser uma URL HTTPS com um caminho (sem origem simples, sem fragmento, sem userinfo, sem segmentos `.`/`..`) que retorne `200` e `Content-Type: application/json` **sem redirecionamento** — os servidores de autorização são proibidos de seguir redirecionamentos ao buscá-la. O Work4You ainda fixa seu callback na mesma faixa `27890`–`27894`, então um documento auto-hospedado deve declarar todas as dez URIs loopback (`http://127.0.0.1:<port>/callback` e `http://localhost:<port>/callback` para cada porta), e seu `client_id` deve ser sua própria URL.

`user_agent` substitui o `User-Agent` padrão da biblioteca HTTP **somente nas requisições ao endpoint de token** (troca de código de autorização e renovação) — alguns servidores de autorização e WAFs rejeitam o valor padrão `python-httpx/...` ali. Nunca se aplica ao tráfego MCP ou à descoberta OAuth, e nenhum outro cabeçalho de requisição de token é configurável. Valores vazios ou nulos são ignorados.

## Link "Add to Work4You"

Fornecedores e documentações de MCP podem oferecer um botão de um clique **"Add to Work4You"** que abre o aplicativo desktop do Work4You com uma configuração de servidor pré-preenchida, espelhando o esquema `cursor://anysphere.cursor-deeplink/mcp/install` do Cursor:

```text
work4you://mcp/install?name=NAME&config=BASE64
```

- `name` — o nome do servidor. Deve corresponder a `^[A-Za-z0-9._-]{1,64}$`.
- `config` — o objeto de configuração do servidor como **JSON codificado em base64url** (base64 padrão também é aceito). O JSON decodificado deve ser um objeto com um campo string `url` (apenas `http://`/`https://`) ou um campo string `command`, e pode carregar qualquer uma das chaves de servidor documentadas acima. Payloads acima de 32KB são rejeitados.

Exemplo (JavaScript):

```js
const config = { url: 'https://mcp.example.com/mcp' }
const link = `work4you://mcp/install?name=example&config=${btoa(JSON.stringify(config))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
```

Abrir o link nunca instala nada por si só: o aplicativo desktop mostra uma caixa de diálogo de confirmação com o nome do servidor e a configuração completa formatada (com um cuidado extra para servidores baseados em `command`, que executam um processo local), e o usuário deve confirmar explicitamente. Nomes de servidor existentes nunca são sobrescritos — o usuário é solicitado a renomear ou cancelar.
