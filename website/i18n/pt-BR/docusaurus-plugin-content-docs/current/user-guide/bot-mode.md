---
title: "Bot Mode"
description: "Transforme seus perfis do Work4You em um elenco de Bots nomeados — cada um com seu próprio chat, função, modelo, memória, skills e avatar. Os Bots executam rotinas, compartilham chats em grupo e trocam mensagens entre si."
---

# Bot Mode

O **Bot Mode** transforma seus [perfis do Work4You](./profiles.md) em um elenco de **Bots** nomeados. Cada Bot tem sua própria função, modelo, memória, skills e avatar; os Bots executam rotinas recorrentes, deliberam juntos em chats em grupo e trocam mensagens diretamente entre si. Construa um Bot especialista uma vez e ele fica lá para sempre, a um clique de distância.

O Bot Mode vem **embutido no [aplicativo desktop](./desktop.md)** e está **ativado por padrão** — sem necessidade de instalação. Ele aparece como uma aba **Bots** ao lado de Sessions na barra lateral esquerda, com um bloco **Routines** ancorado ao lado da conversa enquanto a aba Bots está ativa.

:::tip Um Bot é um perfil
Não há nenhuma primitiva nova para aprender: um Bot **é** um perfil do Work4You — configuração isolada, memória, skills, credenciais e histórico de chat sob `~/.work4you/profiles/<name>/`. O Bot Mode é uma interface sobre essa primitiva, então tudo o que você faz nele também é visível pela CLI: `work4you -p <bot> chat` abre o mesmo agente, e as rotinas dos Bots aparecem em `work4you cron list`. Sem patches no núcleo, sem daemons em segundo plano, sem armazenamento extra.
:::

## O painel de Bots

O elenco mostra uma linha por perfil de agente: avatar, prévia da última mensagem e timestamp.

- **Clique em um Bot** para cair no seu chat — todo Bot tem uma conversa canônica e persistente de **Bot Chat**, criada (e fixada) no momento em que o Bot nasce.
- **Sessions** (a partir do menu de contexto de um Bot) navega e filtra as 200 conversas armazenadas mais recentes daquele perfil, sem alterar o fluxo principal de clicar-para-conversar.
- **Active now** — uma faixa de presença acima do elenco mostra todo Bot que está trabalhando no momento: o perfil ocupado no gateway mais qualquer Bot que escreveu nos últimos 90 segundos. Cada chip abre o chat daquele Bot. A faixa nunca reordena o elenco e desaparece quando a frota está ociosa.
- **Search** filtra o elenco enquanto você digita.
- **Ocultar um Bot** — clique com o botão direito em uma linha → **Hide Bot** para tirar um Bot que você não usa do elenco e da faixa Active-now. Ocultar é apenas de exibição: @menções ainda são resolvidas, participações em chats em grupo permanecem intocadas, e as rotinas continuam rodando. Assim que pelo menos um Bot está oculto, um **alternador de olho** aparece no cabeçalho do painel — clique nele para revelar os Bots ocultos, esmaecidos no lugar, depois clique com o botão direito → **Unhide Bot** para trazer um de volta. Bots ocultos nunca exibem notificações, mas acumulam atividade não lida silenciosamente, e o ícone de olho ganha um ponto para você saber que algo aconteceu. O estado de ocultação é salvo nos metadados do perfil do Bot, então ele acompanha o Bot em todo desktop conectado a esse backend.

:::note O Bot Chat canônico é um chat eterno
Digitar `/new` (ou `/reset`) dentro do chat canônico de um Bot bifurcaria o relacionamento em uma sessão descartável — a única coisa que o Bot Mode promete que nunca acontece. O compositor redireciona isso para `/compact`: contexto de trabalho novo, mesma conversa. Sessões regulares no mesmo perfil mantêm total liberdade de `/new`.
:::

## Criando um Bot

Clique em **New Agent** no elenco. O caminho rápido são três campos — **Name**, **Title**, **Description** — e o Bot passa a existir em segundos, se apresentando como a primeira mensagem do seu novo Bot Chat.

Uma seção **Advanced** expansível abre toda a superfície de capacidades:

- **Clonar de um perfil existente** — comece a partir da configuração, skills, SOUL e memória de outro Bot, ou escolha **Fresh profile** para um início limpo.
- **Criar vazio** — pula completamente as skills empacotadas para um perfil mínimo.
- **Fixação de modelo e provedor** — dê ao Bot seu próprio modelo. Qualquer par provedor/modelo que o Work4You conheça funciona, e Bots diferentes podem rodar em modelos diferentes lado a lado. Deixe sem definir para herdar do perfil de lançamento.
- **SOUL.md personalizado** — a persona e as instruções permanentes do Bot.
- **Habilitação por skill, por conjunto de ferramentas e por servidor MCP** — marque exatamente as capacidades que esse especialista precisa.
- **Chaves compartilhadas** — por padrão, o novo Bot compartilha um único pool de OAuth/token com o perfil principal, para que atualizações de credenciais não possam invalidar umas às outras. (Gateways mais antigos copiam credenciais em vez disso — ainda funcional, apenas bifurcado.)

### Escolhendo em qual máquina ele vive ("Create on")

Com mais de uma conexão registrada em [Settings → Connections](./multi-connection-desktop.md), o diálogo New Agent ganha um seletor **Create on**. Escolha um dispositivo e o perfil é criado no backend **daquela** máquina — sua janela nunca troca de gateway. O novo Bot então aparece no elenco como um Bot de Conexões (com um identificador `@name-device` quando o nome existe em várias máquinas), e conversar com ele roteia para a sua própria máquina.

Com uma única conexão (o caso comum), o seletor fica oculto e o Bot é criado na máquina à qual você está conectado — exatamente o comportamento antigo.

Notas de criação remota:

- A **fonte de clonagem** é um perfil da máquina *de destino* (seu `default`) — uma máquina remota não tem seus perfis locais para clonar.
- A aba Capabilities ao vivo se fixa no backend da máquina de destino, então as skills, ferramentas e servidores MCP que você configurar durante a criação chegam à máquina onde o Bot vai viver. (Versões mais antigas do desktop recorrem a listas preparadas de Skills/Tools/MCP para alvos remotos; ambas leem o catálogo da máquina de destino.)
- Cancelar o diálogo descarta o perfil rascunho em qualquer que seja a máquina onde ele foi criado.

**Edit Profile** (clique com o botão direito em um Bot) reabre a mesma superfície no perfil ativo a qualquer momento: avatar, título, descrição, fixação de modelo, skills, conjuntos de ferramentas, servidores MCP e o SOUL.md completo.

**Duplicate** (clique com o botão direito) faz um clone completo de um Bot — configuração, skills, SOUL.md, memória e sua aparência. **Delete Profile** o remove permanentemente, atrás da mesma confirmação destrutiva usada pelo menu de perfil do desktop; o perfil padrão não pode ser excluído.

## Avatares

Todo Bot ganha um rosto:

- **Rostos blob** (padrão) — um rosto de corpo mole determinístico, derivado do nome do Bot: mesmo nome, mesmo rosto, para sempre. Enquanto você digita um nome no New Agent, o rosto o acompanha ao vivo; clique em **Randomize** para sortear de novo, **Lock face** para manter o que você gostou mesmo se o nome mudar, ou fixe uma das seis silhuetas (redonda, orgânica, quadrada, protuberância, nuvem, sol) enquanto o resto ainda vem do nome.
- **Rostos geométricos** — as clássicas 7 formas × 10 cores, com olhos piscantes que escaneiam enquanto o Bot trabalha.
- **Uma imagem carregada** — qualquer imagem que você preferir.
- **Um retrato gerado por IA** — quando um backend de imagem está configurado, gerado na hora (isso usa o RPC padrão `image.generate` e funciona tanto em gateways locais quanto remotos).
- **Um pixel pet** — um companheiro da [galeria petdex](./features/pets.md) que pula ao lado do avatar enquanto o Bot está ocupado. Execute `work4you pets` em um terminal para explorar a galeria.

A aparência, o título e a descrição de um Bot são armazenados nos metadados do perfil no backend, então o mesmo Bot aparece da mesma forma em todo desktop conectado a esse backend.

## Routines

O painel **Routines** anexa tarefas recorrentes ao Bot que as executa — "resuma minha caixa de entrada toda manhã" fica ao lado do Bot responsável por isso. O painel se ancora ao lado do chat apenas enquanto a aba Bots está ativa e se afasta quando você volta para Sessions (versões mais antigas do desktop o mantêm sempre visível). Um seletor de agendamento estruturado monta o agendamento (frequência primeiro, depois só o detalhe que importa), com um campo Advanced expondo a string de agendamento bruta do Work4You.

As rotinas são simples [cron jobs do Work4You](./features/cron.md) com namespace `[bot:<name>] <routine>` — elas também aparecem em `work4you cron list` e na página Cron do núcleo. As execuções ficam registradas no próprio histórico de chat do Bot, então o resultado fica bem onde você conversaria com aquele Bot de qualquer forma.

## Grupos e chats em grupo

Clique com o botão direito em um Bot local → **Manage groups** para adicioná-lo ou removê-lo de qualquer número de chats em grupo. Escolha grupos existentes independentemente ou crie um diretamente ali. A participação local é armazenada nos metadados de perfil sincronizados com o backend do Bot, então ela acompanha esse perfil entre desktops; perfis antigos com um único grupo legado continuam funcionando. Bots de Conexões entram pelo seletor New Group Chat e permanecem qualificados por origem no estado local do Desktop daquela sala.

Grupos são linhas independentes no mesmo elenco ordenado por atividade das DMs de Bots. Um Bot mantém uma única linha de DM mesmo quando pertence a vários grupos, enquanto cada grupo ganha sua própria linha de sala com contagem de membros, prévia da última mensagem, timestamp e estado de "precisa de você".

**Open chat** em qualquer linha de grupo (2–6 Bots) abre uma sala compartilhada onde todo o grupo coordena:

- Sua mensagem aciona até **três rodadas seriais** de falas dos membros. Bots @mencionados respondem (todos respondem quando ninguém é mencionado); cada Bot responde brevemente ou passa a vez, e a sala se estabiliza quando uma rodada inteira permanece em silêncio.
- Os Bots puxam uns aos outros com `@name`, e escalam decisões que exigem julgamento real para você com `@user` — a linha do grupo mostra um selo **needs you** quando isso acontece.
- Limites rígidos (10 mensagens por envio, 3 rodadas) impedem que as salas entrem em loop.
- Cada membro mantém sua própria sessão persistente `Group: <name>`, então o contexto da sala sobrevive como qualquer outra conversa.
- **Nem todo Bot responde a toda mensagem.** Falar é escolha de cada membro — um Bot só responde quando tem algo novo a acrescentar e passa a vez caso contrário, e @mencionar membros específicos restringe a rodada a eles. Espere que os membros que você endereçou (ou quem tiver algo a dizer) falem, e o resto permaneça em silêncio.
- **As salas podem abranger várias máquinas.** O seletor New Group Chat aceita Bots de qualquer conexão registrada; a vez de cada membro roda na sua própria máquina, na sua própria sessão `Group: <name>` lá. Membros de outras máquinas carregam um selo de dispositivo (`dixie · Mac Mini`) na sala e nas transcrições de outros membros, e o identificador desambiguado `@name-device` funciona em menções dentro da sala — assim, agentes com o mesmo nome em duas máquinas nunca se confundem.

## Mensagens entre Bots

Bots trocam mensagens entre si com atribuição, e você pode repassar trabalho de qualquer chat:

- **@menções** — digite `@researcher have a look at this` em qualquer chat e o Bot ativo repassa a mensagem, espera a resposta e reporta de volta. Nomes de menção são validados contra o elenco ativo, então um endereço de e-mail ou um `@` desconhecido passa intocado.
- **@menções entre máquinas** — mencionar um Bot que vive em outra conexão registrada (use seu identificador `@name-device` quando os nomes colidirem) entrega a mensagem via o registro de Connections em segundo plano: o Bot ativo permanece neste dispositivo, o desktop roteia a mensagem para a máquina do destinatário, e a resposta é retransmitida de volta atribuída àquele agente. O gateway da sua janela nunca muda.
- **Mensagens diretas** — um Bot alcança o Bot Chat de um colega de equipe através da CLI padrão: ele escreve a mensagem em um arquivo temporário (abrindo com o prefixo `Message from 🤖 <sender> (@<sender>):`), depois executa `work4you -p <bot> chat --in ~ -c "Bot Chat" --create-if-missing -Q --query-file <file>`. O transporte por arquivo significa que nada é interpretado pelo shell — aspas, `$(...)` e crases na mensagem chegam literalmente. O Bot receptor vê a mensagem na próxima vez que rodar e sabe como responder, porque o protocolo de mensagens faz parte do system prompt do seu Bot Chat.

O backend ensina automaticamente o protocolo de mensagens à sessão canônica de Bot Chat de cada Bot no momento da montagem do prompt — inclusive quando um colega de equipe a abre sem interface a partir da CLI. Apenas o Bot Chat canônico recebe a seção de protocolo; suas sessões regulares e seu SOUL.md permanecem intocados. Isso é controlado por `agent.bot_mode_protocol` em `config.yaml` (padrão: ativado):

```yaml
agent:
  bot_mode_protocol: true   # inject the bot-to-bot messaging protocol into canonical Bot Chats
```

:::note
A entrega entre Bots é por invocação: o Bot receptor pega a mensagem na próxima vez que rodar. Interrupção ao vivo de um Bot no meio de uma conversa é trabalho futuro.
:::

### DMs iniciadas por Bots entre máquinas (`work4you peer`)

Bots em uma máquina podem enviar mensagens para Bots no gateway de **outra máquina** sem nenhum desktop no meio. Registre o outro gateway como um *peer* (sua URL do servidor de API + `API_SERVER_KEY`):

```bash
work4you peer add spark --url http://spark.lan:8377 --key <API_SERVER_KEY>
work4you peer list
work4you peer dm spark < /tmp/dm.txt        # message body from a file (nothing shell-interpreted)
work4you peer dm spark/researcher < /tmp/dm.txt   # named profile on a multiplexed peer
```

`work4you peer dm` entrega no Bot Chat canônico do agente remoto através do servidor de API existente do peer, executa um turno do agente lá, e imprime a resposta na stdout — o equivalente exato entre máquinas do comando local `work4you -p <bot> chat`.

Uma vez que um peer é registrado, o protocolo de mensagens ensinado a todo Bot Chat (`agent.bot_mode_protocol`) inclui automaticamente o elenco de peers e o padrão `work4you peer dm` — então **seus bots aprendem sozinhos** que existem colegas de equipe em outras máquinas e como alcançá-los. Registrar ou remover um peer atualiza o protocolo de cada Bot Chat na sua próxima mensagem (época de capacidade).

Requisitos: a máquina peer roda a plataforma de gateway `api_server` com um `API_SERVER_KEY` forte; a acessibilidade é responsabilidade da sua rede (LAN, Tailscale, VPN). A chave é uma credencial e vive em `~/.work4you/.env` como `WORK4YOU_PEER_<NAME>_KEY`; nomes/URLs de peers vivem em `config.yaml` sob `bot_peers`.

## Bots entre máquinas

Quando você registra vários backends em **Settings → Connections** — o runtime local, gateways remotos, hosts SSH, instâncias do Work4You Cloud — o elenco mostra os Bots de **toda** fonte conectada, de forma persistente: fontes SSH são inventariadas sem gerar nada na máquina remota, e máquinas momentaneamente inacessíveis mantêm suas últimas linhas conhecidas em vez de desaparecer. Quando o mesmo nome de perfil existe em várias fontes, os identificadores se desambiguam como `@name-device` (por exemplo, `@research-homelab`). Os chats, sessões, memória e rotinas de um Bot vivem na máquina que possui o perfil.

Clicar em um Bot de Conexões **não** move sua janela para aquela máquina — permaneça no seu chat e @mencione-o, coloque-o em um chat em grupo, ou crie novos agentes diretamente nele com o seletor **Create on**. Agentes de Cloud e locais compartilham um elenco dessa forma: registre sua instância do Work4You Cloud e seu desktop (digamos, via Tailscale ou SSH) e os Bots deles podem trocar mensagens entre si e se sentar nas mesmas salas, com o trabalho de cada agente rodando na sua própria máquina.

Veja [Conectando o Desktop a Várias Instâncias do Work4You](./multi-connection-desktop.md) para o guia completo de múltiplas conexões.

## Desativando

O Bot Mode é um plugin de desktop empacotado. Desative-o em **Settings → Plugins → Bots** — o elenco, o painel Routines e o middleware do compositor se desregistram ao vivo, sem necessidade de reiniciar. Seus perfis, sessões e cron jobs permanecem intocados de qualquer forma; o Bot Mode nunca é dono dos seus dados, apenas os renderiza.

Também há uma preferência para ocultar os Bot Chats canônicos da lista regular de sessões na barra lateral, para que eles apareçam apenas dentro do painel de Bots. (Isso usa a flag de sessão oculta do núcleo; em gateways mais antigos, os chats simplesmente permanecem visíveis.)

## Paridade com a CLI

Como os Bots são perfis, tudo tem um equivalente no terminal:

| No Bot Mode | A partir de um shell |
| --- | --- |
| Conversar com um Bot | `work4you -p <bot> chat` |
| Arquivos, skills, memória de um Bot | `~/.work4you/profiles/<bot>/` |
| Routines | `work4you cron list` (jobs nomeados `[bot:<name>] …`) |
| Criar / inspecionar perfis | `work4you profile create`, `work4you profile list` |

Veja [Profiles](./profiles.md) para a primitiva subjacente e [Profile Commands](../reference/profile-commands.md) para a referência completa da CLI.
