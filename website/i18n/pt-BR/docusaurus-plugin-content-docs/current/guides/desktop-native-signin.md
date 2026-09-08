---
sidebar_position: 18
title: "Login Nativo no Desktop (RFC 8252)"
description: "Como o app Work4You Desktop faz login em um gateway protegido usando o navegador do sistema e PKCE — sem webview incorporado, sem cookies de sessão"
---

# Login Nativo no Desktop (RFC 8252)

Quando o app Work4You Desktop se conecta a um **gateway protegido** (um
dashboard hospedado ou auto-hospedado que fica atrás de um provedor OAuth),
ele pode fazer login de duas formas:

1. **Login nativo (RFC 8252)** — o app abre seu **navegador de sistema real**,
   você aprova no navegador em que já confia, e o app recebe tokens que
   armazena no keychain do seu sistema operacional. **Sem webview incorporado, sem
   cookies de sessão do navegador.** Este é o padrão sempre que o gateway
   suporta.
2. **Login incorporado (fallback legado)** — o app abre uma pequena janela de
   navegador dentro do próprio app e captura o cookie de sessão do gateway.
   Usado automaticamente quando o gateway é uma versão mais antiga que não
   anuncia login nativo.

Você não escolhe entre essas opções — o app detecta o que o gateway suporta e
escolhe a melhor. Esta página explica o que acontece e por quê.

## Por que login nativo

Incorporar um navegador dentro de um app nativo para OAuth tem desvantagens
bem conhecidas: a página de login não consegue ver sua sessão de navegador
existente (então você digita credenciais novamente e refaz o MFA), gerenciadores
de senha e passkeys geralmente não funcionam, e o app depende de ler um cookie
de sessão de dentro de um webview privado. A RFC 8252 ("OAuth 2.0 for Native
Apps") é a melhor prática do setor que evita tudo isso: **faça a autorização
no navegador do sistema e entregue ao app seus próprios tokens.**

Especificamente para o Work4You, o login nativo significa:

- **Sem webview incorporado.** A autorização acontece no Safari / Chrome /
  Firefox / Edge — o que você usar — com seus logins, extensões e passkeys
  intactos.
- **Sem cookies de sessão.** O app mantém um **access token** OAuth (de vida
  curta) e um **refresh token**, criptografados em repouso via o keychain do
  seu sistema operacional (`safeStorage` do Electron). Chamadas REST e tickets
  de WebSocket são autenticados com um cabeçalho `Authorization: Bearer`, não
  com um repositório de cookies.

## Como funciona

```
Desktop app                Gateway (/auth/native/*)          Work4You Portal (IDP)
   │ 1. open loopback 127.0.0.1:<random port>
   │ 2. system browser ─►  /auth/native/authorize
   │    (PKCE challenge)    (starts the normal PKCE login) ─► /oauth/authorize
   │                        ◄──── code ──── /auth/callback ◄──┘
   │                        3. mint one-time gateway code
   │ ◄─ 302 127.0.0.1/cb?code=… ─┘
   │ 4. POST /auth/native/token (code + PKCE verifier)
   │ ◄─ 5. { access_token, refresh_token, expires_at } ───────┘
   │ 6. store in OS keychain; use Bearer for REST + WS tickets
```

O gateway **intermedeia** o fluxo: ele é o servidor de autorização *para o app
desktop* e um cliente OAuth *para o provedor de identidade upstream* (Work4You
Portal). Isso é necessário porque o `client_id` upstream e as URIs de redirecionamento
permitidas estão vinculadas à própria origem do gateway — um app desktop não
pode ser um cliente direto do Portal. O desktop ainda obtém a experiência
completa da RFC 8252: seu próprio par PKCE, seu próprio redirecionamento
loopback, e tokens que ele mesmo possui.

**PKCE (RFC 7636)** protege a etapa de loopback: o código único do gateway é
inútil sem o verificador de código, que nunca sai do app. O código é de uso
único e vida curta.

## Detecção de capacidade e fallback

O desktop lê o endpoint público `/api/status` do gateway, que anuncia um
array `auth_flows`:

| Valor de `auth_flows` | Significado |
|--------------------|---------|
| `["cookie", "native_pkce"]` | O gateway suporta login nativo → o app o utiliza |
| `["cookie"]` | O gateway suporta apenas o fluxo legado → o app usa o webview incorporado |
| *(campo ausente)* | Gateway mais antigo → o app usa o webview incorporado |

Se o login nativo é anunciado mas falha por um motivo local — por exemplo, uma
ferramenta de segurança bloqueia o listener de loopback, ou você fecha a aba
do navegador — o app **volta automaticamente para o fluxo incorporado** para
que você ainda consiga fazer login.

## Ciclo de vida do token

- **Access token**: vida curta (minutos). Enviado como `Authorization: Bearer`
  em toda chamada REST e ao emitir um ticket de WebSocket.
- **Refresh token**: vida mais longa, rotativo. Quando o access token está
  próximo de expirar, o app chama `/auth/native/refresh` para rotacionar
  ambos os tokens, depois atualiza o keychain.
- **Expiração terminal**: se o refresh token estiver morto (expirado /
  revogado / reuso detectado), o app limpa seus tokens armazenados e solicita
  um novo login.
- **Logout**: limpa tanto os tokens nativos (keychain) quanto qualquer cookie
  de sessão legado para aquele gateway.

## Para operadores de gateway

O login nativo está disponível automaticamente em qualquer gateway protegido
com um provedor de sessão interativa registrado. Nenhuma configuração é
necessária — as rotas `/auth/native/*` e o anúncio de `auth_flows` fazem
parte do subsistema de autenticação do dashboard. Provedores OAuth (por
exemplo, o provedor **Work4You** empacotado) intermedeiam o redirecionamento
para o IDP upstream; provedores de senha (por exemplo, o plugin **basic-auth**
empacotado) direcionam o navegador do sistema para o formulário de
credenciais `/login` do gateway — o que permite que gerenciadores de senha do
sistema operacional (Senhas do macOS, etc.) preencham automaticamente o
formulário, algo que nenhum webview de desktop incorporado pode oferecer.
Credenciais somente-token (por exemplo, drain) não são logins interativos e
não anunciam `native_pkce`.

Os endpoints relevantes (todos públicos, de bootstrap pré-autenticação, assim
como as rotas OAuth `/auth/*` existentes):

- `GET /auth/native/authorize` — inicia o login PKCE intermediado
- `POST /auth/native/token` — troca o código de loopback + verificador por tokens
- `POST /auth/native/refresh` — rotaciona tokens a partir do refresh token do app

## Veja também

- [OAuth via SSH / Hosts Remotos](./oauth-over-ssh.md) — o padrão de
  callback via loopback para OAuth de provedor/MCP em máquinas remotas.
- [Rode o Work4You com o Work4You Portal](./run-work4you-with-work4you-portal.md)
