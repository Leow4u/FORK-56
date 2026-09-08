---
sidebar_position: 5
title: "Adding Providers"
description: "How to add a new inference provider to Work4You — auth, runtime resolution, CLI flows, adapters, tests, and docs"
---

# Adicionando Provedores

O Work4You já consegue conversar com qualquer endpoint compatível com OpenAI por meio do caminho de provedor personalizado. Não adicione um provedor nativo a menos que você queira uma UX de primeira classe para esse serviço:

- autenticação específica do provedor ou renovação de token
- um catálogo de modelos selecionado
- entradas de configuração / menu `work4you model`
- aliases de provedor para a sintaxe `provider:model`
- um formato de API não-OpenAI que precisa de um adaptador

Se o provedor for apenas "mais uma URL base compatível com OpenAI e chave de API", um provedor personalizado nomeado pode ser suficiente.

## O modelo mental

Um provedor nativo precisa se alinhar em algumas camadas:

1. `work4you_cli/auth.py` decide como as credenciais são encontradas.
2. `work4you_cli/runtime_provider.py` transforma isso em dados de runtime:
   - `provider`
   - `api_mode`
   - `base_url`
   - `api_key`
   - `source`
3. `run_agent.py` usa `api_mode` para decidir como as requisições são construídas e enviadas.
4. `work4you_cli/models.py` e `work4you_cli/main.py` fazem o provedor aparecer no CLI. (`work4you_cli/setup.py` delega para `main.py` automaticamente — nenhuma alteração é necessária ali.)
5. `agent/auxiliary_client.py` e `agent/model_metadata.py` mantêm as tarefas auxiliares e o orçamento de tokens funcionando.

A abstração importante é `api_mode`.

- A maioria dos provedores usa `chat_completions`.
- Codex e a Meta Model API (`api.meta.ai` — Muse Spark) usam `codex_responses` (envia automaticamente `prompt_cache_retention: 24h` para cache de prompt; `api.meta.ai` alcança 93–99% de acertos de cache somente em `/v1/responses`).
- Anthropic usa `anthropic_messages`.
- Um novo protocolo não-OpenAI geralmente significa adicionar um novo adaptador e um novo ramo de `api_mode`.

### Formato de chamada de ferramenta (tool-call wire format)

O Work4You armazena o histórico de conversa internamente no formato do chat-completions da OpenAI, então o `convert_messages` / `convert_tools` (`agent/transports/chat_completions.py`) do transporte `chat_completions` são quase identidade, e todo outro transporte converte *a partir* desse formato para o seu protocolo nativo. A referência canônica para o formato — definições de `tools` com `parameters` em JSON-schema, entradas `tool_calls` do assistente com `function.arguments` serializado como string, e mensagens de resultado `role: "tool"` indexadas por `tool_call_id` — é a [referência da API de chat completions da OpenAI](https://platform.openai.com/docs/api-reference/chat/create). Ao escrever um adaptador nativo, essa página define o lado de entrada da sua conversão; a documentação do seu provedor define o lado de saída.

## Escolha primeiro o caminho de implementação

### Caminho A — Provedor compatível com OpenAI

Use isso quando o provedor aceita requisições no estilo chat-completions padrão.

Trabalho típico:

- adicionar metadados de autenticação
- adicionar catálogo de modelos / aliases
- adicionar resolução de runtime
- conectar o menu do CLI
- adicionar padrões de modelo auxiliar
- adicionar testes e documentação de usuário

Você geralmente não precisa de um novo adaptador ou de um novo `api_mode`.

### Caminho B — Provedor nativo

Use isso quando o provedor não se comporta como o chat completions da OpenAI.

Exemplos já presentes no repositório:

- `codex_responses` (OpenAI Codex, xAI Grok, e Meta Muse Spark via `api.meta.ai` — este último envia automaticamente `prompt_cache_retention: 24h`)
- `anthropic_messages`

Este caminho inclui tudo do Caminho A, mais:

- um adaptador de provedor em `agent/`
- ramos em `run_agent.py` para construção de requisição, dispatch, extração de uso, tratamento de interrupção e normalização de resposta
- testes de adaptador

## Checklist de arquivos

### Obrigatório para todo provedor nativo

1. `work4you_cli/auth.py`
2. `work4you_cli/models.py`
3. `work4you_cli/runtime_provider.py`
4. `work4you_cli/main.py`
5. `agent/auxiliary_client.py`
6. `agent/model_metadata.py`
7. testes
8. documentação voltada ao usuário em `website/docs/`

:::tip
`work4you_cli/setup.py` **não** precisa de alterações. O assistente de configuração delega a seleção de provedor/modelo para `select_provider_and_model()` em `main.py` — qualquer provedor adicionado ali fica automaticamente disponível em `work4you setup`.
:::

### Adicional para provedores nativos / não-OpenAI

10. `agent/<provider>_adapter.py`
11. `run_agent.py`
12. `pyproject.toml` se um SDK de provedor for necessário

## Caminho rápido: Provedores simples com chave de API

Se seu provedor for apenas um endpoint compatível com OpenAI que autentica com uma única chave de API, você não precisa mexer em `auth.py`, `runtime_provider.py`, `main.py`, ou em nenhum dos outros arquivos do checklist completo abaixo.

Tudo o que você precisa é:

1. Um diretório de plugin em `plugins/model-providers/<your-provider>/` contendo:
   - `__init__.py` — chama `register_provider(profile)` no nível do módulo
   - `plugin.yaml` — manifesto (name, kind: model-provider, version, description)
2. Só isso. Plugins de provedor carregam automaticamente na primeira vez que algo chama `get_provider_profile()` ou `list_providers()` — tanto plugins empacotados (este repositório) quanto plugins de usuário em `$WORK4YOU_HOME/plugins/model-providers/` são detectados.

Quando você adiciona um plugin e ele chama `register_provider()`, o seguinte é conectado automaticamente:

1. Entrada em `PROVIDER_REGISTRY` em `auth.py` (resolução de credenciais, busca de variável de ambiente)
2. `api_mode` definido como `chat_completions`
3. `base_url` obtida da configuração ou da variável de ambiente declarada
4. `env_vars` verificadas em ordem de prioridade para a chave de API
5. Lista `fallback_models` registrada para o provedor
6. A flag `--provider` do CLI aceita o id do provedor
7. O menu `work4you model` inclui o provedor
8. O assistente `work4you setup` delega para `main.py` automaticamente
9. A sintaxe de alias `provider:model` funciona
10. O resolvedor de runtime retorna o `base_url` e `api_key` corretos
11. A flag `--provider <name>` do CLI aceita o id do provedor
12. A ativação de modelo de fallback consegue trocar para o provedor de forma limpa

Plugins de usuário em `$WORK4YOU_HOME/plugins/model-providers/<name>/` sobrescrevem plugins empacotados de mesmo nome (o último a escrever vence em `register_provider()`) — assim terceiros podem fazer monkey-patch ou substituir qualquer perfil nativo sem editar o repositório.

Veja `plugins/model-providers/nvidia/` ou `plugins/model-providers/gmi/` como modelo, e o guia completo de [Plugin de Provedor de Modelo](/developer-guide/model-provider-plugin) para referência de campos, idiomas de hook e exemplos de ponta a ponta.

## Caminho completo: OAuth e provedores complexos

Use o checklist completo abaixo quando seu provedor precisar de qualquer um dos seguintes:

- OAuth ou renovação de token (Work4You Portal, Codex, Qwen Portal, Copilot)
- Um formato de API não-OpenAI que exige um novo adaptador (Anthropic Messages, Codex Responses)
- Detecção de endpoint personalizada ou sondagem multi-região (z.ai, Kimi)
- Um catálogo de modelos estático selecionado ou busca ao vivo em `/models`
- Entradas de menu `work4you model` específicas do provedor com fluxos de autenticação sob medida

## Passo 1: Escolha um único id canônico de provedor

Escolha um único id de provedor e use-o em todo lugar.

Exemplos do repositório:

- `openai-codex`
- `kimi-coding`
- `minimax-cn`

Esse mesmo id deve aparecer em:

- `PROVIDER_REGISTRY` em `work4you_cli/auth.py`
- `_PROVIDER_LABELS` em `work4you_cli/models.py`
- `_PROVIDER_ALIASES` tanto em `work4you_cli/auth.py` quanto em `work4you_cli/models.py`
- opções `--provider` do CLI em `work4you_cli/main.py`
- ramos de setup / seleção de modelo
- padrões de modelo auxiliar
- testes

Se o id divergir entre esses arquivos, o provedor vai parecer parcialmente conectado: a autenticação pode funcionar enquanto `/model`, setup, ou a resolução de runtime silenciosamente o ignoram.

## Passo 2: Adicione metadados de autenticação em `work4you_cli/auth.py`

Para provedores com chave de API, adicione uma entrada `ProviderConfig` a `PROVIDER_REGISTRY` com:

- `id`
- `name`
- `auth_type="api_key"`
- `inference_base_url`
- `api_key_env_vars`
- opcionalmente `base_url_env_var`

Adicione também aliases a `_PROVIDER_ALIASES`.

Use os provedores existentes como modelos:

- caminho simples de chave de API: Z.AI, MiniMax
- caminho de chave de API com detecção de endpoint: Kimi, Z.AI
- resolução de token nativa: Anthropic
- caminho OAuth / auth-store: Work4You, OpenAI Codex

Perguntas a responder aqui:

- Quais variáveis de ambiente o Work4You deve verificar, e em que ordem de prioridade?
- O provedor precisa de sobrescritas de URL base?
- Ele precisa de sondagem de endpoint ou renovação de token?
- O que o erro de autenticação deve dizer quando as credenciais estão ausentes?

Se o provedor precisar de algo além de "buscar uma chave de API", adicione um resolvedor de credenciais dedicado em vez de colocar lógica em ramos não relacionados.

## Passo 3: Adicione catálogo de modelos e aliases em `work4you_cli/models.py`

Atualize o catálogo de provedores para que o provedor funcione nos menus e na sintaxe `provider:model`.

Edições típicas:

- `_PROVIDER_MODELS`
- `_PROVIDER_LABELS`
- `_PROVIDER_ALIASES`
- ordem de exibição de provedor dentro de `list_available_providers()`
- `provider_model_ids()` se o provedor suportar busca ao vivo em `/models`

Se o provedor expõe uma lista de modelos ao vivo, prefira usá-la primeiro e mantenha `_PROVIDER_MODELS` como fallback estático.

Este arquivo também é o que faz entradas como estas funcionarem:

```text
anthropic:claude-sonnet-4-6
kimi:model-name
```

Se os aliases estiverem faltando aqui, o provedor pode autenticar corretamente mas ainda assim falhar no parsing de `/model`.

## Passo 4: Resolva os dados de runtime em `work4you_cli/runtime_provider.py`

`resolve_runtime_provider()` é o caminho compartilhado usado por CLI, gateway, cron, ACP e clientes auxiliares.

Adicione um ramo que retorna um dicionário com pelo menos:

```python
{
    "provider": "your-provider",
    "api_mode": "chat_completions",  # or your native mode
    "base_url": "https://...",
    "api_key": "...",
    "source": "env|portal|auth-store|explicit",
    "requested_provider": requested_provider,
}
```

Se o provedor for compatível com OpenAI, `api_mode` geralmente deve permanecer `chat_completions`.

Tenha cuidado com a precedência de chave de API. O Work4You já contém lógica para evitar vazar uma chave do OpenRouter para endpoints não relacionados. Um novo provedor deve ser igualmente explícito sobre qual chave vai para qual URL base.

## Passo 5: Conecte o CLI em `work4you_cli/main.py`

Um provedor não é descoberto até aparecer no fluxo interativo `work4you model`.

Atualize o seguinte em `work4you_cli/main.py`:

- dicionário `provider_labels`
- lista `providers` em `select_provider_and_model()`
- dispatch de provedor (`if selected_provider == ...`)
- opções do argumento `--provider`
- opções de login/logout, se o provedor suportar esses fluxos
- uma função `_model_flow_<provider>()`, ou reutilize `_model_flow_api_key_provider()` se for aplicável

:::tip
`work4you_cli/setup.py` não precisa de alterações — ele chama `select_provider_and_model()` de `main.py`, então seu novo provedor aparece automaticamente tanto em `work4you model` quanto em `work4you setup`.
:::

## Passo 6: Mantenha as chamadas auxiliares funcionando

Dois arquivos importam aqui:

### `agent/auxiliary_client.py`

Adicione um modelo auxiliar barato/rápido padrão a `_API_KEY_PROVIDER_AUX_MODELS` se este for um provedor direto com chave de API.

Tarefas auxiliares incluem coisas como:

- resumo de visão (vision summarization)
- resumo de extração web
- resumos de compressão de contexto
- resumos de busca em sessão
- descargas de memória (memory flushes)

Se o provedor não tiver um padrão auxiliar sensato, tarefas laterais podem recorrer mal ou usar um modelo principal caro inesperadamente.

### `agent/model_metadata.py`

Adicione os comprimentos de contexto dos modelos do provedor para que o orçamento de tokens, os limiares de compressão e os limites continuem coerentes.

## Passo 7: Se o provedor for nativo, adicione um adaptador e suporte em `run_agent.py`

Se o provedor não for chat completions simples, isole a lógica específica do provedor em `agent/<provider>_adapter.py`.

Mantenha `run_agent.py` focado em orquestração. Ele deve chamar helpers do adaptador, não construir manualmente payloads de provedor inline espalhados pelo arquivo.

Um provedor nativo geralmente precisa de trabalho nestes lugares:

### Novo arquivo de adaptador

Responsabilidades típicas:

- construir o cliente SDK / HTTP
- resolver tokens
- converter mensagens de conversa no estilo OpenAI para o formato de requisição do provedor
- converter schemas de ferramenta se necessário
- normalizar respostas do provedor de volta ao formato que `run_agent.py` espera
- extrair dados de uso e motivo de finalização (finish-reason)

### `run_agent.py`

Pesquise por `api_mode` e audite cada ponto de decisão (switch point). No mínimo, verifique:

- `__init__` escolhe o novo `api_mode`
- a construção do cliente funciona para o provedor
- `_build_api_kwargs()` sabe como formatar as requisições
- `_interruptible_api_call()` despacha para a chamada de cliente correta
- os caminhos de interrupção / reconstrução de cliente funcionam
- a validação de resposta aceita o formato do provedor
- a extração de finish-reason está correta
- a extração de uso de tokens está correta
- a ativação de modelo de fallback consegue trocar para o novo provedor de forma limpa
- os caminhos de geração de resumo e descarga de memória continuam funcionando

Pesquise também em `run_agent.py` por `self.client.`. Qualquer caminho de código que assume que o cliente OpenAI padrão existe pode quebrar quando um provedor nativo usa um objeto de cliente diferente ou `self.client = None`.

### Cache de prompt e campos de requisição específicos de provedor

Cache de prompt e ajustes específicos de provedor são fáceis de regredir.

Exemplos já presentes no repositório:

- Anthropic tem um caminho nativo de cache de prompt
- OpenRouter recebe campos de roteamento de provedor
- nem todo provedor deve receber toda opção do lado da requisição

Ao adicionar um provedor nativo, verifique novamente se o Work4You está enviando apenas os campos que aquele provedor de fato entende.

## Passo 8: Testes

No mínimo, toque nos testes que protegem a conexão do provedor.

Locais comuns:

- `tests/work4you_cli/test_runtime_provider_resolution.py`
- `tests/cli/test_cli_provider_resolution.py`
- `tests/work4you_cli/test_model_switch_custom_providers.py` (e os `tests/work4you_cli/test_model_switch_*.py` adjacentes)
- `tests/work4you_cli/test_setup_model_provider.py`
- `tests/run_agent/test_provider_parity.py`
- `tests/run_agent/test_run_agent.py`
- `tests/test_<provider>_adapter.py` para um provedor nativo

Para exemplos apenas de documentação, o conjunto exato de arquivos pode variar. O ponto é cobrir:

- resolução de autenticação
- menu do CLI / seleção de provedor
- resolução de provedor em runtime
- caminho de execução do agente
- parsing de provider:model
- qualquer conversão de mensagem específica do adaptador

Execute os testes direcionados (ou use `scripts/run_tests.sh`, que roda cada arquivo em seu próprio subprocesso):

```bash
source venv/bin/activate
python -m pytest tests/work4you_cli/test_runtime_provider_resolution.py tests/cli/test_cli_provider_resolution.py tests/work4you_cli/test_setup_model_provider.py tests/run_agent/test_provider_parity.py -q
```

Para mudanças mais profundas, execute a suíte completa antes de fazer push:

```bash
source venv/bin/activate
python -m pytest tests/ -n0 -q
```

## Passo 9: Verificação ao vivo

Depois dos testes, execute um teste de fumaça (smoke test) real.

```bash
source venv/bin/activate
python -m work4you_cli.main chat -q "Say hello" --provider your-provider --model your-model
```

Teste também os fluxos interativos se você alterou menus:

```bash
source venv/bin/activate
python -m work4you_cli.main model
python -m work4you_cli.main setup
```

Para provedores nativos, verifique também pelo menos uma chamada de ferramenta, não apenas uma resposta em texto simples.

## Passo 10: Atualize a documentação voltada ao usuário

Se o provedor for lançado como opção de primeira classe, atualize também a documentação de usuário:

- `website/docs/getting-started/quickstart.md`
- `website/docs/user-guide/configuration.md`
- `website/docs/reference/environment-variables.md`

Um desenvolvedor pode conectar o provedor perfeitamente e ainda assim deixar os usuários incapazes de descobrir as variáveis de ambiente necessárias ou o fluxo de configuração.

## Checklist de provedor compatível com OpenAI

Use isto se o provedor for chat completions padrão.

- [ ] `ProviderConfig` adicionado em `work4you_cli/auth.py`
- [ ] aliases adicionados em `work4you_cli/auth.py` e `work4you_cli/models.py`
- [ ] catálogo de modelos adicionado em `work4you_cli/models.py`
- [ ] ramo de runtime adicionado em `work4you_cli/runtime_provider.py`
- [ ] conexão do CLI adicionada em `work4you_cli/main.py` (setup.py herda automaticamente)
- [ ] modelo auxiliar adicionado em `agent/auxiliary_client.py`
- [ ] comprimentos de contexto adicionados em `agent/model_metadata.py`
- [ ] testes de runtime / CLI atualizados
- [ ] documentação de usuário atualizada

## Checklist de provedor nativo

Use isto quando o provedor precisar de um novo caminho de protocolo.

- [ ] tudo do checklist compatível com OpenAI
- [ ] adaptador adicionado em `agent/<provider>_adapter.py`
- [ ] novo `api_mode` suportado em `run_agent.py`
- [ ] caminho de interrupção / reconstrução funciona
- [ ] extração de uso e finish-reason funciona
- [ ] caminho de fallback funciona
- [ ] testes de adaptador adicionados
- [ ] teste de fumaça ao vivo passa

## Armadilhas comuns

### 1. Adicionar o provedor à autenticação mas não ao parsing de modelo

Isso faz as credenciais resolverem corretamente enquanto as entradas `/model` e `provider:model` falham.

### 2. Esquecer que `config["model"]` pode ser uma string ou um dicionário

Muito código de seleção de provedor precisa normalizar ambas as formas.

### 3. Assumir que um provedor nativo é necessário

Se o serviço for apenas compatível com OpenAI, um provedor personalizado já pode resolver o problema do usuário com menos manutenção.

### 4. Esquecer os caminhos auxiliares

O caminho principal de chat pode funcionar enquanto resumo, descargas de memória ou helpers de visão falham porque o roteamento auxiliar nunca foi atualizado.

### 5. Ramos de provedor nativo escondidos em `run_agent.py`

Pesquise por `api_mode` e `self.client.`. Não assuma que o caminho de requisição óbvio é o único.

### 6. Enviar ajustes exclusivos do OpenRouter para outros provedores

Campos como roteamento de provedor pertencem apenas aos provedores que os suportam.

### 7. Atualizar `work4you model` mas não `work4you setup`

Ambos os fluxos precisam conhecer o provedor.

## Bons alvos de busca durante a implementação

Se você está procurando todos os lugares que um provedor toca, pesquise estes símbolos:

- `PROVIDER_REGISTRY`
- `_PROVIDER_ALIASES`
- `_PROVIDER_MODELS`
- `resolve_runtime_provider`
- `_model_flow_`
- `select_provider_and_model`
- `api_mode`
- `_API_KEY_PROVIDER_AUX_MODELS`
- `self.client.`

## Documentos relacionados

- [Resolução de Runtime de Provedor](./provider-runtime.md)
- [Arquitetura](./architecture.md)
- [Contribuindo](./contributing.md)
