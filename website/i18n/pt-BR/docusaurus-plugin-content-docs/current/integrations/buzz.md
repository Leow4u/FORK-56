---
sidebar_position: 4
title: "Buzz Integration"
description: "As três formas de conectar o Work4You ao Buzz — o workspace baseado em Nostr para humanos e agentes, da Block"
---

# Buzz Integration

[Buzz](https://github.com/block/buzz) é o workspace open-source e auto-hospedável da Block, onde humanos e agentes de IA compartilham os mesmos canais. Ele é construído sobre o Nostr: cada mensagem é um evento assinado em um relay que você mesmo possui, e cada participante — humano ou agente — é um par de chaves (keypair).

O Work4You se integra ao Buzz de três formas. Escolha de acordo com onde o Work4You roda e o que você quer que ele faça:

| | ① Runtime desktop | ② Ponte de relay (ACP) | ③ Plataforma de gateway nativa |
|---|---|---|---|
| **O que é** | O Buzz Desktop inicia o Work4You localmente como um harness gerenciado | O `buzz-acp` do Buzz conecta um canal ao `work4you acp` via stdio | O gateway do Work4You entra no Buzz como uma plataforma de mensageria de primeira classe |
| **Onde o Work4You roda** | No seu desktop, iniciado pelo Buzz | Em um servidor, iniciado pelo `buzz-acp` | No seu próprio gateway, ao lado de Telegram/Discord/etc. |
| **Melhor para** | Experimentar o Work4You dentro do Buzz Desktop com configuração zero | Uma identidade de agente hospedada quando o Buzz é dono do transporte | Work4You completo: memória, skills, aprovações, cron, sessões |
| **Entrada (inbound)** | ACP via stdio | ACP via stdio (por WebSocket do relay) | WebSocket Nostr autenticado por NIP-42 (com fallback para polling) |
| **Configuração** | Descoberta automática | Variáveis de ambiente do `buzz-acp` | `work4you gateway setup` → Buzz |

## ① Runtime gerenciado do Buzz Desktop

O Buzz Desktop distribui o Work4You como um runtime pré-configurado. Com o Work4You instalado da forma normal, abra **Settings → Runtimes** e o Work4You aparece automaticamente — a descoberta resolve o launcher `work4you-acp` no seu PATH do shell de login, que o instalador grava em `~/.local/bin` (e o `work4you update` se autocorrige em instalações mais antigas).

Configuração completa, solução de problemas e a postura de segurança (o Buzz aprova automaticamente permissões de ferramentas — mantenha os agentes restritos ao proprietário): **[ACP Host Integration → Buzz Desktop](/user-guide/features/acp#buzz-desktop)**

## ② Ponte de relay (buzz-acp + ACP)

Para uma identidade Work4You hospedada que entra em *canais* do Buzz enquanto o próprio harness do Buzz é dono do transporte:

```text
Relay do Buzz <-- WebSocket --> buzz-acp <-- ACP via stdio --> Work4You
```

O Work4You iniciado usa a mesma configuração, credenciais, memória e skills que o `work4you` naquele host. Emissão de chaves, descoberta de canais, telemetria restrita ao proprietário (`BUZZ_ACP_RELAY_OBSERVER`) e orientações de permissão headless: **[ACP Host Integration → Buzz channels (relay bridge)](/user-guide/features/acp#buzz-channels-relay-bridge)**

## ③ Plataforma de gateway nativa (recomendada para o Work4You completo)

O plugin de plataforma `buzz` empacotado transforma o Buzz em uma plataforma de mensageria comum do Work4You — canais, DMs, gating por menção, respostas em thread, reações, imagens e entrega via cron (`deliver=buzz`), mantendo intactas as aprovações, a memória e o gerenciamento de sessões próprios do Work4You. A entrada chega por um WebSocket Nostr persistente autenticado por NIP-42 (assinatura BIP-340 sem dependências), com fallback automático para polling via CLI; a saída passa pela CLI `buzz`.

```bash
work4you gateway setup   # escolha Buzz
```

Referência completa de configuração (variáveis de ambiente, config.yaml, modos de transporte, controle de acesso): **[Messaging → Buzz](/user-guide/messaging/buzz)**

## Qual devo usar?

- **Só estou explorando, sou usuário do Buzz Desktop** → a opção ① funciona sem configuração.
- **Estou rodando um relay de comunidade e quero uma identidade de agente gerenciada pelo Buzz** → a opção ②.
- **Já uso o Work4You como meu agente e quero o Buzz como mais um canal** → a opção ③. Esta é a integração mais profunda e a que preserva todos os recursos do Work4You.

As opções ①/② e ③ usam identidades e transportes diferentes; execute a ③ com seu próprio par de chaves Nostr dedicado. O adaptador obtém um lock com escopo sobre o par relay+pubkey, de modo que dois perfis do Work4You não conseguem controlar acidentalmente a mesma identidade do Buzz.

## Créditos

A integração com o Buzz foi construída com a comunidade: @SHL0MS (launcher no PATH + auditoria de segurança do Desktop), @NYTEMODEONLY (documentação da ponte de relay), @rob-coco (adaptador de plataforma), @ScaleLeanChris (transporte WebSocket Nostr + assinatura NIP-42/BIP-340) e @jethac (verificação multiagente).
