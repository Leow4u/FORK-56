---
sidebar_position: 11
title: "Integração com Hosts ACP"
description: "Use o Work4You dentro de editores e plataformas de colaboração compatíveis com ACP"
---

# Integração com Hosts ACP

O Work4You pode rodar como um servidor ACP, permitindo que hosts compatíveis com ACP conversem com o
Work4You via stdio. Os editores podem renderizar:

- mensagens de chat
- atividade de ferramentas
- diffs de arquivos
- comandos de terminal
- prompts de aprovação
- streaming de pensamento / trechos de resposta

Outros hosts podem usar o mesmo protocolo para encaminhar eventos de colaboração para o
Work4You. O ACP é uma boa opção quando você quer que o Work4You mantenha sua identidade,
configuração de provedor, memória, skills e ferramentas existentes enquanto outro aplicativo controla
o transporte da conversa.

## O que o Work4You expõe no modo ACP

O Work4You roda com um conjunto de ferramentas `work4you-acp` selecionado especificamente para fluxos de trabalho de editor. Ele inclui:

- ferramentas de arquivo: `read_file`, `write_file`, `patch`, `search_files`
- ferramentas de terminal: `terminal`, `process`
- ferramentas de web/browser
- memória, todo, busca de sessão
- skills
- execute_code e delegate_task
- visão

Ele exclui propositalmente coisas que não se encaixam na UX típica de editor, como entrega de mensagens e gerenciamento de cronjobs.

## Instalação

Instale o Work4You normalmente, depois adicione o extra do ACP a partir do checkout de instalação:

```bash
cd ~/.work4you/work4you && uv pip install -e '.[acp]'
```

Isso instala a dependência `agent-client-protocol` e habilita:

- `work4you acp`
- `work4you-acp`
- `python -m acp_adapter`

## Iniciando o servidor ACP

Qualquer um dos comandos a seguir inicia o Work4You em modo ACP:

```bash
work4you acp
```

```bash
work4you-acp
```

```bash
python -m acp_adapter
```

O Work4You registra logs em stderr para que o stdout fique reservado ao tráfego JSON-RPC do ACP.

Para verificações não interativas:

```bash
work4you acp --version
work4you acp --check
```

### Ferramentas de browser (opcional)

As ferramentas de browser (`browser_navigate`, `browser_click`, etc.) dependem do
pacote npm `agent-browser` e do Chromium, que não fazem parte do wheel Python.
Instale-as com:

```bash
work4you acp --setup-browser           # interativo (pede confirmação antes de baixar ~400 MB)
work4you acp --setup-browser --yes     # aceita o download de forma não interativa
```

Este é o comando standalone. O fluxo de autenticação por terminal (`work4you acp --setup`) também oferece o bootstrap do browser como uma pergunta de acompanhamento após a seleção do modelo, então a maioria dos usuários nunca precisa rodar `--setup-browser` diretamente.

O que ele faz:

- Instala o Node.js 26 em `~/.work4you/node/` se estiver faltando
- Executa `npm install -g agent-browser @askjo/camofox-browser` nesse prefixo (sem precisar de sudo — o `--prefix` do `npm` aponta para o Node gerenciado pelo Work4You, gravável pelo usuário)
- Instala o Chromium do Playwright, ou usa um Chrome/Chromium do sistema detectado, quando disponível

O bootstrap é idempotente — executá-lo novamente é rápido e pula o trabalho já feito.

## Configuração de host

### Canais Buzz (relay bridge)

[Buzz](https://github.com/block/buzz) é uma plataforma de colaboração baseada em Nostr
para pessoas e agentes. Seu harness `buzz-acp` conecta canais do Buzz a qualquer agente
ACP via stdio:

```text
Relay Buzz <-- WebSocket --> buzz-acp <-- ACP via stdio --> Work4You
```

Isso é uma integração de transporte, não uma segunda instalação do Work4You. O
subprocesso lançado pelo `buzz-acp` usa a mesma configuração, credenciais, memória,
skills e estado do Work4You que o `work4you` naquele host.

(Isso é diferente do [runtime gerenciado do Buzz Desktop](#buzz-desktop), que
inicia o Work4You localmente como um harness predefinido. A relay bridge serve para entrar em
*canais* do Buzz como uma identidade de agente, tipicamente em um servidor.)

Pré-requisitos:

- Complete a instalação do ACP e o `work4you acp --check` acima.
- Compile o `buzz-acp` e a CLI `buzz` a partir do
  [repositório do Buzz](https://github.com/block/buzz)
  (`cargo build --release -p buzz-acp`).
- Gere um par de chaves Nostr dedicado para o Work4You (`buzz-admin generate-key`) e
  registre-o como membro do relay (`buzz-admin add-member`). Cada agente precisa
  de sua própria identidade — não reutilize o par de chaves de uma pessoa.
- Adicione essa identidade aos canais do Buzz pretendidos.

Inicie uma bridge com:

```bash
export BUZZ_RELAY_URL="wss://community.example.com"
export BUZZ_PRIVATE_KEY="..."
export BUZZ_API_TOKEN="..."
export BUZZ_ACP_AGENT_COMMAND="work4you"
export BUZZ_ACP_AGENT_ARGS="acp"

buzz-acp
```

`BUZZ_API_TOKEN` só é necessário quando o relay exige autenticação por token.
Não faça commit nem cole a chave privada ou o token da API.

Para uma implantação de servidor persistente, execute o `buzz-acp` sob um gerenciador de serviços como
o mesmo usuário do sistema operacional dono do diretório home do Work4You pretendido. Configuração,
geração de chaves, descoberta de canais e opções por agente estão documentadas no
[README do buzz-acp](https://github.com/block/buzz/tree/main/crates/buzz-acp).

A bridge descobre todo canal do Buzz em que a identidade do Work4You é membro
e se inscreve automaticamente quando é adicionada a outro canal. A associação de canais do Buzz
continua sendo, portanto, o limite de acesso; o Work4You não precisa de uma
lista de canais separada em sua própria configuração.

Para expor a atividade ACP do Work4You no Buzz Desktop do proprietário, adicione:

```bash
export BUZZ_ACP_RELAY_OBSERVER="true"
```

Isso publica quadros de observador criptografados do tipo `24200` endereçados ao proprietário
do agente (NIP-AO do Buzz). O Desktop renderiza o ciclo de vida ao vivo, as ferramentas, as respostas e
o fluxo de uso na **Activity log** do agente. O relay trata esses quadros como
efêmeros, então o Desktop precisa estar online antes do início do turno; seu arquivo de observador
local é o histórico durável do lado do proprietário.

Bridges headless respondem às solicitações de permissão do ACP por conta própria, pois nenhum editor
está presente para mostrar diálogos de aprovação — veja
[Mantenha os agentes Buzz restritos ao proprietário](#keep-buzz-agents-owner-only). Trate a bridge
como automação privilegiada: use uma conta de sistema operacional dedicada, restrinja
quais usuários do Buzz podem interpelar o agente (`buzz-acp` suporta um portão de resposta
restrito ao proprietário via `BUZZ_ACP_AGENT_OWNER`), e conceda associação apenas nos canais
onde o Work4You deve trabalhar.

### VS Code

Instale a extensão [ACP Client](https://marketplace.visualstudio.com/items?itemName=formulahendry.acp-client).

Para conectar:

1. Abra o painel do ACP Client na Activity Bar.
2. Selecione **Work4You** na lista de agentes integrados.
3. Conecte e comece a conversar.

Se quiser definir o Work4You manualmente, adicione-o pelas configurações do VS Code em `acp.agents`:

```json
{
  "acp.agents": {
    "Work4You": {
      "command": "work4you",
      "args": ["acp"]
    }
  }
}
```

### Zed

Configure o Work4You como um servidor de agente personalizado nas configurações do Zed:

1. Abra o Agent Panel.
2. Adicione um servidor de agente personalizado com a seguinte configuração:

```json
{
  "agent_servers": {
    "work4you": {
      "type": "custom",
      "command": "work4you",
      "args": ["acp"]
    }
  }
}
```

3. Inicie uma nova thread de agente externo do Work4You.

Pré-requisitos:

- Configure as credenciais de provedor do Work4You primeiro com `work4you model`, ou defina-as em `~/.work4you/.env` / `~/.work4you/config.yaml`.

### JetBrains

Use um plugin compatível com ACP e aponte-o para `work4you acp` ou `work4you-acp`.

### Buzz Desktop

O [Buzz](https://github.com/block/buzz) traz o Work4You como um runtime predefinido.
Com o Work4You instalado da forma normal, o Buzz o descobre automaticamente —
abra **Settings → Runtimes** e o Work4You aparece entre os seus runtimes.

Se a descoberta falhar (instalações mais antigas), certifique-se de que o launcher ACP se resolva em um
PATH de shell de login:

```bash
command -v work4you-acp || command -v work4you
```

Instalações recentes gravam os launchers `work4you` e `work4you-acp` em
`~/.local/bin`; executar `work4you update` adiciona o launcher `work4you-acp` a
instalações mais antigas. Como alternativa manual, configure o comando de agente do Buzz como
`work4you` com os argumentos `["acp"]`.

#### Seletor de modelo

O Buzz Desktop (v0.5.1+) renderiza o menu completo de modelos do Work4You nas configurações de runtime
do agente. A lista vem do próprio Work4You via ACP: mostra todo modelo
de provedores que você autenticou no Work4You (o mesmo inventário por trás de
`work4you model` e do comando `/model`), então um modelo ausente do menu
significa que seu provedor não tem credenciais configuradas no lado do Work4You.

IDs de entrada assumem a forma `provider:model` (ex.: `openrouter:z-ai/glm-5.1`), ou
`custom:<name>:<model>` para endpoints personalizados compatíveis com OpenAI definidos em
`config.yaml`. Escolher um modelo se aplica à sessão daquele agente; não
muda o padrão do Work4You como um todo — use `work4you model` para isso.

#### Mantenha os agentes Buzz restritos ao proprietário

O Buzz cria todo agente com **Who can talk to this agent** definido como `Owner only`.
Deixe assim quando o runtime for o Work4You.

Dois comportamentos se combinam nesse caminho. O conjunto de ferramentas `work4you-acp` inclui `terminal`
e `execute_code`, e a bridge ACP do Buzz responde às solicitações de permissão do Work4You
por conta própria com `allow_once`, em vez de exibi-las. Um agente Work4You no Buzz,
portanto, executa comandos de shell no host sem pedir confirmação. Pedi a um deles para rodar
`rm -rf` em um diretório de rascunho e ele o apagou, sem nenhum prompt em lugar algum.

Selecionar `Anyone` entrega esse mesmo acesso de shell a todo autor que consiga alcançar
o canal. O Buzz não avisa quando você escolhe essa opção.

Nenhuma das mitigações óbvias funciona hoje:

- `approvals.mode: manual` de fato faz o Work4You levantar a solicitação de permissão, mas
  o Buzz a aprova automaticamente e o comando roda mesmo assim.
- `platform_toolsets.acp` não restringe o conjunto de ferramentas ACP, então não pode ser usado
  para remover o `terminal`.

`!shutdown` vindo do proprietário para o agente em qualquer modo, e o Buzz ignora esse
comando vindo de qualquer outra pessoa.

## Configuração e credenciais

O modo ACP usa a mesma configuração do Work4You que a CLI:

- `~/.work4you/.env`
- `~/.work4you/config.yaml`
- `~/.work4you/skills/`
- `~/.work4you/state.db`

A resolução de provedor usa o resolvedor de runtime normal do Work4You, então o ACP herda o provedor e as credenciais atualmente configurados. O Work4You também anuncia um método de autenticação por terminal (`--setup`) para clientes ACP de primeira execução; isso abre a configuração interativa de modelo/provedor do Work4You.

## Integração de host

Estas variáveis são definidas por um **processo host ACP** (um editor ou outro harness de
agente) no subprocesso do Work4You que ele inicia. Elas não são configuração do usuário —
não as defina manualmente em `.env` ou `config.yaml`.

| Variável | Valor | Efeito |
|----------|-------|--------|
| `WORK4YOU_ACP_SKIP_CONFIGURED_MCP` | `1` | Pula a inicialização dos servidores MCP **configurados globalmente** no `config.yaml` antes do loop JSON-RPC do ACP começar. |

O Work4You normalmente inicia todo servidor MCP configurado no `config.yaml` antes de
entrar no loop JSON-RPC do ACP. Um host que gerencia o MCP por conta própria — passando
os servidores da sessão explicitamente via `session/new` — não precisa dessa inicialização
global, e um servidor MCP lento ou interativo não relacionado, do contrário, atrasaria
o `initialize`. Definir o marcador como exatamente `1` permite que esse host o pule.

Apenas a descoberta global via `config.yaml` é pulada. **Os servidores MCP fornecidos pela
sessão ACP através de `session/new` continuam sendo registrados**, então um host não perde
nenhuma capacidade que solicitou. Qualquer outro valor (não definido, vazio, `0`, `false`) mantém
o comportamento padrão, para que uma string verdadeira não relacionada não possa desativar
o MCP silenciosamente.

## Comportamento da sessão

As sessões ACP são rastreadas pelo gerenciador de sessões em memória do adaptador ACP enquanto o servidor está em execução.

Cada sessão armazena:

- ID da sessão
- diretório de trabalho
- modelo selecionado
- histórico de conversa atual
- evento de cancelamento

O `AIAgent` subjacente ainda usa os caminhos normais de persistência/registro do Work4You, mas `list/load/resume/fork` do ACP ficam restritos ao processo de servidor ACP em execução no momento.

## Comportamento do diretório de trabalho

As sessões ACP vinculam o cwd do editor ao ID de tarefa do Work4You, para que as ferramentas de arquivo e terminal rodem em relação ao workspace do editor, não ao cwd do processo servidor.

## Aprovações

Comandos de terminal perigosos podem ser encaminhados de volta ao editor como prompts de aprovação. As opções de aprovação do ACP são mais simples que o fluxo da CLI:

- permitir uma vez
- sempre permitir
- negar

Se você realmente vê um prompt depende do host. Um host tem liberdade para responder à
solicitação programaticamente em vez de exibi-la a você, caso em que essas
opções existem no protocolo, mas nunca chegam a um humano. O Buzz Desktop faz isso, então
trate esse caminho como execução não supervisionada independentemente da sua configuração de `approvals`.

Em caso de timeout ou erro, a bridge de aprovação nega a solicitação.

### Aprovação automática de edição com escopo de sessão

O ACP expõe um terceiro nível entre *permitir uma vez* e *sempre permitir*: **Allow for session**. Selecioná-lo no prompt de permissão do editor registra a aprovação apenas dentro da sessão ACP atual — todo comando correspondente subsequente naquela sessão passa sem pedir confirmação, mas uma nova sessão ACP (ou reiniciar o editor) zera o registro e volta a perguntar na primeira vez.

| Opção | Rótulo no editor | Escopo | Persistido entre reinicializações |
|---|---|---|---|
| `allow_once` | Allow once | Esta chamada de ferramenta específica | Não |
| `allow_session` | Allow for session | Todas as chamadas correspondentes nesta sessão ACP | Não — apagado quando a sessão termina |
| `allow_always` | Allow always | Todas as sessões futuras | Sim (gravado na allowlist permanente do Work4You) |
| `deny` | Deny | Esta chamada de ferramenta específica | Não |

`allow_session` é o padrão certo para um fluxo de trabalho de editor em que você confia em um agente durante uma tarefa, mas não quer conceder uma entrada de allowlist de longa duração. A compensação de segurança é direta: quanto mais amplo o escopo, menos o editor vai interromper você, e mais dano um agente com mau comportamento (ou uma injeção de prompt) pode causar antes que você perceba. Comece com `allow_once` para comandos desconhecidos; promova para `allow_session` depois de ver o agente executar o mesmo padrão corretamente algumas vezes; reserve `allow_always` para comandos verdadeiramente idempotentes nos quais você confia para sempre (ex.: `git status`).

A bridge ACP mapeia essas opções para a semântica interna de aprovação do Work4You — `allow_always` grava uma entrada de allowlist permanente da mesma forma que a CLI faz, enquanto `allow_session` afeta apenas o cache de aprovação em processo da sessão ACP atual.

## Solução de problemas

### O agente ACP não aparece no editor

Verifique:

- Para desenvolvimento manual/local, confirme que o comando do host aponta para `work4you acp`.
- O Work4You está instalado e no seu PATH.
- O extra do ACP está instalado (`cd ~/.work4you/work4you && uv pip install -e '.[acp]'`).

### O ACP inicia, mas dá erro imediatamente

Tente estas verificações:

```bash
work4you acp --version
work4you acp --check
work4you doctor
work4you status
```

### Credenciais ausentes

O modo ACP usa a configuração de provedor já existente do Work4You. Configure as credenciais com:

```bash
work4you model
```

ou editando `~/.work4you/.env`. O fluxo de autenticação por terminal (`work4you acp --setup`) também pode disparar a configuração interativa de provedor/modelo.

## Veja também

- [Harness ACP do Buzz](https://github.com/block/buzz/tree/main/crates/buzz-acp)
- [Internals do ACP](../../developer-guide/acp-internals.md)
- [Resolução de Runtime de Provedor](../../developer-guide/provider-runtime.md)
- [Runtime de Ferramentas](../../developer-guide/tools-runtime.md)
