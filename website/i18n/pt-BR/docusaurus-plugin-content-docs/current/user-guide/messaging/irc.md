# IRC

O adaptador de IRC conecta o Work4You a qualquer servidor IRC e retransmite mensagens entre um canal IRC (ou mensagens diretas) e o agente. Ele fala o protocolo IRC usando o `asyncio` da biblioteca padrão do Python — **sem dependências externas, sem SDK, sem daemon**. Funciona com redes públicas como a [Libera.Chat](https://libera.chat/) e qualquer ircd auto-hospedado.

O IRC é texto puro: não há suporte a voz, imagem, arquivo, thread, reação, indicador de digitação ou streaming — as respostas são enviadas como linhas `PRIVMSG`, com mensagens longas divididas para caber no limite de linha do IRC.

> Execute `work4you gateway setup` e escolha **IRC** para um passo a passo guiado.

## Pré-requisitos

- Um servidor IRC ao qual se conectar (ex.: `irc.libera.chat`)
- Um canal para entrar (ex.: `#work4you`) — separe por vírgulas para entrar em vários
- Um apelido (nickname) para o bot (padrão: `work4you-bot`)
- Opcional: um nick registrado + senha do NickServ, caso sua rede exija identificação

## Configurar o Work4You

Você pode configurar o IRC de duas formas — variáveis de ambiente (para uma configuração rápida somente com env) ou o bloco `gateway` em `~/.work4you/gateway-config.yaml`.

### Opção A — gateway-config.yaml

```yaml
gateway:
  platforms:
    irc:
      enabled: true
      extra:
        server: irc.libera.chat
        port: 6697
        nickname: work4you-bot
        channel: "#work4you"
        use_tls: true
        server_password: ""       # optional server password
        nickserv_password: ""     # optional NickServ identification
        allowed_users: []         # empty = allow all, or list of nicks
        max_message_length: 450   # IRC line limit (safe default)
```

### Opção B — variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|:--------:|-------------|
| `IRC_SERVER` | ✅ | Nome do host do servidor IRC (ex.: `irc.libera.chat`) |
| `IRC_CHANNEL` | ✅ | Canal(is) para entrar — separe por vírgulas para vários |
| `IRC_NICKNAME` | ✅ | Apelido do bot (padrão: `work4you-bot`) |
| `IRC_PORT` | — | Porta do servidor (padrão: `6697` com TLS, `6667` sem) |
| `IRC_USE_TLS` | — | Usar TLS (`true`/`false`; padrão `true` na porta 6697) |
| `IRC_SERVER_PASSWORD` | — | Senha do servidor para o comando `PASS` |
| `IRC_NICKSERV_PASSWORD` | — | Senha do NickServ para IDENTIFY automático ao conectar |
| `IRC_ALLOWED_USERS` | — | Nicks separados por vírgula autorizados a falar com o bot |
| `IRC_ALLOW_ALL_USERS` | — | Permitir que qualquer pessoa no canal fale com o bot (apenas dev) |
| `IRC_HOME_CHANNEL` | — | Canal para entrega de cron / notificações (padrão: `IRC_CHANNEL`) |

## Controle de acesso

Por padrão, apenas os nicks listados em `allowed_users` (ou `IRC_ALLOWED_USERS`) podem falar com o bot. Deixe a lista vazia **e** defina `IRC_ALLOW_ALL_USERS=true` para permitir que qualquer pessoa no canal converse com o Work4You — útil para testes, mas não recomendado em redes públicas, já que nicks de IRC não são autenticados a menos que a rede exija NickServ.

Se sua rede registra nicks, defina `IRC_NICKSERV_PASSWORD` (ou `nickserv_password`) para que o bot se identifique no NickServ ao conectar e mantenha seu nick registrado.

## Canais vs. DMs

- Mensagens em um canal do qual o bot participa são tratadas como conversa em **grupo**.
- Mensagens privadas ao bot são tratadas como **mensagens diretas**.

Tarefas cron e notificações são entregues no **canal padrão (home channel)** — `IRC_HOME_CHANNEL`, se definido, ou o primeiro `IRC_CHANNEL` caso contrário.

## Executar o gateway

```bash
work4you gateway start
```

Verifique o status com `work4you gateway status` — o estado da conexão IRC é reportado ali, inclusive para configurações apenas com variáveis de ambiente.

## Notas

- Respostas longas do agente são automaticamente divididas em várias linhas `PRIVMSG` para respeitar o limite de linha do IRC (`max_message_length`, padrão de 450 bytes após o overhead do protocolo).
- O adaptador adquire um bloqueio de credencial (credential lock) restrito por servidor+nick, para que dois perfis do Work4You não disputem a mesma identidade de IRC.
