"""GUI creation initializes native skills and shares only the platform login."""
import asyncio
import json
from pathlib import Path

import pytest
import yaml

from tools.skills_sync import _discover_bundled_skills, _get_bundled_dir
from work4you_cli import profiles
from work4you_cli.web_models import ProfileCreate
from work4you_cli.web_routers.profiles import create_profile_endpoint


@pytest.mark.parametrize('transport', ['rest', 'rpc'])
@pytest.mark.parametrize('copy', [False, True])
def test_gui_creation_defaults(tmp_path, monkeypatch, transport, copy):
    root = tmp_path / 'work4you'
    root.mkdir()
    monkeypatch.setenv('WORK4YOU_HOME', str(root))
    monkeypatch.setenv('WORK4YOU_SHARED_AUTH_DIR', str(tmp_path / 'shared'))
    monkeypatch.setattr(profiles, 'check_alias_collision', lambda _: True)
    natives = _discover_bundled_skills(_get_bundled_dir())
    assert natives
    native = natives[0][0]
    source = profiles.create_profile('source', no_alias=True)
    (source / '.no-bundled-skills').touch()
    (source / 'skills' / '.bundled_manifest').write_text(f'{native}:old-hash\n')
    (source / 'skills' / '.curator_suppressed').write_text(f'{native}\ncustom-pruned\n')
    custom = source / 'skills' / 'custom'
    custom.mkdir()
    (custom / 'SKILL.md').write_text('---\nname: custom\n---\nCustom skill')
    config = {'skills': {'disabled': [native, 'custom'], 'platform_disabled': {'telegram': [native, 'custom']}},
              'mcp_servers': {'private': {'url': 'https://example.invalid/mcp'}}}
    (source / 'config.yaml').write_text(yaml.safe_dump(config))
    (source / '.env').write_text('WHATSAPP_TOKEN=test-channel-only\n')
    auth = {'providers': {'work4you': {'access_token': 'source-platform'}, 'other': {'access_token': 'provider-only'}},
            'credential_pool': {'work4you': [{'key': 'source-pool'}], 'other': [{'key': 'keep'}]},
            'systems': {'work4you_portal': {'access_token': 'legacy-source'}, 'custom': {'value': 'keep'}}}
    (source / 'auth.json').write_text(json.dumps(auth))
    default_auth = {'providers': {'work4you': {'access_token': 'default-platform'}}}
    (root / 'auth.json').write_text(json.dumps(default_auth))
    before = {p.relative_to(source): p.read_bytes() for p in source.rglob('*') if p.is_file()}
    params = {'name': 'new-agent', 'no_skills': False}
    if copy:
        params.update(clone_from='source', clone_all=True)
    if transport == 'rest':
        result = asyncio.run(create_profile_endpoint(ProfileCreate(**params)))
    else:
        from tui_gateway.server import _methods
        response = _methods['profiles.create'](1, {**params, 'share_auth': True})
        assert 'error' not in response, response
        result = response['result']
    assert result['ok']
    target = root / 'profiles' / 'new-agent'
    installed = _discover_bundled_skills(target / 'skills')
    assert {name for name, _ in natives} <= {name for name, _ in installed}
    assert not (target / '.no-bundled-skills').exists()
    cfg = yaml.safe_load((target / 'config.yaml').read_text()) if (target / 'config.yaml').is_file() else {}
    cfg = cfg or {}
    assert native not in cfg.get('skills', {}).get('disabled', [])
    if copy:
        assert cfg['skills']['disabled'] == ['custom']
        assert cfg['skills']['platform_disabled']['telegram'] == ['custom']
        assert cfg['mcp_servers'] == config['mcp_servers']
        assert (target / 'skills' / 'custom' / 'SKILL.md').read_text() == (custom / 'SKILL.md').read_text()
        assert (target / 'skills' / '.curator_suppressed').read_text() == 'custom-pruned\n'
        assert (target / '.env').read_text() == (source / '.env').read_text()
        saved_auth = json.loads((target / 'auth.json').read_text())
        assert saved_auth['providers'] == {'other': auth['providers']['other']}
        assert saved_auth['credential_pool'] == {'other': auth['credential_pool']['other']}
        assert saved_auth['systems'] == {'custom': {'value': 'keep'}}
    else:
        assert 'WHATSAPP_TOKEN' not in (target / '.env').read_text()
    # Existing source and account remain byte-for-byte unchanged.
    assert before == {p.relative_to(source): p.read_bytes() for p in source.rglob('*') if p.is_file()}
    assert json.loads((root / 'auth.json').read_text()) == default_auth
    from work4you_cli.auth import _load_auth_store, _load_provider_state_with_source
    from work4you_constants import set_work4you_home_override, reset_work4you_home_override
    token = set_work4you_home_override(str(target))
    try:
        state, origin = _load_provider_state_with_source(_load_auth_store(), 'work4you')
        assert state['access_token'] == 'default-platform'
        assert origin == root / 'auth.json'
    finally:
        reset_work4you_home_override(token)
