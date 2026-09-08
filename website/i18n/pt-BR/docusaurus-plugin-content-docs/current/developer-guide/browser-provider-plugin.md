---
sidebar_position: 13
title: "Browser Provider Plugins"
description: "How to build a cloud browser backend plugin for Work4You"
---

# Construindo um Plugin de Provedor de Navegador

Plugins de provedor de navegador registram um **backend de navegador em nuvem** que atende chamadas de ferramenta `browser_*` em modo cloud (navigate, click, screenshot, …). Os provedores nativos — Browserbase, Browser Use e Firecrawl — são todos distribuídos como plugins em `plugins/browser/<name>/`. Você pode adicionar um novo, ou sobrepor um já empacotado, colocando um diretório ao lado deles.

:::tip
Backends de navegador são um dos vários **plugins de backend** que o Work4You suporta. Os outros (com suas próprias ABCs) são [Web Search Provider Plugins](/developer-guide/web-search-provider-plugin) (que esta ABC deliberadamente espelha), [Image Generation](/developer-guide/image-gen-provider-plugin), [Video Generation](/developer-guide/video-gen-provider-plugin), [Memory Providers](/developer-guide/memory-provider-plugin), [Context Engines](/developer-guide/context-engine-plugin), [Secret Sources](/developer-guide/secret-source-plugin) e [Model Providers](/developer-guide/model-provider-plugin). Plugins genéricos de ferramenta/hook/CLI vivem em [Build a Work4You Plugin](/developer-guide/plugins).
:::

## Como isso se encaixa

Um provedor de navegador **não** implementa a navegação em si. Ele implementa o **ciclo de vida da sessão**: cria uma sessão remota de navegador, devolve uma URL de websocket CDP e encerra a sessão. A própria pilha de navegador do Work4You (`agent-browser` + `tools/browser_tool.py`) se conecta a qualquer URL CDP que você retornar e conduz a página a partir daí — todo provedor ganha o toolset `browser_*` completo de graça.

O provedor ativo é selecionado por `browser.cloud_provider` em `config.yaml`; o dispatcher em `tools/browser_tool.py` é uma consulta pura ao registry, sem condicionais por provedor.

## Descoberta

O Work4You busca por backends de navegador em três lugares:

1. **Empacotado (Bundled)** — `<repo>/plugins/browser/<name>/` (carregado automaticamente com `kind: backend`)
2. **Usuário** — `~/.work4you/plugins/browser/<name>/` (opt-in via `plugins.enabled` ou `work4you plugins enable <name>`)
3. **Pip** — pacotes que declaram um entry point `work4you.plugins`

O `register(ctx)` de cada plugin chama `ctx.register_browser_provider(...)`, que coloca a instância no registry em `agent/browser_registry.py`.

## Estrutura de diretórios

```
plugins/browser/my-backend/
├── __init__.py     # register() entry point
├── provider.py     # BrowserProvider subclass
└── plugin.yaml     # Manifest with kind: backend and provides_browser_providers
```

`plugin.yaml`:

```yaml
name: browser-my-backend
version: 1.0.0
description: "My cloud browser backend. Requires MY_BACKEND_API_KEY."
author: you
kind: backend
provides_browser_providers:
  - my-backend
```

`__init__.py`:

```python
from plugins.browser.my_backend.provider import MyBackendProvider


def register(ctx) -> None:
    ctx.register_browser_provider(MyBackendProvider())
```

## A ABC BrowserProvider

Implemente `agent.browser_provider.BrowserProvider`. Três métodos de ciclo de vida mais identidade:

```python
from agent.browser_provider import BrowserProvider


class MyBackendProvider(BrowserProvider):
    @property
    def name(self) -> str:
        return "my-backend"          # the browser.cloud_provider config value

    @property
    def display_name(self) -> str:
        return "My Backend"          # shown in `work4you tools`

    def is_available(self) -> bool:
        """Cheap check only — env var present, dep importable.
        NO network calls: runs at tool-registration time and on every
        `work4you tools` paint."""
        return bool(os.environ.get("MY_BACKEND_API_KEY"))

    def create_session(self, task_id: str) -> dict:
        """Create a remote browser session; return the session-metadata contract."""
        session = my_api.create_browser(...)
        return {
            "session_name": f"my-backend-{task_id}",  # unique agent-browser session name
            "bb_session_id": session.id,              # provider session ID (for cleanup)
            "cdp_url": session.cdp_ws_url,            # CDP websocket URL
            "features": {"stealth": True},            # feature flags you enabled
        }

    def close_session(self, session_id: str) -> bool:
        """Terminate by provider session ID. Log-and-return-False on error —
        never raise, so the dispatcher's cleanup loop keeps moving."""
        ...

    def emergency_cleanup(self, session_id: str) -> None:
        """Best-effort teardown from atexit/signal handlers. Must not raise."""
        ...
```

### O contrato de metadados da sessão

`create_session()` deve retornar ao menos `session_name`, `bb_session_id`, `cdp_url` e `features`. Dois detalhes peculiares que vale saber:

- **`bb_session_id` é um nome de chave legado** mantido literalmente por compatibilidade retroativa com `tools/browser_tool.py` — ele guarda o ID de sessão do *seu* provedor, independentemente do fornecedor. Não o renomeie.
- `create_session()` **pode levantar exceção** — `ValueError` para credenciais ausentes, `RuntimeError` para falhas de rede/API. O dispatcher expõe essas exceções ao usuário. Isso difere de `close_session`/`emergency_cleanup`, que nunca devem levantar exceção.

Uma chave opcional `external_call_id` suporta faturamento de gateway gerenciado.

### `get_setup_schema()` — a linha do seletor em `work4you tools`

Sobrescreva isso para aparecer como uma opção de primeira classe no seletor de Automação de Navegador com prompts de chave de API e um hook de instalação:

```python
def get_setup_schema(self) -> dict:
    return {
        "name": "My Backend",
        "badge": "paid",
        "tag": "Cloud browser with stealth and proxies",
        "env_vars": [
            {"key": "MY_BACKEND_API_KEY",
             "prompt": "My Backend API key",
             "url": "https://mybackend.example"},
        ],
        "post_setup": "agent_browser",   # ensures local Chromium is installed (agent-browser itself resolves via npx)
    }
```

Conforme o padrão do projeto para backends de ferramenta: se um backend não pode ser selecionado e configurado através de `work4you tools`, ele não está pronto — "defina esta variável de ambiente manualmente" não é uma integração.

## Os usuários o configuram

```yaml
browser:
  cloud_provider: my-backend
```

## Implementações de referência

Os três provedores empacotados em `plugins/browser/` são os exemplos canônicos, em ordem crescente de complexidade: `firecrawl` (o mais simples), `browser_use` e `browserbase` (flags de recurso stealth/proxy/keep-alive com fallback gracioso quando recursos pagos não estão disponíveis). Copie o mais próximo do seu caso.

## Checklist

- [ ] `name` é minúsculo e estável (é um valor de configuração que os usuários escrevem)
- [ ] `is_available()` não faz nenhuma chamada de rede
- [ ] `create_session()` retorna o contrato completo de metadados (nome da chave `bb_session_id` intacto)
- [ ] `close_session()` / `emergency_cleanup()` nunca levantam exceção
- [ ] `get_setup_schema()` expõe suas variáveis de ambiente para que `work4you tools` possa configurar o backend
- [ ] `plugin.yaml` declara `kind: backend` + `provides_browser_providers`
