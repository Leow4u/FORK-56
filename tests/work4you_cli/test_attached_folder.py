"""Attachment writes stay inside the profile folder."""

from pathlib import Path

from work4you_cli.attached_folder import safe_relative, write_attachment


def test_safe_relative_rejects_escape():
    assert safe_relative("src/main.py") == "src/main.py"
    assert safe_relative("../secret") is None
    assert safe_relative("/etc/passwd") is None
    assert safe_relative("C:/Windows/note.txt") is None


def test_write_attachment_keeps_only_the_folder(tmp_path: Path):
    dest = write_attachment(
        tmp_path,
        "Demo",
        [("notes.txt", "hello"), ("../outside.txt", "nope"), ("src/app.py", "print(1)")],
    )

    assert dest == (tmp_path / "attached" / "Demo").resolve()
    assert (dest / "notes.txt").read_text(encoding="utf-8") == "hello"
    assert (dest / "src" / "app.py").read_text(encoding="utf-8") == "print(1)"
    assert not (tmp_path / "outside.txt").exists()
    assert not (tmp_path / "attached" / "outside.txt").exists()
