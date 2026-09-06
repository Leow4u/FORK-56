"""Tests for the compact Work4You welcome splash."""

from unittest.mock import patch

from rich.console import Console

import work4you_cli.banner as banner
from work4you_cli.skin_engine import set_active_skin


def test_cprint_falls_back_to_plain_print_when_prompt_toolkit_has_no_console(capsys):
    with patch(
        "prompt_toolkit.print_formatted_text",
        side_effect=RuntimeError("no console screen buffer"),
    ):
        banner.cprint("fallback text")

    assert capsys.readouterr().out == "fallback text\n"


def _render_splash(**kwargs) -> str:
    defaults = dict(
        model="anthropic/claude-opus-4.8",
        cwd="/tmp/project",
        session_id="abc123",
        tools=[{"function": {"name": "read_file"}}],
        get_toolset_for_tool=lambda n: "file",
    )
    defaults.update(kwargs)
    buf_kwargs = dict(record=True, force_terminal=False, color_system=None, width=160)
    console = Console(**buf_kwargs)
    with (
        patch.object(banner, "get_update_result", return_value=None),
        patch.object(banner, "get_latest_release_tag", return_value=None),
        patch("shutil.get_terminal_size", return_value=__import__("os").terminal_size((160, 50))),
    ):
        banner.build_welcome_banner(console=console, **defaults)
    return console.export_text()


def test_build_welcome_banner_title_falls_back_when_no_tag():
    """Without a resolvable tag, the panel title renders as plain text (no hyperlink escape)."""
    import io
    from unittest.mock import patch as _patch
    import work4you_cli.banner as _banner

    _banner._latest_release_cache = None
    buf = io.StringIO()
    with (
        _patch.object(_banner, "get_update_result", return_value=None),
        _patch.object(_banner, "get_latest_release_tag", return_value=None),
    ):
        console = Console(file=buf, force_terminal=True, color_system="truecolor", width=160)
        _banner.build_welcome_banner(
            console=console, model="x", cwd="/tmp",
            session_id="abc123",
        )

    raw = buf.getvalue()
    assert "Work4You v" in raw, "Version label missing from title"
    assert "\x1b]8;" not in raw, "OSC-8 hyperlink should not be emitted without a tag"


def test_build_welcome_banner_non_moa_unchanged(tmp_path, monkeypatch):
    """A normal provider still renders the bare model slug, no MoA prefix."""
    monkeypatch.setenv("WORK4YOU_HOME", str(tmp_path / ".work4you"))
    (tmp_path / ".work4you").mkdir()

    out = _render_splash(model="anthropic/claude-opus-4.8", provider="openrouter")
    assert "claude-opus-4.8" in out
    assert "MoA:" not in out


def test_splash_shows_session_facts_not_catalog():
    """Opening splash is identity + session — not a tools/skills/MCP dump."""
    out = _render_splash(
        skills_by_category={"research": ["skill-00", "skill-01"]},
    )
    assert "claude-opus-4.8" in out
    assert "/tmp/project" in out
    assert "Session: abc123" in out
    assert "/help for commands" in out
    assert "Available Tools" not in out
    assert "Available Skills" not in out
    assert "MCP Servers" not in out
    assert "read_file" not in out
    assert "skill-00" not in out
    assert "HERMES" not in out
    assert "HERMES AGENT" not in out


def test_splash_shows_operis_not_house_wire_id():
    """Free-plan house model is Operis on the splash, not the upstream wire id."""
    from work4you_cli.models import WORK4YOU_HOUSE_MODEL_ID

    for wire_id in (WORK4YOU_HOUSE_MODEL_ID, "deepseek/deepseek-v4-flash-0731"):
        out = _render_splash(model=wire_id, provider="work4you")
        assert "Operis 4.0 Flash" in out
        assert "gemini-3.8-flash" not in out
        assert "deepseek-v4-flash-0731" not in out
        assert "deepseek-v4-flash" not in out


def test_splash_does_not_print_default_wordmark():
    """Default splash has no giant WORK4YOU / HERMES lettering."""
    out = _render_splash()
    assert "██╗  ██╗" not in out
    assert "HERMES" not in out


def test_custom_skin_logo_still_prints_above_splash():
    """Mythology skins keep their banner_logo wordmark."""
    set_active_skin("ares")
    try:
        out = _render_splash()
        assert "ARES" in out.upper() or "╗" in out
        assert "Available Tools" not in out
        assert "Available Skills" not in out
    finally:
        set_active_skin("default")
