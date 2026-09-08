---
title: "Visão Geral dos Recursos"
sidebar_label: "Visão Geral"
sidebar_position: 1
---

# Visão Geral dos Recursos

O Work4You inclui um rico conjunto de capacidades que vão muito além do chat básico. Da memória persistente e contexto com reconhecimento de arquivos até automação de navegador e conversas por voz, esses recursos trabalham juntos para tornar o Work4You um poderoso assistente autônomo.

:::tip Não sabe por onde começar?
`work4you setup --portal` cobre um provedor de modelo mais as quatro ferramentas do Tool Gateway (busca web, geração de imagem, TTS, navegador) em um único comando. Veja [Work4You Portal](/integrations/work4you-portal).
:::

## Núcleo

- **[Tools & Toolsets](tools.md)** — Tools são funções que estendem as capacidades do agente. Elas são organizadas em toolsets lógicos que podem ser habilitados ou desabilitados por plataforma, cobrindo busca web, execução de terminal, edição de arquivos, memória, delegação e muito mais.
- **[Sistema de Skills](skills.md)** — Documentos de conhecimento sob demanda que o agente pode carregar quando necessário. As Skills seguem um padrão de divulgação progressiva para minimizar o uso de tokens e são compatíveis com o padrão aberto [agentskills.io](https://agentskills.io/specification).
- **[Memória Persistente](memory.md)** — Memória limitada e curada que persiste entre sessões. O Work4You lembra suas preferências, projetos, ambiente e coisas que aprendeu por meio de `MEMORY.md` e `USER.md`.
- **[Arquivos de Contexto](context-files.md)** — O Work4You descobre e carrega automaticamente arquivos de contexto do projeto (`.work4you.md`, `AGENTS.md`, `CLAUDE.md`, `SOUL.md`, `.cursorrules`) que moldam seu comportamento no seu projeto.
- **[Referências de Contexto](context-references.md)** — Digite `@` seguido de uma referência para injetar arquivos, pastas, diffs do git e URLs diretamente nas suas mensagens. O Work4You expande a referência inline e anexa o conteúdo automaticamente.
- **[Checkpoints](../checkpoints-and-rollback.md)** — O Work4You tira automaticamente um snapshot do seu diretório de trabalho antes de fazer alterações em arquivos, dando a você uma rede de segurança para reverter com `/rollback` caso algo dê errado.

## Automação

- **[Tarefas Agendadas (Cron)](cron.md)** — Agende tarefas para rodar automaticamente com linguagem natural ou expressões cron. As tarefas podem anexar skills, entregar resultados em qualquer plataforma e suportam operações de pausar/retomar/editar.
- **[Delegação para Subagentes](delegation.md)** — A tool `delegate_task` cria instâncias de agentes filhos com contexto isolado, toolsets restritos e suas próprias sessões de terminal. Roda 3 subagentes simultâneos por padrão (configurável) para fluxos de trabalho paralelos.
- **[Execução de Código](code-execution.md)** — A tool `execute_code` permite que o agente escreva scripts Python que chamam as tools do Work4You programaticamente, condensando fluxos de trabalho de múltiplas etapas em um único turno do LLM via execução de RPC em sandbox.
- **[Event Hooks](hooks.md)** — Execute código personalizado em pontos-chave do ciclo de vida. Os hooks de gateway cuidam de logging, alertas e webhooks; os hooks de plugin cuidam de interceptação de tools, métricas e guardrails.
- **[Processamento em Lote](batch-processing.md)** — Execute o agente Work4You em centenas ou milhares de prompts em paralelo, gerando dados de trajetória estruturados no formato ShareGPT para geração de dados de treinamento ou avaliação.

## Mídia & Web

- **[Modo de Voz](voice-mode.md)** — Interação por voz completa entre CLI e plataformas de mensagens. Converse com o agente usando seu microfone, ouça respostas faladas e tenha conversas de voz ao vivo em canais de voz do Discord.
- **[Palavra de Ativação](wake-word.md)** — Gatilho "Hey Work4You" para uso sem as mãos na CLI, TUI e no aplicativo desktop. Um detector de hotword no dispositivo inicia uma sessão de voz quando você fala a frase de ativação.
- **[Automação de Navegador](browser.md)** — Automação de navegador completa com múltiplos backends: Browserbase na nuvem, Browser Use na nuvem, Chrome/Brave/Chromium/Edge local via CDP, ou Chromium local. Navegue em sites, preencha formulários e extraia informações.
- **[Visão & Colagem de Imagem](vision.md)** — Suporte multimodal de visão. Cole imagens da sua área de transferência na CLI e peça ao agente para analisá-las, descrevê-las ou trabalhar com elas usando qualquer modelo com capacidade de visão.
- **[Geração de Imagem](image-generation.md)** — Gere imagens a partir de prompts de texto usando FAL.ai. Onze modelos suportados (FLUX 2 Klein/Pro, GPT-Image 1.5/2, Nano Banana Pro, Ideogram V3, Recraft V4 Pro, Qwen, Z-Image Turbo, Krea V2 Medium/Large); escolha um via `work4you tools`.
- **[Voz & TTS](tts.md)** — Saída de texto para voz e transcrição de mensagens de voz em todas as plataformas de mensagens, com dez opções de provedores nativos: Edge TTS (gratuito), ElevenLabs, OpenAI TTS, MiniMax, Mistral Voxtral, Google Gemini, xAI, NeuTTS, KittenTTS e Piper — além de provedores de comando personalizados para qualquer CLI de TTS local.

## Integrações

- **[Integração MCP](mcp.md)** — Conecte-se a qualquer servidor MCP via transporte stdio ou HTTP. Acesse tools externas do GitHub, bancos de dados, sistemas de arquivos e APIs internas sem escrever tools nativas do Work4You. Inclui filtragem de tools por servidor e suporte a sampling.
- **[Roteamento de Provedores](provider-routing.md)** — Controle refinado sobre quais provedores de IA lidam com suas requisições. Otimize para custo, velocidade ou qualidade com ordenação, listas de permissão, listas de bloqueio e ordem de prioridade.
- **[Provedores de Fallback](fallback-providers.md)** — Failover automático para provedores de LLM de backup quando seu modelo principal encontra erros, incluindo fallback independente para tarefas auxiliares como visão e compressão.
- **[Pools de Credenciais](credential-pools.md)** — Distribua chamadas de API entre várias chaves para o mesmo provedor. Rotação automática em caso de limites de taxa ou falhas.
- **[Cache de prompt](../configuration#prompt-caching)** — Cache de prefixo entre sessões de 1 hora, embutido, para Claude na Anthropic nativa, OpenRouter e Work4You Portal. Sempre ativo; nenhuma configuração necessária.
- **[Provedores de Memória](memory-providers.md)** — Conecte backends de memória externos (Honcho, OpenViking, Mem0, Hindsight, Holographic, RetainDB, ByteRover, Supermemory) para modelagem de usuário e personalização entre sessões além do sistema de memória embutido.
- **[Servidor de API](api-server.md)** — Exponha o Work4You como um endpoint HTTP compatível com OpenAI. Conecte qualquer frontend que fale o formato OpenAI — Open WebUI, LobeChat, LibreChat e outros.
- **[Integração com IDE (ACP)](acp.md)** — Use o Work4You dentro de editores compatíveis com ACP, como VS Code, Zed e JetBrains. Chat, atividade de tools, diffs de arquivos e comandos de terminal são renderizados dentro do seu editor.
- **[Processamento em Lote](batch-processing.md)** — Execute o agente sobre muitos prompts ou tarefas em paralelo a partir da CLI, com saídas estruturadas e captura de trajetória adequadas para avaliações ou pipelines de treinamento posteriores.

## Personalização

- **[Personalidade & SOUL.md](personality.md)** — Personalidade do agente totalmente personalizável. `SOUL.md` é o arquivo de identidade principal — o primeiro item no system prompt — e você pode alternar entre presets `/personality` embutidos ou personalizados por sessão.
- **[Skins & Temas](skins.md)** — Personalize a apresentação visual da CLI: cores do banner, faces e verbos do spinner, rótulos da caixa de resposta, texto de branding e o prefixo de atividade de tools.
- **[Plugins](plugins.md)** — Adicione tools, hooks e integrações personalizadas sem modificar o código principal. Três tipos de plugin: plugins gerais (tools/hooks), provedores de memória (conhecimento entre sessões) e motores de contexto (gerenciamento de contexto alternativo). Gerenciados pela interface interativa unificada `work4you plugins`.
