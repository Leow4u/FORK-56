---
title: "CLI Symbols Glossary"
description: "O que cada símbolo na interface de terminal do Work4You significa — marcadores de transcrição, badges da barra de status, glifos de overlay e prompts de aprovação."
---

# CLI Symbols Glossary

As interfaces de terminal do Work4You falam uma linguagem visual compacta: pontos, chevrons, spinners em braille e glifos de status. Esta página é o decodificador. Ela cobre a [TUI](../user-guide/tui.md) (onde a maioria desses símbolos aparece) e indica o que é compartilhado com a [Classic CLI](../user-guide/cli.md).

:::note Skins podem alterar o estilo de alguns destes
Glifos marcados como *themeable* abaixo são padrões da marca — um [skin](../user-guide/features/skins.md) pode sobrescrevê-los (por exemplo, `tool_prefix` e o símbolo do prompt). Todo o resto é fixo no renderizador.
:::

## Símbolos de transcrição

O que você vê no fluxo da conversa enquanto o agente trabalha.

| Símbolo | Significado |
|--------|---------|
| `❯` | Prompt de entrada — onde você digita. *Themeable* (skins definem seu próprio símbolo de prompt). |
| `●` | Uma chamada de ferramenta (tool call). O marcador precede o nome da ferramenta e seus argumentos. |
| `┊` | Trilho de atividade da ferramenta exibido junto às linhas de ferramenta. *Themeable* (`tool_prefix`). |
| `✓` / `✗` | Resultado da ferramenta: sucesso / falha. Anexado ao final de uma linha de ferramenta concluída. |
| `▸` / `▾` | Chevron de seção recolhida / expandida (thinking, ferramentas, subagentes, seções do banner). Clique para alternar. |
| `▍` | Cursor de streaming — pisca enquanto o modelo ainda está emitindo texto. |
| `│` `├─` `└─` | Trilhos de árvore — conectam um pai (uma delegação, uma jornada) às suas entradas filhas; `└─` marca o último filho. |
| `◈` | Evento de linha do tempo apenas para exibição (avisos de sessão renderizados inline, não mensagens do usuário). |
| `◇` | Um bloco de referência injetado, por exemplo, `◇ Reference 1/2 — <label>`. |
| `↳` | O prompt fixo (sticky) — reproduz a mensagem do usuário que o agente está processando no momento. |
| `☐` / `☑` / `•` | Itens de lista de tarefas em markdown (abertos / concluídos) e marcadores de lista comuns. |
| `▶` | Resumo de `<details>` recolhido dentro do markdown renderizado. |

## Símbolos da barra de status

A linha única na parte inferior da TUI. Os segmentos aparecem apenas quando relevantes e são os primeiros a desaparecer em terminais estreitos.

| Símbolo | Significado |
|--------|---------|
| `⠋⠙⠹…` (padrões em braille) | Spinner de ocupado. As fases de raciocínio (thinking) e de ferramenta usam conjuntos de animação em braille diferentes. |
| `◆ 🌀 🤔 ✨ 🍵 🔮` | Quadros do estilo de indicador de ocupado `emoji` (`/indicator emoji`). O estilo padrão alterna rostos kaomoji em vez disso. |
| <code>&#124; / - &#92;</code> | Quadros do estilo de indicador de ocupado `ascii`. |
| `⏱` | Tempo decorrido por prompt enquanto o turno está em andamento, por exemplo, `⏱ 12s/3m 45s` (tempo do turno / tempo da sessão). |
| `⏲` | O mesmo cronômetro, congelado após o término do turno. |
| `cmp N` | A sessão foi comprimida automaticamente N vezes. |
| `▶ N` | N tarefas `/background` em execução no momento. |
| `⚠ YOLO` | O modo YOLO está ativado (aprovação automática). Também exibido no banner de inicialização. |
| `⛓ N` | N subagentes ativos no momento. |
| `↩ resumes when subagent finishes` | Aviso tranquilizador exibido enquanto você está ocioso, mas um trabalho delegado ainda está em andamento — o resultado retorna automaticamente. |
| `● REC` | O modo de voz está gravando. |
| `◉ STT` | A gravação de voz foi interrompida; a conversão de fala em texto está em andamento. |
| `◉ focus` | A visualização de foco está ativa (saída reduzida). Fixada para nunca desaparecer em um terminal estreito. |
| `♥` | Flash de afeto — o Work4You percebeu que você foi gentil com ele. |
| `⚡` / `🔋` | Indicador de bateria (opt-in): na tomada / na bateria, com porcentagem. |
| `N bg` | N processos de terminal em segundo plano rastreados nesta sessão. |
| `N live sessions` | Sessões de TUI abertas neste processo — clique para abrir o seletor de sessões. |

## Avisos

Avisos de curta duração na barra de status carregam seu próprio glifo inicial, definido pela severidade:

| Símbolo | Significado |
|--------|---------|
| `✓` | Aviso de sucesso. |
| `•` | Aviso informativo. |
| `⚠` | Aviso de alerta (também usado para avisos de crédito). |
| `✕` | Aviso de erro. |

## Prompts de aprovação e confirmação

| Símbolo | Significado |
|--------|---------|
| `⚠ approval required` | Uma ferramenta quer executar algo que precisa da sua confirmação explícita (painel com borda e pré-visualização do comando). |
| `⚠` / `?` | Título do diálogo de confirmação: ação perigosa / pergunta comum. |
| `🔐` | Prompt de senha do sudo (a entrada é mascarada). |
| `🔑` | Prompt de entrada de credencial/segredo (a entrada é mascarada). |

## Overlay de subagentes (`/agents`)

| Símbolo | Significado |
|--------|---------|
| `●` | Subagente em execução. |
| `○` | Na fila. |
| `✓` | Concluído. |
| `■` | Interrompido. |
| `✗` | Falhou. |
| `⌛` | Expirou (timeout). |
| `⚠` | Com erro. |
| `⚡N` | N agentes atualmente ativos em uma linha de resumo. |
| `▁▂▃▄▅▆▇█` | Sparkline de atividade — volume de eventos recentes por branch. |

## Seletor de sessões (`Ctrl+X`)

| Símbolo | Significado |
|--------|---------|
| `✓` | Sessão ociosa. |
| `…` | Iniciando. |
| `?` | Aguardando entrada. |
| `▶` | Trabalhando. |
| `✎ draft` | O campo de composição dessa sessão contém um rascunho não enviado. |

## Seletores e hubs

| Símbolo | Significado |
|--------|---------|
| `▸` | Linha da seleção atual (seletor de modelo e afins). |
| `*` | O modelo/provedor atualmente ativo. |
| `●` / `○` | Provedor autenticado / não autenticado (seletor de modelo); fallback de estado do plugin (hub de plugins). |
| `✓` / `✗` | Plugin ativado / desativado (hub de plugins). |
| `↑ N more` / `↓ N more` | Mais linhas acima/abaixo da janela visível de uma lista. |
| `┃` | Cursor da barra de rolagem em overlays roláveis. |

## Goals

Avisos do ciclo de vida de goals (de [goals](../user-guide/features/goals.md)) começam com o seu estado:

| Símbolo | Significado |
|--------|---------|
| `✓` | Goal concluída. |
| `↻` | Goal continuando — outra iteração foi agendada. |
| `⏸` | Goal pausada. |

## Veja também

- [TUI](../user-guide/tui.md) — linha de status, modos de detalhe, estilos de indicador de ocupado
- [Classic CLI](../user-guide/cli.md) — atalhos de teclado e comandos de barra compartilhados
- [Skins & Themes](../user-guide/features/skins.md) — quais glifos e cores você pode personalizar
