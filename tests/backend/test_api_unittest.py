import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2] / 'backend'


def load_module():
    import os

    admin_hash = bcrypt.hashpw(b'unit-test-pass', bcrypt.gensalt()).decode('utf-8')
    analyst_hash = bcrypt.hashpw(b'unit-test-analyst', bcrypt.gensalt()).decode('utf-8')

    os.environ['ACTIVE_LLM'] = 'deterministic'
    os.environ['CLAUDE_API_KEY'] = 'your-anthropic-key-here'
    os.environ['OPENAI_API_KEY'] = 'your-openai-key-here'
    os.environ['JWT_SECRET'] = 'unit-test-secret-0123456789abcdef0123456789abcdef'
    os.environ['JWT_HOURS'] = '1'
    os.environ['ADMIN_HASH'] = admin_hash
    os.environ['ANALYST_HASH'] = analyst_hash
    os.environ['ALLOW_DESTRUCTIVE_REMEDIATION'] = 'false'
    os.environ['ALLOWED_ORIGINS'] = 'https://unit.test'
    os.environ['AEGIS_AUDIT_LOG_PATH'] = str(Path(tempfile.gettempdir()) / f"aegis-test-audit-{next(tempfile._get_candidate_names())}.log")
    os.environ['AEGIS_INCIDENTS_DB'] = str(Path(tempfile.gettempdir()) / f"aegis-test-incidents-{next(tempfile._get_candidate_names())}.db")

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    spec = importlib.util.spec_from_file_location('aegis_api_under_test_unittest', ROOT / 'log-analizer.py')
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class BackendSmokeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()
        cls.client = TestClient(cls.module.app)

    def auth_header(self, username='admin', password='unit-test-pass'):
        res = self.client.post('/api/v1/auth/login', json={'username': username, 'password': password})
        self.assertEqual(res.status_code, 200)
        token = res.json()['token']
        return {'Authorization': f'Bearer {token}'}

    def test_login_and_me(self):
        res = self.client.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'unit-test-pass'})
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['role'], 'admin')
        self.assertTrue(payload['token'])

        me = self.client.get('/api/v1/auth/me', headers={'Authorization': f"Bearer {payload['token']}"})
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['username'], 'admin')

    def test_metrics_requires_auth(self):
        res = self.client.get('/api/v1/hardware/metrics')
        self.assertIn(res.status_code, (401, 403))

    def test_metrics_returns_per_gpu_snapshot_when_available(self):
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

        original = self.module.get_engine
        self.module.get_engine = lambda: FakeEngine()
        try:
            res = self.client.get('/api/v1/hardware/metrics', headers=self.auth_header())
        finally:
            self.module.get_engine = original
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertFalse(payload['degraded'])
        self.assertEqual(payload['telemetry_sources'], ['nvidia-smi', 'dcgm'])
        self.assertEqual(payload['fabric_summary']['nvlink'], 'available')
        self.assertEqual(len(payload['per_gpu']), 2)
        self.assertEqual(payload['per_gpu'][0]['pci_bus_id'], '0000:01:00.0')

    def test_metrics_exposes_degraded_reason_when_falling_back(self):
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

        original = self.module.get_engine
        self.module.get_engine = lambda: FakeEngine()
        try:
            res = self.client.get('/api/v1/hardware/metrics', headers=self.auth_header())
        finally:
            self.module.get_engine = original
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertTrue(payload['degraded'])
        self.assertEqual(payload['telemetry_scope'], 'host')
        self.assertIn('falling back', payload['degraded_reason'])
        self.assertEqual(payload['collection_errors'], ['nvidia_smi_unavailable'])

    def test_diagnose_returns_grounded_plan(self):
        res = self.client.post('/api/v1/diagnose/48', headers=self.auth_header())
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['diagnosis_source'], 'deterministic-runbook')
        self.assertIn('XID 48', payload['remediation_plan'])
        self.assertTrue(payload['grounded_sources'])

    def test_diagnose_reports_partial_grounding_truthfully(self):
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

        original = self.module.get_engine
        self.module.get_engine = lambda: FakeEngine()
        try:
            res = self.client.post('/api/v1/diagnose/48', headers=self.auth_header())
        finally:
            self.module.get_engine = original
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['grounding_status'], 'partial')
        self.assertIn('recent_xids', payload['grounded_sources'])
        self.assertIn('gpu_health', payload['unavailable_sources'])
        self.assertIn('Partial grounding', payload['hallucination_check'])

    def test_admin_role_required_for_remediation(self):
        res = self.client.post('/api/v1/remediate/79', headers=self.auth_header(username='analyst', password='unit-test-analyst'))
        self.assertEqual(res.status_code, 403)

    def test_remediation_defaults_to_manual_for_destructive_runbooks(self):
        res = self.client.post('/api/v1/remediate/79', headers=self.auth_header())
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['status'], 'manual_required')
        self.assertEqual(payload['fault'], 'XID 79')


if __name__ == '__main__':
    unittest.main()
