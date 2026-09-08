---
sidebar_position: 12
title: "Processamento em Lote"
description: "Gere trajetórias de agente em escala — processamento paralelo, checkpointing e distribuições de toolset"
---

# Processamento em Lote

O processamento em lote permite executar o agente Work4You em centenas ou milhares de prompts em paralelo, gerando dados de trajetória estruturados. Isso é usado principalmente para **geração de dados de treinamento** — produzindo trajetórias em formato ShareGPT com estatísticas de uso de ferramentas que podem ser usadas para fine-tuning ou avaliação.

## Visão geral

O executor de lote (`batch_runner.py`) processa um dataset JSONL de prompts, executando cada um através de uma sessão completa de agente com acesso a ferramentas. Cada prompt recebe seu próprio ambiente isolado. A saída é dados de trajetória estruturados com histórico de conversa completo, estatísticas de chamadas de ferramenta e métricas de cobertura de raciocínio.

## Início rápido

```bash
# Execução básica em lote
python batch_runner.py \
    --dataset_file=data/prompts.jsonl \
    --batch_size=10 \
    --run_name=my_first_run \
    --model=anthropic/claude-sonnet-4.6 \
    --num_workers=4

# Retomar uma execução interrompida
python batch_runner.py \
    --dataset_file=data/prompts.jsonl \
    --batch_size=10 \
    --run_name=my_first_run \
    --resume

# Listar distribuições de toolset disponíveis
python batch_runner.py --list_distributions
```

:::tip Custo previsível em escala
Execuções em lote criam muitas sessões de agente concorrentes, cada uma fazendo chamadas de modelo e chamadas de ferramenta. Uma assinatura do [Work4You Portal](/user-guide/features/tool-gateway) reúne acesso a modelos além de busca web, geração de imagem, TTS e browsers em nuvem sob uma única fatura — útil quando você quer um custo por trajetória estável sem ter que lidar com limites de taxa de cinco contas de fornecedores diferentes. Configure com `work4you setup --portal`, depois aponte `--model` para um modelo Work4You.
:::

## Formato do dataset

O dataset de entrada é um arquivo JSONL (um objeto JSON por linha). Cada entrada precisa ter um campo `prompt`:

```jsonl
{"prompt": "Write a Python function that finds the longest palindromic substring"}
{"prompt": "Create a REST API endpoint for user authentication using Flask"}
{"prompt": "Debug this error: TypeError: cannot unpack non-iterable NoneType object"}
```

As entradas podem opcionalmente incluir:
- `image` ou `docker_image`: uma imagem de contêiner a usar para o sandbox desse prompt (funciona com os backends Docker, Modal e Singularity)
- `cwd`: override do diretório de trabalho para a sessão de terminal da tarefa

## Opções de configuração

| Parâmetro | Padrão | Descrição |
|-----------|---------|-------------|
| `--dataset_file` | (obrigatório) | Caminho para o dataset JSONL |
| `--batch_size` | (obrigatório) | Prompts por lote |
| `--run_name` | (obrigatório) | Nome desta execução (usado para o diretório de saída e checkpointing) |
| `--distribution` | `"default"` | Distribuição de toolset a partir da qual amostrar |
| `--model` | `claude-sonnet-4.6` | Modelo a usar |
| `--base_url` | `https://openrouter.ai/api/v1` | URL base da API |
| `--api_key` | (variável de ambiente) | Chave de API para o modelo |
| `--max_turns` | `10` | Máximo de iterações de chamada de ferramenta por prompt |
| `--num_workers` | `4` | Processos worker paralelos |
| `--resume` | `false` | Retoma a partir do checkpoint |
| `--verbose` | `false` | Ativa log detalhado |
| `--max_samples` | todos | Processa apenas as primeiras N amostras do dataset |
| `--max_tokens` | padrão do modelo | Máximo de tokens por resposta do modelo |

### Roteamento de provedor (OpenRouter)

| Parâmetro | Descrição |
|-----------|-------------|
| `--providers_allowed` | Provedores permitidos, separados por vírgula (ex.: `"anthropic,openai"`) |
| `--providers_ignored` | Provedores a ignorar, separados por vírgula (ex.: `"together,deepinfra"`) |
| `--providers_order` | Ordem de provedor preferida, separada por vírgula |
| `--provider_sort` | Ordenar por `"price"`, `"throughput"`, ou `"latency"` |

### Controle de raciocínio

| Parâmetro | Descrição |
|-----------|-------------|
| `--reasoning_effort` | Esforço de raciocínio: `none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| `--reasoning_disabled` | Desativa completamente tokens de raciocínio/pensamento |

### Opções avançadas

| Parâmetro | Descrição |
|-----------|-------------|
| `--ephemeral_system_prompt` | System prompt usado durante a execução, mas NÃO salvo nas trajetórias |
| `--log_prefix_chars` | Caracteres a mostrar nas prévias de log (padrão: 100) |
| `--prefill_messages_file` | Caminho para arquivo JSON com mensagens de prefill para priming few-shot |

## Distribuições de toolset

Cada prompt recebe um conjunto de toolsets amostrado aleatoriamente a partir de uma **distribuição**. Isso garante que os dados de treinamento cubram combinações diversas de ferramentas. Use `--list_distributions` para ver todas as distribuições disponíveis.

Na implementação atual, as distribuições atribuem uma probabilidade a **cada toolset individual**. O amostrador decide cada toolset independentemente, e depois garante que pelo menos um toolset esteja ativado. Isso é diferente de uma tabela feita à mão com combinações predefinidas.

## Formato de saída

Toda a saída vai para `data/<run_name>/`:

```text
data/my_run/
├── trajectories.jsonl    # Saída final combinada (todos os lotes mesclados)
├── batch_0.jsonl         # Resultados de lote individuais
├── batch_1.jsonl
├── ...
├── checkpoint.json       # Checkpoint de retomada
└── statistics.json       # Estatísticas agregadas de uso de ferramentas
```

### Formato de trajetória

Cada linha em `trajectories.jsonl` é um objeto JSON:

```json
{
  "prompt_index": 42,
  "conversations": [
    {"from": "human", "value": "Write a function..."},
    {"from": "gpt", "value": "I'll create that function...",
     "tool_calls": [...]},
    {"from": "tool", "value": "..."},
    {"from": "gpt", "value": "Here's the completed function..."}
  ],
  "metadata": {
    "batch_num": 2,
    "timestamp": "2026-01-15T10:30:00",
    "model": "anthropic/claude-sonnet-4.6"
  },
  "completed": true,
  "partial": false,
  "api_calls": 3,
  "toolsets_used": ["terminal", "file"],
  "tool_stats": {
    "terminal": {"count": 2, "success": 2, "failure": 0},
    "read_file": {"count": 1, "success": 1, "failure": 0}
  },
  "tool_error_counts": {
    "terminal": 0,
    "read_file": 0
  }
}
```

O campo `conversations` usa um formato similar ao ShareGPT com os campos `from` e `value`. As estatísticas de ferramenta são normalizadas para incluir todas as ferramentas possíveis com valores padrão zero, garantindo um schema consistente entre entradas para compatibilidade com datasets do HuggingFace.

## Checkpointing

O executor de lote tem checkpointing robusto para tolerância a falhas:

- **Arquivo de checkpoint:** salvo após cada lote ser concluído, rastreando quais índices de prompt estão prontos
- **Retomada baseada em conteúdo:** com `--resume`, o executor varre os arquivos de lote existentes e casa os prompts concluídos pelo conteúdo real do texto (não apenas pelos índices), permitindo recuperação mesmo se a ordem do dataset mudar
- **Prompts com falha:** apenas prompts concluídos com sucesso são marcados como prontos — prompts com falha serão retentados na retomada
- **Mesclagem de lotes:** ao concluir, todos os arquivos de lote (incluindo de execuções anteriores) são mesclados em um único `trajectories.jsonl`

### Como funciona a retomada

1. Varre todos os arquivos `batch_*.jsonl` em busca de prompts concluídos (por correspondência de conteúdo)
2. Filtra o dataset para excluir prompts já concluídos
3. Reagrupa os prompts restantes em lotes
4. Processa apenas os prompts restantes
5. Mescla todos os arquivos de lote (antigos + novos) na saída final

## Filtragem de qualidade

O executor de lote aplica filtragem automática de qualidade:

- **Filtro sem raciocínio:** amostras em que zero turnos do assistente contêm raciocínio (sem `<REASONING_SCRATCHPAD>` ou tokens de pensamento nativos) são descartadas
- **Filtro de entradas corrompidas:** entradas com nomes de ferramenta alucinados (que não estão na lista de ferramentas válidas) são filtradas durante a mesclagem final
- **Estatísticas de raciocínio:** rastreia a porcentagem de turnos com/sem raciocínio ao longo de toda a execução

## Estatísticas

Após a conclusão, o executor imprime estatísticas abrangentes:

- **Uso de ferramentas:** contagens de chamadas, taxas de sucesso/falha por ferramenta
- **Cobertura de raciocínio:** porcentagem de turnos do assistente com raciocínio
- **Amostras descartadas:** contagem de amostras filtradas por falta de raciocínio
- **Duração:** tempo total de processamento

As estatísticas também são salvas em `statistics.json` para análise programática.

## Casos de uso

### Geração de dados de treinamento

Gere trajetórias diversas de uso de ferramentas para fine-tuning:

```bash
python batch_runner.py \
    --dataset_file=data/coding_prompts.jsonl \
    --batch_size=20 \
    --run_name=coding_v1 \
    --model=anthropic/claude-sonnet-4.6 \
    --num_workers=8 \
    --distribution=default \
    --max_turns=15
```

### Avaliação de modelo

Avalie o quão bem um modelo usa ferramentas em prompts padronizados:

```bash
python batch_runner.py \
    --dataset_file=data/eval_suite.jsonl \
    --batch_size=10 \
    --run_name=eval_gpt4 \
    --model=openai/gpt-4o \
    --num_workers=4 \
    --max_turns=10
```

### Imagens de contêiner por prompt

Para benchmarks que exigem ambientes específicos, cada prompt pode especificar sua própria imagem de contêiner:

```jsonl
{"prompt": "Install numpy and compute eigenvalues of a 3x3 matrix", "image": "python:3.11-slim"}
{"prompt": "Compile this Rust program and run it", "image": "rust:1.75"}
{"prompt": "Set up a Node.js Express server", "image": "node:20-alpine", "cwd": "/app"}
```

O executor de lote verifica se as imagens Docker estão acessíveis antes de rodar cada prompt.
