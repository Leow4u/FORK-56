# SimpleX Chat

O [SimpleX Chat](https://simplex.chat/) é uma plataforma de mensagens privada e descentralizada, na qual os usuários são donos de seus contatos e grupos. Diferente de outras plataformas, o SimpleX não atribui IDs de usuário persistentes — cada contato é identificado por um ID interno opaco gerado no momento da conexão, o que o torna um dos mensageiros mais privados disponíveis.

> Execute `work4you gateway setup` e escolha **SimpleX** para um passo a passo guiado.

## Pré-requisitos

- A CLI **simplex-chat** instalada e rodando como daemon
- O pacote Python **websockets** (`pip install websockets`)

## Instalar o simplex-chat

Baixe a versão mais recente na página de [releases do simplex-chat no GitHub](https://github.com/simplex-chat/simplex-chat/releases):

```bash
# Linux / macOS binary
curl -L https://github.com/simplex-chat/simplex-chat/releases/latest/download/simplex-chat-ubuntu-22_04-x86_64 -o simplex-chat
chmod +x simplex-chat
```

O projeto SimpleX Chat não publica uma imagem Docker pré-compilada para o cliente de chat; para rodá-lo no Docker, compile a partir do código-fonte do [repositório simplex-chat](https://github.com/simplex-chat/simplex-chat).

## Iniciar o daemon

```bash
simplex-chat -p 5225
```

Por padrão, o daemon escuta via WebSocket em `ws://127.0.0.1:5225`.

## Configurar o Work4You

### Via assistente de configuração

```bash
work4you gateway setup
```

Selecione **SimpleX Chat** e siga as instruções.

### Via variáveis de ambiente

Adicione o seguinte em `~/.work4you/.env`:

```
SIMPLEX_WS_URL=ws://127.0.0.1:5225
SIMPLEX_ALLOWED_USERS=<contact-id-1>,<contact-id-2>
SIMPLEX_HOME_CHANNEL=<contact-id>
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SIMPLEX_WS_URL` | Sim | URL WebSocket do daemon simplex-chat |
| `SIMPLEX_ALLOWED_USERS` | Recomendada | Lista de permissões separada por vírgulas. Cada entrada pode ser um `contactId` numérico **ou** um nome de exibição — ambas as formas funcionam. |
| `SIMPLEX_ALLOW_ALL_USERS` | Opcional | Defina `true` para permitir todos os contatos (use com cuidado) |
| `SIMPLEX_AUTO_ACCEPT` | Opcional | Aceitar automaticamente solicitações de contato recebidas (padrão: `true`) |
| `SIMPLEX_GROUP_ALLOWED` | Opcional | IDs de grupo separados por vírgula dos quais o bot participa, ou `*` para qualquer grupo. Omita para ignorar completamente mensagens de grupo |
| `SIMPLEX_HOME_CHANNEL` | Opcional | ID de contato/grupo padrão para entrega de tarefas cron |
| `SIMPLEX_HOME_CHANNEL_NAME` | Opcional | Rótulo legível para o canal padrão |
| `WORK4YOU_SIMPLEX_TEXT_BATCH_DELAY` | Opcional | Segundos de período de silêncio (padrão: `0.8`) usados para concatenar mensagens de texto de entrada rápidas em um único evento |

## Encontrar seu ID de contato ou nome de exibição

Depois de iniciar o daemon, abra uma conversa com seu contato agente. O `contactId` numérico aparece nos logs de sessão. Se preferir usar o nome de exibição mostrado na interface do SimpleX, isso também funciona — `SIMPLEX_ALLOWED_USERS` aceita ambas as formas.

## Autorização

Por padrão, **todos os contatos são negados**. Você deve:

1. Definir `SIMPLEX_ALLOWED_USERS` com uma lista separada por vírgulas de `contactId`s e/ou nomes de exibição (ex.: `SIMPLEX_ALLOWED_USERS=4,alice` corresponde tanto ao contactId 4 quanto ao contato cujo nome de exibição é "alice"), ou
2. Usar **pareamento via DM** — envie qualquer mensagem ao bot e ele responderá com um código de pareamento. Insira esse código via `work4you pairing approve simplex <CODE>`.

## Chats em grupo

Por padrão o adaptador ignora mensagens de grupo — um bot em um grupo, do contrário, processaria o tráfego de todos os membros. Habilite explicitamente:

```
SIMPLEX_GROUP_ALLOWED=12,34          # specific group IDs
# or
SIMPLEX_GROUP_ALLOWED=*              # any group the bot is in
```

Endereçe grupos prefixando o ID do chat com `group:`, por exemplo
`simplex:group:12` como alvo `deliver=` de um cron ou em uma chamada `work4you send`.

## Enviando com `work4you send`

O SimpleX funciona como um alvo de envio independente — o daemon precisa estar rodando,
mas um gateway ativo não é necessário para texto simples:

```bash
work4you send --to simplex:alice "hello"          # DM by contact display name
work4you send --to simplex:group:12 "hello"       # group by numeric ID
work4you send --to simplex "hello"                # SIMPLEX_HOME_CHANNEL
```

Enquanto o gateway estiver em execução, o adaptador enumera seus contatos e
grupos permitidos no diretório de canais (atualizado a cada 5 minutos), então
`work4you send --list` os exibe por nome. Antes da primeira execução do gateway a
plataforma ainda aparece em `--list` com uma dica de "nenhum canal descoberto ainda"
— alvos diretos como os acima funcionam de qualquer forma.

## Anexos

O adaptador suporta anexos nativos do SimpleX em ambas as direções:

- **Entrada** — imagens, notas de voz e arquivos recebidos são aceitos via
  o fluxo XFTP do daemon (`rcvFileDescrReady` → `/freceive` → aguardar
  `rcvFileComplete`) e apresentados como `MessageEvent.media_urls` com o
  `MessageType` adequado (`PHOTO`, `VOICE`, `TEXT` + documento).
- **Saída** — `send_image_file`, `send_voice`, `send_document` e
  `send_video` usam o formulário estruturado `/_send` com `filePath`, para
  que o cliente SimpleX de recebimento renderize imagens inline e reproduza
  notas de voz inline em vez de oferecê-las como downloads.

As respostas do agente também podem incorporar tags `MEDIA:/path/to/file` em texto simples —
o adaptador remove a tag do corpo e envia o arquivo como nota de voz
(extensões de áudio) ou como documento.

## Usando o SimpleX com tarefas cron

```python
cronjob(
    action="create",
    schedule="every 1h",
    deliver="simplex",          # uses SIMPLEX_HOME_CHANNEL
    prompt="Check for alerts and summarise."
)
```

Ou direcione um contato específico via o campo `deliver:` da tarefa cron, ou a partir de um script shell com a [CLI `work4you send`](/guides/pipe-script-output):

```bash
work4you send simplex:<contact-id> "Done!"
```

## Notas de privacidade

- O SimpleX nunca revela números de telefone ou endereços de e-mail — os contatos usam IDs opacos
- A conexão entre o Work4You e o daemon é um WebSocket local (`ws://127.0.0.1:5225`) — nenhum dado sai da sua máquina
- As mensagens são criptografadas de ponta a ponta pelo protocolo SimpleX antes de chegar ao daemon

## Solução de problemas

**"Cannot reach daemon"** — Garanta que `simplex-chat -p 5225` esteja em execução e que a porta corresponda a `SIMPLEX_WS_URL`.

**"websockets not installed"** — Execute `pip install websockets`.

**Mensagens não recebidas** — Verifique se o ID do contato está em `SIMPLEX_ALLOWED_USERS` ou aprove-o via pareamento por DM.
