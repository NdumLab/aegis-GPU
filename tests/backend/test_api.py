import importlib.util
import sys
import tempfile
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2] / 'backend'


def load_module(monkeypatch):
    admin_hash = bcrypt.hashpw(b'unit-test-pass', bcrypt.gensalt()).decode('utf-8')
    analyst_hash = bcrypt.hashpw(b'unit-test-analyst', bcrypt.gensalt()).decode('utf-8')

    monkeypatch.setenv('ACTIVE_LLM', 'deterministic')
    monkeypatch.setenv('CLAUDE_API_KEY', 'your-anthropic-key-here')
    monkeypatch.setenv('OPENAI_API_KEY', 'your-openai-key-here')
    monkeypatch.setenv('JWT_SECRET', 'unit-test-secret')
    monkeypatch.setenv('JWT_HOURS', '1')
    monkeypatch.setenv('ADMIN_HASH', admin_hash)
    monkeypatch.setenv('ANALYST_HASH', analyst_hash)
    monkeypatch.setenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://unit.test')
    monkeypatch.setenv('AEGIS_AUDIT_LOG_PATH', str(Path(tempfile.gettempdir()) / f"aegis-test-audit-{next(tempfile._get_candidate_names())}.log"))

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    spec = importlib.util.spec_from_file_location('aegis_api_under_test', ROOT / 'log-analizer.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def auth_header(client, username='admin', password='unit-test-pass'):
    res = client.post('/api/v1/auth/login', json={'username': username, 'password': password})
    assert res.status_code == 200
    token = res.json()['token']
    return {'Authorization': f'Bearer {token}'}


def test_login_and_me(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'unit-test-pass'})
    assert res.status_code == 200
    payload = res.json()
    assert payload['role'] == 'admin'
    assert payload['token']

    me = client.get('/api/v1/auth/me', headers={'Authorization': f"Bearer {payload['token']}"})
    assert me.status_code == 200
    assert me.json()['username'] == 'admin'


def test_metrics_requires_auth(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.get('/api/v1/hardware/metrics')
    assert res.status_code == 403 or res.status_code == 401


def test_diagnose_returns_grounded_plan(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post('/api/v1/diagnose/48', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['diagnosis_source'] == 'deterministic-runbook'
    assert 'XID 48' in payload['remediation_plan']
    assert payload['grounded_sources']


def test_admin_role_required_for_remediation(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post('/api/v1/remediate/79', headers=auth_header(client, username='analyst', password='unit-test-analyst'))
    assert res.status_code == 403


def test_remediation_defaults_to_manual_for_destructive_runbooks(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post('/api/v1/remediate/79', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['status'] == 'manual_required'
    assert payload['fault'] == 'XID 79'
