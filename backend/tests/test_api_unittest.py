import importlib.util
import sys
import unittest
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]


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
    os.environ['AEGIS_AUDIT_LOG_PATH'] = '/tmp/aegis-test-audit.log'
    os.environ['AEGIS_INCIDENTS_DB'] = '/tmp/aegis-test-incidents-unittest.db'

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

    def test_diagnose_returns_grounded_plan(self):
        res = self.client.post('/api/v1/diagnose/48', headers=self.auth_header())
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['diagnosis_source'], 'deterministic-runbook')
        self.assertIn('XID 48', payload['remediation_plan'])
        self.assertIn(payload['grounding_status'], ('grounded', 'partial', 'kb_only', 'unreachable'))

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
