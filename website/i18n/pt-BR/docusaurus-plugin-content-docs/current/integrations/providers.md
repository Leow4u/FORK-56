---
title: "Provedores de IA"
sidebar_label: "Provedores de IA"
sidebar_position: 1
---

# Provedores de IA

Esta página aborda a configuração de provedores de inferência para o Work4You — desde APIs em nuvem como OpenRouter e Anthropic, até endpoints auto-hospedados como Ollama e vLLM, passando por configurações avançadas de roteamento e fallback. Você precisa de pelo menos um provedor configurado para usar o Work4You.

## Provedores de Inferência

Você precisa de pelo menos uma forma de se conectar a um LLM. Use `work4you model` para alternar entre provedores e modelos de forma interativa, ou configure diretamente:

| Provedor | Configuração |
|----------|-------|
| **Work4You Portal** | `work4you model` (OAuth, baseado em assinatura) |
| **OpenAI Codex** | `work4you model` → **ChatGPT or Codex Subscription** (OAuth do ChatGPT, usa modelos Codex) |
| **GitHub Copilot** | `work4you model` (fluxo OAuth de código de dispositivo, `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, ou `gh auth token`) |
| **GitHub Copilot ACP** | `work4you model` (inicia o `copilot --acp --stdio` localmente) |
| **Anthropic** | `work4you model` (Claude Max + créditos de uso extra via OAuth; também suporta chave de API da Anthropic ou setup-token manual — veja a observação abaixo) |
| **OpenRouter** | `OPENROUTER_API_KEY` em `~/.work4you/.env` |
| **Fireworks AI** | `FIREWORKS_API_KEY` em `~/.work4you/.env` (provider: `fireworks`; apelidos: `fireworks-ai`, `fw`) |
| **NovitaAI** | `NOVITA_API_KEY` em `~/.work4you/.env` (provider: `novita`, mais de 200 modelos, Model API, Agent Sandbox, GPU Cloud) |
| **AI Gateway** | `AI_GATEWAY_API_KEY` em `~/.work4you/.env` (provider: `ai-gateway`) |
| **z.ai / GLM** | `GLM_API_KEY` em `~/.work4you/.env` (provider: `zai`) |
| **Kimi / Moonshot** | `KIMI_API_KEY` em `~/.work4you/.env` (provider: `kimi-coding`) |
| **Kimi / Moonshot (China)** | `KIMI_CN_API_KEY` em `~/.work4you/.env` (provider: `kimi-coding-cn`; apelidos: `kimi-cn`, `moonshot-cn`) |
| **Arcee AI** | `ARCEEAI_API_KEY` em `~/.work4you/.env` (provider: `arcee`; apelidos: `arcee-ai`, `arceeai`) |
| **GMI Cloud** | `GMI_API_KEY` em `~/.work4you/.env` (provider: `gmi`; apelidos: `gmi-cloud`, `gmicloud`) |
| **Actual Computer** | `ACTUAL_API_KEY` em `~/.work4you/.env` para o relay hospedado, ou `ACTUAL_BASE_URL=http://127.0.0.1:8080` para o daemon local — sem necessidade de chave no loopback (provider: `actual`; apelidos: `actual-computer`, `actualcomputer`, `aci`) |
| **MiniMax** | `MINIMAX_API_KEY` em `~/.work4you/.env` (provider: `minimax`) |
| **MiniMax China** | `MINIMAX_CN_API_KEY` em `~/.work4you/.env` (provider: `minimax-cn`) |
| **xAI (Grok) — Responses API** | `XAI_API_KEY` em `~/.work4you/.env` (provider: `xai`) |
| **xAI Grok OAuth (SuperGrok)** | `work4you model` → "xAI Grok OAuth (SuperGrok / Premium+)" — login pelo navegador, sem chave de API. Veja o [guia](../guides/xai-grok-oauth.md) |
| **Qwen Cloud (Alibaba DashScope)** | `DASHSCOPE_API_KEY` em `~/.work4you/.env` (provider: `alibaba`) |
| **Alibaba Cloud (Coding Plan)** | `DASHSCOPE_API_KEY` (provider: `alibaba-coding-plan`, apelido: `alibaba_coding`) — SKU de faturamento separado, endpoint diferente |
| **Kilo Code** | `KILOCODE_API_KEY` em `~/.work4you/.env` (provider: `kilocode`) |
| **Xiaomi MiMo** | `XIAOMI_API_KEY` em `~/.work4you/.env` (provider: `xiaomi`, apelidos: `mimo`, `xiaomi-mimo`) |
| **Tencent TokenHub** | `TOKENHUB_API_KEY` em `~/.work4you/.env` (provider: `tencent-tokenhub`, apelidos: `tencent`, `tokenhub`, `tencentmaas`) |
| **OpenCode Zen** | `OPENCODE_ZEN_API_KEY` em `~/.work4you/.env` (provider: `opencode-zen`) |
| **CommandCode** | `COMMANDCODE_API_KEY` em `~/.work4you/.env` (provider: `commandcode`, apelido: `commandcode-chat`; modelos Claude via `commandcode-anthropic`, apelido: `commandcode-claude`). Funciona com os planos GOAT/Pro/Max/Provider (não o plano Go de $1 — sem acesso à API). |
| **OpenCode Go** | `OPENCODE_GO_API_KEY` em `~/.work4you/.env` (provider: `opencode-go`) |
| **DeepSeek** | `DEEPSEEK_API_KEY` em `~/.work4you/.env` (provider: `deepseek`) |
| **Hugging Face** | `HF_TOKEN` em `~/.work4you/.env` (provider: `huggingface`, apelidos: `hf`) |
| **Google / Gemini** | `GOOGLE_API_KEY` (ou `GEMINI_API_KEY`) em `~/.work4you/.env` (provider: `gemini`) |
| **Google Vertex AI** | `work4you model` → "Google Vertex AI" (provider: `vertex`; OAuth2 via JSON de conta de serviço ou ADC, faturamento GCP) |
| **OpenAI API (direta)** | `OPENAI_API_KEY` em `~/.work4you/.env` (provider: `openai-api`, `OPENAI_BASE_URL` opcional) |
| **Azure AI Foundry** | `work4you model` → "Azure AI Foundry" (provider: `azure-foundry`; usa endpoint e chave do Azure OpenAI / Foundry) |
| **AWS Bedrock** | `work4you model` → "AWS Bedrock" (provider: `bedrock`; cadeia de credenciais AWS padrão via boto3) |
| **NVIDIA Build** | `NVIDIA_API_KEY` em `~/.work4you/.env` (provider: `nvidia`; modelos hospedados no NIM em build.nvidia.com) |
| **Ollama Cloud** | `work4you model` → "Ollama Cloud" (provider: `ollama-cloud`; API do Ollama hospedada na nuvem) |
| **Qwen OAuth** | `work4you model` → "Qwen OAuth" (provider: `qwen-oauth`; login PKCE pelo navegador) |
| **MiniMax OAuth** | `work4you model` → "MiniMax (OAuth)" (provider: `minimax-oauth`; login PKCE pelo navegador) |
| **StepFun** | `STEPFUN_API_KEY` em `~/.work4you/.env` (provider: `stepfun`) |
| **LM Studio** | `work4you model` → "LM Studio" (provider: `lmstudio`, `LM_API_KEY` opcional) |
| **Endpoint personalizado** | `work4you model` → escolha "Custom endpoint" (salvo em `config.yaml`) |

Para o caminho oficial com chave de API, veja o [guia dedicado do Google Gemini](/guides/google-gemini).

:::tip Apelido da chave de modelo
Na seção de configuração `model:`, você pode usar tanto `default:` quanto `model:` como nome da chave para o ID do seu modelo. Tanto `model: { default: my-model }` quanto `model: { model: my-model }` funcionam da mesma forma.
:::


### Work4You Portal

O [Work4You Portal](https://portal.work4you.ai) é o gateway de assinatura unificado do Work4You e **a forma recomendada de executar o Work4You**. Um único login OAuth cobre mais de 300 modelos agênticos de ponta (Claude, GPT, Gemini, DeepSeek, Qwen, Kimi, GLM, MiniMax, Grok, ...) além do [Tool Gateway](/user-guide/features/tool-gateway) (busca na web, geração de imagens, TTS, automação de navegador) — cobrado contra sua assinatura do Work4You em vez de contas separadas por provedor.

```bash
work4you setup --portal     # instalação nova — OAuth + provedor + gateway em um único comando
work4you model              # instalação existente — escolha "Work4You Portal" na lista
work4you portal info        # inspecione o login + roteamento a qualquer momento
```

Ainda não tem uma assinatura? Obtenha uma em [portal.work4you.ai/manage-subscription](https://portal.work4you.ai/manage-subscription).

**Para detalhes completos:** veja a [página dedicada de integração do Work4You Portal](/integrations/work4you-portal) (o que está incluso na assinatura, catálogo de modelos, solução de problemas) e o [guia passo a passo Run Work4You with Work4You Portal](/guides/run-work4you-with-work4you-portal).

**Identificação do cliente.** Toda requisição do Portal feita pelo Work4You carrega uma tag `client=work4you-client-v<version>` (ex.: `client=work4you-client-v0.13.0`) alinhada automaticamente à sua versão instalada. Isso é enviado em todos os caminhos do Portal — loop de chat principal, chamadas auxiliares, sumarizador de compressão, extração web — e permite que a telemetria do lado do Portal distinga o tráfego do Work4You de outros clientes. Nenhuma configuração é necessária — a tag é atualizada automaticamente quando você executa `work4you update`.

**Autenticação JWT (automática).** O Work4You prefere JWTs escopados de `inference:invoke` para requisições ao Portal, com o caminho legado de chave de sessão opaca como fallback. Nenhuma configuração é necessária — as credenciais são gerenciadas pelo fluxo OAuth e renovadas de forma transparente. Tokens de atualização revogados são colocados em quarentena para evitar loops de replay.


:::info Observação sobre o Codex
O provedor OpenAI Codex autentica via código de dispositivo (abra uma URL, digite um código). O Work4You armazena as credenciais resultantes em seu próprio repositório de autenticação em `~/.work4you/auth.json` e pode importar credenciais existentes do Codex CLI a partir de `~/.codex/auth.json`, quando presentes. Nenhuma instalação do Codex CLI é necessária.

Se uma renovação de token falhar com um erro terminal (HTTP 4xx, `invalid_grant`, concessão revogada, etc.), o Work4You marca o token de atualização como morto e para de reutilizá-lo, evitando uma enxurrada de falhas de autenticação idênticas. A próxima requisição exibe uma mensagem tipada de reautenticação. Execute `work4you auth add openai-codex` (ou `work4you model` → **ChatGPT or Codex Subscription**) para iniciar um novo login por código de dispositivo; a quarentena é liberada na próxima troca bem-sucedida.
:::

:::warning
Mesmo usando o Work4You Portal, o Codex, ou um endpoint personalizado, algumas ferramentas (visão, sumarização web, MoA) usam um modelo "auxiliar" separado. Por padrão (`auxiliary.*.provider: "auto"`), o Work4You roteia essas tarefas para o seu **modelo de chat principal** — o mesmo modelo que você escolheu em `work4you model`. Você pode substituir cada tarefa individualmente para roteá-la a um modelo mais barato/rápido (ex.: Gemini Flash no OpenRouter) — veja [Modelos Auxiliares](/user-guide/configuration#auxiliary-models).
:::

:::tip Work4You Tool Gateway
Assinantes pagos do Work4You Portal também têm acesso ao **[Tool Gateway](/user-guide/features/tool-gateway)** — busca na web, geração de imagens, TTS e automação de navegador roteados através da sua assinatura. Sem necessidade de chaves de API extras. Em uma instalação nova, `work4you setup --portal` faz seu login, define o Work4You como seu provedor e ativa o gateway, tudo em um único comando. Usuários existentes podem ativá-lo em `work4you model` ou por ferramenta em `work4you tools`. Inspecione o roteamento a qualquer momento com `work4you portal info`.
:::

### Dois Comandos para Gerenciamento de Modelos

O Work4You tem **dois** comandos de modelo que servem propósitos diferentes:

| Comando | Onde executar | O que faz |
|---------|-------------|--------------|
| **`work4you model`** | Seu terminal (fora de qualquer sessão) | Assistente de configuração completo — adicione provedores, execute OAuth, digite chaves de API, configure endpoints |
| **`/model`** | Dentro de uma sessão de chat do Work4You | Troca rápida entre provedores e modelos **já configurados** |

Se você está tentando trocar para um provedor que ainda não configurou (ex.: você só tem o OpenRouter configurado e quer usar a Anthropic), você precisa do `work4you model`, não do `/model`. Saia da sua sessão primeiro (`Ctrl+C` ou `/quit`), execute `work4you model`, complete a configuração do provedor e então inicie uma nova sessão.


### Planos de assinatura: pelo que seu plano paga

Vários provedores permitem que você entre no Work4You com uma **assinatura de consumidor** (Claude Max, ChatGPT, SuperGrok / X Premium+, …) em vez de uma chave de API. O que essa assinatura realmente paga — e o que não paga — difere por provedor, e essa é a fonte mais comum de surpresas na fatura. A tabela abaixo é a versão resumida; a seção de cada provedor traz os detalhes.

> Células marcadas como *não documentado atualmente* significam exatamente isso: a documentação do Work4You ainda não especifica o comportamento. Não presuma — verifique o painel de faturamento do seu provedor e trate essas células como perguntas em aberto.

| Plano / caminho | O Work4You pode usá-lo? | O que é consumido | O que NÃO é consumido | Surpresa comum |
|---|---|---|---|---|
| **Anthropic — Claude Max + OAuth** | ✅ Sim — `work4you model` → OAuth da Anthropic. Requer Max **e** créditos de uso extra comprados | Os **créditos extras/excedentes** que você adicionou além do plano Max | O **limite base do plano Max** (o uso incluído no Claude Code por padrão) | Todo uso do Work4You é cobrado como "uso extra" mesmo enquanto sua franquia Max incluída fica intocada |
| **Anthropic — Claude Pro** | ❌ Não — assinantes Pro não podem usar o caminho OAuth | Nada (caminho indisponível) | Sua assinatura Pro | O Pro parece que deveria funcionar; não funciona. Use uma `ANTHROPIC_API_KEY` em vez disso (paga por token, independente de qualquer assinatura Claude) |
| **OpenAI Codex — OAuth do plano ChatGPT** | ✅ Sim — `work4you model` → **ChatGPT or Codex Subscription** (login OAuth por código de dispositivo do ChatGPT, usa modelos Codex) | *Não documentado atualmente* | *Não documentado atualmente* | A documentação cobre apenas autenticação e renovação de token; a semântica de cota do plano ainda não está documentada |
| **xAI — OAuth SuperGrok / X Premium+** | ✅ Sim — OAuth pelo navegador, sem necessidade de chave de API | Sua **cota de assinatura** (documentado explicitamente para o X Search: o OAuth é preferido em vez de uma chave de API e "usa a cota da sua assinatura em vez de gasto por API"). A semântica de cota de inferência além disso: *não documentada atualmente* | `XAI_API_KEY` / gasto por API pago por token, quando credenciais OAuth estão configuradas e preferidas | `HTTP 403` após um login bem-sucedido — a xAI restringiu o acesso à API via OAuth a níveis específicos do SuperGrok, apesar de uma assinatura ativa no app |
| **Google — plano de consumidor Gemini (Google AI Pro / Ultra)** | ❌ Sem caminho documentado — o provedor `gemini` funciona apenas com chave de API (`GOOGLE_API_KEY` / `GEMINI_API_KEY`); o Vertex AI usa o faturamento do GCP | A cota da sua **chave de API** (nível gratuito ou projeto do Google Cloud com faturamento ativado) — *consumo de plano de consumidor não documentado atualmente* | *Não documentado atualmente* | Chaves de nível gratuito podem se esgotar depois de poucos turnos do agente, porque o Work4You pode fazer várias chamadas de modelo por turno do usuário |

**Anthropic.** O caminho OAuth roteia como o Claude Code contra sua conta Anthropic e **só funciona em um plano Claude Max com créditos de uso extra comprados** — a franquia base do Max nunca é consumida pelo Work4You, apenas os créditos extras/excedentes adicionados sobre ela. Assinantes Claude Pro não podem usar esse caminho; a alternativa suportada é uma `ANTHROPIC_API_KEY`, cobrada por token contra a organização dessa chave, pelo preço padrão da API. Veja [Anthropic (Nativa)](#anthropic-native) abaixo.

**OpenAI Codex.** O Work4You autentica via OAuth por código de dispositivo do ChatGPT, armazena as credenciais em `~/.work4you/auth.json`, e pode importar credenciais existentes do Codex CLI a partir de `~/.codex/auth.json`. Quais níveis de plano do ChatGPT são elegíveis, e como o uso do Work4You conta contra os limites de Codex do seu plano, **não estão documentados atualmente** — a observação sobre o Codex em [Work4You Portal](#work4you-portal) cobre apenas o comportamento de autenticação e renovação de token.

**xAI (SuperGrok / X Premium+).** O OAuth pelo navegador funciona tanto com uma assinatura SuperGrok ativa quanto com uma assinatura X Premium+ na conta X vinculada, e o mesmo token bearer é reutilizado pelas ferramentas diretas da xAI (TTS, geração de imagem, geração de vídeo, transcrição, X Search). Se a inferência retornar `HTTP 403` após um login bem-sucedido, isso é uma restrição de nível/direito do lado da xAI, não um token obsoleto — a solução alternativa é trocar para uma `XAI_API_KEY`. Veja [xAI (Grok)](#xai-grok--responses-api--prompt-caching) abaixo e o [guia de OAuth do xAI Grok](../guides/xai-grok-oauth.md).

**Google Gemini.** Atualmente não há forma de entrar no Work4You com uma assinatura Gemini de consumidor — o provedor `gemini` recebe uma chave de API, e o [Google Vertex AI](#google-vertex-ai) cobra do seu projeto GCP. Um projeto do Google Cloud com faturamento ativado é recomendado para uso com agentes; as cotas do nível gratuito são pequenas demais para sessões de agente de longa duração. Veja o [guia do Google Gemini](/guides/google-gemini).

:::tip Uma assinatura em vez de cinco
Se você preferir não acompanhar a semântica de plano de cada provedor individualmente, o [Work4You Portal](#work4you-portal) cobre mais de 300 modelos sob uma única assinatura com um único login OAuth.
:::

### Anthropic (Nativa)

Use modelos Claude diretamente pela API da Anthropic — sem necessidade de proxy do OpenRouter. Suporta três métodos de autenticação:

:::caution Requer créditos de "uso extra" do Claude Max
Quando você autentica via `work4you model` → OAuth da Anthropic (ou via `work4you auth add anthropic --type oauth`), o Work4You roteia como o Claude Code contra sua conta Anthropic. **Isso só funciona se você estiver em um plano Claude Max e tiver comprado créditos de uso extra.** A franquia base do plano Max (o uso incluído no Claude Code por padrão) não é consumida pelo Work4You — apenas os créditos extras/excedentes que você adicionou sobre ela são. Assinantes Claude Pro não podem usar esse caminho.

Se você não tem Max + créditos extras, use uma `ANTHROPIC_API_KEY` em vez disso — as requisições são cobradas por token contra a organização dessa chave (preço padrão da API, independente de qualquer assinatura Claude).
:::

```bash
# Com uma chave de API (paga por token)
export ANTHROPIC_API_KEY=***
work4you chat --provider anthropic --model claude-sonnet-4-6

# Preferido: autentique através do `work4you model`
# O Work4You usará o repositório de credenciais do Claude Code diretamente, quando disponível
work4you model

# Substituição manual com um setup-token (fallback / legado)
export ANTHROPIC_TOKEN=***  # setup-token ou token OAuth manual
work4you chat --provider anthropic

# Detecção automática das credenciais do Claude Code (se você já usa o Claude Code)
work4you chat --provider anthropic  # lê os arquivos de credenciais do Claude Code automaticamente
```

Quando você escolhe o OAuth da Anthropic via `work4you model`, o Work4You prefere o próprio repositório de credenciais do Claude Code em vez de copiar o token para `~/.work4you/.env`. Isso mantém as credenciais Claude renováveis de fato renováveis.

Ou defina permanentemente:
```yaml
model:
  provider: "anthropic"
  default: "claude-sonnet-4-6"
```

:::tip Apelidos
`--provider claude` e `--provider claude-code` também funcionam como atalhos para `--provider anthropic`.
:::

### GitHub Copilot

O Work4You suporta o GitHub Copilot como um provedor de primeira classe com dois modos:

**`copilot` — API direta do Copilot** (recomendado). Usa sua assinatura do GitHub Copilot para acessar GPT-5.x, Claude, Gemini e outros modelos através da API do Copilot.

```bash
work4you chat --provider copilot --model gpt-5.4
```

**Opções de autenticação** (verificadas nesta ordem):

1. Variável de ambiente `COPILOT_GITHUB_TOKEN`
2. Variável de ambiente `GH_TOKEN`
3. Variável de ambiente `GITHUB_TOKEN`
4. Fallback via CLI `gh auth token`

Se nenhum token for encontrado, `work4you model` oferece um **login OAuth por código de dispositivo** — o mesmo fluxo usado pelo Copilot CLI e pelo opencode.

:::warning Tipos de token
A API do Copilot **não** suporta Personal Access Tokens clássicos (`ghp_*`). Tipos de token suportados:

| Tipo | Prefixo | Como obter |
|------|--------|------------|
| Token OAuth | `gho_` | `work4you model` → GitHub Copilot → Login with GitHub |
| PAT de granularidade fina | `github_pat_` | GitHub Settings → Developer settings → Fine-grained tokens (precisa da permissão **Copilot Requests**) |
| Token de GitHub App | `ghu_` | Via instalação de um GitHub App |

Se seu `gh auth token` retornar um token `ghp_*`, use `work4you model` para autenticar via OAuth em vez disso.
:::

:::info Comportamento de autenticação do Copilot no Work4You
O Work4You envia um token do GitHub suportado (`gho_*`, `github_pat_*`, ou `ghu_*`) diretamente para `api.githubcopilot.com` e inclui cabeçalhos específicos do Copilot (`Editor-Version`, `Copilot-Integration-Id`, `Openai-Intent`, `x-initiator`).

Em caso de HTTP 401, o Work4You agora realiza uma recuperação de credenciais única antes do fallback:

1. Reresolve o token pela cadeia de prioridade normal (`COPILOT_GITHUB_TOKEN` → `GH_TOKEN` → `GITHUB_TOKEN` → `gh auth token`)
2. Reconstrói o cliente OpenAI compartilhado com cabeçalhos atualizados
3. Tenta a requisição novamente uma vez

Alguns proxies comunitários mais antigos usam fluxos de troca via `api.github.com/copilot_internal/v2/token`. Esse endpoint pode ficar indisponível para alguns tipos de conta (retorna 404). O Work4You, portanto, mantém a autenticação por token direto como caminho primário e conta com renovação de credenciais em tempo de execução + nova tentativa para robustez.
:::

**Roteamento de API**: modelos GPT-5+ (exceto `gpt-5-mini`) usam automaticamente a Responses API. Todos os outros modelos (GPT-4o, Claude, Gemini, etc.) usam Chat Completions. Os modelos são detectados automaticamente a partir do catálogo ao vivo do Copilot.

**`copilot-acp` — backend de agente ACP do Copilot**. Inicia o Copilot CLI local como um subprocesso:

```bash
work4you chat --provider copilot-acp --model copilot-acp
# Requer o GitHub Copilot CLI no PATH e uma sessão existente de `copilot login`
```

**Configuração permanente:**
```yaml
model:
  provider: "copilot"
  default: "gpt-5.4"
```

| Variável de ambiente | Descrição |
|---------------------|-------------|
| `COPILOT_GITHUB_TOKEN` | Token do GitHub para a API do Copilot (primeira prioridade) |
| `WORK4YOU_COPILOT_ACP_COMMAND` | Substitui o caminho do binário do Copilot CLI (padrão: `copilot`) |
| `WORK4YOU_COPILOT_ACP_ARGS` | Substitui os argumentos do ACP (padrão: `--acp --stdio`) |

### Provedores de API-Key de Primeira Classe

Esses provedores têm suporte nativo com IDs de provedor dedicados. Defina a chave de API e use `--provider` para selecionar:

```bash
# Fireworks AI
work4you chat --provider fireworks --model accounts/fireworks/models/kimi-k2p6
# Requer: FIREWORKS_API_KEY em ~/.work4you/.env

# NovitaAI Model API
work4you chat --provider novita --model moonshotai/kimi-k2.5
# Requer: NOVITA_API_KEY em ~/.work4you/.env

# z.ai / ZhipuAI GLM
work4you chat --provider zai --model glm-5
# Requer: GLM_API_KEY em ~/.work4you/.env

# Kimi / Moonshot AI (internacional: api.moonshot.ai)
work4you chat --provider kimi-coding --model kimi-for-coding
# Requer: KIMI_API_KEY em ~/.work4you/.env

# Kimi / Moonshot AI (China: api.moonshot.cn)
work4you chat --provider kimi-coding-cn --model kimi-k2.5
# Requer: KIMI_CN_API_KEY em ~/.work4you/.env

# MiniMax (endpoint global)
work4you chat --provider minimax --model MiniMax-M2.7
# Requer: MINIMAX_API_KEY em ~/.work4you/.env

# MiniMax (endpoint China)
work4you chat --provider minimax-cn --model MiniMax-M2.7
# Requer: MINIMAX_CN_API_KEY em ~/.work4you/.env

# Qwen Cloud / DashScope (modelos Qwen)
work4you chat --provider alibaba --model qwen3.5-plus
# Requer: DASHSCOPE_API_KEY em ~/.work4you/.env

# Xiaomi MiMo
work4you chat --provider xiaomi --model mimo-v2-pro
# Requer: XIAOMI_API_KEY em ~/.work4you/.env

# Tencent TokenHub (Hy3 Preview)
work4you chat --provider tencent-tokenhub --model hy3-preview
# Requer: TOKENHUB_API_KEY em ~/.work4you/.env

# Arcee AI (modelos Trinity)
work4you chat --provider arcee --model trinity-large-thinking
# Requer: ARCEEAI_API_KEY em ~/.work4you/.env

# Meta Model API (família Muse Spark)
work4you chat --provider meta-ai --model muse-spark-1.2
# Requer: MODEL_API_KEY em ~/.work4you/.env

# GMI Cloud
# Use o ID exato do modelo retornado pelo endpoint /v1/models da GMI.
work4you chat --provider gmi --model zai-org/GLM-5.1-FP8
# Requer: GMI_API_KEY em ~/.work4you/.env
```

A Fireworks usa seu catálogo de IDs no formato nativo com barras, como `accounts/fireworks/models/kimi-k2p6`. Execute `work4you model`, escolha **Fireworks AI**, e selecione a partir do catálogo ao vivo ou digite outro ID de modelo da Fireworks. O endpoint padrão é `https://api.fireworks.ai/inference/v1`; configure um endpoint diferente através de `model.base_url` em `config.yaml`, não no `.env`.

Ou defina o provedor permanentemente em `config.yaml`:
```yaml
model:
  provider: "gmi"
  default: "zai-org/GLM-5.1-FP8"
```

As URLs base podem ser substituídas com as variáveis de ambiente `NOVITA_BASE_URL`, `GLM_BASE_URL`, `KIMI_BASE_URL`, `MINIMAX_BASE_URL`, `MINIMAX_CN_BASE_URL`, `DASHSCOPE_BASE_URL`, `XIAOMI_BASE_URL`, `GMI_BASE_URL`, `META_BASE_URL`, ou `TOKENHUB_BASE_URL`.

:::note Nível contribuidor da Meta
`muse-spark-1.2-contributor` é o nível com desconto da Meta — a Meta pode treinar em cima dos seus prompts e completions, então a [seleção interativa de modelo pede confirmação](../user-guide/configuring-models.md) antes de usá-lo. Use `muse-spark-1.2` (preço padrão, sem treinamento) para trabalhos confidenciais.
:::

:::note Detecção Automática de Endpoint do Z.AI
Ao usar o provedor Z.AI / GLM, o Work4You sonda automaticamente múltiplos endpoints (global, China, variantes de coding) para encontrar um que aceite sua chave de API. Você não precisa definir `GLM_BASE_URL` manualmente — o endpoint funcional é detectado e armazenado em cache automaticamente.
:::

### xAI (Grok) — Responses API + Prompt Caching

A xAI é conectada através da Responses API (transporte `codex_responses`) para suporte automático a raciocínio nos modelos Grok 4 — nenhum parâmetro `reasoning_effort` é necessário, o servidor raciocina por padrão. Defina `XAI_API_KEY` em `~/.work4you/.env` e escolha a xAI em `work4you model`, ou use `grok` como atalho em `/model grok-4-fast-reasoning`.

Assinantes SuperGrok e X Premium+ podem entrar com OAuth pelo navegador em vez de usar uma chave de API — escolha **xAI Grok OAuth (SuperGrok / Premium+)** em `work4you model`, ou execute `work4you auth add xai-oauth`. O mesmo token bearer OAuth é reutilizado automaticamente pelas ferramentas diretas da xAI (TTS, geração de imagem, geração de vídeo, transcrição). Veja o [guia de OAuth do xAI Grok](../guides/xai-grok-oauth.md) para o fluxo completo — e se o Work4You roda em um host remoto, veja também [OAuth over SSH / Remote Hosts](../guides/oauth-over-ssh.md) para o túnel `ssh -L` necessário.

Ao usar a xAI como provedor (qualquer URL base contendo `x.ai`), o Work4You ativa automaticamente o prompt caching enviando o cabeçalho `x-grok-conv-id` em toda requisição de API. Isso roteia as requisições para o mesmo servidor dentro de uma sessão de conversa, permitindo que a infraestrutura da xAI reutilize prompts de sistema e histórico de conversa em cache.

Nenhuma configuração é necessária — o cache é ativado automaticamente quando um endpoint da xAI é detectado e um ID de sessão está disponível. Isso reduz a latência e o custo em conversas de múltiplos turnos.

A xAI também oferece um endpoint dedicado de TTS (`/v1/tts`). Selecione **xAI TTS** em `work4you tools` → Voice & TTS, ou veja a página [Voice & TTS](../user-guide/features/tts.md#text-to-speech) para configuração.

**Migração de modelos xAI aposentados (15 de maio de 2026):** a xAI está aposentando `grok-4*`, `grok-3`, `grok-code-fast-1`, e `grok-imagine-image-pro` em 15/05/2026. Tanto `work4you doctor` quanto a inicialização do `work4you chat` detectam qualquer configuração ainda apontando para uma referência aposentada e imprimem a substituição recomendada. Use `work4you migrate xai` para uma reescrita de configuração de uma só vez — dry-run por padrão, adicione `--apply` para gravar as mudanças (um backup com timestamp `config.yaml.bak-pre-migrate-xai-*` é criado automaticamente).

```bash
work4you migrate xai          # pré-visualiza as substituições
work4you migrate xai --apply  # reescreve ~/.work4you/config.yaml no local
```

**Backend de Busca Web da xAI.** Quando o conjunto de ferramentas [Web Search](../user-guide/features/web-search.md) está ativado, `web.backend: xai` roteia a busca através do endpoint de busca hospedado da xAI, usando as mesmas credenciais `XAI_API_KEY` / OAuth. Nenhuma configuração adicional é necessária se a xAI já estiver configurada como provedor.

### NovitaAI

A [NovitaAI](https://novita.ai) é a nuvem nativa de IA para construtores e agentes. Suas três linhas de produto são Model API para mais de 200 modelos, Agent Sandbox para construir e executar agentes de IA, e GPU Cloud para computação escalável, tudo disponível a partir de uma única plataforma.

```bash
# Use qualquer modelo disponível
work4you chat --provider novita --model moonshotai/kimi-k2.5
# Requer: NOVITA_API_KEY em ~/.work4you/.env

# Apelido curto
work4you chat --provider novita-ai --model deepseek/deepseek-v3-0324
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "novita"
  default: "moonshotai/kimi-k2.5"
  base_url: "https://api.novita.ai/openai/v1"
```

Obtenha sua chave de API em [novita.ai/settings/key-management](https://novita.ai/settings/key-management). A URL base pode ser substituída com `NOVITA_BASE_URL`.

### Ollama Cloud — Modelos Ollama Gerenciados, OAuth + Chave de API

O [Ollama Cloud](https://ollama.com/cloud) hospeda o mesmo catálogo de peso aberto do Ollama local, mas sem a exigência de GPU. Escolha-o em `work4you model` como **Ollama Cloud**, cole sua chave de API de [ollama.com/settings/keys](https://ollama.com/settings/keys), e o Work4You descobre automaticamente os modelos disponíveis.

```bash
work4you model
# → escolha "Ollama Cloud"
# → cole sua OLLAMA_API_KEY
# → selecione entre os modelos descobertos (gpt-oss:120b, glm-4.6:cloud, qwen3-coder:480b-cloud, etc.)
```

Ou diretamente em `config.yaml`:
```yaml
model:
  provider: "ollama-cloud"
  default: "gpt-oss:120b"
```

O catálogo de modelos é obtido dinamicamente de `ollama.com/v1/models` e armazenado em cache por uma hora. A notação `model:tag` (ex.: `qwen3-coder:480b-cloud`) é preservada durante a normalização — não use hífens.

:::tip Ollama Cloud vs Ollama local
Ambos falam a mesma API compatível com OpenAI. O Cloud é um provedor de primeira classe (`--provider ollama-cloud`, `OLLAMA_API_KEY`); o Ollama local é acessado pelo fluxo de Endpoint Personalizado (URL base `http://localhost:11434/v1`, sem chave). Use o cloud para modelos grandes que você não consegue rodar localmente; use o local para privacidade ou trabalho offline.
:::

### AWS Bedrock

Anthropic Claude, Amazon Nova, DeepSeek v3.2, Meta Llama 4, e outros modelos via AWS Bedrock. Usa a cadeia de credenciais do AWS SDK (`boto3`) — sem chave de API, apenas autenticação AWS padrão.

```bash
# Mais simples — perfil nomeado em ~/.aws/credentials
work4you chat --provider bedrock --model us.anthropic.claude-sonnet-4-6

# Ou com variáveis de ambiente explícitas
AWS_PROFILE=myprofile AWS_REGION=us-east-1 work4you chat --provider bedrock --model us.anthropic.claude-sonnet-4-6
```

Ou permanentemente em `config.yaml`:
```yaml
model:
  provider: "bedrock"
  default: "us.anthropic.claude-sonnet-4-6"
bedrock:
  region: "us-east-1"          # ou defina AWS_REGION
  # profile: "myprofile"       # ou defina AWS_PROFILE
  # discovery: true            # descobre a região automaticamente via IAM
  # guardrail:                 # Bedrock Guardrails opcional
  #   guardrail_identifier: "your-guardrail-id"
  #   guardrail_version: "DRAFT"
```

A autenticação usa a cadeia padrão do boto3: `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` explícitos, `AWS_PROFILE` de `~/.aws/credentials`, role IAM em EC2/ECS/Lambda, IMDS, ou SSO. Nenhuma variável de ambiente é necessária se você já estiver autenticado com a AWS CLI.

O Bedrock usa a **Converse API** por baixo dos panos — as requisições são traduzidas para o formato agnóstico de modelo do Bedrock, então a mesma configuração funciona para modelos Claude, Nova, DeepSeek, e Llama. Defina `BEDROCK_BASE_URL` apenas se estiver chamando um endpoint regional não padrão.

Veja o [guia do AWS Bedrock](/guides/aws-bedrock) para um passo a passo de configuração de IAM, seleção de região, e inferência entre regiões.

### Google Vertex AI

Modelos Gemini no Google Cloud Vertex AI via endpoint compatível com OpenAI do Vertex. A autenticação é **OAuth2** — um token de acesso de curta duração (~1 hora) gerado a partir de um JSON de conta de serviço ou de Application Default Credentials (ADC). Não há **chave de API estática**; o Work4You gera e renova automaticamente o token para você, incluindo a regeração em caso de `401` no meio da sessão.

```bash
# JSON de conta de serviço (recomendado para servidores / gateways)
echo "VERTEX_CREDENTIALS_PATH=/path/to/service-account.json" >> ~/.work4you/.env
# ou Application Default Credentials
gcloud auth application-default login

work4you model   # → "Google Vertex AI" → projeto → região → modelo
```

Ou em `config.yaml` (projeto/região não são sigilosos e ficam aqui; o caminho da credencial fica no `.env`):
```yaml
model:
  provider: "vertex"
  default: "google/gemini-3-flash-preview"   # o Vertex requer o prefixo google/
vertex:
  project_id: "my-gcp-project"   # em branco → usa o projeto embutido nas credenciais
  region: "global"               # necessário para as pré-visualizações do Gemini 3.x
```

As variáveis de ambiente `VERTEX_PROJECT_ID` / `VERTEX_REGION` substituem os valores do `config.yaml`. O Work4You instala o `google-auth` de forma preguiçosa no primeiro uso; execute `work4you setup` se a instalação gerenciada precisar de reparo. Veja o [guia do Google Vertex AI](/guides/google-vertex) para o passo a passo completo, e o [guia do Google Gemini](/guides/google-gemini) para o caminho de chave de API estática do AI Studio.

### Qwen Portal (OAuth)

O Qwen Portal da Alibaba com login OAuth pelo navegador. Escolha **Qwen OAuth (Portal)** em `work4you model`, entre pelo navegador, e o Work4You mantém o token de atualização.

```bash
work4you model
# → escolha "Qwen OAuth (Portal)"
# → o navegador abre; entre com sua conta Alibaba
# → confirme — as credenciais são salvas em ~/.work4you/auth.json

work4you chat   # usa o endpoint portal.qwen.ai/v1
```

Ou configure `config.yaml`:
```yaml
model:
  provider: "qwen-oauth"
  default: "qwen3-coder-plus"
```

Defina `WORK4YOU_QWEN_BASE_URL` apenas se o endpoint do portal mudar de local (padrão: `https://portal.qwen.ai/v1`).

:::tip Qwen OAuth vs Qwen Cloud (Alibaba DashScope)
O `qwen-oauth` usa o Qwen Portal voltado ao consumidor final, com login OAuth — ideal para usuários individuais. O provedor `alibaba` usa o Qwen Cloud (Alibaba DashScope) com uma `DASHSCOPE_API_KEY` — ideal para cargas de trabalho programáticas/de produção. Ambos roteiam para modelos da família Qwen, mas vivem em endpoints diferentes.
:::

### Alibaba Cloud (Coding Plan)

Se você é assinante do **Coding Plan** da Alibaba (uma SKU de preço separada do acesso padrão à API DashScope), o Work4You a expõe como seu próprio provedor de primeira classe: `alibaba-coding-plan`. Endpoint: `https://coding-intl.dashscope.aliyuncs.com/v1`. É compatível com OpenAI como o provedor `alibaba` normal, mas com uma URL base e uma superfície de faturamento diferentes.

```yaml
model:
  provider: alibaba_coding     # apelido para alibaba-coding-plan
  model: qwen3-coder-plus
```

Ou pela CLI:

```bash
work4you chat --provider alibaba_coding --model qwen3-coder-plus
```

O `alibaba_coding` usa a mesma `DASHSCOPE_API_KEY` que sua entrada `alibaba` já usa — nenhuma chave separada é necessária, apenas um destino de roteamento diferente. Antes desse provedor ser registrado, usuários que definiam `provider: alibaba_coding` em `config.yaml` caíam silenciosamente no roteamento do OpenRouter.

### MiniMax (OAuth)

MiniMax-M2.7 via login OAuth pelo navegador — sem necessidade de chave de API. Escolha **MiniMax (OAuth)** em `work4you model`, entre pelo navegador, e o Work4You mantém os tokens de acesso e atualização. Usa o endpoint compatível com Anthropic Messages (`/anthropic`) por baixo dos panos.

```bash
work4you model
# → escolha "MiniMax (OAuth)"
# → o navegador abre; entre com sua conta MiniMax (região global ou CN)
# → confirme — as credenciais são salvas em ~/.work4you/auth.json

work4you chat   # usa o endpoint api.minimax.io/anthropic
```

Ou configure `config.yaml`:
```yaml
model:
  provider: "minimax-oauth"
  default: "MiniMax-M2.7"
```

Modelos suportados: `MiniMax-M2.7` (principal) e `MiniMax-M2.7-highspeed` (conectado como o modelo auxiliar padrão). O caminho OAuth ignora `MINIMAX_API_KEY` / `MINIMAX_BASE_URL`.

:::tip MiniMax OAuth vs chave de API
O `minimax-oauth` usa o portal voltado ao consumidor final da MiniMax, com login OAuth — sem necessidade de configuração de faturamento. Os provedores `minimax` e `minimax-cn` usam `MINIMAX_API_KEY` / `MINIMAX_CN_API_KEY` — para acesso programático. Veja o [guia de OAuth da MiniMax](/guides/minimax-oauth) para um passo a passo completo.
:::

### NVIDIA NIM

Nemotron e outros modelos de código aberto via [build.nvidia.com](https://build.nvidia.com) (chave de API gratuita) ou um endpoint NIM local.

```bash
# Nuvem (build.nvidia.com)
work4you chat --provider nvidia --model nvidia/nemotron-3-super-120b-a12b
# Requer: NVIDIA_API_KEY em ~/.work4you/.env

# Endpoint NIM local — substitua a URL base
NVIDIA_BASE_URL=http://localhost:8000/v1 work4you chat --provider nvidia --model nvidia/nemotron-3-super-120b-a12b
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "nvidia"
  default: "nvidia/nemotron-3-super-120b-a12b"
```

:::tip NIM Local
Para implantações on-prem (DGX Spark, GPU local), defina `NVIDIA_BASE_URL=http://localhost:8000/v1`. O NIM expõe a mesma API de chat completions compatível com OpenAI do build.nvidia.com, então alternar entre nuvem e local é uma mudança de uma linha na variável de ambiente.
:::

O Work4You anexa automaticamente o cabeçalho de origem de faturamento do NIM em toda requisição para `build.nvidia.com` — nenhuma configuração é necessária. Isso roteia o consumo para a origem correta no painel de faturamento da NVIDIA.

### GMI Cloud

Modelos abertos e de raciocínio via [GMI Cloud](https://www.gmicloud.ai/) — API compatível com OpenAI, autenticação por chave de API.

```bash
# GMI Cloud
work4you chat --provider gmi --model deepseek-ai/DeepSeek-V3.2
# Requer: GMI_API_KEY em ~/.work4you/.env
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "gmi"
  default: "deepseek-ai/DeepSeek-V3.2"
```

A URL base pode ser substituída com `GMI_BASE_URL` (padrão: `https://api.gmi-serving.com/v1`).

### Actual Computer

Seu próprio hardware como um cluster de inferência privado via [Actual Computer](https://actual.inc). Dois modos de serviço, ambos compatíveis com OpenAI (o Work4You usa o transporte Responses API):

- **Relay hospedado** — `https://api.actual.inc`, criptografado de ponta a ponta, roteia para *o seu* cluster. Autentique com uma chave de inferência `ac_` de [actual.inc/user/keys](https://actual.inc/user/keys).
- **Daemon local** — no dispositivo em `http://127.0.0.1:8080`, totalmente offline. Nenhuma chave de API necessária: o Work4You detecta a URL base de loopback e autentica com um placeholder interno automaticamente.

```bash
# Relay hospedado (ACTUAL_API_KEY em ~/.work4you/.env)
work4you chat --provider actual --model <model-id-from-your-cluster>

# Daemon local (ACTUAL_BASE_URL=http://127.0.0.1:8080 em ~/.work4you/.env, sem chave)
work4you chat --provider actual --model <installed-model-name>
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "actual"
  default: "<model-id>"
```

Observações:
- Os IDs de modelo vêm de `GET /v1/models` do seu cluster — descubra com `work4you model` ou `curl -s https://api.actual.inc/v1/models -H "Authorization: Bearer $ACTUAL_API_KEY"`.
- Hosts simples são normalizados: `ACTUAL_BASE_URL=http://127.0.0.1:8080` vira `http://127.0.0.1:8080/v1` automaticamente.
- O esforço de raciocínio é limitado ao intervalo suportado pela Actual (`none/low/medium/high/max`) — uma configuração global `xhigh`/`ultra` não vai gerar erro 400 nas requisições.
- Modelos locais pequenos: o conjunto de ferramentas padrão completo do Work4You, mais o prompt de sistema, pode exceder uma janela de contexto de 32k, produzindo um erro de stream vazio em servidores da família llama.cpp. Restrinja o conjunto de ferramentas (`-t file,web`) ou carregue o modelo com um contexto maior. A skill opcional `actual-setup` (`work4you skills install official/devops/actual-setup`) cobre a configuração e a solução de problemas em detalhe.
- Apelidos: `actual-computer`, `actualcomputer`, `aci`.

### StepFun

Modelos da série Step via [StepFun](https://platform.stepfun.com) — API compatível com OpenAI, autenticação por chave de API.

```bash
# StepFun
work4you chat --provider stepfun --model step-3.5-flash
# Requer: STEPFUN_API_KEY em ~/.work4you/.env
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "stepfun"
  default: "step-3.5-flash"
```

A URL base pode ser substituída com `STEPFUN_BASE_URL` (padrão: `https://api.stepfun.com/v1`).

### Hugging Face Inference Providers

O [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers) roteia para mais de 20 modelos abertos através de um endpoint unificado compatível com OpenAI (`router.huggingface.co/v1`). As requisições são roteadas automaticamente para o backend disponível mais rápido (Groq, Together, SambaNova, etc.) com failover automático.

```bash
# Use qualquer modelo disponível
work4you chat --provider huggingface --model Qwen/Qwen3.5-397B-A17B
# Requer: HF_TOKEN em ~/.work4you/.env

# Apelido curto
work4you chat --provider hf --model deepseek-ai/DeepSeek-V3.2
```

Ou defina permanentemente em `config.yaml`:
```yaml
model:
  provider: "huggingface"
  default: "Qwen/Qwen3.5-397B-A17B"
```

Obtenha seu token em [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) — certifique-se de ativar a permissão "Make calls to Inference Providers". Nível gratuito incluso ($0,10/mês de crédito, sem markup sobre os preços do provedor).

Você pode anexar sufixos de roteamento aos nomes de modelo: `:fastest` (padrão), `:cheapest`, ou `:provider_name` para forçar um backend específico.

A URL base pode ser substituída com `HF_BASE_URL`.

## Provedores de LLM Personalizados e Auto-Hospedados

O Work4You funciona com **qualquer endpoint de API compatível com OpenAI**. Se um servidor implementa `/v1/chat/completions`, você pode apontar o Work4You para ele. Isso significa que você pode usar modelos locais, servidores de inferência com GPU, roteadores multi-provedor, ou qualquer API de terceiros.

### Configuração Geral

Três formas de configurar um endpoint personalizado:

**Configuração interativa (recomendada):**
```bash
work4you model
# Selecione "Custom endpoint (self-hosted / VLLM / etc.)"
# Digite: URL base da API, chave de API, nome do modelo
```

**Configuração manual (`config.yaml`):**
```yaml
# Em ~/.work4you/config.yaml
model:
  default: your-model-name
  provider: custom
  base_url: http://localhost:8000/v1
  api_key: your-key-or-leave-empty-for-local
```

:::warning Variáveis de ambiente legadas
`LLM_MODEL` no `.env` foi **removida** — `config.yaml` é a única fonte de verdade para a configuração de modelo e endpoint. `OPENAI_BASE_URL` ainda é respeitada, mas **apenas** para o provedor `openai-api` (ela substitui o endpoint da OpenAI para acesso direto via chave de API). Para outros provedores e endpoints personalizados, use `work4you model` ou defina `model.base_url` diretamente em `config.yaml`. Se você tiver entradas obsoletas no seu `.env`, elas são limpas automaticamente na próxima execução de `work4you setup` ou migração de configuração.
:::

Ambas as abordagens persistem em `config.yaml`, que é a fonte de verdade para modelo, provedor e URL base.

### Trocando de Modelos com `/model`

:::warning work4you model vs /model
**`work4you model`** (executado no seu terminal, fora de qualquer sessão de chat) é o **assistente completo de configuração de provedor**. Use-o para adicionar novos provedores, executar fluxos OAuth, digitar chaves de API e configurar endpoints personalizados.

**`/model`** (digitado dentro de uma sessão de chat ativa do Work4You) só pode **alternar entre provedores e modelos que você já configurou**. Ele não pode adicionar novos provedores, executar OAuth, ou pedir chaves de API. Se você configurou apenas um provedor (ex.: OpenRouter), `/model` só mostrará modelos desse provedor.

**Para adicionar um novo provedor:** saia da sua sessão (`Ctrl+C` ou `/quit`), execute `work4you model`, configure o novo provedor, e então inicie uma nova sessão.
:::

Depois que você tiver pelo menos um endpoint personalizado configurado, você pode trocar de modelo no meio da sessão:

```
/model custom:qwen-2.5          # Troca para um modelo no seu endpoint personalizado
/model custom                    # Detecta automaticamente o modelo a partir do endpoint
/model openrouter:claude-sonnet-4 # Volta para um provedor em nuvem
```

Se você tiver **provedores personalizados nomeados** configurados (veja abaixo), use a sintaxe tripla:

```
/model custom:local:qwen-2.5    # Usa o provedor personalizado "local" com o modelo qwen-2.5
/model custom:work:llama3       # Usa o provedor personalizado "work" com llama3
```

Ao trocar de provedor, o Work4You persiste a URL base e o provedor na configuração, para que a mudança sobreviva a reinicializações. Ao trocar de um endpoint personalizado de volta para um provedor integrado, a URL base obsoleta é limpa automaticamente.

:::tip
`/model custom` (sem nome de modelo) consulta a API `/models` do seu endpoint e seleciona automaticamente o modelo, se exatamente um estiver carregado. Útil para servidores locais rodando um único modelo.
:::

Tudo abaixo segue esse mesmo padrão — basta trocar a URL, a chave e o nome do modelo.

---

### Ollama — Modelos Locais, Configuração Zero

O [Ollama](https://ollama.com/) executa modelos de peso aberto localmente com um único comando. Melhor para: experimentação local rápida, trabalho sensível à privacidade, uso offline. Suporta chamada de ferramentas via a API compatível com OpenAI.

```bash
# Instalar e executar um modelo
ollama pull qwen2.5-coder:32b
ollama serve   # Inicia na porta 11434
```

Depois, configure o Work4You:

```bash
work4you model
# Selecione "Custom endpoint (self-hosted / VLLM / etc.)"
# Digite a URL: http://localhost:11434/v1
# Pule a chave de API (o Ollama não precisa de uma)
# Digite o nome do modelo (ex.: qwen2.5-coder:32b)
```

Ou configure `config.yaml` diretamente:

```yaml
model:
  default: qwen2.5-coder:32b
  provider: custom
  base_url: http://localhost:11434/v1
  context_length: 64000   # Veja o aviso abaixo
```

:::caution O Ollama usa por padrão janelas de contexto muito baixas
O Ollama **não** usa a janela de contexto completa do seu modelo por padrão. Dependendo da sua VRAM, o padrão é:

| VRAM disponível | Contexto padrão |
|----------------|----------------|
| Menos de 24 GB | **4.096 tokens** |
| 24–48 GB | 32.768 tokens |
| 48+ GB | 256.000 tokens |

O Work4You exige pelo menos **64.000 tokens** de contexto para uso de agente com ferramentas. Janelas menores são rejeitadas na inicialização, porque o prompt de sistema, os esquemas de ferramentas e o estado de conversa em andamento precisam de espaço suficiente para fluxos de trabalho confiáveis de múltiplas etapas.

**Como aumentar** (escolha uma):

```bash
# Opção 1: Definir globalmente via variável de ambiente (recomendado)
OLLAMA_CONTEXT_LENGTH=64000 ollama serve

# Opção 2: Para Ollama gerenciado por systemd
sudo systemctl edit ollama.service
# Adicione: Environment="OLLAMA_CONTEXT_LENGTH=64000"
# Depois: sudo systemctl daemon-reload && sudo systemctl restart ollama

# Opção 3: Incorporar em um modelo personalizado (persistente por modelo)
echo -e "FROM qwen2.5-coder:32b\nPARAMETER num_ctx 64000" > Modelfile
ollama create qwen2.5-coder-64k -f Modelfile
```

**Você não pode definir o comprimento de contexto através da API compatível com OpenAI** (`/v1/chat/completions`). Isso precisa ser configurado no lado do servidor ou via um Modelfile. Essa é a fonte de confusão nº 1 ao integrar o Ollama com ferramentas como o Work4You.
:::

**Verifique se seu contexto está definido corretamente:**

```bash
ollama ps
# Observe a coluna CONTEXT — ela deve mostrar o valor configurado
```

:::tip
Liste os modelos disponíveis com `ollama list`. Baixe qualquer modelo da [biblioteca do Ollama](https://ollama.com/library) com `ollama pull <model>`. O Ollama gerencia o offloading de GPU automaticamente — nenhuma configuração é necessária para a maioria das instalações.
:::

---

### vLLM — Inferência de GPU de Alta Performance

O [vLLM](https://docs.vllm.ai/) é o padrão para servir LLMs em produção. Melhor para: máximo throughput em hardware de GPU, servir modelos grandes, batching contínuo.

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
  --port 8000 \
  --max-model-len 65536 \
  --tensor-parallel-size 2 \
  --enable-auto-tool-choice \
  --tool-call-parser work4you
```

Depois, configure o Work4You:

```bash
work4you model
# Selecione "Custom endpoint (self-hosted / VLLM / etc.)"
# Digite a URL: http://localhost:8000/v1
# Pule a chave de API (ou digite uma se você configurou o vLLM com --api-key)
# Digite o nome do modelo: meta-llama/Llama-3.1-70B-Instruct
```

**Comprimento de contexto:** o vLLM lê o `max_position_embeddings` do modelo por padrão. Se isso exceder sua memória de GPU, ele gera um erro e pede para você definir `--max-model-len` mais baixo. Você também pode usar `--max-model-len auto` para encontrar automaticamente o máximo que cabe. Defina `--gpu-memory-utilization 0.95` (padrão 0.9) para encaixar mais contexto na VRAM.

**A chamada de ferramentas exige flags explícitas:**

| Flag | Propósito |
|------|---------|
| `--enable-auto-tool-choice` | Necessária para `tool_choice: "auto"` (o padrão no Work4You) |
| `--tool-call-parser <name>` | Parser para o formato de chamada de ferramentas do modelo |

Parsers suportados: `work4you` (Qwen 2.5, Work4You 2/3), `llama3_json` (Llama 3.x), `mistral`, `deepseek_v3`, `deepseek_v31`, `xlam`, `pythonic`. Sem essas flags, chamadas de ferramentas não vão funcionar — o modelo vai produzir chamadas de ferramentas como texto.

**Parsers de raciocínio Qwen:** o Work4You preserva metadados de raciocínio estruturados, como `reasoning`, `reasoning_content`, e deltas de raciocínio em streaming, quando servidores compatíveis com OpenAI os retornam. Esses metadados são tratados como dados de rastro de raciocínio/pensamento, não como substituto da resposta visível do assistente. Para modelos de raciocínio Qwen servidos pelo vLLM, certifique-se de que a resposta final visível ao usuário ainda apareça em `content`. Se `--reasoning-parser qwen3` deixar `content` vazio na sua implantação, desative esse parser ou passe uma opção de requisição suportada pelo servidor, como `chat_template_kwargs.enable_thinking: false`, através de `extra_body`.

:::tip
O vLLM suporta tamanhos legíveis por humanos: `--max-model-len 64k` (k minúsculo = 1000, K maiúsculo = 1024).
:::

---

### SGLang — Serviço Rápido com RadixAttention

O [SGLang](https://github.com/sgl-project/sglang) é uma alternativa ao vLLM com RadixAttention para reutilização de cache KV. Melhor para: conversas de múltiplos turnos (cache de prefixo), decodificação restrita, saída estruturada.

```bash
pip install "sglang[all]"
python -m sglang.launch_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --port 30000 \
  --context-length 65536 \
  --tp 2 \
  --tool-call-parser qwen
```

Depois, configure o Work4You:

```bash
work4you model
# Selecione "Custom endpoint (self-hosted / VLLM / etc.)"
# Digite a URL: http://localhost:30000/v1
# Digite o nome do modelo: meta-llama/Llama-3.1-70B-Instruct
```

**Comprimento de contexto:** o SGLang lê a partir da configuração do modelo por padrão. Use `--context-length` para substituir. Se você precisar exceder o máximo declarado do modelo, defina `SGLANG_ALLOW_OVERWRITE_LONGER_CONTEXT_LEN=1`.

**Chamada de ferramentas:** use `--tool-call-parser` com o parser apropriado para a família do seu modelo: `qwen` (Qwen 2.5), `llama3`, `llama4`, `deepseekv3`, `mistral`, `glm`. Sem essa flag, as chamadas de ferramentas voltam como texto simples.

:::caution O SGLang usa por padrão apenas 128 tokens de saída
Se as respostas parecerem cortadas, adicione `max_tokens` às suas requisições ou defina `--default-max-tokens` no servidor. O padrão do SGLang é de apenas 128 tokens por resposta, quando não especificado na requisição.
:::

---

### llama.cpp / llama-server — Inferência em CPU e Metal

O [llama.cpp](https://github.com/ggml-org/llama.cpp) executa modelos quantizados em CPU, Apple Silicon (Metal), e GPUs de consumidor. Melhor para: executar modelos sem uma GPU de datacenter, usuários de Mac, implantação em edge.

```bash
# Compilar e iniciar o llama-server
cmake -B build && cmake --build build --config Release
./build/bin/llama-server \
  --jinja -fa \
  -c 64000 \
  -ngl 99 \
  -m models/qwen2.5-coder-32b-instruct-Q4_K_M.gguf \
  --port 8080 --host 0.0.0.0
```

**Comprimento de contexto (`-c`):** builds recentes usam `0` como padrão, o que lê o contexto de treinamento do modelo a partir dos metadados do GGUF. Para modelos com contexto de treinamento de 128k ou mais, isso pode causar um OOM ao tentar alocar o cache KV completo. Defina `-c` explicitamente para pelo menos 64.000 tokens para o Work4You. Se estiver usando slots paralelos (`-np`), o contexto total é dividido entre os slots — com `-c 64000 -np 4`, cada slot recebe apenas 16k, o que está abaixo do mínimo por sessão ativa do Work4You.

Depois, configure o Work4You para apontar para ele:

```bash
work4you model
# Selecione "Custom endpoint (self-hosted / VLLM / etc.)"
# Digite a URL: http://localhost:8080/v1
# Pule a chave de API (servidores locais não precisam de uma)
# Digite o nome do modelo — ou deixe em branco para detecção automática, se apenas um modelo estiver carregado
```

Isso salva o endpoint em `config.yaml`, de modo que persista entre sessões.

:::caution `--jinja` é necessário para chamada de ferramentas
Sem `--jinja`, o llama-server ignora completamente o parâmetro `tools`. O modelo vai tentar chamar ferramentas escrevendo JSON no texto da resposta, mas o Work4You não vai reconhecer isso como uma chamada de ferramenta — você verá um JSON bruto como `{"name": "web_search", ...}` impresso como uma mensagem, em vez de uma busca real.

Suporte nativo à chamada de ferramentas (melhor performance): Llama 3.x, Qwen 2.5 (incluindo Coder), Work4You 2/3, Mistral, DeepSeek, Functionary. Todos os outros modelos usam um manipulador genérico que funciona, mas pode ser menos eficiente. Veja a [documentação de function calling do llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) para a lista completa.

Você pode verificar se o suporte a ferramentas está ativo checando `http://localhost:8080/props` — o campo `chat_template` deve estar presente.
:::

:::tip
Baixe modelos GGUF do [Hugging Face](https://huggingface.co/models?library=gguf). A quantização Q4_K_M oferece o melhor equilíbrio entre qualidade e uso de memória.
:::

---

### LM Studio — Aplicativo de Desktop com Modelos Locais

O [LM Studio](https://lmstudio.ai/) é um aplicativo de desktop para rodar modelos locais com uma interface gráfica. Melhor para: usuários que preferem uma interface visual, testes rápidos de modelos, desenvolvedores em macOS/Windows/Linux.

Inicie o servidor a partir do app LM Studio (aba Developer → Start Server), ou use a CLI:

```bash
lms server start                        # Inicia na porta 1234
lms load qwen2.5-coder --context-length 64000
```

Depois, configure o Work4You:

```bash
work4you model
# Selecione "LM Studio"
# Pressione Enter para usar http://localhost:1234/v1
# Escolha um dos modelos descobertos
# Se a autenticação do servidor LM Studio estiver ativada, digite LM_API_KEY quando solicitado
```

O Work4You preserva o contexto de uma instância do LM Studio já carregada. Para um modelo não carregado no modo explícito padrão, o Work4You omite `context_length`, a menos que você tenha configurado um no Work4You, para que o LM Studio possa aplicar sua própria configuração de modelo. O Work4You então usa apenas o comprimento de contexto que o LM Studio relata após o carregamento.

Para alterar o comprimento de contexto no LM Studio:

1. Clique no ícone de engrenagem ao lado do seletor de modelo
2. Defina "Context Length" para pelo menos 64000, para uma experiência tranquila
3. Recarregue o modelo para que a mudança tenha efeito
4. Se sua máquina não conseguir suportar 64000, considere usar um modelo menor com comprimentos de contexto maiores.

Alternativamente, use a CLI: `lms load model-name --context-length 64000`

Você pode usar a CLI para estimar se o modelo vai caber: `lms load model-name --context-length 64000 --estimate-only`

Para definir padrões persistentes por modelo: aba My Models → ícone de engrenagem no modelo → defina o tamanho do contexto.
:::

Se você usa o recurso Just-In-Time loading / Auto-Evict do LM Studio e quer que o LM Studio gerencie o carregamento e a remoção de modelos a partir de requisições de chat normais, pule a etapa de pré-carregamento explícito do Work4You:

```bash
work4you config set model.lmstudio_load_mode jit
```

Volte ao comportamento padrão de pré-carregamento explícito com:

```bash
work4you config set model.lmstudio_load_mode explicit
```

**Chamada de ferramentas:** suportada desde o LM Studio 0.3.6. Modelos com treinamento nativo de chamada de ferramentas (Qwen 2.5, Llama 3.x, Mistral, Work4You) são detectados automaticamente e exibidos com um selo de ferramenta. Outros modelos usam um fallback genérico que pode ser menos confiável.

---

### Rede WSL2 (Usuários Windows)

Como o Work4You exige um ambiente Unix, usuários Windows o executam dentro do WSL2. Se o servidor do seu modelo (Ollama, LM Studio, etc.) roda no **host Windows**, você precisa fazer a ponte da rede — o WSL2 usa um adaptador de rede virtual com sua própria sub-rede, então `localhost` dentro do WSL2 se refere à VM Linux, **não** ao host Windows.

:::tip Ambos no WSL2? Sem problema.
Se o servidor do seu modelo também roda dentro do WSL2 (comum para vLLM, SGLang, e llama-server), `localhost` funciona normalmente — eles compartilham o mesmo namespace de rede. Pule esta seção.
:::

#### Opção 1: Modo de Rede Espelhada (Recomendado)

Disponível no **Windows 11 22H2+**, o modo espelhado faz o `localhost` funcionar bidirecionalmente entre Windows e WSL2 — a correção mais simples.

1. Crie ou edite `%USERPROFILE%\.wslconfig` (ex.: `C:\Users\YourName\.wslconfig`):
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```

2. Reinicie o WSL a partir do PowerShell:
   ```powershell
   wsl --shutdown
   ```

3. Reabra seu terminal WSL2. `localhost` agora alcança os serviços do Windows:
   ```bash
   curl http://localhost:11434/v1/models   # Ollama no Windows — funciona
   ```

:::note Firewall do Hyper-V
Em algumas builds do Windows 11, o firewall do Hyper-V bloqueia conexões espelhadas por padrão. Se `localhost` ainda não funcionar depois de ativar o modo espelhado, execute isto em um **PowerShell de Administrador**:
```powershell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```
:::

#### Opção 2: Usar o IP do Host Windows (Windows 10 / builds mais antigas)

Se você não pode usar o modo espelhado, encontre o IP do host Windows de dentro do WSL2 e use-o em vez de `localhost`:

```bash
# Obtenha o IP do host Windows (o gateway padrão da rede virtual do WSL2)
ip route show | grep -i default | awk '{ print $3 }'
# Exemplo de saída: 172.29.192.1
```

Use esse IP na sua configuração do Work4You:

```yaml
model:
  default: qwen2.5-coder:32b
  provider: custom
  base_url: http://172.29.192.1:11434/v1   # IP do host Windows, não localhost
```

:::tip Auxiliar dinâmico
O IP do host pode mudar ao reiniciar o WSL2. Você pode obtê-lo dinamicamente no seu shell:
```bash
export WSL_HOST=$(ip route show | grep -i default | awk '{ print $3 }')
echo "Windows host at: $WSL_HOST"
curl http://$WSL_HOST:11434/v1/models   # Testar o Ollama
```

Ou use o nome mDNS da sua máquina (requer `libnss-mdns` no WSL2):
```bash
sudo apt install libnss-mdns
curl http://$(hostname).local:11434/v1/models
```
:::

#### Endereço de Bind do Servidor (Necessário para o Modo NAT)

Se você estiver usando a **Opção 2** (modo NAT com o IP do host), o servidor de modelo no Windows precisa aceitar conexões vindas de fora de `127.0.0.1`. Por padrão, a maioria dos servidores escuta apenas em localhost — conexões WSL2 no modo NAT vêm de uma sub-rede virtual diferente e serão recusadas. No modo espelhado, `localhost` mapeia diretamente, então o bind padrão em `127.0.0.1` funciona normalmente.

| Servidor | Bind padrão | Como corrigir |
|--------|-------------|------------|
| **Ollama** | `127.0.0.1` | Defina a variável de ambiente `OLLAMA_HOST=0.0.0.0` antes de iniciar o Ollama (System Settings → Environment Variables no Windows, ou edite o serviço do Ollama) |
| **LM Studio** | `127.0.0.1` | Ative **"Serve on Network"** na aba Developer → configurações do servidor |
| **llama-server** | `127.0.0.1` | Adicione `--host 0.0.0.0` ao comando de inicialização |
| **vLLM** | `0.0.0.0` | Já faz bind em todas as interfaces por padrão |
| **SGLang** | `127.0.0.1` | Adicione `--host 0.0.0.0` ao comando de inicialização |

**Ollama no Windows (detalhado):** o Ollama roda como um serviço do Windows. Para definir `OLLAMA_HOST`:
1. Abra **System Properties** → **Environment Variables**
2. Adicione uma nova **variável de Sistema**: `OLLAMA_HOST` = `0.0.0.0`
3. Reinicie o serviço do Ollama (ou reinicie o computador)

#### Firewall do Windows

O Firewall do Windows trata o WSL2 como uma rede separada (tanto no modo NAT quanto no espelhado). Se as conexões ainda falharem depois das etapas acima, adicione uma regra de firewall para a porta do servidor do seu modelo:

```powershell
# Execute em um PowerShell de Administrador — substitua PORT pela porta do seu servidor
New-NetFirewallRule -DisplayName "Allow WSL2 to Model Server" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11434
```

Portas comuns: Ollama `11434`, vLLM `8000`, SGLang `30000`, llama-server `8080`, LM Studio `1234`.

#### Verificação Rápida

De dentro do WSL2, teste se você consegue alcançar seu servidor de modelo:

```bash
# Substitua a URL pelo endereço e porta do seu servidor
curl http://localhost:11434/v1/models          # Modo espelhado
curl http://172.29.192.1:11434/v1/models       # Modo NAT (use o IP real do seu host)
```

Se você receber uma resposta JSON listando seus modelos, está tudo certo. Use essa mesma URL como o `base_url` na sua configuração do Work4You.

---

### Solução de Problemas com Modelos Locais

Esses problemas afetam **todos** os servidores de inferência locais quando usados com o Work4You.

#### "Connection refused" do WSL2 para um servidor de modelo hospedado no Windows

Se você está executando o Work4You dentro do WSL2 e seu servidor de modelo no host Windows, `http://localhost:<port>` não vai funcionar no modo de rede NAT padrão do WSL2. Veja [Rede WSL2](#wsl2-networking-windows-users) acima para a correção.

#### Chamadas de ferramentas aparecem como texto em vez de serem executadas

O modelo produz algo como `{"name": "web_search", "arguments": {...}}` como uma mensagem, em vez de realmente chamar a ferramenta.

**Causa:** seu servidor não tem a chamada de ferramentas ativada, ou o modelo não a suporta através da implementação de chamada de ferramentas do servidor.

| Servidor | Correção |
|--------|-----|
| **llama.cpp** | Adicione `--jinja` ao comando de inicialização |
| **vLLM** | Adicione `--enable-auto-tool-choice --tool-call-parser work4you` |
| **SGLang** | Adicione `--tool-call-parser qwen` (ou o parser apropriado) |
| **Ollama** | A chamada de ferramentas é ativada por padrão — certifique-se de que seu modelo a suporta (verifique com `ollama show model-name`) |
| **LM Studio** | Atualize para 0.3.6+ e use um modelo com suporte nativo a ferramentas |

#### O modelo parece esquecer o contexto ou dá respostas incoerentes

**Causa:** a janela de contexto é pequena demais. Quando a conversa excede o limite de contexto, a maioria dos servidores descarta silenciosamente as mensagens mais antigas. O prompt de sistema e os esquemas de ferramentas do Work4You sozinhos podem usar de 4k a 8k tokens.

**Diagnóstico:**

```bash
# Verifique o que o Work4You acha que é o contexto
# Observe a linha de inicialização: "Context limit: X tokens"

# Verifique o contexto real do seu servidor
# Ollama: ollama ps (coluna CONTEXT)
# llama.cpp: curl http://localhost:8080/props | jq '.default_generation_settings.n_ctx'
# vLLM: verifique --max-model-len nos argumentos de inicialização
```

**Correção:** defina o contexto para pelo menos **64.000 tokens** para uso de agente. Veja a seção de cada servidor acima para a flag específica.

#### "Context limit: 2048 tokens" na inicialização

O Work4You detecta automaticamente o comprimento de contexto a partir do endpoint `/v1/models` do seu servidor. Se o servidor relatar um valor baixo (ou não relatar nenhum), o Work4You usa o limite declarado do modelo, que pode estar errado.

**Correção:** defina explicitamente em `config.yaml`:

```yaml
model:
  default: your-model
  provider: custom
  base_url: http://localhost:11434/v1
  context_length: 64000
```

#### Respostas são cortadas no meio da frase

**Possíveis causas:**
1. **Limite de saída baixo (`max_tokens`) no servidor** — o SGLang usa por padrão 128 tokens por resposta. Defina `--default-max-tokens` no servidor ou configure o Work4You com `model.max_tokens` em config.yaml. Observação: `max_tokens` controla apenas o comprimento da resposta — não tem relação com o quanto o histórico da sua conversa pode durar (isso é `context_length`).
2. **Esgotamento de contexto** — o modelo preencheu sua janela de contexto. Aumente `model.context_length` ou ative a [compressão de contexto](/user-guide/configuration#context-compression) no Work4You.

---

### LiteLLM Proxy — Gateway Multi-Provedor

O [LiteLLM](https://docs.litellm.ai/) é um proxy compatível com OpenAI que unifica mais de 100 provedores de LLM sob uma única API. Melhor para: alternar entre provedores sem mudanças de configuração, balanceamento de carga, cadeias de fallback, controles de orçamento.

```bash
# Instalar e iniciar
pip install "litellm[proxy]"
litellm --model anthropic/claude-sonnet-4 --port 4000

# Ou com um arquivo de configuração para múltiplos modelos:
litellm --config litellm_config.yaml --port 4000
```

Depois, configure o Work4You com `work4you model` → Custom endpoint → `http://localhost:4000/v1`.

Exemplo de `litellm_config.yaml` com fallback:
```yaml
model_list:
  - model_name: "best"
    litellm_params:
      model: anthropic/claude-sonnet-4
      api_key: sk-ant-...
  - model_name: "best"
    litellm_params:
      model: openai/gpt-4o
      api_key: sk-...
router_settings:
  routing_strategy: "latency-based-routing"
```

---

### ClawRouter — Roteamento Otimizado por Custo

O [ClawRouter](https://github.com/BlockRunAI/ClawRouter), da BlockRunAI, é um proxy de roteamento local que seleciona modelos automaticamente com base na complexidade da consulta. Ele classifica as requisições em 14 dimensões e roteia para o modelo mais barato capaz de lidar com a tarefa. O pagamento é feito via criptomoeda USDC (sem chaves de API).

```bash
# Instalar e iniciar
npx @blockrun/clawrouter    # Inicia na porta 8402
```

Depois, configure o Work4You com `work4you model` → Custom endpoint → `http://localhost:8402/v1` → nome do modelo `blockrun/auto`.

Perfis de roteamento:
| Perfil | Estratégia | Economia |
|---------|----------|---------|
| `blockrun/auto` | Equilíbrio qualidade/custo | 74–100% |
| `blockrun/eco` | O mais barato possível | 95–100% |
| `blockrun/premium` | Modelos de melhor qualidade | 0% |
| `blockrun/free` | Somente modelos gratuitos | 100% |
| `blockrun/agentic` | Otimizado para uso de ferramentas | varia |

:::note
O ClawRouter exige uma carteira financiada em USDC na Base ou Solana para pagamento. Todas as requisições passam pela API de backend da BlockRun. Execute `npx @blockrun/clawrouter doctor` para verificar o status da carteira.
:::

---

### Outros Provedores Compatíveis

Qualquer serviço com uma API compatível com OpenAI funciona. Algumas opções populares:

| Provedor | URL Base | Observações |
|----------|----------|-------|
| [Together AI](https://together.ai) | `https://api.together.xyz/v1` | Modelos abertos hospedados na nuvem |
| [Groq](https://groq.com) | `https://api.groq.com/openai/v1` | Inferência ultra-rápida |
| [DeepSeek](https://deepseek.com) | `https://api.deepseek.com/v1` | Modelos DeepSeek |
| [Fireworks AI](https://fireworks.ai) | `https://api.fireworks.ai/inference/v1` | Hospedagem rápida de modelos abertos |
| [GMI Cloud](https://www.gmicloud.ai/) | `https://api.gmi-serving.com/v1` | Inferência gerenciada compatível com OpenAI |
| [Actual Computer](https://actual.inc) | `https://api.actual.inc/v1` | Relay privado para o seu próprio cluster; daemon local em `http://127.0.0.1:8080/v1` |
| [Cerebras](https://cerebras.ai) | `https://api.cerebras.ai/v1` | Inferência em chip de escala de wafer |
| [Mistral AI](https://mistral.ai) | `https://api.mistral.ai/v1` | Modelos Mistral |
| [OpenAI](https://openai.com) | `https://api.openai.com/v1` | Acesso direto à OpenAI |
| [Azure OpenAI](https://azure.microsoft.com) | `https://YOUR.openai.azure.com/` | OpenAI empresarial |
| [LocalAI](https://localai.io) | `http://localhost:8080/v1` | Auto-hospedado, multi-modelo |
| [Jan](https://jan.ai) | `http://localhost:1337/v1` | Aplicativo de desktop com modelos locais |

Configure qualquer um desses com `work4you model` → Custom endpoint, ou em `config.yaml`:

```yaml
model:
  default: meta-llama/Llama-3.1-70B-Instruct-Turbo
  provider: custom
  base_url: https://api.together.xyz/v1
  api_key: your-together-key
```

---

### Detecção de Comprimento de Contexto

:::note Duas configurações, fáceis de confundir
**`context_length`** é a **janela de contexto total** — o orçamento combinado para tokens de entrada *e* de saída (ex.: 200.000 para o Claude Opus 4.6). O Work4You usa isso para decidir quando comprimir o histórico e para validar requisições de API.

**`model.max_tokens`** é o **limite de saída** — o número máximo de tokens que o modelo pode gerar em uma *única* resposta. Não tem relação com o quanto o histórico da sua conversa pode durar. O nome padrão da indústria `max_tokens` é uma fonte comum de confusão; a API nativa da Anthropic desde então o renomeou para `max_output_tokens`, para maior clareza.

Defina `context_length` quando a detecção automática errar o tamanho da janela.
Defina `model.max_tokens` apenas quando você precisar limitar a duração das respostas individuais.
:::

O Work4You usa uma cadeia de resolução com múltiplas fontes para detectar a janela de contexto correta para seu modelo e provedor:

1. **Substituição na configuração** — `model.context_length` em config.yaml (prioridade mais alta)
2. **Provedor personalizado por modelo** — `providers.<name>.models.<id>.context_length`
3. **Cache persistente** — valores descobertos anteriormente (sobrevive a reinicializações)
4. **Endpoint `/models`** — consulta a API do seu servidor (endpoints locais/personalizados)
5. **Anthropic `/v1/models`** — consulta a API da Anthropic para `max_input_tokens` (apenas usuários de chave de API)
6. **API do OpenRouter** — metadados de modelo ao vivo do OpenRouter
7. **Work4You Portal** — faz correspondência por sufixo dos IDs de modelo do Work4You com os metadados do OpenRouter
8. **[models.dev](https://models.dev)** — registro mantido pela comunidade, com comprimentos de contexto específicos por provedor para mais de 3.800 modelos em mais de 100 provedores
9. **Padrões de fallback** — padrões amplos por família de modelo (128K por padrão)

Para a maioria das configurações, isso funciona pronto para uso. O sistema é ciente do provedor — o mesmo modelo pode ter limites de contexto diferentes dependendo de quem o serve (ex.: `claude-opus-4.6` tem 1M diretamente na Anthropic, mas 128K no GitHub Copilot).

Para definir o comprimento de contexto explicitamente, adicione `context_length` à configuração do seu modelo:

```yaml
model:
  default: "qwen3.5:9b"
  base_url: "http://localhost:8080/v1"
  context_length: 131072  # tokens
```

Para endpoints personalizados, você também pode definir o comprimento de contexto por modelo:

```yaml
providers:
  my-local-llm:
    api: "http://localhost:11434/v1"
    models:
      qwen3.5:27b:
        context_length: 64000
      deepseek-r1:70b:
        context_length: 65536
```

`work4you model` vai perguntar pelo comprimento de contexto ao configurar um endpoint personalizado. Deixe em branco para detecção automática.

:::tip Quando definir isso manualmente
- Você está usando o Ollama com um `num_ctx` personalizado, menor que o máximo do modelo
- Você quer limitar o contexto abaixo do máximo do modelo (ex.: 8k em um modelo de 128k para economizar VRAM)
- Você está rodando atrás de um proxy que não expõe `/v1/models`
:::

---

### Provedores Personalizados Nomeados

Se você trabalha com múltiplos endpoints personalizados (ex.: um servidor de desenvolvimento local e um servidor de GPU remoto), você pode defini-los como provedores personalizados nomeados sob o dicionário `providers:` em `config.yaml`, indexados pelo nome do provedor:

```yaml
providers:
  local:
    api: http://localhost:8080/v1
    # api_key omitido — o Work4You usa "no-key-required" para servidores locais sem chave
  work:
    api: https://gpu-server.internal.corp/v1
    key_env: CORP_API_KEY
    transport: chat_completions   # definido explicitamente pelo assistente `work4you model` → Custom Endpoint; a detecção automática ainda ocorre como fallback
  anthropic-proxy:
    api: https://proxy.example.com/anthropic
    key_env: ANTHROPIC_PROXY_KEY
    transport: anthropic_messages  # para proxies compatíveis com a Anthropic
```

Cada entrada aceita: `api` (a URL base do endpoint — `base_url`/`url` são apelidos aceitos), `name` (nome de exibição opcional; padrão é a chave do dicionário), `key_env` ou `api_key` inline ou `key_cmd` (veja abaixo), `transport` (`chat_completions` / `anthropic_messages` / `codex_responses`), `default_model`, `models`, `context_length`, `discover_models`, `extra_body`, `extra_headers`, `ssl_ca_cert` / `ssl_verify`, e `enabled: false` para ocultar uma entrada sem excluí-la.

#### Credenciais geradas por comando (`key_cmd`)

Gateways corporativos frequentemente emitem tokens bearer de curta duração (brokers SSO/OIDC, IAM em nuvem, proxies de autenticação internos) em vez de chaves de API estáticas, então um token copiado para o `.env` fica obsoleto no meio da sessão e as requisições começam a retornar 401. `key_cmd` nomeia um comando que *imprime* um token; o Work4You o executa e armazena o resultado em cache até pouco antes da expiração, para que sessões longas continuem funcionando sem reinicialização:

```yaml
providers:
  my-gateway:
    base_url: "https://gateway.internal.example.com/v1"
    api_mode: chat_completions
    key_cmd: "my-auth-cli print-token --profile prod"
```

Funciona com qualquer auxiliar que imprima um token — `databricks auth token`, `gcloud auth print-access-token`, `az account get-access-token`, `vault read`, ou scripts no estilo `apiKeyHelper` do Claude Code.

O comando deve imprimir **apenas** o token na saída padrão: seja puro, ou como JSON com um campo `access_token` (`expires_in` é respeitado; timestamps ISO absolutos `expiry`/`expiresOn` também). Saída de múltiplas linhas é rejeitada, em vez de interpretada por tentativa. Se nenhuma expiração for informada, o token é regerado dentro de uma janela limitada.

Precedência: uma flag explícita `--api-key` ainda prevalece; caso contrário, `key_cmd` tem prioridade sobre um `api_key`/`key_env` estático na mesma entrada. A credencial gerada se aplica tanto ao turno principal do agente quanto a tarefas auxiliares (geração de título, compressão, visão, embedding).

Não confunda com `secrets.command`, que executa um auxiliar **uma vez na inicialização** para preencher variáveis de ambiente em todo o processo. Use isso para um auxiliar de cofre/chaveiro que devolve muitos segredos; use `key_cmd` quando a credencial de um provedor precisa ser regerada *durante* uma sessão.

:::note Formato legado
Configurações mais antigas usavam uma lista de nível superior `custom_providers:` em vez disso. Ela ainda funciona — o Work4You lê ambas — e `work4you update` migra automaticamente para o dicionário `providers:` (config v12). Os nomes dos campos diferem ligeiramente no formato de dicionário: o `model` legado é `default_model`, e o `api_mode` legado é `transport`.
:::

Alguns endpoints compatíveis com OpenAI precisam de campos de corpo de requisição específicos do provedor. Adicione um mapa `extra_body` ao provedor personalizado correspondente, e o Work4You vai mesclá-lo em cada requisição de chat-completions para esse endpoint:

```yaml
providers:
  gemma-local:
    api: http://localhost:8080/v1
    default_model: google/gemma-4-31b-it
    extra_body:
      enable_thinking: true
      reasoning_effort: high
```

Use o formato que seu servidor documenta. Por exemplo, implantações do Gemma no vLLM e alguns endpoints da NVIDIA NIM esperam `enable_thinking` sob `chat_template_kwargs`, em vez de como um campo de nível superior em `extra_body`:

```yaml
extra_body:
  chat_template_kwargs:
    enable_thinking: true
```

Para modelos de raciocínio Qwen servidos pelo vLLM, esse mesmo formato pode ser usado para desativar o pensamento quando um parser de raciocínio separa todo o texto gerado em campos de raciocínio e deixa o `content` do assistente vazio:

```yaml
extra_body:
  chat_template_kwargs:
    enable_thinking: false
```

O assistente `work4you model` → Custom Endpoint agora pergunta explicitamente pelo modo de API e persiste sua resposta em `config.yaml` (como `transport` na entrada do provedor). A detecção automática baseada em URL (ex.: caminhos `/anthropic` → `anthropic_messages`) ainda ocorre como fallback quando o campo é deixado em branco.

**Visão nativa para modelos de provedor personalizado.** Se seu endpoint personalizado serve um modelo com capacidade de visão que não está no models.dev, defina `model.supports_vision: true` para que o Work4You roteie imagens anexadas de forma nativa (como partes `image_url`), em vez de pré-processá-las através do `vision_analyze`. Um único interruptor — sem necessidade de também definir `agent.image_input_mode: native`.

```yaml
model:
  provider: custom
  base_url: http://localhost:8080/v1
  default: qwen3.6-35b-a3b
  supports_vision: true   # envia imagens nativamente; caso contrário, o vision_analyze as pré-descreve
```

A mesma chave é respeitada em modelos de provedor nomeado (`providers.<name>.models.<id>.supports_vision`) e aceita booleanos YAML padrão (`true/false/yes/no/on/off/1/0`).

Alterne entre eles no meio da sessão com a sintaxe tripla:

```
/model custom:local:qwen-2.5       # Usa o endpoint "local" com qwen-2.5
/model custom:work:llama3-70b      # Usa o endpoint "work" com llama3-70b
/model custom:anthropic-proxy:claude-sonnet-4  # Usa o proxy
```

Você também pode selecionar provedores personalizados nomeados no menu interativo `work4you model`.

---

### Receituário: Together AI, Groq, Perplexity

Os provedores em nuvem listados em [Outros Provedores Compatíveis](#other-compatible-providers) falam todos o dialeto REST da OpenAI, então se conectam da mesma forma sob o dicionário `providers:`. Seguem três receitas prontas. Cada uma vai em `~/.work4you/config.yaml`, e a chave de API correspondente vai em `~/.work4you/.env`.

#### Together AI

Hospeda modelos de peso aberto (Llama, MiniMax, Gemma, DeepSeek, Qwen) a preços significativamente abaixo das APIs de primeira parte. Boa opção padrão para frotas multi-modelo.

```yaml
# ~/.work4you/config.yaml
providers:
  together:
    api: https://api.together.xyz/v1
    key_env: TOGETHER_API_KEY
    # transport: chat_completions  # padrão — não precisa definir

model:
  default: MiniMaxAI/MiniMax-M2.7   # ou qualquer modelo de together.ai/models
  provider: custom:together
```

```bash
# ~/.work4you/.env
TOGETHER_API_KEY=your-together-key
```

Troque de modelo no meio da sessão:

```
/model custom:together:meta-llama/Llama-3.3-70B-Instruct-Turbo
/model custom:together:google/gemma-4-31b-it
/model custom:together:deepseek-ai/DeepSeek-V3
```

O endpoint `/v1/models` da Together funciona, então `work4you model` consegue descobrir automaticamente os modelos disponíveis.

#### Groq

Inferência ultra-rápida (~500 tok/s no Llama-3.3-70B). Catálogo pequeno, mas forte para uso interativo sensível à latência.

```yaml
# ~/.work4you/config.yaml
providers:
  groq:
    api: https://api.groq.com/openai/v1
    key_env: GROQ_API_KEY

model:
  default: llama-3.3-70b-versatile
  provider: custom:groq
```

```bash
# ~/.work4you/.env
GROQ_API_KEY=your-groq-key
```

#### Perplexity

Útil quando você quer um modelo que faça busca na web ao vivo e citação automaticamente. Rigorosa quanto aos modelos disponíveis — verifique [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) para a lista atual.

```yaml
# ~/.work4you/config.yaml
providers:
  perplexity:
    api: https://api.perplexity.ai
    key_env: PERPLEXITY_API_KEY

model:
  default: sonar
  provider: custom:perplexity
```

```bash
# ~/.work4you/.env
PERPLEXITY_API_KEY=your-perplexity-key
```

#### Múltiplos provedores em uma única configuração

As três receitas se combinam — use todas juntas e troque por turno com `/model custom:<name>:<model>`:

```yaml
providers:
  together:
    api: https://api.together.xyz/v1
    key_env: TOGETHER_API_KEY
  groq:
    api: https://api.groq.com/openai/v1
    key_env: GROQ_API_KEY
  perplexity:
    api: https://api.perplexity.ai
    key_env: PERPLEXITY_API_KEY

model:
  default: MiniMaxAI/MiniMax-M2.7
  provider: custom:together      # inicializa com a Together; troque livremente depois
```

:::tip Solução de problemas
- `work4you doctor` não deve imprimir avisos de `Unknown provider` para nenhum desses nomes, após as correções do validador da CLI em #15083.
- Se o endpoint `/v1/models` de um provedor estiver inacessível (a Perplexity é o caso comum), `work4you model` vai persistir o modelo com um aviso, em vez de rejeitar de forma rígida — veja #15136.
- Para pular provedores nomeados por completo e usar o `provider: custom` simples com a variável de ambiente `CUSTOM_BASE_URL`, veja #15103.
:::

---

### Escolhendo a Configuração Certa

| Caso de Uso | Recomendado |
|----------|-------------|
| **Só quer que funcione** | OpenRouter (padrão) ou Work4You Portal |
| **Modelos locais, configuração fácil** | Ollama |
| **Serviço de produção em GPU** | vLLM ou SGLang |
| **Mac / sem GPU** | Ollama ou llama.cpp |
| **Roteamento multi-provedor** | LiteLLM Proxy ou OpenRouter |
| **Otimização de custo** | ClawRouter ou OpenRouter com `sort: "price"` |
| **Máxima privacidade** | Ollama, vLLM, ou llama.cpp (totalmente local) |
| **Empresarial / Azure** | Azure OpenAI com endpoint personalizado |
| **Modelos de IA chineses** | z.ai (GLM), Kimi/Moonshot (`kimi-coding` ou `kimi-coding-cn`), MiniMax, Xiaomi MiMo, ou Tencent TokenHub (provedores de primeira classe) |

:::tip
Você pode trocar de provedor a qualquer momento com `work4you model` — sem necessidade de reinicialização. Seu histórico de conversa, memória e skills são mantidos independentemente do provedor usado.
:::

## Chaves de API Opcionais

| Recurso | Provedor | Variável de Ambiente |
|---------|----------|--------------|
| Extração de dados da web | [Firecrawl](https://firecrawl.dev/) | `FIRECRAWL_API_KEY`, `FIRECRAWL_API_URL` |
| Automação de navegador | [Browserbase](https://browserbase.com/) | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` |
| Geração de imagens | [FAL](https://fal.ai/) | `FAL_KEY` |
| Vozes de TTS premium | [ElevenLabs](https://elevenlabs.io/) | `ELEVENLABS_API_KEY` |
| TTS da OpenAI + transcrição de voz | [OpenAI](https://platform.openai.com/api-keys) | `VOICE_TOOLS_OPENAI_KEY` |
| TTS da Mistral + transcrição de voz | [Mistral](https://console.mistral.ai/) | `MISTRAL_API_KEY` |
| Modelagem de usuário entre sessões | [Honcho](https://honcho.dev/) | `HONCHO_API_KEY` |
| Memória semântica de longo prazo | [Supermemory](https://supermemory.ai) | `SUPERMEMORY_API_KEY` |

### Auto-Hospedando o Firecrawl

Por padrão, o Work4You usa a [API em nuvem do Firecrawl](https://firecrawl.dev/) para busca e extração de dados da web. Se você preferir rodar o Firecrawl localmente, pode apontar o Work4You para uma instância auto-hospedada em vez disso. Veja o [SELF_HOST.md](https://github.com/firecrawl/firecrawl/blob/main/SELF_HOST.md) do Firecrawl para instruções completas de configuração.

**O que você ganha:** nenhuma chave de API necessária, sem limites de taxa, sem custos por página, soberania total dos dados.

**O que você perde:** a versão em nuvem usa o "Fire-engine" proprietário do Firecrawl para desvio avançado de anti-bot (Cloudflare, CAPTCHAs, rotação de IP). A versão auto-hospedada usa fetch básico + Playwright, então alguns sites protegidos podem falhar. A busca usa o DuckDuckGo em vez do Google.

**Configuração:**

1. Clone e inicie o stack Docker do Firecrawl (5 containers: API, Playwright, Redis, RabbitMQ, PostgreSQL — requer de ~4 a 8 GB de RAM):
   ```bash
   git clone https://github.com/firecrawl/firecrawl
   cd firecrawl
   # No .env, defina: USE_DB_AUTHENTICATION=false, HOST=0.0.0.0, PORT=3002
   docker compose up -d
   ```

2. Aponte o Work4You para sua instância (nenhuma chave de API necessária):
   ```bash
   work4you config set FIRECRAWL_API_URL http://localhost:3002
   ```

Você também pode definir tanto `FIRECRAWL_API_KEY` quanto `FIRECRAWL_API_URL` se sua instância auto-hospedada tiver autenticação ativada.

## Roteamento de Provedores do OpenRouter

Ao usar o OpenRouter, você pode controlar como as requisições são roteadas entre provedores. Adicione uma seção `provider_routing` a `~/.work4you/config.yaml`:

```yaml
provider_routing:
  sort: "throughput"          # "price" (padrão), "throughput", ou "latency"
  # only: ["anthropic"]      # Usar apenas estes provedores
  # ignore: ["deepinfra"]    # Ignorar estes provedores
  # order: ["anthropic", "google"]  # Tentar provedores nesta ordem
  # require_parameters: true  # Usar apenas provedores que suportam todos os parâmetros da requisição
  # data_collection: "deny"   # Excluir provedores que possam armazenar/treinar com os dados
```

**Atalhos:** anexe `:nitro` a qualquer nome de modelo para ordenação por throughput (ex.: `anthropic/claude-sonnet-4:nitro`), ou `:floor` para ordenação por preço.

## OpenRouter Pareto Code Router

O OpenRouter oferece um roteador experimental para modelos de código em `openrouter/pareto-code`, que roteia automaticamente as requisições para o modelo mais barato que atenda a um patamar de qualidade de codificação (classificado pela [Artificial Analysis](https://artificialanalysis.ai/)). Escolha esse modelo e ajuste o parâmetro `min_coding_score` em `~/.work4you/config.yaml`:

```yaml
model:
  provider: openrouter
  model: openrouter/pareto-code

openrouter:
  min_coding_score: 0.65   # 0.0–1.0; quanto mais alto, mais forte (e mais caro) o codificador. Padrão 0.65.
```

Observações:

- `min_coding_score` é **apenas** enviado quando `model.model` é `openrouter/pareto-code`. Em qualquer outro modelo, o valor não tem efeito.
- Defina como string vazia (ou remova a linha) para deixar o OpenRouter escolher o codificador mais forte disponível — seu comportamento documentado quando o bloco de plugins é omitido.
- A seleção é determinística por pontuação em um dado dia, mas o modelo realmente escolhido pode mudar conforme a fronteira de Pareto se move (novos modelos, atualizações de benchmark).
- Veja a [documentação do Pareto Router](https://openrouter.ai/docs/guides/routing/routers/pareto-router) do OpenRouter para o comportamento completo do roteador.
- Para usar o Pareto Code router em uma **tarefa auxiliar** específica (compressão, visão, etc.) em vez do agente principal, defina `extra_body.plugins` sob essa tarefa — veja [Modelos Auxiliares → Roteamento do OpenRouter e Pareto Code para tarefas auxiliares](/user-guide/configuration#openrouter-routing--pareto-code-for-auxiliary-tasks).

## Provedores de Fallback

Configure uma cadeia de provedores de backup que o Work4You tenta em ordem quando o modelo principal falha (limites de taxa, erros de servidor, falhas de autenticação). O formato canônico é uma lista de nível superior `fallback_providers:`:

```yaml
fallback_providers:
  - provider: openrouter
    model: anthropic/claude-sonnet-4
  - provider: anthropic
    model: claude-sonnet-4
    # base_url: http://localhost:8000/v1    # opcional, para endpoints personalizados
    # api_mode: chat_completions           # substituição opcional
```

O dicionário legado de par único `fallback_model:` ainda é aceito, por compatibilidade retroativa:

```yaml
fallback_model:
  provider: openrouter
  model: anthropic/claude-sonnet-4
```

Quando ativado, o fallback troca o modelo e o provedor no meio da sessão sem perder sua conversa. A cadeia é tentada entrada por entrada; a ativação ocorre uma única vez por sessão.

Provedores suportados: `openrouter`, `work4you`, `novita`, `openai-codex`, `copilot`, `copilot-acp`, `anthropic`, `gemini`, `qwen-oauth`, `huggingface`, `zai`, `kimi-coding`, `kimi-coding-cn`, `minimax`, `minimax-cn`, `minimax-oauth`, `deepseek`, `nvidia`, `xai`, `xai-oauth`, `ollama-cloud`, `bedrock`, `ai-gateway`, `azure-foundry`, `opencode-zen`, `opencode-go`, `commandcode`, `commandcode-anthropic`, `kilocode`, `xiaomi`, `arcee`, `gmi`, `actual`, `stepfun`, `lmstudio`, `alibaba`, `alibaba-coding-plan`, `tencent-tokenhub`, `custom`.

:::tip
O fallback é configurado exclusivamente através de `config.yaml` — ou interativamente via `work4you fallback`. Para detalhes completos sobre quando ele é acionado, como a cadeia avança, e como interage com tarefas auxiliares e delegação, veja [Provedores de Fallback](/user-guide/features/fallback-providers).
:::

---

## Veja Também

- [Configuração](/user-guide/configuration) — Configuração geral (estrutura de diretórios, precedência de configuração, backends de terminal, memória, compressão, e mais)
- [Variáveis de Ambiente](/reference/environment-variables) — Referência completa de todas as variáveis de ambiente
