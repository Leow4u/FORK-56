# Langfuse Observability Plugin

This plugin ships bundled with Work4You but is **opt-in** — it only loads when
you explicitly enable it.

## Enable

Pick one:

```bash
# Interactive: walks you through credentials + SDK install + enable
work4you tools  # → Langfuse Observability

# Manual
pip install langfuse
work4you plugins enable observability/langfuse
```

## Required credentials

Set these in `~/.work4you/.env` (or via `work4you tools`):

```bash
WORK4YOU_LANGFUSE_PUBLIC_KEY=pk-lf-...
WORK4YOU_LANGFUSE_SECRET_KEY=sk-lf-...
WORK4YOU_LANGFUSE_BASE_URL=https://cloud.langfuse.com   # or your self-hosted URL
```

Without the SDK or credentials the hooks no-op silently — the plugin fails
open.

## Verify

```bash
work4you plugins list                 # observability/langfuse should show "enabled"
work4you chat -q "hello"              # then check Langfuse for a "Work4You turn" trace
```

Generation observations include the Work4You system prompt when the provider
uses a separate `system` param (Anthropic Messages API). Open an **LLM call**
child span to inspect `role: system` (truncated via `WORK4YOU_LANGFUSE_MAX_CHARS`).

## Optional tuning

```bash
WORK4YOU_LANGFUSE_ENV=production       # environment tag
WORK4YOU_LANGFUSE_RELEASE=v1.0.0       # release tag
WORK4YOU_LANGFUSE_SAMPLE_RATE=0.5      # sample 50% of traces
WORK4YOU_LANGFUSE_MAX_CHARS=12000      # max chars per field (default: 12000)
WORK4YOU_LANGFUSE_CAPTURE=sanitized    # content capture mode (see below)
WORK4YOU_LANGFUSE_DEBUG=true           # verbose plugin logging
```

## Capture modes

`WORK4YOU_LANGFUSE_CAPTURE` controls how much *content* (prompts, responses,
tool arguments/results) is exported. Structural metadata — IDs, roles, tool
names, token usage, cost, timing — is always captured in every mode.

| mode | behavior |
|------|----------|
| `metadata` | No content. Each content field is replaced by a shape/size stub (`{"omitted": true, "type": "text", "chars": N}`). |
| `sanitized` | **(default)** Content is exported after secret-pattern redaction (API keys, tokens, JWTs, private keys, `password=`-style assignments) and truncation. Redaction runs *before* truncation. |
| `full` | Raw content, truncated only. Explicit opt-in — traces will contain whatever passed through the conversation, including injected memory and file contents. |

The active mode is recorded on every trace as `metadata.capture_mode`.

Note: `sanitized` is pattern-based defense in depth, not a DLP guarantee.
For personal sessions or shared Langfuse projects, prefer `metadata`.

## Error + shutdown coverage

- Failed model requests (`api_request_error` hook) close their generation
  with `level=ERROR`, status code, retry counters, and a capture-mode-scrubbed
  error message. Non-retryable failures also finish the turn trace.
- Session end/finalize closes any still-open traces for that session and
  flushes queued events, so interrupted or tool-only turns don't dangle.

## Disable

```bash
work4you plugins disable observability/langfuse
```
