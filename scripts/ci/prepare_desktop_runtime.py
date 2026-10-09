#!/usr/bin/env python3
"""Build and verify a relocatable desktop Python runtime (build host only)."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import tempfile


def python_executable(runtime: Path) -> Path:
    return runtime / ("python/python.exe" if os.name == "nt" else "python/bin/python3")


def build_env() -> dict[str, str]:
    env = dict(os.environ)
    for key in ("PYTHONHOME", "PYTHONPATH", "VIRTUAL_ENV", "UV_PROJECT_ENVIRONMENT"):
        env.pop(key, None)
    env.update(PYTHONNOUSERSITE="1", PYTHONDONTWRITEBYTECODE="1")
    return env


def run(command: list[str | Path], *, cwd: Path, env: dict[str, str] | None = None, quiet: bool = False) -> None:
    subprocess.run([str(part) for part in command], cwd=cwd, env=env or build_env(), check=True,
                   stdout=subprocess.DEVNULL if quiet else None, timeout=1200)


def install_python_dependencies(runtime: Path, repo: Path, uv: Path) -> None:
    """Use the locked dependency graph, without a venv or editable project."""
    requirements = runtime / "python-requirements.txt"
    run([uv, "export", "--locked", "--no-dev", "--no-default-groups", "--no-emit-project",
         "--extra", "all", "--extra", "computer-use", "--extra", "edge-tts",
         "--extra", "voice", "--extra", "wake", "--output-file", requirements], cwd=repo, quiet=True)
    # This is our copied interpreter inside the build output, not the build
    # host's uv-managed Python. Its EXTERNALLY-MANAGED marker is retained.
    # The exported graph already includes project override decisions. Do not
    # reapply the broad pyproject overrides to its exact, hashed versions.
    run([uv, "--no-config", "pip", "install", "--python", python_executable(runtime), "--system", "--break-system-packages",
         "--require-hashes", "--no-deps", "-r", requirements], cwd=repo)
    run([uv, "pip", "check", "--python", python_executable(runtime)], cwd=repo)


def copy_payload(runtime: Path, repo: Path) -> None:
    """Copy allowed source/resources without traversing caches or node_modules."""
    import sys

    sys.path.insert(0, str(repo))
    from work4you_cli.runtime_payload import is_runtime_payload_path

    destination = runtime / "work4you"
    ignored = {".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache"}
    for directory, children, filenames in os.walk(repo):
        parent = Path(directory)
        children[:] = [name for name in children if name not in ignored
                       and is_runtime_payload_path((parent / name).relative_to(repo).as_posix())]
        for name in filenames:
            source = parent / name
            relative = source.relative_to(repo)
            if not is_runtime_payload_path(relative.as_posix()) or source.suffix in {".pyc", ".pyo"}:
                continue
            target = destination / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)


def prepare_interfaces(runtime: Path, repo: Path) -> None:
    """Ship the already bundled TUI and web UI, never build them at launch."""
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise RuntimeError("npm is required on the build host to compile the interfaces")
    run([npm, "run", "build", "--workspace", "ui-tui"], cwd=repo)
    run([npm, "run", "build", "--workspace", "web"], cwd=repo)
    tui = runtime / "work4you/work4you_cli/tui_dist"
    tui.mkdir(parents=True, exist_ok=True)
    shutil.copy2(repo / "ui-tui/dist/entry.js", tui / "entry.js")
    # Web's Vite output is inside work4you_cli, but copying explicitly also
    # works when the source allowlist was copied before compilation.
    shutil.copytree(repo / "work4you_cli/web_dist", runtime / "work4you/work4you_cli/web_dist", dirs_exist_ok=True)


def validate_capabilities(runtime: Path, capabilities: dict) -> None:
    """A desktop build must fail before packaging if a standard asset is absent."""
    fields = {
        "browser": ("command", "executable"),
        "computerUse": ("command",),
        "ffmpeg": ("command",),
        "voice": ("modelFile",),
        "wake": ("melspectrogramOnnx", "embeddingOnnx", "melspectrogramTflite", "embeddingTflite", "sherpaTokens"),
    }
    if os.name == "nt":
        fields.update(git=("command",), shell=("command",), cppRuntime=("msvcp",))
    for capability, keys in fields.items():
        for key in keys:
            relative = capabilities.get(capability, {}).get(key)
            if not isinstance(relative, str) or not relative or "\\" in relative or ":" in relative:
                raise ValueError(f"Missing or invalid bundled capability: {capability}.{key}")
            path = (runtime / relative).resolve()
            if not path.is_relative_to(runtime.resolve()) or not path.is_file():
                raise ValueError(f"Missing or escaping bundled capability: {capability}.{key}: {relative}")
    if capabilities.get("browserUse", {}).get("module") != "browser_harness.run":
        raise ValueError("The standard browser harness is missing from the runtime manifest")


def finalize_runtime(runtime: Path, repo: Path) -> None:
    import sys

    sys.path.insert(0, str(repo))
    from work4you_cli.desktop_runtime import write_app_runtime_launchers, rewrite_runtime_symlinks

    # These are SDK headers and offline manuals, not Node's executable/npm
    # runtime. Native standard tools have already been built and staged.
    for relative in ("node/include", "node/share/doc", "node/share/man"):
        shutil.rmtree(runtime / relative, ignore_errors=True)
    rewrite_runtime_symlinks(runtime)
    write_app_runtime_launchers(runtime, windows=os.name == "nt")
    (runtime / "work4you/.install_method").write_text("desktop\n", encoding="utf-8")
    # A bare Python prefix has no pyvenv.cfg and finds its stdlib and
    # site-packages relative to its executable. Reject accidental editable
    # paths from the build host instead of patching the user's installed app.
    for pth in (runtime / "python").rglob("*.pth"):
        for line in pth.read_text(encoding="utf-8").splitlines():
            entry = line.strip()
            if entry and not entry.startswith(("#", "import ", "import\t")) and os.path.isabs(entry):
                raise ValueError(f"Non-relocatable Python path in {pth}: {entry}")
    manifest_path = runtime / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest.update(layout="app-owned", pythonExecutable=python_executable(runtime).relative_to(runtime).as_posix())
    capabilities = json.loads((runtime / "capabilities.json").read_text(encoding="utf-8"))
    validate_capabilities(runtime, capabilities)
    manifest["capabilities"] = capabilities
    manifest["interfaces"] = {"tui": "work4you/work4you_cli/tui_dist/entry.js", "web": "work4you/work4you_cli/web_dist/index.html"}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def tree_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        digest.update(path.relative_to(root).as_posix().encode())
        if path.is_symlink():
            digest.update(os.readlink(path).encode())
        elif path.is_file():
            with path.open("rb") as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b""):
                    digest.update(chunk)
    return digest.hexdigest()


BACKEND_PROBE = r'''
import asyncio,json,os,pathlib,secrets,subprocess,sys,time,urllib.request
from work4you_state import SessionDB
from websockets.asyncio.client import connect

home = pathlib.Path(os.environ['WORK4YOU_HOME'])
session_id = 'runtime-build-preserved-session'
db = SessionDB()
db.create_session(session_id, 'desktop')
db.set_session_title(session_id, 'Runtime build verification')
db.append_message(session_id, 'user', 'Existing data survives runtime launch')
db.close()
ready = home / 'backend-ready.json'
token = secrets.token_urlsafe(32)
child_env = dict(os.environ, WORK4YOU_DESKTOP='1', WORK4YOU_DESKTOP_READY_FILE=str(ready),
                 WORK4YOU_DASHBOARD_SESSION_TOKEN=token)
log_path = home / 'backend-probe.log'
async def check_rpc(port):
    async with connect(f'ws://127.0.0.1:{port}/api/ws?token={token}', open_timeout=20) as ws:
        async def rpc(method,params):
            await ws.send(json.dumps({'jsonrpc':'2.0','id':method,'method':method,'params':params}))
            while True:
                raw = await asyncio.wait_for(ws.recv(),timeout=30)
                for line in raw.splitlines():
                    response=json.loads(line)
                    if response.get('id') == method:
                        if response.get('error'):
                            raise RuntimeError(f"{method}: {response['error']}")
                        return response['result']
        profile=await rpc('config.get',{'key':'profile'})
        assert pathlib.Path(profile['home']).resolve() == home.resolve(),profile
        sessions=await rpc('session.list',{'limit':200})
        assert any(row['id']==session_id for row in sessions['sessions']),sessions

with log_path.open('w',encoding='utf-8') as output:
    server=subprocess.Popen([sys.executable,'-s','-B','-m','work4you_cli.main','serve',
                             '--host','127.0.0.1','--port','0'], env=child_env, cwd=home,
                            stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT)
    try:
        deadline=time.monotonic()+120
        while not ready.is_file():
            if server.poll() is not None:
                raise RuntimeError('Bundled backend exited before becoming ready')
            if time.monotonic()>=deadline:
                raise RuntimeError('Bundled backend readiness timed out')
            time.sleep(.1)
        port=json.loads(ready.read_text())['port']
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=15) as response:
            assert json.load(response)['ok'] is True
        asyncio.run(check_rpc(port))
        assert not (home/'work4you'/'venv').exists()
        print('relocated backend HTTP health, authenticated RPC, data home and persisted session ready')
    except Exception:
        output.flush()
        print(log_path.read_text(encoding='utf-8')[-4000:].replace(token,'[test token]'),file=sys.stderr)
        raise
    finally:
        server.terminate()
        try:
            server.wait(timeout=15)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
'''


def verify_relocation(runtime: Path) -> None:
    """Move the whole app payload and run it with its build path absent.

    The probe runs from an unrelated directory with an isolated data home.
    POSIX additionally removes write permission; the fingerprint catches
    writes on Windows, where read-only file attributes do not seal folders.
    """
    with tempfile.TemporaryDirectory(prefix="work4you relocated espaço ") as temporary:
        scratch = Path(temporary)
        moved = scratch / "Application Resources" / "runtime"
        moved.parent.mkdir()
        shutil.move(str(runtime), moved)
        modes: dict[Path, int] = {}
        try:
            before = tree_fingerprint(moved)
            if os.name != "nt":
                for path in [moved, *moved.rglob("*")]:
                    if not path.is_symlink():
                        modes[path] = stat.S_IMODE(path.stat().st_mode)
                        path.chmod(modes[path] & ~0o222)
            data_home = scratch / "User Data"
            data_home.mkdir()
            env = build_env()
            env.update(
                WORK4YOU_HOME=str(data_home), WORK4YOU_BUNDLED_RUNTIME=str(moved),
                PYTHONPATH=str(moved / "work4you"),
                XDG_CONFIG_HOME=str(data_home / "config"), XDG_CACHE_HOME=str(data_home / "cache"),
                BH_HOME=str(data_home / "browser-harness"), ANONYMIZED_TELEMETRY="false",
            )
            probe = (
                "import os,sys,pathlib; root=pathlib.Path(os.environ['WORK4YOU_BUNDLED_RUNTIME']).resolve(); "
                "assert pathlib.Path(sys.base_prefix).resolve().is_relative_to(root),sys.base_prefix; "
                "from work4you_cli.managed_runtime import bundled_runtime_root,extension_packages_dir; "
                "assert bundled_runtime_root() == root,'probe did not enter app-owned mode'; "
                "extensions=extension_packages_dir(); "
                "assert extensions is not None and not extensions.resolve().is_relative_to(root); "
                "assert extensions.resolve().is_relative_to(pathlib.Path(os.environ['WORK4YOU_HOME']).resolve()); "
                "import ssl,sqlite3,yaml,dotenv,pydantic_core,fastapi,uvicorn,mcp; "
                "import work4you_cli.config,work4you_cli.web_server; "
                "assert pathlib.Path(work4you_cli.config.__file__).resolve().is_relative_to(root); "
                "assert pathlib.Path(pydantic_core.__file__).resolve().is_relative_to(root); "
                "print('managed app-owned Python, external extensions and backend imports ready')"
            )
            run([python_executable(moved), "-s", "-B", "-c", probe], cwd=scratch, env=env)
            run([python_executable(moved), "-s", "-B", "-m", "work4you_cli.main", "--help"], cwd=scratch, env=env)
            run([python_executable(moved), "-s", "-B", "-m", "browser_harness.run", "--help"], cwd=scratch, env=env)
            run([python_executable(moved), "-s", "-B", "-c", BACKEND_PROBE], cwd=scratch, env=env)
            if tree_fingerprint(moved) != before:
                raise RuntimeError("Starting the relocated runtime modified files inside the application")
        finally:
            for path, mode in modes.items():
                path.chmod(mode)
            shutil.move(str(moved), runtime)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("payload", "python", "interfaces", "finalize", "verify"))
    parser.add_argument("--runtime-dir", type=Path, required=True)
    parser.add_argument("--repo-root", type=Path, required=True)
    parser.add_argument("--uv", type=Path)
    args = parser.parse_args()
    runtime, repo = args.runtime_dir.resolve(), args.repo_root.resolve()
    if args.action == "payload":
        copy_payload(runtime, repo)
    elif args.action == "python":
        if args.uv is None:
            parser.error("python requires --uv")
        install_python_dependencies(runtime, repo, args.uv.resolve())
    elif args.action == "interfaces":
        prepare_interfaces(runtime, repo)
    elif args.action == "finalize":
        finalize_runtime(runtime, repo)
    else:
        verify_relocation(runtime)


if __name__ == "__main__":
    main()
