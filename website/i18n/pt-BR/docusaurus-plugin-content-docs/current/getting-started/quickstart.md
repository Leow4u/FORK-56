---
sidebar_position: 1
title: "Quickstart"
description: "Sua primeira conversa com o Work4You — da instalação ao chat em menos de 5 minutos"
---

# Quickstart

Este guia leva você do zero a uma configuração funcional do Work4You que sobrevive ao uso real. Instale, escolha um provedor, verifique um chat funcionando, e saiba exatamente o que fazer quando algo der errado.

## Para quem é este guia

- Você é totalmente novo e quer o caminho mais curto para uma configuração funcional
- Está trocando de provedor e não quer perder tempo com erros de configuração
- Está configurando o Work4You para uma equipe, um bot ou um fluxo de trabalho sempre ativo
- Está cansado de "instalou, mas não faz nada"

## O caminho mais rápido

Escolha a linha que combina com o seu objetivo:

| Objetivo | Faça isso primeiro | Depois faça isso |
|---|---|---|
| Só quero o Work4You funcionando na minha máquina | `work4you setup` | Rode um chat de verdade e verifique se ele responde |
| Já sei qual é o meu provedor | `work4you model` | Salve a configuração e comece a conversar |
| Quero um bot ou uma configuração sempre ativa | `work4you gateway setup` depois que a CLI funcionar | Conecte Telegram, Discord, Slack ou outra plataforma |
| Quero um modelo local ou auto-hospedado | `work4you model` → endpoint personalizado | Verifique o endpoint, o nome do modelo e o tamanho do contexto |
| Quero fallback multi-provedor | `work4you model` primeiro | Adicione roteamento e fallback só depois que o chat básico funcionar |

**Regra geral:** se o Work4You não conseguir completar um chat normal, não adicione mais recursos ainda. Faça uma conversa limpa funcionar primeiro, depois adicione gateway, cron, skills, voz ou roteamento.

---

## 1. Instale o Work4You
### Com o instalador do Work4You Desktop no macOS ou Windows (recomendado)
Para instalar facilmente as aplicações de linha de comando e desktop, [baixe o instalador do Work4You Desktop](https://work4you.ai/) do nosso site e execute-o.

### Sem o Work4You Desktop:
Para uma instalação somente de linha de comando, sem o Work4You Desktop, execute:

#### Linux / macOS / WSL2 / Android (Termux)
```bash
curl -fsSL https://work4you.ai/install.sh | bash
```

#### Windows (nativo)

Execute no powershell:
```powershell
iex (irm https://work4you.ai/install.ps1) 
```

:::tip Android / Termux
Se você está instalando em um celular, veja o guia dedicado do [Termux](./termux.md) para o caminho manual testado, os extras suportados e as limitações atuais específicas do Android.
:::

Depois que terminar, recarregue seu shell:

```bash
source ~/.bashrc   # ou source ~/.zshrc
```

Para opções detalhadas de instalação, pré-requisitos e solução de problemas, veja o guia de [Instalação](./installation.md).

## 2. Escolha um Provedor

O passo de configuração mais importante. Use `work4you model` para percorrer a escolha interativamente:

```bash
work4you model
```

:::tip Caminho mais fácil: Work4You Portal
Uma única assinatura cobre mais de 300 modelos, além do [Tool Gateway](../user-guide/features/tool-gateway.md) (busca na web, geração de imagem, TTS, navegador na nuvem). Em uma instalação nova:

```bash
work4you setup --portal
```

Isso faz seu login, define o Work4You como seu provedor e ativa o Tool Gateway em um único comando.
:::

:::info Modos de configuração
Em uma instalação nova, o `work4you setup` oferece três modos:

- **Configuração Rápida (Work4You Portal)** — login OAuth gratuito, sem chaves de API; configura um modelo mais as ferramentas do Tool Gateway. O caminho rápido recomendado.
- **Configuração Completa** — percorra você mesmo todos os provedores, ferramentas e opções (traga suas próprias chaves).
- **Zerado (Blank Slate)** — tudo começa **desligado**, exceto o mínimo necessário para rodar um agente: **provedor e modelo, o conjunto de ferramentas de Operações de Arquivo, e o conjunto de ferramentas de Terminal**. Sem web, navegador, execução de código, visão, memória, delegação, cron, skills, plugins ou servidores MCP — e compressão, checkpoints, roteamento inteligente e captura de memória ficam todos desativados. Depois que a base mínima é aplicada, você escolhe um de dois caminhos: **começar com tudo desativado** (finalizar agora com o agente mínimo), ou **percorrer todas as configurações** (habilitar ferramentas, skills, plugins, MCP e mensagens). Escolha isso quando quiser um agente mínimo e totalmente controlado, e pretenda habilitar apenas exatamente o que precisa.

O Blank Slate grava uma lista explícita `platform_toolsets.cli` mais `agent.disabled_toolsets`, então nada que você não escolheu é carregado — nem mesmo depois de um `work4you update`. Reative qualquer coisa depois com `work4you tools`, semeie skills com `work4you skills opt-in --sync`, ou ajuste configurações com `work4you setup agent`.
:::

Boas opções padrão:

| Provedor | O que é | Como configurar |
|----------|-----------|---------------|
| **Work4You Portal** | Baseado em assinatura, sem configuração | Login OAuth via `work4you model` |
| **OpenAI Codex** | Assinatura ChatGPT ou Codex, usa modelos Codex | Autenticação via código de dispositivo pelo `work4you model` → **ChatGPT or Codex Subscription** |
| **Anthropic** | Modelos Claude diretamente — plano Max + créditos de uso extra (OAuth), ou chave de API para pagamento por token | `work4you model` → login OAuth (requer Max + créditos extras), ou uma chave de API da Anthropic |
| **OpenRouter** | Roteamento multi-provedor entre muitos modelos | Digite sua chave de API |
| **Fireworks AI** | API de modelo direta compatível com OpenAI | Defina `FIREWORKS_API_KEY` |
| **Z.AI** | Modelos hospedados por GLM / Zhipu | Defina `GLM_API_KEY` / `ZAI_API_KEY` (também aceita `Z_AI_API_KEY`) |
| **Kimi / Moonshot** | Modelos de codificação e chat hospedados pela Moonshot | Defina `KIMI_API_KEY` (ou o específico do Kimi-Coding, `KIMI_CODING_API_KEY`) |
| **Kimi / Moonshot China** | Endpoint Moonshot da região da China | Defina `KIMI_CN_API_KEY` |
| **Arcee AI** | Modelos Trinity | Defina `ARCEEAI_API_KEY` |
| **GMI Cloud** | API direta multi-modelo | Defina `GMI_API_KEY` |
| **Actual Computer** | Seu próprio hardware como um cluster de inferência privado — relay hospedado ou daemon local | Defina `ACTUAL_API_KEY` (relay) ou `ACTUAL_BASE_URL=http://127.0.0.1:8080` (local, sem chave) |
| **MiniMax (OAuth)** | Modelo de ponta da MiniMax via OAuth pelo navegador — sem necessidade de chave de API (o nome do modelo em `work4you_cli/models.py` pode mudar entre releases) | `work4you model` → MiniMax (OAuth) |
| **MiniMax** | Endpoint internacional da MiniMax | Defina `MINIMAX_API_KEY` |
| **MiniMax China** | Endpoint da MiniMax na região da China | Defina `MINIMAX_CN_API_KEY` |
| **Alibaba Cloud** | Modelos Qwen via DashScope | Defina `DASHSCOPE_API_KEY` (o Qwen Coding Plan também aceita `ALIBABA_CODING_PLAN_API_KEY`) |
| **Hugging Face** | Mais de 20 modelos abertos via roteador unificado (Qwen, DeepSeek, Kimi, etc.) | Defina `HF_TOKEN` |
| **AWS Bedrock** | Claude, Nova, Llama, DeepSeek via API Converse nativa | Perfil IAM ou `aws configure` ([guia](../guides/aws-bedrock.md)) |
| **Azure Foundry** | Modelos hospedados pelo Azure AI Foundry | Defina `AZURE_FOUNDRY_API_KEY` + `AZURE_FOUNDRY_BASE_URL` |
| **Google AI Studio** | Modelos Gemini via API direta | Defina `GOOGLE_API_KEY` / `GEMINI_API_KEY` |
| **xAI** | Modelos Grok via API direta | Defina `XAI_API_KEY` |
| **xAI Grok OAuth** | Assinatura SuperGrok / Premium+, sem necessidade de chave de API | `work4you model` → xAI Grok OAuth |
| **NovitaAI** | Gateway de API multi-modelo | Defina `NOVITA_API_KEY` |
| **StepFun** | Modelos Step Plan | Defina `STEPFUN_API_KEY` |
| **Xiaomi MiMo** | Modelos hospedados pela Xiaomi | Defina `XIAOMI_API_KEY` |
| **Tencent TokenHub** | Modelos hospedados pela Tencent | Defina `TOKENHUB_API_KEY` |
| **Ollama Cloud** | Modelos gerenciados hospedados pelo Ollama | Defina `OLLAMA_API_KEY` |
| **LM Studio** | Aplicativo desktop local que expõe uma API compatível com OpenAI | Defina `LM_API_KEY` (e `LM_BASE_URL` se não for o padrão) |
| **Qwen OAuth** | OAuth pelo navegador do Qwen Portal — sem necessidade de chave de API | `work4you model` → Qwen OAuth |
| **Kilo Code** | Modelos hospedados pela KiloCode | Defina `KILOCODE_API_KEY` |
| **OpenCode Zen** | Acesso pré-pago a modelos selecionados | Defina `OPENCODE_ZEN_API_KEY` |
| **OpenCode Go** | Assinatura de $10/mês para modelos abertos | Defina `OPENCODE_GO_API_KEY` |
| **DeepSeek** | Acesso direto à API do DeepSeek | Defina `DEEPSEEK_API_KEY` |
| **NVIDIA NIM** | Modelos Nemotron via build.nvidia.com ou NIM local | Defina `NVIDIA_API_KEY` (opcional: `NVIDIA_BASE_URL`) |
| **GitHub Copilot** | Assinatura do GitHub Copilot (GPT-5.x, Claude, Gemini, etc.) | OAuth via `work4you model`, ou `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` |
| **GitHub Copilot ACP** | Backend de agente Copilot ACP (inicia a CLI local do `copilot`) | `work4you model` (requer a CLI `copilot` + `copilot login`) |
| **Vercel AI Gateway** | Roteamento pelo Vercel AI Gateway | Defina `AI_GATEWAY_API_KEY` |
| **Custom Endpoint** | VLLM, SGLang, Ollama, ou qualquer API compatível com OpenAI | Defina URL base + chave de API |

Para a maioria dos usuários de primeira viagem: escolha um provedor, aceite os padrões a menos que saiba por que quer mudá-los. O catálogo completo de provedores com variáveis de ambiente e passos de configuração está na página [Provedores](../integrations/providers.md).

:::caution Contexto mínimo: 64K tokens
O Work4You exige um modelo com pelo menos **64.000 tokens** de contexto. Modelos com janelas menores não conseguem manter memória de trabalho suficiente para fluxos de trabalho multi-etapa com chamadas de ferramentas, e serão rejeitados na inicialização. A maioria dos modelos hospedados (Claude, GPT, Gemini, Qwen, DeepSeek) atende isso facilmente. Se você está rodando um modelo local, defina o tamanho de contexto para pelo menos 64K (por exemplo, `--ctx-size 65536` para o llama.cpp ou `-c 65536` para o Ollama).
:::

:::tip
Você pode trocar de provedor a qualquer momento com `work4you model` — sem amarras. Para uma lista completa de todos os provedores suportados e detalhes de configuração, veja [Provedores de IA](../integrations/providers.md).
:::

### Como as configurações são armazenadas

O Work4You separa segredos da configuração normal:

- **Segredos e tokens** → `~/.work4you/.env`
- **Configurações não sensíveis** → `~/.work4you/config.yaml`

A maneira mais fácil de definir valores corretamente é pela CLI:

```bash
work4you config set model anthropic/claude-opus-4.6
work4you config set terminal.backend docker
work4you config set OPENROUTER_API_KEY sk-or-...
```

O valor certo vai para o arquivo certo automaticamente.

## 3. Rode Seu Primeiro Chat

```bash
work4you            # CLI clássica
work4you --tui      # TUI moderna (recomendada)
```

Você verá um banner de boas-vindas com seu modelo, ferramentas disponíveis e skills. Use um prompt específico e fácil de verificar:

:::tip Escolha sua interface
O Work4You vem com duas interfaces de terminal: a CLI clássica `prompt_toolkit` e uma [TUI](../user-guide/tui.md) mais nova, com overlays modais, seleção com o mouse e entrada não bloqueante. Ambas compartilham as mesmas sessões, slash commands e configuração — experimente cada uma com `work4you` vs `work4you --tui`.
:::

```
Summarize this repo in 5 bullets and tell me what the main entrypoint is.
```

```
Check my current directory and tell me what looks like the main project file.
```

```
Help me set up a clean GitHub PR workflow for this codebase.
```

**Como é o sucesso:**

- O banner mostra o modelo/provedor escolhido
- O Work4You responde sem erro
- Ele consegue usar uma ferramenta quando necessário (terminal, leitura de arquivo, busca na web)
- A conversa continua normalmente por mais de um turno

Se isso funcionar, você já passou pela parte mais difícil.

## 4. Verifique se as Sessões Funcionam

Antes de seguir adiante, confirme que o retomar (resume) funciona:

```bash
work4you --continue    # Retoma a sessão mais recente
work4you -c            # Forma abreviada
```

Isso deve trazer você de volta à sessão que acabou de ter. Se não trouxer, verifique se você está no mesmo perfil e se a sessão realmente foi salva. Isso importa mais tarde, quando você estiver lidando com múltiplas configurações ou máquinas.

## 5. Experimente os Principais Recursos

### Use o terminal

```
❯ What's my disk usage? Show the top 5 largest directories.
```

O agente executa comandos de terminal em seu nome e mostra os resultados.

### Slash commands

Digite `/` para ver um menu suspenso de autocompletar com todos os comandos:

| Comando | O que faz |
|---------|-------------|
| `/help` | Mostra todos os comandos disponíveis |
| `/tools` | Lista as ferramentas disponíveis |
| `/model` | Troca de modelo interativamente |
| `/personality pirate` | Experimente uma personalidade divertida |
| `/save` | Salva a conversa |

### Entrada de múltiplas linhas

Pressione `Alt+Enter`, `Ctrl+J` ou `Shift+Enter` para adicionar uma nova linha. `Shift+Enter` requer um terminal que envie isso como uma sequência distinta (Kitty / foot / WezTerm / Ghostty por padrão; iTerm2 / Alacritty / terminal do VS Code depois de habilitado o protocolo de teclado Kitty). `Alt+Enter` e `Ctrl+J` funcionam em qualquer terminal.

### Interrompa o agente

Se o agente estiver demorando demais, digite uma nova mensagem e pressione Enter — isso interrompe a tarefa atual e passa para suas novas instruções. `Ctrl+C` também funciona.

## 6. Adicione a Próxima Camada

Só depois que o chat básico funcionar. Escolha o que você precisa:

### Bot ou assistente compartilhado

```bash
work4you gateway setup    # Configuração interativa de plataforma
```

Conecte [Telegram](/user-guide/messaging/telegram), [Discord](/user-guide/messaging/discord), [Slack](/user-guide/messaging/slack), [WhatsApp](/user-guide/messaging/whatsapp), [Signal](/user-guide/messaging/signal), [Email](/user-guide/messaging/email), ou [Home Assistant](/user-guide/messaging/homeassistant), ou [Microsoft Teams](/user-guide/messaging/teams).

### Automação e ferramentas

- `work4you tools` — ajuste o acesso a ferramentas por plataforma
- `work4you skills` — navegue e instale fluxos de trabalho reutilizáveis
- Cron — só depois que seu bot ou configuração de CLI estiver estável

### Terminal em sandbox

Por segurança, rode o agente em um contêiner Docker ou em um servidor remoto:

```bash
work4you config set terminal.backend docker    # Isolamento com Docker
work4you config set terminal.backend ssh       # Servidor remoto
```

Para sandboxes com Docker, você também pode habilitar o **proxy de injeção de credenciais de saída (egress)** para que o sandbox nunca veja suas chaves de API reais — apenas tokens de proxy opacos que funcionam exclusivamente por trás de um daemon local de interceptação de TLS. Veja [Proxy de Egress](../user-guide/egress/iron-proxy.md). A configuração é `work4you egress setup && work4you egress start`; o `work4you setup terminal` também direciona usuários de Docker para lá. Modal, SSH, Daytona e Singularity ainda não estão integrados.

### Modo de voz

```bash
# A partir do diretório de instalação do Work4You (o instalador via curl o colocou em
# ~/.work4you/work4you no Linux/macOS ou %LOCALAPPDATA%\work4you\work4you no Windows):
cd ~/.work4you/work4you
uv pip install --python ./venv/bin/python -e ".[voice]"
# Inclui o faster-whisper para transcrição de voz local e gratuita
```

Depois, na CLI: `/voice on`. Pressione `Ctrl+B` para gravar. Veja [Modo de Voz](../user-guide/features/voice-mode.md).

### Skills

Skills são documentos de instrução sob demanda que ensinam o Work4You a fazer uma tarefa específica — implantar no Kubernetes, abrir um PR no GitHub, ajustar um modelo, buscar GIFs. Cada uma é um arquivo `SKILL.md` com um nome, uma descrição e um procedimento passo a passo. O agente lê as descrições curtas sem custo e só carrega o conteúdo completo de uma skill quando uma tarefa realmente exige isso, então adicionar skills não sobrecarrega cada requisição.

O Work4You vem com um catálogo de skills empacotadas já instaladas em `~/.work4you/skills/`. Você pode adicionar mais a partir do Skills Hub, ou escrever as suas próprias.

**Navegue e instale a partir do hub:**

```bash
work4you skills browse                      # lista tudo que está disponível
work4you skills search kubernetes           # encontra skills por palavra-chave
work4you skills install openai/skills/k8s   # instala uma (roda uma varredura de segurança antes)
```

O argumento de instalação é um slug `origem/caminho` do hub — `openai/skills/k8s` significa a skill `k8s` do catálogo da OpenAI. O `work4you skills browse` mostra os slugs exatos a usar.

**Use uma skill** — toda skill instalada vira um slash command automaticamente:

```bash
/k8s deploy the staging manifest          # roda a skill com uma solicitação
/k8s                                       # carrega e deixa o Work4You perguntar o que você precisa
```

Isso funciona na CLI e em qualquer plataforma de mensagens conectada. Você não precisa instalar tudo de antemão — o agente escolhe sozinho a skill empacotada certa durante a conversa normal, quando uma tarefa combina com uma delas.

Veja [Sistema de Skills](../user-guide/features/skills.md) para escrever as suas próprias, diretórios de skills externos e a lista completa de fontes do hub.

### Servidores MCP

```yaml
# Adicione a ~/.work4you/config.yaml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_xxx"
```

### Integração com editor (ACP)

O suporte a ACP vem com os extras padrão `[all]`, então o instalador via curl já o inclui. Basta rodar:

```bash
work4you acp
```

(Se você instalou sem `[all]`, rode `cd ~/.work4you/work4you && uv pip install -e ".[acp]"` primeiro.)

Veja [Integração com Editor via ACP](../user-guide/features/acp.md).

---

## Modos de Falha Comuns

Estes são os problemas que mais desperdiçam tempo:

| Sintoma | Causa provável | Correção |
|---|---|---|
| O Work4You abre mas dá respostas vazias ou quebradas | Autenticação do provedor ou seleção de modelo está errada | Rode `work4you model` novamente e confirme o provedor, o modelo e a autenticação |
| O endpoint personalizado "funciona" mas retorna lixo | URL base errada, nome de modelo errado, ou não é de fato compatível com OpenAI | Verifique o endpoint em um cliente separado primeiro |
| O gateway inicia mas ninguém consegue mandar mensagem | Token do bot, allowlist ou configuração da plataforma está incompleta | Rode `work4you gateway setup` novamente e verifique `work4you gateway status` |
| `work4you --continue` não encontra a sessão antiga | Trocou de perfil ou a sessão nunca foi salva | Verifique `work4you sessions list` e confirme se você está no perfil certo |
| Modelo indisponível ou comportamento estranho de fallback | Roteamento de provedor ou configurações de fallback estão agressivas demais | Deixe o roteamento desligado até que o provedor base esteja estável |
| `work4you doctor` reporta problemas de configuração | Valores de configuração estão faltando ou desatualizados | Corrija a configuração, teste de novo um chat simples antes de adicionar recursos |

## Kit de Recuperação

Quando algo parecer estranho, use esta ordem:

1. `work4you doctor`
2. `work4you model`
3. `work4you setup`
4. `work4you sessions list`
5. `work4you --continue`
6. `work4you gateway status`

Essa sequência tira você de "vibrações quebradas" e traz de volta a um estado conhecido rapidamente.

---

## Referência Rápida

| Comando | Descrição |
|---------|-------------|
| `work4you` | Comece a conversar |
| `work4you model` | Escolha seu provedor de LLM e modelo |
| `work4you tools` | Configure quais ferramentas estão habilitadas por plataforma |
| `work4you setup` | Assistente completo de configuração (configura tudo de uma vez) |
| `work4you doctor` | Diagnostica problemas |
| `work4you update` | Atualiza para a versão mais recente |
| `work4you gateway` | Inicia o gateway de mensagens |
| `work4you --continue` | Retoma a última sessão |

## Próximos Passos

- **[Guia da CLI](../user-guide/cli.md)** — Domine a interface de terminal
- **[Configuração](../user-guide/configuration.md)** — Personalize sua instalação
- **[Gateway de Mensagens](../user-guide/messaging/index.md)** — Conecte Telegram, Discord, Slack, WhatsApp, Signal, Email, Home Assistant, Teams, e mais
- **[Ferramentas e Toolsets](../user-guide/features/tools.md)** — Explore as capacidades disponíveis
- **[Provedores de IA](../integrations/providers.md)** — Lista completa de provedores e detalhes de configuração
- **[Sistema de Skills](../user-guide/features/skills.md)** — Fluxos de trabalho e conhecimento reutilizáveis
- **[Dicas e Boas Práticas](../guides/tips.md)** — Dicas para usuários avançados
- **[Movendo para outra máquina](/reference/faq#exporting-work4you-to-another-machine)** — `work4you backup` migra toda a sua configuração (ou [um único perfil](/reference/faq#moving-a-single-profile-to-another-machine)); sem necessidade de reconstruir do zero
