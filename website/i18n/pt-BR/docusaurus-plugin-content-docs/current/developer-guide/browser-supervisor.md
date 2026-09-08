---
sidebar_position: 18
title: "Browser CDP Supervisor"
description: "How Work4You detects and responds to native JS dialogs and interacts with cross-origin iframes via a persistent CDP connection."
---

# Supervisor CDP do Navegador

O supervisor CDP fecha duas lacunas antigas na ferramentaria de navegador do Work4You:

1. **Diálogos JS nativos** (`alert`/`confirm`/`prompt`/`beforeunload`) bloqueiam
   a thread JS da página. Sem supervisão, o agente não tem como saber que um
   diálogo está aberto — as chamadas de ferramenta subsequentes travam ou lançam erros obscuros.
2. **Iframes de origem cruzada (OOPIFs)** são invisíveis para o
   `Runtime.evaluate` de nível superior. O agente consegue ver os nós de iframe no snapshot do DOM mas
   não consegue clicar, digitar ou avaliar (eval) dentro deles sem uma sessão CDP anexada ao
   target filho.

O supervisor resolve ambos mantendo um WebSocket persistente para o endpoint CDP
do backend por tarefa de navegador, expondo diálogos pendentes e a estrutura de frames
em `browser_snapshot`, e expondo uma ferramenta `browser_dialog` para respostas
explícitas.

## Suporte de backend

| Backend | Detecta diálogo | Responde diálogo | Árvore de frames | OOPIF `Runtime.evaluate` via `browser_cdp(frame_id=...)` |
|---|---|---|---|---|
| Chrome local (`--remote-debugging-port`) / `/browser connect` | ✓ | ✓ fluxo completo | ✓ | ✓ |
| Browserbase | ✓ (via bridge) | ✓ fluxo completo (via bridge) | ✓ | ✓ |
| Camofox | ✗ sem CDP (apenas REST) | ✗ | parcial via snapshot do DOM | ✗ |

**Peculiaridade do Browserbase.** O proxy CDP do Browserbase usa o Playwright internamente e
descarta automaticamente diálogos nativos em ~10ms, então `Page.handleJavaScriptDialog`
não consegue acompanhar. O supervisor injeta um script de ponte via
`Page.addScriptToEvaluateOnNewDocument` que sobrescreve
`window.alert`/`confirm`/`prompt` com um XHR síncrono para um host mágico
(`work4you-dialog-bridge.invalid`). `Fetch.enable` intercepta esses XHRs antes que
toquem a rede — o diálogo se torna um evento `Fetch.requestPaused` que o
supervisor captura, e `respond_to_dialog` responde via
`Fetch.fulfillRequest` com um corpo JSON que o script injetado decodifica.

Do ponto de vista da página, `prompt()` ainda retorna a string fornecida pelo agente.
Do ponto de vista do agente, é a mesma API `browser_dialog(action=...)`
de qualquer forma.

O Camofox não é suportado — sem superfície CDP, apenas REST.

## Arquitetura

### CDPSupervisor

Uma `asyncio.Task` rodando em uma thread daemon de segundo plano por `task_id` do Work4You.
Mantém um WebSocket persistente para o endpoint CDP do backend. Mantém:

- **Fila de diálogos** — `List[PendingDialog]` com `{id, type, message, default_prompt, session_id, opened_at}`
- **Árvore de frames** — `Dict[frame_id, FrameInfo]` com relações de parentesco, URL, origem, se é sessão filha de origem cruzada
- **Mapa de sessões** — `Dict[session_id, SessionInfo]` para que as ferramentas de interação possam rotear para a sessão anexada correta em operações OOPIF
- **Erros recentes de console** — buffer circular dos últimos 50 para diagnóstico

Assina no attach:

- `Page.enable` — `javascriptDialogOpening`, `frameAttached`, `frameNavigated`, `frameDetached`
- `Runtime.enable` — `executionContextCreated`, `consoleAPICalled`, `exceptionThrown`
- `Target.setAutoAttach {autoAttach: true, flatten: true}` — expõe targets OOPIF filhos; o supervisor habilita `Page`+`Runtime` em cada um

Acesso ao estado thread-safe via um lock de snapshot; os handlers de ferramenta (síncronos) leem o
snapshot congelado sem aguardar (await).

### Ciclo de vida

- **Início:** `SupervisorRegistry.get_or_start(task_id, cdp_url)` — chamado por
  `browser_navigate`, criação de sessão do Browserbase, `/browser connect`.
  Idempotente.
- **Parada:** encerramento de sessão ou `/browser disconnect`. Cancela a tarefa
  asyncio, fecha o WebSocket, descarta o estado.
- **Revinculação:** se a URL CDP mudar (usuário reconecta a um novo Chrome), o
  supervisor antigo é parado e um novo é iniciado — o estado nunca é reutilizado
  entre endpoints.

### Política de diálogos

Configurável via `config.yaml` em `browser.dialog_policy`:

- **`must_respond`** (padrão) — captura, expõe em `browser_snapshot`, aguarda
  uma chamada explícita de `browser_dialog(action=...)`. Após um timeout de segurança de 300s
  sem resposta, descarta automaticamente e registra em log. Evita que um agente com bug fique travado
  para sempre.
- `auto_dismiss` — registra e descarta imediatamente; o agente vê isso depois do
  fato via `browser_state` dentro de `browser_snapshot`.
- `auto_accept` — registra e aceita (útil para `beforeunload` quando o
  fluxo de trabalho quer navegar para outra página de forma limpa).

A política é por tarefa; não há sobreposições por diálogo individual.

## Superfície do agente

### Ferramenta `browser_dialog`

```
browser_dialog(action, prompt_text=None, dialog_id=None)
```

- `action="accept"` / `"dismiss"` → responde ao diálogo especificado ou ao único pendente (obrigatório)
- `prompt_text=...` → texto a fornecer para um diálogo `prompt()`
- `dialog_id=...` → desambigua quando múltiplos diálogos estão na fila (raro)

A ferramenta é somente-resposta. O agente lê os diálogos pendentes na saída de
`browser_snapshot` antes de chamar.

### Extensão do `browser_snapshot`

Adiciona três campos opcionais à saída de snapshot existente quando um supervisor
está anexado:

```json
{
  "pending_dialogs": [
    {"id": "d-1", "type": "alert", "message": "Hello", "opened_at": 1650000000.0}
  ],
  "recent_dialogs": [
    {"id": "d-1", "type": "alert", "message": "...", "opened_at": 1650000000.0,
     "closed_at": 1650000000.1, "closed_by": "remote"}
  ],
  "frame_tree": {
    "top": {"frame_id": "FRAME_A", "url": "https://example.com/", "origin": "https://example.com"},
    "children": [
      {"frame_id": "FRAME_B", "url": "about:srcdoc", "is_oopif": false},
      {"frame_id": "FRAME_C", "url": "https://ads.example.net/", "is_oopif": true, "session_id": "SID_C"}
    ],
    "truncated": false
  }
}
```

- **`pending_dialogs`** — diálogos atualmente bloqueando a thread JS da página.
  O agente deve chamar `browser_dialog(action=...)` para responder. Vazio no
  Browserbase porque o proxy CDP deles descarta automaticamente em ~10ms.

- **`recent_dialogs`** — buffer circular de até 20 diálogos fechados recentemente com
  uma tag `closed_by`: `"agent"` (nós respondemos), `"auto_policy"` (
  auto_dismiss/auto_accept local), `"watchdog"` (timeout do must_respond atingido) ou
  `"remote"` (o navegador/backend o fechou por conta própria, ex.: Browserbase). É assim
  que agentes no Browserbase ainda ganham visibilidade sobre o que aconteceu.

- **`frame_tree`** — estrutura de frames incluindo filhos de origem cruzada (OOPIF).
  Limitado a 30 entradas + profundidade OOPIF 2 para conter o tamanho do snapshot em
  páginas cheias de anúncios. `truncated: true` aparece quando os limites foram atingidos; agentes que precisam
  da árvore completa podem usar `browser_cdp` com `Page.getFrameTree`.

Nenhuma nova superfície de schema de ferramenta para nada disso — o agente lê o snapshot que
já solicita.

### Gating de disponibilidade

Ambas as superfícies são condicionadas por `_browser_cdp_check` (o supervisor só pode rodar quando um endpoint
CDP está acessível). Em sessões Camofox / sem backend, a ferramenta de diálogo fica
oculta e o snapshot omite os novos campos — sem inchaço de schema.

## Interação com iframes de origem cruzada

`browser_cdp(frame_id=...)` roteia chamadas CDP (notavelmente `Runtime.evaluate`)
através do WebSocket já conectado do supervisor usando o `sessionId` filho do
OOPIF. Os agentes escolhem frame_ids em
`browser_snapshot.frame_tree.children[]` onde `is_oopif=true` e os passam
para `browser_cdp`. Para iframes de mesma origem (sem sessão CDP dedicada), o
agente usa `contentWindow`/`contentDocument` a partir de um
`Runtime.evaluate` de nível superior em vez disso — o supervisor expõe um erro apontando para esse
fallback quando `frame_id` pertence a um não-OOPIF.

No Browserbase, este é o único caminho confiável para interação com iframes —
conexões CDP stateless (abertas por chamada de `browser_cdp`) atingem a expiração da
URL assinada, enquanto a conexão de longa duração do supervisor mantém uma sessão válida.

## Estrutura de arquivos

- `tools/browser_supervisor.py` — `CDPSupervisor`, `SupervisorRegistry`, `PendingDialog`, `FrameInfo`
- `tools/browser_dialog_tool.py` — handler da ferramenta `browser_dialog`
- `tools/browser_tool.py` — hook de início de `browser_navigate`, merge de `browser_snapshot`, reanexação de `/browser connect`, encerramento de `_cleanup_browser_session`
- `toolsets.py` — registra `browser_dialog` nos toolsets `browser`, `work4you-acp`, `work4you-api-server` e core (condicionado à acessibilidade do CDP)
- `work4you_cli/config.py` — padrões de `browser.dialog_policy` e `browser.dialog_timeout_s`

## Não-objetivos

- Detecção/interação para Camofox (lacuna upstream; rastreada separadamente)
- Transmissão ao vivo de eventos de diálogo/frame para o usuário (exigiria hooks de gateway)
- Persistência do histórico de diálogos entre sessões (apenas em memória)
- Políticas de diálogo por iframe (o agente pode expressar isso via `dialog_id`)
- Substituir o `browser_cdp` — ele permanece como a válvula de escape para a cauda longa (cookies, viewport, throttling de rede)

## Testes

Os testes unitários (`tests/tools/test_browser_supervisor.py`) usam um servidor CDP mockado com asyncio
que fala o suficiente do protocolo para exercitar todas as transições de estado:
attach, enable, navigate, disparo de diálogo, descarte de diálogo, attach/detach de frame,
attach de target filho, encerramento de sessão. O E2E com backend real (Browserbase + navegador local
da família Chromium) é manual — exercite via `/browser connect` a
um navegador ao vivo da família Chromium e execute os casos de teste de diálogo/frame descritos
acima.
