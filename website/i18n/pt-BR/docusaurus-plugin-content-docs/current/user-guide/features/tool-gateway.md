---
title: "Work4You Tool Gateway"
description: "Uma assinatura, todas as ferramentas. Busca web, geração de imagem, TTS e navegadores na nuvem — tudo roteado pelo Work4You Portal sem chaves de API extras."
sidebar_label: "Tool Gateway"
sidebar_position: 2
---

# Work4You Tool Gateway

**Uma assinatura. Todas as ferramentas embutidas.**

O Tool Gateway está incluído em toda assinatura paga do [Work4You Portal](https://portal.work4you.ai). Ele roteia as chamadas de tools do Work4You — busca web, geração de imagem, texto para voz e automação de navegador na nuvem — pela infraestrutura que o Work4You já opera, para que você não precise se cadastrar no Firecrawl, FAL, OpenAI, Browser Use ou qualquer outro serviço só para tornar seu agente útil.

<div style={{display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1.5rem 0'}}>
  <a href="https://portal.work4you.ai/manage-subscription" style={{background: 'var(--ifm-color-primary)', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold'}}>Iniciar ou gerenciar assinatura →</a>
</div>

## O que está incluído

| | Ferramenta | O que você ganha |
|---|---|---|
| 🔍 | **Busca e extração web** | Busca web de nível profissional e extração de página completa via Firecrawl. Sem limites de taxa para se preocupar — o gateway cuida do escalonamento. |
| 🎨 | **Geração de imagem** | Nove modelos sob um único endpoint: **FLUX 2 Klein 9B**, **FLUX 2 Pro**, **Z-Image Turbo**, **Nano Banana Pro** (Gemini 3 Pro Image), **GPT Image 1.5**, **GPT Image 2**, **Ideogram V3**, **Recraft V4 Pro**, **Qwen Image**. Escolha por geração com uma flag, ou deixe o Work4You usar o padrão FLUX 2 Klein. |
| 🔊 | **Texto para voz** | Vozes do OpenAI TTS conectadas à tool `text_to_speech`. Envie notas de voz no Telegram, gere áudio para pipelines, narre qualquer coisa. |
| 🌐 | **Automação de navegador na nuvem** | Sessões headless do Chromium via Browser Use. `browser_navigate`, `browser_click`, `browser_type`, `browser_vision` — todos os primitivos de condução do agente, sem necessidade de conta no Browserbase. |

As quatro são cobradas por uso, contra sua assinatura Work4You. Use qualquer combinação — rode o gateway para web e imagens mantendo sua própria chave ElevenLabs para TTS, ou roteie tudo pelo Work4You.

## Por que isso existe

Construir um agente que realmente *faz coisas* significa costurar 5 ou mais assinaturas de API — cada uma com seu próprio cadastro, limites de taxa, cobrança e peculiaridades. O gateway condensa tudo isso em uma única conta:

- **Uma fatura.** Pague o Work4You; nós cuidamos do resto.
- **Um cadastro.** Nenhuma conta no Firecrawl, FAL, Browser Use ou OpenAI audio para gerenciar.
- **Uma chave.** Seu OAuth do Work4You Portal cobre todas as ferramentas.
- **Mesma qualidade.** Os mesmos backends que a rota de chave direta usa — apenas intermediados por nós.

Traga suas próprias chaves quando quiser — por ferramenta, a qualquer momento. O gateway não é um aprisionamento, é um atalho.

## Primeiros passos

Há três caminhos de entrada — escolha o que melhor se encaixa na sua situação:

```bash
work4you setup --portal     # Instalação nova: OAuth do Work4You + define Work4You como provedor + ativa o Tool Gateway em um único passo
```

```bash
work4you model              # Troca seu provedor de inferência para o Work4You Portal — o Work4You então oferece ativar o gateway para todas as ferramentas
```

```bash
work4you tools              # Ativa o gateway por ferramenta — escolha "Work4You Subscription" para qualquer ferramenta que quiser
```

`work4you setup --portal` e `work4you model` são os caminhos "tudo de uma vez": faça login uma vez, opcionalmente ative todas as ferramentas para o gateway. `work4you tools` é o caminho "à la carte" — ative apenas as ferramentas que quiser, uma de cada vez.

**Você não precisa fazer login primeiro.** Com `work4you tools`, os backends gerenciados pelo Work4You (Web search, Image, Video, TTS, Browser) sempre aparecem listados, mesmo que você nunca tenha entrado no Work4You Portal. Selecione um e o Work4You executa o login do Portal ali mesmo, caso você ainda não esteja autenticado — sem precisar rodar `work4you model` antes. Se seu OAuth do Work4You já estiver ativo, selecionar o backend o habilita imediatamente, sem prompt extra. Este caminho apenas faz seu login e ativa a única ferramenta que você escolheu — ele **não** troca seu provedor de inferência, e **não** pergunta se você quer ativar o gateway para todas as outras ferramentas.

Confira o que está ativo a qualquer momento:

```bash
work4you portal info        # Resumo da autenticação no Portal + roteamento do Tool Gateway
work4you portal tools       # Catálogo do gateway com o roteamento atual por ferramenta
work4you status             # Status completo do sistema (Tool Gateway é uma das seções)
```

`work4you portal info` mostra uma seção assim:

```
◆ Work4You Tool Gateway
  Work4You Portal     ✓ managed tools available
  Web tools       ✓ active via Work4You subscription
  Image gen       ✓ active via Work4You subscription
  TTS             ✓ active via Work4You subscription
  Browser         ○ active via Browser Use key
```

Ferramentas marcadas como "active via Work4You subscription" estão passando pelo gateway. Qualquer outra coisa está usando suas próprias chaves.

## Elegibilidade

O Tool Gateway é um recurso de **assinatura paga**. Contas Work4You do nível gratuito podem usar o Portal para inferência, mas não incluem ferramentas gerenciadas — [faça upgrade do seu plano](https://portal.work4you.ai/manage-subscription) para desbloquear o gateway.

Algumas contas também têm direito a um **pool de ferramentas gratuito** — uma pequena cota de ferramentas gerenciadas que cobre chamadas de ferramentas do gateway sem uma assinatura paga. Quando um pool gratuito está disponível, o gateway o exibe e mostra um prompt de configuração no primeiro uso, para que você possa aderir e começar a usar as ferramentas gerenciadas imediatamente.

## Misture e combine

O gateway funciona por ferramenta. Ative-o apenas para o que você quiser:

- **Todas as ferramentas pelo Work4You** — mais fácil; uma assinatura, pronto.
- **Gateway para web + imagens, traga seu próprio TTS** — mantenha sua voz do ElevenLabs, deixe o Work4You cuidar do resto.
- **Gateway apenas para o que você não tem chaves** — "eu já pago pelo Browserbase, mas não quero uma conta no Firecrawl" funciona perfeitamente.

Troque qualquer ferramenta a qualquer momento via:

```bash
work4you tools          # Seletor interativo para cada categoria de ferramenta
```

Selecione a ferramenta, escolha **Work4You Subscription** como provedor (ou qualquer provedor direto que preferir). Nenhuma edição de configuração necessária. Se você ainda não estiver logado no Work4You Portal, escolher **Work4You Subscription** inicia o login do Portal ali mesmo — você não precisa se autenticar via `work4you model` antes.

## Usando modelos de imagem individuais

A geração de imagem usa o FLUX 2 Klein 9B por padrão, por velocidade. Sobrescreva por chamada passando o ID do modelo para a tool `image_generate`:

| Modelo | ID | Melhor para |
|---|---|---|
| FLUX 2 Klein 9B | `fal-ai/flux-2/klein/9b` | Rápido, bom padrão |
| FLUX 2 Pro | `fal-ai/flux-2-pro` | FLUX de maior fidelidade |
| Z-Image Turbo | `fal-ai/z-image/turbo` | Estilizado, rápido |
| Nano Banana Pro | `fal-ai/nano-banana-pro` | Google Gemini 3 Pro Image |
| GPT Image 1.5 | `fal-ai/gpt-image-1.5` | Geração de imagem OpenAI, texto+imagem |
| GPT Image 2 | `fal-ai/gpt-image-2` | Mais recente da OpenAI |
| Ideogram V3 | `fal-ai/ideogram/v3` | Forte aderência a prompts + tipografia |
| Recraft V4 Pro | `fal-ai/recraft/v4/pro/text-to-image` | Estilo vetorial, design gráfico |
| Qwen Image | `fal-ai/qwen-image` | Multimodal da Alibaba |

O conjunto evolui — `work4you tools` → Image Generation mostra a lista atual em tempo real.

---

## Referência de configuração

A maioria dos usuários nunca precisa mexer nisso — `work4you model` e `work4you tools` cobrem todo o fluxo de trabalho de forma interativa. Esta seção é para quem escreve o config.yaml diretamente ou automatiza configurações por script.

### Flag `use_gateway` por ferramenta

Cada bloco de configuração de ferramenta aceita um booleano `use_gateway`:

```yaml
web:
  backend: firecrawl
  use_gateway: true

image_gen:
  use_gateway: true

tts:
  provider: openai
  use_gateway: true

browser:
  cloud_provider: browser-use
  use_gateway: true
```

Precedência: `use_gateway: true` roteia pelo Work4You independentemente de quaisquer chaves diretas no `.env`. `use_gateway: false` (ou ausente) usa chaves diretas quando disponíveis e só recorre ao gateway quando nenhuma existe.

### Desativando o gateway

```yaml
web:
  use_gateway: false   # O Work4You agora usa FIRECRAWL_API_KEY do .env
```

`work4you tools` limpa a flag automaticamente quando você escolhe um provedor que não é o gateway, então isso geralmente acontece por você.

### Gateway auto-hospedado (avançado)

Está rodando seu próprio gateway compatível com Work4You? Sobrescreva os endpoints em `~/.work4you/.env`:

```bash
TOOL_GATEWAY_DOMAIN=your-domain.example.com
TOOL_GATEWAY_SCHEME=https
TOOL_GATEWAY_USER_TOKEN=your-token        # normalmente preenchido automaticamente pelo login do Portal
FIRECRAWL_GATEWAY_URL=https://...         # sobrescreve um endpoint específico
```

Esses ajustes existem para configurações de infraestrutura personalizadas (implantações corporativas, ambientes de desenvolvimento). Assinantes comuns nunca precisam defini-los.

## Perguntas frequentes

### Funciona com Telegram / Discord / os outros gateways de mensagens?

Sim. O Tool Gateway opera na camada de execução de tools, não na CLI. Toda interface que pode chamar uma tool — CLI, Telegram, Discord, Slack, IRC, Teams, o servidor de API, qualquer uma — se beneficia dele de forma transparente.

### O que acontece se minha assinatura expirar?

As ferramentas roteadas pelo gateway param de funcionar até você renovar ou trocar por chaves de API diretas via `work4you tools`. O Work4You mostra um erro claro apontando para o portal.

### Posso ver uso ou custos por ferramenta?

Sim — o [painel do Work4You Portal](https://portal.work4you.ai) detalha o uso por ferramenta para que você veja o que está impactando sua fatura.

### O Modal (terminal serverless) está incluído?

O Modal está disponível como um **complemento opcional** através da assinatura Work4You, e não faz parte do pacote padrão do Tool Gateway. Configure-o via `work4you setup terminal` ou diretamente no `config.yaml` quando quiser um sandbox remoto para execução de shell.

### Preciso excluir minhas chaves de API existentes ao ativar o gateway?

Não — mantenha-as no `.env`. Quando `use_gateway: true`, o Work4You ignora as chaves diretas e usa o gateway. Volte a flag para `false` e suas chaves voltam a ser a fonte. O gateway não é um aprisionamento.
