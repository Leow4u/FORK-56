"""GitHub CLI (``gh``) login for the desktop / dashboard.

Capabilities → MCP shows a "GitHub CLI" connector. Unlike the Work4You Apps
(Composio) row, this one represents the *local* ``gh`` on the backend host —
the credential the agent's terminal, ``git`` and the bundled ``github-*``
skills actually use for clone / push / PR / CI.

Flow (RFC 8628 device code, same mechanics as
:func:`work4you_cli.copilot_auth.copilot_device_code_login` but returning data
instead of printing):

1. :func:`request_device_code` asks GitHub for a ``user_code`` using gh's own
   public OAuth client id, so the consent screen reads "GitHub CLI" and no
   Work4You-registered app is needed.
2. The UI shows the code and opens ``verification_uri``; the backend polls
   :func:`poll_access_token` on a thread.
3. On approval the token is handed to ``gh auth login --with-token`` and never
   written to ``.env`` — ``gh``'s own store (keyring / ``hosts.yml``) is the
   single source of truth, exactly as if the user had run ``gh auth login``.
   ``gh auth setup-git`` then wires git's credential helper so ``git push``
   works without prompting.

Everything here is synchronous and pure enough to unit-test with mocked
``urllib`` / ``subprocess``; the FastAPI surface lives in
:mod:`work4you_cli.web_routers.gh_auth`.
"""

from __future__ import annotations

import json
import logging
import os
import stat
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from work4you_cli._subprocess_compat import (
    IS_WINDOWS,
    kill_process_tree,
    noninteractive_git_env,
    windows_hide_flags,
)
from work4you_cli.copilot_auth import _gh_cli_candidates

logger = logging.getLogger(__name__)

# gh's public OAuth client id (the one ``gh auth login`` itself uses). Device
# flow needs no client secret. Documented in optional-skills/github/github-auth.
GH_DEVICE_CLIENT_ID = "178c6fc778ccc68e1d6a"
# What the bundled github-* skills need: push, PRs, CI workflow files, org
# repos, gists. Same set ``gh auth login`` requests by default plus ``workflow``.
GH_DEVICE_SCOPES = "repo workflow read:org gist"
GH_HOST = "github.com"

_HTTP_TIMEOUT = 15
_POLL_DEFAULT_INTERVAL = 5
_POLL_SAFETY_MARGIN = 1
_GH_TIMEOUT = 10
_WITH_TOKEN_TIMEOUT = 20
_USER_AGENT = "Work4YouAgent/1.0"

# Terminal device-flow outcomes. ``pending`` means keep polling.
PENDING = "pending"
APPROVED = "approved"
DENIED = "denied"
EXPIRED = "expired"
ERROR = "error"


# ─── gh binary / env ─────────────────────────────────────────────────────────


def find_gh_binary() -> Optional[str]:
    """First usable ``gh`` on this host, or ``None``.

    PATH first, then the well-known install locations (Homebrew, ``~/.local``,
    Program Files / WinGet on Windows) — a GUI-launched backend often has a
    narrower PATH than the user's shell.
    """
    candidates = _gh_cli_candidates()
    return candidates[0] if candidates else None


def gh_env() -> Dict[str, str]:
    """Environment for *our* ``gh`` invocations.

    ``GH_TOKEN`` / ``GITHUB_TOKEN`` are stripped so ``gh`` reads and writes its
    own credential store instead of short-circuiting on an env token (the same
    rule :func:`copilot_auth._try_gh_cli_token` applies). Prompts are disabled:
    these serve REST requests and must fail fast rather than wait on a TTY.
    """
    env = noninteractive_git_env()
    env.pop("GH_TOKEN", None)
    env.pop("GITHUB_TOKEN", None)
    env["GH_PROMPT_DISABLED"] = "1"
    return env


def _run_gh(gh: str, args: list[str], *, timeout: int = _GH_TIMEOUT,
            input_text: Optional[str] = None) -> subprocess.CompletedProcess:
    kwargs: Dict[str, Any] = {
        "capture_output": True,
        "text": True,
        "encoding": "utf-8",
        "errors": "replace",
        "timeout": timeout,
        "env": gh_env(),
        "creationflags": windows_hide_flags(),
    }
    if input_text is None:
        kwargs["stdin"] = subprocess.DEVNULL
    else:
        kwargs["input"] = input_text
    return subprocess.run([gh, *args], **kwargs)


def gh_config_dir() -> Path:
    """Where ``gh`` keeps ``hosts.yml`` (mirrors gh's own resolution order)."""
    explicit = os.environ.get("GH_CONFIG_DIR", "").strip()
    if explicit:
        return Path(explicit)
    xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if xdg:
        return Path(xdg) / "gh"
    if IS_WINDOWS:
        appdata = os.environ.get("AppData", "").strip()
        if appdata:
            return Path(appdata) / "GitHub CLI"
    return Path.home() / ".config" / "gh"


# ─── status ──────────────────────────────────────────────────────────────────


def probe_status(gh: Optional[str] = None) -> Dict[str, Any]:
    """``{available, authenticated, login, host}`` for the local ``gh``.

    ``authenticated`` means ``gh auth status`` exits 0 for *some* host;
    ``login`` is the GitHub username when it can be read, else ``None``.
    Never prompts, never raises.
    """
    gh = gh or find_gh_binary()
    payload: Dict[str, Any] = {
        "available": bool(gh),
        "authenticated": False,
        "login": None,
        "host": GH_HOST,
    }
    if not gh:
        return payload
    try:
        status = _run_gh(gh, ["auth", "status", "-h", GH_HOST])
    except (OSError, subprocess.SubprocessError) as exc:
        logger.debug("gh auth status failed: %s", exc)
        return payload
    if status.returncode != 0:
        return payload
    payload["authenticated"] = True
    try:
        who = _run_gh(gh, ["api", "user", "--jq", ".login"])
        login = (who.stdout or "").strip()
        if who.returncode == 0 and login:
            payload["login"] = login
    except (OSError, subprocess.SubprocessError) as exc:
        logger.debug("gh api user failed: %s", exc)
    return payload


# ─── device code ─────────────────────────────────────────────────────────────


def _post_form(url: str, fields: Dict[str, str], *, timeout: int) -> Dict[str, Any]:
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": _USER_AGENT,
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode()
    parsed = json.loads(body) if body else {}
    return parsed if isinstance(parsed, dict) else {}


def request_device_code(*, host: str = GH_HOST) -> Dict[str, Any]:
    """Start the device flow. Returns the parsed GitHub response.

    Keys: ``device_code``, ``user_code``, ``verification_uri``, ``expires_in``,
    ``interval``. Raises ``RuntimeError`` when GitHub returns no code.
    """
    data = _post_form(
        f"https://{host}/login/device/code",
        {"client_id": GH_DEVICE_CLIENT_ID, "scope": GH_DEVICE_SCOPES},
        timeout=_HTTP_TIMEOUT,
    )
    if not data.get("device_code") or not data.get("user_code"):
        raise RuntimeError(data.get("error_description") or data.get("error") or "GitHub did not return a device code")
    data.setdefault("verification_uri", f"https://{host}/login/device")
    try:
        data["interval"] = max(int(data.get("interval") or _POLL_DEFAULT_INTERVAL), 1)
    except (TypeError, ValueError):
        data["interval"] = _POLL_DEFAULT_INTERVAL
    return data


def poll_access_token(
    device_code: str,
    *,
    interval: int = _POLL_DEFAULT_INTERVAL,
    timeout_seconds: float = 900,
    host: str = GH_HOST,
    should_stop: Optional[Callable[[], bool]] = None,
    sleep: Callable[[float], None] = time.sleep,
) -> tuple[str, Optional[str], Optional[str]]:
    """Poll until GitHub resolves the device code.

    Returns ``(status, access_token, error_message)`` where status is one of
    :data:`APPROVED`, :data:`DENIED`, :data:`EXPIRED`, :data:`ERROR`.
    ``should_stop`` is checked around every sleep so a cancelled session stops
    promptly; cancellation reports as :data:`ERROR` with message ``cancelled``.
    """
    deadline = time.monotonic() + timeout_seconds
    url = f"https://{host}/login/oauth/access_token"
    wait = max(int(interval), 1)
    while time.monotonic() < deadline:
        if should_stop and should_stop():
            return ERROR, None, "cancelled"
        sleep(wait + _POLL_SAFETY_MARGIN)
        if should_stop and should_stop():
            return ERROR, None, "cancelled"
        try:
            result = _post_form(
                url,
                {
                    "client_id": GH_DEVICE_CLIENT_ID,
                    "device_code": device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                },
                timeout=_HTTP_TIMEOUT,
            )
        except Exception as exc:  # network blip: keep polling
            logger.debug("device-code poll failed, retrying: %s", exc)
            continue
        token = result.get("access_token")
        if token:
            return APPROVED, str(token), None
        error = str(result.get("error") or "")
        if error == "authorization_pending":
            continue
        if error == "slow_down":
            server_interval = result.get("interval")
            if isinstance(server_interval, (int, float)) and server_interval > 0:
                wait = int(server_interval)
            else:
                wait += 5
            continue
        if error == "expired_token":
            return EXPIRED, None, "Device code expired"
        if error == "access_denied":
            return DENIED, None, "Authorization was denied"
        return ERROR, None, result.get("error_description") or error or "Authorization failed"
    return EXPIRED, None, "Timed out waiting for authorization"


# ─── hand the token to gh ────────────────────────────────────────────────────


def _lookup_login(token: str, *, host: str = GH_HOST) -> Optional[str]:
    api_host = "api.github.com" if host == GH_HOST else f"{host}/api/v3"
    req = urllib.request.Request(
        f"https://{api_host}/user",
        headers={"Authorization": f"token {token}", "Accept": "application/json", "User-Agent": _USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
            data = json.loads(resp.read().decode() or "{}")
    except Exception as exc:
        logger.debug("GitHub /user lookup failed: %s", exc)
        return None
    login = data.get("login") if isinstance(data, dict) else None
    return str(login) if login else None


def write_hosts_yml(token: str, login: str, *, host: str = GH_HOST, config_dir: Optional[Path] = None) -> Path:
    """Write ``gh``'s file credential store directly (mode 600).

    Fallback for the documented headless-keyring hang: ``gh auth status`` and
    ``gh auth setup-git`` read this file without touching a keyring.
    """
    directory = config_dir or gh_config_dir()
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "hosts.yml"
    body = (
        f"{host}:\n"
        f"    users:\n"
        f"        {login}:\n"
        f"            oauth_token: {token}\n"
        f"    git_protocol: https\n"
        f"    oauth_token: {token}\n"
        f"    user: {login}\n"
    )
    # Create/truncate with owner-only perms before writing the secret.
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, stat.S_IRUSR | stat.S_IWUSR)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(body)
    try:
        os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
    except OSError:
        pass
    return path


def store_token_in_gh(gh: str, token: str, *, host: str = GH_HOST) -> Optional[str]:
    """Persist ``token`` in ``gh``'s credential store. Returns the login.

    Tries ``gh auth login --with-token`` first (keyring when available). If
    that hangs (headless Linux without a secret service) the process tree is
    killed and ``hosts.yml`` is written directly. Raises ``RuntimeError`` when
    neither path works.
    """
    proc: Optional[subprocess.Popen] = None
    hung = False
    try:
        proc = subprocess.Popen(
            [gh, "auth", "login", "--with-token", "-h", host, "--git-protocol", "https"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=gh_env(),
            creationflags=windows_hide_flags(),
        )
        try:
            out, _ = proc.communicate(input=token + "\n", timeout=_WITH_TOKEN_TIMEOUT)
        except subprocess.TimeoutExpired:
            hung = True
            kill_process_tree(proc)
            try:
                proc.communicate(timeout=5)
            except Exception:
                pass
            out = ""
    except OSError as exc:
        raise RuntimeError(f"Could not run gh: {exc}") from exc

    if not hung and proc is not None and proc.returncode == 0:
        login = _lookup_login(token, host=host)
        return login

    login = _lookup_login(token, host=host)
    if not login:
        detail = "gh auth login --with-token timed out" if hung else (out or "").strip() or "gh auth login failed"
        raise RuntimeError(detail)
    logger.warning(
        "gh auth login --with-token %s; writing hosts.yml directly",
        "hung (keyring?)" if hung else f"failed: {(out or '').strip()[:200]}",
    )
    write_hosts_yml(token, login, host=host)
    return login


def setup_git(gh: str, *, host: str = GH_HOST) -> bool:
    """``gh auth setup-git`` so plain ``git push`` uses gh's credential. Best effort."""
    try:
        proc = _run_gh(gh, ["auth", "setup-git", "-h", host], timeout=_WITH_TOKEN_TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("gh auth setup-git failed: %s", exc)
        return False
    if proc.returncode != 0:
        logger.warning("gh auth setup-git exited %s: %s", proc.returncode, (proc.stderr or proc.stdout or "").strip()[:300])
        return False
    return True


def logout(gh: str, *, host: str = GH_HOST) -> bool:
    """``gh auth logout`` for ``host``. Returns True when gh reports success."""
    try:
        proc = _run_gh(gh, ["auth", "logout", "-h", host], timeout=_WITH_TOKEN_TIMEOUT)
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning("gh auth logout failed: %s", exc)
        return False
    return proc.returncode == 0


def complete_login(gh: str, token: str, *, host: str = GH_HOST) -> Dict[str, Any]:
    """Store the token, wire git, and report ``{login, setup_git}``."""
    login = store_token_in_gh(gh, token, host=host)
    wired = setup_git(gh, host=host)
    return {"login": login, "setup_git": wired}
