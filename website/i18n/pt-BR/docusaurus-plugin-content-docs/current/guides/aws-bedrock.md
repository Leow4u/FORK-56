---
sidebar_position: 14
title: "AWS Bedrock"
description: "Use o Work4You com Amazon Bedrock — Converse API nativa, autenticação IAM, Guardrails e inferência entre regiões"
---

# AWS Bedrock

O Work4You suporta o Amazon Bedrock como provedor nativo usando a **Converse API** — não o endpoint compatível com OpenAI. Isso dá acesso total ao ecossistema Bedrock: autenticação IAM, Guardrails, perfis de inferência entre regiões e todos os modelos de fundação.

## Pré-requisitos

- **Credenciais AWS** — qualquer origem suportada pela [cadeia de credenciais do boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html):
  - Role de instância IAM (EC2, ECS, Lambda — sem configuração)
  - Variáveis de ambiente `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
  - `AWS_PROFILE` para SSO ou perfis nomeados
  - `aws configure` para desenvolvimento local
- **boto3** — instale com `cd ~/.work4you/work4you && uv pip install -e ".[bedrock]"`
- **Permissões IAM** — no mínimo:
  - `bedrock:InvokeModel` e `bedrock:InvokeModelWithResponseStream` (para inferência)
  - `bedrock:ListFoundationModels` e `bedrock:ListInferenceProfiles` (para descoberta de modelos)

:::tip EC2 / ECS / Lambda
Em computação AWS, anexe uma role IAM com `AmazonBedrockFullAccess` e pronto. Sem chaves de API, sem configuração `.env` — o Work4You detecta a role da instância automaticamente.
:::

## Início Rápido

```bash
# Instala com suporte a Bedrock
cd ~/.work4you/work4you && uv pip install -e ".[bedrock]"

# Selecione o Bedrock como seu provedor
work4you model
# → Escolha "More providers..." → "AWS Bedrock"
# → Selecione sua região e modelo

# Comece a conversar
work4you chat
```

## Configuração

Depois de rodar `work4you model`, seu `~/.work4you/config.yaml` conterá:

```yaml
model:
  default: us.anthropic.claude-sonnet-4-6
  provider: bedrock
  base_url: https://bedrock-runtime.us-east-2.amazonaws.com

bedrock:
  region: us-east-2
```

### Região

Defina a região AWS de qualquer uma destas formas (prioridade mais alta primeiro):

1. `bedrock.region` no `config.yaml`
2. Variável de ambiente `AWS_REGION`
3. Variável de ambiente `AWS_DEFAULT_REGION`
4. Padrão: `us-east-1`

### Guardrails

Para aplicar [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html) a todas as invocações de modelo:

```yaml
bedrock:
  region: us-east-2
  guardrail:
    guardrail_identifier: "abc123def456"  # Do console do Bedrock
    guardrail_version: "1"                # Número de versão ou "DRAFT"
    stream_processing_mode: "async"       # "sync" ou "async"
    trace: "disabled"                     # "enabled", "disabled" ou "enabled_full"
```

### Descoberta de Modelos

O Work4You descobre automaticamente os modelos disponíveis via o plano de controle do Bedrock. Você pode personalizar a descoberta:

```yaml
bedrock:
  discovery:
    enabled: true
    provider_filter: ["anthropic", "amazon"]  # Mostra apenas esses provedores
    refresh_interval: 3600                     # Cache por 1 hora
```

### Cache de prompt (cachePoint)

O Work4You aplica automaticamente cache de prompt no caminho da **Converse API** do Bedrock, inserindo marcadores `cachePoint` após o prompt de sistema, as definições de ferramentas e a mensagem mais recente. Como enviar um bloco `cachePoint` para um modelo que não o suporta gera uma `ValidationException`, os marcadores só são adicionados para modelos em uma lista de permissões conhecida (IDs de modelo Anthropic Claude e Amazon Nova); modelos desconhecidos não recebem marcadores de cache por padrão. Modelos Claude normalmente usam o caminho do SDK AnthropicBedrock, que tem seu próprio cache de prompt — o caminho `cachePoint` da Converse cobre o Nova e o fallback de Claude com token de portador. Não é necessária configuração; leituras/gravações de cache aparecem na contabilidade de uso.

### Sondagem de janela de contexto

Para modelos cuja janela de contexto não está na tabela estática do Work4You, o Work4You pode sondar o limite real enviando requisições grandes em faixas fixas (~1,3M e ~2,2M tokens) e analisando o valor `maximum` relatado no erro de validação de tamanho do Bedrock. Os valores sondados alimentam o mesmo cache de metadados da tabela estática; entradas em cache desatualizadas que subestimam a janela de um modelo (por exemplo, entradas criadas antes da disponibilidade geral da janela de 1M de um modelo) são descartadas automaticamente em favor do valor maior conhecido.

## Modelos Disponíveis

Modelos Bedrock usam **IDs de perfil de inferência** para invocação sob demanda. O seletor `work4you model` mostra isso automaticamente, com os modelos recomendados no topo:

| Modelo | ID | Notas |
|-------|-----|-------|
| Claude Sonnet 4.6 | `us.anthropic.claude-sonnet-4-6` | Recomendado — melhor equilíbrio entre velocidade e capacidade |
| Claude Opus 4.6 | `us.anthropic.claude-opus-4-6-v1` | O mais capaz |
| Claude Haiku 4.5 | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | O Claude mais rápido |
| Amazon Nova Pro | `us.amazon.nova-pro-v1:0` | O carro-chefe da Amazon |
| Amazon Nova Micro | `us.amazon.nova-micro-v1:0` | O mais rápido e barato |
| DeepSeek V3.2 | `deepseek.v3.2` | Modelo aberto robusto |
| Llama 4 Scout 17B | `us.meta.llama4-scout-17b-instruct-v1:0` | O mais recente da Meta |

:::info Inferência entre regiões
Modelos com o prefixo `us.` usam perfis de inferência entre regiões, que oferecem melhor capacidade e failover automático entre regiões da AWS. Modelos com o prefixo `global.` roteiam entre todas as regiões disponíveis no mundo.
:::

## Trocando de Modelo no Meio da Sessão

Use o comando `/model` durante uma conversa:

```
/model us.amazon.nova-pro-v1:0
/model deepseek.v3.2
/model us.anthropic.claude-opus-4-6-v1
```

## Diagnósticos

```bash
work4you doctor
```

O doctor verifica:
- Se as credenciais AWS estão disponíveis (variáveis de ambiente, role IAM, SSO)
- Se o `boto3` está instalado
- Se a API do Bedrock está acessível (ListFoundationModels)
- O número de modelos disponíveis na sua região

## Gateway (Plataformas de Mensagens)

O Bedrock funciona com todas as plataformas de gateway do Work4You (Telegram, Discord, Slack, Feishu, etc.). Configure o Bedrock como seu provedor e depois inicie o gateway normalmente:

```bash
work4you gateway setup
work4you gateway start
```

O gateway lê o `config.yaml` e usa a mesma configuração de provedor Bedrock.

## Solução de Problemas

### "No API key found" / "No AWS credentials"

O Work4You verifica credenciais nesta ordem:
1. `AWS_BEARER_TOKEN_BEDROCK`
2. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
3. `AWS_PROFILE`
4. Metadados da instância EC2 (IMDS)
5. Credenciais de contêiner ECS
6. Role de execução Lambda

Se nenhuma for encontrada, execute `aws configure` ou anexe uma role IAM à sua instância de computação.

### "Invocation of model ID ... with on-demand throughput isn't supported"

Use um **ID de perfil de inferência** (com prefixo `us.` ou `global.`) em vez do ID de modelo de fundação puro. Por exemplo:
- ❌ `anthropic.claude-sonnet-4-6`
- ✅ `us.anthropic.claude-sonnet-4-6`

### "ThrottlingException"

Você atingiu o limite de taxa por modelo do Bedrock. O Work4You tenta novamente automaticamente com backoff. Para aumentar os limites, solicite um aumento de cota no [console de Cotas de Serviço da AWS](https://console.aws.amazon.com/servicequotas/).

## Implantação na AWS em Um Clique

Para uma implantação totalmente automatizada em EC2 com CloudFormation:

**[sample-work4you-on-aws-with-bedrock](https://github.com/JiaDe-Wu/sample-work4you-on-aws-with-bedrock)** — cria VPC, role IAM, instância EC2 e configura o Bedrock automaticamente. Implante em qualquer região com um clique.
