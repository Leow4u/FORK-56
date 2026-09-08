---
sidebar_position: 9
title: "Importar de Outros Agentes"
description: "Importação com um único comando de uma configuração do Claude Code (~/.claude) ou do OpenAI Codex CLI (~/.codex) para o Work4You — instruções, allowlists, servidores MCP, skills e memórias."
---

# Importar de Outros Agentes

`work4you import-agent` importa sua configuração existente do **Claude Code** ou do **OpenAI Codex CLI** para o Work4You com um único comando. Ele segue o mesmo padrão de pré-visualização primeiro usado em [`work4you claw migrate`](../guides/migrate-from-openclaw.md): você sempre vê um plano item a item antes de qualquer gravação, e `--dry-run` nunca toca no disco.

```bash
work4you import-agent                    # auto-detect ~/.claude or ~/.codex
work4you import-agent claude-code        # import from ~/.claude
work4you import-agent codex              # import from ~/.codex
work4you import-agent claude-code --dry-run          # preview only
work4you import-agent codex --source /path/to/.codex # custom location
work4you import-agent claude-code --overwrite --yes  # replace conflicts, skip prompts
```

## O que é importado

### Claude Code (`~/.claude`)

| Claude Code | Work4You |
|---|---|
| `CLAUDE.md` (instruções globais) | Entradas de memória em `~/.work4you/memories/MEMORY.md` |
| `settings.json` → `permissions.allow` (regras `Bash(...)`) | `command_allowlist` em `config.yaml` |
| `settings.json` → `permissions.deny` (regras `Bash(...)`) | `approvals.deny` em `config.yaml` |
| `mcpServers` (de `~/.claude.json` e `settings.json`) | `mcp_servers` em `config.yaml` |
| `skills/<name>/` (diretórios com `SKILL.md`) | `~/.work4you/skills/claude-code-imports/<name>/` |
| `commands/*.md` (slash commands) | Ignorado, com uma observação — converta-os em skills |

As regras de prefixo `Bash(npm run test:*)` do Claude se tornam globs `npm run test*`. Regras de permissão que não são `Bash` (`Read(...)`, `WebFetch`, ...) controlam ferramentas específicas do Claude e são reportadas como não mapeadas em vez de importadas.

### Codex CLI (`~/.codex`)

| Codex CLI | Work4You |
|---|---|
| `AGENTS.md` (instruções globais) | Entradas de memória em `~/.work4you/memories/MEMORY.md` |
| `config.toml` → `[mcp_servers.*]` | `mcp_servers` em `config.yaml` |
| `memories/*.md` | Entradas de memória em `~/.work4you/memories/MEMORY.md` |
| `skills/<name>/` (diretórios com `SKILL.md`) | `~/.work4you/skills/codex-imports/<name>/` |

## O que nunca é importado

**Chaves de API e credenciais.** Arquivos de credenciais (`~/.claude/.credentials.json`, `~/.codex/auth.json`) nunca são lidos, e variáveis de ambiente ou cabeçalhos de servidores MCP com nomes que parecem secretos (`*_TOKEN`, `*_API_KEY`, `Authorization`, ...) são removidos e listados no relatório, para que você possa readicioná-los deliberadamente. Execute `work4you setup` para configurar provedores, ou adicione segredos a `~/.work4you/.env`.

## Notas de comportamento

- **Pré-visualização sempre primeiro.** O comando imprime o plano completo antes de aplicá-lo; em sessões não interativas, ele para na pré-visualização a menos que você passe `--yes`.
- **Faz merge, não substitui.** As entradas de memória são deduplicadas em relação ao seu `MEMORY.md` existente; os padrões de allowlist/denylist são mesclados com o que já está em `config.yaml`.
- **Conflitos são ignorados por padrão.** Um servidor MCP ou skill que já existe no Work4You é reportado como conflito; passe `--overwrite` para substituí-lo.
- **Arquivos malformados não abortam a execução.** Um `settings.json` ou `config.toml` corrompido se torna um erro por item no relatório, enquanto tudo o mais continua sendo importado.
- Vindo do OpenClaw em vez disso? Use [`work4you claw migrate`](../guides/migrate-from-openclaw.md).
