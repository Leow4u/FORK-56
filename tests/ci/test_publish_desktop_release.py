"""Tests for scripts/ci/publish_desktop_release.py.

Publish talks to GitHub only through an injected runner. Tests cover the
retry policy and the "do not mark Latest until both installers exist" order.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "publish_desktop_release.py"
_spec = importlib.util.spec_from_file_location("publish_desktop_release", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load publish_desktop_release.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

HTTP_500 = (
    "HTTP 500: Error saving asset "
    "(https://uploads.github.com/repos/Leow4u/FORK-56/releases/391012460/"
    "assets?label=&name=Work4You-Setup.exe)\n"
)


def test_http_500_asset_save_is_retryable():
    assert mod.is_retryable_gh_error(HTTP_500, 1) is True
    assert mod.is_retryable_gh_error("HTTP 403: Resource not accessible by integration", 1) is True
    assert mod.is_retryable_gh_error("HTTP 422: Validation Failed", 1) is False
    assert mod.is_retryable_gh_error("", 0) is False


def test_required_assets_need_both_installers():
    assert mod.has_required_assets([]) is False
    assert mod.has_required_assets(["Work4You-Setup.exe"]) is False
    assert mod.has_required_assets(["Work4You-Setup.exe", "Work4You.dmg"]) is True
    # Chrome zip is optional — Latest can promote without it.
    assert (
        mod.has_required_assets(
            ["Work4You-Setup.exe", "Work4You.dmg", "Work4You-win-x64.zip"]
        )
        is True
    )


def test_parse_asset_names_from_gh_json():
    assert mod.parse_asset_names(
        '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"}]}'
    ) == ["Work4You-Setup.exe", "Work4You.dmg"]
    assert mod.parse_asset_names("") == []


def test_upload_retries_http_500_then_succeeds(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    exe.write_bytes(b"exe")
    dmg.write_bytes(b"dmg")
    calls: list[list[str]] = []
    uploads = {"exe": 0}

    def runner(args):
        calls.append(list(args))
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            assert "--draft" in args
            assert "--latest" not in args
            return 0, "https://github.com/Leow4u/FORK-56/releases/tag/desktop-v0.0.71", ""
        if args[1:3] == ["release", "upload"] and args[-2].endswith("Work4You-Setup.exe"):
            uploads["exe"] += 1
            if uploads["exe"] == 1:
                return 1, "", HTTP_500
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return 0, '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"}]}', ""
        if args[1:3] == ["release", "edit"]:
            assert "--latest" in args
            assert "--draft=false" in args
            return 0, "", ""
        raise AssertionError(args)

    sleeps: list[float] = []
    orig_run_gh = mod.run_gh

    def run_gh_fast(*args, **kwargs):
        kwargs["sleep"] = sleeps.append
        kwargs["delays"] = (0,)
        return orig_run_gh(*args, **kwargs)

    monkey_mod = mod
    monkey_mod.run_gh = run_gh_fast  # type: ignore[method-assign]
    try:
        mod.publish_desktop_release(
            tag="desktop-v0.0.71",
            repo="Leow4u/FORK-56",
            target="278e47ef",
            exe=exe,
            dmg=dmg,
            notes="notes",
            runner=runner,
        )
    finally:
        monkey_mod.run_gh = orig_run_gh  # type: ignore[method-assign]

    verbs = [call[1:3] for call in calls]
    assert verbs[0] == ["release", "view"]
    assert verbs[1] == ["release", "create"]
    assert ["release", "upload"] in verbs
    assert verbs[-1] == ["release", "edit"]
    assert uploads["exe"] == 2
    create_idx = verbs.index(["release", "create"])
    latest_idx = verbs.index(["release", "edit"])
    assert create_idx < latest_idx


def test_missing_local_installer_does_not_create_latest(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    exe.write_bytes(b"exe")
    calls: list[list[str]] = []

    def runner(args):
        calls.append(list(args))
        return 0, "", ""

    with pytest.raises(mod.PublishError, match="missing installer"):
        mod.publish_desktop_release(
            tag="desktop-v0.0.71",
            repo="Leow4u/FORK-56",
            target="278e47ef",
            exe=exe,
            dmg=tmp_path / "Work4You.dmg",
            notes="notes",
            runner=runner,
        )
    assert not any(call[1:3] == ["release", "edit"] for call in calls)


def test_optional_runtime_zip_is_uploaded_when_present(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    runtime = tmp_path / "runtime-win-x64.zip"
    exe.write_bytes(b"exe")
    dmg.write_bytes(b"dmg")
    runtime.write_bytes(b"zip")
    uploaded: list[str] = []

    def runner(args):
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            uploaded.append(Path(args[-2]).name)
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return (
                0,
                '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"},{"name":"runtime-win-x64.zip"}]}',
                "",
            )
        if args[1:3] == ["release", "edit"]:
            return 0, "", ""
        raise AssertionError(args)

    mod.publish_desktop_release(
        tag="desktop-v0.0.71",
        repo="Leow4u/FORK-56",
        target="278e47ef",
        exe=exe,
        dmg=dmg,
        notes="notes",
        runner=runner,
        runtime_zip=runtime,
    )
    assert uploaded == ["Work4You-Setup.exe", "Work4You.dmg", "runtime-win-x64.zip"]


def test_normalize_runtime_zips_does_not_iterate_a_path():
    single = Path("/tmp/runtime-win-x64.zip")
    assert mod.normalize_runtime_zips(single) == [single]
    assert mod.normalize_runtime_zips(None) == []
    darwin = Path("/tmp/runtime-darwin-arm64.zip")
    assert mod.normalize_runtime_zips([single, darwin]) == [single, darwin]
    chrome = Path("/tmp/Work4You-win-x64.zip")
    assert mod.normalize_optional_paths(chrome) == [chrome]
    assert mod.normalize_optional_paths(None) == []


def test_multiple_runtime_zips_are_uploaded_when_present(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    win = tmp_path / "runtime-win-x64.zip"
    darwin = tmp_path / "runtime-darwin-arm64.zip"
    exe.write_bytes(b"exe")
    dmg.write_bytes(b"dmg")
    win.write_bytes(b"win")
    darwin.write_bytes(b"mac")
    uploaded: list[str] = []

    def runner(args):
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            uploaded.append(Path(args[-2]).name)
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return (
                0,
                '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"},'
                '{"name":"runtime-win-x64.zip"},{"name":"runtime-darwin-arm64.zip"}]}',
                "",
            )
        if args[1:3] == ["release", "edit"]:
            return 0, "", ""
        raise AssertionError(args)

    mod.publish_desktop_release(
        tag="desktop-v0.0.71",
        repo="Leow4u/FORK-56",
        target="278e47ef",
        exe=exe,
        dmg=dmg,
        notes="notes",
        runner=runner,
        runtime_zip=[win, darwin],
    )
    assert uploaded == [
        "Work4You-Setup.exe",
        "Work4You.dmg",
        "runtime-win-x64.zip",
        "runtime-darwin-arm64.zip",
    ]


def test_update_exe_uploads_without_replacing_site_setup(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    update = tmp_path / "Work4You-Update.exe"
    exe.write_bytes(b"fat-setup")
    dmg.write_bytes(b"dmg")
    update.write_bytes(b"thin-nsis")
    uploaded: list[str] = []

    def runner(args):
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            uploaded.append(Path(args[-2]).name)
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return (
                0,
                '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"},'
                '{"name":"Work4You-Update.exe"}]}',
                "",
            )
        if args[1:3] == ["release", "edit"]:
            return 0, "", ""
        raise AssertionError(args)

    mod.publish_desktop_release(
        tag="desktop-v0.0.71",
        repo="Leow4u/FORK-56",
        target="278e47ef",
        exe=exe,
        dmg=dmg,
        notes="notes",
        runner=runner,
        update_exe=update,
    )
    assert uploaded == [
        "Work4You-Setup.exe",
        "Work4You.dmg",
        "Work4You-Update.exe",
    ]
    assert uploaded[0] == exe.name


def test_optional_chrome_zip_and_fingerprint_are_uploaded_when_present(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    chrome = tmp_path / "Work4You-win-x64.zip"
    fingerprint = tmp_path / "runtime-win-x64.fingerprint"
    exe.write_bytes(b"exe")
    dmg.write_bytes(b"dmg")
    chrome.write_bytes(b"chrome")
    fingerprint.write_text("a" * 64 + "\n", encoding="utf-8")
    uploaded: list[str] = []

    def runner(args):
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            uploaded.append(Path(args[-2]).name)
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return (
                0,
                '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"},'
                '{"name":"Work4You-win-x64.zip"},{"name":"runtime-win-x64.fingerprint"}]}',
                "",
            )
        if args[1:3] == ["release", "edit"]:
            return 0, "", ""
        raise AssertionError(args)

    mod.publish_desktop_release(
        tag="desktop-v0.0.71",
        repo="Leow4u/FORK-56",
        target="278e47ef",
        exe=exe,
        dmg=dmg,
        notes="notes",
        runner=runner,
        chrome_zip=chrome,
        runtime_fingerprint=fingerprint,
    )
    assert uploaded == [
        "Work4You-Setup.exe",
        "Work4You.dmg",
        "Work4You-win-x64.zip",
        "runtime-win-x64.fingerprint",
    ]


def test_missing_chrome_zip_still_promotes_latest(tmp_path):
    exe = tmp_path / "Work4You-Setup.exe"
    dmg = tmp_path / "Work4You.dmg"
    exe.write_bytes(b"exe")
    dmg.write_bytes(b"dmg")
    verbs: list[list[str]] = []

    def runner(args):
        verbs.append(list(args[1:3]))
        if args[1:3] == ["release", "view"] and "--json" not in args:
            return 1, "", "release not found"
        if args[1:3] == ["release", "create"]:
            return 0, "", ""
        if args[1:3] == ["release", "upload"]:
            return 0, "", ""
        if args[1:3] == ["release", "view"] and "--json" in args:
            return 0, '{"assets":[{"name":"Work4You-Setup.exe"},{"name":"Work4You.dmg"}]}', ""
        if args[1:3] == ["release", "edit"]:
            return 0, "", ""
        raise AssertionError(args)

    mod.publish_desktop_release(
        tag="desktop-v0.0.71",
        repo="Leow4u/FORK-56",
        target="278e47ef",
        exe=exe,
        dmg=dmg,
        notes="notes",
        runner=runner,
    )
    assert ["release", "edit"] in verbs


@pytest.mark.parametrize("existing", [False, True])
def test_seven_zip_assets_and_notice_precede_latest_and_preserve_notes(tmp_path, existing):
    paths = [tmp_path / name for name in (
        "Work4You-Setup.exe", "Work4You.dmg", "7z2409-src.7z", "7zip-24.09-license.txt",
    )]
    for path in paths:
        path.write_bytes(b"fixture")
    uploaded = []
    body = "Existing release notes.\n\nFeatures stay here."
    original_body = body
    edits = []

    def runner(args):
        nonlocal body, existing
        command = args[1:3]
        if command == ["release", "view"] and "--json" not in args:
            return (0, "", "") if existing else (1, "", "not found")
        if command == ["release", "create"]:
            assert "--draft" in args
            existing = True
            body = args[args.index("--notes") + 1]
            return 0, "", ""
        if command == ["release", "upload"]:
            uploaded.append(Path(args[-2]).name)
            return 0, "", ""
        if command == ["release", "view"] and args[-1] == "assets":
            return 0, json.dumps({"assets": [{"name": name} for name in uploaded]}), ""
        if command == ["release", "view"] and args[-1] == "body":
            return 0, json.dumps({"body": body}), ""
        if command == ["release", "edit"]:
            assert {path.name for path in paths} <= set(uploaded)
            if "--notes-file" in args:
                body = Path(args[args.index("--notes-file") + 1]).read_text(encoding="utf-8")
                edits.append("notice")
            else:
                assert "Corresponding source" in body
                assert "--latest" in args
                edits.append("latest")
            return 0, "", ""
        raise AssertionError(args)

    for _ in range(2):
        mod.publish_desktop_release(
            tag="desktop-v0.0.257", repo="Leow4u/FORK-56", target="abc123",
            exe=paths[0], dmg=paths[1], notes=original_body, runner=runner,
            seven_zip_source=paths[2], seven_zip_license=paths[3],
        )
    assert body.startswith(original_body)
    assert body.count("The Windows installer includes 7-Zip 24.09") == 1
    assert "/releases/download/desktop-v0.0.257/7z2409-src.7z" in body
    assert "/releases/download/desktop-v0.0.257/7zip-24.09-license.txt" in body
    assert edits == ["notice", "latest", "latest"]
    assert uploaded.index(paths[2].name) < uploaded.index(paths[0].name)
    assert uploaded.index(paths[3].name) < uploaded.index(paths[0].name)


@pytest.mark.parametrize("failure", ["upload", "missing_asset"])
def test_seven_zip_distribution_failure_never_promotes_latest(tmp_path, failure):
    paths = [tmp_path / name for name in (
        "Work4You-Setup.exe", "Work4You.dmg", "7z2409-src.7z", "7zip-24.09-license.txt",
    )]
    for path in paths:
        path.write_bytes(b"fixture")
    calls = []

    def runner(args):
        calls.append(list(args))
        if args[1:3] == ["release", "upload"] and Path(args[-2]).name == paths[2].name:
            if failure == "upload":
                return 1, "", "HTTP 422: source upload rejected"
        if args[1:3] == ["release", "view"] and args[-1] == "assets":
            return 0, json.dumps({"assets": [{"name": path.name} for path in paths[:2]]}), ""
        return 0, "", ""

    with pytest.raises(mod.PublishError):
        mod.publish_desktop_release(
            tag="desktop-v0.0.257", repo="Leow4u/FORK-56", target="abc123",
            exe=paths[0], dmg=paths[1], notes="notes", runner=runner,
            seven_zip_source=paths[2], seven_zip_license=paths[3],
        )
    assert not any("--latest" in args for args in calls)
