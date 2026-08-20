# Work4You CLI Reference

Live sources when anything looks stale: `work4you --help`, `work4you <command> --help`,
https://work4you.ai/docs/reference/cli-commands

### Global Flags

```
work4you [flags] [command]        (no subcommand = interactive chat)

  --version, -V             Show version
  -z, --oneshot PROMPT      One-shot: print ONLY the final response (for scripts/pipes)
  -m MODEL  --provider P    Model/provider override for this invocation
  -t, --toolsets LIST       Comma-separated toolsets for this invocation
  --resume, -r SESSION      Resume session by ID or title
  --continue, -c [NAME]     Resume by name, or most recent session
  --worktree, -w            Isolated git worktree mode (parallel agents)
  --skills, -s SKILL        Preload skills (comma-separate or repeat)
  --profile, -p NAME        Use a named profile
  --yolo                    Skip dangerous command approval
  --tui / --cli             Force the Ink TUI / classic REPL
  --ignore-rules            Skip AGENTS.md/SOUL.md/memory/skill injection
  --safe-mode               Disable ALL customizations (troubleshooting)
  --pass-session-id         Include session ID in system prompt
```

### Chat

```
work4you chat [flags]
  -q, --query TEXT          Single query, non-interactive
  --image PATH              Attach a local image to a single query
  -Q, --quiet               Suppress banner, spinner, tool previews
  --checkpoints             Enable filesystem checkpoints (/rollback)
  --max-turns N             Cap tool-calling iterations
  --source TAG              Session source tag (default: cli)
```
(plus the global flags above)

### Configuration

```
work4you setup [section]      Wizard (model|tts|terminal|gateway|tools|agent)
work4you model                Interactive model/provider picker
work4you fallback [add|remove|list]  Fallback provider chain
work4you config [show|edit|get|set|unset|path|env-path|check|migrate]
work4you login / logout       OAuth sign-in / clear stored auth
work4you doctor [--fix]       Check dependencies and config
work4you status [--all]       Component status
```

### Tools & Skills

```
work4you tools [list|enable NAME|disable NAME]   Per-platform toolsets (curses UI with no args)

work4you skills list|browse|search QUERY|inspect ID
work4you skills install ID    Hub identifier OR a direct https://…/SKILL.md URL
work4you skills config        Enable/disable skills per platform
work4you skills check|update|uninstall|publish PATH
work4you skills tap add REPO  Add a GitHub repo as a skill source
work4you bundles              Skill bundles (one /<name> alias loads several skills)
```

### MCP Servers

```
work4you mcp add NAME (--url or --command) | remove | list | test NAME
work4you mcp catalog | install NAME     Curated catalog install
work4you mcp configure NAME             Toggle tool selection
work4you mcp serve                      Run Work4You as an MCP server
```
Details (transport, tool discovery, catalog): `references/native-mcp.md`.

### Gateway (Messaging Platforms)

```
work4you gateway run|install|start|stop|restart|status|setup
```

20+ platforms: Telegram, Discord, Slack, WhatsApp (Baileys + Business Cloud API), iMessage (Photon — `work4you photon setup`), Signal, Email, SMS, Matrix, Mattermost, Teams, LINE, SimpleX, ntfy, Google Chat, Home Assistant, DingTalk, Feishu, WeCom, Weixin, API Server, Webhooks. Open WebUI connects via the API Server adapter. Most adapters ship under `plugins/platforms/`.
Docs: https://work4you.ai/docs/user-guide/messaging/

### Sessions

```
work4you sessions list|browse|rename ID TITLE|delete ID|export OUT|prune|stats
```

### Cron / Webhooks

```
work4you cron list|create SCHED|edit ID|pause|resume|run ID|remove|status
    Schedules: '30m', 'every 2h', '0 9 * * *', ISO timestamp
work4you webhook subscribe NAME|list|remove NAME|test NAME
```
Webhook payloads/routes: `references/webhooks.md`.

### Profiles

```
work4you profile list|create NAME (--clone|--clone-all|--clone-from)|use|show|delete
work4you profile rename A B | alias NAME | export NAME | import FILE
```

### Credentials & Pools

```
work4you auth                 Interactive credential manager
work4you auth add [PROVIDER]  Add OAuth or API-key credential (work4you, openai-codex, qwen-oauth, …)
work4you auth list|remove P IDX|reset PROVIDER|status
```
Multiple credentials per provider form a pool that rotates automatically and skips exhausted keys.

### Other

```
work4you desktop / gui        Native desktop app
work4you dashboard            Web admin panel + embedded chat (--stop / --status)
work4you proxy                OpenAI-compatible local proxy backed by an OAuth provider
work4you portal               Quick setup / sign in via Work4You Portal
work4you kanban <verb>        Multi-agent work-queue board
work4you project              Named multi-folder workspaces
work4you skin list|use|set    Switch/tweak skins (see references/themes.md)
work4you pets <verb>          Pet mascots (see references/petdex.md)
work4you memory setup|status|off|reset   Memory provider
work4you secrets bitwarden|onepassword   External secret stores
work4you moa                  Mixture-of-Agents slots
work4you hooks / security / backup / import / checkpoints / console
work4you logs [-f] [errors]   View agent/error logs
work4you send                 One-off message through a gateway platform
work4you pairing / plugins / insights / journey / computer-use
work4you acp                  ACP server (IDE integration)
work4you completion bash|zsh|fish
work4you update / uninstall / claw migrate
```

Plugin- and provider-supplied subcommands (e.g. `work4you photon setup`) only appear once their plugin is installed/active.

### Where to Find Things

| Looking for... | Location |
|---|---|
| Config options | `work4you config edit` · [Configuration docs](https://work4you.ai/docs/user-guide/configuration) |
| Tools / toolsets | `work4you tools list` · [Tools reference](https://work4you.ai/docs/reference/tools-reference) |
| Skills catalog | `work4you skills browse` · [Skills catalog](https://work4you.ai/docs/reference/skills-catalog) |
| Provider setup | `work4you model` · [Providers guide](https://work4you.ai/docs/integrations/providers) |
| Env variables | `work4you config env-path` · [Env vars reference](https://work4you.ai/docs/reference/environment-variables) |
| Gateway logs | `~/.work4you/logs/gateway.log` (or `work4you logs`) |
| Sessions | `work4you sessions browse` (reads state.db) |
