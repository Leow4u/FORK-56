---
sidebar_position: 9
---

# Adicionando um Adaptador de Plataforma

Este guia aborda como adicionar uma nova plataforma de mensagens ao gateway do Work4You. Um adaptador de plataforma conecta o Work4You a um serviço de mensagens externo (Telegram, Discord, WeCom, etc.) para que os usuários possam interagir com o agente por meio desse serviço.

:::tip
Há duas formas de adicionar uma plataforma:
- **Plugin** (recomendado para comunidade/terceiros): Coloque um diretório de plugin em `~/.work4you/plugins/` — sem necessidade de alterações no código core. Veja [Caminho via Plugin](#plugin-path-recommended) abaixo.
- **Nativo (Built-in)**: Modifique mais de 20 arquivos entre código, configuração e documentação. Use o [Checklist Nativo](#step-by-step-checklist-built-in-path) abaixo.
:::

## Visão Geral da Arquitetura

```
User ↔ Messaging Platform ↔ Platform Adapter ↔ Gateway Runner ↔ AIAgent
```

Todo adaptador estende `BasePlatformAdapter` de `gateway/platforms/base.py` e implementa:

- **`connect()`** — Estabelece a conexão (WebSocket, long-poll, servidor HTTP, etc.) *(abstrato)*
- **`disconnect()`** — Encerramento limpo *(abstrato)*
- **`send()`** — Envia uma mensagem de texto para um chat *(abstrato)*
- **`send_typing()`** — Exibe o indicador de digitação (sobrescrita opcional)
- **`get_chat_info()`** — Retorna metadados do chat (sobrescrita opcional)

Mensagens de entrada são recebidas pelo adaptador e encaminhadas via `self.handle_message(event)`, que a classe base roteia para o gateway runner.

## Caminho via Plugin (Recomendado)

O sistema de plugins permite adicionar um adaptador de plataforma sem modificar nenhum código core do Work4You. Seu plugin é um diretório com dois arquivos:

```
~/.work4you/plugins/my-platform/
  plugin.yaml      # Metadados do plugin
  adapter.py       # Classe do adaptador + ponto de entrada register()
```

### plugin.yaml

Metadados do plugin. Os blocos `requires_env` e `optional_env` preenchem automaticamente as entradas da UI do `work4you config` (veja [Expondo Variáveis de Ambiente](#surfacing-env-vars-in-work4you-config) abaixo).

```yaml
name: my-platform
label: My Platform
kind: platform
version: 1.0.0
description: My custom messaging platform adapter
author: Your Name
requires_env:
  - MY_PLATFORM_TOKEN          # bare string works
  - name: MY_PLATFORM_CHANNEL  # or rich dict for better UX
    description: "Channel to join"
    prompt: "Channel"
    password: false
optional_env:
  - name: MY_PLATFORM_HOME_CHANNEL
    description: "Default channel for cron delivery"
    password: false
```

#### Ferramentas de cliente de saída: `provides_tools`

Plugins do tipo `kind: platform` são **postergados (deferred)**: o módulo do adaptador (e suas importações de SDK) só são carregados quando um gateway, cron ou caminho `send_message` solicita a plataforma pela primeira vez ao registro de plataformas. Se seu plugin também fornece *ferramentas de cliente* de saída que o agente deve poder chamar de qualquer sessão (como o `a2a_call` / `a2a_discover` etc. do plugin `a2a` empacotado), coloque-as em um `tools.py` dedicado com uma função `register_tools(ctx)` e declare-as no manifesto:

```yaml
provides_tools:
  - my_platform_call
  - my_platform_list
```

Com `provides_tools` declarado, o Work4You importa apenas `tools.py` durante a descoberta de plugins e registra as ferramentas de cliente em todo processo — CLI e TUI incluídos — enquanto o adaptador permanece postergado. Mantenha o `__init__.py` do pacote com importações leves e traga o adaptador de dentro de `register()` para que a importação antecipada continue barata. Sem esse campo, nada muda: o plugin inteiro permanece postergado.

Os usuários habilitam o conjunto de ferramentas por plataforma como qualquer outro, por exemplo `work4you tools enable my_platform --platform cli`, ou listando a chave do conjunto de ferramentas em `platform_toolsets` no `config.yaml`. Nomes de plataforma de plugins também são alvos válidos de `--platform`, então uma sessão de entrada na sua plataforma pode ter suas próprias ferramentas de saída concedidas.

### adapter.py

```python
import os
from gateway.platforms.base import (
    BasePlatformAdapter, SendResult, MessageEvent, MessageType,
)
from gateway.config import Platform, PlatformConfig


class MyPlatformAdapter(BasePlatformAdapter):
    def __init__(self, config: PlatformConfig):
        super().__init__(config, Platform("my_platform"))
        extra = config.extra or {}
        self.token = os.getenv("MY_PLATFORM_TOKEN") or extra.get("token", "")

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        # Connect to the platform API, start listeners
        self._mark_connected()
        return True

    async def disconnect(self) -> None:
        self._mark_disconnected()

    async def send(self, chat_id, content, reply_to=None, metadata=None):
        # Send message via platform API
        return SendResult(success=True, message_id="...")

    async def get_chat_info(self, chat_id):
        return {"name": chat_id, "type": "dm"}


def check_requirements() -> bool:
    return bool(os.getenv("MY_PLATFORM_TOKEN"))


def validate_config(config) -> bool:
    extra = getattr(config, "extra", {}) or {}
    return bool(os.getenv("MY_PLATFORM_TOKEN") or extra.get("token"))


def _env_enablement() -> dict | None:
    token = os.getenv("MY_PLATFORM_TOKEN", "").strip()
    channel = os.getenv("MY_PLATFORM_CHANNEL", "").strip()
    if not (token and channel):
        return None
    seed = {"token": token, "channel": channel}
    home = os.getenv("MY_PLATFORM_HOME_CHANNEL")
    if home:
        seed["home_channel"] = {"chat_id": home, "name": "Home"}
    return seed


def register(ctx):
    """Plugin entry point — called by the Work4You plugin system."""
    ctx.register_platform(
        name="my_platform",
        label="My Platform",
        adapter_factory=lambda cfg: MyPlatformAdapter(cfg),
        # PASSIVE probe — "are deps/config present right now?".  Called from
        # status displays and config loading, so it must NEVER pip-install.
        check_fn=check_requirements,
        # ACTIVE installer (optional) — only for platforms with a
        # lazy-installable SDK.  create_adapter() calls it when check_fn
        # returns False, right before the gateway connects the platform.
        # Typically wraps tools.lazy_deps.ensure_and_bind(...).  Omit it
        # and a False check_fn is a hard block.
        # ensure_deps_fn=ensure_requirements,
        validate_config=validate_config,
        required_env=["MY_PLATFORM_TOKEN"],
        install_hint="pip install my-platform-sdk",
        # Env-driven auto-configuration — seeds PlatformConfig.extra from
        # env vars before adapter construction. See "Env-Driven Auto-
        # Configuration" section below.
        env_enablement_fn=_env_enablement,
        # Cron home-channel delivery support. Lets deliver=my_platform cron
        # jobs route without editing cron/scheduler.py. See "Cron Delivery"
        # section below.
        cron_deliver_env_var="MY_PLATFORM_HOME_CHANNEL",
        # Per-platform user authorization env vars
        allowed_users_env="MY_PLATFORM_ALLOWED_USERS",
        allow_all_env="MY_PLATFORM_ALLOW_ALL_USERS",
        # Message length limit for smart chunking (0 = no limit)
        max_message_length=4000,
        # LLM guidance injected into system prompt
        platform_hint=(
            "You are chatting via My Platform. "
            "It supports markdown formatting."
        ),
        # Display
        emoji="💬",
    )

    # Optional: register platform-specific tools
    ctx.register_tool(
        name="my_platform_search",
        toolset="my_platform",
        schema={...},
        handler=my_search_handler,
    )
```

### Configuração

Os usuários configuram a plataforma no `config.yaml`:

```yaml
gateway:
  platforms:
    my_platform:
      enabled: true
      extra:
        token: "..."
        channel: "#general"
```

Ou por meio de variáveis de ambiente (que o adaptador lê em `__init__`).

### O Que o Sistema de Plugins Trata Automaticamente

Ao chamar `ctx.register_platform()`, os seguintes pontos de integração são tratados automaticamente — sem necessidade de alterações no código core:

| Ponto de integração | Como funciona |
|---|---|
| Criação do adaptador do gateway | O registro é verificado antes da cadeia if/elif nativa |
| Parsing de configuração | `Platform._missing_()` aceita qualquer nome de plataforma |
| Validação de plataforma conectada | `validate_config()` do registro é chamado |
| Autorização de usuário | `allowed_users_env` / `allow_all_env` são verificados |
| Auto-habilitação apenas por env | `env_enablement_fn` popula `PlatformConfig.extra` + `home_channel` |
| Ponte de configuração YAML | `apply_yaml_config_fn` traduz chaves do `config.yaml` em variáveis de ambiente/extras |
| Entrega via cron | `cron_deliver_env_var` faz `deliver=<name>` funcionar |
| Entradas na UI do `work4you config` | `requires_env` / `optional_env` no `plugin.yaml` são preenchidos automaticamente |
| Motor de envio (`tools/send_message_tool.py`) | Roteia através do adaptador de gateway ativo |
| Entrega multiplataforma via webhook | O registro é verificado para plataformas conhecidas |
| Acesso ao comando `/update` | Flag `allow_update_command` |
| Diretório de canais | Plataformas de plugin incluídas na enumeração |
| Dicas no prompt de sistema | `platform_hint` injetado no contexto do LLM |
| Fragmentação de mensagens | `max_message_length` para divisão inteligente |
| Redação de PII | Flag `pii_safe` |
| `work4you status` | Exibe plataformas de plugin com a marca `(plugin)` |
| `work4you gateway setup` | Plataformas de plugin aparecem no menu de configuração |
| `work4you tools` / `work4you skills` | Plataformas de plugin na configuração por plataforma |
| Trava de token (multi-perfil) | Use `acquire_scoped_lock()` no seu `connect()` |
| Aviso de configuração órfã | Log descritivo quando o plugin está ausente |

## Extensões do caminho de envio para plataformas standalone

Uma plataforma standalone pode participar da entrega de saída orientada pelo host por meio de `work4you send --to ...` direto e do cron `deliver=platform:...` declarando o comportamento de envio na mesma `PlatformEntry` criada por `ctx.register_platform()`.
`send_message` intencionalmente não é uma ferramenta de modelo chamável pelo agente; plugins não devem registrar uma superfície de modelo equivalente que permita ao agente iniciar mensagens de saída por conta própria.

```python
async def _send_request(args, chat_id, platform_name, pconfig):
    # `args` contains the host-driven send request fields.
    message_id = await client.send(
        address=chat_id,
        body=args["message"],
        subject=args.get("subject"),
    )
    return {"success": True, "platform": platform_name,
            "chat_id": chat_id, "message_id": message_id}


def _parse_address(raw):
    normalized = raw.strip().lower()
    if normalized.startswith("@") and "@" in normalized[1:]:
        return normalized, None  # (chat_id, optional thread_id)
    return None                 # continue to channel-directory resolution


def _validate_address(address):
    # True accepts; False rejects; a string rejects with that diagnostic.
    return True if address.endswith("@example.com") else "unsupported domain"


def register(ctx):
    ctx.register_platform(
        name="fmsg",
        label="Fixture Message",
        adapter_factory=lambda cfg: FmsgAdapter(cfg),
        check_fn=check_requirements,
        parse_target_ref_fn=_parse_address,
        validate_target_ref_fn=_validate_address,
        # May be a regular function or async def. Work4You awaits any awaitable
        # result, including callable objects and functools.partial wrappers.
        send_message_handler=_send_request,
        # Prefer this lower-level hook when cron must send from a process
        # without the live gateway.
        standalone_sender_fn=_standalone_send,
    )
```

A resolução do alvo é compartilhada entre as três superfícies de saída. A saída do parser é normalizada primeiro e os IDs do diretório de canais são considerados confiáveis. Um parser de plugin deve aceitar explicitamente a sintaxe de alvo nativa; strings não resolvidas nunca são repassadas de forma opaca. Plataformas desconhecidas e falhas de validação retornam um diagnóstico em vez de tentar a entrega silenciosamente. Transições de recarregamento forçado/perfil de plugins removem o registro das entradas de sua propriedade, então parsers e handlers não podem vazar para o próximo perfil.

## Auto-Configuração Orientada por Variáveis de Ambiente

A maioria dos usuários configura uma plataforma colocando variáveis de ambiente em `~/.work4you/.env` em vez de editar o `config.yaml`. O hook `env_enablement_fn` permite que seu plugin capture essas variáveis de ambiente **antes** de o adaptador ser construído, de modo que `work4you gateway status`, `get_connected_platforms()` e a entrega via cron vejam o estado correto sem instanciar o SDK da plataforma.

```python
def _env_enablement() -> dict | None:
    """Seed PlatformConfig.extra from env vars.

    Called by the platform registry during load_gateway_config().
    Return None when the platform isn't minimally configured — the
    caller then skips auto-enabling. Return a dict to seed extras.

    The special 'home_channel' key is extracted and becomes a proper
    HomeChannel dataclass on the PlatformConfig; every other key is
    merged into PlatformConfig.extra.
    """
    token = os.getenv("MY_PLATFORM_TOKEN", "").strip()
    channel = os.getenv("MY_PLATFORM_CHANNEL", "").strip()
    if not (token and channel):
        return None
    seed = {"token": token, "channel": channel}
    home = os.getenv("MY_PLATFORM_HOME_CHANNEL")
    if home:
        seed["home_channel"] = {
            "chat_id": home,
            "name": os.getenv("MY_PLATFORM_HOME_CHANNEL_NAME", "Home"),
        }
    return seed


def register(ctx):
    ctx.register_platform(
        name="my_platform",
        label="My Platform",
        adapter_factory=lambda cfg: MyPlatformAdapter(cfg),
        check_fn=check_requirements,
        validate_config=validate_config,
        env_enablement_fn=_env_enablement,
        # ... other fields
    )
```


## Ponte de Configuração YAML→env

Alguns usuários preferem definir chaves do `config.yaml` (`my_platform.require_mention`, `my_platform.allowed_channels`, etc.) em vez de variáveis de ambiente. O hook `apply_yaml_config_fn` permite que seu plugin seja o dono dessa tradução, em vez de forçar o `gateway/config.py` do core a conhecer o schema YAML da sua plataforma.

```python
import os

def _apply_yaml_config(yaml_cfg: dict, platform_cfg: dict) -> dict | None:
    """Translate config.yaml `my_platform:` keys into env vars / extras.

    yaml_cfg     — the full top-level parsed config.yaml dict
    platform_cfg — the platform's own sub-dict (yaml_cfg.get("my_platform", {}))

    May mutate os.environ directly (use `not os.getenv(...)` guards to
    preserve env > YAML precedence) and/or return a dict to merge into
    PlatformConfig.extra. Return None or {} for no extras.
    """
    if "require_mention" in platform_cfg and not os.getenv("MY_PLATFORM_REQUIRE_MENTION"):
        os.environ["MY_PLATFORM_REQUIRE_MENTION"] = str(platform_cfg["require_mention"]).lower()
    allowed = platform_cfg.get("allowed_channels")
    if allowed is not None and not os.getenv("MY_PLATFORM_ALLOWED_CHANNELS"):
        if isinstance(allowed, list):
            allowed = ",".join(str(v) for v in allowed)
        os.environ["MY_PLATFORM_ALLOWED_CHANNELS"] = str(allowed)
    return None  # nothing extra to merge into PlatformConfig.extra

def register(ctx):
    ctx.register_platform(
        name="my_platform",
        ...,
        apply_yaml_config_fn=_apply_yaml_config,
    )
```

O hook é invocado durante `load_gateway_config()` após o laço genérico de chaves compartilhadas (que trata chaves comuns como `unauthorized_dm_behavior`, `notice_delivery`, `reply_prefix`, `require_mention`, etc.) e antes de `_apply_env_overrides()`, então seu plugin só precisa fazer a ponte das chaves **específicas da plataforma**.

Exceções levantadas pelo hook são capturadas e registradas em nível de debug — um plugin mal comportado nunca interrompe o carregamento da configuração do gateway.


## Entrega via Cron

Para permitir que jobs de cron `deliver=my_platform` sejam roteados para um canal padrão configurado, defina `cron_deliver_env_var` como o nome da variável de ambiente que contém o ID padrão do chat/sala/canal:

```python
ctx.register_platform(
    name="my_platform",
    ...
    cron_deliver_env_var="MY_PLATFORM_HOME_CHANNEL",
)
```

O scheduler lê essa variável de ambiente ao resolver o alvo padrão para jobs `deliver=my_platform`, e também trata a plataforma como um alvo válido de cron em verificações do tipo `_KNOWN_DELIVERY_PLATFORMS`. Se seu `env_enablement_fn` popular um dicionário `home_channel` (veja acima), isso tem precedência — `cron_deliver_env_var` é o fallback para jobs de cron executados antes do preenchimento por variáveis de ambiente.

### Entrega de cron fora do processo

`cron_deliver_env_var` torna sua plataforma um alvo `deliver=` reconhecido. Para que o envio de fato funcione quando o job de cron roda em um processo separado do gateway (isto é, `work4you cron run` separado de `work4you gateway`), registre um `standalone_sender_fn`:

```python
async def _standalone_send(
    pconfig,
    chat_id,
    message,
    *,
    thread_id=None,
    media_files=None,
    force_document=False,
):
    """Open an ephemeral connection / acquire a fresh token, send, and close."""
    # ... open connection, send message, return result ...
    return {"success": True, "message_id": "..."}
    # or {"error": "..."}

ctx.register_platform(
    name="my_platform",
    ...
    cron_deliver_env_var="MY_PLATFORM_HOME_CHANNEL",
    standalone_sender_fn=_standalone_send,
)
```

Por que esse hook é necessário: plataformas nativas (Telegram, Discord, Slack, etc.) trazem helpers REST diretos em `tools/send_message_tool.py` para que o cron possa entregar sem manter o gateway no mesmo processo. Plataformas de plugin historicamente dependiam de `_gateway_runner_ref()`, que retorna `None` fora do processo do gateway, então sem `standalone_sender_fn` o envio do lado do cron falha com `No live adapter for platform '<name>'`.

A função recebe o mesmo `pconfig` e `chat_id` que o adaptador ativo receberia, além dos argumentos nomeados opcionais `thread_id`, `media_files` e `force_document`. Retornar `{"success": True, "message_id": ...}` é tratado como entrega bem-sucedida; retornar `{"error": "..."}` exibe a mensagem em `delivery_errors` do cron. Exceções levantadas dentro da função são capturadas pelo dispatcher e reportadas como `Plugin standalone send failed: <reason>`. Implementações de referência estão em `plugins/platforms/{irc,teams,google_chat}/adapter.py`.

## Expondo Variáveis de Ambiente no `work4you config`

`work4you_cli/config.py` varre `plugins/platforms/*/plugin.yaml` no momento da importação e preenche automaticamente `OPTIONAL_ENV_VARS` a partir dos blocos `requires_env` e (opcionalmente) `optional_env`. Use a forma de dicionário completo para fornecer descrições, prompts, flags de senha e URLs adequadas — a UI de configuração do CLI as capta automaticamente.

```yaml
# plugins/platforms/my_platform/plugin.yaml
name: my_platform-platform
label: My Platform
kind: platform
version: 1.0.0
description: >
  My Platform gateway adapter for Work4You.
author: Your Name
requires_env:
  - name: MY_PLATFORM_TOKEN
    description: "Bot API token from the My Platform console"
    prompt: "My Platform bot token"
    url: "https://my-platform.example.com/bots"
    password: true
  - name: MY_PLATFORM_CHANNEL
    description: "Channel to join (e.g. #work4you)"
    prompt: "Channel"
    password: false
optional_env:
  - name: MY_PLATFORM_HOME_CHANNEL
    description: "Default channel for cron delivery (defaults to MY_PLATFORM_CHANNEL)"
    prompt: "Home channel (or empty)"
    password: false
  - name: MY_PLATFORM_ALLOWED_USERS
    description: "Comma-separated user IDs allowed to talk to the bot"
    prompt: "Allowed users (comma-separated)"
    password: false
```

**Chaves de dicionário suportadas:** `name` (obrigatório), `description`, `prompt`, `url`, `password` (booleano; detectado automaticamente pelo sufixo `*_TOKEN` / `*_SECRET` / `*_KEY` / `*_PASSWORD` / `*_JSON` quando omitido), `category` (o padrão é `"messaging"`).

Entradas em formato de string simples (`- MY_PLATFORM_TOKEN`) ainda funcionam — elas recebem uma descrição genérica derivada automaticamente do `label` do plugin. Se já existir uma entrada fixa (hardcoded) para a mesma variável em `OPTIONAL_ENV_VARS`, ela prevalece (compatibilidade retroativa); a forma via plugin.yaml funciona como fallback.

## UX Específica de Plataforma para LLM Lento

Algumas plataformas têm restrições que mudam como uma resposta lenta do LLM deve ser apresentada:

- **LINE** emite um *reply token* de uso único que expira aproximadamente 60 segundos após o evento de entrada. Responder com esse token é gratuito; recorrer à API Push tarifada não é. Se o LLM não terminar até o prazo, a escolha é "consumir cota paga do Push" ou "fazer algo mais inteligente com o reply token antes que ele expire."
- **WhatsApp** marca uma sessão como inativa após 24h, após as quais apenas mensagens de template são aceitas.
- **SMS** não tem conceito de indicadores de digitação ou atualizações progressivas — respostas longas simplesmente parecem que o bot está offline.

Essas são restrições reais que o `BasePlatformAdapter` base não consegue antecipar. A superfície de plugin deixa intencionalmente espaço para que um adaptador camada UX específica de plataforma sobre o loop de digitação base sem expandir a lista de kwargs.

### Padrão: subclassear `_keep_typing` para camadas de UX em meio à execução

`BasePlatformAdapter._keep_typing` é o "heartbeat" do indicador de digitação — ele roda como uma tarefa em segundo plano enquanto o LLM está gerando, e é cancelado quando a resposta é entregue. Para camadas um comportamento específico de plataforma em um limiar (por exemplo, enviar uma bolha "ainda pensando" aos 45s), sobrescreva `_keep_typing` no seu adaptador, agende sua própria tarefa junto com `super()._keep_typing()`, e desmonte-a em `finally`:

```python
class LineAdapter(BasePlatformAdapter):
    async def _keep_typing(self, chat_id: str, *args, **kwargs) -> None:
        if self.slow_response_threshold <= 0:
            await super()._keep_typing(chat_id, *args, **kwargs)
            return

        async def _fire_at_threshold() -> None:
            try:
                await asyncio.sleep(self.slow_response_threshold)
            except asyncio.CancelledError:
                raise
            # Platform-specific work here — for LINE, send a Template
            # Buttons "Get answer" bubble using the cached reply token
            # so the user can fetch the cached response later via a
            # fresh (free) reply token from the postback callback.
            await self._send_slow_response_button(chat_id)

        side_task = asyncio.create_task(_fire_at_threshold())
        try:
            await super()._keep_typing(chat_id, *args, **kwargs)
        finally:
            if not side_task.done():
                side_task.cancel()
                try:
                    await side_task
                except (asyncio.CancelledError, Exception):
                    pass
```

Pontos-chave:

- **Sempre `await super()._keep_typing(...)`.** O heartbeat de digitação é independentemente útil — não o substitua, adicione uma camada sobre ele.
- **Desmonte a tarefa lateral em `finally`.** Quando o LLM termina (ou `/stop` cancela a execução), o gateway cancela a tarefa de digitação. Sua tarefa lateral deve observar esse cancelamento também, caso contrário ela persiste e pode disparar depois que a resposta já foi entregue.
- **Combine com `interrupt_session_activity`** para resolver qualquer estado de UX órfão quando o usuário emite `/stop`. Para o LINE, isso significa transicionar a entrada de cache do postback de `PENDING` para `ERROR`, para que o botão persistente "Get answer" entregue uma mensagem "Run was interrupted" em vez de ficar em loop.

### Padrão: subclassear `send` para rotear via cache em vez de enviar imediatamente

Se sua UX de resposta lenta armazena a resposta em cache para recuperação posterior (fluxo de postback do LINE), sua sobrescrita de `send` precisa reconhecer três modos:

1. **Postback pendente ativo para este chat** → armazena a resposta em cache sob o request_id, não envia nada visível.
2. **Confirmação de ocupado do sistema (busy-ack)** (`⚡ Interrupting`, `⏳ Queued`, `⏩ Steered`) → ignora o cache e envia visivelmente para que o usuário veja a resposta do gateway à sua entrada.
3. **Resposta normal** → envia via reply-token-ou-push como de costume.

```python
async def send(self, chat_id: str, content: str, **kw) -> SendResult:
    if _is_system_bypass(content):
        return await self._send_text_chunks(chat_id, content, force_push=False)
    pending_rid = self._pending_buttons.get(chat_id)
    if pending_rid:
        self._cache.set_ready(pending_rid, content)
        return SendResult(success=True, message_id=pending_rid)
    return await self._send_text_chunks(chat_id, content, force_push=False)
```

`_SYSTEM_BYPASS_PREFIXES` são os próprios prefixos de confirmação de ocupado do gateway (`⚡`, `⏳`, `⏩`, `💾`). Sempre deixe-os passar visivelmente, independentemente do estado de UX em cache.

### Quando este padrão é apropriado

Use a abordagem de sobrescrita do loop de digitação quando:

- A API de saída da plataforma tem uma restrição rígida de janela de tempo (reply token de uso único, sessão fixa expirando, etc.) E
- Uma *bolha visível em meio à execução* é uma UX aceitável nessa plataforma.

Use o caminho mais simples de `slow_response_threshold = 0`, sempre via Push, quando:

- A plataforma não tem uma distinção significativa entre gratuito e pago, OU
- A comunidade de usuários prefere "carregando… carregando… PRONTO" em silêncio até a resposta, em vez de uma bolha intermediária interativa.

O LINE suporta ambos: o limiar tem como padrão 45s para busca gratuita via postback, e `LINE_SLOW_RESPONSE_THRESHOLD=0` volta para "sempre fallback via Push."

### Implementação de Referência

Veja `plugins/platforms/line/adapter.py` para a implementação completa do postback do LINE — uma máquina de estados `RequestCache` (`PENDING → READY → DELIVERED`, além de `ERROR` para `/stop`), uma sobrescrita de `_keep_typing` que dispara a bolha de Template Buttons no limiar, uma sobrescrita de `send` que roteia via o cache, e uma sobrescrita de `interrupt_session_activity` que resolve entradas PENDING órfãs.

### Implementações de Referência (Caminho via Plugin)

Veja `plugins/platforms/irc/` no repositório para um exemplo completo funcionando — um adaptador IRC assíncrono completo sem dependências externas. `plugins/platforms/teams/` cobre Bot Framework / Adaptive Cards, `plugins/platforms/google_chat/` cobre APIs REST baseadas em OAuth, e `plugins/platforms/line/` cobre APIs de Messaging orientadas por webhook com UX específica de plataforma para LLM lento.

---

## Checklist Passo a Passo (Caminho Nativo)

:::note
Este checklist é para adicionar uma plataforma diretamente à base de código core do Work4You — normalmente feito por contribuidores core para plataformas oficialmente suportadas. Plataformas de comunidade/terceiros devem usar o [Caminho via Plugin](#plugin-path-recommended) acima.
:::

### 1. Enum de Plataforma

Adicione sua plataforma ao enum `Platform` em `gateway/config.py`:

```python
class Platform(Enum):
    # ... existing platforms ...
    NEWPLAT = "newplat"
```

### 2. Arquivo do Adaptador

Crie `plugins/platforms/newplat/adapter.py`:

```python
from gateway.config import Platform, PlatformConfig
from gateway.platforms.base import (
    BasePlatformAdapter, MessageEvent, MessageType, SendResult,
)

def check_newplat_requirements() -> bool:
    """Return True if dependencies are available."""
    return SOME_SDK_AVAILABLE

class NewPlatAdapter(BasePlatformAdapter):
    def __init__(self, config: PlatformConfig):
        super().__init__(config, Platform.NEWPLAT)
        # Read config from config.extra dict
        extra = config.extra or {}
        self._api_key = extra.get("api_key") or os.getenv("NEWPLAT_API_KEY", "")

    async def connect(self, *, is_reconnect: bool = False) -> bool:
        # Set up connection, start polling/webhook
        self._mark_connected()
        return True

    async def disconnect(self) -> None:
        self._running = False
        self._mark_disconnected()

    async def send(self, chat_id, content, reply_to=None, metadata=None):
        # Send message via platform API
        return SendResult(success=True, message_id="...")

    async def get_chat_info(self, chat_id):
        return {"name": chat_id, "type": "dm"}
```

Para mensagens de entrada, construa um `MessageEvent` e chame `self.handle_message(event)`:

```python
source = self.build_source(
    chat_id=chat_id,
    chat_name=name,
    chat_type="dm",  # or "group"
    user_id=user_id,
    user_name=user_name,
)
event = MessageEvent(
    text=content,
    message_type=MessageType.TEXT,
    source=source,
    message_id=msg_id,
)
await self.handle_message(event)
```

### 3. Configuração do Gateway (`gateway/config.py`)

Três pontos de contato:

1. **`get_connected_platforms()`** — Adicione uma verificação para as credenciais obrigatórias da sua plataforma
2. **`load_gateway_config()`** — Adicione a entrada do mapa de token de ambiente: `Platform.NEWPLAT: "NEWPLAT_TOKEN"`
3. **`_apply_env_overrides()`** — Mapeie todas as variáveis de ambiente `NEWPLAT_*` para a configuração

### 4. Gateway Runner (`gateway/run.py`)

Seis pontos de contato:

1. **`_create_adapter()`** — Adicione um ramo `elif platform == Platform.NEWPLAT:`
2. **Mapa `allowed_users` de `_is_user_authorized()`** — `Platform.NEWPLAT: "NEWPLAT_ALLOWED_USERS"`
3. **Mapa `allow_all` de `_is_user_authorized()`** — `Platform.NEWPLAT: "NEWPLAT_ALLOW_ALL_USERS"`
4. **Verificação antecipada de ambiente, tupla `_any_allowlist`** — Adicione `"NEWPLAT_ALLOWED_USERS"`
5. **Verificação antecipada de ambiente, tupla `_allow_all`** — Adicione `"NEWPLAT_ALLOW_ALL_USERS"`
6. **Frozenset `_UPDATE_ALLOWED_PLATFORMS`** — Adicione `Platform.NEWPLAT`

### 5. Entrega Multiplataforma

1. **`gateway/platforms/webhook.py`** — Adicione `"newplat"` à tupla de tipos de entrega
2. **`cron/scheduler.py`** — Adicione ao frozenset `_KNOWN_DELIVERY_PLATFORMS` e ao mapa de plataforma de `_deliver_result()`

### 6. Integração com o CLI

1. **`work4you_cli/config.py`** — Adicione todas as variáveis `NEWPLAT_*` a `_EXTRA_ENV_KEYS`
2. **`work4you_cli/gateway.py`** — Adicione uma entrada à lista `_PLATFORMS` com key, label, emoji, token_var, setup_instructions e vars
3. **`work4you_cli/platforms.py`** — Adicione uma entrada `PlatformInfo` com label e default_toolset (usado pelas TUIs `skills_config` e `tools_config`)
4. **`work4you_cli/setup.py`** — Adicione a função `_setup_newplat()` (pode delegar para `gateway.py`) e adicione a tupla à lista de plataformas de mensagens
5. **`work4you_cli/status.py`** — Adicione a entrada de detecção de plataforma: `"NewPlat": ("NEWPLAT_TOKEN", "NEWPLAT_HOME_CHANNEL")`
6. **`work4you_cli/dump.py`** — Adicione `"newplat": "NEWPLAT_TOKEN"` ao dicionário de detecção de plataforma

### 7. Ferramentas

1. **`tools/send_message_tool.py`** — Adicione `"newplat": Platform.NEWPLAT` ao mapa de plataforma
2. **`tools/cronjob_tools.py`** — Adicione `newplat` à string de descrição do alvo de entrega

### 8. Conjuntos de Ferramentas (Toolsets)

1. **`toolsets.py`** — Adicione a definição do toolset `"work4you-newplat"` com `_WORK4YOU_CORE_TOOLS`
2. **`toolsets.py`** — Adicione `"work4you-newplat"` à lista de includes de `"work4you-gateway"`

### 9. Opcional: Dicas de Plataforma

**`agent/prompt_builder.py`** — Se sua plataforma tem limitações específicas de renderização (sem markdown, limites de tamanho de mensagem, etc.), adicione uma entrada ao dicionário `PLATFORM_HINTS`. Isso injeta orientação específica de plataforma no prompt de sistema:

```python
PLATFORM_HINTS = {
    # ...
    "newplat": (
        "You are chatting via NewPlat. It supports markdown formatting "
        "but has a 4000-character message limit."
    ),
}
```

Nem todas as plataformas precisam de dicas — adicione uma apenas se o comportamento do agente deve mudar.

### 10. Testes

Crie `tests/gateway/test_newplat.py` cobrindo:

- Construção do adaptador a partir da configuração
- Construção do evento de mensagem
- Método send (mock da API externa)
- Recursos específicos da plataforma (criptografia, roteamento, etc.)

### 11. Documentação

| Arquivo | O que adicionar |
|------|-------------|
| `website/docs/user-guide/messaging/newplat.md` | Página completa de configuração da plataforma |
| `website/docs/user-guide/messaging/index.md` | Tabela de comparação de plataformas, diagrama de arquitetura, tabela de toolsets, seção de segurança, link de próximos passos |
| `website/docs/reference/environment-variables.md` | Todas as variáveis de ambiente NEWPLAT_* |
| `website/docs/reference/toolsets-reference.md` | Toolset work4you-newplat |
| `website/docs/integrations/index.md` | Link da plataforma |
| `website/sidebars.ts` | Entrada de barra lateral para a página de documentação |
| `website/docs/developer-guide/architecture.md` | Contagem e listagem de adaptadores |
| `website/docs/developer-guide/gateway-internals.md` | Listagem de arquivos de adaptador |

## Auditoria de Paridade

Antes de marcar um PR de nova plataforma como concluído, execute uma auditoria de paridade contra uma plataforma já estabelecida:

```bash
# Find every .py file mentioning the reference platform
search_files "bluebubbles" output_mode="files_only" file_glob="*.py"

# Find every .py file mentioning the new platform
search_files "newplat" output_mode="files_only" file_glob="*.py"

# Any file in the first set but not the second is a potential gap
```

Repita para arquivos `.md` e `.ts`. Investigue cada lacuna — é uma enumeração de plataforma (precisa de atualização) ou uma referência específica de plataforma (pode ser ignorada)?

## Padrões Comuns

### Adaptadores de Long-Poll

Se seu adaptador usa long-polling (como Telegram ou Weixin), use uma tarefa de loop de polling:

```python
async def connect(self):
    self._poll_task = asyncio.create_task(self._poll_loop())
    self._mark_connected()

async def _poll_loop(self):
    while self._running:
        messages = await self._fetch_updates()
        for msg in messages:
            await self.handle_message(self._build_event(msg))
```

### Adaptadores de Callback/Webhook

Se a plataforma envia mensagens para seu endpoint (como o WeCom Callback), execute um servidor HTTP:

```python
async def connect(self):
    self._app = web.Application()
    self._app.router.add_post("/callback", self._handle_callback)
    # ... start aiohttp server
    self._mark_connected()

async def _handle_callback(self, request):
    event = self._build_event(await request.text())
    await self._message_queue.put(event)
    return web.Response(text="success")  # Acknowledge immediately
```

Para plataformas com prazos de resposta apertados (por exemplo, o limite de 5 segundos do WeCom), sempre confirme o recebimento imediatamente e entregue a resposta do agente de forma proativa via API depois. Sessões de agente rodam de 3 a 30 minutos — respostas inline dentro da janela de resposta de um callback não são viáveis.

### Travas de Token

Se o adaptador mantém uma conexão persistente com uma credencial única, adicione uma trava com escopo para evitar que dois perfis usem a mesma credencial:

```python
from gateway.status import acquire_scoped_lock, release_scoped_lock

async def connect(self, *, is_reconnect: bool = False):
    acquired, _existing = acquire_scoped_lock("newplat", self._token)
    if not acquired:
        logger.error("Token already in use by another profile")
        return False
    # ... connect

async def disconnect(self):
    release_scoped_lock("newplat", self._token)
```

## Implementações de Referência

| Adaptador | Padrão | Complexidade | Boa referência para |
|---------|---------|------------|-------------------|
| `bluebubbles.py` | REST + webhook | Média | Integração simples com API REST |
| `weixin.py` | Long-poll + CDN | Alta | Manuseio de mídia, criptografia |
| `plugins/platforms/wecom/callback_adapter.py` | Callback/webhook | Média | Servidor HTTP, criptografia AES, múltiplos apps |
| `plugins/platforms/irc/adapter.py` | Long-poll + protocolo IRC | Alta | Adaptador de plugin completo com trava de token com escopo |
