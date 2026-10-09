"""Build artifacts must stay contained and be verified before packaging."""

import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import zipfile

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/ci/build-desktop-capabilities.py"
spec = importlib.util.spec_from_file_location("desktop_capability_build", SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_download_rejects_corruption_without_replacing_verified_artifact(tmp_path, monkeypatch):
    destination = tmp_path / "browser.zip"
    destination.write_bytes(b"previous verified content")
    monkeypatch.setattr(builder, "urlopen", lambda *args, **kwargs: io.BytesIO(b"corrupt"))
    with pytest.raises(RuntimeError, match="Checksum mismatch"):
        builder.checked_download("https://example.test/browser.zip", destination, hashlib.sha256(b"expected").hexdigest())
    assert destination.read_bytes() == b"previous verified content"
    assert not destination.with_suffix(".zip.partial").exists()


def test_verified_download_is_published_after_complete_hash(tmp_path, monkeypatch):
    content = b"signed release archive"
    destination = tmp_path / "driver.zip"
    monkeypatch.setattr(builder, "urlopen", lambda *args, **kwargs: io.BytesIO(content))
    builder.checked_download("https://example.test/driver.zip", destination, hashlib.sha256(content).hexdigest())
    assert destination.read_bytes() == content


@pytest.mark.parametrize("filename", ["../escape.exe", "nested/../../escape.exe", "..\\escape.exe"])
def test_windows_archive_cannot_write_outside_runtime(tmp_path, filename):
    archive = tmp_path / "driver.zip"
    with zipfile.ZipFile(archive, "w") as source:
        source.writestr(filename, b"not a valid driver")
    with pytest.raises(ValueError, match="escapes destination"):
        builder.extract_archive(archive, tmp_path / "computer-use")
    assert not (tmp_path / "escape.exe").exists()


def test_mac_app_symlinks_remain_relative_after_extraction(tmp_path):
    archive = tmp_path / "driver.tar.gz"
    with tarfile.open(archive, "w:gz") as source:
        content = b"framework"
        member = tarfile.TarInfo("CuaDriver.app/Contents/Frameworks/Example/Versions/A/Example")
        member.size = len(content)
        source.addfile(member, io.BytesIO(content))
        link = tarfile.TarInfo("CuaDriver.app/Contents/Frameworks/Example/Versions/Current")
        link.type = tarfile.SYMTYPE
        link.linkname = "A"
        source.addfile(link)
    destination = tmp_path / "runtime"
    builder.extract_archive(archive, destination)
    moved = tmp_path / "Installed App" / "runtime"
    moved.parent.mkdir()
    destination.rename(moved)
    assert (moved / "CuaDriver.app/Contents/Frameworks/Example/Versions/Current/Example").read_bytes() == b"framework"


def test_tar_symlink_cannot_escape_runtime(tmp_path):
    archive = tmp_path / "driver.tar.gz"
    with tarfile.open(archive, "w:gz") as source:
        link = tarfile.TarInfo("CuaDriver.app/escape")
        link.type = tarfile.SYMTYPE
        link.linkname = "../../outside"
        source.addfile(link)
    with pytest.raises(tarfile.FilterError):
        builder.extract_archive(archive, tmp_path / "runtime")
