"""Tests for scripts/ci/prepare_macos_signing.py.

Covers the empty-CSC_LINK footgun, Base64 gating, Team ID parsing,
re-export of OpenSSL 3 / PBES2 PKCS#12 to PBESv1 SHA1+3DES, and the
CI keychain import that must use the keychain password (not CSC_KEY_PASSWORD)
for set-key-partition-list. Never talks to Apple or electron-builder.
"""

from __future__ import annotations

import base64
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization.pkcs12 import (
    PBES,
    load_key_and_certificates,
    serialize_key_and_certificates,
)
from cryptography.x509.oid import NameOID

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "prepare_macos_signing.py"
_spec = importlib.util.spec_from_file_location("prepare_macos_signing", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load prepare_macos_signing.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

# DER OID 1.2.840.113549.1.5.13 (PBES2) vs 1.2.840.113549.1.12.1.3 (PBESv1 3DES)
_PBES2_OID = bytes.fromhex("06092a864886f70d01050d")
_PBESV1_SHA1_3DES_OID = bytes.fromhex("060a2a864886f70d010c0103")
_TEST_PASSWORD = "p12-test-secret"


def _p12_bytes() -> bytes:
    return b"\x30" + b"\x11" * 80


def _p12_b64() -> str:
    return base64.b64encode(_p12_bytes()).decode("ascii")


def _issue_self_signed(cn: str = "Work4You Test"):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    now = datetime.now(timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now)
        .not_valid_after(now + timedelta(days=1))
        .sign(key, hashes.SHA256())
    )
    return key, cert


def _real_p12(*, modern: bool = True, password: str = _TEST_PASSWORD, extra_cas=None) -> bytes:
    key, cert = _issue_self_signed()
    pwd = password.encode("utf-8")
    if modern:
        encryption = serialization.BestAvailableEncryption(pwd)
    else:
        encryption = (
            serialization.PrivateFormat.PKCS12.encryption_builder()
            .kdf_rounds(2048)
            .key_cert_algorithm(PBES.PBESv1SHA1And3KeyTripleDESCBC)
            .hmac_hash(hashes.SHA1())
            .build(pwd)
        )
    return serialize_key_and_certificates(
        name=b"test",
        key=key,
        cert=cert,
        cas=extra_cas,
        encryption_algorithm=encryption,
    )


def test_decode_rejects_empty_and_whitespace():
    with pytest.raises(mod.PrepareError, match="empty"):
        mod.decode_p12_base64("")
    with pytest.raises(mod.PrepareError, match="empty"):
        mod.decode_p12_base64("  \n\t")


def test_decode_rejects_invalid_base64_and_non_p12():
    with pytest.raises(mod.PrepareError, match="not valid Base64"):
        mod.decode_p12_base64("%%%not-base64%%%")
    with pytest.raises(mod.PrepareError, match="PKCS#12"):
        mod.decode_p12_base64(base64.b64encode(b"hello").decode("ascii"))
    with pytest.raises(mod.PrepareError, match="PKCS#12"):
        mod.decode_p12_base64(base64.b64encode(b"\x31" + b"\x00" * 80).decode("ascii"))


def test_decode_accepts_wrapped_standard_base64():
    wrapped = "\n".join(_p12_b64()[i : i + 16] for i in range(0, len(_p12_b64()), 16))
    assert mod.decode_p12_base64(wrapped) == _p12_bytes()
    assert mod.decode_p12_base64(f"  {_p12_b64()} \n") == _p12_bytes()


def test_write_signing_outputs_omits_csc_link_when_disabled(tmp_path):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    env.write_text("ALREADY=1\n", encoding="utf-8")
    mod.write_signing_outputs(
        enabled=False,
        p12_path=None,
        github_env=env,
        github_output=out,
    )
    assert env.read_text(encoding="utf-8") == "ALREADY=1\n"
    assert "CSC_LINK" not in env.read_text(encoding="utf-8")
    assert out.read_text(encoding="utf-8") == "signing=false\n"


def test_write_signing_outputs_sets_absolute_csc_link(tmp_path):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    p12 = tmp_path / "nested" / "cert.p12"
    p12.parent.mkdir()
    p12.write_bytes(_p12_bytes())
    mod.write_signing_outputs(
        enabled=True,
        p12_path=p12,
        github_env=env,
        github_output=out,
    )
    lines = env.read_text(encoding="utf-8").splitlines()
    assert lines == [f"CSC_LINK={p12.resolve()}"]
    assert out.read_text(encoding="utf-8") == "signing=true\n"


def test_main_require_empty_does_not_write_csc_link(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    monkeypatch.delenv("CSC_P12_BASE64", raising=False)
    monkeypatch.delenv("GITHUB_ENV", raising=False)
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    code = mod.main(
        [
            "--require",
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 2
    assert not env.exists()
    assert not out.exists()


def test_main_empty_without_require_omits_csc_link(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    monkeypatch.setenv("CSC_P12_BASE64", "")
    code = mod.main(
        [
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 0
    assert not env.exists()
    assert out.read_text(encoding="utf-8") == "signing=false\n"


def test_main_writes_p12_and_csc_link(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    dest = tmp_path / "out" / "developer-id.p12"
    modern = _real_p12(modern=True)
    assert _PBES2_OID in modern
    assert _PBESV1_SHA1_3DES_OID not in modern
    monkeypatch.setenv("CSC_P12_BASE64", base64.b64encode(modern).decode("ascii"))
    monkeypatch.setenv("CSC_KEY_PASSWORD", _TEST_PASSWORD)
    code = mod.main(
        [
            "--require",
            "--output",
            str(dest),
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 0
    written = dest.read_bytes()
    assert written != modern
    assert _PBESV1_SHA1_3DES_OID in written
    assert _PBES2_OID not in written
    loaded_key, loaded_cert, _cas = load_key_and_certificates(
        written, _TEST_PASSWORD.encode("utf-8")
    )
    assert loaded_key is not None
    assert loaded_cert is not None
    assert dest.stat().st_mode & 0o777 == 0o600
    assert env.read_text(encoding="utf-8") == f"CSC_LINK={dest.resolve()}\n"
    assert out.read_text(encoding="utf-8") == "signing=true\n"


def test_main_require_missing_password_does_not_write_csc_link(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    dest = tmp_path / "out" / "developer-id.p12"
    monkeypatch.setenv("CSC_P12_BASE64", base64.b64encode(_real_p12()).decode("ascii"))
    monkeypatch.setenv("CSC_KEY_PASSWORD", "")
    code = mod.main(
        [
            "--require",
            "--output",
            str(dest),
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 2
    assert not dest.exists()
    assert not env.exists()
    assert not out.exists()


def test_macos_compatible_p12_rewrites_openssl3_to_pbesv1():
    modern = _real_p12(modern=True)
    converted, subject = mod.macos_compatible_p12(modern, _TEST_PASSWORD)
    assert _PBES2_OID in modern
    assert _PBESV1_SHA1_3DES_OID in converted
    assert _PBES2_OID not in converted
    assert "Work4You Test" in subject
    original_key, original_cert, _ = load_key_and_certificates(
        modern, _TEST_PASSWORD.encode("utf-8")
    )
    converted_key, converted_cert, _ = load_key_and_certificates(
        converted, _TEST_PASSWORD.encode("utf-8")
    )
    assert original_cert.public_bytes(serialization.Encoding.DER) == (
        converted_cert.public_bytes(serialization.Encoding.DER)
    )
    assert original_key.private_numbers() == converted_key.private_numbers()


def test_macos_compatible_p12_round_trips_already_legacy():
    legacy = _real_p12(modern=False)
    assert _PBESV1_SHA1_3DES_OID in legacy
    converted, _subject = mod.macos_compatible_p12(legacy, _TEST_PASSWORD)
    assert _PBESV1_SHA1_3DES_OID in converted
    load_key_and_certificates(converted, _TEST_PASSWORD.encode("utf-8"))


def test_macos_compatible_p12_keeps_additional_certs():
    _leaf_key, extra = _issue_self_signed(cn="Work4You Intermediate")
    modern = _real_p12(modern=True, extra_cas=[extra])
    converted, _subject = mod.macos_compatible_p12(modern, _TEST_PASSWORD)
    _key, _cert, cas = load_key_and_certificates(
        converted, _TEST_PASSWORD.encode("utf-8")
    )
    assert cas is not None
    assert extra.public_bytes(serialization.Encoding.DER) in [
        item.public_bytes(serialization.Encoding.DER)
        if hasattr(item, "public_bytes")
        else item.certificate.public_bytes(serialization.Encoding.DER)
        for item in cas
    ]


def test_macos_compatible_p12_rejects_wrong_password():
    modern = _real_p12(modern=True)
    with pytest.raises(mod.PrepareError, match="does not open"):
        mod.macos_compatible_p12(modern, "not-the-password")
    with pytest.raises(mod.PrepareError, match="empty"):
        mod.macos_compatible_p12(modern, "")
    with pytest.raises(mod.PrepareError, match="empty"):
        mod.macos_compatible_p12(modern, None)


def test_main_unreadable_p12_does_not_write_csc_link(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    dest = tmp_path / "out" / "developer-id.p12"
    monkeypatch.setenv("CSC_P12_BASE64", _p12_b64())
    monkeypatch.setenv("CSC_KEY_PASSWORD", _TEST_PASSWORD)
    code = mod.main(
        [
            "--require",
            "--output",
            str(dest),
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 2
    assert not dest.exists()
    assert not env.exists()
    assert not out.exists()


def test_find_work4you_app_prefers_bundle_dir(tmp_path):
    release = tmp_path / "release"
    app = release / "mac-arm64" / "Work4You.app"
    (app / "Contents").mkdir(parents=True)
    (release / "Work4You-0.17.0-mac-arm64.dmg").write_bytes(b"dmg")
    assert mod.find_work4you_app(release) == app


def test_find_work4you_app_missing(tmp_path):
    release = tmp_path / "release"
    release.mkdir()
    with pytest.raises(mod.PrepareError, match="Work4You.app not found"):
        mod.find_work4you_app(release)


def test_print_app_exits_zero(tmp_path, capsys):
    release = tmp_path / "release"
    app = release / "mac" / "Work4You.app"
    app.mkdir(parents=True)
    assert mod.main(["--print-app", str(release)]) == 0
    assert capsys.readouterr().out.strip() == str(app)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("TeamIdentifier=ABCD123456\n", "ABCD123456"),
        ("Authority=Developer ID Application\nTeamIdentifier=TEAMID0001\n", "TEAMID0001"),
        ("TeamIdentifier=not set\n", None),
        ("Identifier=com.work4you.work4you\n", None),
        ("", None),
    ],
)
def test_team_identifier_from_codesign_dv(text, expected):
    assert mod.team_identifier_from_codesign_dv(text) == expected


def test_check_codesign_dv_requires_team_id(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(
        "sys.stdin",
        type("S", (), {"read": staticmethod(lambda: "TeamIdentifier=not set\n")})(),
    )
    assert mod.main(["--check-codesign-dv"]) == 2
    err = capsys.readouterr().err
    assert "TeamIdentifier" in err


def test_check_codesign_dv_accepts_developer_id(monkeypatch, capsys):
    monkeypatch.setattr(
        "sys.stdin",
        type("S", (), {"read": staticmethod(lambda: "TeamIdentifier=ABCD123456\n")})(),
    )
    assert mod.main(["--check-codesign-dv"]) == 0
    assert "TeamIdentifier=ABCD123456" in capsys.readouterr().out


_REAL_CI_SUBJECT = (
    "C=US,O=WORK4YOU TECNOLOGIA LTDA,OU=SNR5Q85JN2,"
    "CN=Developer ID Application: WORK4YOU TECNOLOGIA LTDA (SNR5Q85JN2),"
    "UID=SNR5Q85JN2"
)
_REAL_CI_IDENTITY = (
    "Developer ID Application: WORK4YOU TECNOLOGIA LTDA (SNR5Q85JN2)"
)


class _FakeSecurity:
    def __init__(
        self,
        *,
        identities: str = '  1) AABBCC "Work4You Test"\n',
        keychains: str = '    "/Users/runner/Library/Keychains/login.keychain-db"\n',
        fail_on: str | None = None,
    ):
        self.calls: list[list[str]] = []
        self.identities = identities
        self.keychains = keychains
        self.fail_on = fail_on

    def __call__(self, args: list[str]) -> str:
        assert args and args[0] == "security"
        self.calls.append(list(args))
        verb = args[1]
        if self.fail_on and verb == self.fail_on:
            raise mod.PrepareError(f"security {verb} failed")
        if verb == "find-identity":
            return self.identities
        if verb == "list-keychains" and "-s" not in args:
            return self.keychains
        return ""


def _flag(args: list[str], name: str) -> str:
    return args[args.index(name) + 1]


def test_codesign_identity_from_rfc4514():
    assert mod.codesign_identity_from_rfc4514(_REAL_CI_SUBJECT) == _REAL_CI_IDENTITY
    assert mod.codesign_identity_from_rfc4514("CN=Foo\\, Bar,O=X") == "Foo, Bar"
    with pytest.raises(mod.PrepareError, match="missing CN"):
        mod.codesign_identity_from_rfc4514("O=WORK4YOU,C=US")


def test_generate_keychain_password_is_hex():
    first = mod.generate_keychain_password()
    second = mod.generate_keychain_password()
    assert first != second
    assert len(first) == 32
    int(first, 16)


def test_parse_keychain_list():
    text = (
        '    "/Users/runner/Library/Keychains/login.keychain-db"\n'
        '    "/Library/Keychains/System.keychain"\n'
    )
    assert mod.parse_keychain_list(text) == [
        "/Users/runner/Library/Keychains/login.keychain-db",
        "/Library/Keychains/System.keychain",
    ]


def test_redact_security_argv_hides_passwords():
    rendered = mod.redact_security_argv(
        ["security", "set-key-partition-list", "-k", "super-secret", "kc"]
    )
    assert "super-secret" not in rendered
    assert "-k ***" in rendered


def test_run_security_missing_binary(monkeypatch):
    def _boom(*_args, **_kwargs):
        raise FileNotFoundError("security")

    monkeypatch.setattr(mod.subprocess, "run", _boom)
    with pytest.raises(mod.PrepareError, match="requires macOS"):
        mod.run_security(["security", "list-keychains"])


def test_run_security_redacts_password_in_error(monkeypatch):
    class _Result:
        returncode = 1
        stderr = "bad password super-secret leaked"
        stdout = ""

    monkeypatch.setattr(mod.subprocess, "run", lambda *_a, **_k: _Result())
    with pytest.raises(mod.PrepareError) as exc:
        mod.run_security(
            ["security", "unlock-keychain", "-p", "super-secret", "kc"]
        )
    assert "super-secret" not in str(exc.value)
    assert "***" in str(exc.value)


def test_import_uses_keychain_password_not_p12_password(tmp_path):
    p12 = tmp_path / "cert.p12"
    p12.write_bytes(_p12_bytes())
    keychain = tmp_path / "signing.keychain-db"
    fake = _FakeSecurity(identities=f'  1) AA "{_REAL_CI_IDENTITY}"\n')
    p12_password = "p12-secret"
    keychain_password = "kc-secret"
    mod.import_developer_id_keychain(
        p12_path=p12,
        p12_password=p12_password,
        identity=_REAL_CI_IDENTITY,
        keychain_path=keychain,
        keychain_password=keychain_password,
        run=fake,
    )
    verbs = [call[1] for call in fake.calls]
    assert verbs[:4] == [
        "create-keychain",
        "set-keychain-settings",
        "unlock-keychain",
        "import",
    ]
    assert "set-key-partition-list" in verbs
    create = next(call for call in fake.calls if call[1] == "create-keychain")
    unlocks = [call for call in fake.calls if call[1] == "unlock-keychain"]
    imported = next(call for call in fake.calls if call[1] == "import")
    partition = next(
        call for call in fake.calls if call[1] == "set-key-partition-list"
    )
    assert _flag(create, "-p") == keychain_password
    assert all(_flag(call, "-p") == keychain_password for call in unlocks)
    assert _flag(imported, "-P") == p12_password
    assert _flag(partition, "-k") == keychain_password
    assert _flag(partition, "-k") != p12_password
    assert "/usr/bin/codesign" in imported
    search = next(
        call
        for call in fake.calls
        if call[1] == "list-keychains" and "-s" in call
    )
    assert str(keychain.resolve()) == search[search.index("-s") + 1]


def test_import_find_identity_miss_fails_closed(tmp_path):
    p12 = tmp_path / "cert.p12"
    p12.write_bytes(_p12_bytes())
    fake = _FakeSecurity(identities="  0 valid identities found\n")
    with pytest.raises(mod.PrepareError, match="does not contain"):
        mod.import_developer_id_keychain(
            p12_path=p12,
            p12_password="p12-secret",
            identity=_REAL_CI_IDENTITY,
            keychain_path=tmp_path / "signing.keychain-db",
            keychain_password="kc-secret",
            run=fake,
        )


def test_write_signing_outputs_keychain_omits_csc_link(tmp_path):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    p12 = tmp_path / "cert.p12"
    p12.write_bytes(_p12_bytes())
    keychain = tmp_path / "signing.keychain-db"
    keychain.write_bytes(b"")
    mod.write_signing_outputs(
        enabled=True,
        p12_path=p12,
        github_env=env,
        github_output=out,
        identity=_REAL_CI_IDENTITY,
        keychain_path=keychain,
    )
    text = env.read_text(encoding="utf-8")
    assert "CSC_LINK" not in text
    assert f"CSC_NAME={_REAL_CI_IDENTITY}" in text
    assert f"CSC_KEYCHAIN={keychain.resolve()}" in text
    assert "CSC_IDENTITY_AUTO_DISCOVERY=true" in text
    assert out.read_text(encoding="utf-8") == (
        f"signing=true\nidentity={_REAL_CI_IDENTITY}\n"
        f"keychain={keychain.resolve()}\n"
    )


def test_main_import_keychain_writes_csc_name_not_csc_link(tmp_path, monkeypatch, capsys):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    dest = tmp_path / "out" / "developer-id.p12"
    keychain = tmp_path / "out" / "signing.keychain-db"
    monkeypatch.setenv("CSC_P12_BASE64", base64.b64encode(_real_p12()).decode("ascii"))
    monkeypatch.setenv("CSC_KEY_PASSWORD", _TEST_PASSWORD)
    fake = _FakeSecurity()
    monkeypatch.setattr(mod, "_run_security", fake)
    monkeypatch.setattr(mod, "generate_keychain_password", lambda: "kc-hex-password")
    code = mod.main(
        [
            "--require",
            "--import-keychain",
            "--output",
            str(dest),
            "--keychain",
            str(keychain),
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 0
    env_text = env.read_text(encoding="utf-8")
    assert "CSC_LINK" not in env_text
    assert "CSC_NAME=Work4You Test" in env_text
    partition = next(
        call for call in fake.calls if call[1] == "set-key-partition-list"
    )
    imported = next(call for call in fake.calls if call[1] == "import")
    assert _flag(partition, "-k") == "kc-hex-password"
    assert _flag(imported, "-P") == _TEST_PASSWORD
    assert "imported Developer ID" in capsys.readouterr().out
    assert out.read_text(encoding="utf-8") == (
        "signing=true\nidentity=Work4You Test\n"
        f"keychain={keychain.resolve()}\n"
    )


def test_main_import_keychain_failure_does_not_write_env(tmp_path, monkeypatch):
    env = tmp_path / "github.env"
    out = tmp_path / "github.output"
    dest = tmp_path / "out" / "developer-id.p12"
    monkeypatch.setenv("CSC_P12_BASE64", base64.b64encode(_real_p12()).decode("ascii"))
    monkeypatch.setenv("CSC_KEY_PASSWORD", _TEST_PASSWORD)
    monkeypatch.setattr(
        mod, "_run_security", _FakeSecurity(fail_on="set-key-partition-list")
    )
    code = mod.main(
        [
            "--require",
            "--import-keychain",
            "--output",
            str(dest),
            "--keychain",
            str(tmp_path / "out" / "signing.keychain-db"),
            "--github-env",
            str(env),
            "--github-output",
            str(out),
        ]
    )
    assert code == 2
    assert dest.exists()
    assert not env.exists()
    assert not out.exists()
