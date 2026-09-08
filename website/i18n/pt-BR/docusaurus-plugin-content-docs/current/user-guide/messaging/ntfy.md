# ntfy

O [ntfy](https://ntfy.sh/) é um serviço simples de notificações pub-sub baseado em HTTP. Funciona com o servidor público gratuito em `ntfy.sh` ou qualquer instância auto-hospedada, e suporta qualquer cliente capaz de fazer requisições HTTP — telefones, navegadores, scripts, relógios.

O ntfy é um ótimo canal push leve para o Work4You: inscreva-se em um tópico pelo [app móvel do ntfy](https://ntfy.sh/docs/subscribe/phone/), envie mensagens ao tópico para falar com o agente e receba a resposta de volta no seu telefone.

> Execute `work4you gateway setup` e escolha **ntfy** para um passo a passo guiado.

## Pré-requisitos

- Um nome de tópico (qualquer string única — `work4you-myname-2026` funciona bem)
- O [app móvel do ntfy](https://ntfy.sh/docs/subscribe/phone/) instalado e inscrito nesse tópico
- Opcional: um servidor ntfy auto-hospedado, ou um token de conta `ntfy.sh` para tópicos privados/reservados

É só isso. Sem SDK, sem daemon, sem Node.js. O adaptador usa `httpx`, que já é uma dependência do Work4You.

## Configurar o Work4You

### Via assistente de configuração

```bash
work4you gateway setup
```

Selecione **ntfy** e siga as instruções.

### Via variáveis de ambiente

Adicione o seguinte em `~/.work4you/.env`:

```
NTFY_TOPIC=work4you-myname-2026
NTFY_ALLOWED_USERS=work4you-myname-2026
NTFY_HOME_CHANNEL=work4you-myname-2026
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NTFY_TOPIC` | Sim | Tópico a ser assinado (mensagens de entrada) |
| `NTFY_SERVER_URL` | Opcional | URL do servidor (padrão: `https://ntfy.sh`) — aponte para um ntfy auto-hospedado por privacidade |
| `NTFY_TOKEN` | Opcional | Token bearer (ex.: `tk_xyz`) ou `user:pass` para autenticação Basic |
| `NTFY_PUBLISH_TOPIC` | Opcional | Tópico diferente para respostas de saída (padrão: `NTFY_TOPIC`) |
| `NTFY_MARKDOWN` | Opcional | Defina `true` para enviar respostas com o header `X-Markdown: true` |
| `NTFY_ALLOWED_USERS` | Recomendada | Nomes de tópico permitidos, separados por vírgula (tratados como IDs de usuário; veja abaixo) |
| `NTFY_ALLOW_ALL_USERS` | Opcional | Defina `true` para permitir todo publicador — seguro apenas em tópicos privados com tokens de leitura |
| `NTFY_HOME_CHANNEL` | Opcional | Tópico padrão para entrega de cron / notificações |
| `NTFY_HOME_CHANNEL_NAME` | Opcional | Rótulo legível para o canal padrão |

## Modelo de identidade — leia antes de implantar

O ntfy não possui identidade de usuário autenticada nativa. O campo `title` de uma mensagem publicada é **controlado pelo publicador** e pode ser qualquer coisa que o remetente queira. O adaptador do Work4You NÃO usa `title` para autorização — isso permitiria que qualquer publicador que conhecesse o tópico se passasse por um usuário permitido.

Em vez disso, **o próprio nome do tópico é a identidade**. Toda mensagem publicada no tópico é tratada como vinda do mesmo usuário lógico (o tópico). Por isso, `NTFY_ALLOWED_USERS` normalmente é apenas o próprio nome do tópico — uma lista de permissões de uma única entrada que controla o acesso a todo o canal.

Isso significa que **qualquer pessoa que conheça o tópico pode falar com o agente**. Para transformar isso em uma fronteira de confiança real:

- **Auto-hospede o ntfy** e restrinja o tópico com [Controle de Acesso](https://docs.ntfy.sh/config/#access-control). Somente clientes autorizados com o token de leitura/escrita podem publicar.
- Ou **use um tópico privado no ntfy.sh** ([tópicos reservados](https://docs.ntfy.sh/publish/#reserved-topics) exigem uma conta) e proteja-o com um `NTFY_TOKEN`.
- Ou **escolha um nome de tópico longo e impossível de adivinhar** (`work4you-7d4f9c8b-2026`) e trate-o como o segredo compartilhado. Esta é a configuração mais leve, mas o nome do tópico pode vazar por meio de logs ou capturas de tela.

Em todos os casos, não passe dados sensíveis pelo ntfy a menos que o tópico subjacente tenha controle de acesso.

## Início rápido — fale com seu agente pelo telefone

1. Escolha um nome de tópico: `work4you-myname-2026`
2. No seu telefone: instale o [app ntfy](https://ntfy.sh/docs/subscribe/phone/), toque em **+**, digite `work4you-myname-2026`
3. No host:
   ```bash
   echo 'NTFY_TOPIC=work4you-myname-2026' >> ~/.work4you/.env
   echo 'NTFY_ALLOWED_USERS=work4you-myname-2026' >> ~/.work4you/.env
   work4you gateway restart
   ```
4. No app ntfy, envie uma mensagem para o tópico. A resposta do agente chega como notificação push.

## Usando o ntfy com tarefas cron

Depois de definir `NTFY_HOME_CHANNEL`, as tarefas cron podem entregar para o ntfy:

```python
cronjob(
    action="create",
    schedule="every 1h",
    deliver="ntfy",          # uses NTFY_HOME_CHANNEL
    prompt="Check for alerts and summarise."
)
```

Ou direcione um tópico específico explicitamente via o campo `deliver:` da tarefa cron, ou a partir de um script shell com a [CLI `work4you send`](/guides/pipe-script-output):

```bash
work4you send ntfy:alerts-channel "Done!"
```

Isso funciona mesmo quando o cron roda fora do processo do gateway — o plugin registra uma `standalone_sender_fn` que abre sua própria conexão HTTP.

## Auto-hospedando o ntfy

Se você quiser controle total:

```bash
# Docker
docker run -p 80:80 -it binwiederhier/ntfy serve

# Native
go install heckel.io/ntfy/v2@latest
ntfy serve
```

Depois aponte o Work4You para ele:

```
NTFY_SERVER_URL=https://ntfy.mydomain.com
NTFY_TOPIC=work4you
NTFY_TOKEN=tk_abc123  # if you've set up access control
```

Auto-hospedar oferece controle de acesso por tópico, políticas de persistência de mensagens, anexos e tags de emoji. Veja a [documentação do servidor ntfy](https://docs.ntfy.sh/install/).

## Formatação markdown

Os clientes do ntfy renderizam markdown quando o publicador define o header `X-Markdown: true`. Para habilitar nas respostas de saída do Work4You:

```
NTFY_MARKDOWN=true
```

Ou em `config.yaml`:

```yaml
platforms:
  ntfy:
    extra:
      markdown: true
```

O app móvel suporta um subconjunto do CommonMark — negrito, itálico, listas, links, blocos de código cercados. Veja a [documentação de markdown do ntfy](https://docs.ntfy.sh/publish/#markdown-formatting) para o conjunto exato.

## Configuração apenas de saída (notificações sem entrada)

Se você quiser apenas que o Work4You *empurre* notificações para o ntfy (resumos de cron, alertas) e nunca aceite mensagens de volta, defina `NTFY_TOPIC` e `NTFY_PUBLISH_TOPIC` com o mesmo valor e omita completamente `NTFY_ALLOWED_USERS`. Sem lista de permissões, o agente nunca responde a mensagens de entrada — seu telefone recebe os pushes, mas a conversa é de mão única.

## Limites

- **Tamanho da mensagem**: o ntfy limita o corpo das mensagens a 4096 caracteres. O Work4You trunca com um aviso quando esse limite é excedido.
- **Sem indicadores de digitação**: o protocolo não expõe um; `send_typing` é uma operação nula (no-op).
- **Sem threads ou anexos**: o ntfy é apenas notificações push simples. Respostas longas permanecem no corpo da mensagem, sem distribuição em thread.
- **Sem identidade de usuário nativa**: veja a seção de modelo de identidade acima.

## Solução de problemas

**Falha de autenticação / 401** — `NTFY_TOKEN` está errado, ou o token não tem permissões de publicação/assinatura nesse tópico. O adaptador interrompe seu loop de reconexão em caso de 401, e o status do runtime do gateway mostrará `fatal: ntfy_unauthorized`. Corrija o token e reinicie o gateway.

**Tópico não encontrado / 404** — `NTFY_TOPIC` não existe no servidor configurado. No ntfy.sh, os tópicos são criados automaticamente na primeira publicação, então um 404 significa que você está apontando para um servidor auto-hospedado que não tem o tópico provisionado. O adaptador interrompe seu loop de reconexão com `fatal: ntfy_topic_not_found`.

**Conectado mas sem mensagens** — Verifique se `NTFY_ALLOWED_USERS` inclui o próprio nome do tópico. No modelo de identidade do ntfy, o tópico É o usuário; deixar a lista de permissões vazia rejeita tudo.

**Reconecta a cada 60s** — O padrão de keepalive do stream é 55s; o ntfy pode ter problemas de rede intermitentes. O adaptador aplica backoff exponencial (2 → 5 → 10 → 30 → 60s) e reinicia para 0 assim que um stream permanece ativo por ≥60s.
