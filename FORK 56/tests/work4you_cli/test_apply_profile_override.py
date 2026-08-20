"""Regression tests for _apply_profile_override WORK4YOU_HOME guard (issue #22502).

When WORK4YOU_HOME is set to the work4you root (e.g. systemd hardcodes
WORK4YOU_HOME=/root/.work4you), _apply_profile_override must still read
active_profile and update WORK4YOU_HOME to the profile directory.

When WORK4YOU_HOME is already a profile directory (.../profiles/<name>),
_apply_profile_override must trust it and return without re-reading
active_profile (child-process inheritance contract).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from types import SimpleNamespace


def _run_apply_profile_override(
    tmp_path, monkeypatch, *, work4you_home: str | None, active_profile: str | None,
    argv: list[str] | None = None,
):
    """Run _apply_profile_override in isolation.

    Returns the value of os.environ["WORK4YOU_HOME"] after the call,
    or None if unset.
    """
    work4you_root = tmp_path / ".work4you"
    work4you_root.mkdir(parents=True, exist_ok=True)

    if active_profile is not None:
        (work4you_root / "active_profile").write_text(active_profile)

    if active_profile and active_profile != "default":
        (work4you_root / "profiles" / active_profile).mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    if work4you_home is not None:
        monkeypatch.setenv("WORK4YOU_HOME", work4you_home)
    else:
        monkeypatch.delenv("WORK4YOU_HOME", raising=False)

    monkeypatch.setattr(sys, "argv", argv or ["work4you", "gateway", "start"])

    from work4you_cli.main import _apply_profile_override
    _apply_profile_override()

    return os.environ.get("WORK4YOU_HOME")


class TestApplyProfileOverrideWork4YouHomeGuard:
    """Regression guard for issue #22502.

    Verifies that WORK4YOU_HOME pointing to the work4you root does NOT suppress
    the active_profile check, while WORK4YOU_HOME already pointing to a
    profile directory IS trusted as-is.
    """

    def test_work4you_home_at_root_with_active_profile_is_redirected(
        self, tmp_path, monkeypatch
    ):
        """WORK4YOU_HOME=/root/.work4you + active_profile=coder must redirect
        WORK4YOU_HOME to .../profiles/coder.

        Bug scenario from #22502: systemd sets WORK4YOU_HOME to the work4you root
        and the user switches to a profile via `work4you profile use`.
        Before the fix, the guard returned early and active_profile was ignored.
        """
        work4you_root = tmp_path / ".work4you"
        work4you_root.mkdir(parents=True, exist_ok=True)

        result = _run_apply_profile_override(
            tmp_path,
            monkeypatch,
            work4you_home=str(work4you_root),
            active_profile="coder",
        )

        assert result is not None, "WORK4YOU_HOME must be set after profile redirect"
        assert "profiles" in result, (
            f"Expected WORK4YOU_HOME to point into profiles/ dir, got: {result!r}"
        )
        assert result.endswith("coder"), (
            f"Expected WORK4YOU_HOME to end with 'coder', got: {result!r}"
        )


    def test_sudo_explicit_profile_resolves_invoking_users_profile(self, tmp_path, monkeypatch):
        """sudo elias ... should resolve `-p elias` under SUDO_USER, not root."""
        root_home = tmp_path / "root"
        user_home = tmp_path / "home" / "work4you"
        profile_dir = user_home / ".work4you" / "profiles" / "elias"
        profile_dir.mkdir(parents=True, exist_ok=True)
        (root_home / ".work4you").mkdir(parents=True, exist_ok=True)

        monkeypatch.setattr(Path, "home", lambda: root_home)
        monkeypatch.setenv("SUDO_USER", "work4you")
        monkeypatch.delenv("WORK4YOU_HOME", raising=False)
        monkeypatch.setattr(os, "geteuid", lambda: 0, raising=False)
        monkeypatch.setattr(sys, "argv", ["work4you", "-p", "elias", "gateway", "install", "--system"])

        import pwd

        monkeypatch.setattr(pwd, "getpwnam", lambda name: SimpleNamespace(pw_dir=str(user_home)))

        from work4you_cli.main import _apply_profile_override
        _apply_profile_override()

        assert os.environ.get("WORK4YOU_HOME") == str(profile_dir)
        assert sys.argv == ["work4you", "gateway", "install", "--system"]




class TestSupervisedChildIgnoresStickyProfile:
    """The reserved default gateway s6 slot must not follow active_profile.

    Inside the Docker s6 image the ``gateway-default`` service slot runs a
    bare ``work4you gateway run`` (no ``-p``) to mean "the root WORK4YOU_HOME
    profile". The run-script exports ``WORK4YOU_S6_SUPERVISED_CHILD=1``.
    Without a guard, ``_apply_profile_override`` would read the sticky
    ``active_profile`` file (set by e.g. the dashboard profile switcher) and
    redirect the reserved default gateway into that profile — producing a
    duplicate gateway for the active profile and no real default gateway.
    """


    def test_non_supervised_run_still_follows_active_profile(
        self, tmp_path, monkeypatch
    ):
        """Without the sentinel, a normal `work4you gateway run` still honors
        active_profile — the guard is scoped strictly to supervised children."""
        result = _run_apply_profile_override(
            tmp_path,
            monkeypatch,
            work4you_home=None,
            active_profile="briefer",
            argv=["work4you", "gateway", "run"],
        )

        assert result is not None
        assert result.endswith("briefer")

    def test_supervised_named_profile_flag_still_wins(self, tmp_path, monkeypatch):
        """A supervised named-profile slot passes ``-p <name>`` explicitly;
        that must still resolve (the sentinel guard only skips the sticky
        active_profile fallback, never an explicit flag)."""
        work4you_root = tmp_path / ".work4you"
        work4you_root.mkdir(parents=True, exist_ok=True)
        (work4you_root / "active_profile").write_text("briefer")
        (work4you_root / "profiles" / "briefer").mkdir(parents=True, exist_ok=True)
        (work4you_root / "profiles" / "coder").mkdir(parents=True, exist_ok=True)

        monkeypatch.setattr(Path, "home", lambda: tmp_path)
        monkeypatch.delenv("WORK4YOU_HOME", raising=False)
        monkeypatch.setenv("WORK4YOU_S6_SUPERVISED_CHILD", "1")
        monkeypatch.setattr(sys, "argv", ["work4you", "-p", "coder", "gateway", "run"])

        from work4you_cli.main import _apply_profile_override
        _apply_profile_override()

        result = os.environ.get("WORK4YOU_HOME")
        assert result is not None
        assert result.endswith("coder")

