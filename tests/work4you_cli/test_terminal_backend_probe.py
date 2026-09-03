"""Terminal backend health probes used by GET /api/tools/terminal/backends."""


def test_modal_probe_ready_via_work4you_subscription(monkeypatch):
    """NAS-managed Modal must report Ready without BYOK tokens."""
    import work4you_cli.web_server as web_server

    monkeypatch.setattr(
        "tools.tool_backend_helpers.has_direct_modal_credentials",
        lambda: False,
    )
    monkeypatch.setattr(
        "tools.tool_backend_helpers.managed_work4you_tools_enabled",
        lambda **kwargs: True,
    )
    monkeypatch.setattr(
        "tools.managed_tool_gateway.is_managed_tool_gateway_ready",
        lambda vendor, **kwargs: vendor == "modal",
    )

    status, detail = web_server._probe_modal_backend({"modal_mode": "auto"})
    assert status == "ready"
    assert "Work4You" in detail


def test_modal_probe_ready_via_direct_credentials(monkeypatch):
    import work4you_cli.web_server as web_server

    monkeypatch.setattr(
        "tools.tool_backend_helpers.has_direct_modal_credentials",
        lambda: True,
    )
    monkeypatch.setattr(
        "tools.managed_tool_gateway.is_managed_tool_gateway_ready",
        lambda vendor, **kwargs: False,
    )

    status, detail = web_server._probe_modal_backend({"modal_mode": "auto"})
    assert status == "ready"


def test_modal_probe_does_not_ask_for_vendor_tokens(monkeypatch):
    import work4you_cli.web_server as web_server

    monkeypatch.setattr(
        "tools.tool_backend_helpers.has_direct_modal_credentials",
        lambda: False,
    )
    monkeypatch.setattr(
        "tools.tool_backend_helpers.managed_work4you_tools_enabled",
        lambda **kwargs: False,
    )
    monkeypatch.setattr(
        "tools.managed_tool_gateway.is_managed_tool_gateway_ready",
        lambda vendor, **kwargs: False,
    )
    monkeypatch.setattr(
        "work4you_cli.config.get_env_value",
        lambda key: "",
    )

    status, detail = web_server._probe_modal_backend({"modal_mode": "auto"})
    assert status == "needs_setup"
    assert "MODAL_TOKEN" not in detail
    assert "modal setup" not in detail.lower()
    assert "Work4You" in detail
