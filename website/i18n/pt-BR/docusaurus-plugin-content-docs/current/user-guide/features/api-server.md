---
sidebar_position: 14
title: "API Server"
description: "Exponha o work4you como uma API compatível com OpenAI para qualquer frontend"
---

# API Server

O API server expõe o work4you como um endpoint HTTP compatível com OpenAI. Qualquer frontend que fale o formato OpenAI — Open WebUI, LobeChat, LibreChat, NextChat, ChatBox, e centenas de outros — pode se conectar ao work4you e usá-lo como backend.

Seu agente trata as requisições com seu conjunto completo de ferramentas (terminal, operações de arquivo, busca web, memória, skills) e retorna a resposta final. Durante o streaming, indicadores de progresso de ferramentas aparecem em linha para que os frontends possam mostrar o que o agente está fazendo.

:::tip Um backend cobre modelos + ferramentas
O próprio Work4You precisa de um provedor configurado e de backends de ferramentas para que o API server seja útil. Uma assinatura do [Work4You Portal](/user-guide/features/tool-gateway) resolve os dois — mais de 300 modelos além de web/imagem/TTS/browser via o Tool Gateway. Rode `work4you setup --portal` uma vez antes de iniciar o API server e frontends como Open WebUI ou LobeChat ganham um backend totalmente equipado com ferramentas.
:::

## Início rápido

### 1. Ative o API server

Adicione ao `~/.work4you/.env`:

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
# Opcional: apenas se um navegador precisar chamar o Work4You diretamente
# API_SERVER_CORS_ORIGINS=http://localhost:3000
```

### 2. Inicie o gateway

```bash
work4you gateway
```

Você verá:

```
[API Server] API server listening on http://127.0.0.1:8642
```

### 3. Conecte um frontend

Aponte qualquer cliente compatível com OpenAI para `http://localhost:8642/v1`:

```bash
# Teste com curl
curl http://localhost:8642/v1/chat/completions \
  -H "Authorization: Bearer change-me-local-dev" \
  -H "Content-Type: application/json" \
  -d '{"model": "work4you", "messages": [{"role": "user", "content": "Hello!"}]}'
```

Ou conecte o Open WebUI, LobeChat, ou qualquer outro frontend — veja o [guia de integração com o Open WebUI](/user-guide/messaging/open-webui) para instruções passo a passo.

## Endpoints

### POST /v1/chat/completions

Formato padrão OpenAI Chat Completions. Sem estado — a conversa completa é incluída em cada requisição via o array `messages`.

**Requisição:**
```json
{
  "model": "work4you",
  "messages": [
    {"role": "system", "content": "You are a Python expert."},
    {"role": "user", "content": "Write a fibonacci function"}
  ],
  "stream": false
}
```

**Resposta:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "work4you",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "Here's a fibonacci function..."},
    "finish_reason": "stop"
  }],
  "usage": {"prompt_tokens": 50, "completion_tokens": 200, "total_tokens": 250}
}
```

**Entrada de imagem em linha:** mensagens de usuário podem enviar `content` como um array de partes `text` e `image_url`. Tanto URLs remotas `http(s)` quanto URLs `data:image/...` são suportadas:

```json
{
  "model": "work4you",
  "messages": [
    {
      "role": "user",
      "content": [
        {"type": "text", "text": "What is in this image?"},
        {"type": "image_url", "image_url": {"url": "https://example.com/cat.png", "detail": "high"}}
      ]
    }
  ]
}
```

Arquivos enviados (`file` / `input_file` / `file_id`) e URLs `data:` que não sejam de imagem retornam `400 unsupported_content_type`.

**Streaming** (`"stream": true`): Retorna Server-Sent Events (SSE) com trechos de resposta token a token. Para **Chat Completions**, o stream usa os eventos padrão `chat.completion.chunk` mais o evento customizado `work4you.tool.progress` do Work4You para UX de início de ferramenta. Para **Responses**, o stream usa os tipos de evento da OpenAI Responses como `response.created`, `response.output_text.delta`, `response.output_item.added`, `response.output_item.done` e `response.completed`.

**Progresso de ferramentas nos streams**:
- **Chat Completions**: o Work4You emite `event: work4you.tool.progress` para visibilidade de início de ferramenta sem poluir o texto do assistente persistido.
- **Responses**: o Work4You emite itens de saída nativos da spec `function_call` e `function_call_output` durante o stream SSE, para que os clientes possam renderizar UI estruturada de ferramentas em tempo real.

### POST /v1/responses

Formato OpenAI Responses API. Suporta estado de conversa do lado do servidor via `previous_response_id` — o servidor armazena o histórico completo da conversa (incluindo chamadas e resultados de ferramentas), então o contexto multi-turno é preservado sem que o cliente precise gerenciá-lo.

**Requisição:**
```json
{
  "model": "work4you",
  "input": "What files are in my project?",
  "instructions": "You are a helpful coding assistant.",
  "store": true
}
```

**Resposta:**
```json
{
  "id": "resp_abc123",
  "object": "response",
  "status": "completed",
  "model": "work4you",
  "output": [
    {"type": "function_call", "status": "completed", "name": "terminal", "arguments": "{\"command\": \"ls\"}", "call_id": "call_1"},
    {"type": "function_call_output", "status": "completed", "call_id": "call_1", "output": "README.md src/ tests/"},
    {"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": "Your project has..."}]}
  ],
  "usage": {"input_tokens": 50, "output_tokens": 200, "total_tokens": 250}
}
```

As chamadas de ferramentas no array `output` já foram executadas do lado do servidor pelo agente Work4You — elas são reproduzidas com `"status": "completed"` para UI estruturada de ferramentas, nunca como chamadas pendentes para o cliente executar.

**Entrada de imagem em linha:** `input[].content` pode conter partes `input_text` e `input_image`. Tanto URLs remotas quanto URLs `data:image/...` são suportadas:

```json
{
  "model": "work4you",
  "input": [
    {
      "role": "user",
      "content": [
        {"type": "input_text", "text": "Describe this screenshot."},
        {"type": "input_image", "image_url": "data:image/png;base64,iVBORw0K..."}
      ]
    }
  ]
}
```

Arquivos enviados (`input_file` / `file_id`) e URLs `data:` que não sejam de imagem retornam `400 unsupported_content_type`.

#### Multi-turno com previous_response_id

Encadeie respostas para manter o contexto completo (incluindo chamadas de ferramentas) entre turnos:

```json
{
  "input": "Now show me the README",
  "previous_response_id": "resp_abc123"
}
```

O servidor reconstrói a conversa completa a partir da cadeia de respostas armazenada — todas as chamadas e resultados de ferramentas anteriores são preservados. Requisições encadeadas também compartilham a mesma sessão, então conversas multi-turno aparecem como uma única entrada no dashboard e no histórico de sessões.

#### Conversas nomeadas

Use o parâmetro `conversation` em vez de rastrear IDs de resposta:

```json
{"input": "Hello", "conversation": "my-project"}
{"input": "What's in src/?", "conversation": "my-project"}
{"input": "Run the tests", "conversation": "my-project"}
```

O servidor encadeia automaticamente para a resposta mais recente naquela conversa. Igual ao comando `/title` para sessões do gateway.

### GET /v1/responses/\{id\}

Recupera uma resposta armazenada previamente por ID.

### DELETE /v1/responses/\{id\}

Exclui uma resposta armazenada.

### GET /v1/models

Lista o agente como um modelo disponível. O nome de modelo anunciado usa por padrão o nome do [profile](/user-guide/profiles) (ou `work4you` para o profile padrão). Exigido pela maioria dos frontends para descoberta de modelo.

`/v1/models` é propositalmente a superfície barata compatível com OpenAI. Ele **não**
enumera cada combinação de provedor/modelo autenticada para a qual o Work4You pode rotear,
e não faz enriquecimento de preço ou capacidade.

### GET /api/model/options

Clientes com consciência do Work4You podem solicitar o mesmo inventário curado de provedor/modelo usado
pelo dashboard e pela TUI. Esta rota usa a autenticação bearer normal do API server e
retorna linhas de provedor, dicas de capacidade de modelo e metadados de preço que não pertencem
à resposta `/v1/models` compatível com OpenAI:

```bash
curl \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  "http://127.0.0.1:8642/api/model/options"
```

Esse payload é o mesmo substrato que a página Models do dashboard e a RPC `model.options`
da TUI usam. Ele retorna provedores autenticados, listas curadas de modelos, preços por
modelo e dicas de capacidade de modelo.

Aberturas normais são propositalmente conservadoras para provedores personalizados: o Work4You sonda
apenas o endpoint personalizado **atualmente selecionado**, para que um endpoint salvo obsoleto ou offline
não bloqueie o seletor. Um refresh explícito muda para sondagem completa e
invalida o cache de modelo do provedor:

```bash
curl \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  "http://127.0.0.1:8642/api/model/options?refresh=1"
```

Use `/v1/models` quando um cliente compatível com OpenAI só precisa de um nome de modelo para
enviar de volta em requisições de chat/responses. Use `/api/model/options` quando uma
UI autenticada precisa dos metadados mais ricos do seletor específico do Work4You.

### GET /v1/capabilities

Retorna uma descrição legível por máquina da superfície estável do API server para UIs externas, orquestradores e pontes de plugin.

```json
{
  "object": "work4you.api_server.capabilities",
  "platform": "work4you",
  "model": "work4you",
  "auth": {"type": "bearer", "required": true},
  "features": {
    "chat_completions": true,
    "responses_api": true,
    "run_submission": true,
    "run_status": true,
    "run_events_sse": true,
    "run_stop": true
  }
}
```

Use este endpoint ao integrar dashboards, UIs de navegador ou control planes, para que eles possam descobrir se a versão em execução do Work4You suporta runs, streaming, cancelamento e continuidade de sessão sem depender de internals privados do Python.

## Seleção de modelo por requisição

Clientes autenticados podem sobrescrever a seleção de modelo padrão do Work4You por requisição
enviando:

- `model` — o id do modelo alvo para este turno
- `provider` — o slug de provedor do Work4You para resolver credenciais/runtime deste turno
- `model_options` — controles de raciocínio / camada de serviço restritos a essa requisição

Os mesmos campos de requisição são aceitos em:

- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/runs`
- `POST /api/sessions/{session_id}/chat`
- `POST /api/sessions/{session_id}/chat/stream`

A precedência é determinística:

1. Override `/model` da sessão, se aquela sessão já tiver um
2. Um mapeamento estático `gateway.platforms.api_server.model_routes` selecionado quando
   o `model` da requisição é um alias de rota configurado
3. `model` / `provider` diretos da requisição quando nenhum alias de rota corresponde
4. Configuração global do gateway / padrões de ambiente

`model_options` permanece restrito à requisição, independentemente de qual modelo/provedor vence.
Se uma requisição enviar um `provider` que conflita com um alias de `model_routes` configurado,
o Work4You rejeita a requisição com `400` em vez de misturar silenciosamente as credenciais
da rota com outro provedor.

**Valores de `model` puros nos endpoints compatíveis com OpenAI são opcionais (opt-in).** Clientes OpenAI
genéricos rotineiramente fixam nomes de modelo (`gpt-4o`, ...), e implantações
existentes dependem desses valores caindo de volta no padrão do gateway. Em
`POST /v1/chat/completions` e `POST /v1/responses`, um valor de `model` enviado
SEM um `provider` é, portanto, ignorado a menos que você habilite:

```yaml
gateway:
  platforms:
    api_server:
      direct_model_requests: true
```

Requisições que incluem um `provider` explícito — e os endpoints nativos do Work4You
`/v1/runs` e de chat de sessão — sempre respeitam o modelo solicitado
independentemente desta flag.

Exemplo:

```json
{
  "model": "MiniMax-M3",
  "provider": "minimax",
  "model_options": {
    "reasoning_effort": "high",
    "service_tier": "priority"
  },
  "messages": [
    {"role": "user", "content": "Summarize the repo status."}
  ]
}
```

### GET /health

Verificação de saúde. Retorna `{"status": "ok"}`. Também disponível em **GET /v1/health** para clientes compatíveis com OpenAI que esperam o prefixo `/v1/`.

### GET /health/detailed

Verificação de prontidão autenticada para monitoramento e control planes. Ela reporta
status limitado para a configuração do profile ativo, banco de dados de estado, modelo
configurado, espaço em disco, estado do gateway/plataforma, runs de API ativos, conclusões de
processo pendentes e delegações ativas. A resposta expõe status e contagens,
não valores de configuração, credenciais, caminhos, comandos, payloads de fila ou erros brutos.

A rota pública `/health` continua sendo uma sonda de liveness barata e não executa
verificações de prontidão. Um resultado de prontidão degradado ainda usa HTTP 200; inspecione os
campos de nível superior `status` e `readiness.checks`.

## API de Runs (alternativa amigável a streaming)

Além de `/v1/chat/completions` e `/v1/responses`, o servidor expõe uma API de **runs** para sessões de formato longo em que o cliente quer se inscrever para eventos de progresso em vez de gerenciar o streaming por conta própria.

### POST /v1/runs

Cria um novo run do agente. Retorna um `run_id` que pode ser usado para se inscrever em eventos de progresso.

```json
{
  "run_id": "run_abc123",
  "status": "started"
}
```

Os runs aceitam uma simples string `input` e, opcionalmente, `session_id`, `instructions`, `conversation_history`, ou `previous_response_id`. Quando `session_id` é fornecido, o Work4You o expõe no status do run para que UIs externas possam correlacionar runs com seus próprios IDs de conversa.

### GET /v1/runs/\{run_id\}

Consulta o estado atual do run. Útil para dashboards que precisam de status sem manter uma conexão SSE aberta, ou para UIs que reconectam após navegação.

```json
{
  "object": "work4you.run",
  "run_id": "run_abc123",
  "status": "completed",
  "session_id": "space-session",
  "model": "work4you",
  "output": "Done.",
  "usage": {"input_tokens": 50, "output_tokens": 200, "total_tokens": 250}
}
```

Os status são mantidos brevemente após estados terminais (`completed`, `failed`, ou `cancelled`) para consulta e reconciliação de UI.

### GET /v1/runs/\{run_id\}/events

Stream de Server-Sent Events do progresso de chamadas de ferramentas do run, deltas de token e eventos de ciclo de vida. Projetado para dashboards e clientes robustos que querem conectar/desconectar sem perder estado.

Quando o agente delega trabalho a subagentes em segundo plano, o stream também carrega
eventos de ciclo de vida `subagent.start` e `subagent.complete`, para que os clientes possam
observar os resultados da delegação — incluindo timeouts e falhas — em vez do
run ficar silencioso enquanto um filho trabalha. O payload de `subagent.complete` carrega
o status do filho, o resumo, a duração, números de token/custo, e um
`child_session_id` para correlação; campos de texto livre passam por redação forçada
de segredos antes de sair do processo. Eventos por-ferramenta do filho
(`subagent.tool`, ticks de progresso) são intencionalmente **não** encaminhados — são
ruído de UI de alto volume; use os arquivos de transcript ao vivo por filho para
acompanhar a ação em detalhe.

Buffers de evento não consumidos expiram após cinco minutos, para que um cliente desconectado não
cresça em memória indefinidamente. Isso expira apenas o estado de transporte: um run que
ainda está executando permanece visível para consulta de status, aprovação, controle de parada e
contabilização de concorrência até que seu trabalho de executor realmente termine. Um assinante SSE
conectado continua drenando normalmente.

### POST /v1/runs/\{run_id\}/stop

Interrompe um turno de agente em execução. O endpoint retorna imediatamente com `{"status": "stopping"}` enquanto o Work4You pede ao agente ativo para parar no próximo ponto de interrupção seguro.
O run permanece rastreado como `stopping` até que o trabalho baseado em executor termine, então
se estabiliza como `cancelled`; solicitar a parada nunca esconde um worker que ainda está
em execução.

### POST /v1/runs/\{run_id\}/approval

Resolve uma aprovação pendente de um run que está aguardando uma decisão humana (por exemplo, uma chamada de ferramenta bloqueada por uma política de aprovação). O corpo carrega a decisão de aprovação; o run é retomado assim que a decisão é registrada. Este endpoint é anunciado em `/v1/capabilities` como a feature `run_approval`, para que UIs externas possam detectar suporte antes de exibir um prompt de aprovação.

## API de Jobs (trabalho agendado em segundo plano)

O servidor expõe uma superfície CRUD leve de jobs para gerenciar runs de agente agendados / em segundo plano a partir de um cliente remoto. Todos os endpoints são protegidos pela mesma autenticação bearer.

### GET /api/jobs

Lista todos os jobs agendados.

### POST /api/jobs

Cria um novo job agendado. O corpo aceita o mesmo formato que `work4you cron` — prompt, agendamento, skills, override de provedor, alvo de entrega.

### GET /api/jobs/\{job_id\}

Busca a definição e o estado da última execução de um job.

### PATCH /api/jobs/\{job_id\}

Atualiza campos de um job existente (prompt, agendamento, etc.). Atualizações parciais são mescladas.

### DELETE /api/jobs/\{job_id\}

Remove um job. Também cancela qualquer run em andamento.

### POST /api/jobs/\{job_id\}/pause

Pausa um job sem excluí-lo. Os timestamps de próxima execução ficam suspensos até que seja retomado.

### POST /api/jobs/\{job_id\}/resume

Retoma um job previamente pausado.

### POST /api/jobs/\{job_id\}/run

Aciona o job para rodar imediatamente, fora do agendamento.

## API de Sessions (controle de sessão via REST)

UIs externas podem gerenciar sessões do Work4You via REST sem precisar levantar o dashboard. Todos os endpoints são protegidos por `API_SERVER_KEY` e ficam sob `/api/sessions/*`.

| Método | Caminho | Descrição |
|--------|------|-------------|
| `GET` | `/api/sessions` | Lista sessões (paginado — `limit`, `offset`, `source`, `include_children`) |
| `POST` | `/api/sessions` | Cria uma sessão vazia |
| `GET` | `/api/sessions/{id}` | Lê metadados da sessão |
| `PATCH` | `/api/sessions/{id}` | Atualiza título ou `end_reason` |
| `DELETE` | `/api/sessions/{id}` | Exclui uma sessão |
| `GET` | `/api/sessions/{id}/messages` | Histórico de mensagens de uma sessão |
| `POST` | `/api/sessions/{id}/fork` | Ramifica a sessão via linhagem do `SessionDB` (equivale à semântica de `/branch` na CLI) |
| `POST` | `/api/sessions/{id}/chat` | Executa um turno de agente síncrono |
| `POST` | `/api/sessions/{id}/chat/stream` | Wrapper SSE sobre um único turno — emite eventos `assistant.delta`, `tool.started`, `tool.completed`, `run.completed` |

`/v1/capabilities` anuncia a superfície completa via flags de feature `session_*` e entradas `endpoints.session_*`, para que UIs externas possam detectar suporte e recuar com segurança. Imagens em linha são suportadas nos payloads de `chat` e `chat/stream` (caminho com consciência multimodal).

```bash
# ramifica uma sessão e roda um turno
curl -X POST http://localhost:8642/api/sessions/$ID/fork \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  -d '{"title": "explore alt path"}'

# transmite um turno via SSE
curl -N -X POST http://localhost:8642/api/sessions/$ID/chat/stream \
  -H "Authorization: Bearer $API_SERVER_KEY" \
  -d '{"input": "what files changed in the last hour?"}'
```

## Descoberta de skills e toolsets

`GET /v1/skills` e `GET /v1/toolsets` permitem que clientes externos enumerem as capacidades do agente de forma determinística via REST, em vez de perguntar ao modelo. Ambos são somente leitura e protegidos por `API_SERVER_KEY`.

```bash
curl http://localhost:8642/v1/skills \
  -H "Authorization: Bearer $API_SERVER_KEY"
# → [{"name": "github-pr-workflow", "description": "...", "category": "..."}, ...]

curl http://localhost:8642/v1/toolsets \
  -H "Authorization: Bearer $API_SERVER_KEY"
# → [{"name": "core", "label": "...", "description": "...", "enabled": true,
#     "configured": true, "tools": ["read_file", "write_file", ...]}, ...]
```

`/v1/skills` retorna os mesmos metadados que o hub de skills usa internamente. `/v1/toolsets` retorna os toolsets resolvidos para a plataforma `api_server` com a lista concreta de `tools` para a qual cada um se expande. Ambos são anunciados em `endpoints.*` em `/v1/capabilities`.

## Escopo de memória de longo prazo (`X-Work4You-Session-Key`)

Frontends multiusuário como o Open WebUI precisam de um identificador estável por canal para memória de longo prazo (Honcho, etc.) que seja **independente** do `X-Work4You-Session-Id` restrito ao transcript (que gira a cada `/new`). Envie `X-Work4You-Session-Key` em `/v1/chat/completions`, `/v1/responses`, ou `/v1/runs` e o Work4You o encaminha até `AIAgent(gateway_session_key=...)`, onde o provedor de memória Honcho o usa para derivar um escopo estável.

```http
POST /v1/chat/completions HTTP/1.1
Authorization: Bearer ***
X-Work4You-Session-Id: transcript-alpha
X-Work4You-Session-Key: agent:main:webui:dm:user-42
```

Regras: máximo de 256 caracteres, caracteres de controle (`\r`, `\n`, `\x00`) são rejeitados, e o valor é ecoado de volta nas respostas (JSON + SSE). `/v1/capabilities` anuncia o suporte via `"session_key_header": "X-Work4You-Session-Key"`. Sem a chave, a estratégia `per-session` do Honcho produz um escopo diferente por `session_id` — exatamente o comportamento que o Work4You tinha antes.

## Tratamento do System Prompt

Quando um frontend envia uma mensagem `system` (Chat Completions) ou o campo `instructions` (Responses API), o work4you **empilha isso por cima** do seu system prompt principal. Seu agente mantém todas as suas ferramentas, memória e skills — o system prompt do frontend adiciona instruções extras.

Isso significa que você pode personalizar o comportamento por frontend sem perder capacidades:
- System prompt do Open WebUI: "You are a Python expert. Always include type hints."
- O agente ainda tem terminal, ferramentas de arquivo, busca web, memória, etc.

## Autenticação

Autenticação bearer token via o header `Authorization`:

```
Authorization: Bearer ***
```

Configure a chave via a variável de ambiente `API_SERVER_KEY`. Se precisar que um navegador chame o Work4You diretamente, defina também `API_SERVER_CORS_ORIGINS` para uma allowlist explícita.

### Roteamento multi-profile (`/p/<profile>/…`)

Quando o [roteamento de gateway multi-profile](/user-guide/multi-profile-gateways) está
habilitado (`gateway.multiplex_profiles`), o listener compartilhado serve cada
profile através de um prefixo de URL `/p/<profile>/` — e **a autenticação fica vinculada
ao profile roteado**:

- Requisições para `/p/<profile>/v1/...` devem apresentar a própria
  `API_SERVER_KEY` daquele profile (de `~/.work4you/profiles/<profile>/.env`). A chave
  do listener padrão é rejeitada em prefixos de profile nomeados.
- Rotas sem prefixo e `/p/default/...` continuam usando a chave do profile padrão.
- Um profile nomeado sem sua própria `API_SERVER_KEY` fica indisponível por padrão — seu
  prefixo fica inacessível até que você defina uma.

:::warning Mudança que quebra compatibilidade (julho de 2026)
Antes desta correção, uma chave válida do profile padrão era aceita em qualquer
prefixo `/p/<profile>/`. Se você dependia de uma chave compartilhada entre prefixos de profile,
defina uma `API_SERVER_KEY` distinta no `.env` de cada profile — chaves
padrão reutilizadas em prefixos nomeados agora retornam `401`.
:::

:::warning Segurança
O API server dá acesso total ao conjunto de ferramentas do work4you, **incluindo comandos de terminal**. `API_SERVER_KEY` é **obrigatória para todo deployment**, incluindo o bind loopback padrão em `127.0.0.1`. Mantenha `API_SERVER_CORS_ORIGINS` restrito para controlar o acesso via navegador quando você permitir explicitamente chamadores de navegador.
:::

## Configuração

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|---------|-------------|
| `API_SERVER_ENABLED` | `false` | Ativa o API server |
| `API_SERVER_PORT` | `8642` | Porta do servidor HTTP |
| `API_SERVER_HOST` | `127.0.0.1` | Endereço de bind (apenas localhost por padrão) |
| `API_SERVER_KEY` | _(obrigatório)_ | Bearer token para autenticação |
| `API_SERVER_CORS_ORIGINS` | _(nenhum)_ | Origens de navegador permitidas, separadas por vírgula |
| `API_SERVER_MODEL_NAME` | _(nome do profile)_ | Nome do modelo em `/v1/models`. Padrão é o nome do profile, ou `work4you` para o profile padrão. |

### config.yaml

As mesmas configurações podem viver em `~/.work4you/config.yaml` sob uma seção aninhada `gateway.api_server:`:

```yaml
gateway:
  api_server:
    enabled: true
    port: 8642
    host: 127.0.0.1
    key: your-secret-key
    cors_origins: http://localhost:3000
    model_name: my-work4you
    max_concurrent_runs: 10   # limite de runs concorrentes; 0 desativa o limite
```

`port`, `key`, `host`, `cors_origins`, e `model_name` são automaticamente encaminhados para as configurações `extra` da plataforma, então se comportam exatamente como suas contrapartes de variável de ambiente `API_SERVER_*`. Variáveis de ambiente têm precedência sobre valores do `config.yaml`. O bloco também é aceito sob `gateway.platforms.api_server:` ou uma seção `platforms.api_server:` de nível superior.

### Limite de runs concorrentes

O API server limita quantos runs de agente podem executar de uma vez entre os endpoints compatíveis com OpenAI e os endpoints de Runs. O limite é lido de `gateway.api_server.max_concurrent_runs` (padrão **10**; `0` desativa o limite, valores negativos são fixados em 0). Quando o limite é atingido, novas requisições que iniciariam um run são rejeitadas com **HTTP 429** `Too many concurrent runs (max N)` — os clientes devem recuar e tentar novamente.

## Cabeçalhos de segurança

Todas as respostas incluem cabeçalhos de segurança:
- `X-Content-Type-Options: nosniff` — evita sniffing de tipo MIME
- `Referrer-Policy: no-referrer` — evita vazamento de referrer

## CORS

O API server **não** habilita CORS de navegador por padrão.

Para acesso direto de navegador, defina uma allowlist explícita:

```bash
API_SERVER_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Quando o CORS está habilitado:
- **Respostas de preflight** incluem `Access-Control-Max-Age: 600` (cache de 10 minutos)
- **Respostas de streaming SSE** incluem cabeçalhos CORS para que clientes EventSource de navegador funcionem corretamente
- **`Idempotency-Key`** é um cabeçalho de requisição permitido — clientes podem enviá-lo para deduplicação (respostas são cacheadas pela chave por 5 minutos)

A maioria dos frontends documentados, como o Open WebUI, se conecta servidor-a-servidor e não precisa de CORS de forma alguma.

## Frontends compatíveis

Qualquer frontend que suporte o formato de API OpenAI funciona. Integrações testadas/documentadas:

| Frontend | Estrelas | Conexão |
|----------|-------|------------|
| [Open WebUI](/user-guide/messaging/open-webui) | 126k | Guia completo disponível |
| LobeChat | 73k | Endpoint de provedor customizado |
| LibreChat | 34k | Endpoint customizado em librechat.yaml |
| AnythingLLM | 56k | Provedor OpenAI genérico |
| NextChat | 87k | Variável de ambiente BASE_URL |
| ChatBox | 39k | Configuração de API Host |
| Jan | 26k | Configuração de modelo remoto |
| HF Chat-UI | 8k | OPENAI_BASE_URL |
| big-AGI | 7k | Endpoint customizado |
| OpenAI Python SDK | — | `OpenAI(base_url="http://localhost:8642/v1")` |
| curl | — | Requisições HTTP diretas |

## Configuração multiusuário com profiles

Para dar a múltiplos usuários sua própria instância isolada do Work4You (configuração, memória e skills separadas), use [profiles](/user-guide/profiles):

```bash
# Cria um profile por usuário
work4you profile create alice
work4you profile create bob

# Configura o API server de cada profile em uma porta diferente. API_SERVER_* são
# variáveis de ambiente (não chaves de config.yaml), então escreva-as no .env de cada profile:
cat >> ~/.work4you/profiles/alice/.env <<EOF
API_SERVER_ENABLED=true
API_SERVER_PORT=8643
API_SERVER_KEY=alice-secret
EOF

cat >> ~/.work4you/profiles/bob/.env <<EOF
API_SERVER_ENABLED=true
API_SERVER_PORT=8644
API_SERVER_KEY=bob-secret
EOF

# Inicia o gateway de cada profile
work4you -p alice gateway &
work4you -p bob gateway &
```

O API server de cada profile anuncia automaticamente o nome do profile como o ID do modelo:

- `http://localhost:8643/v1/models` → modelo `alice`
- `http://localhost:8644/v1/models` → modelo `bob`

No Open WebUI, adicione cada um como uma conexão separada. O dropdown de modelo mostra `alice` e `bob` como modelos distintos, cada um apoiado por uma instância do Work4You totalmente isolada. Veja o [guia do Open WebUI](/user-guide/messaging/open-webui#multi-user-setup-with-profiles) para detalhes.

## Limitações

- **Armazenamento de respostas** — respostas armazenadas (para `previous_response_id`) são persistidas em SQLite e sobrevivem a reinicializações do gateway. Máximo de 100 respostas armazenadas (remoção LRU).
- **Sem upload de arquivo** — imagens em linha são suportadas tanto em `/v1/chat/completions` quanto em `/v1/responses`, mas arquivos enviados (`file`, `input_file`, `file_id`) e entradas de documento que não sejam imagem não são suportados pela API.
- **Clientes OpenAI simples ainda veem um alias** — `/v1/models` anuncia o
  alias estável do Work4You (`work4you` ou o nome do profile ativo). Clientes mais
  ricos podem enviar overrides explícitos de `provider` / `model_options` nas requisições.

## Modo Proxy

O API server também serve como o backend para o **modo proxy do gateway**. Quando outra instância de gateway do Work4You é configurada com `GATEWAY_PROXY_URL` apontando para este API server, ela encaminha todas as mensagens para cá em vez de rodar seu próprio agente. Isso possibilita implantações divididas — por exemplo, um contêiner Docker tratando Matrix E2EE que retransmite para um agente do lado do host.

Veja [Modo Proxy do Matrix](/user-guide/messaging/matrix#proxy-mode-e2ee-on-macos) para o guia de configuração completo.
