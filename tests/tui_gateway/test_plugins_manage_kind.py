"""plugins.manage ``list`` reports each plugin's manifest ``kind``.

Backend / platform / model-provider kinds are active without an explicit
enable and are configured from their own surfaces; clients keep them out of
a plugins list by this field instead of guessing from the key prefix.
"""

import json

from tui_gateway import server
from work4you_cli.agent_plugins import PLUGIN_SCHEMA_V1


def _native(plugins_dir, name, body):
    d = plugins_dir / name
    d.mkdir(parents=True)
    (d / "plugin.yaml").write_text(
        f"name: {name}\nversion: '1.0'\n{body}", encoding="utf-8"
    )


def test_plugins_manage_list_reports_manifest_kind(tmp_path, monkeypatch):
    profile_home = tmp_path / "profiles" / "botA"
    plugins_dir = profile_home / "plugins"
    _native(plugins_dir, "tidy", "description: no kind field\n")
    _native(plugins_dir, "search-x", "kind: Backend\ndescription: a search backend\n")
    portable = plugins_dir / "pack"
    portable.mkdir()
    (portable / "plugin.json").write_text(
        json.dumps(
            {
                "$schema": PLUGIN_SCHEMA_V1,
                "name": "pack",
                "version": "1.0.0",
                "description": "portable package",
            }
        ),
        encoding="utf-8",
    )

    import work4you_cli.profiles as profiles

    monkeypatch.setattr(profiles, "get_profile_dir", lambda name: profile_home)

    resp = server.handle_request(
        {
            "id": "1",
            "method": "plugins.manage",
            "params": {"action": "list", "profile": "botA"},
        }
    )

    assert "result" in resp, resp
    rows = resp["result"]["plugins"]
    kinds = {row["name"]: row["kind"] for row in rows if row.get("source") == "user"}
    # An absent field is a standalone plugin; a declared kind comes back normalized.
    assert kinds["tidy"] == "standalone"
    assert kinds["search-x"] == "backend"
    # Portable packages have no native manifest, hence no kind.
    assert kinds["pack"] is None
    # Every row carries the field, bundled ones included, lower-cased or None.
    assert all("kind" in row for row in rows)
    assert all(row["kind"] is None or row["kind"] == row["kind"].lower() for row in rows)
