#!/usr/bin/env python3
"""Compare unsigned NSIS variants of one verified, unchanged release payload.

Native Windows only, on a disposable runner without an existing product install.
The existing smoke performs fresh install, first launch, and same-release
reinstall. Full installed-file hashing follows each launch, outside every timing.
This does not flush OS caches, alter Defender, or measure signed-release UX.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import subprocess
import sys
import tempfile
import threading
import time


def sha256_file(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def parse_order(value: str) -> list[str]:
    order = value.split(",")
    if len(order) != 2 or set(order) not in ({"7z", "zip"}, {"7z", "7z-direct"}):
        raise ValueError("Order must contain baseline 7z and one candidate (zip or 7z-direct), each exactly once")
    return order


def relative_path(value: str) -> PurePosixPath:
    relative = PurePosixPath(value)
    if (not value or "\\" in value or ":" in value or relative.is_absolute()
            or any(part in {"", ".", ".."} for part in value.split("/"))):
        raise ValueError(f"Unsafe manifest relative path: {value!r}")
    return relative


def relative_file(base: Path, value: str) -> Path:
    resolved = (base / relative_path(value)).resolve()
    if not resolved.is_relative_to(base.resolve()):
        raise ValueError("Manifest path escapes its artifact directory")
    return resolved


def inventory_fingerprint(inventory: list[dict]) -> str:
    # Same compact UTF-8 serialization as JSON.stringify in the builder.
    encoded = json.dumps(inventory, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def validate_inventory(inventory: list[dict]) -> None:
    if not isinstance(inventory, list) or not inventory:
        raise ValueError("Payload inventory must contain files")
    seen = set()
    for item in inventory:
        path = item["path"]
        relative_path(path)
        if path.casefold() in seen:
            raise ValueError("Payload inventory has duplicate Windows paths")
        seen.add(path.casefold())
        if (not re.fullmatch(r"[0-9a-f]{64}", item["sha256"])
                or type(item["bytes"]) is not int or item["bytes"] < 0):
            raise ValueError("Invalid payload file identity")


def load_inputs(path: Path) -> tuple[dict, list[dict], dict[str, Path]]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest["schemaVersion"] != 1 or set(manifest["variants"]) not in ({"7z", "zip"}, {"7z", "7z-direct"}):
        raise ValueError("Unsupported benchmark manifest")
    if not re.fullmatch(r"[0-9a-f]{40}", manifest["source"]["commit"]):
        raise ValueError("Source must identify the full release commit")
    if not re.fullmatch(r"[0-9a-f]{64}", manifest["source"]["installerSha256"]):
        raise ValueError("Source must identify the release installer SHA256")
    product = manifest["product"]
    if not re.fullmatch(r"[\w .-]+", product["productName"]):
        raise ValueError("Unsafe product name")
    prefix = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\"
    if not product["uninstallRegistryKey"].startswith(prefix):
        raise ValueError("Expected an explicit product uninstall registry key")
    guid = product["uninstallRegistryKey"][len(prefix):]
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", guid):
        raise ValueError("Invalid installer product GUID")
    payload = manifest["payload"]
    inventory_path = relative_file(path.parent, payload["inventoryRelativePath"])
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    validate_inventory(inventory)
    if (inventory_fingerprint(inventory) != payload["fingerprintSha256"]
            or len(inventory) != payload["files"]
            or sum(item["bytes"] for item in inventory) != payload["totalBytes"]):
        raise ValueError("Payload inventory differs from its recorded fingerprint")
    variants = {}
    for name, variant in manifest["variants"].items():
        installer = relative_file(path.parent, variant["relativePath"])
        if (installer.stat().st_size != variant["bytes"]
                or sha256_file(installer) != variant["sha256"]):
            raise ValueError(f"{name} installer differs from its recorded identity")
        if variant["useZip"] is not (name == "zip") or variant["differentialPackage"] is not (name != "zip"):
            raise ValueError("Variant compression settings are inconsistent")
        variants[name] = installer
    if len(set(variants.values())) != 2:
        raise ValueError("Variants must be separate installers")
    return manifest, inventory, variants


def verify_installed_payload(root: Path, inventory: list[dict], product_name: str) -> dict:
    """Hash real files, rejecting additions/omissions apart from NSIS metadata."""
    expected = {item["path"]: item for item in inventory}
    # NSIS creates these outside the prepackaged application archive.
    allowed_extras = {f"Uninstall {product_name}.exe", "uninstallerIcon.ico"}
    actual = {}
    for path in root.rglob("*"):
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError("Installed payload contains a filesystem link")
        if path.is_file():
            actual[path.relative_to(root).as_posix()] = path
    missing = sorted(expected.keys() - actual.keys())
    unexpected = sorted(actual.keys() - expected.keys() - allowed_extras)
    # Missing files must not hide corruption of any remaining file. Hash every
    # installed file, including unexpected additions, before reporting defects.
    identities = {name: {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
                  for name, path in actual.items()}
    changed = sorted(name for name in expected.keys() & actual.keys()
                     if identities[name]["bytes"] != expected[name]["bytes"]
                     or identities[name]["sha256"] != expected[name]["sha256"])
    summary = {"files": len(expected), "bytes": sum(item["bytes"] for item in inventory),
               "expectedFingerprintSha256": inventory_fingerprint(inventory),
               "filesHashed": len(identities), "bytesHashed": sum(item["bytes"] for item in identities.values()),
               "nsisAddedFiles": sorted(actual.keys() & allowed_extras)}
    if missing or unexpected or changed:
        raise PayloadIntegrityError(missing, unexpected, changed, summary)
    return {**summary, "verified": True, "fingerprintSha256": inventory_fingerprint(inventory)}


class PayloadIntegrityError(ValueError):
    """Complete content mismatch, distinct from unsafe paths or failed I/O."""

    def __init__(self, missing: list[str], unexpected: list[str], changed: list[str], summary: dict):
        self.missing, self.unexpected, self.changed = missing, unexpected, changed
        self.diagnostics = {**summary, "verified": False,
                            "missing": missing, "unexpected": unexpected, "changed": changed}
        super().__init__("Installed payload mismatch: " + json.dumps(self.diagnostics, ensure_ascii=False))


def verify_pass_payload(entry: dict, pass_result: dict, root: Path, inventory: list[dict], product_name: str) -> dict:
    """Keep a defective control measurable; a defective candidate still aborts."""
    try:
        integrity = verify_installed_payload(root, inventory, product_name)
    except PayloadIntegrityError as error:
        entry["passResults"].append({**pass_result, "functionalPassed": True, "success": False,
                                     "payloadIntegrity": error.diagnostics})
        if entry["variant"] != "7z":
            raise
        return error.diagnostics
    entry["passResults"].append({**pass_result, "functionalPassed": True, "success": True,
                                 "payloadIntegrity": integrity})
    return integrity


def comparison_outcome(report: dict) -> dict:
    """Experiment completion never reclassifies a defective baseline as passed."""
    variants = {entry["variant"]: entry for entry in report["variants"]}
    baseline = variants.get("7z", {})
    candidate = next((entry for name, entry in variants.items() if name != "7z"), {})
    completed = (len(report["variants"]) == len(variants) == 2
                 and set(variants) == set(report["order"])
                 and all(entry.get("state") == "completed" and entry.get("cleanup", {}).get("success") is True
                         for entry in variants.values()))
    baseline_functional = baseline.get("functionalPassed") is True
    candidate_passed = (candidate.get("success") is True and candidate.get("functionalPassed") is True
                        and candidate.get("payloadVerified") is True)
    return {"baselineFunctionalPassed": baseline_functional,
            "baselinePayloadVerified": baseline.get("payloadVerified") is True,
            "candidatePassed": candidate_passed, "comparisonCompleted": completed,
            "success": completed and baseline_functional and candidate_passed and "error" not in report}


def load_sibling(name: str):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def unsigned_status(path: Path) -> str:
    signing = load_sibling("sign_windows_esigner")
    result = subprocess.run(signing.authenticode_probe_argv(signing.windows_powershell_exe()),
                            env=signing.windows_powershell_child_env(path), check=True,
                            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
    status = result.stdout.strip()
    if status != "NotSigned":
        raise ValueError(f"Benchmark variant must be unsigned; observed {status!r}")
    return status


def registry_entries(product: dict) -> list[dict]:
    import winreg

    uninstall_key = product["uninstallRegistryKey"]
    install_key = "Software\\" + uninstall_key.rsplit("\\", 1)[-1]
    entries = []
    for hive_name, hive in (("HKCU", winreg.HKEY_CURRENT_USER), ("HKLM", winreg.HKEY_LOCAL_MACHINE)):
        for view, access in ((32, winreg.KEY_WOW64_32KEY), (64, winreg.KEY_WOW64_64KEY)):
            for key_name in (uninstall_key, install_key):
                try:
                    with winreg.OpenKey(hive, key_name, 0, winreg.KEY_READ | access) as key:
                        try:
                            location = winreg.QueryValueEx(key, "InstallLocation")[0]
                        except FileNotFoundError:
                            location = None
                        entries.append({"hive": hive_name, "view": view, "key": key_name,
                                        "installLocation": location})
                except FileNotFoundError:
                    pass
    return entries


def sandbox_paths(result: dict, temporary_root: Path) -> tuple[Path, Path, Path]:
    sandbox = Path(result["sandbox"]).resolve()
    installed = Path(result["installDir"]).resolve()
    home = Path(result["work4youHome"]).resolve()
    if (sandbox.parent != temporary_root.resolve() or not sandbox.name.startswith("work4you-install-smoke-")
            or installed != sandbox / "Installed App" or home != sandbox / "user-data"):
        raise ValueError("Refusing cleanup outside the generated smoke sandbox")
    return sandbox, installed, home


def tree_identity(root: Path) -> dict[str, str]:
    return {path.relative_to(root).as_posix(): sha256_file(path)
            for path in root.rglob("*") if path.is_file()}


def uninstall_sandbox(result: dict, product: dict) -> dict:
    _, installed, home = sandbox_paths(result, Path(tempfile.gettempdir()))
    uninstaller = installed / f"Uninstall {product['productName']}.exe"
    if not uninstaller.is_file():
        if not installed.exists() and not registry_entries(product):
            return {"success": True, "notInstalled": True}
        raise RuntimeError("Sandbox uninstaller missing; refusing manual deletion or next install")
    before = tree_identity(home)
    started = time.monotonic()
    # Normal NSIS uninstaller copies itself to TEMP. Its launcher may exit before
    # the real child, so process exit alone is insufficient. _?= would prevent
    # that copy and can leave the running uninstaller in the installation folder.
    subprocess.run([str(uninstaller), "/S"], check=True, timeout=300, capture_output=True,
                   env={**os.environ, "WORK4YOU_HOME": str(home)})
    deadline = time.monotonic() + 300
    while installed.exists() or registry_entries(product):
        if time.monotonic() >= deadline:
            raise RuntimeError("Uninstall did not remove the app directory and product registry keys")
        time.sleep(1)
    if tree_identity(home) != before:
        raise RuntimeError("Uninstaller changed the sandbox user data")
    return {"success": True, "elapsedMs": round((time.monotonic() - started) * 1000),
            "installDirectoryAbsent": True, "productRegistryAbsent": True, "userDataPreserved": True}


class Progress:
    def __init__(self, directory: Path):
        directory.mkdir(parents=True, exist_ok=True)
        self.report = directory / "benchmark-results.json"
        self.events = directory / "benchmark-events.jsonl"
        if self.report.exists() or self.events.exists():
            raise ValueError("Output directory already contains benchmark results")
        self.lock = threading.Lock()

    def emit(self, event: str, **values) -> None:
        record = {"at": datetime.now(timezone.utc).isoformat(), "event": event, **values}
        line = json.dumps(record, ensure_ascii=False)
        with self.lock:
            with self.events.open("a", encoding="utf-8") as stream:
                stream.write(line + "\n")
                stream.flush()
            print(line, flush=True)

    def save(self, report: dict) -> None:
        temporary = self.report.with_suffix(".tmp")
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(self.report)

    @contextmanager
    def running(self, phase: str, variant: str):
        stop = threading.Event()
        started = time.monotonic()

        def heartbeat():
            while not stop.wait(30):
                self.emit("running", phase=phase, variant=variant,
                          elapsedMs=round((time.monotonic() - started) * 1000))

        self.emit("started", phase=phase, variant=variant)
        thread = threading.Thread(target=heartbeat, daemon=True)
        thread.start()
        try:
            yield
        finally:
            stop.set()
            thread.join()
            self.emit("finished", phase=phase, variant=variant,
                      elapsedMs=round((time.monotonic() - started) * 1000))


def benchmark(manifest_path: Path, order: list[str], output: Path) -> dict:
    if sys.platform != "win32":
        raise RuntimeError("NSIS benchmark requires a native disposable Windows runner")
    progress = Progress(output)
    report = {"schemaVersion": 2, "success": False, "order": order, "variants": [],
              "successCriterion": "Completed comparison, functional baseline and fully verified candidate; "
                                  "baseline payload defects remain failures in the baseline entry",
              "machine": {"system": platform.platform(), "architecture": platform.machine(),
                          "processor": platform.processor(), "logicalCpus": os.cpu_count()},
              "limitations": ["Unsigned experimental installers, not production signing/SmartScreen validation",
                              "No OS cache reset or Defender changes; no cold-cache claim",
                              "One fresh install and one same-release reinstall per format on this runner",
                              "Full installed-payload hashing follows each launch, outside timings",
                              "Reinstall follows full-tree hashing and therefore a warmed cache, for both formats",
                              "No model calls; backend readiness is HTTP, WebSocket and persisted-session validation"]}
    report.update(comparison_outcome(report))
    progress.save(report)
    try:
        manifest, inventory, paths = load_inputs(manifest_path.resolve())
        if set(parse_order(",".join(order))) != set(paths):
            raise ValueError("Requested order does not match the manifest's candidate")
        report.update(source=manifest["source"], payload=manifest["payload"], product=manifest["product"])
        if registry_entries(manifest["product"]):
            raise RuntimeError("Existing product installation detected; use a fresh disposable Windows runner")
        smoke = load_sibling("desktop_install_smoke")
        for name in order:
            if registry_entries(manifest["product"]):
                raise RuntimeError("Product registry is not clean before the next variant")
            entry = {"variant": name, "success": False, "state": "checking-installer",
                     "artifact": manifest["variants"][name], "unsignedExperimental": True}
            report["variants"].append(entry)
            progress.save(report)
            entry["authenticodeStatus"] = unsigned_status(paths[name])
            args = argparse.Namespace(installer=paths[name], commit=manifest["source"]["commit"],
                                      sha256=manifest["variants"][name]["sha256"], require_signed=False,
                                      next_installer=None, next_commit="", next_sha256="")
            result = None
            try:
                entry["state"] = "smoke"
                entry["passResults"] = []
                progress.save(report)

                def after_pass(executable: Path, pass_result: dict) -> dict:
                    sandbox_paths({"sandbox": str(executable.parent.parent),
                                   "installDir": str(executable.parent),
                                   "work4youHome": str(executable.parent.parent / "user-data")},
                                  Path(tempfile.gettempdir()))
                    entry["state"] = "verifying-payload"
                    progress.save(report)
                    with progress.running("installed-payload-hashing-" + pass_result["name"], name):
                        try:
                            verified = verify_pass_payload(entry, pass_result, executable.parent, inventory,
                                                           manifest["product"]["productName"])
                        finally:
                            # Preserve complete candidate diagnostics even when
                            # its integrity error aborts the smoke immediately.
                            progress.save(report)
                    entry["state"] = "smoke"
                    progress.save(report)
                    progress.emit("pass-verified" if verified["verified"] else "baseline-payload-failed",
                                  variant=name, passName=pass_result["name"], timingsMs=pass_result["timingsMs"],
                                  payloadIntegrity=verified)
                    return verified

                with progress.running("fresh-install-and-reinstall", name):
                    result = smoke.smoke(args, after_pass=after_pass)
                entry["smoke"] = result
                entry["functionalPassed"] = result.get("success") is True
                entry["payloadVerified"] = (len(entry["passResults"]) == 2
                                            and all(item["payloadIntegrity"]["verified"]
                                                    for item in entry["passResults"]))
                progress.save(report)
                if not result.get("success"):
                    raise RuntimeError(result.get("error", "Packaged smoke failed"))
                # The smoke's success describes its functional checks. Include
                # the additional inventory requirement in this benchmark copy.
                result["functionalPassed"] = True
                result["success"] = entry["payloadVerified"]
                for pass_result in result["passes"]:
                    pass_result["functionalPassed"] = True
                    pass_result["success"] = pass_result["payloadIntegrity"]["verified"]
            finally:
                if result and result.get("sandbox"):
                    entry["state"] = "uninstalling"
                    progress.save(report)
                    with progress.running("sandbox-uninstall", name):
                        entry["cleanup"] = uninstall_sandbox(result, manifest["product"])
                    progress.save(report)
            entry.update(success=entry["functionalPassed"] and entry["payloadVerified"], state="completed")
            report.update(comparison_outcome(report))
            progress.save(report)
            progress.emit("variant-completed", variant=name, success=entry["success"],
                          functionalPassed=entry["functionalPassed"], payloadVerified=entry["payloadVerified"])
    except Exception as error:
        report["error"] = str(error)
        progress.emit("failed", error=str(error))
    report.update(comparison_outcome(report))
    progress.save(report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--order", required=True,
                        choices=("7z,zip", "zip,7z", "7z,7z-direct", "7z-direct,7z"))
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    return 0 if benchmark(args.manifest, parse_order(args.order), args.out_dir)["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
