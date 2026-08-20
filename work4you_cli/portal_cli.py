"""``work4you portal`` — the human-readable entry point for Work4You Portal.

Running ``work4you portal`` with no subcommand performs the one-shot Portal
onboarding: OAuth login, pick a Work4You model, switch the inference provider to
Work4You, and offer to enable the Tool Gateway. It is the friendly alias for
``work4you auth add work4you --type oauth`` (which still works), is identical to
``work4you setup --portal``, and runs the same Work4You flow as the first-time quick
setup.

Subcommands:
  (none)   Log in to Work4You Portal + set it up (one-shot onboarding).
  login    Explicit alias for the default one-shot onboarding.
  info     Show Portal auth state + which Tool Gateway tools are routed.
  open     Open the Portal subscription page in the user's default browser.
  tools    List Tool Gateway tools and which are active in the current config.

This command is intentionally minimal — it does not duplicate functionality
already in ``work4you auth`` or ``work4you tools``. It's the onboarding + discovery
surface for the Portal subscription itself.
"""
from __future__ import annotations

import sys
import webbrowser

from work4you_cli.colors import Colors, color
from work4you_cli.config import load_config

DEFAULT_PORTAL_URL = "https://portal.work4you.ai"
SUBSCRIPTION_URL = "https://portal.work4you.ai/manage-subscription"
DOCS_URL = "https://work4you.ai/docs/user-guide/features/tool-gateway"


def _cmd_status(args) -> int:
    """Show Portal auth + Tool Gateway routing summary."""
    from work4you_cli.auth import get_work4you_auth_status_local
    from work4you_cli.work4you_subscription import get_work4you_subscription_features

    config = load_config() or {}

    try:
        # Read-only status display: refresh-free snapshot (no OAuth refresh).
        auth = get_work4you_auth_status_local() or {}
    except Exception:
        auth = {}

    logged_in = bool(auth.get("logged_in"))

    print()
    print(color("  Work4You Portal", Colors.MAGENTA))
    print(color("  ───────────", Colors.MAGENTA))
    if logged_in:
        portal = auth.get("portal_base_url") or DEFAULT_PORTAL_URL
        print(f"  Auth:    {color('✓ logged in', Colors.GREEN)}")
        print(f"  Portal:  {portal}")
        inference = auth.get("inference_base_url")
        if inference:
            print(f"  API:     {inference}")
    else:
        print(f"  Auth:    {color('not logged in', Colors.YELLOW)}")
        print(f"  Sign up: {SUBSCRIPTION_URL}")
        print("  Login:   work4you portal")

    # Provider selection (independent of auth)
    model_cfg = config.get("model") if isinstance(config.get("model"), dict) else {}
    provider = str(model_cfg.get("provider") or "").strip().lower()
    if provider == "work4you":
        print(f"  Model:   {color('✓ using Work4You as inference provider', Colors.GREEN)}")
    elif provider:
        print(f"  Model:   currently {provider} (switch with `work4you model`)")

    # Tool Gateway routing
    print()
    print(color("  Tool Gateway", Colors.MAGENTA))
    print(color("  ────────────", Colors.MAGENTA))
    try:
        features = get_work4you_subscription_features(config)
    except Exception:
        features = None

    if features is None:
        print("  (could not resolve subscription state)")
        return 0

    rows = []
    for feat in features.items():
        if feat.managed_by_nous:
            state = color("via Work4You Portal", Colors.GREEN)
        elif feat.active and feat.current_provider:
            state = feat.current_provider
        elif feat.active:
            state = "active"
        else:
            state = color("not configured", Colors.DIM)
        rows.append((feat.label, state))

    width = max((len(r[0]) for r in rows), default=0)
    for label, state in rows:
        print(f"  {label:<{width}}   {state}")

    if not logged_in:
        print()
        print(color(f"  Docs: {DOCS_URL}", Colors.DIM))
    return 0


def _cmd_open(args) -> int:
    """Open the Portal subscription page in the default browser."""
    target = SUBSCRIPTION_URL
    print(f"Opening {target}")
    try:
        opened = webbrowser.open(target)
    except Exception:
        opened = False
    if not opened:
        print()
        print("Could not launch a browser. Visit the URL above manually.")
        return 1
    return 0


def _cmd_tools(args) -> int:
    """List the Tool Gateway catalog + current routing."""
    from work4you_cli.work4you_subscription import get_work4you_subscription_features

    config = load_config() or {}
    try:
        features = get_work4you_subscription_features(config)
    except Exception:
        print("Could not resolve Tool Gateway state.", file=sys.stderr)
        return 1

    # Static catalog — the partners Tool Gateway routes to today.
    catalog = [
        ("web",       "Web search & extract",  "Firecrawl"),
        ("image_gen", "Image generation",      "FAL"),
        ("tts",       "Text-to-speech",        "OpenAI TTS"),
        ("browser",   "Browser automation",    "Browser Use"),
        ("modal",     "Cloud terminal",        "Modal"),
    ]

    print()
    print(color("  Tool Gateway catalog", Colors.MAGENTA))
    print(color("  ────────────────────", Colors.MAGENTA))

    if not features.work4you_auth_present:
        print(color("  Not logged into Work4You Portal — sign in with `work4you portal`.", Colors.YELLOW))
        print()

    label_width = max(len(label) for _, label, _ in catalog)
    for key, label, partner in catalog:
        feat = features.features.get(key)
        if feat is None:
            state = color("unknown", Colors.DIM)
        elif feat.managed_by_nous:
            state = color("✓ via Work4You Portal", Colors.GREEN)
        elif feat.active and feat.current_provider:
            state = feat.current_provider
        elif feat.active:
            state = "active"
        else:
            state = color("not configured", Colors.DIM)
        print(f"  {label:<{label_width}}  partner: {partner:<14} {state}")

    print()
    print(color(f"  Manage your subscription: {SUBSCRIPTION_URL}", Colors.DIM))
    print(color(f"  Docs: {DOCS_URL}", Colors.DIM))
    return 0


def _cmd_login(args) -> int:
    """Run the one-shot Work4You Portal onboarding (login + model + provider + tools).

    This is the human-readable front door for `work4you auth add work4you --type
    oauth`. It reuses the exact wiring behind `work4you setup --portal` (which in
    turn runs the same Work4You flow as the first-time quick setup), so the
    commands stay in lockstep: device-code login, pick a Work4You model, switch the
    inference provider to Work4You, then offer the Tool Gateway opt-in.
    """
    from work4you_cli.setup import _run_portal_one_shot

    config = load_config() or {}
    try:
        _run_portal_one_shot(config)
    except (KeyboardInterrupt, EOFError):
        print()
        print("Portal setup cancelled.")
        return 1
    return 0


def portal_command(args) -> int:
    """Top-level dispatch for `work4you portal <subcommand>`."""
    sub = getattr(args, "portal_command", None)
    if sub in {None, "", "login"}:
        # Default to the one-shot onboarding — `work4you portal` is the
        # human-readable alias for `work4you auth add work4you --type oauth` /
        # `work4you setup --portal`.
        return _cmd_login(args)
    if sub in {"info", "status"}:
        # `status` kept as a back-compat alias for the prior default.
        return _cmd_status(args)
    if sub == "open":
        return _cmd_open(args)
    if sub == "tools":
        return _cmd_tools(args)
    print(f"Unknown portal subcommand: {sub}", file=sys.stderr)
    print("Run `work4you portal -h` for usage.", file=sys.stderr)
    return 1


def add_parser(subparsers) -> None:
    """Register `work4you portal` on the given argparse subparsers object."""
    portal_parser = subparsers.add_parser(
        "portal",
        help="Set up Work4You Portal (login, model pick, Tool Gateway); see also `portal info`",
        description=(
            "Run `work4you portal` with no subcommand to log in to Work4You Portal "
            "and set it up — pick a model, set Work4You as your provider, and offer "
            "the Tool Gateway (the human-readable alias for `work4you auth add "
            "work4you --type oauth`, identical to `work4you setup --portal`). "
            "Subcommands: login (default), info, open, tools."
        ),
    )
    portal_sub = portal_parser.add_subparsers(dest="portal_command")

    portal_sub.add_parser(
        "login",
        help="Log in to Work4You Portal + set it up (default; one-shot onboarding)",
    )
    portal_sub.add_parser(
        "info",
        help="Show Portal auth + Tool Gateway routing summary",
    )
    # `status` retained as a hidden back-compat alias for `info`.
    portal_sub.add_parser("status")
    portal_sub.add_parser(
        "open",
        help="Open the Portal subscription page in your default browser",
    )
    portal_sub.add_parser(
        "tools",
        help="List Tool Gateway tools and which are routed via Work4You",
    )

    portal_parser.set_defaults(func=portal_command)
