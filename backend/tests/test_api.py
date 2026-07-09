import importlib.util
import sys
import tempfile
from pathlib import Path

import bcrypt
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]


def load_module(monkeypatch):
    admin_hash = bcrypt.hashpw(b'unit-test-pass', bcrypt.gensalt()).decode('utf-8')
    analyst_hash = bcrypt.hashpw(b'unit-test-analyst', bcrypt.gensalt()).decode('utf-8')
    incidents_db = Path(tempfile.gettempdir()) / 'aegis-test-incidents-pytest.db'
    incidents_db = incidents_db.with_name(f'{incidents_db.stem}-{id(monkeypatch)}{incidents_db.suffix}')

    monkeypatch.setenv('ACTIVE_LLM', 'deterministic')
    monkeypatch.setenv('CLAUDE_API_KEY', 'your-anthropic-key-here')
    monkeypatch.setenv('OPENAI_API_KEY', 'your-openai-key-here')
    monkeypatch.setenv('JWT_SECRET', 'unit-test-secret-0123456789abcdef0123456789abcdef')
    monkeypatch.setenv('JWT_HOURS', '1')
    monkeypatch.setenv('ADMIN_HASH', admin_hash)
    monkeypatch.setenv('ANALYST_HASH', analyst_hash)
    monkeypatch.setenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false')
    monkeypatch.setenv('ALLOWED_ORIGINS', 'https://unit.test')
    monkeypatch.setenv('AEGIS_AUDIT_LOG_PATH', '/tmp/aegis-test-audit.log')
    monkeypatch.setenv('AEGIS_INCIDENTS_DB', str(incidents_db))

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))

    spec = importlib.util.spec_from_file_location('aegis_api_under_test', ROOT / 'aegis_api.py')
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


def test_status_reports_running_version(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.get('/api/v1/status')
    assert res.status_code == 200
    payload = res.json()
    assert payload['status'] == 'online'
    assert payload['running_version']
    assert payload['running_version'] == module.RUNTIME_VERSION


def test_diagnose_returns_grounded_plan(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post('/api/v1/diagnose/48', headers=auth_header(client))
    assert res.status_code == 200
    payload = res.json()
    assert payload['diagnosis_source'] == 'deterministic-runbook'
    assert 'XID 48' in payload['remediation_plan']
    assert payload['grounding_status'] in {'grounded', 'partial', 'kb_only', 'unreachable'}


def test_ask_aegis_returns_grounded_answer_and_references(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What should I do first for XID 48 on this node?',
            'lab_id': 'ecc',
            'step_title': 'ECC Recovery',
            'visible_evidence': ['NVRM: Xid (PCI:0000:83:00): 48', 'DCGM DBE count is non-zero'],
            'fault_code': '48',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload['answer_source'] in {'deterministic-grounded', 'deterministic-grounded-timeout'}
    assert payload['official_references']
    assert payload['fault_code'] == '48'
    titles = [item['title'] for item in payload['official_references']]
    assert 'NVIDIA XID Error Codes Reference' in titles
    assert not any('GPU Operator' in title for title in titles)
    assert not any('CUDA Compatibility' in title for title in titles)


def test_ask_aegis_nvlink_question_does_not_attach_irrelevant_sources(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    titles = [item['title'] for item in payload['official_references']]
    assert 'NVIDIA GB200 NVL72 Maintenance Guide' not in titles
    assert not any('GPU Operator' in title for title in titles)
    assert 'NVIDIA references:' not in payload['answer']
    assert 'Grounded answer:' not in payload['answer']
    assert 'degraded from direct NVLink-style communication to PCIe host-bridge (`PHB`) traffic' in payload['answer']
    assert 'collective communication' in payload['answer']
    assert 'throughput drop on AllReduce' in payload['answer']
    assert 'inter-GPU fabric or topology layer' in payload['answer']
    assert 'Grounding:' not in payload['answer']


def test_ask_aegis_nvlink_healthy_topology_explains_baseline(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    assert 'direct NVLink-connected GPU relationships (`NV4`)' in payload['answer']
    assert 'healthy fabric baseline' in payload['answer']
    assert 'fast GPU-to-GPU communication' in payload['answer']
    assert 'collective performance and link counters' in payload['answer']
    assert 'Grounding:' not in payload['answer']


def test_ask_aegis_owning_layer_prompt_explains_layer(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    assert 'The current evidence points first to fabric and collective communication.' in payload['answer']
    assert 'inter-GPU fabric or topology layer' in payload['answer']


def test_ask_aegis_next_check_prompt_returns_direct_check(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    assert payload['answer'] == 'Next safe check: Confirm whether the node topology, NVLink health, or transport selection regressed before changing CUDA, NCCL tuning, or the workload itself.'


def test_ask_aegis_branch_reason_prompt_explains_scoring(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    assert 'Reboot cluster is scored as weak because it adds ambiguity before the owning layer is clear.' in payload['answer']
    assert 'The fast path stayed unresolved.' in payload['answer']


def test_ask_aegis_container_runtime_prompt_explains_bridge(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'container',
            'step_title': 'Run with GPU',
            'visible_evidence': ['GPU accessible from inside container ✓'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'runtime is exposing GPU devices inside the container' in payload['answer']
    assert 'runtime-delivery evidence' in payload['answer']
    assert 'Verify the framework inside the container can use CUDA' in payload['answer']


def test_ask_aegis_training_storage_prompt_explains_starvation(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'training',
            'step_title': 'Storage Bottleneck',
            'visible_evidence': ['nfs0: 100% util — sawtooth bottleneck detected'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'input-path starvation problem' in payload['answer']
    assert 'data path and platform efficiency path' in payload['answer']
    assert 'Confirm storage saturation' in payload['answer']


def test_ask_aegis_roce_fault_prompt_explains_pause_storm(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'roce',
            'step_title': 'Fault: PFC Storm',
            'visible_evidence': ['rx_pfc_frames: 24891 ← PFC storm detected!'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'pause-storm condition' in payload['answer']
    assert 'RoCE congestion behavior in the fabric' in payload['answer']
    assert 'Check pause counters, ECN behavior, and the wider fabric blast radius' in payload['answer']


def test_ask_aegis_slurm_pending_prompt_explains_policy(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
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
    assert res.status_code == 200
    payload = res.json()
    assert 'runtime delivery and workload placement' in payload['answer']
    assert 'scheduler control-plane policy' in payload['answer']
    assert 'Read the pending reason and fairshare signals' in payload['answer']


def test_ask_aegis_cuda_mismatch_prompt_explains_contract(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'cuda_stack',
            'step_title': 'CUDA Mismatch',
            'visible_evidence': ['PyTorch expects 11.8, Driver supports 12.3'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'framework and driver stack have diverged' in payload['answer']
    assert 'software-boundary mismatch' in payload['answer']


def test_ask_aegis_k8s_pending_prompt_explains_capacity(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'k8s',
            'step_title': 'Pending GPU Pod',
            'visible_evidence': ['Insufficient nvidia.com/gpu'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'scheduler is rejecting placement' in payload['answer']
    assert 'workload placement and resource accounting' in payload['answer']


def test_ask_aegis_storage_stripe_prompt_explains_layout(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'storage',
            'step_title': 'Lustre Bottleneck',
            'visible_evidence': ['stripe_count: 1 (Lustre bottleneck)'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'concentrated on a single storage target' in payload['answer']
    assert 'storage layout and parallelism' in payload['answer']


def test_ask_aegis_gds_new_path_prompt_explains_direct_dma(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'gds',
            'step_title': 'Direct DMA Path',
            'visible_evidence': ['NVMe → GPU VRAM (direct DMA - 1 copy)'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'direct DMA toward GPU memory' in payload['answer']
    assert 'architectural transition GPUDirect Storage is meant to provide' in payload['answer']


def test_ask_aegis_allreduce_benchmark_prompt_explains_baseline(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'allreduce',
            'step_title': 'Collective Benchmark',
            'visible_evidence': ['Avg busbw: 187.8 GB/s (NVLink 4.0)'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'bus bandwidth expected from a healthy NVLink-backed path' in payload['answer']
    assert 'performance proof step for the AllReduce path' in payload['answer']


def test_ask_aegis_ib_fault_prompt_explains_link_failure(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'ib_fabric',
            'step_title': 'Fabric Fault',
            'visible_evidence': ['State: Down — Physical connection lost'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'hard link-availability failure' in payload['answer']
    assert 'physical or low-level fabric connectivity' in payload['answer']


def test_ask_aegis_monitoring_alert_prompt_explains_incident_path(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'monitoring',
            'step_title': 'Alert Test',
            'visible_evidence': ['PagerDuty incident created: GPU 3 DBE ✓'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'escalated a GPU fault signal into a real incident destination' in payload['answer']
    assert 'end-to-end monitoring proof' in payload['answer']


def test_ask_aegis_mig_create_prompt_explains_capacity_layout(monkeypatch):
    module = load_module(monkeypatch)
    client = TestClient(module.app)

    res = client.post(
        '/api/v1/ask-aegis',
        headers=auth_header(client),
        json={
            'question': 'What changed in this step, and why does it matter operationally?',
            'lab_id': 'mig',
            'step_title': 'Create Slices',
            'visible_evidence': ['7 MIG instances created (1g.10gb)'],
            'ask_intent': 'what_changed',
            'allow_llm': False,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert 'concrete MIG slices created' in payload['answer']
    assert 'usable capacity layout' in payload['answer']


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
