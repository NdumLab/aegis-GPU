import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]


def load_module():
    import os

    admin_hash = bcrypt.hashpw(b'unit-test-pass', bcrypt.gensalt()).decode('utf-8')
    analyst_hash = bcrypt.hashpw(b'unit-test-analyst', bcrypt.gensalt()).decode('utf-8')
    incidents_db = Path(tempfile.gettempdir()) / f'aegis-test-incidents-unittest-{os.getpid()}.db'

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
    os.environ['AEGIS_INCIDENTS_DB'] = str(incidents_db)

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    spec = importlib.util.spec_from_file_location('aegis_api_under_test_unittest', ROOT / 'aegis_api.py')
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

    def test_status_reports_running_version(self):
        res = self.client.get('/api/v1/status')
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['status'], 'online')
        self.assertTrue(payload['running_version'])
        self.assertEqual(payload['running_version'], self.module.RUNTIME_VERSION)

    def test_diagnose_returns_grounded_plan(self):
        res = self.client.post('/api/v1/diagnose/48', headers=self.auth_header())
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['diagnosis_source'], 'deterministic-runbook')
        self.assertIn('XID 48', payload['remediation_plan'])
        self.assertIn(payload['grounding_status'], ('grounded', 'partial', 'kb_only', 'unreachable'))

    def test_ask_aegis_returns_grounded_answer_and_references(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What should I do first for XID 48 on this node?',
                'lab_id': 'ecc',
                'step_title': 'ECC Recovery',
                'visible_evidence': ['NVRM: Xid (PCI:0000:83:00): 48', 'DCGM DBE count is non-zero'],
                'fault_code': '48',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn(payload['answer_source'], ('deterministic-grounded', 'deterministic-grounded-timeout'))
        self.assertTrue(payload['official_references'])
        self.assertEqual(payload['fault_code'], '48')
        titles = [item['title'] for item in payload['official_references']]
        self.assertIn('NVIDIA XID Error Codes Reference', titles)
        self.assertTrue(any(item.get('url') for item in payload['official_references']))
        self.assertFalse(any('GPU Operator' in title for title in titles))
        self.assertFalse(any('CUDA Compatibility' in title for title in titles))

    def test_ask_aegis_nvlink_question_does_not_attach_irrelevant_sources(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'nvlink',
                'step_title': 'Topology Regression',
                'visible_evidence': [
                    'GPU0 X PHB PHB PHB',
                    'Actual AllReduce: ~ 3 GB/s (PCIe bottleneck)',
                ],
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        titles = [item['title'] for item in payload['official_references']]
        self.assertNotIn('NVIDIA GB200 NVL72 Maintenance Guide', titles)
        self.assertFalse(any('GPU Operator' in title for title in titles))
        self.assertNotIn('NVIDIA references:', payload['answer'])
        self.assertNotIn('Grounded answer:', payload['answer'])
        self.assertIn('degraded from direct NVLink-style communication to PCIe host-bridge (`PHB`) traffic', payload['answer'])
        self.assertIn('collective communication', payload['answer'])
        self.assertIn('throughput drop on AllReduce', payload['answer'])
        self.assertIn('inter-GPU fabric or topology layer', payload['answer'])
        self.assertNotIn('Grounding:', payload['answer'])

    def test_ask_aegis_nvlink_healthy_topology_explains_baseline(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'nvlink',
                'step_title': 'Topology Baseline',
                'visible_evidence': [
                    'GPU0 X NV4 NV4 NV4 NV4 NV4 NV4 NV4 0-63',
                    'GPU1 NV4 X NV4 NV4 NV4 NV4 NV4 NV4 0-63',
                    'GPU2 NV4 NV4 X NV4 NV4 NV4 NV4 NV4 0-63',
                ],
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('direct NVLink-connected GPU relationships (`NV4`)', payload['answer'])
        self.assertIn('healthy fabric baseline', payload['answer'])
        self.assertIn('fast GPU-to-GPU communication', payload['answer'])
        self.assertIn('collective performance and link counters', payload['answer'])
        self.assertNotIn('Grounding:', payload['answer'])

    def test_ask_aegis_owning_layer_prompt_explains_layer(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'Which infrastructure layer owns this symptom first, based on the current evidence?',
                'lab_id': 'nvlink',
                'step_title': 'Topology Regression',
                'visible_evidence': [
                    'GPU0 X PHB PHB PHB',
                    'Actual AllReduce: ~ 3 GB/s (PCIe bottleneck)',
                ],
                'ask_intent': 'owning_layer',
                'inferred_layer': 'fabric and collective communication',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('The current evidence points first to fabric and collective communication.', payload['answer'])
        self.assertIn('inter-GPU fabric or topology layer', payload['answer'])

    def test_ask_aegis_next_check_prompt_returns_direct_check(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What is the next safe check before I change anything broader?',
                'lab_id': 'nvlink',
                'step_title': 'Topology Regression',
                'visible_evidence': [
                    'GPU0 X PHB PHB PHB',
                    'Actual AllReduce: ~ 3 GB/s (PCIe bottleneck)',
                ],
                'ask_intent': 'next_check',
                'next_check_hint': 'Compare the current output with the step goal before advancing.',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(
            payload['answer'],
            'Next safe check: Confirm whether the node topology, NVLink health, or transport selection regressed before changing CUDA, NCCL tuning, or the workload itself.',
        )

    def test_ask_aegis_branch_reason_prompt_explains_scoring(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'Why is this branch scored this way, and what evidence is it protecting?',
                'lab_id': 'nvlink',
                'step_title': 'Topology Regression',
                'visible_evidence': [
                    'GPU0 X PHB PHB PHB',
                    'Actual AllReduce: ~ 3 GB/s (PCIe bottleneck)',
                ],
                'ask_intent': 'branch_reason',
                'inferred_layer': 'fabric and collective communication',
                'branch_effect': 'bad',
                'branch_choice_label': 'Reboot cluster',
                'branch_penalty': 'The fast path stayed unresolved. Collective traffic kept using the degraded route and cluster time was lost.',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('Reboot cluster is scored as weak because it adds ambiguity before the owning layer is clear.', payload['answer'])
        self.assertIn('The fast path stayed unresolved.', payload['answer'])

    def test_ask_aegis_container_runtime_prompt_explains_bridge(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'container',
                'step_title': 'Run with GPU',
                'visible_evidence': ['GPU accessible from inside container ✓'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('runtime is exposing GPU devices inside the container', payload['answer'])
        self.assertIn('runtime-delivery evidence', payload['answer'])
        self.assertIn('Verify the framework inside the container can use CUDA', payload['answer'])

    def test_ask_aegis_training_storage_prompt_explains_starvation(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'training',
                'step_title': 'Storage Bottleneck',
                'visible_evidence': ['nfs0: 100% util — sawtooth bottleneck detected'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('input-path starvation problem', payload['answer'])
        self.assertIn('data path and platform efficiency path', payload['answer'])
        self.assertIn('Confirm storage saturation', payload['answer'])

    def test_ask_aegis_roce_fault_prompt_explains_pause_storm(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'roce',
                'step_title': 'Fault: PFC Storm',
                'visible_evidence': ['rx_pfc_frames: 24891 ← PFC storm detected!'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('pause-storm condition', payload['answer'])
        self.assertIn('RoCE congestion behavior in the fabric', payload['answer'])
        self.assertIn('Check pause counters, ECN behavior, and the wider fabric blast radius', payload['answer'])

    def test_ask_aegis_slurm_pending_prompt_explains_policy(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'Which infrastructure layer owns this symptom first, based on the current evidence?',
                'lab_id': 'slurm',
                'step_title': 'Check Queue',
                'visible_evidence': ['99234  PENDING  (Priority)'],
                'ask_intent': 'owning_layer',
                'inferred_layer': 'runtime delivery and workload placement',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('runtime delivery and workload placement', payload['answer'])
        self.assertIn('scheduler control-plane policy', payload['answer'])
        self.assertIn('Read the pending reason and fairshare signals', payload['answer'])

    def test_ask_aegis_cuda_mismatch_prompt_explains_contract(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'cuda_stack',
                'step_title': 'CUDA Mismatch',
                'visible_evidence': ['PyTorch expects 11.8, Driver supports 12.3'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('framework and driver stack have diverged', payload['answer'])
        self.assertIn('software-boundary mismatch', payload['answer'])

    def test_ask_aegis_k8s_pending_prompt_explains_capacity(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'k8s',
                'step_title': 'Pending GPU Pod',
                'visible_evidence': ['Insufficient nvidia.com/gpu'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('scheduler is rejecting placement', payload['answer'])
        self.assertIn('workload placement and resource accounting', payload['answer'])

    def test_ask_aegis_storage_stripe_prompt_explains_layout(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'storage',
                'step_title': 'Lustre Bottleneck',
                'visible_evidence': ['stripe_count: 1 (Lustre bottleneck)'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('concentrated on a single storage target', payload['answer'])
        self.assertIn('storage layout and parallelism', payload['answer'])

    def test_ask_aegis_gds_new_path_prompt_explains_direct_dma(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'gds',
                'step_title': 'Direct DMA Path',
                'visible_evidence': ['NVMe → GPU VRAM (direct DMA - 1 copy)'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('direct DMA toward GPU memory', payload['answer'])
        self.assertIn('architectural transition GPUDirect Storage is meant to provide', payload['answer'])

    def test_ask_aegis_allreduce_benchmark_prompt_explains_baseline(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'allreduce',
                'step_title': 'Collective Benchmark',
                'visible_evidence': ['Avg busbw: 187.8 GB/s (NVLink 4.0)'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('bus bandwidth expected from a healthy NVLink-backed path', payload['answer'])
        self.assertIn('performance proof step for the AllReduce path', payload['answer'])

    def test_ask_aegis_ib_fault_prompt_explains_link_failure(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'ib_fabric',
                'step_title': 'Fabric Fault',
                'visible_evidence': ['State: Down — Physical connection lost'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('hard link-availability failure', payload['answer'])
        self.assertIn('physical or low-level fabric connectivity', payload['answer'])

    def test_ask_aegis_monitoring_alert_prompt_explains_incident_path(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'monitoring',
                'step_title': 'Alert Test',
                'visible_evidence': ['PagerDuty incident created: GPU 3 DBE ✓'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('escalated a GPU fault signal into a real incident destination', payload['answer'])
        self.assertIn('end-to-end monitoring proof', payload['answer'])

    def test_ask_aegis_mig_create_prompt_explains_capacity_layout(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': 'What changed in this step, and why does it matter operationally?',
                'lab_id': 'mig',
                'step_title': 'Create Slices',
                'visible_evidence': ['7 MIG instances created (1g.10gb)'],
                'ask_intent': 'what_changed',
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('concrete MIG slices created', payload['answer'])
        self.assertIn('usable capacity layout', payload['answer'])

    def test_ask_aegis_confusion_question_uses_explainer_shape(self):
        res = self.client.post(
            '/api/v1/ask-aegis',
            headers=self.auth_header(),
            json={
                'question': "i dont understand what's going on",
                'lab_id': 'nvlink',
                'step_title': 'Topology Check',
                'visible_evidence': ['Forward pass complete on all 16 GPUs'],
                'allow_llm': False,
            },
        )
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertIn('What you are looking at:', payload['answer'])
        self.assertIn('What looks normal vs abnormal:', payload['answer'])
        self.assertIn('Why it matters:', payload['answer'])
        self.assertIn('Next safe check:', payload['answer'])
        self.assertNotIn('Grounded answer:', payload['answer'])
        self.assertIn('healthy compute signal', payload['answer'])
        self.assertIn('forward pass', payload['answer'].lower())
        self.assertIn('communication slowdown, topology mismatch, or fallback clues', payload['answer'])

    def test_admin_role_required_for_remediation(self):
        res = self.client.post('/api/v1/remediate/79', headers=self.auth_header(username='analyst', password='unit-test-analyst'))
        self.assertEqual(res.status_code, 403)

    def test_remediation_defaults_to_manual_for_destructive_runbooks(self):
        res = self.client.post('/api/v1/remediate/79', headers=self.auth_header())
        self.assertEqual(res.status_code, 200)
        payload = res.json()
        self.assertEqual(payload['status'], 'manual_required')
        self.assertEqual(payload['fault'], 'XID 79')

    # --- self-service registration ---

    def test_register_creates_account_and_allows_login(self):
        res = self.client.post('/api/v1/auth/register',
                               json={'username': 'learner1', 'password': 'longenough8'})
        self.assertEqual(res.status_code, 201)
        payload = res.json()
        self.assertEqual(payload['role'], 'user')
        self.assertTrue(payload['token'])

        me = self.client.get('/api/v1/auth/me', headers={'Authorization': f"Bearer {payload['token']}"})
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()['username'], 'learner1')

        login = self.client.post('/api/v1/auth/login',
                                 json={'username': 'learner1', 'password': 'longenough8'})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()['role'], 'user')

    def test_register_rejects_short_password(self):
        res = self.client.post('/api/v1/auth/register',
                               json={'username': 'shortpw', 'password': 'seven77'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('at least 8', res.json()['detail'])

    def test_register_rejects_bad_usernames(self):
        for bad in ('ab', 'a' * 33, 'has space', 'semi;colon', '-leadingdash'):
            res = self.client.post('/api/v1/auth/register',
                                   json={'username': bad, 'password': 'longenough8'})
            self.assertEqual(res.status_code, 400, f'username {bad!r} should be rejected')

    def test_register_rejects_duplicates_and_reserved_names(self):
        first = self.client.post('/api/v1/auth/register',
                                 json={'username': 'dupuser', 'password': 'longenough8'})
        self.assertEqual(first.status_code, 201)
        dup = self.client.post('/api/v1/auth/register',
                               json={'username': 'dupuser', 'password': 'longenough8'})
        self.assertEqual(dup.status_code, 409)
        for reserved in ('admin', 'Admin', 'analyst'):
            res = self.client.post('/api/v1/auth/register',
                                   json={'username': reserved, 'password': 'longenough8'})
            self.assertEqual(res.status_code, 409, f'{reserved} must stay reserved')

    def test_registered_user_cannot_use_wrong_password(self):
        self.client.post('/api/v1/auth/register',
                         json={'username': 'wrongpw', 'password': 'longenough8'})
        res = self.client.post('/api/v1/auth/login',
                               json={'username': 'wrongpw', 'password': 'not-the-password'})
        self.assertEqual(res.status_code, 401)

    # --- password reset via recovery code ---

    def test_register_issues_recovery_code(self):
        res = self.client.post('/api/v1/auth/register',
                               json={'username': 'recuser1', 'password': 'longenough8'})
        self.assertEqual(res.status_code, 201)
        code = res.json().get('recovery_code', '')
        self.assertRegex(code, r'^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$')

    def test_reset_with_recovery_code_changes_password_and_rotates_code(self):
        reg = self.client.post('/api/v1/auth/register',
                               json={'username': 'recuser2', 'password': 'oldpassword'})
        code = reg.json()['recovery_code']

        reset = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser2', 'recovery_code': code, 'new_password': 'newpassword'})
        self.assertEqual(reset.status_code, 200)
        payload = reset.json()
        self.assertTrue(payload['token'])
        new_code = payload['recovery_code']
        self.assertNotEqual(new_code, code)

        old_login = self.client.post('/api/v1/auth/login',
                                     json={'username': 'recuser2', 'password': 'oldpassword'})
        self.assertEqual(old_login.status_code, 401)
        new_login = self.client.post('/api/v1/auth/login',
                                     json={'username': 'recuser2', 'password': 'newpassword'})
        self.assertEqual(new_login.status_code, 200)

        # the used code is dead; the rotated one works
        dead = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser2', 'recovery_code': code, 'new_password': 'anotherpass1'})
        self.assertEqual(dead.status_code, 401)
        alive = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser2', 'recovery_code': new_code, 'new_password': 'anotherpass1'})
        self.assertEqual(alive.status_code, 200)

    def test_reset_accepts_lowercase_and_missing_dashes(self):
        reg = self.client.post('/api/v1/auth/register',
                               json={'username': 'recuser3', 'password': 'oldpassword'})
        sloppy = reg.json()['recovery_code'].lower().replace('-', '')
        reset = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser3', 'recovery_code': sloppy, 'new_password': 'newpassword'})
        self.assertEqual(reset.status_code, 200)

    def test_reset_rejects_wrong_code_unknown_user_and_short_password(self):
        reg = self.client.post('/api/v1/auth/register',
                               json={'username': 'recuser4', 'password': 'oldpassword'})
        code = reg.json()['recovery_code']
        wrong = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser4', 'recovery_code': 'AAAA-BBBB-CCCC', 'new_password': 'newpassword'})
        self.assertEqual(wrong.status_code, 401)
        ghost = self.client.post('/api/v1/auth/reset', json={
            'username': 'no-such-user', 'recovery_code': code, 'new_password': 'newpassword'})
        self.assertEqual(ghost.status_code, 401)
        short = self.client.post('/api/v1/auth/reset', json={
            'username': 'recuser4', 'recovery_code': code, 'new_password': 'seven77'})
        self.assertEqual(short.status_code, 400)

    def test_reset_rejects_env_managed_accounts(self):
        res = self.client.post('/api/v1/auth/reset', json={
            'username': 'admin', 'recovery_code': 'AAAA-BBBB-CCCC', 'new_password': 'newpassword'})
        self.assertEqual(res.status_code, 401)

    # --- account-synced progress ---

    def test_progress_requires_auth(self):
        self.assertIn(self.client.get('/api/v1/progress').status_code, (401, 403))
        self.assertIn(self.client.put('/api/v1/progress', json={'payload': '{}'}).status_code, (401, 403))

    def test_progress_roundtrip_scoped_to_user(self):
        reg_a = self.client.post('/api/v1/auth/register',
                                 json={'username': 'proguser_a', 'password': 'longenough8'})
        reg_b = self.client.post('/api/v1/auth/register',
                                 json={'username': 'proguser_b', 'password': 'longenough8'})
        hdr_a = {'Authorization': f"Bearer {reg_a.json()['token']}"}
        hdr_b = {'Authorization': f"Bearer {reg_b.json()['token']}"}

        empty = self.client.get('/api/v1/progress', headers=hdr_a)
        self.assertEqual(empty.status_code, 200)
        self.assertIsNone(empty.json()['payload'])

        put = self.client.put('/api/v1/progress', headers=hdr_a,
                              json={'payload': '{"gpusim_score":"88","_syncedAt":123}'})
        self.assertEqual(put.status_code, 200)
        self.assertGreater(put.json()['updated_ts'], 0)

        got_a = self.client.get('/api/v1/progress', headers=hdr_a)
        self.assertIn('"gpusim_score":"88"', got_a.json()['payload'])
        got_b = self.client.get('/api/v1/progress', headers=hdr_b)
        self.assertIsNone(got_b.json()['payload'], 'progress leaked across users')

        # overwrite wins
        self.client.put('/api/v1/progress', headers=hdr_a,
                        json={'payload': '{"gpusim_score":"92","_syncedAt":456}'})
        again = self.client.get('/api/v1/progress', headers=hdr_a)
        self.assertIn('"92"', again.json()['payload'])

    def test_progress_rejects_non_json_and_oversized_payloads(self):
        reg = self.client.post('/api/v1/auth/register',
                               json={'username': 'proguser_c', 'password': 'longenough8'})
        hdr = {'Authorization': f"Bearer {reg.json()['token']}"}
        bad = self.client.put('/api/v1/progress', headers=hdr, json={'payload': 'not json'})
        self.assertEqual(bad.status_code, 400)
        huge = self.client.put('/api/v1/progress', headers=hdr,
                               json={'payload': '"' + 'x' * 300_000 + '"'})
        self.assertEqual(huge.status_code, 413)


if __name__ == '__main__':
    unittest.main()
