# Buzz

O adaptador Buzz conecta o Work4You a uma comunidade [Buzz](https://github.com/block/buzz) — a plataforma open-source de colaboração humano+agente da Block, construída sobre o protocolo Nostr — e retransmite mensagens entre canais (ou DMs) do Buzz e o agente. O tráfego de saída é executado via shell no binário da CLI `buzz` ("JSON in, JSON out"); o tráfego de entrada usa uma assinatura WebSocket nativa do Nostr (via o pacote `websockets` já incluído), com polling via CLI como alternativa. **Nenhum pacote Python adicional é necessário** — apenas o binário `buzz`.

O Buzz renderiza markdown, então as respostas do agente mantêm sua formatação. Imagens são entregues como uploads (arquivos locais) ou links (URLs). As respostas podem ser encadeadas (threaded) em uma mensagem existente através do seu event id.

Mensagens de entrada chegam por padrão através de uma assinatura WebSocket Nostr persistente autenticada via NIP-42 (entrega quase instantânea), com fallback automático para polling via CLI quando o WebSocket não pode ser estabelecido. Mensagens de saída sempre passam pela CLI `buzz`. Controle isso com `transport` / `BUZZ_TRANSPORT`: `auto` (padrão), `websocket` (exige WS, falha caso contrário) ou `poll`. Se sua associação ao relay usar atestação de proprietário NIP-OA, defina `BUZZ_AUTH_TAG` com o JSON da auth tag de quatro strings.

> Execute `work4you gateway setup` e escolha **Buzz** para um passo a passo guiado.

## Pré-requisitos

- O binário da CLI `buzz` no seu `PATH` (ou aponte `BUZZ_CLI_PATH` para ele) — compile a partir do [repositório Buzz](https://github.com/block/buzz) com `cargo build --release -p buzz-cli`
- Uma URL de relay de comunidade Buzz (ex.: `https://mycommunity.communities.buzz.xyz`)
- Uma chave privada Nostr (nsec ou hex) cuja identidade já seja **membro** dessa comunidade

## Configurar o Work4You

Você pode configurar o Buzz de duas formas — o bloco `gateway` em `config.yaml` (canônico) ou variáveis de ambiente (que o sobrepõem). A chave privada é um **segredo** e sempre deve ficar em `~/.work4you/.env`.

### Opção A — config.yaml

```yaml
gateway:
  platforms:
    buzz:
      enabled: true
      extra:
        relay_url: https://mycommunity.communities.buzz.xyz
        channels:                  # channel UUIDs to watch (empty = all joined)
          - ccc2bc1a-7a82-5a8f-8c4e-57a070cbe7cd
        home_channel: ccc2bc1a-7a82-5a8f-8c4e-57a070cbe7cd
        poll_interval: 4           # seconds between inbound poll sweeps
        cli_path: ""               # buzz binary (default: PATH, then ~/bin/buzz)
        credentials_file: ""       # JSON file with the nsec (BUZZ_PRIVATE_KEY fallback)
        allowed_users: []          # empty = allow all; hex pubkeys or npubs
```

Além disso, em `~/.work4you/.env`:

```
BUZZ_PRIVATE_KEY=nsec1...
```

### Opção B — variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|:--------:|-------------|
| `BUZZ_RELAY_URL` | ✅ | URL base do relay da comunidade |
| `BUZZ_PRIVATE_KEY` | ✅ | Chave privada Nostr (nsec ou hex) — o único segredo |
| `BUZZ_CHANNELS` | — | UUIDs de canais separados por vírgula a observar (padrão: todos os canais dos quais o bot participa) |
| `BUZZ_HOME_CHANNEL` | — | UUID do canal para entrega de cron / notificações (padrão: o primeiro canal observado) |
| `BUZZ_ALLOWED_USERS` | — | npubs ou chaves públicas hex separadas por vírgula autorizadas a falar com o agente |
| `BUZZ_ALLOW_ALL_USERS` | — | Permitir que qualquer membro da comunidade fale com o agente |
| `BUZZ_POLL_INTERVAL` | — | Segundos entre varreduras de polling de entrada (padrão: 4) |
| `BUZZ_CLI_PATH` | — | Caminho do binário `buzz` (padrão: `buzz` no PATH, depois `~/bin/buzz`) |
| `BUZZ_CREDENTIALS_FILE` | — | Arquivo de credenciais JSON contendo o nsec, usado quando `BUZZ_PRIVATE_KEY` não está definido |

## Configurações padrão recomendadas

Ao configurar o Buzz, defina estes padrões em `config.yaml` para manter o canal limpo e o agente focado nos resultados finais em vez do seu log interno de execução de ferramentas. Isso corresponde ao comportamento no Telegram e no e-mail, que já suprimem a saída intermediária de ferramentas.

```yaml
display:
  platforms:
    buzz:
      interim_assistant_messages: false   # suppress intermediate tool results, reasoning comments, and progress updates — only the final response reaches the channel
      tool_progress: off                  # suppress tool progress bubbles (e.g., "Running terminal command...", "Reading file...")
gateway:
  platforms:
    buzz:
      enabled: true
      extra:
        relay_url: https://mycommunity.communities.buzz.xyz
        channels:                         # channel UUIDs to watch (empty = all joined)
          - ccc2bc1a-7a82-5a8f-8c4e-57a070cbe7cd
        home_channel: ccc2bc1a-7a82-5a8f-8c4e-57a070cbe7cd
        poll_interval: 4                  # seconds between inbound poll sweeps (default 4 — balances latency vs. relay load)
        cli_path: ""                      # buzz binary (default: PATH, then ~/bin/buzz)
        credentials_file: ""              # JSON file with the nsec (BUZZ_PRIVATE_KEY fallback)
        allowed_users: []                 # empty = allow all if allow_all_users is true; otherwise restrict to listed npubs/hex pubkeys
        require_mention: true             # in channels: only respond when addressed (@name, npub, or hex pubkey); DMs always dispatch regardless
        allow_all_users: false            # set true for community mode (everyone can chat, only owner is admin); false for private mode (only allowed_users)
```

**Por que esses padrões:**

- `interim_assistant_messages: false` — impede que resultados intermediários de ferramentas, comentários de raciocínio e atualizações de progresso sejam postados como mensagens separadas no canal. Apenas a resposta final vai para o canal.
- `tool_progress: off` — suprime as bolhas de progresso de ferramentas (ex.: "Running terminal command...", "Reading file..."). Mantém o canal focado nos resultados reais, não no processo.
- `poll_interval: 4` — equilibra a latência de entrada (atraso de até 4s) com a carga no relay. Valores menores aumentam a frequência de polling; valores maiores a reduzem.
- `allowed_users: []` + `allow_all_users: false` — modo privado por padrão. Somente os usuários listados podem interagir. Defina `allow_all_users: true` para o modo comunidade, no qual todos podem conversar (a camada de admin continua restrita ao proprietário).
- `require_mention: true` — em canais, o agente só responde quando é endereçado diretamente. DMs sempre são despachadas, independentemente dessa configuração.

**Justificativa:** canais servem para resultados finais e conversação, não para o log interno de execução de ferramentas do agente. Os usuários veem a resposta final, não os passos executados para chegar até ela. Isso corresponde ao comportamento no Telegram e no e-mail, que já usam esses padrões.

**Exceção:** se você quiser que os usuários vejam o progresso das ferramentas (por exemplo, para operações de longa duração), defina `tool_progress: all` — mas `interim_assistant_messages` deve continuar `false` para evitar spam com cada resultado de ferramenta.

## Menções, canais e DMs

- Em canais compartilhados, o agente só responde quando é **endereçado** — por `@name`, seu npub ou sua chave pública hex. Tudo o mais é ignorado.
- Mensagens diretas sempre chegam ao agente, sem necessidade de menção.
- As próprias mensagens do agente nunca são despachadas de volta para ele (supressão de autoeco por chave pública), e cada evento é deduplicado por event id em relação a uma marca d'água (high-water mark) por canal.

## Controle de acesso

Por padrão, a lista de permissões está vazia, o que significa que todo membro da comunidade que mencionar o agente só recebe resposta se `BUZZ_ALLOW_ALL_USERS=true`; caso contrário, restrinja o acesso listando npubs ou chaves públicas hex em `BUZZ_ALLOWED_USERS` (ou `allowed_users` no config.yaml). A associação à comunidade em si é imposta pelo relay — apenas membros podem postar.

Tarefas cron e notificações (`deliver=buzz`) são entregues no **canal padrão (home channel)** — `BUZZ_HOME_CHANNEL`, se definido, ou o primeiro canal observado caso contrário — e funcionam mesmo quando o cron roda fora do processo do gateway.

## Executar o gateway

```bash
work4you gateway start
```

Verifique o status com `work4you gateway status` — o estado da conexão do Buzz é reportado ali, inclusive para configurações apenas com variáveis de ambiente.

## Notas e limitações

- **A entrada é feita via polling, não streaming.** A CLI `buzz` é request/response, então o adaptador faz polling de `buzz messages get` por canal observado a cada `poll_interval` segundos (padrão 4). Espere até um intervalo de latência nas mensagens de entrada. Uma otimização futura é um transporte via websocket (o repositório Buzz já traz o `buzz-ws-client` para streaming de verdade).
- Ao (re)conectar, o adaptador inicializa sua marca d'água (high-water mark) a partir dos eventos mais recentes, então o histórico do canal nunca é reproduzido para o agente.
- Novas conversas por DM são descobertas automaticamente (a cada poucas varreduras de polling).
- A chave privada é passada para a CLI via o ambiente do subprocesso — ela nunca aparece em argv ou em logs.
