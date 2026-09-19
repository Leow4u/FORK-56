#!/usr/bin/env python3
"""Apply Privy Dashboard Name + Logo used in OTP emails.

OTP HTML is hosted by Privy. The non-Enterprise lever is app settings:
  name      → “Logging in to {name}”
  logo_url  → PNG in the inbox (180×90 / 2:1 recommended; not SVG)

Auth: PRIVY_APP_ID + PRIVY_APP_SECRET (Basic app_id:app_secret).
Canonical host: https://api.privy.io  (docs: REST API base URL).

  python3 cloud/nas-sync/scripts/apply-privy-email-branding.py
  python3 cloud/nas-sync/scripts/apply-privy-email-branding.py --check
  python3 cloud/nas-sync/scripts/apply-privy-email-branding.py --logo-url https://example.com/logo.png
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request

DASHBOARD_APP_NAME = "Work4You"
EMAIL_LOGO_URL = "https://portal.work4you.ai/brand/work4you-email-logo.png"
GITHUB_FALLBACK_LOGO_URL = (
    "https://raw.githubusercontent.com/Leow4u/FORK-56/"
    "cursor/portal-email-otp-step-de50/"
    "sites/work4you-portal/public/brand/work4you-email-logo.png"
)
USER_AGENT = "Work4You-Portal-Branding/1.0 (+https://portal.work4you.ai)"


def _request(method: str, url: str, token: str, app_id: str, body: dict | None = None) -> tuple[int, dict]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Basic {token}")
    req.add_header("privy-app-id", app_id)
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw or "{}")
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", "replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = {"raw": raw[:500]}
        return exc.code, parsed


def _png_url_ok(url: str) -> bool:
    req = urllib.request.Request(url, method="GET")
    req.add_header("User-Agent", USER_AGENT)
    req.add_header("Accept", "image/png,image/*")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
            head = resp.read(8)
            return content_type == "image/png" and head == b"\x89PNG\r\n\x1a\n"
    except Exception:
        return False


def resolve_logo_url(explicit: str | None) -> str:
    if explicit:
        return explicit
    if _png_url_ok(EMAIL_LOGO_URL):
        return EMAIL_LOGO_URL
    if _png_url_ok(GITHUB_FALLBACK_LOGO_URL):
        return GITHUB_FALLBACK_LOGO_URL
    return EMAIL_LOGO_URL


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="GET only; do not POST")
    parser.add_argument("--logo-url", help="Override logo_url")
    args = parser.parse_args()

    app_id = os.environ.get("PRIVY_APP_ID", "").strip()
    secret = os.environ.get("PRIVY_APP_SECRET", "").strip()
    if not app_id or not secret:
        print("PRIVY_APP_ID / PRIVY_APP_SECRET missing", file=sys.stderr)
        return 2

    token = base64.b64encode(f"{app_id}:{secret}".encode()).decode()
    api_url = f"https://api.privy.io/v1/apps/{app_id}"
    auth_url = f"https://auth.privy.io/api/v1/apps/{app_id}"

    if args.check:
        for label, url in (("api", api_url), ("auth", auth_url)):
            status, body = _request("GET", url, token, app_id)
            print(f"GET {label} {status} name={body.get('name')!r} logo_url={body.get('logo_url')!r}")
        return 0

    logo_url = resolve_logo_url(args.logo_url)
    payload = {"name": DASHBOARD_APP_NAME, "logo_url": logo_url}
    status, body = _request("POST", api_url, token, app_id, payload)
    print(f"POST api {status} name={body.get('name')!r} logo_url={body.get('logo_url')!r}")
    if status != 200 or body.get("name") != DASHBOARD_APP_NAME or body.get("logo_url") != logo_url:
        return 1

    # Best-effort: keep auth.privy.io in sync (SDK cache host).
    auth_status, auth_body = _request("POST", auth_url, token, app_id, payload)
    print(
        f"POST auth {auth_status} name={auth_body.get('name')!r} "
        f"logo_url={auth_body.get('logo_url')!r}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
