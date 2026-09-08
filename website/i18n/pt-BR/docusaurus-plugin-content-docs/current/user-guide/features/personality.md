---
sidebar_position: 9
title: "Personalidade e SOUL.md"
description: "Personalize a personalidade do Work4You com um SOUL.md global, personalidades integradas e definições de persona personalizadas"
---

# Personalidade e SOUL.md

A personalidade do Work4You é totalmente personalizável. `SOUL.md` é a **identidade primária** — é a primeira coisa no prompt de sistema e define quem é o agente.

- `SOUL.md` — um arquivo de persona durável que vive em `WORK4YOU_HOME` e serve como a identidade do agente (posição nº 1 no prompt de sistema)
- predefinições integradas ou personalizadas de `/personality` — sobreposições do prompt de sistema em nível de sessão

Se você quiser mudar quem é o Work4You — ou substituí-lo por uma persona de agente completamente diferente — edite o `SOUL.md`.

## Como o SOUL.md funciona agora

Agora o Work4You cria automaticamente um `SOUL.md` padrão em:

```text
~/.work4you/SOUL.md
```

Mais precisamente, ele usa o `WORK4YOU_HOME` da instância atual, então se você executar o Work4You com um diretório home personalizado, ele usará:

```text
$WORK4YOU_HOME/SOUL.md
```

### Comportamento importante

- **O SOUL.md é a identidade primária do agente.** Ele ocupa a posição nº 1 no prompt de sistema, substituindo a identidade padrão fixa no código.
- O Work4You cria automaticamente um `SOUL.md` inicial caso ainda não exista um
- Arquivos `SOUL.md` já existentes do usuário nunca são sobrescritos
- O Work4You carrega o `SOUL.md` somente de `WORK4YOU_HOME`
- O Work4You não procura por `SOUL.md` no diretório de trabalho atual
- Se o `SOUL.md` existir mas estiver vazio, ou não puder ser carregado, o Work4You recorre a uma identidade padrão integrada
- Se o `SOUL.md` tiver conteúdo, esse conteúdo é injetado literalmente após a varredura de segurança e o truncamento
- O SOUL.md **não** é duplicado na seção de arquivos de contexto — ele aparece apenas uma vez, como identidade

Isso torna o `SOUL.md` uma verdadeira identidade por usuário ou por instância, não apenas uma camada aditiva.

## Por que esse design

Isso mantém a personalidade previsível.

Se o Work4You carregasse o `SOUL.md` de qualquer diretório em que você o iniciasse, sua personalidade poderia mudar inesperadamente entre projetos. Ao carregar somente de `WORK4YOU_HOME`, a personalidade pertence à própria instância do Work4You.

Isso também facilita explicar aos usuários:
- "Edite `~/.work4you/SOUL.md` para mudar a personalidade padrão do Work4You."

## Onde editá-lo

Para a maioria dos usuários:

```bash
~/.work4you/SOUL.md
```

Se você usa um home personalizado:

```bash
$WORK4YOU_HOME/SOUL.md
```

## O que deve entrar no SOUL.md?

Use-o para orientações duráveis de voz e personalidade, como:
- tom
- estilo de comunicação
- nível de franqueza
- estilo de interação padrão
- o que evitar estilisticamente
- como o Work4You deve lidar com incerteza, discordância ou ambiguidade

Use-o menos para:
- instruções pontuais de projeto
- caminhos de arquivo
- convenções do repositório
- detalhes temporários de fluxo de trabalho

Isso pertence ao `AGENTS.md`, não ao `SOUL.md`.

## Bom conteúdo para o SOUL.md

Um bom arquivo SOUL é:
- estável em diferentes contextos
- amplo o suficiente para se aplicar a muitas conversas
- específico o suficiente para moldar materialmente a voz
- focado em comunicação e identidade, não em instruções específicas de tarefa

### Exemplo

```markdown
# Personality

You are a pragmatic senior engineer with strong taste.
You optimize for truth, clarity, and usefulness over politeness theater.

## Style
- Be direct without being cold
- Prefer substance over filler
- Push back when something is a bad idea
- Admit uncertainty plainly
- Keep explanations compact unless depth is useful

## What to avoid
- Sycophancy
- Hype language
- Repeating the user's framing if it's wrong
- Overexplaining obvious things

## Technical posture
- Prefer simple systems over clever systems
- Care about operational reality, not idealized architecture
- Treat edge cases as part of the design, not cleanup
```

## O que o Work4You injeta no prompt

O conteúdo do `SOUL.md` vai diretamente para a posição nº 1 do prompt de sistema — a posição de identidade do agente. Nenhuma linguagem de wrapper é adicionada ao redor dele.

O conteúdo passa por:
- varredura de injeção de prompt
- truncamento caso seja grande demais

Se o arquivo estiver vazio, contiver apenas espaços em branco, ou não puder ser lido, o Work4You recorre a uma identidade padrão integrada ("You are Work4You, an intelligent AI assistant created by Work4You..."). Esse fallback também se aplica quando `skip_context_files` está definido (por exemplo, em contextos de subagente/delegação).

## Varredura de segurança

O `SOUL.md` é varrido como outros arquivos portadores de contexto em busca de padrões de injeção de prompt antes da inclusão.

Isso significa que você ainda deve mantê-lo focado em persona/voz em vez de tentar inserir instruções meta estranhas.

## SOUL.md vs. AGENTS.md

Esta é a distinção mais importante.

### SOUL.md
Use para:
- identidade
- tom
- estilo
- padrões de comunicação
- comportamento em nível de personalidade

### AGENTS.md
Use para:
- arquitetura do projeto
- convenções de código
- preferências de ferramentas
- fluxos de trabalho específicos do repositório
- comandos, portas, caminhos, notas de implantação

Uma regra útil:
- se deve te seguir para todo lugar, pertence ao `SOUL.md`
- se pertence a um projeto, pertence ao `AGENTS.md`

## SOUL.md vs. `/personality`

`SOUL.md` é sua personalidade padrão durável.

`/personality` é uma sobreposição em nível de sessão que muda ou complementa o prompt de sistema atual.

Portanto:
- `SOUL.md` = voz de base
- `/personality` = troca de modo temporária

Exemplos:
- mantenha um SOUL padrão pragmático e use `/personality teacher` para uma conversa de tutoria
- mantenha um SOUL conciso e use `/personality creative` para brainstorming

## Personalidades integradas

O Work4You vem com personalidades integradas para as quais você pode trocar com `/personality`.

| Nome | Descrição |
|------|-------------|
| **helpful** | Assistente amigável e de uso geral |
| **concise** | Respostas breves e diretas |
| **technical** | Especialista técnico detalhado e preciso |
| **creative** | Pensamento inovador e fora da caixa |
| **teacher** | Educador paciente com exemplos claros |
| **kawaii** | Expressões fofas, brilhos e entusiasmo ★ |
| **catgirl** | Neko-chan com expressões de gato, nya~ |
| **pirate** | Capitão Work4You, pirata antenado em tecnologia |
| **shakespeare** | Prosa bárdica com floreio dramático |
| **surfer** | Vibe totalmente tranquila, mano |
| **noir** | Narração de detetive durão |
| **uwu** | Máxima fofura com fala em uwu |
| **philosopher** | Contemplação profunda a cada consulta |
| **hype** | ENERGIA E ENTUSIASMO MÁXIMOS!!! |

## Trocando de personalidade com comandos

### CLI

```text
/personality
/personality concise
/personality technical
```

### Plataformas de mensagens

```text
/personality teacher
```

Essas são sobreposições convenientes, mas seu `SOUL.md` global ainda dá ao Work4You sua personalidade padrão persistente, a menos que a sobreposição a mude significativamente.

## Personalidades personalizadas na configuração

As personalidades integradas estão sempre disponíveis em todas as superfícies (CLI, plataformas de mensagens, TUI e aplicativo desktop). Você pode adicionar as suas próprias — ou sobrescrever uma integrada reutilizando seu nome — em `~/.work4you/config.yaml`, em `agent.personalities`.

```yaml
agent:
  personalities:
    codereviewer: >
      You are a meticulous code reviewer. Identify bugs, security issues,
      performance concerns, and unclear design choices. Be precise and constructive.
```

Depois troque para ela com:

```text
/personality codereviewer
```

Sua seleção é armazenada como um nome em `display.personality`. As personalidades nunca tocam em `agent.system_prompt` — esse campo é reservado para um prompt de sistema manual que você mesmo escreve, e só se aplica quando nenhuma personalidade está selecionada.

## Voltando ao padrão

Para cancelar a sobreposição de personalidade ativa e voltar ao comportamento base (sua persona de `SOUL.md`, mais `agent.system_prompt` se você tiver definido um), use qualquer um destes:

```text
/personality none
/personality default
/personality neutral
```

Todos os três limpam a seleção (`display.personality`) e a mudança entra em vigor na sua próxima mensagem. Executar `/personality` sem argumentos também lista `none` junto com as predefinições disponíveis e marca a que está ativa.

:::note Redefinição única na atualização
Versões mais antigas do Work4You salvavam o estado da personalidade de forma inconsistente entre as superfícies, o que podia reativar uma personalidade que você havia desligado anteriormente. Na sua primeira execução após atualizar, qualquer seleção de personalidade salva é redefinida para `none` uma única vez (a migração imprime qual personalidade foi limpa). Reative-a com `/personality <nome>` se ainda a quiser. O texto manual de `agent.system_prompt` nunca é alterado.
:::

## Fluxo de trabalho recomendado

Uma boa configuração padrão é:

1. Manter um `SOUL.md` global bem pensado em `~/.work4you/SOUL.md`
2. Colocar instruções de projeto em `AGENTS.md`
3. Usar `/personality` apenas quando quiser uma mudança de modo temporária

Isso te dá:
- uma voz estável
- comportamento específico de projeto onde ele pertence
- controle temporário quando necessário

## Como a personalidade interage com o prompt completo

Em alto nível, a pilha do prompt inclui:
1. **SOUL.md** (identidade do agente — ou fallback integrado se o SOUL.md não estiver disponível)
2. orientação de comportamento consciente de ferramentas
3. memória/contexto do usuário
4. orientação de skills
5. arquivos de contexto (`AGENTS.md`, `.cursorrules`)
6. carimbo de data/hora
7. dicas de formatação específicas da plataforma
8. sobreposições opcionais de prompt de sistema, como `/personality`

`SOUL.md` é a fundação — tudo o mais se constrói em cima dele.

## Documentação relacionada

- [Arquivos de Contexto](/user-guide/features/context-files)
- [Configuração](/user-guide/configuration)
- [Dicas e Boas Práticas](/guides/tips)
- [Guia do SOUL.md](/guides/use-soul-with-work4you)

## Aparência da CLI vs. personalidade conversacional

A personalidade conversacional e a aparência da CLI são separadas:

- `SOUL.md`, `agent.system_prompt` e `/personality` afetam como o Work4You fala
- `display.skin` e `/skin` afetam a aparência do Work4You no terminal

Para a aparência do terminal, veja [Skins e Temas](./skins.md).
