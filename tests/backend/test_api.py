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
    monkeypatch.setenv('JWT_SECRET', 'unit-test-secret-0123456789abcdef0123456789abcdef')
    monkeypatch.setenv('JWT_HOURS', '1')
    monkeypatch.setenv('ADMIN_HASH', admin_hash)
    monkeypatch.setenv('ANALYST_HASH', analyst_hash)
    monkeypatch.setenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://unit.test')
    monkeypatch.setenv('AEGIS_AUDIT_LOG_PATH', str(Path(tempfile.gettempdir()) / f"aegis-test-audit-{next(tempfile._get_candidate_names())}.log"))
    monkeypatch.setenv('AEGIS_INCIDENTS_DB', str(Path(tempfile.gettempdir()) / f"aegis-test-incidents-{next(tempfile._get_candidate_names())}.db"))

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


def test_metrics_exposes_degraded_reason_when_falling_back(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    class FakeEngine:
        def collect_live_metrics(self):
            return {
                'util': 17,
                'vram_used': 0,
                'vram_total': 0,
                'temp': 42,
                'power': 0,
                'active_faults': [],
                'source': 'host-fallback',
                'degraded': True,
                'gpu_count': 0,
                'telemetry_scope': 'host',
                'degraded_reason': 'nvidia-smi unavailable or returned no parseable GPU telemetry; falling back to best-effort host metrics.',
                'collection_errors': ['nvidia_smi_unavailable'],
            }

    monkeypatch.setattr(module, 'get_engine', lambda: FakeEngine())
    res = client.get('/api/v1/hardware/metrics', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['degraded'] is True
    assert payload['telemetry_scope'] == 'host'
    assert 'falling back' in payload['degraded_reason']
    assert payload['collection_errors'] == ['nvidia_smi_unavailable']


def test_diagnose_returns_grounded_plan(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    class FakeEngine:
        def collect_fault_context(self, fault_code):
            return {
                'fault_code': fault_code,
                'node': 'unit.test',
                'collected_at': 1,
                'commands': {
                    'recent_xids': 'NVRM: Xid 48, DBE detected',
                    'gpu_inventory': 'GPU 0: H100 SXM5',
                    'gpu_health': 'ECC mode: enabled',
                    'topology': '',
                    'nvlink': '',
                    'fabric': '',
                    'nccl_env': '',
                    'storage': '',
                },
                'command_status': {
                    'recent_xids': 'ok',
                    'gpu_inventory': 'ok',
                    'gpu_health': 'ok',
                    'topology': 'empty',
                    'nvlink': 'empty',
                    'fabric': 'empty',
                    'nccl_env': 'empty',
                    'storage': 'empty',
                },
            }

    monkeypatch.setattr(module, 'get_engine', lambda: FakeEngine())
    res = client.post('/api/v1/diagnose/48', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['diagnosis_source'] == 'deterministic-runbook'
    assert 'XID 48' in payload['remediation_plan']
    assert payload['grounded_sources']
    assert payload['fault_alignment'] == 'confirmed'


def test_diagnose_reports_partial_grounding_truthfully(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    class FakeEngine:
        def collect_fault_context(self, fault_code):
            return {
                'fault_code': fault_code,
                'node': 'unit.test',
                'collected_at': 1,
                'commands': {
                    'recent_xids': 'NVRM: Xid 48, DBE detected',
                    'gpu_inventory': 'GPU 0: H100 SXM5',
                    'gpu_health': 'ERROR: permission denied',
                    'topology': '',
                    'nvlink': '',
                    'fabric': '',
                    'nccl_env': '',
                    'storage': '',
                },
                'command_status': {
                    'recent_xids': 'ok',
                    'gpu_inventory': 'ok',
                    'gpu_health': 'error',
                    'topology': 'empty',
                    'nvlink': 'empty',
                    'fabric': 'empty',
                    'nccl_env': 'empty',
                    'storage': 'empty',
                },
            }

    monkeypatch.setattr(module, 'get_engine', lambda: FakeEngine())
    res = client.post('/api/v1/diagnose/48', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['grounding_status'] == 'partial'
    assert 'recent_xids' in payload['grounded_sources']
    assert 'gpu_health' in payload['unavailable_sources']
    assert 'Partial grounding' in payload['hallucination_check']


def test_diagnose_reports_fault_alignment_mismatch(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    class FakeEngine:
        def collect_fault_context(self, fault_code):
            return {
                'fault_code': fault_code,
                'node': 'unit.test',
                'collected_at': 1,
                'commands': {
                    'recent_xids': 'NVRM: Xid 79, GPU has fallen off the bus',
                    'gpu_inventory': 'GPU 0: H100 SXM5',
                    'gpu_health': 'GPU 0 healthy',
                    'topology': '',
                    'nvlink': '',
                    'fabric': '',
                    'nccl_env': '',
                    'storage': '',
                },
                'command_status': {
                    'recent_xids': 'ok',
                    'gpu_inventory': 'ok',
                    'gpu_health': 'ok',
                    'topology': 'empty',
                    'nvlink': 'empty',
                    'fabric': 'empty',
                    'nccl_env': 'empty',
                    'storage': 'empty',
                },
            }

    monkeypatch.setattr(module, 'get_engine', lambda: FakeEngine())
    res = client.post('/api/v1/diagnose/48', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['fault_alignment'] == 'mismatch'
    assert payload['observed_fault_codes'] == ['79']
    assert 'did not show XID 48' in payload['fault_alignment_note']
    assert 'observed XIDs: 79' in payload['remediation_plan']

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


def test_metrics_returns_per_gpu_snapshot_when_available(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    class FakeEngine:
        def collect_live_metrics(self):
            return {
                'util': 52,
                'vram_used': 96,
                'vram_total': 160,
                'temp': 63,
                'power': 311,
                'active_faults': [],
                'source': 'nvidia-smi',
                'degraded': False,
                'gpu_count': 2,
                'telemetry_scope': 'gpu',
                'degraded_reason': '',
                'collection_errors': [],
                'telemetry_sources': ['nvidia-smi', 'dcgm'],
                'fabric_summary': {'nvlink': 'available', 'dcgm': 'available'},
                'per_gpu': [
                    {'index': 0, 'name': 'H100 SXM5', 'uuid': 'GPU-0', 'pci_bus_id': '0000:01:00.0', 'util': 44, 'vram_used': 40, 'vram_total': 80, 'temp': 61, 'power': 300, 'pstate': 'P0', 'pcie_link_gen_current': 5},
                    {'index': 1, 'name': 'H100 SXM5', 'uuid': 'GPU-1', 'pci_bus_id': '0000:02:00.0', 'util': 60, 'vram_used': 56, 'vram_total': 80, 'temp': 65, 'power': 322, 'pstate': 'P0', 'pcie_link_gen_current': 5},
                ],
            }

    monkeypatch.setattr(module, 'get_engine', lambda: FakeEngine())
    res = client.get('/api/v1/hardware/metrics', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['degraded'] is False
    assert payload['telemetry_sources'] == ['nvidia-smi', 'dcgm']
    assert payload['fabric_summary']['nvlink'] == 'available'
    assert len(payload['per_gpu']) == 2
    assert payload['per_gpu'][0]['pci_bus_id'] == '0000:01:00.0'
