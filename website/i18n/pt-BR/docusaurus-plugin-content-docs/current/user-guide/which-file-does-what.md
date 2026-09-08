---
sidebar_position: 4
title: "O Que Cada Arquivo Faz?"
description: "SOUL.md vs USER.md vs MEMORY.md vs AGENTS.md — um mapa de uma página dos arquivos do agente, quem escreve cada um e quando o agente realmente os vê"
---

# O Que Cada Arquivo Faz?

"Eu disse algo ao meu agente e ele esqueceu." "Qual arquivo é o cérebro do meu agente?" "Editei o SOUL.md — por que ele não sabe meu nome?" Essas perguntas todas se resumem à mesma coisa: o Work4You é moldado por vários arquivos markdown, e cada um tem uma função diferente. Esta página os mapeia todos em um só lugar. Para se aprofundar em qualquer um deles, siga os links para [Memória Persistente](/user-guide/features/memory), [Personalidade e SOUL.md](/user-guide/features/personality) e [Arquivos de Contexto](/user-guide/features/context-files).

## A Tabela Mestra

| Arquivo | O que contém | Quem escreve | Quando o agente vê | Onde fica |
|------|---------------|---------------|------------------------|----------------|
| **SOUL.md** | A identidade primária do agente — personalidade, tom, estilo de comunicação, o que evitar estilisticamente | Você. O Work4You gera um arquivo inicial automaticamente se não existir um; arquivos existentes nunca são sobrescritos | Slot nº 1 do prompt de sistema, no início da sessão | `~/.work4you/SOUL.md` (ou `$WORK4YOU_HOME/SOUL.md` com um home personalizado) — nunca o diretório de trabalho |
| **USER.md** | Perfil do usuário — seu nome, função, preferências, estilo de comunicação, expectativas | O agente, via a ferramenta `memory` (você pode restringir gravações com `write_approval`, ou editar entradas via `work4you journey edit`) | Injetado no prompt de sistema como um snapshot congelado no início da sessão | `~/.work4you/memories/` |
| **MEMORY.md** | Notas pessoais do agente — fatos sobre o ambiente, convenções do projeto, peculiaridades de ferramentas, coisas aprendidas | O agente, via a ferramenta `memory` (mesmas opções de restrição e edição do USER.md) | Injetado no prompt de sistema como um snapshot congelado no início da sessão | `~/.work4you/memories/` |
| **AGENTS.md** | Instruções do projeto, convenções, arquitetura — comandos, portas, caminhos, fluxos de trabalho específicos do repositório | Você (ou quem quer que crie o projeto) | Carregado no prompt de sistema na inicialização a partir do seu diretório de trabalho; cópias aninhadas são descobertas progressivamente à medida que o agente navega por subdiretórios | Diretório de trabalho do projeto + subdiretórios |
| **.work4you.md** / **WORK4YOU.md** | Instruções do projeto, como o AGENTS.md, mas específicas do Work4You e de prioridade máxima | Você | Carregado no prompt de sistema na inicialização (a primeira correspondência vence sobre o AGENTS.md) | Seu projeto — a descoberta sobe até a raiz do git |

:::info Um arquivo de contexto de projeto por sessão
Apenas **um** tipo de arquivo de contexto de projeto é carregado por sessão, e a primeira correspondência vence: `.work4you.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`. O `SOUL.md` é sempre carregado independentemente como a identidade do agente — ele não faz parte dessa cadeia de prioridade. Veja [Arquivos de Contexto](/user-guide/features/context-files) para a lista completa, incluindo compatibilidade com `CLAUDE.md` e `.cursorrules`.
:::

Uma forma resumida de lembrar:

- **SOUL.md** é quem o agente *é* — se algo deve acompanhá-lo em todo lugar, pertence aqui.
- **USER.md** é quem *você* é — o agente mantém isso para você.
- **MEMORY.md** é o que o agente *aprendeu* — ele também mantém isso sozinho.
- **AGENTS.md** (ou `.work4you.md`) é o que o *projeto* precisa — se pertence a um projeto, pertence aqui.

## "Por que ele esqueceu o que acabei de dizer?"

A memória (MEMORY.md e USER.md) é injetada no prompt de sistema como um **snapshot congelado**, capturado uma única vez no início da sessão — quando o agente salva algo no meio da sessão, a mudança é persistida em disco imediatamente, mas só aparecerá no prompt de sistema quando a próxima sessão começar. Isso é intencional: preserva o cache de prefixo do LLM para desempenho, e as respostas das ferramentas sempre mostram o estado ao vivo, então nada é perdido — inicie uma nova sessão e a memória atualizada estará lá. Detalhes completos em [Como a Memória Aparece no Prompt de Sistema](/user-guide/features/memory#how-memory-appears-in-the-system-prompt).

## Confusões Comuns

### "Coloquei fatos sobre mim no SOUL.md, mas o USER.md continuou vazio"

`SOUL.md` e `USER.md` são sistemas separados que nunca se alimentam mutuamente. `SOUL.md` é um arquivo de personalidade que **você** edita diretamente — ele molda o tom e a identidade, e seu conteúdo é injetado literalmente como o slot nº 1 do prompt. `USER.md` faz parte da memória persistente e é escrito pelo **agente** através da ferramenta `memory`. Se você quiser que fatos sobre você fiquem no USER.md, diga isso ao agente ("lembre-se de que prefiro respostas concisas") e ele os salva — editar o SOUL.md não popula a memória, e entradas de memória não mudam a persona. Use o SOUL.md para orientações duradouras de voz e personalidade; deixe preferências e fatos de perfil para a memória. Veja [O que deve ir no SOUL.md?](/user-guide/features/personality#what-should-go-in-soulmd) e [Dois Alvos Explicados](/user-guide/features/memory#two-targets-explained).

### "Eu disse meu nome no meio da sessão e ele agiu como se nunca tivesse ouvido"

Se o agente salvou seu nome na memória, o salvamento funcionou — confira nas respostas da ferramenta `memory` ou com `work4you journey list`. O que você está vendo é a regra do snapshot congelado acima: o prompt de sistema não se atualiza no meio da sessão, então o bloco de memória *injetado* ainda mostra o estado do início da sessão. O agente ainda pode usar o que você disse dentro da conversa atual (está no contexto), e a entrada salva estará no prompt de sistema a partir da próxima sessão em diante. O mesmo se aplica a edições feitas no `SOUL.md` ou `AGENTS.md` enquanto uma sessão está em execução: o contexto é montado no início da sessão, então reinicie a sessão para captar as mudanças.

:::tip Guia rápido de decisão
- Quer mudar como o agente **fala**? Edite `~/.work4you/SOUL.md` — [Personalidade e SOUL.md](/user-guide/features/personality).
- Quer que o agente **lembre de um fato**? Basta dizer a ele — ele mesmo salva na memória. [Memória Persistente](/user-guide/features/memory).
- Quer definir **regras de projeto**? Coloque um `AGENTS.md` (ou `.work4you.md`) no projeto — [Arquivos de Contexto](/user-guide/features/context-files).
- Precisa de uma mudança de personalidade **temporária**? Use `/personality` — é uma sobreposição no nível da sessão, sem necessidade de editar arquivos.
:::

## Documentos Relacionados

- [Memória Persistente](/user-guide/features/memory) — MEMORY.md, USER.md, a ferramenta `memory`, limites de capacidade, `write_approval`
- [Personalidade e SOUL.md](/user-guide/features/personality) — orientações de conteúdo do SOUL.md, presets de `/personality`, a pilha de prompts
- [Arquivos de Contexto](/user-guide/features/context-files) — AGENTS.md, `.work4you.md`, descoberta progressiva, verificação de segurança
