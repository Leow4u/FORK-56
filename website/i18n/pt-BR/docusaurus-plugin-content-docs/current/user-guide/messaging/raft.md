---
sidebar_position: 19
title: "Raft"
description: "Conecte o Work4You ao Raft como um agente externo via ponte de canal de despertar (wake-channel bridge)"
---

# Configuração do Raft

O Work4You se conecta ao [Raft](https://raft.build) como um agente externo por meio de uma ponte local de canal de despertar (wake-channel bridge). O adaptador inicia um endpoint HTTP loopback que recebe sinais de despertar sem conteúdo (content-free) vindos da ponte, e então os injeta no pipeline de sessão do gateway do Work4You. O agente lê e envia mensagens através da CLI do Raft — o adaptador nunca toca no corpo das mensagens ou nos cursores de entrega.

:::info Divisão de responsabilidades
- **A ponte** é responsável por: consumo dos sinais de despertar, deduplicação, backoff, reconexão, entrega pelo menos uma vez (at-least-once) e registro de prova (proof logging).
- **O adaptador Work4You** é responsável por: um endpoint de despertar em localhost e pela injeção de um aviso curto no contexto do agente.
- **O agente** é responsável por: buscar mensagens (`raft message check`), responder (`raft message send`) e todas as demais interações com o Raft via CLI.

O adaptador não guarda nenhuma credencial do Raft — apenas um token compartilhado por sessão para autenticação local (localhost) entre a ponte e o endpoint.
:::

---

## Pré-requisitos

- Um **workspace do Raft** onde você possa criar um Agente Externo
- A **CLI do Raft** instalada e autenticada nesse perfil de Agente Externo
- **aiohttp** — pacote Python (incluído nos extras `[all]` do Work4You)

No Raft, abra o menu Agents, crie um Agente Externo e siga o cartão de configuração para instalar a CLI do Raft e autenticar o perfil do agente. Depois que o agente for criado, o Raft mostra um guia de configuração do Work4You com as variáveis de ambiente e a configuração necessárias para iniciar o gateway.

---

## Configuração

Adicione ao `~/.work4you/.env`:

```bash
RAFT_PROFILE=your-agent-profile
```

Pronto — o adaptador se ativa automaticamente quando `RAFT_PROFILE` está definido. Ele gera um token de ponte por sessão, escolhe uma porta efêmera e inicia o processo filho da ponte automaticamente quando o gateway sobe.

---

## Como funciona

```
Raft Server → Bridge (wake-hints SSE) → POST /wake → Work4You Adapter → Agent context
Agent → raft message check → Raft Server (message bodies)
Agent → raft message send → Raft Server (replies)
```

1. O servidor Raft envia sinais de despertar para o processo da ponte via SSE.
2. A ponte encaminha cada sinal como um `POST /wake` para o endpoint loopback do adaptador.
3. O adaptador valida o token da ponte, verifica se o payload está livre de conteúdo e injeta um aviso de despertar na sessão do Work4You.
4. O agente vê o aviso de despertar e usa a CLI do Raft para ler mensagens e responder.

Os payloads de despertar são **livres de conteúdo por contrato** — eles carregam metadados (ID do evento, ID da mensagem, timestamps), mas nunca o corpo das mensagens, nomes de canais ou identidades de remetentes. O adaptador rejeita qualquer payload que contenha campos com formato de conteúdo (`text`, `body`, `content`, `messages`, etc.).

---

## Bridge

O adaptador inicia automaticamente `raft agent bridge` como processo filho, passando a URL do endpoint e o token. A ponte se conecta ao servidor Raft usando o perfil configurado e começa a encaminhar sinais de despertar. Ela é encerrada quando o gateway é desligado.

---

## Variáveis de ambiente

| Variável | Descrição | Padrão |
|----------|-------------|---------|
| `RAFT_PROFILE` | Slug do perfil de agente do Raft — ativa o adaptador automaticamente quando definido | _(obrigatório)_ |
