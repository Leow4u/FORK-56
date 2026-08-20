from pathlib import Path


def test_windows_native_install_path_docs_match_installer() -> None:
    doc = Path("website/docs/user-guide/windows-native.md").read_text()
    install = Path("scripts/install.ps1").read_text()

    # The launchers live in a dedicated bin/ dir on PATH — NOT the whole
    # venv\Scripts (which would shadow the user's python, #83797).
    assert "%LOCALAPPDATA%\\work4you\\work4you\\bin" in doc
    assert (
        "Get-Command work4you        # should print "
        "C:\\Users\\<you>\\AppData\\Local\\work4you\\work4you\\bin\\work4you.exe"
    ) in doc
    # Installer exposes $InstallDir\bin, and must copy the launchers into it.
    assert '$work4youBin = "$InstallDir\\bin"' in install
    assert "work4you.exe" in install and "work4you-acp.exe" in install
    # Guard against a regression back to putting venv\Scripts on PATH.
    assert '$work4youBin = "$InstallDir\\venv\\Scripts"' not in install
