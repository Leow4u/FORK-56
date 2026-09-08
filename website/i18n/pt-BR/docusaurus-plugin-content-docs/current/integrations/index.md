---
title: "Integrations"
sidebar_label: "Visão geral"
sidebar_position: 0
---

# Integrations

O Work4You se conecta a sistemas externos para inferência de IA, servidores de ferramentas, fluxos de trabalho de IDE, acesso programático e muito mais. Essas integrações ampliam o que o Work4You pode fazer e onde ele pode rodar.

:::tip Comece por aqui
Se você só tem tempo para configurar uma integração, configure o [Work4You Portal](/integrations/work4you-portal) — um único login OAuth cobre mais de 300 modelos, além das quatro ferramentas do Tool Gateway (busca web, geração de imagens, TTS e automação de navegador).
:::

## Provedores de IA e Roteamento

O Work4You suporta múltiplos provedores de inferência de IA nativamente. Use `work4you model` para configurar interativamente, ou defina-os em `config.yaml`.

- **[AI Providers](/integrations/providers)** — OpenRouter, Anthropic, OpenAI, Google e qualquer endpoint compatível com OpenAI. O Work4You detecta automaticamente capacidades como visão, streaming e uso de ferramentas por provedor.
- **[Provider Routing](/user-guide/features/provider-routing)** — Controle refinado sobre quais provedores subjacentes atendem suas requisições do OpenRouter. Otimize para custo, velocidade ou qualidade com ordenação, listas de permissão, listas de bloqueio e priorização explícita.
- **[Fallback Providers](/user-guide/features/fallback-providers)** — Failover automático para provedores de LLM de backup quando seu modelo principal encontra erros. Inclui fallback do modelo principal e fallback independente de tarefas auxiliares para visão, compressão e extração web.

## Servidores de Ferramentas (MCP)

- **[MCP Servers](/user-guide/features/mcp)** — Conecte o Work4You a servidores de ferramentas externos via Model Context Protocol. Acesse ferramentas do GitHub, bancos de dados, sistemas de arquivos, stacks de navegador, APIs internas e muito mais, sem precisar escrever ferramentas nativas do Work4You. Suporta transportes stdio e SSE, filtragem de ferramentas por servidor e registro de recursos/prompts com reconhecimento de capacidades.

## Backends de Busca Web

As ferramentas `web_search` e `web_extract` suportam oito provedores de backend, configuráveis via `config.yaml` ou `work4you tools`:

| Backend | Variável de ambiente | Busca | Extração | Rastreamento (Crawl) |
|---------|---------|--------|---------|-------|
| **Firecrawl** (padrão) | `FIRECRAWL_API_KEY` | ✔ | ✔ | ✔ |
| **SearXNG** | `SEARXNG_URL` | ✔ | — | — |
| **Brave** (nível gratuito) | `BRAVE_SEARCH_API_KEY` | ✔ | — | — |
| **DuckDuckGo** (ddgs) | _(nenhuma)_ | ✔ | — | — |
| **Tavily** | `TAVILY_API_KEY` | ✔ | ✔ | ✔ |
| **Exa** | `EXA_API_KEY` | ✔ | ✔ | — |
| **Parallel** | `PARALLEL_API_KEY` | ✔ | ✔ | — |
| **xAI** | `XAI_API_KEY` | ✔ | — | — |

Exemplo de configuração rápida:

```yaml
web:
  backend: firecrawl    # firecrawl | searxng | brave-free | ddgs | tavily | exa | parallel | xai
```

Se `web.backend` não estiver definido, o backend é detectado automaticamente a partir de qual chave de API está disponível. O Firecrawl auto-hospedado também é suportado via `FIRECRAWL_API_URL`.

## Automação de Navegador

O Work4You inclui automação completa de navegador com múltiplas opções de backend para navegar em sites, preencher formulários e extrair informações:

- **Browserbase** — Navegadores em nuvem gerenciados com ferramentas anti-bot, resolução de CAPTCHA e proxies residenciais
- **Browser Use** — Provedor alternativo de navegador em nuvem
- **Local Chromium-family CDP** — Conecte-se ao seu Chrome, Brave, Chromium ou Edge em execução usando `/browser connect`
- **Local Chromium** — Navegador local headless via a CLI `agent-browser`

Veja [Browser Automation](/user-guide/features/browser) para configuração e uso.

## Provedores de Voz e TTS

Conversão de texto em fala e de fala em texto em todas as plataformas de mensageria:

| Provedor | Qualidade | Custo | Chave de API |
|----------|---------|------|---------|
| **Edge TTS** (padrão) | Boa | Gratuito | Nenhuma necessária |
| **ElevenLabs** | Excelente | Pago | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | Boa | Pago | `VOICE_TOOLS_OPENAI_KEY` |
| **MiniMax** | Boa | Pago | `MINIMAX_API_KEY` |
| **xAI TTS** | Boa | Pago | `XAI_API_KEY` |
| **NeuTTS** | Boa | Gratuito | Nenhuma necessária |

A conversão de fala em texto suporta oito provedores: faster-whisper local (gratuito, roda no dispositivo), um wrapper de comando local, Groq, a API Whisper da OpenAI, Mistral, xAI, ElevenLabs Scribe e DeepInfra. A transcrição de mensagens de voz funciona em Telegram, Discord, WhatsApp e outras plataformas de mensageria. Veja [Voice & TTS](/user-guide/features/tts) e [Voice Mode](/user-guide/features/voice-mode) para detalhes.

## Integração com IDE e Editor

- **[IDE Integration (ACP)](/user-guide/features/acp)** — Use o Work4You dentro de editores compatíveis com ACP, como VS Code, Zed e JetBrains. O Work4You roda como um servidor ACP, renderizando mensagens de chat, atividade de ferramentas, diffs de arquivos e comandos de terminal dentro do seu editor.

## Acesso Programático

- **[API Server](/user-guide/features/api-server)** — Exponha o Work4You como um endpoint HTTP compatível com OpenAI. Qualquer frontend que fale o formato OpenAI — Open WebUI, LobeChat, LibreChat, NextChat, ChatBox — pode se conectar e usar o Work4You como backend com todo o seu conjunto de ferramentas.

## Memória e Personalização

- **[Built-in Memory](/user-guide/features/memory)** — Memória persistente e curada via arquivos `MEMORY.md` e `USER.md`. O agente mantém repositórios limitados de anotações pessoais e dados de perfil do usuário que persistem entre sessões.
- **[Memory Providers](/user-guide/features/memory-providers)** — Conecte backends de memória externos para uma personalização mais profunda. Oito provedores são suportados: Honcho (raciocínio dialético), OpenViking (recuperação em camadas), Mem0 (extração em nuvem), Hindsight (grafos de conhecimento), Holographic (SQLite local), RetainDB (busca híbrida), ByteRover (baseado em CLI) e Supermemory.

## Plataformas de Mensageria

O Work4You roda como um bot de gateway em mais de 27 plataformas de mensageria, todas configuradas através do mesmo subsistema `gateway`:

- **[Telegram](/user-guide/messaging/telegram)**, **[Discord](/user-guide/messaging/discord)**, **[Slack](/user-guide/messaging/slack)**, **[WhatsApp](/user-guide/messaging/whatsapp)**, **[Signal](/user-guide/messaging/signal)**, **[Matrix](/user-guide/messaging/matrix)**, **[Mattermost](/user-guide/messaging/mattermost)**, **[Email](/user-guide/messaging/email)**, **[SMS](/user-guide/messaging/sms)**, **[DingTalk](/user-guide/messaging/dingtalk)**, **[Feishu/Lark](/user-guide/messaging/feishu)**, **[WeCom](/user-guide/messaging/wecom)**, **[WeCom Callback](/user-guide/messaging/wecom-callback)**, **[Weixin](/user-guide/messaging/weixin)**, **[BlueBubbles](/user-guide/messaging/bluebubbles)**, **[Buzz](/user-guide/messaging/buzz)**, **[QQ Bot](/user-guide/messaging/qqbot)**, **[Yuanbao](/user-guide/messaging/yuanbao)**, **[Home Assistant](/user-guide/messaging/homeassistant)**, **[Microsoft Teams](/user-guide/messaging/teams)**, **[Microsoft Teams Meetings](/user-guide/messaging/teams-meetings)**, **[Microsoft Graph Webhook](/user-guide/messaging/msgraph-webhook)**, **[Google Chat](/user-guide/messaging/google_chat)**, **[LINE](/user-guide/messaging/line)**, **[ntfy](/user-guide/messaging/ntfy)**, **[SimpleX](/user-guide/messaging/simplex)**, **[Open WebUI](/user-guide/messaging/open-webui)**, **[Webhooks](/user-guide/messaging/webhooks)**

Veja a [visão geral do Messaging Gateway](/user-guide/messaging) para a tabela comparativa de plataformas e o guia de configuração.

### Links de conexão rápida

As grandes plataformas têm uma URL canônica de "criar seu bot/app", e algumas aceitam parâmetros que pré-abrem o formulário certo. Pule a busca no console e vá direto ao ponto:

| Plataforma | Link direto | O que abre |
|----------|-------------|---------------|
| **Telegram** | [t.me/BotFather](https://t.me/BotFather) | Chat com o BotFather — envie `/newbot` para gerar um token de bot |
| **Discord** | [discord.com/developers/applications?new_application=true](https://discord.com/developers/applications?new_application=true) | Portal do desenvolvedor com o diálogo **New Application** já aberto |
| **Slack** | [api.slack.com/apps?new_app=1](https://api.slack.com/apps?new_app=1) | O diálogo **Create New App** — escolha *From an app manifest* e cole o manifesto gerado por `work4you slack manifest --agent-view` |
| **LINE** | [developers.line.biz/console](https://developers.line.biz/console/) | Console de desenvolvedores do LINE para criar um canal de Messaging API |
| **Feishu/Lark** | [open.feishu.cn/app](https://open.feishu.cn/app) | Console da plataforma aberta do Feishu para criar um app personalizado |

A página de configuração de cada plataforma guia você pelo que fazer assim que chegar lá.

## Espaços de Colaboração

- **[Buzz](/integrations/buzz)** — O workspace de humanos e agentes baseado em Nostr da Block. Três caminhos de integração: o Buzz Desktop inicia o Work4You como um runtime ACP gerenciado, a ponte de relay `buzz-acp` hospeda uma identidade Work4You no lado do servidor, ou a plataforma de gateway nativa entra em canais do Buzz com memória/skills/aprovações/cron completos do Work4You. A página de visão geral compara as três opções.

## Automação Residencial

- **[Home Assistant](/user-guide/messaging/homeassistant)** — Controle dispositivos de casa inteligente através de quatro ferramentas dedicadas (`ha_list_entities`, `ha_get_state`, `ha_list_services`, `ha_call_service`). O toolset do Home Assistant é ativado automaticamente quando `HASS_TOKEN` está configurado.

## Plugins

- **[Plugin System](/user-guide/features/plugins)** — Estenda o Work4You com ferramentas personalizadas, hooks de ciclo de vida e comandos de CLI sem modificar o núcleo do código. Os plugins são descobertos em `~/.work4you/plugins/`, em `.work4you/plugins/` local ao projeto e em entry points instalados via pip.
- **[Build a Plugin](/developer-guide/plugins)** — Guia passo a passo para criar plugins do Work4You com ferramentas, hooks e comandos de CLI.

## Treinamento e Avaliação

- **[Batch Processing](/user-guide/features/batch-processing)** — Execute o agente em centenas de prompts em paralelo, gerando dados de trajetória estruturados no formato ShareGPT para geração de dados de treinamento ou avaliação.
