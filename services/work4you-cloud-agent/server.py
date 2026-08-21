"""Minimal Work4You Cloud agent HTTP surface until the full agent image ships.

Serves health + a branded /sessions landing so Open Dashboard has a reachable URL.
Replace WORK4YOU_AGENT_IMAGE with the full Work4You container when ready.
"""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


PORT = int(os.environ.get("WORK4YOU_DASHBOARD_PORT") or os.environ.get("PORT") or "8080")
INSTANCE = os.environ.get("WORK4YOU_CLOUD_INSTANCE_ID", "")
PORTAL = os.environ.get("PORTAL_URL", "https://portal.work4you.ai")


HTML = """<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Work4You Cloud</title>
  <style>
    :root {{ --papel:#f5f4ee; --tinta:#151515; --oliva:#4d5943; --grafite:#6e6e68; }}
    body {{ margin:0; font-family:"Plus Jakarta Sans",system-ui,sans-serif; background:var(--papel); color:var(--tinta); }}
    main {{ max-width:40rem; margin:0 auto; padding:3.5rem 1.25rem; }}
    .eyebrow {{ font-size:.7rem; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--oliva); }}
    h1 {{ margin:.55rem 0 0; font-size:clamp(1.8rem,4vw,2.4rem); letter-spacing:-.03em; }}
    p {{ color:var(--grafite); line-height:1.5; }}
    a {{ color:var(--oliva); font-weight:700; }}
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Work4You Cloud</p>
    <h1>Agent online</h1>
    <p>Esta VM está provisionada. O runtime completo do agent (dashboard + gateway) substitui esta página de arranque em breve.</p>
    <p>Portal: <a href="{portal}">{portal}</a></p>
    <p>Instance: <code>{instance}</code></p>
  </main>
</body>
</html>
""".format(portal=PORTAL, instance=INSTANCE or "—")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # quieter Fly logs
        return

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = self.path.split("?", 1)[0]
        if path in ("/health", "/healthz", "/api/health"):
            payload = json.dumps({"ok": True, "service": "work4you-cloud-runtime", "instance": INSTANCE}).encode()
            self._send(200, payload, "application/json")
            return
        if path in ("/", "/sessions", "/login", "/chat"):
            self._send(200, HTML.encode("utf-8"), "text/html; charset=utf-8")
            return
        self._send(404, b'{"error":"not_found"}', "application/json")


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"work4you-cloud-runtime listening on {PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
