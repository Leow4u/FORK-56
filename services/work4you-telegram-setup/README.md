# Work4You Telegram setup

Fly app **`work4you-telegram-setup`** at **`https://setup.work4you.ai`**.

This is the service behind **Create the bot** on the Telegram channel (desktop
app and dashboard) and the QR option of the CLI's Telegram setup. It creates
the person's bot with Telegram [Managed Bots](https://core.telegram.org/api/bots/managed-bots):
the app shows a QR code, the person confirms in Telegram, and the app receives
the new bot's token. Nobody copies a token from @BotFather.

The Work4You app already calls this service at `TELEGRAM_ONBOARDING_URL`,
which defaults to `https://setup.work4you.ai`. Until that host answers, **Create
the bot** fails with "Telegram setup service is unavailable".

## How it works

1. The app calls `POST /v1/telegram/pairings`. The service answers with:
   - a `t.me/newbot/<manager bot>/<suggested username>` link, which the app
     shows as a QR code;
   - a pairing id;
   - a secret poll token.
2. The person opens the link and Telegram creates their bot. The person owns
   the bot, and our manager bot manages it.
3. Telegram sends the manager bot a `managed_bot` update. The new bot's
   username ties it to the pairing, and `getManagedBotToken` returns the token.
4. The app polls `GET /v1/telegram/pairings/:id` with
   `Authorization: Bearer <poll token>` and reads the token.

| Route | Purpose |
|-------|---------|
| `GET /healthz` | Liveness, the manager bot, and the update loop |
| `POST /v1/telegram/pairings` | Body `{"bot_name"?}`. Returns `201 {pairing_id, poll_token, suggested_username, deep_link, qr_payload, expires_at}` |
| `GET /v1/telegram/pairings/:id` | Bearer poll token. Returns `{status: "waiting", expires_at}`, or `{status: "ready", token, bot_username, owner_user_id}` |

Errors are JSON `{"error": "<code>"}`:

| Status | Code | When |
|--------|------|------|
| 401 | `unauthorized` | Missing or wrong poll token |
| 404 | `not_found` | Unknown pairing, or one finished long ago |
| 410 | `expired` | The QR code timed out |
| 410 | `claimed` | The token was already read |
| 429 | `rate_limited` | More than 20 new pairings in 10 minutes from one IP |
| 502 | `telegram_token_fetch_failed` | The bot exists but Telegram did not return its token yet. The next poll retries. |
| 503 | `telegram_manager_bot_token_not_configured` | `TELEGRAM_MANAGER_BOT_TOKEN` is not set |
| 503 | `telegram_manager_bot_token_invalid` | Telegram rejects that token |
| 503 | `telegram_manager_bot_not_enabled` | Bot Management Mode is off for the manager bot |
| 503 | `telegram_unavailable` | Telegram did not answer |
| 503 | `busy` | Too many pairings in memory |

### Rules

**Timing**
- A QR code lives **10 minutes**. The app keeps its copy of the pairing for
  exactly as long, so the person must also save the bot within those 10
  minutes.

**The token**
- The token is handed over **once**. The same poll token may read it again
  for 60 seconds, in case a response is lost. After that the pairing answers
  `claimed` and the token leaves memory.
- A token nobody collects is dropped when its pairing expires.

**Matching the bot to the QR code**
- The **username is the only link** between the QR code and the new bot.
- Telegram lets the person edit the suggested username before confirming.
  A change of case still matches. Any other edit creates the bot but does not
  deliver it: the QR expires, and the person can use **Use its token instead**.

**Memory**
- Pairings live in memory, so a deploy or restart drops the ones in flight.
- Telegram gives each update to one poller. That is why the app runs exactly
  **one** machine.

**Security**
- The manager bot can read the token of every bot created through it.
  `TELEGRAM_MANAGER_BOT_TOKEN` is the only secret; keep it in Fly secrets.
- Poll tokens are kept as SHA-256 hashes.
- Logs never contain a token.

## Set up (once)

1. **Create the manager bot.** In Telegram, talk to @BotFather:
   1. Send `/newbot`.
   2. Name it `Work4You Setup`.
   3. Give it a username, for example `Work4YouSetupBot`. Any free username
      ending in `bot` works; the service reads it with `getMe`.
   4. Copy the token.
2. **Turn on Bot Management Mode.**
   1. In @BotFather, open the Mini App (the **Open** button).
   2. Pick the bot, open its settings, and turn on **Bot Management Mode**.
   3. Check it: the following command shows `"can_manage_bots":true`.

   ```bash
   curl -s https://api.telegram.org/bot<TOKEN>/getMe
   ```

   4. Optional: in @BotFather, set its description (`/setdescription`) to
      something like "Creates your Work4You bot. Start from Work4You →
      Channels → Telegram." This bot answers no messages, so anyone who opens
      it directly will know what it is for.

3. **Deploy.**

   ```bash
   cd services/work4you-telegram-setup
   fly apps create work4you-telegram-setup
   fly secrets set -a work4you-telegram-setup TELEGRAM_MANAGER_BOT_TOKEN=<TOKEN> --stage
   fly deploy -a work4you-telegram-setup --ha=false
   ```

   `--ha=false` keeps it to one machine; see the rules above.

4. **DNS.** Point `setup.work4you.ai` at the app.
   1. Run:

      ```bash
      fly certs add setup.work4you.ai -a work4you-telegram-setup
      ```

   2. At the DNS provider for `work4you.ai`, add a CNAME `setup` →
      `work4you-telegram-setup.fly.dev`. You can use the A/AAAA records from
      `fly ips list` instead.
   3. Check with `fly certs show setup.work4you.ai -a work4you-telegram-setup`
      until the certificate is issued.

5. **Check.**
   1. Run `curl -s https://setup.work4you.ai/healthz`. Look for all three:
      - `manager_bot.username` is set;
      - `"can_manage_bots": true`;
      - `"running": true`.
   2. In Work4You, go to Channels → Telegram → **Create the bot**. The QR code
      should appear.

To rotate the manager bot token, run `fly secrets set` again. That restarts the
machine, so setups in progress at that moment have to start again.

## Local

```bash
npm install
npm test
npm run typecheck
TELEGRAM_MANAGER_BOT_TOKEN=<a test manager bot token> npm run dev
```

Start the Work4You backend or CLI with
`TELEGRAM_ONBOARDING_URL=http://localhost:8080` to use the local service.
`TELEGRAM_API_BASE` points the service at a fake Bot API instead of
`https://api.telegram.org`.
