"""Which platform env vars the setup surfaces hide.

Every messaging platform ships the same handful of knobs that are either set
for the user later or already correct by default. Listing them on a setup form
turns "paste your bot token" into a five-field interrogation where none of the
answers are discoverable — the Discord card asked for a home channel ID you
need Developer Mode to copy, next to a reply-threading preference.

Hiding them is a *presentation* decision only. The env vars keep working
through ``work4you config set``, ``.env``, and ``config.yaml``; the gateway reads
them exactly as before. This module just says what a new user is asked during
setup.

Lives here rather than in ``web_server`` so the CLI wizard can share it without
importing the dashboard's FastAPI surface.
"""

# Suffix match, so plugin adapters nobody enumerated (IRC, SimpleX, LINE, ntfy)
# get the same treatment without a code change here.
#
#   *_HOME_CHANNEL*        the bot offers /sethome on the first chat
#   *_ALLOW_ALL_USERS      defaults off; enabling it is a security decision
#   *_REPLY_TO_MODE        cosmetic threading preference
#   *_REPLY_MODE           same, Mattermost's spelling
#   *_REQUIRE_MENTION      behavior toggle with a sane default
#   *_AUTO_THREAD          same
#   *_FREE_RESPONSE_*      per-channel tuning, done once the bot is in a server
#   *_ALLOWED_CHANNELS     same
#   *_PROXY                only for networks that block the platform
#
# Allowlists (*_ALLOWED_USERS) deliberately stay visible: that IS the decision
# a new user has to make, and the gateway denies everyone until it's set.
SETUP_HIDDEN_ENV_SUFFIXES = (
    "_HOME_CHANNEL",
    "_HOME_CHANNEL_NAME",
    "_HOME_CHANNEL_THREAD_ID",
    "_HOME_ADDRESS",
    "_ALLOW_ALL_USERS",
    "_REPLY_TO_MODE",
    "_REPLY_MODE",
    "_REQUIRE_MENTION",
    "_AUTO_THREAD",
    "_FREE_RESPONSE_CHANNELS",
    "_FREE_RESPONSE_ROOMS",
    "_ALLOWED_CHANNELS",
    "_PROXY",
)

# Exact-name hides, for vars whose problem isn't a shared suffix:
#
#   API_SERVER_ENABLED   no gateway code reads it as an env var — enablement
#                        is platforms.api_server.enabled in config.yaml (the
#                        UI toggle) or auto-enable on a usable key (see
#                        gateway/config.py). Offering it as an editable .env
#                        field was a trap: typing "true" changed nothing.
#
#   WEBHOOK_ENABLED      the gateway DOES read this one (gateway/config.py) —
#                        it stays a supported CLI/.env switch. But in the GUI
#                        it was a free-text boolean next to the card's own
#                        enable toggle AND the Webhooks page's Enable button:
#                        three competing enable paths that can disagree (env
#                        true + config.yaml false shows "off" in the UI while
#                        the listener runs). The GUI keeps its toggles; the
#                        env var keeps working for `work4you setup` and .env.
SETUP_HIDDEN_ENV_NAMES = frozenset({
    "API_SERVER_ENABLED",
    "WEBHOOK_ENABLED",
})


def is_setup_hidden_env(name: str) -> bool:
    """True when a var is self-configuring and shouldn't appear in setup forms.

    Callers must still keep any var a platform lists as *required* — hiding a
    required credential would make that platform unconfigurable from the UI.
    """
    return name in SETUP_HIDDEN_ENV_NAMES or name.endswith(SETUP_HIDDEN_ENV_SUFFIXES)
