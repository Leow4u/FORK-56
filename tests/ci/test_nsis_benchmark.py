"""Real filesystem checks for comparing unchanged NSIS payloads safely."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


source = Path(__file__).resolve().parents[2] / "scripts/ci/benchmark_nsis_install.py"
spec = importlib.util.spec_from_file_location("benchmark_nsis_install", source)
benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(benchmark)


def inventory_for(root):
    return [{"path": path.relative_to(root).as_posix(), "sha256": benchmark.sha256_file(path),
             "bytes": path.stat().st_size} for path in sorted(root.rglob("*")) if path.is_file()]


@pytest.fixture
def payload(tmp_path):
    root = tmp_path / "payload"
    (root / "resources/runtime").mkdir(parents=True)
    (root / "Work4You.exe").write_bytes(b"application fixture")
    (root / "resources/runtime/model.bin").write_bytes(b"required offline capability")
    (root / "resources/runtime/configuração.json").write_text("{}", encoding="utf-8")
    return root, inventory_for(root)


@pytest.fixture
def manifest(tmp_path, payload):
    _, inventory = payload
    (tmp_path / "payload-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False), encoding="utf-8")
    variants = {}
    for name in ("7z", "zip"):
        path = tmp_path / name / "Setup.exe"
        path.parent.mkdir()
        path.write_bytes(f"{name} identity fixture, never executed".encode())
        variants[name] = {"relativePath": f"{name}/Setup.exe", "path": "unused build-runner absolute path",
                          "sha256": benchmark.sha256_file(path), "bytes": path.stat().st_size,
                          "useZip": name == "zip", "differentialPackage": name == "7z"}
    data = {"schemaVersion": 1, "source": {"commit": "a" * 40, "installerSha256": "b" * 64},
            "product": {"appId": "test.app", "productName": "Work4You",
                        "uninstallRegistryKey": "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"
                                                "00000000-0000-4000-8000-000000000001"},
            "payload": {"inventoryRelativePath": "payload-inventory.json",
                        "fingerprintSha256": benchmark.inventory_fingerprint(inventory),
                        "files": len(inventory), "totalBytes": sum(item["bytes"] for item in inventory)},
            "variants": variants}
    path = tmp_path / "benchmark-manifest.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path, data


@pytest.mark.parametrize("order", ["7z,zip", "zip,7z"])
def test_order_uses_each_variant_once(order):
    assert benchmark.parse_order(order) == order.split(",")


@pytest.mark.parametrize("order", ["7z", "zip,zip", "7z,zip,7z", "zip,unknown"])
def test_order_rejects_biased_or_incomplete_sequences(order):
    with pytest.raises(ValueError, match="exactly once"):
        benchmark.parse_order(order)


def test_manifest_uses_portable_paths_and_verifies_actual_artifacts(manifest):
    path, data = manifest
    loaded, inventory, variants = benchmark.load_inputs(path)
    assert loaded == data
    assert benchmark.inventory_fingerprint(inventory) == data["payload"]["fingerprintSha256"]
    assert variants["zip"] == path.parent / "zip/Setup.exe"
    variants["zip"].write_bytes(b"tampered installer")
    with pytest.raises(ValueError, match="zip installer differs"):
        benchmark.load_inputs(path)


def test_inventory_tampering_is_detected(manifest):
    path, _ = manifest
    inventory_path = path.parent / "payload-inventory.json"
    items = json.loads(inventory_path.read_text(encoding="utf-8"))
    items.pop()
    inventory_path.write_text(json.dumps(items), encoding="utf-8")
    with pytest.raises(ValueError, match="fingerprint"):
        benchmark.load_inputs(path)


@pytest.mark.parametrize("relative", ["../outside", "/absolute", "C:/absolute", "dir/../outside", "dir\\file"])
def test_manifest_paths_cannot_escape_artifact_directory(tmp_path, relative):
    with pytest.raises(ValueError, match="Unsafe"):
        benchmark.relative_file(tmp_path, relative)


def test_inventory_rejects_windows_case_collisions(payload):
    _, inventory = payload
    inventory.append({**inventory[0], "path": inventory[0]["path"].upper()})
    with pytest.raises(ValueError, match="duplicate Windows paths"):
        benchmark.validate_inventory(inventory)


def test_full_payload_identity_allows_only_known_nsis_additions(payload):
    root, inventory = payload
    (root / "Uninstall Work4You.exe").write_bytes(b"generated uninstaller")
    (root / "uninstallerIcon.ico").write_bytes(b"generated icon")
    result = benchmark.verify_installed_payload(root, inventory, "Work4You")
    assert result["verified"]
    assert result["fingerprintSha256"] == benchmark.inventory_fingerprint(inventory)
    assert result["files"] == len(inventory)
    (root / "Uninstall another-app.exe").write_bytes(b"unexpected")
    with pytest.raises(ValueError, match="unexpected"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")


def test_payload_identity_detects_same_size_corruption(payload):
    root, inventory = payload
    target = root / inventory[0]["path"]
    target.write_bytes(b"!" * target.stat().st_size)
    with pytest.raises(ValueError, match="file changed"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")


def test_payload_identity_detects_missing_capability(payload):
    root, inventory = payload
    (root / "resources/runtime/model.bin").unlink()
    with pytest.raises(ValueError, match="missing"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")


@pytest.mark.linux_only
def test_payload_identity_refuses_symlink_escape(payload, tmp_path):
    root, inventory = payload
    outside = tmp_path / "outside"
    outside.write_bytes(b"external")
    (root / "outside-link").symlink_to(outside)
    with pytest.raises(ValueError, match="filesystem link"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")


def test_cleanup_only_accepts_generated_sandbox_layout(tmp_path):
    sandbox = tmp_path / "work4you-install-smoke-random"
    data = {"sandbox": str(sandbox), "installDir": str(sandbox / "Installed App"),
            "work4youHome": str(sandbox / "user-data")}
    assert benchmark.sandbox_paths(data, tmp_path) == (sandbox, sandbox / "Installed App", sandbox / "user-data")
    with pytest.raises(ValueError, match="Refusing cleanup"):
        benchmark.sandbox_paths({**data, "installDir": str(tmp_path / "existing-app")}, tmp_path)
    with pytest.raises(ValueError, match="Refusing cleanup"):
        benchmark.sandbox_paths(data, tmp_path / "other-parent")


def test_progress_persists_partial_results_and_refuses_overwriting(tmp_path):
    progress = benchmark.Progress(tmp_path)
    progress.save({"success": False, "variants": []})
    progress.emit("started", variant="zip")
    assert not json.loads(progress.report.read_text())["success"]
    assert json.loads(progress.events.read_text())["event"] == "started"
    progress.save({"success": True, "variants": [{"variant": "zip"}]})
    assert json.loads(progress.report.read_text())["success"]
    with pytest.raises(ValueError, match="already contains"):
        benchmark.Progress(tmp_path)


@pytest.mark.windows_only
def test_registry_probe_reads_missing_product_keys_without_mutation():
    import uuid

    assert benchmark.registry_entries({"uninstallRegistryKey":
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + str(uuid.uuid4())}) == []
