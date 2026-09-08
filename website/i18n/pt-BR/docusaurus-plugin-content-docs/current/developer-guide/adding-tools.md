---
sidebar_position: 2
title: "Adding Tools"
description: "How to add a new tool to Work4You — schemas, handlers, registration, and toolsets"
---

# Adicionando Ferramentas

Antes de escrever uma ferramenta, pergunte-se: **isso deveria ser uma [skill](creating-skills.md)?**

:::warning Apenas Ferramentas Nativas do Núcleo
Esta página é para adicionar uma **ferramenta nativa do Work4You** ao próprio repositório.
Se você quer uma ferramenta pessoal, local ao projeto, ou de outra forma customizada sem
modificar o núcleo do Work4You, use a rota de plugin:

- [Plugins](/user-guide/features/plugins)
- [Build a Work4You Plugin](/developer-guide/plugins)

Use plugins como padrão para a maioria das criações de ferramentas customizadas. Siga esta página apenas quando
você explicitamente quiser lançar uma nova ferramenta nativa em `tools/` e `toolsets.py`.
:::

Faça disso uma **Skill** quando a capacidade puder ser expressa como instruções + comandos de shell + ferramentas existentes (busca no arXiv, fluxos de trabalho do git, gerenciamento do Docker, processamento de PDF).

Faça disso uma **Tool** quando exigir integração completa com chaves de API, lógica de processamento customizada, manipulação de dados binários ou streaming (automação de navegador, TTS, análise de visão).

## Visão geral

Adicionar uma ferramenta toca **2 arquivos**:

1. **`tools/your_tool.py`** — handler, schema, função de checagem, chamada `registry.register()`
2. **`toolsets.py`** — adicionar o nome da ferramenta a `_WORK4YOU_CORE_TOOLS` (ou a um toolset específico)

Qualquer arquivo `tools/*.py` com uma chamada `registry.register()` de nível superior é descoberto automaticamente na inicialização — nenhuma lista de importação manual é necessária.

## Passo 1: Criar o Arquivo da Ferramenta Nativa

Todo arquivo de ferramenta segue a mesma estrutura:

```python
# tools/weather_tool.py
"""Weather Tool -- look up current weather for a location."""

import json
import os
import logging

logger = logging.getLogger(__name__)


# --- Availability check ---

def check_weather_requirements() -> bool:
    """Return True if the tool's dependencies are available."""
    return bool(os.getenv("WEATHER_API_KEY"))


# --- Handler ---

def weather_tool(location: str, units: str = "metric") -> str:
    """Fetch weather for a location. Returns JSON string."""
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key:
        return json.dumps({"error": "WEATHER_API_KEY not configured"})
    try:
        # ... call weather API ...
        return json.dumps({"location": location, "temp": 22, "units": units})
    except Exception as e:
        return json.dumps({"error": str(e)})


# --- Schema ---

WEATHER_SCHEMA = {
    "name": "weather",
    "description": "Get current weather for a location.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name or coordinates (e.g. 'London' or '51.5,-0.1')"
            },
            "units": {
                "type": "string",
                "enum": ["metric", "imperial"],
                "description": "Temperature units (default: metric)",
                "default": "metric"
            }
        },
        "required": ["location"]
    }
}


# --- Registration ---

from tools.registry import registry

registry.register(
    name="weather",
    toolset="weather",
    schema=WEATHER_SCHEMA,
    handler=lambda args, **kw: weather_tool(
        location=args.get("location", ""),
        units=args.get("units", "metric")),
    check_fn=check_weather_requirements,
    requires_env=["WEATHER_API_KEY"],
)
```

### Regras Principais

:::danger Importante
- Handlers **DEVEM** retornar uma string JSON (via `json.dumps()`), nunca dicts brutos
- Erros **DEVEM** ser retornados como `{"error": "message"}`, nunca levantados como exceções
- O `check_fn` é chamado ao construir as definições de ferramenta — se retornar `False`, a ferramenta é excluída silenciosamente
- O `handler` recebe `(args: dict, **kwargs)`, onde `args` são os argumentos da chamada de ferramenta do LLM
:::

## Passo 2: Adicionar a Ferramenta Nativa a um Toolset

Em `toolsets.py`, adicione o nome da ferramenta:

```python
# If it should be available on all platforms (CLI + messaging):
_WORK4YOU_CORE_TOOLS = [
    ...
    "weather",  # <-- add here
]

# Or create a new standalone toolset:
"weather": {
    "description": "Weather lookup tools",
    "tools": ["weather"],
    "includes": []
},
```

## ~~Passo 3: Adicionar Importação de Descoberta~~ (Não é mais necessário)

Módulos de ferramenta com uma chamada `registry.register()` de nível superior são descobertos automaticamente por `discover_builtin_tools()` em `tools/registry.py`. Nenhuma lista de importação manual a manter — basta criar seu arquivo em `tools/` e ele é detectado na inicialização.

## Handlers Assíncronos

Se seu handler precisar de código assíncrono, marque-o com `is_async=True`:

```python
async def weather_tool_async(location: str) -> str:
    async with aiohttp.ClientSession() as session:
        ...
    return json.dumps(result)

registry.register(
    name="weather",
    toolset="weather",
    schema=WEATHER_SCHEMA,
    handler=lambda args, **kw: weather_tool_async(args.get("location", "")),
    check_fn=check_weather_requirements,
    is_async=True,  # registry calls _run_async() automatically
)
```

O registry lida com a ponte assíncrona de forma transparente — você nunca chama `asyncio.run()` você mesmo.

## Handlers Que Precisam de task_id

Ferramentas que gerenciam estado por sessão recebem `task_id` via `**kwargs`:

```python
def _handle_weather(args, **kw):
    task_id = kw.get("task_id")
    return weather_tool(args.get("location", ""), task_id=task_id)

registry.register(
    name="weather",
    ...
    handler=_handle_weather,
)
```

## Ferramentas Interceptadas pelo Agent-Loop

Algumas ferramentas (`todo`, `memory`, `session_search`, `delegate_task`) precisam de acesso ao estado do agente por sessão. Estas são interceptadas por `run_agent.py` antes de chegar ao registry. O registry ainda mantém seus schemas, mas `dispatch()` retorna um erro de fallback se a interceptação for contornada.

## Opcional: Integração com o Assistente de Configuração

Se sua ferramenta exigir uma chave de API, adicione-a a `work4you_cli/config.py`:

```python
OPTIONAL_ENV_VARS = {
    ...
    "WEATHER_API_KEY": {
        "description": "Weather API key for weather lookup",
        "prompt": "Weather API key",
        "url": "https://weatherapi.com/",
        "tools": ["weather"],
        "password": True,
    },
}
```

## Checklist

- [ ] Arquivo de ferramenta criado com handler, schema, função de checagem e registro
- [ ] Adicionada ao toolset apropriado em `toolsets.py`
- [ ] Confirmado que isso realmente deveria ser uma ferramenta nativa/do núcleo e não um plugin
- [ ] Handler retorna strings JSON, erros retornados como `{"error": "..."}`
- [ ] Opcional: chave de API adicionada a `OPTIONAL_ENV_VARS` em `work4you_cli/config.py`
- [ ] Opcional: adicionada a `toolset_distributions.py` para processamento em lote
- [ ] Testado com `work4you chat -q "Use the weather tool for London"`
