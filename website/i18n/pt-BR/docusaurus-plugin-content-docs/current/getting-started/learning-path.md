---
sidebar_position: 3
title: 'Trilha de Aprendizado'
description: 'Escolha sua trilha de aprendizado pela documentação do Work4You com base no seu nível de experiência e nos seus objetivos.'
---

# Trilha de Aprendizado

O Work4You consegue fazer muita coisa — assistente de CLI, bot de Telegram/Discord, automação de tarefas, treinamento com RL, e mais. Esta página ajuda você a descobrir por onde começar e o que ler com base no seu nível de experiência e no que você está tentando realizar.

:::tip Comece Aqui
Se você ainda não instalou o Work4You, comece pelo guia de [Instalação](/getting-started/installation) e depois siga o [Quickstart](/getting-started/quickstart). Tudo abaixo assume que você já tem uma instalação funcionando.
:::

:::tip Configuração de provedor pela primeira vez
Usuários de primeira viagem quase sempre querem `work4you setup --portal` — um único OAuth cobre um modelo mais as quatro ferramentas do Tool Gateway (busca/imagem/TTS/navegador). Veja [Work4You Portal](/integrations/work4you-portal).
:::

## Como Usar Esta Página

- **Sabe o seu nível?** Vá direto para a [tabela por nível de experiência](#by-experience-level) e siga a ordem de leitura do seu nível.
- **Tem um objetivo específico?** Pule para [Por Caso de Uso](#by-use-case) e encontre o cenário que combina com você.
- **Só está dando uma olhada?** Confira a tabela de [Principais Recursos](#key-features-at-a-glance) para uma visão geral rápida de tudo o que o Work4You pode fazer.

## Por Nível de Experiência

| Nível | Objetivo | Leitura Recomendada | Tempo Estimado |
|---|---|---|---|
| **Iniciante** | Colocar tudo para rodar, ter conversas básicas, usar ferramentas embutidas | [Instalação](/getting-started/installation) → [Quickstart](/getting-started/quickstart) → [Uso da CLI](/user-guide/cli) → [Configuração](/user-guide/configuration) | ~1 hora |
| **Intermediário** | Configurar bots de mensagens, usar recursos avançados como memória, tarefas cron e skills | [Sessões](/user-guide/sessions) → [Mensagens](/user-guide/messaging) → [Ferramentas](/user-guide/features/tools) → [Skills](/user-guide/features/skills) → [Memória](/user-guide/features/memory) → [Cron](/user-guide/features/cron) | ~2–3 horas |
| **Avançado** | Criar ferramentas personalizadas, criar skills, treinar modelos com RL, contribuir com o projeto | [Arquitetura](/developer-guide/architecture) → [Adicionando Ferramentas](/developer-guide/adding-tools) → [Criando Skills](/developer-guide/creating-skills) → [Contribuindo](/developer-guide/contributing) | ~4–6 horas |

## Por Caso de Uso

Escolha o cenário que combina com o que você quer fazer. Cada um leva você aos documentos relevantes na ordem em que devem ser lidos.

### "Quero um assistente de código na CLI"

Use o Work4You como um assistente interativo de terminal para escrever, revisar e executar código.

1. [Instalação](/getting-started/installation)
2. [Quickstart](/getting-started/quickstart)
3. [Uso da CLI](/user-guide/cli)
4. [Execução de Código](/user-guide/features/code-execution)
5. [Arquivos de Contexto](/user-guide/features/context-files)
6. [Dicas e Truques](/guides/tips)

:::tip
Passe arquivos diretamente para sua conversa com arquivos de contexto. O Work4You consegue ler, editar e executar código nos seus projetos.
:::

### "Quero um bot de Telegram/Discord"

Implante o Work4You como um bot na sua plataforma de mensagens favorita.

1. [Instalação](/getting-started/installation)
2. [Configuração](/user-guide/configuration)
3. [Visão Geral de Mensagens](/user-guide/messaging)
4. [Configuração do Telegram](/user-guide/messaging/telegram)
5. [Configuração do Discord](/user-guide/messaging/discord)
6. [Modo de Voz](/user-guide/features/voice-mode)
7. [Usando o Modo de Voz com o Work4You](/guides/use-voice-mode-with-work4you)
8. [Segurança](/user-guide/security)

Para exemplos completos de projetos, veja:
- [Bot de Resumo Diário](/guides/daily-briefing-bot)
- [Assistente de Equipe no Telegram](/guides/team-telegram-assistant)

### "Quero automatizar tarefas"

Agende tarefas recorrentes, execute processamentos em lote ou encadeie ações de agentes.

1. [Quickstart](/getting-started/quickstart)
2. [Agendamento com Cron](/user-guide/features/cron)
3. [Processamento em Lote](/user-guide/features/batch-processing)
4. [Delegação](/user-guide/features/delegation)
5. [Hooks](/user-guide/features/hooks)

:::tip
As tarefas cron permitem que o Work4You execute tarefas em um horário programado — resumos diários, verificações periódicas, relatórios automatizados — sem que você precise estar presente.
:::

### "Quero uma equipe de Bots especialistas"

Crie Bots nomeados com seu próprio modelo, memória, skills, rotinas e conversas, e depois reúna-os em grupos ou através de `@menções`.

1. [Desktop](/user-guide/desktop)
2. [Perfis](/user-guide/profiles)
3. [Bot Mode](/user-guide/bot-mode)
4. [Agendamento com Cron](/user-guide/features/cron)
5. [Desktop Multi-conexão](/user-guide/multi-connection-desktop)

### "Quero criar ferramentas/skills personalizadas"

Estenda o Work4You com suas próprias ferramentas e pacotes de skills reutilizáveis.

1. [Plugins](/user-guide/features/plugins)
2. [Construindo um Plugin do Work4You](/developer-guide/plugins)
3. [Visão Geral de Ferramentas](/user-guide/features/tools)
4. [Visão Geral de Skills](/user-guide/features/skills)
5. [MCP (Model Context Protocol)](/user-guide/features/mcp)
6. [Arquitetura](/developer-guide/architecture)
7. [Adicionando Ferramentas](/developer-guide/adding-tools)
8. [Criando Skills](/developer-guide/creating-skills)

:::tip
Para a maioria das criações de ferramentas personalizadas, comece com plugins. A página [Adicionando Ferramentas](/developer-guide/adding-tools)
é voltada para o desenvolvimento do núcleo do Work4You, não para o caminho comum de ferramentas personalizadas de usuário.
:::

### "Quero treinar modelos"

Use aprendizado por reforço para ajustar o comportamento de modelos com o pipeline de treinamento RL do Work4You (com tecnologia do [Atropos](https://github.com/Work4You/atropos)).

1. [Quickstart](/getting-started/quickstart)
2. [Configuração](/user-guide/configuration)
3. [Ambientes RL do Atropos](https://github.com/Work4You/atropos) (externo)
4. [Roteamento de Provedor](/user-guide/features/provider-routing)
5. [Arquitetura](/developer-guide/architecture)

:::tip
O treinamento com RL funciona melhor quando você já entende o básico de como o Work4You lida com conversas e chamadas de ferramentas. Siga a trilha Iniciante primeiro se você é novo.
:::

### "Quero usá-lo como uma biblioteca Python"

Integre o Work4You às suas próprias aplicações Python de forma programática.

1. [Instalação](/getting-started/installation)
2. [Quickstart](/getting-started/quickstart)
3. [Guia da Biblioteca Python](/guides/python-library)
4. [Arquitetura](/developer-guide/architecture)
5. [Ferramentas](/user-guide/features/tools)
6. [Sessões](/user-guide/sessions)

## Principais Recursos em Resumo

Não sabe o que está disponível? Aqui está um diretório rápido dos principais recursos:

| Recurso | O Que Faz | Link |
|---|---|---|
| **Ferramentas** | Ferramentas embutidas que o agente pode chamar (I/O de arquivos, busca, shell, etc.) | [Ferramentas](/user-guide/features/tools) |
| **Skills** | Pacotes de plugins instaláveis que adicionam novas capacidades | [Skills](/user-guide/features/skills) |
| **Memória** | Memória persistente entre sessões | [Memória](/user-guide/features/memory) |
| **Bot Mode** | Bots especialistas nomeados com conversas persistentes, rotinas, grupos e `@menções` | [Bot Mode](/user-guide/bot-mode) |
| **Arquivos de Contexto** | Insira arquivos e diretórios nas conversas | [Arquivos de Contexto](/user-guide/features/context-files) |
| **MCP** | Conecte-se a servidores de ferramentas externos via Model Context Protocol | [MCP](/user-guide/features/mcp) |
| **Cron** | Agende tarefas recorrentes do agente | [Cron](/user-guide/features/cron) |
| **Delegação** | Crie subagentes para trabalho paralelo | [Delegação](/user-guide/features/delegation) |
| **Execução de Código** | Execute scripts Python que chamam ferramentas do Work4You de forma programática | [Execução de Código](/user-guide/features/code-execution) |
| **Navegador** | Navegação e extração de dados da web | [Navegador](/user-guide/features/browser) |
| **Hooks** | Callbacks e middleware orientados a eventos | [Hooks](/user-guide/features/hooks) |
| **Processamento em Lote** | Processe múltiplas entradas em massa | [Processamento em Lote](/user-guide/features/batch-processing) |
| **Roteamento de Provedor** | Roteie requisições entre múltiplos provedores de LLM | [Roteamento de Provedor](/user-guide/features/provider-routing) |

## O Que Ler a Seguir

Com base em onde você está agora:

- **Acabou de instalar?** → Vá para o [Quickstart](/getting-started/quickstart) para rodar sua primeira conversa.
- **Terminou o Quickstart?** → Leia [Uso da CLI](/user-guide/cli) e [Configuração](/user-guide/configuration) para personalizar sua instalação.
- **Confortável com o básico?** → Explore [Ferramentas](/user-guide/features/tools), [Skills](/user-guide/features/skills) e [Memória](/user-guide/features/memory) para liberar todo o poder do agente.
- **Configurando para uma equipe?** → Leia [Segurança](/user-guide/security) e [Sessões](/user-guide/sessions) para entender controle de acesso e gerenciamento de conversas.
- **Pronto para construir?** → Vá para o [Guia do Desenvolvedor](/developer-guide/architecture) para entender os detalhes internos e começar a contribuir.
- **Quer exemplos práticos?** → Confira a seção de [Guias](/guides/tips) para projetos reais e dicas.

:::tip
Você não precisa ler tudo. Escolha a trilha que combina com o seu objetivo, siga os links na ordem, e você será produtivo rapidamente. Você sempre pode voltar a esta página para encontrar seu próximo passo.
:::
