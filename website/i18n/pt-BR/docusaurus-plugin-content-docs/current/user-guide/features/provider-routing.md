---
title: Provider Routing
description: Configure OpenRouter or Work4You Portal provider preferences to optimize for cost, speed, or quality.
sidebar_label: Provider Routing
sidebar_position: 7
---

# Provider Routing

Ao usar o [OpenRouter](https://openrouter.ai) ou o [Work4You Portal](/integrations/work4you-portal) como seu provedor de LLM, o Work4You oferece suporte a **provider routing** — controle refinado sobre quais provedores de IA subjacentes atendem suas requisições e como eles são priorizados.

O OpenRouter encaminha requisições para vários provedores (por exemplo, Anthropic, Google, AWS Bedrock, Together AI). O provider routing permite otimizar para custo, velocidade, qualidade ou impor requisitos específicos de provedor.

:::tip
O tráfego roteado pelo Work4You Portal respeita as mesmas preferências de provedor — e assinantes do Portal recebem 10% de desconto em provedores cobrados por token.
:::

## Configuração

Adicione uma seção `provider_routing` ao seu `~/.work4you/config.yaml`:

```yaml
provider_routing:
  sort: "price"           # How to rank providers
  only: []                # Whitelist: only use these providers
  ignore: []               # Blacklist: never use these providers
  order: []                # Explicit provider priority order
  require_parameters: false  # Only use providers that support all parameters
  data_collection: null    # Control data collection ("allow" or "deny")
```

:::info
O provider routing só se aplica ao usar o OpenRouter ou o Work4You Portal. Ele não tem efeito com conexões diretas a provedores (por exemplo, conectando-se diretamente à API da Anthropic).
:::

## Opções

### `sort`

Controla como o OpenRouter classifica os provedores disponíveis para sua requisição.

| Valor | Descrição |
|-------|-------------|
| `"price"` | Provedor mais barato primeiro |
| `"throughput"` | Maior taxa de tokens por segundo primeiro |
| `"latency"` | Menor tempo até o primeiro token primeiro |

```yaml
provider_routing:
  sort: "price"
```

### `only`

Lista de permissão (whitelist) de slugs de provedores. Quando definida, **somente** esses provedores serão usados. Todos os demais são excluídos. Use o slug em minúsculas exibido pelo OpenRouter para cada provedor.

```yaml
provider_routing:
  only:
    - "anthropic"
    - "google"
```

### `ignore`

Lista de bloqueio (blacklist) de nomes de provedores. Esses provedores **nunca** serão usados, mesmo que ofereçam a opção mais barata ou mais rápida.

```yaml
provider_routing:
  ignore:
    - "together"
    - "deepinfra"
```

### `order`

Ordem explícita de prioridade. Os provedores listados primeiro são preferidos. Provedores não listados são usados como alternativa (fallback).

```yaml
provider_routing:
  order:
    - "anthropic"
    - "google"
    - "amazon-bedrock"
```

### `require_parameters`

Quando `true`, o OpenRouter encaminhará requisições apenas para provedores que oferecem suporte a **todos** os parâmetros da sua requisição (como `temperature`, `top_p`, `tools`, etc.). Isso evita a queda silenciosa de parâmetros.

```yaml
provider_routing:
  require_parameters: true
```

### `data_collection`

Controla se os provedores podem usar seus prompts para treinamento. As opções são `"allow"` ou `"deny"`.

```yaml
provider_routing:
  data_collection: "deny"
```

## Exemplos práticos

### Otimizar para custo

Encaminha para o provedor disponível mais barato. Bom para uso de alto volume e desenvolvimento:

```yaml
provider_routing:
  sort: "price"
```

### Otimizar para velocidade

Prioriza provedores de baixa latência para uso interativo:

```yaml
provider_routing:
  sort: "latency"
```

### Otimizar para throughput

Melhor para geração de textos longos, onde a taxa de tokens por segundo é o que importa:

```yaml
provider_routing:
  sort: "throughput"
```

### Restringir a provedores específicos

Garante que todas as requisições passem por um provedor específico, para manter a consistência:

```yaml
provider_routing:
  only:
    - "anthropic"
```

### Evitar provedores específicos

Exclui provedores que você não quer usar (por exemplo, por privacidade de dados):

```yaml
provider_routing:
  ignore:
    - "together"
    - "lepton"
  data_collection: "deny"
```

### Ordem preferida com fallbacks

Tenta seus provedores preferidos primeiro, recorrendo a outros se indisponíveis:

```yaml
provider_routing:
  order:
    - "anthropic"
    - "google"
  require_parameters: true
```

## Como funciona

As preferências de provider routing são passadas ao OpenRouter ou ao Work4You Portal nas requisições de chat do agente e nos resumos de limite de iteração, por meio do campo `extra_body.provider`. (`extra_body` é o argumento do OpenAI Python SDK; ele se torna o objeto `provider` no nível superior da requisição JSON.) Tarefas auxiliares como compressão e geração de título são configuradas de forma independente em `auxiliary.<task>.extra_body`.

- **Modo CLI** — configurado em `~/.work4you/config.yaml`, carregado na inicialização
- **Modo Gateway** — mesmo arquivo de configuração, carregado quando o gateway inicia

A configuração de roteamento é lida do `config.yaml` e passada como parâmetros ao criar o `AIAgent`:

```
providers_allowed  ← from provider_routing.only
providers_ignored  ← from provider_routing.ignore
providers_order    ← from provider_routing.order
provider_sort      ← from provider_routing.sort
provider_require_parameters ← from provider_routing.require_parameters
provider_data_collection    ← from provider_routing.data_collection
```

:::tip
Você pode combinar várias opções. Por exemplo, ordenar por preço, mas excluir determinados provedores e exigir suporte a parâmetros:

```yaml
provider_routing:
  sort: "price"
  ignore: ["together"]
  require_parameters: true
  data_collection: "deny"
```
:::

## Comportamento padrão

Quando nenhuma seção `provider_routing` está configurada (o padrão), o agregador usa sua própria lógica de roteamento padrão, que geralmente equilibra custo e disponibilidade automaticamente.

:::tip Provider Routing vs. Fallback Models
O provider routing controla quais **sub-provedores por trás do OpenRouter ou do Work4You Portal** atendem suas requisições. Para failover automático a um provedor inteiramente diferente quando seu modelo principal falha, veja [Fallback Providers](/user-guide/features/fallback-providers).
:::
