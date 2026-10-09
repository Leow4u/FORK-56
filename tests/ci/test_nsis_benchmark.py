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


@pytest.fixture(params=["zip", "7z-direct"])
def manifest(tmp_path, payload, request):
    _, inventory = payload
    (tmp_path / "payload-inventory.json").write_text(json.dumps(inventory, ensure_ascii=False), encoding="utf-8")
    variants = {}
    for name in ("7z", request.param):
        path = tmp_path / name / "Setup.exe"
        path.parent.mkdir()
        path.write_bytes(f"{name} identity fixture, never executed".encode())
        variants[name] = {"relativePath": f"{name}/Setup.exe", "path": "unused build-runner absolute path",
                          "sha256": benchmark.sha256_file(path), "bytes": path.stat().st_size,
                          "useZip": name == "zip", "differentialPackage": name != "zip"}
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


@pytest.mark.parametrize("order", ["7z,zip", "zip,7z", "7z,7z-direct", "7z-direct,7z"])
def test_order_uses_each_variant_once(order):
    assert benchmark.parse_order(order) == order.split(",")


@pytest.mark.parametrize("order", ["7z", "zip,zip", "7z,zip,7z", "zip,unknown", "zip,7z-direct", "7z-direct,7z-direct"])
def test_order_rejects_biased_or_incomplete_sequences(order):
    with pytest.raises(ValueError, match="exactly once"):
        benchmark.parse_order(order)


def test_manifest_uses_portable_paths_and_verifies_actual_artifacts(manifest):
    path, data = manifest
    loaded, inventory, variants = benchmark.load_inputs(path)
    assert loaded == data
    assert benchmark.inventory_fingerprint(inventory) == data["payload"]["fingerprintSha256"]
    candidate = next(name for name in variants if name != "7z")
    assert variants[candidate] == path.parent / candidate / "Setup.exe"
    variants[candidate].write_bytes(b"tampered installer")
    with pytest.raises(ValueError, match=f"{candidate} installer differs"):
        benchmark.load_inputs(path)


@pytest.mark.parametrize("invalid", ["missing-baseline", "two-candidates"])
def test_manifest_rejects_missing_baseline_or_multiple_candidates(manifest, invalid):
    path, data = manifest
    if invalid == "missing-baseline":
        data["variants"].pop("7z")
    else:
        other = "zip" if "7z-direct" in data["variants"] else "7z-direct"
        data["variants"][other] = data["variants"]["7z"]
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="Unsupported benchmark manifest"):
        benchmark.load_inputs(path)


def test_manifest_checks_candidate_compression_contract(manifest):
    path, data = manifest
    candidate = next(name for name in data["variants"] if name != "7z")
    data["variants"][candidate]["differentialPackage"] = not data["variants"][candidate]["differentialPackage"]
    path.write_text(json.dumps(data), encoding="utf-8")
    with pytest.raises(ValueError, match="compression settings"):
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
    with pytest.raises(benchmark.PayloadIntegrityError) as raised:
        benchmark.verify_installed_payload(root, inventory, "Work4You")
    assert raised.value.changed == [inventory[0]["path"]]


def test_payload_identity_detects_missing_capability(payload):
    root, inventory = payload
    (root / "resources/runtime/model.bin").unlink()
    with pytest.raises(ValueError, match="missing"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")


def test_integrity_error_lists_all_defects_and_hashes_remaining_files(payload):
    root, _ = payload
    for index in range(12):
        (root / f"missing-{index:02}.bin").write_bytes(b"expected file")
    inventory = inventory_for(root)
    for path in root.glob("missing-*"):
        path.unlink()
    # Corruption still has to be found when other expected files are missing.
    (root / "Work4You.exe").write_bytes(b"application changed")
    model = root / "resources/runtime/model.bin"
    model.write_bytes(b"!" * model.stat().st_size)
    (root / "unexpected.bin").write_bytes(b"unexpected content")
    (root / "uninstallerIcon.ico").write_bytes(b"generated icon")
    with pytest.raises(benchmark.PayloadIntegrityError) as raised:
        benchmark.verify_installed_payload(root, inventory, "Work4You")
    error = raised.value
    assert error.missing == [f"missing-{index:02}.bin" for index in range(12)]
    assert error.unexpected == ["unexpected.bin"]
    assert error.changed == ["Work4You.exe", "resources/runtime/model.bin"]
    assert not error.diagnostics["verified"]
    present = [path for path in root.rglob("*") if path.is_file()]
    assert error.diagnostics["filesHashed"] == len(present)
    assert error.diagnostics["bytesHashed"] == sum(path.stat().st_size for path in present)
    assert error.diagnostics["expectedFingerprintSha256"] == benchmark.inventory_fingerprint(inventory)
    assert "missing-11.bin" in str(error)


def test_baseline_retains_integrity_failure_for_both_passes(payload):
    root, inventory = payload
    (root / "resources/runtime/model.bin").unlink()
    entry = {"variant": "7z", "passResults": []}
    for name in ("fresh-install", "same-release-reinstall"):
        result = benchmark.verify_pass_payload(entry, {"name": name}, root, inventory, "Work4You")
        assert result["verified"] is False
        assert result["missing"] == ["resources/runtime/model.bin"]
    assert len(entry["passResults"]) == 2
    assert all(item["functionalPassed"] and not item["success"] for item in entry["passResults"])


@pytest.mark.parametrize("candidate", ["zip", "7z-direct"])
def test_candidate_integrity_failure_records_details_and_aborts(payload, candidate):
    root, inventory = payload
    (root / "resources/runtime/model.bin").unlink()
    entry = {"variant": candidate, "passResults": []}
    with pytest.raises(benchmark.PayloadIntegrityError):
        benchmark.verify_pass_payload(entry, {"name": "fresh-install"}, root, inventory, "Work4You")
    assert entry["passResults"][0]["success"] is False
    assert entry["passResults"][0]["payloadIntegrity"]["missing"] == ["resources/runtime/model.bin"]


@pytest.mark.parametrize("baseline_verified", [False, True])
def test_completed_comparison_requires_good_candidate_without_hiding_bad_control(baseline_verified):
    baseline = {"variant": "7z", "state": "completed", "cleanup": {"success": True},
                "functionalPassed": True, "payloadVerified": baseline_verified, "success": baseline_verified}
    candidate = {"variant": "7z-direct", "state": "completed", "cleanup": {"success": True},
                 "functionalPassed": True, "payloadVerified": True, "success": True}
    outcome = benchmark.comparison_outcome({"order": ["7z-direct", "7z"], "variants": [candidate, baseline]})
    assert outcome == {"baselineFunctionalPassed": True, "baselinePayloadVerified": baseline_verified,
                       "candidatePassed": True, "comparisonCompleted": True, "success": True}
    assert baseline["success"] is baseline_verified

    # Reporting I/O can fail after both native passes and cleanup completed.
    # A completed experiment must never erase that hard failure on final save.
    failed_report = {"order": ["7z-direct", "7z"], "variants": [candidate, baseline],
                     "error": "Unable to persist final measurement"}
    failed_outcome = benchmark.comparison_outcome(failed_report)
    assert failed_outcome["comparisonCompleted"] is True
    assert failed_outcome["success"] is False


@pytest.mark.parametrize("failure", ["baseline-functional", "candidate-functional", "candidate-integrity",
                                   "candidate-success", "cleanup", "incomplete", "duplicate"])
def test_comparison_cannot_pass_other_failures(failure):
    baseline = {"variant": "7z", "state": "completed", "cleanup": {"success": True},
                "functionalPassed": True, "payloadVerified": False, "success": False}
    candidate = {"variant": "7z-direct", "state": "completed", "cleanup": {"success": True},
                 "functionalPassed": True, "payloadVerified": True, "success": True}
    entries = [baseline, candidate]
    if failure == "baseline-functional":
        baseline["functionalPassed"] = False
    elif failure == "candidate-functional":
        candidate["functionalPassed"] = False
    elif failure == "candidate-integrity":
        candidate["payloadVerified"] = False
    elif failure == "candidate-success":
        candidate["success"] = False
    elif failure == "cleanup":
        candidate["cleanup"]["success"] = False
    elif failure == "incomplete":
        candidate["state"] = "verifying-payload"
    elif failure == "duplicate":
        entries.append(candidate)
    assert not benchmark.comparison_outcome({"order": ["7z", "7z-direct"], "variants": entries})["success"]


@pytest.mark.linux_only
def test_payload_identity_refuses_symlink_escape(payload, tmp_path):
    root, inventory = payload
    outside = tmp_path / "outside"
    outside.write_bytes(b"external")
    (root / "outside-link").symlink_to(outside)
    with pytest.raises(ValueError, match="filesystem link"):
        benchmark.verify_installed_payload(root, inventory, "Work4You")
    entry = {"variant": "7z", "passResults": []}
    with pytest.raises(ValueError, match="filesystem link") as raised:
        benchmark.verify_pass_payload(entry, {"name": "fresh-install"}, root, inventory, "Work4You")
    assert not isinstance(raised.value, benchmark.PayloadIntegrityError)
    assert not entry["passResults"]


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
