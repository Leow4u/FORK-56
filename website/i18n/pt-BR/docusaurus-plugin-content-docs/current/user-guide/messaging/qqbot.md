# QQ Bot

Conecte o Work4You ao QQ via **Official QQ Bot API (v2)** — com suporte a mensagens privadas (C2C), menções @ em grupo, guild e mensagens diretas com transcrição de voz.

## Visão geral

O adaptador QQ Bot usa a [Official QQ Bot API](https://bot.q.qq.com/wiki/develop/api-v2/) para:

- Receber mensagens via uma conexão **WebSocket** persistente com o QQ Gateway
- Enviar respostas em texto e markdown via **REST API**
- Baixar e processar imagens, mensagens de voz e anexos de arquivo
- Transcrever mensagens de voz usando o ASR nativo da Tencent ou um provedor de STT configurável

## Pré-requisitos

1. **Aplicação QQ Bot** — Registre-se em [q.qq.com](https://q.qq.com):
   - Crie uma nova aplicação e anote seu **App ID** e **App Secret**
   - Habilite os intents necessários: mensagens C2C, mensagens @ em grupo, mensagens de guild
   - Configure seu bot em modo sandbox para testes, ou publique para produção

2. **Dependências** — O adaptador requer `aiohttp` e `httpx`:
   ```bash
   pip install aiohttp httpx
   ```

## Configuração

### Configuração interativa

```bash
work4you gateway setup
```

Selecione **QQ Bot** na lista de plataformas e siga as instruções.

### Configuração manual

Defina as variáveis de ambiente necessárias em `~/.work4you/.env`:

```bash
QQ_APP_ID=your-app-id
QQ_CLIENT_SECRET=your-app-secret
```

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|---|---|---|
| `QQ_APP_ID` | App ID do QQ Bot (obrigatório) | — |
| `QQ_CLIENT_SECRET` | App Secret do QQ Bot (obrigatório) | — |
| `QQBOT_HOME_CHANNEL` | OpenID para entrega de cron/notificações | — |
| `QQBOT_HOME_CHANNEL_NAME` | Nome de exibição do canal padrão | `Home` |
| `QQ_ALLOWED_USERS` | OpenIDs de usuário separados por vírgula para acesso via DM | aberto (todos os usuários) |
| `QQ_GROUP_ALLOWED_USERS` | OpenIDs de grupo separados por vírgula para acesso em grupo | — |
| `QQ_ALLOW_ALL_USERS` | Definir como `true` para permitir todas as DMs | `false` |
| `QQ_PORTAL_HOST` | Sobrescreve o host do portal QQ (defina como `sandbox.q.qq.com` para roteamento sandbox) | `q.qq.com` |
| `QQ_STT_API_KEY` | Chave de API para o provedor de voz-para-texto | — |
| `QQ_STT_BASE_URL` | (Não é lida diretamente — defina `platforms.qqbot.extra.stt.baseUrl` no `config.yaml`) | n/a |
| `QQ_STT_MODEL` | Nome do modelo de STT | `glm-asr` |

## Configuração avançada

Para um controle mais refinado, adicione configurações de plataforma em `~/.work4you/config.yaml`:

```yaml
platforms:
  qqbot:
    enabled: true
    extra:
      app_id: "your-app-id"
      client_secret: "your-secret"
      markdown_support: true       # enable QQ markdown (msg_type 2). Config-only; no env-var equivalent.
      dm_policy: "open"          # open | allowlist | disabled
      allow_from:
        - "user_openid_1"
      group_policy: "open"       # open | allowlist | disabled
      group_allow_from:
        - "group_openid_1"
      stt:
        provider: "zai"          # zai (GLM-ASR), openai (Whisper), etc.
        baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4"
        apiKey: "your-stt-key"
        model: "glm-asr"
```

## Mensagens de voz (STT)

A transcrição de voz funciona em dois estágios:

1. **ASR nativo do QQ** (gratuito, sempre tentado primeiro) — o QQ fornece `asr_refer_text` nos anexos de mensagem de voz, usando o próprio reconhecimento de fala da Tencent
2. **Provedor de STT configurado** (alternativa) — se o ASR do QQ não retornar texto, o adaptador chama uma API de STT compatível com OpenAI:

   - **Zhipu/GLM (zai)**: provedor padrão, usa o modelo `glm-asr`
   - **OpenAI Whisper**: defina `QQ_STT_BASE_URL` e `QQ_STT_MODEL`
   - Qualquer endpoint de STT compatível com OpenAI

## Solução de problemas

### O bot desconecta imediatamente (desconexão rápida)

Isso geralmente significa:
- **App ID / Secret inválidos** — verifique novamente suas credenciais em q.qq.com
- **Permissões ausentes** — garanta que o bot tenha os intents necessários habilitados
- **Bot apenas em sandbox** — se o bot estiver em modo sandbox, ele só pode receber mensagens do canal de teste sandbox do QQ

### Mensagens de voz não transcritas

1. Verifique se o `asr_refer_text` nativo do QQ está presente nos dados do anexo
2. Se estiver usando um provedor de STT personalizado, verifique se `QQ_STT_API_KEY` está definido corretamente
3. Verifique os logs do gateway em busca de mensagens de erro de STT

### Mensagens não entregues

- Verifique se os **intents** do bot estão habilitados em q.qq.com
- Verifique `QQ_ALLOWED_USERS` se o acesso via DM estiver restrito
- Para mensagens em grupo, garanta que o bot seja **mencionado com @** (a política de grupo pode exigir lista de permissões)
- Verifique `QQBOT_HOME_CHANNEL` para entrega de cron/notificações

### Erros de conexão

- Garanta que `aiohttp` e `httpx` estejam instalados: `pip install aiohttp httpx`
- Verifique a conectividade de rede com `api.sgroup.qq.com` e o gateway WebSocket
- Revise os logs do gateway para mensagens de erro detalhadas e comportamento de reconexão
