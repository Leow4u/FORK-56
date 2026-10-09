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
    if len(order) != 2 or set(order) != {"7z", "zip"}:
        raise ValueError("Order must be 7z,zip or zip,7z, each variant exactly once")
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
    if manifest["schemaVersion"] != 1 or set(manifest["variants"]) != {"7z", "zip"}:
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
        if variant["useZip"] is not (name == "zip") or variant["differentialPackage"] is not (name == "7z"):
            raise ValueError("Variant compression settings are inconsistent")
        variants[name] = installer
    if variants["7z"] == variants["zip"]:
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
    if missing or unexpected:
        raise ValueError(f"Installed payload mismatch: missing={missing[:8]}, unexpected={unexpected[:8]}")
    for name, item in expected.items():
        if actual[name].stat().st_size != item["bytes"] or sha256_file(actual[name]) != item["sha256"]:
            raise ValueError(f"Installed payload file changed: {name}")
    return {"verified": True, "files": len(expected), "bytes": sum(item["bytes"] for item in inventory),
            "fingerprintSha256": inventory_fingerprint(inventory),
            "nsisAddedFiles": sorted(actual.keys() - expected.keys())}


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
    report = {"schemaVersion": 1, "success": False, "order": order, "variants": [],
              "machine": {"system": platform.platform(), "architecture": platform.machine(),
                          "processor": platform.processor(), "logicalCpus": os.cpu_count()},
              "limitations": ["Unsigned experimental installers, not production signing/SmartScreen validation",
                              "No OS cache reset or Defender changes; no cold-cache claim",
                              "One fresh install and one same-release reinstall per format on this runner",
                              "Full installed-payload hashing follows each launch, outside timings",
                              "Reinstall follows full-tree hashing and therefore a warmed cache, for both formats",
                              "No model calls; backend readiness is HTTP, WebSocket and persisted-session validation"]}
    progress.save(report)
    try:
        manifest, inventory, paths = load_inputs(manifest_path.resolve())
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
                        verified = verify_installed_payload(executable.parent, inventory,
                                                            manifest["product"]["productName"])
                    entry["passResults"].append({**pass_result, "success": True, "payloadIntegrity": verified})
                    entry["state"] = "smoke"
                    progress.save(report)
                    progress.emit("pass-verified", variant=name, passName=pass_result["name"],
                                  timingsMs=pass_result["timingsMs"])
                    return verified

                with progress.running("fresh-install-and-reinstall", name):
                    result = smoke.smoke(args, after_pass=after_pass)
                entry["smoke"] = result
                progress.save(report)
                if not result.get("success"):
                    raise RuntimeError(result.get("error", "Packaged smoke failed"))
            finally:
                if result and result.get("sandbox"):
                    entry["state"] = "uninstalling"
                    progress.save(report)
                    with progress.running("sandbox-uninstall", name):
                        entry["cleanup"] = uninstall_sandbox(result, manifest["product"])
                    progress.save(report)
            entry.update(success=True, state="completed")
            progress.save(report)
            progress.emit("variant-completed", variant=name)
        report["success"] = True
    except Exception as error:
        report["error"] = str(error)
        progress.emit("failed", error=str(error))
    progress.save(report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--order", required=True, choices=("7z,zip", "zip,7z"))
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    return 0 if benchmark(args.manifest, parse_order(args.order), args.out_dir)["success"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
