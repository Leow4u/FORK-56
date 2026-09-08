---
sidebar_position: 2.5
title: "Suporte de Plataforma"
description: "Quais sistemas operacionais, métodos de distribuição e recursos o Work4You suporta."
---

# Suporte de Plataforma

O Work4You mantém suporte para muitas plataformas e métodos de distribuição, mas não conseguimos suportar todos os métodos de instalação possíveis.

---

## Nível 1

Nos esforçamos para nunca quebrar instalações e atualizações nestas plataformas. Problemas e regressões no Nível 1 são nossa prioridade máxima e têm precedência sobre outras plataformas.

| SO / Arquitetura                                                             | Métodos de instalação                                                                                                           | Notas                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **macOS** (Apple Silicon)                                                     | [Work4You Desktop](https://work4you.ai/), [`install.sh`](./installation.md#linux--macos--wsl2--android-termux) |
| [**Windows 10 / 11**](../user-guide/windows-native.md) (x86_64, aarch64)      | [Work4You Desktop](https://work4you.ai/), [`install.ps1`](./installation.md#windows-native)                    | Alguns recursos [não estão disponíveis](../user-guide/windows-native.md#feature-matrix).                                                                       |
| **Linux / [WSL2](../user-guide/windows-wsl-quickstart.md)** (x86_64, aarch64) | [`install.sh`](./installation.md#linux--macos--wsl2--android-termux)                                                           | Testamos no Ubuntu mais recente e no WSL2. Se a sua distro tem glibc, systemd, e segue o Filesystem Hierarchy Standard, é provável que funcione bem. |
| [**Contêiner Docker**](../user-guide/docker.md#quick-start) (x86_64, aarch64) | [`docker pull`](../user-guide/docker.md#quick-start)                                                                           | Instalações via Docker não suportam `work4you update`. A atualização é feita executando uma nova imagem.                                                                  |

---

## Nível 2

Estas plataformas são mantidas no repositório apenas em regime de melhor esforço.
Releases podem quebrá-las, e não podemos prometer que vamos corrigi-las rapidamente quando isso acontecer.

PRs serão aceitos para corrigir problemas nelas, mas terão prioridade menor do que corrigir problemas em plataformas de Nível 1.

| SO / Arquitetura              | Métodos de instalação                                                 | Notas                                                                        |
| ------------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Android (Termux)** (aarch64) | [`install.sh`](./installation.md#linux--macos--wsl2--android-termux) | Alguns recursos [não estão disponíveis](./termux.md#known-limitations-on-phones). |
| **Nix** (MacOS, Linux, NixOS)  | [`install.sh`](./nix-setup.md)                                       | Quebra com frequência por causa das dores de cabeça do empacotamento do node.js. Boa sorte~! &lt;3             |

## Não Suportado

Estas plataformas e métodos de distribuição **não** são suportados.
Sugerimos que você migre para um método de distribuição ou plataforma suportado.
Eles podem estar quebrados agora, e podem quebrar ainda mais no futuro.
PRs para corrigi-los _não_ serão aceitos, e qualquer código que mantenha compatibilidade com eles pode ser removido a qualquer momento.

- instalações via AUR (podemos fazer upstream de patches se isso ajudar &lt;3)
- macOS em processadores x86 (Intel)
- instalações via `pypi` (por exemplo, `uv tool install work4you`, `pip install work4you`, etc.)
- instalações via `brew` (`brew install work4you`)

Se você está usando um método de distribuição não suportado, leia o [guia de instalação](./installation.md) para aprender como migrar para um método suportado.
