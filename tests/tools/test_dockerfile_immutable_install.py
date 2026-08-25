"""Contract tests for the Docker image's immutable /opt/work4you install tree."""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "Dockerfile"


def _dockerfile_text() -> str:
    return DOCKERFILE.read_text()


def test_dockerfile_makes_opt_work4you_readonly_for_work4you_user() -> None:
    text = _dockerfile_text()

    # --chmod on the source COPY bakes read-only perms at copy time instead
    # of a separate chmod -R pass (which walked ~30k files — #49113).
    assert "COPY --link --chmod=a+rX,go-w . ." in text
    # The old tree-walking passes must not be present.
    assert "chown -R root:root /opt/work4you" not in text
    # Scoped subdirs (e.g. .playwright) may be chmod'd; forbid tree walks on the root.
    assert not re.search(r"chmod\s+-R\s+a\+rX\s+/opt/work4you(?:\s|;|\\)", text)
    assert not re.search(r"chmod\s+-R\s+a-w\s+/opt/work4you(?:\s|;|\\)", text)


def test_dockerfile_does_not_chown_install_trees_to_work4you() -> None:
    text = _dockerfile_text()
    forbidden_patterns = (
        r"chown\s+-R\s+work4you:work4you\s+/opt/work4you/\.venv",
        r"chown\s+-R\s+work4you:work4you\s+/opt/work4you/ui-tui",
        r"chown\s+-R\s+work4you:work4you\s+/opt/work4you/gateway",
        r"chown\s+-R\s+work4you:work4you\s+/opt/work4you/node_modules",
    )
    for pattern in forbidden_patterns:
        assert not re.search(pattern, text), (
            "runtime install trees under /opt/work4you must stay immutable; "
            f"found forbidden pattern {pattern!r}"
        )


def test_dockerfile_bakes_code_scoped_install_method_stamp() -> None:
    """The 'docker' install-method stamp is baked next to the code.

    detect_install_method() reads the code-scoped stamp
    (/opt/work4you/.install_method) first; baking it at build time keeps the
    published image self-identifying as 'docker' WITHOUT writing into the
    shared $WORK4YOU_HOME data volume (which a host install may also use).
    The stamp is created by root in the shim-wiring RUN block; the work4you
    user can't modify it (go-w from the --chmod on the source COPY).
    """
    text = _dockerfile_text()
    assert "printf 'docker\\n' > /opt/work4you/.install_method" in text

    # The stamp must be in the RUN block that wires the exec shim.
    shim_block = re.search(
        r"RUN mkdir -p /opt/work4you/bin && \\\n"
        r"(?:.*\\\n)+?"
        r"\s+printf 'docker\\n' > /opt/work4you/\.install_method",
        text,
    )
    assert shim_block, "install-method stamp must be in the shim-wiring RUN block"


def test_dockerfile_redirects_lazy_installs_to_durable_target() -> None:
    """Immutable image seals the venv but redirects lazy installs to the
    writable data volume, so opt-in backends still install at first use
    without being able to break the sealed core.

    Guards the contract between the Dockerfile env var, the stage2-hook
    seeding, and tools/lazy_deps.py — these three must agree on the path.
    """
    text = _dockerfile_text()
    target = "/opt/data/lazy-packages"

    # The redirect target must be set AND must live under the data volume,
    # never under the immutable /opt/work4you tree.
    assert f"ENV WORK4YOU_LAZY_INSTALL_TARGET={target}" in text
    assert target.startswith("/opt/data/"), "target must be on the durable volume"
    assert "ENV WORK4YOU_LAZY_INSTALL_TARGET=/opt/work4you" not in text

    # The seal flag must still be present — the redirect rides on top of it,
    # it does not replace it.
    assert "ENV WORK4YOU_DISABLE_LAZY_INSTALLS=1" in text

    # stage2-hook must seed + chown the target dir so first-use installs
    # succeed as the unprivileged work4you runtime user.
    stage2 = (REPO_ROOT / "docker" / "stage2-hook.sh").read_text()
    assert '"$WORK4YOU_HOME/lazy-packages"' in stage2, (
        "stage2-hook.sh must create the lazy-packages dir on the data volume"
    )
    assert "lazy-packages" in stage2.split("for sub in", 1)[1].split(";", 1)[0], (
        "lazy-packages must be in the per-boot chown subdir list so it stays "
        "work4you-owned"
    )


def test_dockerfile_bakes_photon_sidecar_deps() -> None:
    """The Photon sidecar's node_modules must be baked at build time (NS-606).

    The install tree is immutable at runtime, so a lazy `npm ci` on first
    connect would hit EROFS. Baking the deps (from the committed lockfile,
    which also runs the spectrum-ts postinstall patch) makes the hosted
    happy path install-free. Guards the contract between the Dockerfile
    and plugins/platforms/photon/sidecar_paths.resolve_sidecar_dir, which
    runs in place only when the baked deps exist and match the lockfile.
    """
    text = _dockerfile_text()

    assert "plugins/platforms/photon/sidecar/package-lock.json" in text
    assert re.search(
        r"RUN cd plugins/platforms/photon/sidecar && \\\n\s+npm ci", text
    ), "sidecar deps must be installed with `npm ci` (deterministic, runs postinstall patch)"
    # Immutability contract: never chown the sidecar tree to the runtime user.
    assert not re.search(
        r"chown\s+-R\s+work4you:work4you\s+/opt/work4you/plugins", text
    )
