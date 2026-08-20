---
sidebar_position: 3
title: "FAQ & Troubleshooting"
description: "Frequently asked questions and solutions to common issues with Work4You"
---

# FAQ & Troubleshooting

Quick answers and fixes for the most common questions and issues.

---

## Frequently Asked Questions

### What LLM providers work with Work4You?

Work4You works with any OpenAI-compatible API. Supported providers include:

- **[OpenRouter](https://openrouter.ai/)** — access hundreds of models through one API key (recommended for flexibility)
- **[Work4You Portal](/integrations/work4you-portal)** — Work4You's subscription gateway — 300+ models plus web/image/TTS/browser through one OAuth login (recommended for newcomers)
- **OpenAI** — GPT-5.4, GPT-5-codex, GPT-4.1, GPT-4o, etc.
- **Anthropic** — Claude models (direct API, OAuth via `work4you auth add anthropic`, OpenRouter, or any compatible proxy)
- **Google** — Gemini models (direct API via `gemini` provider, OpenRouter, or compatible proxy)
- **z.ai / ZhipuAI** — GLM models
- **Kimi / Moonshot AI** — Kimi models
- **MiniMax** — global and China endpoints
- **Local models** — via [Ollama](https://ollama.com/), [vLLM](https://docs.vllm.ai/), [llama.cpp](https://github.com/ggerganov/llama.cpp), [SGLang](https://github.com/sgl-project/sglang), or any OpenAI-compatible server

Set your provider with `work4you model` or by editing `~/.work4you/.env`. See the [Environment Variables](./environment-variables.md) reference for all provider keys.

### Does it work on Windows/Android/Termux/my plataform??
See **[Platform Support](../getting-started/platform-support.md)** for the full platform availability matrix.

### I run Work4You in WSL2. What's the best way to control my normal Windows Chrome?

Prefer an MCP bridge over `/browser connect`.

Recommended pattern:

- run Work4You inside WSL2
- keep using your normal signed-in Chrome on Windows
- add `chrome-devtools-mcp` as an MCP server through `cmd.exe` or `powershell.exe`
- let Work4You use the resulting MCP browser tools

This is more reliable than trying to force Work4You core browser transport to attach directly across the WSL2/Windows boundary.

See:

- [Use MCP with Work4You](../guides/use-mcp-with-work4you.md#wsl2-bridge-work4you-in-wsl-to-windows-chrome)
- [Browser Automation](../user-guide/features/browser.md#wsl2--windows-chrome-prefer-mcp-over-browser-connect)

### Is my data sent anywhere?

API calls go **only to the LLM provider you configure** (e.g., OpenRouter, your local Ollama instance). Work4You does not collect telemetry, usage data, or analytics. Your conversations, memory, and skills are stored locally in `~/.work4you/`.

### Can I use it offline / with local models?

Yes. Run `work4you model`, select **Custom endpoint**, and enter your server's URL:

```bash
work4you model
# Select: Custom endpoint (enter URL manually)
# API base URL: http://localhost:11434/v1
# API key: ollama
# Model name: qwen3.5:27b
# Context length: 64000   ← Work4You minimum; set this to match your server's actual context window
```

Or configure it directly in `config.yaml`:

```yaml
model:
  default: qwen3.5:27b
  provider: custom
  base_url: http://localhost:11434/v1
```

Work4You persists the endpoint, provider, and base URL in `config.yaml` so it survives restarts. If your local server has exactly one model loaded, `/model custom` auto-detects it. You can also set `provider: custom` in config.yaml — it's a first-class provider, not an alias for anything else.

This works with Ollama, vLLM, llama.cpp server, SGLang, LocalAI, and others. See the [Configuration guide](../user-guide/configuration.md) for details.

:::tip Ollama users
If you set a custom `num_ctx` in Ollama (e.g., `ollama run --num_ctx 64000`), make sure to set the matching context length in Work4You — Ollama's `/api/show` reports the model's *maximum* context, not the effective `num_ctx` you configured.
:::

:::tip Timeouts with local models
Work4You auto-detects local endpoints and relaxes streaming timeouts (read timeout raised from 120s to 1800s, stale stream detection disabled). If you still hit timeouts on very large contexts, set `WORK4YOU_STREAM_READ_TIMEOUT=1800` in your `.env`. See the [Local LLM guide](../guides/local-llm-on-mac.md#timeouts) for details.
:::

### How much does it cost?

Work4You itself is **free and open-source** (MIT license). You pay only for the LLM API usage from your chosen provider. Local models are completely free to run.

### Can multiple people use one instance?

Yes. The [messaging gateway](../user-guide/messaging/index.md) lets multiple users interact with the same Work4You instance via Telegram, Discord, Slack, WhatsApp, or Home Assistant. Access is controlled through allowlists (specific user IDs) and DM pairing (first user to message claims access).

### What's the difference between memory and skills?

- **Memory** stores **facts** — things the agent knows about you, your projects, and preferences. Memories are retrieved automatically based on relevance.
- **Skills** store **procedures** — step-by-step instructions for how to do things. Skills are recalled when the agent encounters a similar task.

Both persist across sessions. See [Memory](../user-guide/features/memory.md) and [Skills](../user-guide/features/skills.md) for details.

### Can I use it in my own Python project?

Yes. Import the `AIAgent` class and use Work4You programmatically:

```python
from run_agent import AIAgent

agent = AIAgent(model="anthropic/claude-opus-4.7")
response = agent.chat("Explain quantum computing briefly")
```

See the [Python Library guide](../user-guide/features/code-execution.md) for full API usage.

---

## Troubleshooting

### Installation Issues

#### `work4you: command not found` after installation

**Cause:** Your shell hasn't reloaded the updated PATH.

**Solution:**
```bash
# Reload your shell profile
source ~/.bashrc    # bash
source ~/.zshrc     # zsh

# Or start a new terminal session
```

If it still doesn't work, verify the install location:
```bash
which work4you
ls ~/.local/bin/work4you
```

:::tip
The installer adds `~/.local/bin` to your PATH. If you use a non-standard shell config, add `export PATH="$HOME/.local/bin:$PATH"` manually.
:::

#### Python version too old

**Cause:** Work4You requires Python 3.11 or newer.

**Solution:**
```bash
python3 --version   # Check current version

# Install a newer Python
sudo apt install python3.12   # Ubuntu/Debian
brew install python@3.12      # macOS
```

The installer handles this automatically — if you see this error during manual installation, upgrade Python first.

#### Terminal commands say `node: command not found` (or `nvm`, `pyenv`, `asdf`, …)

**Cause:** Work4You builds a per-session environment snapshot by running `bash -l` once at startup. A bash login shell reads `/etc/profile`, `~/.bash_profile`, and `~/.profile`, but **does not source `~/.bashrc`** — so tools that install themselves there (`nvm`, `asdf`, `pyenv`, `cargo`, custom `PATH` exports) stay invisible to the snapshot. This most commonly happens when Work4You runs under systemd or in a minimal shell where nothing has pre-loaded the interactive shell profile.

**Solution:** Work4You auto-sources `~/.bashrc` by default. If that's not enough — e.g. you're a zsh user whose PATH lives in `~/.zshrc`, or you init `nvm` from a standalone file — list the extra files to source in `~/.work4you/config.yaml`:

```yaml
terminal:
  shell_init_files:
    - ~/.zshrc                     # zsh users: pulls zsh-managed PATH into the bash snapshot
    - ~/.nvm/nvm.sh                # direct nvm init (works regardless of shell)
    - /etc/profile.d/cargo.sh      # system-wide rc files
  # When this list is set, the default ~/.bashrc auto-source is NOT added —
  # include it explicitly if you want both:
  #   - ~/.bashrc
  #   - ~/.zshrc
```

Missing files are skipped silently. Sourcing happens in bash, so files that rely on zsh-only syntax may error — if that's a concern, source just the PATH-setting portion (e.g. nvm's `nvm.sh` directly) rather than the whole rc file.

To disable the auto-source behaviour (strict login-shell semantics only):

```yaml
terminal:
  auto_source_bashrc: false
```

#### `uv: command not found`

**Cause:** The `uv` package manager isn't installed or not in PATH.

**Solution:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

#### Permission denied errors during install

**Cause:** Insufficient permissions to write to the install directory.

**Solution:**
```bash
# Don't use sudo with the installer — it installs to ~/.local/bin
# If you previously installed with sudo, clean up:
sudo rm /usr/local/bin/work4you
# Then re-run the standard installer
curl -fsSL https://work4you.ai/install.sh | bash
```

---

### Provider & Model Issues

#### The agent says "Work4You policy" or "Work4You guardrails" refused my request

A model cannot reliably identify why it refused a request. If the refusal appears only in the assistant's prose, its claim that a hidden Work4You runtime policy caused it may be a hallucinated explanation or a restriction applied by the selected model or provider.

Work4You enforcement is explicit: a blocked tool action returns a tool error naming the denied command or path, and an approval-required action shows an approval prompt. Work4You does not silently turn those execution controls into a general content-refusal layer. Provider-level controls can still apply when configured, such as Amazon Bedrock Guardrails.

To isolate the source:

1. Run `/status` to confirm the active model and provider.
2. Check whether the refusal includes an actual Work4You tool error or approval prompt. If it is prose only, do not treat the model's attribution as runtime evidence.
3. Retry in a fresh session with another configured model or provider. A refusal that changes with the model is model/provider behavior, not a Work4You execution control.
4. If an explicit tool error appears, use its exact text when reporting the problem.

See [Security](/user-guide/security) for Work4You' documented execution controls and [Providers](/integrations/providers) for provider configuration.

#### `/model` only shows one provider / can't switch providers

**Cause:** `/model` (inside a chat session) can only switch between providers you've **already configured**. If you've only set up OpenRouter, that's all `/model` will show.

**Solution:** Exit your session and use `work4you model` from your terminal to add new providers:

```bash
# Exit the Work4You chat session first (Ctrl+C or /quit)

# Run the full provider setup wizard
work4you model

# This lets you: add providers, run OAuth, enter API keys, configure endpoints
```

After adding a new provider via `work4you model`, start a new chat session — `/model` will now show all your configured providers.

:::tip Quick reference
| Want to... | Use |
|-----------|-----|
| Add a new provider | `work4you model` (from terminal) |
| Enter/change API keys | `work4you model` (from terminal) |
| Switch model mid-session | `/model <name>` (inside session) |
| Switch to different configured provider | `/model provider:model` (inside session) |
:::

#### API key not working

**Cause:** Key is missing, expired, incorrectly set, or for the wrong provider.

**Solution:**
```bash
# Check your configuration
work4you config show

# Re-configure your provider
work4you model

# Or set directly
work4you config set OPENROUTER_API_KEY sk-or-v1-xxxxxxxxxxxx
```

:::warning
Make sure the key matches the provider. An OpenAI key won't work with OpenRouter and vice versa. Check `~/.work4you/.env` for conflicting entries.
:::

#### Model not available / model not found

**Cause:** The model identifier is incorrect or not available on your provider.

**Solution:**
```bash
# List available models for your provider
work4you model

# Set a valid model
work4you config set WORK4YOU_MODEL anthropic/claude-opus-4.7

# Or specify per-session
work4you chat --model openrouter/meta-llama/llama-3.1-70b-instruct
```

#### Rate limiting (429 errors)

**Cause:** You've exceeded your provider's rate limits.

**Solution:** Wait a moment and retry. For sustained usage, consider:
- Upgrading your provider plan
- Switching to a different model or provider
- Using `work4you chat --provider <alternative>` to route to a different backend

#### Context length exceeded

**Cause:** The conversation has grown too long for the model's context window, or Work4You detected the wrong context length for your model.

**Solution:**
```bash
# Compress the current session
/compress

# Or start a fresh session
work4you chat

# Use a model with a larger context window
work4you chat --model openrouter/google/gemini-3-flash-preview
```

If this happens on the first long conversation, Work4You may have the wrong context length for your model. Check what it detected:

Look at the CLI startup line — it shows the detected context length (e.g., `📊 Context limit: 128000 tokens`). You can also check with `/usage` during a session.

To fix context detection, set it explicitly:

```yaml
# In ~/.work4you/config.yaml
model:
  default: your-model-name
  context_length: 131072  # your model's actual context window
```

Or for custom endpoints, add it per-model on the provider entry:

```yaml
providers:
  my-server:
    api: "http://localhost:11434/v1"
    models:
      qwen3.5:27b:
        context_length: 64000
```

(Older configs use the legacy `custom_providers:` list — still supported and auto-migrated to `providers:`.)

See [Context Length Detection](../integrations/providers.md#context-length-detection) for how auto-detection works and all override options.

---

### Terminal Issues

#### Command blocked as dangerous

**Cause:** Work4You detected a potentially destructive command (e.g., `rm -rf`, `DROP TABLE`). This is a safety feature.

**Solution:** When prompted, review the command and type `y` to approve it. You can also:
- Ask the agent to use a safer alternative
- See the full list of dangerous patterns in the [Security docs](../user-guide/security.md)

:::tip
This is working as intended — Work4You never silently runs destructive commands. The approval prompt shows you exactly what will execute.
:::

#### `sudo` not working via messaging gateway

**Cause:** The messaging gateway runs without an interactive terminal, so `sudo` cannot prompt for a password.

**Solution:**
- Avoid `sudo` in messaging — ask the agent to find alternatives
- If you must use `sudo`, configure passwordless sudo for specific commands in `/etc/sudoers`
- Or switch to the terminal interface for administrative tasks: `work4you chat`

#### Docker backend not connecting

**Cause:** Docker daemon isn't running or the user lacks permissions.

**Solution:**
```bash
# Check Docker is running
docker info

# Add your user to the docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker run hello-world
```

---

### Messaging Issues

#### Bot not responding to messages

**Cause:** The bot isn't running, isn't authorized, or your user isn't in the allowlist.

**Solution:**
```bash
# Check if the gateway is running
work4you gateway status

# Start the gateway
work4you gateway start

# Check logs for errors
cat ~/.work4you/logs/gateway.log | tail -50
```

#### Messages not delivering

**Cause:** Network issues, bot token expired, or platform webhook misconfiguration.

**Solution:**
- Verify your bot token is valid with `work4you gateway setup`
- Check gateway logs: `cat ~/.work4you/logs/gateway.log | tail -50`
- For webhook-based platforms (Slack, WhatsApp), ensure your server is publicly accessible

#### Allowlist confusion — who can talk to the bot?

**Cause:** Authorization mode determines who gets access.

**Solution:**

| Mode | How it works |
|------|-------------|
| **Allowlist** | Only user IDs listed in config can interact |
| **DM pairing** | First user to message in DM claims exclusive access |
| **Open** | Anyone can interact (not recommended for production) |

Configure in `~/.work4you/config.yaml` under your gateway's settings. See the [Messaging docs](../user-guide/messaging/index.md).

#### Gateway won't start

**Cause:** Missing dependencies, port conflicts, or misconfigured tokens.

**Solution:**
```bash
# Install core messaging gateway dependencies
cd ~/.work4you/work4you && uv pip install -e ".[messaging]"  # Telegram, Discord, Slack, and shared gateway deps

# Check for port conflicts
lsof -i :8080

# Verify configuration
work4you config show
```

#### WSL: Gateway keeps disconnecting or `work4you gateway start` fails

**Cause:** WSL's systemd support is unreliable. Many WSL2 installations don't have systemd enabled, and even when enabled, services may not survive WSL restarts or Windows idle shutdowns.

**Solution:** Use foreground mode instead of the systemd service:

```bash
# Option 1: Direct foreground (simplest)
work4you gateway run

# Option 2: Persistent via tmux (survives terminal close)
tmux new -s work4you 'work4you gateway run'
# Reattach later: tmux attach -t work4you

# Option 3: Background via nohup
nohup work4you gateway run > ~/.work4you/logs/gateway.log 2>&1 &
```

If you want to try systemd anyway, make sure it's enabled:

1. Open `/etc/wsl.conf` (create it if it doesn't exist)
2. Add:
   ```ini
   [boot]
   systemd=true
   ```
3. From PowerShell: `wsl --shutdown`
4. Reopen your WSL terminal
5. Verify: `systemctl is-system-running` should say "running" or "degraded"

:::tip Auto-start on Windows boot
For reliable auto-start, use Windows Task Scheduler to launch WSL + the gateway on login:
1. Create a task that runs `wsl -d Ubuntu -- bash -lc 'work4you gateway run'`
2. Set it to trigger on user logon
:::

#### macOS: Node.js / ffmpeg / other tools not found by gateway

**Cause:** launchd services inherit a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) that doesn't include Homebrew, nvm, cargo, or other user-installed tool directories. This commonly breaks the WhatsApp bridge (`node not found`) or voice transcription (`ffmpeg not found`).

**Solution:** The gateway captures your shell PATH when you run `work4you gateway install`. If you installed tools after setting up the gateway, re-run the install to capture the updated PATH:

```bash
work4you gateway install    # Re-snapshots your current PATH
work4you gateway start      # Detects the updated plist and reloads
```

You can verify the plist has the correct PATH:
```bash
/usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:PATH" \
  ~/Library/LaunchAgents/ai.work4you.gateway.plist
```

---

### Performance Issues

#### Slow responses

**Cause:** Large model, distant API server, or heavy system prompt with many tools.

**Solution:**
- Try a faster/smaller model: `work4you chat --model openrouter/meta-llama/llama-3.1-8b-instruct`
- Reduce active toolsets: `work4you chat -t "terminal"`
- Check your network latency to the provider
- For local models, ensure you have enough GPU VRAM

#### High token usage

**Cause:** Long conversations, verbose system prompts, or many tool calls accumulating context.

**Solution:**
```bash
# See exactly what the fixed prompt costs — breakdown by block
# (system prompt, skills index, memory, tool schemas). Runs offline.
work4you prompt-size

# Compress the conversation to reduce tokens
/compress

# Check session token usage
/usage
```

If the baseline looks high before you've typed anything, that's the fixed prompt budget — the system prompt plus tool schemas sent on every call. Run [`work4you prompt-size`](/reference/cli-commands#work4you-prompt-size) to measure it, then trim: disable toolsets you don't use (`work4you tools`) and uninstall or disable skills you don't need (`work4you skills`).

:::tip
Use `/compress` regularly during long sessions. It summarizes the conversation history and reduces token usage significantly while preserving context.
:::

#### Session getting too long

**Cause:** Extended conversations accumulate messages and tool outputs, approaching context limits.

**Solution:**
```bash
# Compress current session (preserves key context)
/compress

# Start a new session with a reference to the old one
work4you chat

# Resume a specific session later if needed
work4you chat --continue
```

---

### MCP Issues

#### MCP server not connecting

**Cause:** Server binary not found, wrong command path, or missing runtime.

**Solution:**
```bash
# Ensure MCP dependencies are installed (already included in standard install)
cd ~/.work4you/work4you && uv pip install -e ".[mcp]"

# For npm-based servers, ensure Node.js is available
node --version
npx --version

# Test the server manually
npx -y @modelcontextprotocol/server-filesystem /tmp
```

Verify your `~/.work4you/config.yaml` MCP configuration:
```yaml
mcp_servers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"]
```

#### Tools not showing up from MCP server

**Cause:** Server started but tool discovery failed, tools were filtered out by config, or the server does not support the MCP capability you expected.

**Solution:**
- Check gateway/agent logs for MCP connection errors
- Ensure the server responds to the `tools/list` RPC method
- Review any `tools.include`, `tools.exclude`, `tools.resources`, `tools.prompts`, or `enabled` settings under that server
- Remember that resource/prompt utility tools are only registered when the session actually supports those capabilities
- Use `/reload-mcp` after changing config

```bash
# Verify MCP servers are configured
work4you config show | grep -A 12 mcp_servers

# Restart Work4You or reload MCP after config changes
work4you chat
```

See also:
- [MCP (Model Context Protocol)](/user-guide/features/mcp)
- [Use MCP with Work4You](/guides/use-mcp-with-work4you)
- [MCP Config Reference](/reference/mcp-config-reference)

#### MCP timeout errors

**Cause:** The MCP server is taking too long to respond, or it crashed during execution.

**Solution:**
- Increase the timeout in your MCP server config if supported
- Check if the MCP server process is still running
- For remote HTTP MCP servers, check network connectivity

:::warning
If an MCP server crashes mid-request, Work4You will report a timeout. Check the server's own logs (not just Work4You logs) to diagnose the root cause.
:::

---

## Profiles

### How do profiles differ from just setting WORK4YOU_HOME?

Profiles are a managed layer on top of `WORK4YOU_HOME`. You *could* manually set `WORK4YOU_HOME=/some/path` before every command, but profiles handle all the plumbing for you: creating the directory structure, generating shell aliases (`work4you-work`), tracking the active profile in `~/.work4you/active_profile`, and syncing skill updates across all profiles automatically. They also integrate with tab completion so you don't have to remember paths.

### Can two profiles share the same bot token?

No. Each messaging platform (Telegram, Discord, etc.) requires exclusive access to a bot token. If two profiles try to use the same token simultaneously, the second gateway will fail to connect. Create a separate bot per profile — for Telegram, talk to [@BotFather](https://t.me/BotFather) to make additional bots.

### Do profiles share memory or sessions?

No. Each profile has its own memory store, session database, and skills directory. They are completely isolated. If you want to start a new profile with existing memories and sessions, use `work4you profile create newname --clone-all` to copy everything from the current profile, or add `--clone-from <profile>` to copy from a specific source profile.

This isolation is also the reason to never run two agents against the *same* profile or Work4You home: both write memory automatically and each loads the other's writes at session start, so their stored state degrades with every session. One agent per profile; for genuinely shared memory across agents, use an [external memory provider](/user-guide/features/memory-providers).

### What happens when I run `work4you update`?

`work4you update` pulls the latest code and reinstalls dependencies **once** (not per-profile). It then syncs updated skills to all profiles automatically. You only need to run `work4you update` once — it covers every profile on the machine.


### How many profiles can I run?

There is no hard limit. Each profile is just a directory under `~/.work4you/profiles/`. The practical limit depends on your disk space and how many concurrent gateways your system can handle (each gateway is a lightweight Python process). Running dozens of profiles is fine; each idle profile uses no resources.

---

## Workflows & Patterns

### Using different models for different tasks (multi-model workflows)

**Scenario:** You use GPT-5.4 as your daily driver, but Gemini or Grok writes better social media content. Manually switching models every time is tedious.

**Solution: Delegation config.** Work4You can route subagents to a different model automatically. Set this in `~/.work4you/config.yaml`:

```yaml
delegation:
  model: "google/gemini-3-flash-preview"   # subagents use this model
  provider: "openrouter"                    # provider for subagents
```

Now when you tell Work4You "write me a Twitter thread about X" and it spawns a `delegate_task` subagent, that subagent runs on Gemini instead of your main model. Your primary conversation stays on GPT-5.4.

You can also be explicit in your prompt: *"Delegate a task to write social media posts about our product launch. Use your subagent for the actual writing."* The agent will use `delegate_task`, which automatically picks up the delegation config.

For one-off model switches without delegation, use `/model` in the CLI:

```bash
/model google/gemini-3-flash-preview    # switch for this session
# ... write your content ...
/model openai/gpt-5.4                   # switch back
```

:::warning
Each `/model` switch resets the prompt cache — the cache key includes the model, so the first message after every switch re-reads the whole conversation at full input price. On long sessions, prefer delegation (subagents get their own fresh context) or a new session over repeated back-and-forth switching.
:::

See [Subagent Delegation](../user-guide/features/delegation.md) for more on how delegation works.

### Running multiple agents on one WhatsApp number (per-chat binding)

**Scenario:** In OpenClaw, you had multiple independent agents bound to specific WhatsApp chats — one for a family shopping list group, another for your private chat. Can Work4You do this?

**Current limitation:** Work4You profiles each require their own WhatsApp number/session. You cannot bind multiple profiles to different chats on the same WhatsApp number — the WhatsApp bridge (Baileys) uses one authenticated session per number.

**Workarounds:**

1. **Use a single profile with personality switching.** Create different `AGENTS.md` context files or use the `/personality` command to change behavior per chat. The agent sees which chat it's in and can adapt.

2. **Use cron jobs for specialized tasks.** For a shopping list tracker, set up a cron job that monitors a specific chat and manages the list — no separate agent needed.

3. **Use separate numbers.** If you need truly independent agents, pair each profile with its own WhatsApp number. Virtual numbers from services like Google Voice work for this.

4. **Use Telegram or Discord instead.** These platforms support per-chat binding more naturally — each Telegram group or Discord channel gets its own session, and you can run multiple bot tokens (one per profile) on the same account.

See [Profiles](../user-guide/profiles.md) and [WhatsApp setup](../user-guide/messaging/whatsapp.md) for more details.

### Controlling what shows up in Telegram (hiding logs and reasoning)

**Scenario:** You see gateway exec logs, Work4You reasoning, and tool call details in Telegram instead of just the final output.

**Solution:** The `display.tool_progress` setting in `config.yaml` controls how much tool activity is shown:

```yaml
display:
  tool_progress: "off"   # options: off, new, all, verbose
```

- **`off`** — Only the final response. No tool calls, no reasoning, no logs.
- **`new`** — Shows new tool calls as they happen (brief one-liners).
- **`all`** — Shows all tool activity including results.
- **`verbose`** — Full detail including tool arguments and outputs.

For messaging platforms, `off` or `new` is usually what you want. After editing `config.yaml`, restart the gateway for changes to take effect.

You can also toggle this per-session with the `/verbose` command (if enabled):

```yaml
display:
  tool_progress_command: true   # enables /verbose in the gateway
```

### Managing skills on Telegram (slash command limit)

**Scenario:** Telegram has a 100 slash command limit, and your skills are pushing past it. You want to disable skills you don't need on Telegram, but `work4you skills config` settings don't seem to take effect.

**Solution:** Use `work4you skills config` to disable skills per-platform. This writes to `config.yaml`:

```yaml
skills:
  disabled: []                    # globally disabled skills
  platform_disabled:
    telegram: [skill-a, skill-b]  # disabled only on telegram
```

After changing this, **restart the gateway** (`work4you gateway restart` or kill and relaunch). The Telegram bot command menu rebuilds on startup.

:::tip
Skills with very long descriptions are truncated to 40 characters in the Telegram menu to stay within payload size limits. If skills aren't appearing, it may be a total payload size issue rather than the 100 command count limit — disabling unused skills helps with both.
:::

### Shared thread sessions (multiple users, one conversation)

**Scenario:** You have a Telegram or Discord thread where multiple people mention the bot. You want all mentions in that thread to be part of one shared conversation, not separate per-user sessions.

**Current behavior:** Work4You creates sessions keyed by user ID on most platforms, so each person gets their own conversation context. This is by design for privacy and context isolation.

**Workarounds:**

1. **Use Slack.** Slack sessions are keyed by thread, not by user. Multiple users in the same thread share one conversation — exactly the behavior you're describing. This is the most natural fit.

2. **Use a group chat with a single user.** If one person is the designated "operator" who relays questions, the session stays unified. Others can read along.

3. **Use a Discord channel.** Discord sessions are keyed by channel, so all users in the same channel share context. Use a dedicated channel for the shared conversation.

### Exporting Work4You to another machine

**Scenario:** You've built up skills, cron jobs, and memories on one machine and want to move everything to a new dedicated Linux box.

**Solution:**

1. Install Work4You on the new machine:
   ```bash
   curl -fsSL https://work4you.ai/install.sh | bash
   ```

2. On the **source machine**, create a full backup:
   ```bash
   work4you backup
   ```
   This creates a zip of your entire `~/.work4you/` directory — config, API keys, memories, skills, sessions, and profiles — saved to your home directory as `~/work4you-backup-<timestamp>.zip`.

3. Copy the zip to the new machine and import it:
   ```bash
   # On the source machine
   scp ~/work4you-backup-<timestamp>.zip newmachine:~/

   # On the new machine
   work4you import ~/work4you-backup-<timestamp>.zip
   ```

4. On the new machine, run `work4you setup` to verify API keys and provider config are working.

### Moving a single profile to another machine

**Scenario:** You want to move or share one specific profile — not your full installation.

```bash
# On the source machine
work4you profile export work ./work-backup.tar.gz

# Copy the file to the target machine, then:
work4you profile import ./work-backup.tar.gz work
```

The imported profile will have all config, memories, sessions, and skills from the export. You may need to update paths or re-authenticate with providers if the new machine has a different setup.

### `work4you backup` vs `work4you profile export`

| Feature | `work4you backup` | `work4you profile export` |
| :--- | :--- | :--- |
| **Use Case** | **Full machine migration** | **Porting/sharing a specific profile** |
| **Scope** | Global (entire `~/.work4you` directory) | Local (single profile directory) |
| **Includes** | All profiles, global config, API keys, sessions | Single profile: SOUL.md, memories, sessions, skills |
| **Credentials** | **Included** (`.env` and `auth.json`) | **Excluded** (stripped for safe sharing) |
| **Format** | `.zip` | `.tar.gz` |

**Manual fallback (rsync):** If you prefer to copy files directly, exclude the code repo:
```bash
rsync -av --exclude='work4you' ~/.work4you/ newmachine:~/.work4you/
```

:::tip
`work4you backup` produces a consistent snapshot even while Work4You is actively running. The restored archive excludes machine-local runtime files like `gateway.pid` and `cron.pid`.
:::

### Permission denied when reloading shell after install

**Scenario:** After running the Work4You installer, `source ~/.zshrc` gives a permission denied error.

**Cause:** This usually happens when `~/.zshrc` (or `~/.bashrc`) has incorrect file permissions, or when the installer couldn't write to it cleanly. It's not a Work4You-specific issue — it's a shell config permissions problem.

**Solution:**
```bash
# Check permissions
ls -la ~/.zshrc

# Fix if needed (should be -rw-r--r-- or 644)
chmod 644 ~/.zshrc

# Then reload
source ~/.zshrc

# Or just open a new terminal window — it picks up PATH changes automatically
```

If the installer added the PATH line but permissions are wrong, you can add it manually:
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

### Error 400 on first agent run

**Scenario:** Setup completes fine, but the first chat attempt fails with HTTP 400.

**Cause:** Usually a model name mismatch — the configured model doesn't exist on your provider, or the API key doesn't have access to it.

**Solution:**
```bash
# Check what model and provider are configured
work4you config show | head -20

# Re-run model selection
work4you model

# Or test with a known-good model
work4you chat -q "hello" --model anthropic/claude-opus-4.7
```

If using OpenRouter, make sure your API key has credits. A 400 from OpenRouter often means the model requires a paid plan or the model ID has a typo.

---

## Still Stuck?

If your issue isn't covered here:

1. **Search existing issues:** [GitHub Issues](https://github.com/Leow4u/FORK-56/issues)
2. **Ask the community:** [Work4You Discord](https://discord.gg/work4you)
3. **File a bug report:** Include your OS, Python version (`python3 --version`), Work4You version (`work4you --version`), and the full error message
