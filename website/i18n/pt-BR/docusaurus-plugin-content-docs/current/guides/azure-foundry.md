---
sidebar_position: 15
title: "Microsoft Foundry"
description: "Use o Work4You com Microsoft Foundry — endpoints no estilo OpenAI e no estilo Anthropic, com detecção automática de transporte e modelos implantados"
---

# Microsoft Foundry

O provedor `azure-foundry` do Work4You suporta o Microsoft Foundry (antigo Azure AI Foundry) e o Azure OpenAI. Um único recurso Foundry pode hospedar modelos com dois formatos de comunicação diferentes:

- **Estilo OpenAI** — `POST /v1/chat/completions` em endpoints como `https://<resource>.openai.azure.com/openai/v1`. Usado para GPT-4.x, GPT-5.x, Llama, Mistral e a maioria dos modelos de peso aberto.
- **Estilo Anthropic** — `POST /v1/messages` em endpoints como `https://<resource>.services.ai.azure.com/anthropic`. Usado quando o Microsoft Foundry serve modelos Claude via o formato da Anthropic Messages API.

O assistente de configuração sonda seu endpoint e detecta automaticamente qual transporte ele usa, quais implantações estão disponíveis e o comprimento de contexto de cada modelo.

## Pré-requisitos

- Um recurso Microsoft Foundry ou Azure OpenAI com pelo menos uma implantação
- A URL de endpoint da implantação
- **Ou** uma chave de API (do Portal do Azure em "Keys and Endpoint") **ou** a role RBAC **Azure AI User** no recurso Foundry, caso você planeje usar o Microsoft Entra ID (o caminho sem chave que a Microsoft recomenda). Alguns tenants podem exibir a role como **Foundry User** durante a implantação gradual da renomeação da Microsoft.

## Início Rápido

```bash
work4you model
# → Selecione "Azure Foundry"
# → Insira a URL do seu endpoint
# → Escolha a autenticação:
#     1. Chave de API
#     2. Microsoft Entra ID  (identidade gerenciada / identidade de carga de trabalho / az login)
# → (Entra) O Work4You sonda o DefaultAzureCredential; em caso de sucesso, nunca pede uma chave
# → (Chave de API) Insira sua chave de API
# O Work4You sonda o endpoint e detecta automaticamente o transporte + modelos
# → Escolha um modelo da lista (ou digite o nome de uma implantação manualmente)
```

O assistente vai:

1. **Analisar o caminho da URL** — URLs que terminam em `/anthropic` são reconhecidas como rotas Claude do Microsoft Foundry.
2. **Sondar `GET <base>/models`** — se o endpoint retornar uma lista de modelos no formato OpenAI, o Work4You muda para `chat_completions` e preenche um seletor com os IDs de implantação retornados.
3. **Sondar o formato Anthropic Messages** — fallback para endpoints que não expõem `/models` mas aceitam o formato Anthropic Messages.
4. **Recorrer à entrada manual** — endpoints privados/restritos que rejeitam toda sondagem ainda funcionam; você escolhe o modo de API e digita um nome de implantação manualmente.

O comprimento de contexto do modelo escolhido é resolvido pela cadeia de metadados padrão do Work4You (`models.dev`, metadados do provedor e fallbacks fixos por família) e armazenado no `config.yaml` para que o modelo dimensione corretamente sua própria janela de contexto.

## Microsoft Entra ID (sem chave, RBAC) — recomendado

A Microsoft recomenda [autenticação sem chave com Microsoft Entra ID](https://learn.microsoft.com/azure/ai-foundry/foundry-models/how-to/configure-entra-id) para cargas de trabalho de produção no Foundry. O Work4You suporta o Entra ID para **ambas** as superfícies de API:

- **Estilo OpenAI** (`api_mode: chat_completions` / `codex_responses`) — GPT-4/5, Llama, Mistral, DeepSeek, etc.
- **Estilo Anthropic** (`api_mode: anthropic_messages`) — modelos Claude no Microsoft Foundry.

O RBAC do Foundry é por recurso (`Azure AI User` concede ambas as superfícies; alguns tenants podem exibir `Foundry User`) e a Microsoft documenta o mesmo escopo de inferência (`https://ai.azure.com/.default`) para ambos. Nos bastidores:

- O estilo OpenAI usa o contrato nativo `api_key=` chamável do SDK Python da OpenAI — o SDK gera um novo JWT por requisição automaticamente.
- O estilo Anthropic usa um `httpx.Client` com um hook de evento de requisição instalado por `agent.azure_identity_adapter.build_bearer_http_client`, porque o SDK da Anthropic não aceita nativamente um `auth_token` chamável. O hook reescreve `Authorization: Bearer <fresh-jwt>` a cada requisição de saída. Mesmo RBAC da Microsoft, mesmo escopo do Foundry — o contrato do SDK é a única diferença.

### Por que usar o Entra ID?

- Sem chaves de API de longa duração para revogar ou girar.
- Acesso guiado por RBAC — conceda ou remova `Azure AI User` no recurso Foundry, sem precisar reescrever a configuração.
- Logs de acesso e auditoria segmentados por atribuição, em vez de todos os chamadores compartilharem uma única chave estática.
- Superfície de autenticação única para VMs do Azure, pods do AKS, App Service, Functions, Container Apps e o Foundry Agent Service via identidade gerenciada.
- Fluxos de identidade de carga de trabalho e principal de serviço para pipelines de CI/CD.

### Configuração única (lado do Azure)

1. No Portal do Azure, abra seu recurso Foundry → **Access control (IAM)** → **Add → Add role assignment**.
2. Escolha a role **Azure AI User** (ou **Foundry User**, se o seu tenant tiver a role renomeada).
3. Atribua a:
   - **Sua conta de usuário**, para desenvolvimento local com `az login`.
   - **Uma identidade gerenciada ou identidade de carga de trabalho**, para computação hospedada no Azure (recomendado para produção).
   - **A identidade de agente de um agente hospedado no Foundry Agent Service**, quando o Work4You roda dentro de um agente hospedado.
   - **Um principal de serviço**, para pipelines de CI/CD quando a identidade de carga de trabalho não está disponível.
4. Aguarde ~5 minutos para a role se propagar.

Equivalente na CLI do Azure:

```bash
az role assignment create \
  --assignee <principal-or-agent-identity-client-id> \
  --role "Azure AI User" \
  --scope <foundry-resource-id>
```

### Configuração única (lado do Work4You)

```bash
work4you model
# → Selecione "Azure Foundry"
# → Insira a URL do seu endpoint
# → Autenticação: 2 (Microsoft Entra ID)
# → (opcional) client ID de identidade gerenciada atribuída pelo usuário
# → (opcional) ID do tenant do Azure
# → O Work4You sonda o DefaultAzureCredential() e relata qual
#    credencial interna teve sucesso (ex.: AzureCliCredential, ManagedIdentityCredential)
```

O assistente executa uma sondagem prévia limitada (timeout de 10 s). Em caso de falha, ele oferece "salvar mesmo assim, validar depois" — útil ao configurar em uma máquina que ainda não tem credenciais, mas terá em tempo de execução (por exemplo, ao preparar a configuração para uma implantação com identidade gerenciada).

O `azure-identity` é instalado automaticamente no primeiro uso via o caminho de instalação preguiçosa do Work4You. Para pré-instalar:

```bash
pip install azure-identity
```

### Configuração escrita no `config.yaml`

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.openai.azure.com/openai/v1
  api_mode: chat_completions
  auth_mode: entra_id
  default: gpt-4o
  context_length: 128000
  entra:
    scope: https://ai.azure.com/.default        # apenas ao sobrescrever o padrão
```

O Work4You gerencia apenas um parâmetro específico do Entra no `config.yaml`:

- **`scope`** — o escopo do recurso OAuth. O padrão é o escopo de inferência documentado pela Microsoft (`https://ai.azure.com/.default`). Sobrescreva apenas se seu recurso foi provisionado com uma audiência não padrão.

Tudo o mais (tenant, segredo do principal de serviço, arquivo de token federado, autoridade de nuvem soberana, preferências de broker) é lido pelo `azure-identity` diretamente das variáveis de ambiente padrão `AZURE_*` — veja a [ordem de resolução de credenciais](#credential-resolution-order) abaixo. Defina-as em `~/.work4you/.env` ou no seu ambiente de implantação, exatamente como a referência do SDK da Microsoft descreve.

Nenhum segredo é gravado em `~/.work4you/.env` no modo Entra — o `azure-identity` armazena tokens em cache no processo (e, quando disponível, no chaveiro do seu SO / `~/.IdentityService`).

### Ordem de resolução de credenciais {#credential-resolution-order}

O `DefaultAzureCredential` do `azure-identity` percorre esta cadeia a cada requisição de token, parando na primeira credencial que retorna um token:

1. **Credencial de ambiente** — `AZURE_TENANT_ID` + `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` (ou `AZURE_CLIENT_CERTIFICATE_PATH` / `AZURE_FEDERATED_TOKEN_FILE`).
2. **Workload Identity** — `AZURE_FEDERATED_TOKEN_FILE` (tokens federados do AKS / OIDC).
3. **Identidade Gerenciada** — endpoint IMDS (`169.254.169.254`) para máquinas virtuais; `IDENTITY_ENDPOINT` para App Service / Functions / Container Apps. Agentes hospedados no Foundry Agent Service usam a identidade de agente do agente hospedado.
4. **Visual Studio Code** — extensão de conta do Azure.
5. **Azure CLI** — sessão de `az login`.
6. **Azure Developer CLI** — `azd auth login`.
7. **Azure PowerShell** — `Connect-AzAccount`.
8. **Broker** (apenas Windows / WSL) — Web Account Manager.

A credencial de navegador interativo é excluída por padrão para execuções não interativas do Work4You; use Azure CLI, Azure Developer CLI, identidade gerenciada, identidade de carga de trabalho ou credenciais de principal de serviço em vez disso.

### Padrões de implantação

**Desenvolvimento local:**
```bash
az login
work4you model   # escolha Azure Foundry → Entra ID
work4you         # usa seu token de az login
```

**VM do Azure / Functions / App Service / Container Apps (identidade gerenciada atribuída pelo sistema):**
1. Ative a identidade atribuída pelo sistema no recurso de computação.
2. Conceda à identidade `Azure AI User` (ou `Foundry User`) no recurso Foundry.
3. Defina `model.auth_mode: entra_id` no config.yaml — sem variáveis de ambiente necessárias.

**VM do Azure / Functions / App Service / Container Apps (identidade gerenciada atribuída pelo usuário):**
- Defina `AZURE_CLIENT_ID` com o client ID da identidade atribuída pelo usuário para que o `DefaultAzureCredential` escolha a correta.

**Agente hospedado do Foundry Agent Service:**
- Crie o agente hospedado e conceda à identidade desse agente `Azure AI User` (ou `Foundry User`) no recurso Foundry. O Work4You usa `ManagedIdentityCredential` de dentro do agente hospedado; a atribuição de role pertence à identidade do agente, não apenas ao projeto pai ou ao seu usuário.

**AKS Workload Identity (substitui o AAD Pod Identity):**
- Anote a conta de serviço do pod com o client ID da identidade de carga de trabalho.
- O arquivo de token federado do pod é detectado automaticamente via `AZURE_FEDERATED_TOKEN_FILE`.
- `model.auth_mode: entra_id` funciona sem mudanças adicionais de configuração.

**Principal de serviço em CI:**
- Defina `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` no ambiente do runner.

#### Nuvens soberanas (Governo, China)

Exporte `AZURE_AUTHORITY_HOST` (por exemplo, `https://login.microsoftonline.us` para Azure Government, `https://login.partner.microsoftonline.cn` para Azure China). O `azure-identity` lê isso diretamente.

### Verificações de saúde

`work4you doctor` executa uma sondagem de 10 s contra o `DefaultAzureCredential` quando `model.auth_mode: entra_id`, relatando qual credencial interna venceu (variáveis de ambiente presentes, endpoint de identidade gerenciada acessível, etc.).

`work4you auth` mostra um bloco de status estruturado:

```
azure-foundry (Microsoft Entra ID):
  Endpoint: https://my-resource.openai.azure.com/openai/v1
  Scope: https://ai.azure.com/.default
  Status: configured; live token probe is skipped here
```

### Limitações

- **Endpoints no estilo Anthropic usam um hook de evento httpx.** O SDK Python da Anthropic não aceita nativamente um `auth_token` chamável (≤ 0.86.0). O Work4You instala um hook de evento de requisição em um `httpx.Client` personalizado que gera um novo JWT a cada requisição de saída e reescreve `Authorization: Bearer <jwt>`. Isso é funcionalmente equivalente ao contrato nativo `Callable[[], str]` do SDK da OpenAI, mas adiciona uma camada de indireção. Se o SDK da Anthropic adicionar suporte nativo a auth chamável em uma versão futura, o Work4You migrará para ele de forma transparente.
- **Tarefas em lote e `multiprocessing.Pool`.** O provedor de token do Entra é um closure que não pode ser serializado (pickle) entre processos. O `batch_runner.py` remove automaticamente o chamável da configuração do worker e deixa cada processo worker reconstruir seu próprio provedor a partir do `config.yaml` — nenhuma ação do usuário é necessária, mas cada worker paga uma travessia da cadeia na inicialização.
- **Sem persistência de JWT de portador em `auth.json`.** O Work4You não duplica o cache interno de tokens do `azure-identity`; inicializações a frio percorrem a cadeia de credenciais na primeira inferência.

## Configuração (gravada no `config.yaml`)

Depois de rodar o assistente, você verá algo assim:

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.openai.azure.com/openai/v1
  api_mode: chat_completions         # ou "anthropic_messages"
  default: gpt-5.4-mini              # o nome da sua implantação / modelo
  context_length: 400000             # detectado automaticamente
```

E em `~/.work4you/.env`:

```
AZURE_FOUNDRY_API_KEY=<your-azure-key>
```

## Endpoints no estilo OpenAI (GPT, Llama, etc.)

O endpoint v1 GA do Azure OpenAI aceita o cliente Python padrão `openai` com mudanças mínimas:

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.openai.azure.com/openai/v1
  api_mode: chat_completions
  default: gpt-5.4
```

Comportamento importante:

- **GPT-5.x, codex e a série o são roteados automaticamente para a Responses API.** O Microsoft Foundry implanta os modelos GPT-5 / codex / o1 / o3 / o4 apenas como Responses-API — chamar `/chat/completions` contra eles retorna `400 "The requested operation is unsupported."`. O Work4You detecta essas famílias de modelo pelo nome e atualiza `api_mode` para `codex_responses` de forma transparente, mesmo quando o `config.yaml` ainda lê `api_mode: chat_completions`. GPT-4, GPT-4o, Llama, Mistral e outras implantações permanecem em `/chat/completions`.
- **`max_completion_tokens` é usado automaticamente.** O Azure OpenAI (assim como a OpenAI direta) exige `max_completion_tokens` para modelos gpt-4o, série o e gpt-5.x. O Work4You envia o parâmetro correto com base no endpoint.
- **Endpoints pré-v1 que exigem `api-version`.** Se você tem uma URL base legada como `https://<resource>.openai.azure.com/openai?api-version=2025-04-01-preview`, o Work4You extrai a query string e a encaminha via `default_query` em cada requisição (o SDK da OpenAI, do contrário, a descarta ao unir caminhos).

## Endpoints no estilo Anthropic (Claude via Microsoft Foundry)

Para implantações Claude, use a rota no estilo Anthropic:

```yaml
model:
  provider: azure-foundry
  base_url: https://my-resource.services.ai.azure.com/anthropic
  api_mode: anthropic_messages
  default: claude-sonnet-4-6
```

Comportamento importante:

- **`/v1` é removido da URL base.** O SDK da Anthropic anexa `/v1/messages` a cada URL de requisição — o Work4You remove qualquer `/v1` final antes de passar a URL ao SDK, para evitar caminhos duplicados com `/v1`.
- **`api-version` é enviado via `default_query`, não anexado à URL.** O Azure Anthropic exige uma query string `api-version`. Incorporá-la à URL base produz caminhos malformados como `/anthropic?api-version=.../v1/messages` e retorna 404. O Work4You passa `api-version=2025-04-15` via `default_query` do SDK da Anthropic.
- **Autenticação Bearer é usada em vez de `x-api-key`.** A rota compatível com Anthropic do Azure exige `Authorization: Bearer <key>` em vez do cabeçalho nativo `x-api-key` da Anthropic. O Work4You detecta `azure.com` na URL base e roteia a chave de API pelo campo `auth_token` do SDK, para que o cabeçalho correto chegue ao upstream.
- **O cabeçalho beta da janela de contexto de 1M é mantido.** O Azure ainda restringe o contexto Claude de 1M de tokens (Opus 4.6/4.7, Sonnet 4.6) por trás do cabeçalho `anthropic-beta: context-1m-2025-08-07`. O Work4You mantém esse cabeçalho beta nos caminhos do Azure (ele é removido das requisições OAuth nativas da Anthropic porque algumas assinaturas o rejeitam, mas o Azure exige que ele esteja presente).
- **A renovação de token OAuth é desativada.** Implantações do Azure usam chaves de API estáticas. O loop de renovação de token OAuth de `~/.claude/.credentials.json`, que se aplica ao Anthropic Console, é explicitamente pulado para endpoints do Azure, para evitar que o token OAuth do Claude Code sobrescreva sua chave do Azure no meio de uma sessão.

## Alternativa: `provider: anthropic` + URL base do Azure

Se você já tem `provider: anthropic` configurado e só quer apontá-lo para o Microsoft Foundry para o Claude, você pode pular completamente o provedor `azure-foundry`:

```yaml
model:
  provider: anthropic
  base_url: https://my-resource.services.ai.azure.com/anthropic
  key_env: AZURE_ANTHROPIC_KEY
  default: claude-sonnet-4-6
```

Com `AZURE_ANTHROPIC_KEY` definido em `~/.work4you/.env`. O Work4You detecta `azure.com` na URL base e contorna a cadeia de token OAuth do Claude Code, para que a chave do Azure seja usada diretamente com autenticação `x-api-key`.

`key_env` é o nome de campo canônico em snake_case; `api_key_env` (e os equivalentes em camelCase `keyEnv` / `apiKeyEnv`) são aceitos como aliases. Se tanto `key_env` quanto `AZURE_ANTHROPIC_KEY`/`ANTHROPIC_API_KEY` estiverem definidos, a variável de ambiente nomeada por `key_env` prevalece.

## Descoberta de modelos

O Azure **não** expõe um endpoint puro de chave de API para listar suas implantações de modelo *implantadas*. A enumeração de implantações exige autenticação do Azure Resource Manager (`az cognitiveservices account deployment list`) com um principal do Azure AD, não a chave de API de inferência.

O que o Work4You pode fazer:

- Endpoints v1 do Azure OpenAI (`<resource>.openai.azure.com/openai/v1`) expõem `GET /models` com o catálogo de modelos **disponíveis** do recurso. O Work4You usa essa lista para preencher o seletor de modelos.
- Rotas `/anthropic` do Microsoft Foundry: detectadas via caminho da URL, nome do modelo inserido manualmente.
- Endpoints privados / com firewall: entrada manual com uma mensagem amigável de "não foi possível sondar".

Você sempre pode digitar um nome de implantação diretamente — o Work4You não valida contra a lista retornada.

## Variáveis de ambiente

| Variável | Finalidade |
|----------|-------------|
| `AZURE_FOUNDRY_API_KEY` | Chave de API principal para Microsoft Foundry / Azure OpenAI (modo api_key) |
| `AZURE_FOUNDRY_BASE_URL` | URL do endpoint (definida via `work4you model`; a variável de ambiente é usada como fallback) |
| `AZURE_ANTHROPIC_KEY` | Usada por `provider: anthropic` + URL base do Azure (alternativa a `ANTHROPIC_API_KEY`) |
| `AZURE_TENANT_ID` | Tenant do Entra ID para fluxos de principal de serviço |
| `AZURE_CLIENT_ID` | Client ID do Entra ID (principal de serviço, identidade de carga de trabalho, ou identidade gerenciada atribuída pelo usuário) |
| `AZURE_CLIENT_SECRET` | Segredo do principal de serviço |
| `AZURE_CLIENT_CERTIFICATE_PATH` | Certificado do principal de serviço (alternativa ao segredo) |
| `AZURE_FEDERATED_TOKEN_FILE` | Caminho do token federado da Workload Identity (AKS) |
| `AZURE_AUTHORITY_HOST` | Sobrescrita do host de autoridade de nuvem soberana |
| `IDENTITY_ENDPOINT` / `MSI_ENDPOINT` | Endpoint de Identidade Gerenciada para App Service, Functions e Container Apps; VMs geralmente usam IMDS |

O SDK do Azure lê as variáveis de ambiente `AZURE_*` diretamente. O Work4You nunca as inspeciona, exceto para relatar quais fontes estão presentes na saída de `work4you doctor`.

## Solução de Problemas

**401 Unauthorized em implantações gpt-5.x.**
O Azure serve gpt-5.x em `/chat/completions`, não em `/responses`. O Work4You trata isso automaticamente quando a URL contém `openai.azure.com`, mas se você ver um 401 com corpo `Invalid API key`, verifique se `api_mode` no seu `config.yaml` é `chat_completions`.

**404 em `/v1/messages?api-version=.../v1/messages`.**
Este é o bug de URL malformada de configurações Azure Anthropic anteriores à correção. Atualize o Work4You — o parâmetro `api-version` agora é passado via `default_query` em vez de incorporado à URL base, para que o SDK não possa corrompê-lo ao unir URLs.

**O assistente diz "Auto-detection incomplete."**
O endpoint rejeitou tanto a sondagem `/models` quanto a sondagem Anthropic Messages. Isso é normal para endpoints privados atrás de um firewall ou com lista de permissões de IP. Recorra à seleção manual do modo de API e digite o nome da sua implantação — tudo ainda funciona, o Work4You apenas não consegue preencher o seletor.

**Transporte errado escolhido.**
Rode `work4you model` novamente e o assistente sondará de novo. Se a sondagem ainda escolher o modo errado, você pode editar o `config.yaml` diretamente:

```yaml
model:
  provider: azure-foundry
  api_mode: anthropic_messages   # ou chat_completions
```

**Entra ID: "credential chain exhausted" ou 401 Unauthorized após mudar para `auth_mode: entra_id`.**
- Rode `az login` para renovar sua sessão de desenvolvedor (o token em cache pode ter expirado).
- Verifique se a atribuição da role `Azure AI User` (ou `Foundry User`) surtiu efeito: `az role assignment list --assignee <user-or-identity-id>` deve listá-la no seu recurso Foundry. A propagação da role pode levar até 5 minutos.
- Para identidades gerenciadas atribuídas pelo usuário, confira se `AZURE_CLIENT_ID` corresponde à identidade anexada ao recurso de computação.
- Rode `work4you doctor` — a sondagem do Azure Entra relata se a aquisição de token teve sucesso e inclui uma dica de correção.

**Entra ID: a pré-verificação do assistente trava ou expira.**
A pré-verificação de 10 s é uma checagem leve. Escolha "Save anyway and validate later" e rode `work4you doctor` após implantar no ambiente de destino. Causas comuns incluem um serviço de token inacessível ou estado de login local desatualizado — prefira identidade de carga de trabalho em CI, defina `AZURE_TENANT_ID`+`AZURE_CLIENT_ID`+`AZURE_CLIENT_SECRET` ao usar um principal de serviço, ou rode `az login` para desenvolvimento local.

**401 em endpoint no estilo Anthropic com Entra ID.**
Verifique se a mesma role `Azure AI User` (ou `Foundry User`) está atribuída no recurso Foundry (ela cobre tanto os caminhos `/openai/v1` quanto `/anthropic`). Se a sondagem no estilo OpenAI funcionar durante o assistente, mas as requisições `claude-*` falharem em tempo de execução, a causa mais comum é um `model.entra.scope` desatualizado deixado de uma execução anterior do assistente — apague a linha `entra.scope` do `config.yaml` para que o tempo de execução volte a usar o escopo padrão `https://ai.azure.com/.default`.

## Relacionados

- [Variáveis de ambiente](/reference/environment-variables)
- [Configuração](/user-guide/configuration)
- [AWS Bedrock](/guides/aws-bedrock) — a outra grande integração de provedor de nuvem
- [Microsoft: Configure Entra ID for Foundry](https://learn.microsoft.com/azure/ai-foundry/foundry-models/how-to/configure-entra-id) — documentação oficial para o caminho sem chave
