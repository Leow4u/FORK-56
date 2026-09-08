---
sidebar_position: 23
title: "Microsoft Graph Webhook Listener"
description: "Receba notificações de mudança do Microsoft Graph (reuniões, calendário, chat, etc.) no Work4You"
---

# Microsoft Graph Webhook Listener

A plataforma de gateway `msgraph_webhook` é um listener de eventos de entrada. É assim que o Work4You recebe **notificações de mudança** do Microsoft Graph — "uma reunião do Teams terminou", "uma nova mensagem chegou neste chat", "este evento de calendário foi atualizado". É diferente da plataforma `teams` (que é um bot de chat com o qual os usuários digitam) — esta aqui é o M365 avisando o Work4You que algo aconteceu, não uma pessoa.

No momento, o principal consumidor é o pipeline de resumo de reuniões do Teams: o Graph notifica quando uma reunião gera uma transcrição, o pipeline a busca, e o Work4You posta um resumo de volta no Teams. Outros recursos do Graph (`/chats/.../messages`, `/users/.../events`) usam o mesmo listener — os consumidores de pipeline chegam em seus próprios PRs.

## Pré-requisitos

- Credenciais de aplicação do Microsoft Graph — [Registre uma aplicação do Microsoft Graph](/guides/microsoft-graph-app-registration)
- Uma **URL HTTPS pública** que o Microsoft Graph consiga alcançar (o Graph não chama endpoints privados). Um dev tunnel funciona para testes; produção precisa de um domínio real com certificado válido.
- Um segredo compartilhado forte para usar como valor de `clientState`. Gere com `openssl rand -hex 32` e coloque em `~/.work4you/.env` como `MSGRAPH_WEBHOOK_CLIENT_STATE`.

## Início rápido

`~/.work4you/config.yaml` mínimo:

```yaml
platforms:
  msgraph_webhook:
    enabled: true
    extra:
      host: 127.0.0.1
      port: 8646
      client_state: "replace-with-a-strong-secret"
      accepted_resources:
        - "communications/onlineMeetings"
```

Ou via variáveis de ambiente em `~/.work4you/.env` (mescladas automaticamente na inicialização):

```bash
MSGRAPH_WEBHOOK_ENABLED=true
MSGRAPH_WEBHOOK_PORT=8646
MSGRAPH_WEBHOOK_CLIENT_STATE=<generate-with-openssl-rand-hex-32>
MSGRAPH_WEBHOOK_ACCEPTED_RESOURCES=communications/onlineMeetings
```

`MSGRAPH_WEBHOOK_HOST` (e as demais variáveis `MSGRAPH_WEBHOOK_*`) são mescladas em `extra` na inicialização do gateway. Loopback (`127.0.0.1`) é a configuração segura para túnel/proxy; um bind de rede exige `MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS`.

Inicie o gateway: `work4you gateway run`. O listener expõe:

- `POST /msgraph/webhook` — notificações de mudança do Graph
- `GET /msgraph/webhook?validationToken=...` — handshake de validação de assinatura do Graph
- `GET /health` — probe de prontidão com contadores de aceitos/duplicados

Exponha o listener publicamente (reverse proxy, dev tunnel, ingress). Sua URL de notificação para assinaturas do Graph é sua origem HTTPS pública seguida de `/msgraph/webhook`:

```
https://ops.example.com/msgraph/webhook
```

## Configuração

Todas as configurações ficam sob `platforms.msgraph_webhook.extra`:

| Configuração | Padrão | Descrição |
|---------|---------|-------------|
| `host` | não definido (dual-stack: todas as interfaces, IPv4+IPv6) | Endereço de bind para o listener HTTP. Binds não-loopback exigem `allowed_source_cidrs`; loopback (`127.0.0.1` / `::1`) é a configuração mais simples para dev tunnel / reverse proxy. |
| `port` | `8646` | Porta de bind. |
| `webhook_path` | `/msgraph/webhook` | Caminho de URL para onde o Graph envia o POST. |
| `health_path` | `/health` | Endpoint de prontidão. |
| `client_state` | — | Segredo compartilhado que o Graph ecoa em cada notificação. Comparado com `hmac.compare_digest` — gere com `openssl rand -hex 32`. |
| `accepted_resources` | `[]` (aceita tudo) | Lista de permissões de caminhos/padrões de recursos do Graph. Um `*` no final atua como correspondência de prefixo. Uma `/` no início é tolerada. Exemplo: `["communications/onlineMeetings", "chats/*/messages"]`. |
| `max_seen_receipts` | `5000` | Tamanho do cache de deduplicação para IDs de notificação. As entradas mais antigas são removidas quando o limite é atingido. |
| `allowed_source_cidrs` | `[]` | Obrigatório para binds não-loopback. Deixe vazio apenas quando o listener estiver vinculado a loopback e atrás de um túnel local / reverse proxy. |

A maioria das configurações também tem uma variável de ambiente equivalente (`MSGRAPH_WEBHOOK_*`, incluindo `MSGRAPH_WEBHOOK_HOST`) que é mesclada na configuração na inicialização do gateway — veja a [referência de variáveis de ambiente](/reference/environment-variables#microsoft-graph-teams-meetings).

## Reforço de segurança

### clientState é a verificação de autenticação primária

Toda notificação do Graph inclui a string `clientState` que sua assinatura registrou. O listener rejeita qualquer notificação cujo `clientState` não corresponda, usando comparação segura contra timing attacks. Este é o mecanismo documentado pela Microsoft — trate o valor como um segredo compartilhado forte.

Se `client_state` não estiver definido, o listener se recusa a iniciar.

### Lista de permissões de IP de origem (implantações de produção)

Para produção, restrinja o listener aos intervalos de IP de origem de webhook do Graph publicados pela Microsoft. A Microsoft documenta os intervalos de saída no [serviço Office 365 IP Address and URL Web service](https://learn.microsoft.com/en-us/microsoft-365/enterprise/urls-and-ip-address-ranges). Configure-os assim:

```yaml
platforms:
  msgraph_webhook:
    enabled: true
    extra:
      host: 0.0.0.0
      client_state: "..."
      allowed_source_cidrs:
        - "52.96.0.0/14"
        - "52.104.0.0/14"
        # ...add the current Microsoft 365 "Common" + "Teams" category egress ranges
```

Ou como variável de ambiente:

```bash
MSGRAPH_WEBHOOK_ALLOWED_SOURCE_CIDRS="52.96.0.0/14,52.104.0.0/14"
```

Fazer bind em um host não-loopback como `0.0.0.0`, `::` ou um IP de LAN sem `allowed_source_cidrs` é recusado na inicialização. Se você estiver usando um dev tunnel ou reverse proxy na mesma máquina, vincule o Work4You a `127.0.0.1` ou `::1` e deixe a lista de permissões vazia nesse caso. Strings de CIDR inválidas geram um aviso de log e são ignoradas. **Revise a lista de IPs da Microsoft trimestralmente** — ela muda.

### Terminação HTTPS

O listener fala HTTP puro. Termine o TLS no seu reverse proxy (Caddy, Nginx, Cloudflare Tunnel, AWS ALB) e faça proxy para o listener pela rede local. O Graph se recusa a entregar para endpoints não-HTTPS, então não existe caminho para tráfego não criptografado chegar até você vindo do próprio Graph.

### Higiene de resposta

Em caso de sucesso, o listener retorna `202 Accepted` com corpo vazio — os contadores internos ficam fora da resposta de rede. Operadores podem observar as contagens via `/health`, que é protegido pelas mesmas regras de IP de origem que o caminho do webhook.

Tabela de códigos de status:

| Resultado | Status |
|---------|--------|
| Notificação(ões) aceita(s) ou deduplicada(s) | 202 |
| Handshake de validação (GET com `validationToken`) | 200 (ecoa o token) |
| Todos os itens do lote falharam no clientState | 403 |
| JSON malformado / array `value` ausente / recurso desconhecido | 400 |
| IP de origem fora da lista de permissões | 403 |
| GET simples sem `validationToken` | 400 |

## Solução de problemas

| Problema | O que verificar |
|---------|---------------|
| A validação da assinatura do Graph falha | A URL pública está acessível, o caminho `/msgraph/webhook` corresponde, o GET com `validationToken` ecoa o token literalmente como `text/plain` dentro de 10 segundos. |
| Notificações chegam via POST mas nada é ingerido | `client_state` corresponde ao valor usado ao registrar a assinatura. Execute `openssl rand -hex 32` novamente e crie uma nova assinatura se o valor tiver mudado. Verifique se `accepted_resources` inclui o caminho de recurso que o Graph está enviando. |
| Toda notificação retorna 403 | Incompatibilidade de `clientState` (forjado, ou assinatura registrada com um valor diferente). Recrie a assinatura com `work4you teams-pipeline subscribe --client-state "$MSGRAPH_WEBHOOK_CLIENT_STATE" ...` (disponível a partir do PR de runtime do pipeline). |
| O listener se recusa a iniciar em `0.0.0.0` | Defina `allowed_source_cidrs` com os intervalos de saída de webhook atuais da Microsoft, ou vincule o Work4You a `127.0.0.1` / `::1` atrás do seu túnel ou reverse proxy. |
| O listener inicia mas `curl http://localhost:8646/health` trava | Colisão de bind de porta. Verifique `ss -tlnp \| grep 8646` e altere `port:` se necessário. |
| Requisições reais do Graph vindas da Microsoft retornam 403 | A lista de permissões de IP de origem está estreita demais. Amplie a lista para incluir os intervalos de saída atuais da Microsoft. Se você ainda estiver validando o caminho do túnel, vincule o Work4You a loopback e deixe o túnel cuidar da exposição pública. |

## Documentos relacionados

- [Registre uma aplicação do Microsoft Graph](/guides/microsoft-graph-app-registration) — pré-requisito de registro de app no Azure
- [Variáveis de ambiente → Microsoft Graph](/reference/environment-variables#microsoft-graph-teams-meetings) — lista completa de variáveis de ambiente
- [Configuração do bot do Microsoft Teams](/user-guide/messaging/teams) — a plataforma diferente que permite aos usuários conversarem com o Work4You no Teams
