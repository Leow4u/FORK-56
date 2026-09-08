---
sidebar_position: 1
title: "Work4You Portal"
description: "Uma assinatura, mais de 300 modelos de ponta, e o Tool Gateway — a forma recomendada de executar o Work4You"
---

# Work4You Portal

O [Work4You Portal](https://portal.work4you.ai) é o gateway de assinatura unificado do Work4You e **a forma recomendada de executar o Work4You**. Um único login OAuth substitui o malabarismo de contas separadas, chaves de API e relações de faturamento em cada laboratório de modelo, API de busca, gerador de imagens e provedor de navegador que você precisaria conectar manualmente.

Se você só tem tempo para configurar uma coisa, configure isso. O caminho mais rápido:

```bash
work4you setup --portal
```

Esse único comando executa o OAuth do Portal, deixa você escolher um modelo Work4You, define o Work4You como seu provedor de inferência no `config.yaml`, e ativa o Tool Gateway. Você já está pronto para usar o `work4you chat` logo em seguida.

Ainda não tem uma assinatura? [portal.work4you.ai/manage-subscription](https://portal.work4you.ai/manage-subscription) — cadastre-se, depois volte e execute o comando acima.

## O que está incluso na assinatura

### Mais de 300 modelos de ponta, uma única fatura

O Portal faz proxy de um catálogo curado de modelos agênticos de todo o ecossistema — cobrado contra sua assinatura do Work4You em vez de um saldo de créditos por laboratório.

| Família | Modelos |
|--------|--------|
| **Anthropic Claude** | Opus 4.7, Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| **OpenAI** | GPT-5.5, GPT-5.5 Pro, GPT-5.4 Mini, GPT-5.4 Nano, GPT-5.3 Codex |
| **Google Gemini** | Gemini 3 Pro Preview, Gemini 3 Flash Preview, Gemini 3.1 Pro Preview, Gemini 3.1 Flash Lite Preview |
| **DeepSeek** | DeepSeek V4 Pro |
| **Qwen** | Qwen3.7-Max, Qwen3.6-35B-A3B |
| **Kimi / Moonshot** | Kimi K2.6 |
| **GLM / Zhipu** | GLM-5.1 |
| **MiniMax** | MiniMax M2.7 |
| **xAI** | Grok 4.3 |
| **NVIDIA** | Nemotron-3 Super 120B-A12B |
| **Tencent** | Hunyuan 3 Preview |
| **Xiaomi** | MiMo V2.5 Pro |
| **StepFun** | Step 3.5 Flash |
| **Work4You** | Work4You-4-70B, Work4You-4-405B (chat, veja a [observação abaixo](#a-note-on-work4you-4)) |
| **+ tudo o mais** | mais de 280 modelos adicionais — toda a fronteira agêntica |

Por baixo dos panos, o Portal roteia cada modelo para o backend mais adequado — alguns modelos passam pelo OpenRouter, outros por provedores proprietários ou secundários, e o roteamento de um determinado modelo pode mudar ao longo do tempo. De qualquer forma, tudo é cobrado contra sua assinatura do Work4You. Alterne entre Claude Sonnet 4.6 para código e Gemini 3 Pro para contexto longo com `/model` no meio da sessão — sem novas credenciais, sem recargas, sem erros surpresa de saldo zerado.

:::note
Como o roteamento é por modelo e nem sempre passa pelo OpenRouter, extensões de requisição específicas do OpenRouter (como preferências de roteamento `provider`, roteamento fixo por `session_id`, ou `cache_control` no nível superior) não fazem parte do contrato de API do Portal e podem ser ignoradas dependendo de qual backend atende o modelo.
:::

### O Work4You Tool Gateway

A mesma assinatura desbloqueia o [Tool Gateway](/user-guide/features/tool-gateway), que roteia as chamadas de ferramenta do Work4You através de infraestrutura gerenciada pelo Work4You. Cinco backends, um único login:

| Ferramenta | Parceiro | O que faz |
|------|---------|--------------|
| **Busca e extração web** | Firecrawl | Busca e extração de página completa em nível profissional. Sem chave de API do Firecrawl, sem precisar gerenciar limites de taxa. |
| **Geração de imagens** | FAL | Nove modelos sob um único endpoint: FLUX 2 Klein 9B, FLUX 2 Pro, Z-Image Turbo, Nano Banana Pro (Gemini 3 Pro Image), GPT Image 1.5, GPT Image 2, Ideogram V3, Recraft V4 Pro, Qwen Image. |
| **Texto para fala** | OpenAI TTS | TTS de alta qualidade sem uma chave OpenAI separada. Habilita o [modo de voz](/user-guide/features/voice-mode) entre plataformas de mensagens. |
| **Automação de navegador em nuvem** | Browser Use | Sessões headless do Chromium para `browser_navigate`, `browser_click`, `browser_type`, `browser_vision`. Sem necessidade de conta Browserbase. |
| **Sandbox de terminal em nuvem** | Modal | Sandboxes de terminal serverless para execução de código (add-on opcional). |

Sem o gateway, conectar cada um desses serviços significa uma conta Firecrawl, uma conta FAL, uma conta Browser Use, uma chave OpenAI e uma conta Modal — cinco cadastros separados, cinco painéis separados, cinco fluxos de recarga separados. Com o gateway, tudo isso passa por uma única assinatura.

Você também pode habilitar apenas ferramentas específicas do gateway (por exemplo, busca web mas não geração de imagens) — veja [Combinando o gateway com seus próprios backends](#mixing-the-gateway-with-your-own-backends) abaixo.

### Sem credenciais nos seus dotfiles

Como tudo passa por uma única sessão do Portal autenticada por OAuth, você não acumula um arquivo `.env` com uma dezena de chaves de API de longa duração. O refresh token em `~/.work4you/auth.json` é a única credencial em disco, e o Work4You gera JWTs de curta duração a partir dele a cada requisição — veja [Gerenciamento de token](#token-handling) abaixo.

### Paridade entre plataformas

O [Windows nativo](/user-guide/windows-native) tem na configuração de chave de API por ferramenta seu ponto mais delicado — instalar uma conta Firecrawl, uma conta FAL, uma conta Browser Use, uma chave OpenAI a partir do Windows é a parte de maior atrito para conseguir um agente útil. Uma assinatura do Portal resolve isso: um único OAuth cobre o modelo e todas as ferramentas do gateway, então usuários de Windows têm a mesma experiência que usuários de macOS/Linux sem precisar configurar quatro backends manualmente.

## Uma observação sobre o Work4You 4

A própria família **Work4You 4** do Work4You (Work4You-4-70B, Work4You-4-405B) está disponível através do Portal a preços fortemente reduzidos. Esses são **modelos de chat de raciocínio híbrido de ponta** — fortes em matemática, ciências, seguimento de instruções, aderência a esquemas, roleplay e escrita longa.

Eles **não são recomendados para uso dentro do Work4You**, no entanto. O Work4You 4 é ajustado para chat e raciocínio, não para o loop acelerado de chamadas de ferramenta do qual o agente depende. Use-os para fluxos de trabalho de pesquisa ou via o [proxy de assinatura](/user-guide/features/subscription-proxy) a partir de outras ferramentas — mas para trabalho de agente, escolha um modelo agêntico de ponta do catálogo:

```bash
/model anthropic/claude-sonnet-4.6     # melhor modelo agêntico de propósito geral
/model openai/gpt-5.5-pro              # forte raciocínio + chamada de ferramentas
/model google/gemini-3-pro-preview     # janela de contexto enorme
/model deepseek/deepseek-v4-pro        # codificador com bom custo-benefício
```

A própria [página de informações de modelo](https://portal.work4you.ai/info) do Portal traz o mesmo aviso, então isso não é uma opinião do lado do Work4You — é a orientação oficial do Work4You.

## Configuração

### Instalação nova — um único comando

```bash
work4you setup --portal
```

Isso executa a configuração completa de uma só vez:

1. Abre seu navegador em portal.work4you.ai para o login OAuth
2. Armazena o refresh token em `~/.work4you/auth.json`
3. Deixa você escolher um modelo Work4You da lista curada (ou pular para manter o seu atual)
4. Define o Work4You como seu provedor de inferência em `~/.work4you/config.yaml` (quando você escolhe um modelo)
5. Ativa o Tool Gateway (roteamento de web, imagem, TTS, navegador)
6. Retorna você ao seu terminal pronto para usar o `work4you chat`

Se você ainda não tem uma assinatura, cadastre-se em [portal.work4you.ai/manage-subscription](https://portal.work4you.ai/manage-subscription) primeiro.

### Instalação existente — adicione o Portal junto com outros provedores

Se você já tem o Work4You configurado com OpenRouter, Anthropic, ou qualquer outro provedor e quer adicionar o Portal junto com eles:

```bash
work4you model
# escolha "Work4You Portal" na lista de provedores
# o navegador abre, faça login, pronto
```

Seus provedores existentes continuam configurados. Você pode alternar entre eles com `/model` no meio da sessão ou `work4you model` entre sessões — o Portal se torna um dos seus provedores disponíveis, não o único.

### Configuração headless / SSH / remota

O OAuth precisa de um navegador, mas o callback de loopback roda na máquina onde o Work4You está sendo executado. Para hosts remotos, veja [OAuth via SSH / Hosts Remotos](/guides/oauth-over-ssh) — os mesmos padrões funcionam para o Portal assim como para qualquer outro provedor baseado em OAuth (encaminhamento de porta com `ssh -L`).

### Configuração de perfil

Se você usa [perfis do Work4You](/user-guide/profiles), o refresh token do Portal é automaticamente compartilhado entre todos os perfis através de um repositório de tokens compartilhado. Faça login uma vez em qualquer perfil, e o restante o reconhece automaticamente — sem necessidade de repetir o fluxo OAuth por perfil.

## Usando o Portal no dia a dia

### Inspecionando o que está conectado

```bash
work4you portal            # faça login no Work4You Portal + configure-o (onboarding único)
work4you portal info       # status de login, informações de assinatura, roteamento de modelo + gateway
work4you portal status     # alias para `portal info`
work4you portal tools      # catálogo detalhado do Tool Gateway com roteamento por ferramenta
work4you portal open       # abre a página de gerenciamento de assinatura no seu navegador
```

`work4you portal` (sem subcomando) é o alias legível para humanos de `work4you auth add work4you --type oauth` — ele faz seu login, deixa você escolher um modelo Work4You, define o Work4You como seu provedor de inferência, e oferece o opt-in do Tool Gateway (idêntico ao `work4you setup --portal`, e o mesmo fluxo do Work4You que a configuração rápida inicial).

`work4you portal info` fornece a visão geral de alto nível:

```
  Work4You Portal
  ───────────
  Auth:    ✓ logado
  Portal:  https://portal.work4you.ai
  Model:   ✓ usando o Work4You como provedor de inferência

  Tool Gateway
  ────────────
  Web search & extract  via Work4You Portal
  Image generation      via Work4You Portal
  Text-to-speech        via Work4You Portal
  Browser automation    via Work4You Portal
  Cloud terminal        não configurado
```

### Trocando de modelos

Dentro de uma sessão:

```bash
/model anthropic/claude-sonnet-4.6
/model openai/gpt-5.5-pro
/model google/gemini-3-pro-preview
```

Ou abra o seletor:

```bash
/model
# setas do teclado, enter para selecionar
```

Fora de uma sessão (o assistente de configuração completo, útil ao adicionar um novo provedor):

```bash
work4you model
```

### Combinando o gateway com seus próprios backends

Se você já tem, digamos, uma conta Browserbase e quer continuar usando-a enquanto roteia busca web e geração de imagens através do Work4You, isso é suportado. Use `work4you tools` para escolher backends por ferramenta:

```bash
work4you tools
# → Web search       → "Work4You Subscription"
# → Image generation → "Work4You Subscription"
# → Browser          → "Browserbase"  (sua chave existente)
# → TTS              → "Work4You Subscription"
```

O Tool Gateway é opt-in por ferramenta, não tudo ou nada. Os backends gerenciados aparecem no `work4you tools` independentemente de você estar logado no Work4You Portal ou não — se você escolher "Work4You Subscription" antes de se autenticar, o Work4You executa o login do Portal em linha (isso não muda seu provedor de inferência nem afeta suas outras ferramentas). Veja a [documentação do Tool Gateway](/user-guide/features/tool-gateway) para a matriz completa de configuração por ferramenta.

### Gerenciamento de assinatura

Gerencie seu plano, veja o uso, ou faça upgrade/cancele a qualquer momento:

- **Web:** [portal.work4you.ai/manage-subscription](https://portal.work4you.ai/manage-subscription)
- **Atalho da CLI:** `work4you portal open` (abre a mesma página no seu navegador padrão)

## Referência de configuração

Depois do `work4you setup --portal`, o `~/.work4you/config.yaml` vai ficar assim:

```yaml
model:
  provider: work4you
  default: anthropic/claude-sonnet-4.6     # ou o modelo que você escolheu
  base_url: https://inference-api.work4you.ai/v1
```

As configurações do Tool Gateway ficam nas respectivas seções de cada ferramenta:

```yaml
web:
  backend: firecrawl
  use_gateway: true   # busca/extração web roteia através do Tool Gateway

image_gen:
  use_gateway: true

tts:
  provider: openai
  use_gateway: true

browser:
  cloud_provider: browser-use
  use_gateway: true
```

O refresh token OAuth é armazenado separadamente em `~/.work4you/auth.json` (não no `config.yaml` — credenciais e configuração são mantidas separadas por design).

## Gerenciamento de token

O Work4You gera um JWT de curta duração a partir do seu refresh token do Portal armazenado a cada chamada de inferência, em vez de reutilizar uma chave de API de longa duração. O ciclo de vida do token é totalmente automático — renovação, geração, nova tentativa em 401 transitório — e você nunca o vê.

Se o Portal invalidar o refresh token (mudança de senha, revogação manual, expiração de sessão), o refresh token inválido é **colocado em quarentena localmente**, para que o Work4You pare de reutilizá-lo e você não veja uma sequência de 401s idênticos. A próxima chamada mostra uma mensagem clara de "reautenticação necessária". Execute `work4you auth add work4you` para fazer login novamente; a quarentena é removida no próximo login bem-sucedido.

## Solução de problemas

### `work4you portal info` mostra "not logged in"

Você não completou o fluxo OAuth, ou seu refresh token foi apagado. Execute:

```bash
work4you portal
```

ou use `work4you model` e selecione novamente o Work4You Portal.

### Recebi uma mensagem de "reautenticação necessária" no meio da sessão

Seu refresh token do Portal foi invalidado (mudança de senha, revogação manual, ou expiração de sessão). Execute `work4you auth add work4you` e sua próxima requisição vai usar as novas credenciais. Qualquer quarentena no token antigo é removida automaticamente no próximo login bem-sucedido.

### Quero usar um modelo específico de um provedor que o Portal não expõe

O Portal roteia cada modelo para um backend adequado — alguns via OpenRouter, outros através de provedores proprietários ou secundários — então a maioria dos modelos que o OpenRouter suporta geralmente está disponível. Se um modelo específico não estiver aparecendo em `/model`, tente o slug no estilo OpenRouter diretamente:

```bash
/model anthropic/claude-opus-4.6
```

Se um modelo estiver realmente ausente, [abra uma issue](https://github.com/Leow4u/FORK-56/issues) — nós expomos o catálogo do Portal para o Work4You e as lacunas geralmente significam uma configuração de roteamento que podemos atualizar.

### Cobranças não aparecendo na minha conta do Portal

Verifique `work4you portal info` primeiro — se ele mostrar que você está usando um provedor diferente (`Model: currently openrouter` em vez de `using Work4You as inference provider`), sua configuração local está desatualizada. Execute `work4you model`, escolha Work4You Portal, e a próxima requisição vai rotear através da sua assinatura.

## Veja também

- **[Tool Gateway](/user-guide/features/tool-gateway)** — Detalhes completos sobre cada ferramenta do gateway, configuração por ferramenta, e preços
- **[Proxy de assinatura](/user-guide/features/subscription-proxy)** — Use sua assinatura do Portal a partir de ferramentas que não são o Work4You (outros agentes, scripts, clientes de terceiros)
- **[Modo de voz](/user-guide/features/voice-mode)** — Conversas por voz usando o TTS da OpenAI do Portal
- **[Provedores de IA](/integrations/providers)** — Catálogo completo de provedores se você quiser comparar alternativas
- **[OAuth via SSH](/guides/oauth-over-ssh)** — Login a partir de hosts remotos ou ambientes somente-navegador
- **[Perfis](/user-guide/profiles)** — Múltiplas configurações do Work4You compartilhando um único login no Portal
