---
title: Public Subagent Lifecycle API
sidebar_label: Subagent lifecycle API
---

# API Pública de Ciclo de Vida de Subagentes

Plugins podem iniciar e supervisionar novas sessões filhas do Work4You sem importar
`tools.delegate_tool`, internals do gateway, estado da TUI ou campos de `AIAgent`.
O serviço resolve seu pai a partir do turno de agente atual, então funciona em
sessões de CLI, gateway, não interativas e de kanban-worker. Iniciar fora de um
turno de agente ativo falha de forma segura com `No active Work4You parent session`.

```python
from agent.subagent_lifecycle import SubagentLaunchRequest

def launch_review(ctx):
    # Call from a plugin tool or hook while an agent turn is active.
    service = ctx.subagent_lifecycle
    handle = service.launch(SubagentLaunchRequest(
        goal="Review this change for regressions.",
        context="Only inspect the supplied repository.",
        role="leaf",
        correlation_id="review-42",
        allowed_toolsets=("file",),
    ))
    # Persist handle.to_dict() if desired.
    if service.wait(handle, timeout_seconds=2).timed_out:
        return handle.to_dict()
    return service.result(handle)
```

`SubagentHandle` é serializável e carrega uma capability opaca e versionada.
Passe-a de volta para `status`, `wait`, `cancel`, `result` ou `reconnect`; handles malformados
ou forjados retornam `UNKNOWN`/`UNKNOWN_HANDLE` e não conseguem acessar um filho.

Os estados estáveis são `PENDING`, `STARTING`, `RUNNING`, `SUCCEEDED`, `FAILED`,
`INTERRUPTED`, `CANCEL_REQUESTED`, `CANCELLED` e `UNKNOWN`.

`cancel(handle, reason=...)` é cooperativo: ele pede ao agente filho para
interromper na próxima fronteira segura e retorna `CANCEL_REQUESTED`; nunca
declara conclusão até que `wait` ou `result` observe um estado terminal. Resultados
terminais são imutáveis, idempotentes, limitados a 32 mil caracteres, omitem transcrições
e raciocínio oculto, e incluem um hash de resultado estável.

Esta API é execução assíncrona gerenciada por ciclo de vida. A construção e
conclusão do filho usam o mesmo caminho gerenciado pelo host que `delegate_task`, incluindo restauração
de resolução de ferramentas do pai, notificação de memória, hooks `subagent_stop`
serializados, limpeza de recursos e consolidação de custo do filho. Isso não altera a
ferramenta síncrona `delegate_task`, a delegação em lote, nem sua exibição no gateway/TUI.
A implementação inicial mantém metadados e resultados terminais em processo por
uma hora.
Após um reinício do processo, `reconnect` retorna `RECONNECT_UNAVAILABLE` e nunca
inicia um filho substituto. Threads Python em execução também não sobrevivem à
saída do processo; os chamadores devem tratar esses handles como interrompidos pela saída do processo.

As requisições falham de forma segura (fail-closed): os tamanhos de goal/context/metadata são limitados, toolsets
desconhecidos ou que ampliam o escopo do pai são rejeitados, e bloqueios por ferramenta, sobreposições de diretório
de trabalho e timeouts por lançamento são explicitamente rejeitados até que o Work4You consiga
suportá-los sem enfraquecer o isolamento. Use `allowed_toolsets` para restringir um
filho; o bloqueio existente de ferramentas inseguras do Work4You continua sendo aplicado.
