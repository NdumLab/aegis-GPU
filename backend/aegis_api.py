
import concurrent.futures
import json
import logging
import logging.handlers
import os
import re
import sqlite3
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
except ImportError:  # pragma: no cover - local fallback when prometheus_client is unavailable
    CONTENT_TYPE_LATEST = 'text/plain; version=0.0.4; charset=utf-8'

    class _MetricStub:
        def labels(self, **_kwargs):
            return self

        def inc(self, *_args, **_kwargs):
            return None

        def observe(self, *_args, **_kwargs):
            return None

        def set(self, *_args, **_kwargs):
            return None

    def Counter(*_args, **_kwargs):
        return _MetricStub()

    def Gauge(*_args, **_kwargs):
        return _MetricStub()

    def Histogram(*_args, **_kwargs):
        return _MetricStub()

    def generate_latest():
        return b'aegis_prometheus_client_missing 1\n'

import node_scraper


APP_ROOT = Path(__file__).resolve().parent
DEFAULT_ENV_CANDIDATES = [
    os.getenv('AEGIS_ENV_FILE', '').strip(),
    '/etc/aegis-gpu/aegis.env',
    str(APP_ROOT / '.env'),
]


def load_first_available_env(candidates: List[str]) -> Optional[str]:
    for candidate in candidates:
        if not candidate:
            continue
        path = Path(candidate)
        try:
            if not path.exists():
                continue
            load_dotenv(path, override=False)
            return str(path)
        except (OSError, PermissionError):
            continue
    return None


LOADED_ENV_FILE = load_first_available_env(DEFAULT_ENV_CANDIDATES)

JWT_SECRET = os.getenv('JWT_SECRET', '')
if not JWT_SECRET or JWT_SECRET == 'change-me' or len(JWT_SECRET) < 32:
    raise SystemExit('FATAL: JWT_SECRET missing, default, or too short (<32 chars). Refusing to start.')

JWT_ALGO = 'HS256'
JWT_HOURS = int(os.getenv('JWT_HOURS', '8'))
ACTIVE_LLM = os.getenv('ACTIVE_LLM', 'deterministic').strip().lower()
ALLOW_DESTRUCTIVE_REMEDIATION = os.getenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
ALLOWED_ORIGINS = [item.strip() for item in os.getenv('ALLOWED_ORIGINS', '*').split(',') if item.strip()]
AEGIS_NODE_HOST = os.getenv('AEGIS_NODE_HOST', '127.0.0.1').strip() or '127.0.0.1'
AEGIS_NODE_USERNAME = os.getenv('AEGIS_NODE_USERNAME', 'aegis').strip() or 'aegis'
KB_PATH = Path(os.getenv('AEGIS_KB_PATH', str(APP_ROOT / 'nvidia_kb' / 'xid_reference.json')))
MAINTENANCE_GUIDE_PATH = APP_ROOT / 'nvidia_kb' / 'gb200_maintenance.txt'
OFFICIAL_SOURCES_PATH = APP_ROOT / 'nvidia_kb' / 'official_sources.json'
AUDIT_LOG_PATH = os.getenv('AEGIS_AUDIT_LOG_PATH', '/var/log/aegis-gpu/audit.log')
INCIDENTS_DB_PATH = Path(os.getenv('AEGIS_INCIDENTS_DB', '/var/lib/aegis-gpu/incidents.db'))
FRONTEND_DIR = Path(os.getenv('AEGIS_FRONTEND_DIR', '/var/www/html'))
DB_INIT_ERROR = Gauge('aegis_incidents_db_init_error', 'Whether the incidents DB failed to initialize (1=yes, 0=no).')
DB_WRITE_FAILURES = Counter('aegis_incidents_db_write_failures_total', 'Incident DB write failures.')
_DB_READY = False
_DB_ERROR = ''


def detect_runtime_version() -> str:
    configured = (
        os.getenv('AEGIS_APP_VERSION', '').strip()
        or os.getenv('APP_VERSION', '').strip()
        or os.getenv('BUILD_VERSION', '').strip()
    )
    if configured:
        return configured

    version_file_candidates = [
        APP_ROOT / '.aegis-version',
        Path('/opt/aegis-gpu/.aegis-version'),
    ]
    for candidate in version_file_candidates:
        try:
            value = candidate.read_text(encoding='utf-8').strip()
        except (OSError, UnicodeDecodeError):
            continue
        if value:
            return value

    repo_root = APP_ROOT.parent
    git_dir = repo_root / '.git'
    if git_dir.exists():
        try:
            exact_tag = subprocess.run(
                ['git', '-C', str(repo_root), 'describe', '--tags', '--exact-match'],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            if exact_tag:
                return exact_tag
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass
        try:
            branch = subprocess.run(
                ['git', '-C', str(repo_root), 'rev-parse', '--abbrev-ref', 'HEAD'],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            short_sha = subprocess.run(
                ['git', '-C', str(repo_root), 'rev-parse', '--short', 'HEAD'],
                capture_output=True,
                text=True,
                check=True,
            ).stdout.strip()
            if branch and short_sha:
                return f'{branch}@{short_sha}'
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass

    return 'unknown'


RUNTIME_VERSION = detect_runtime_version()


def ensure_incidents_db() -> bool:
    global _DB_READY, _DB_ERROR
    if _DB_READY:
        return True
    try:
        INCIDENTS_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS incidents (
                    id        INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts        INTEGER NOT NULL,
                    kind      TEXT    NOT NULL,
                    fault     TEXT    NOT NULL,
                    user      TEXT    NOT NULL,
                    source    TEXT,
                    status    TEXT,
                    summary   TEXT
                )
            ''')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    username   TEXT PRIMARY KEY,
                    hash       TEXT NOT NULL,
                    role       TEXT NOT NULL DEFAULT 'user',
                    created_ts INTEGER NOT NULL
                )
            ''')
            conn.commit()
        _DB_READY = True
        _DB_ERROR = ''
        DB_INIT_ERROR.set(0)
        return True
    except Exception as exc:
        _DB_READY = False
        _DB_ERROR = str(exc)
        DB_INIT_ERROR.set(1)
        logging.getLogger('aegis.audit').warning('incidents db unavailable: %s', exc)
        return False


def save_incident(kind: str, fault_code: str, user: str, source: str = None,
                  status: str = None, summary: str = None) -> None:
    try:
        if not ensure_incidents_db():
            DB_WRITE_FAILURES.inc()
            return
        with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
            conn.execute(
                'INSERT INTO incidents (ts, kind, fault, user, source, status, summary) VALUES (?,?,?,?,?,?,?)',
                (int(time.time()), kind, fault_code, user, source, status, summary),
            )
            conn.commit()
    except Exception as exc:
        DB_WRITE_FAILURES.inc()
        logging.getLogger('aegis.audit').warning('failed to persist incident: %s', exc)


def resolve_user_hash(hash_env: str, password_env: str) -> str:
    configured_hash = os.getenv(hash_env, '').strip()
    if configured_hash:
        return configured_hash
    configured_password = os.getenv(password_env, '').strip()
    if configured_password:
        return bcrypt.hashpw(configured_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    return ''


USERS = {
    'admin': {'hash': resolve_user_hash('ADMIN_HASH', 'AEGIS_ADMIN_PASSWORD'), 'role': 'admin'},
    'analyst': {'hash': resolve_user_hash('ANALYST_HASH', 'AEGIS_ANALYST_PASSWORD'), 'role': 'analyst'},
}

PLACEHOLDER_VALUES = {'', 'your-anthropic-key-here', 'your-openai-key-here', 'change-me', 'change-this-immediately'}

HTTP_REQUESTS = Counter('aegis_http_requests_total', 'HTTP requests handled by Aegis-GPU.', ['method', 'path', 'status'])
HTTP_LATENCY = Histogram('aegis_http_request_duration_seconds', 'HTTP request latency for Aegis-GPU.', ['method', 'path'])
DIAGNOSE_REQUESTS = Counter('aegis_diagnose_requests_total', 'Diagnose requests handled by the API.', ['fault_code', 'source'])
REMEDIATION_REQUESTS = Counter('aegis_remediation_requests_total', 'Remediation requests handled by the API.', ['fault_code', 'status'])
GPU_UTILIZATION = Gauge('aegis_gpu_utilization_percent', 'Average GPU utilization reported by the backend.')
GPU_MEMORY_USED = Gauge('aegis_gpu_memory_used_gib', 'Total GPU memory used reported by the backend.')
GPU_MEMORY_TOTAL = Gauge('aegis_gpu_memory_total_gib', 'Total GPU memory capacity reported by the backend.')
GPU_TEMPERATURE = Gauge('aegis_gpu_temperature_celsius', 'Average GPU temperature reported by the backend.')
GPU_POWER = Gauge('aegis_gpu_power_watts', 'Average GPU power draw reported by the backend.')
GPU_FAULT_COUNT = Gauge('aegis_gpu_active_faults', 'Number of active GPU faults currently reported by the backend.')
GPU_DEGRADED = Gauge('aegis_gpu_metrics_degraded', 'Whether the backend is using degraded telemetry mode (1=yes, 0=no).')
GPU_COUNT = Gauge('aegis_gpu_count', 'Number of GPUs visible to the backend telemetry collector.')
APP_INFO = Gauge('aegis_build_info', 'Static Aegis-GPU build information.', ['version', 'active_llm'])
APP_INFO.labels(version=RUNTIME_VERSION, active_llm=ACTIVE_LLM).set(1)


def configured_secret(name: str) -> str:
    value = os.getenv(name, '').strip()
    return '' if value.lower() in PLACEHOLDER_VALUES else value


def normalized_path(path: str) -> str:
    if path.startswith('/api/v1/diagnose/'):
        return '/api/v1/diagnose/{fault_code}'
    if path.startswith('/api/v1/remediate/'):
        return '/api/v1/remediate/{fault_code}'
    return path


logging.getLogger('aegis.audit').handlers.clear()
audit_logger = logging.getLogger('aegis.audit')
audit_logger.setLevel(logging.INFO)
try:
    os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
    _fh = logging.FileHandler(AUDIT_LOG_PATH)
    _fh.setFormatter(logging.Formatter('%(asctime)s %(message)s', datefmt='%Y-%m-%dT%H:%M:%SZ'))
    audit_logger.addHandler(_fh)
except Exception:
    logging.basicConfig(level=logging.INFO)
try:
    _sh = logging.handlers.SysLogHandler(address='/dev/log')
    _sh.setFormatter(logging.Formatter('aegis-gpu[audit]: %(message)s'))
    audit_logger.addHandler(_sh)
except Exception:
    pass


def audit(request: Request, event: str, detail: str = '', user: str = None) -> None:
    principal = user or getattr(request.state, 'user', 'unauthenticated')
    ip = (
        request.headers.get('x-real-ip')
        or request.headers.get('x-forwarded-for', '').split(',')[0].strip()
        or (request.client.host if request.client else 'unknown')
    )
    audit_logger.info(f'user="{principal}" ip="{ip}" event="{event}" detail="{detail}"')


app = FastAPI(title='Aegis-GPU Telemetry Daemon', version=RUNTIME_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=['GET', 'POST'],
    allow_headers=['Authorization', 'Content-Type', 'X-Forwarded-Proto'],
)
security = HTTPBearer()


@app.middleware('http')
async def prometheus_middleware(request: Request, call_next):
    path = normalized_path(request.url.path)
    start = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        return response
    finally:
        status_code = response.status_code if response is not None else 500
        HTTP_REQUESTS.labels(method=request.method, path=path, status=str(status_code)).inc()
        HTTP_LATENCY.labels(method=request.method, path=path).observe(time.perf_counter() - start)


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


USERNAME_RE = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9_.-]{1,30})[A-Za-z0-9]$')
MIN_PASSWORD_LENGTH = 8


def get_db_user(username: str) -> Optional[dict]:
    try:
        if not ensure_incidents_db():
            return None
        with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute('SELECT username, hash, role FROM users WHERE username = ?', (username,)).fetchone()
            return dict(row) if row else None
    except Exception as exc:
        logging.getLogger('aegis.audit').warning('user lookup failed: %s', exc)
        return None


def create_db_user(username: str, password_hash: str, role: str = 'user') -> None:
    with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
        conn.execute(
            'INSERT INTO users (username, hash, role, created_ts) VALUES (?,?,?,?)',
            (username, password_hash, role, int(time.time())),
        )
        conn.commit()


class DiagnoseRequest(BaseModel):
    allow_llm: Optional[bool] = None


class AskAegisRequest(BaseModel):
    question: str
    lab_id: Optional[str] = None
    step_title: Optional[str] = None
    visible_evidence: List[str] = Field(default_factory=list)
    fault_code: Optional[str] = None
    ask_intent: Optional[str] = None
    inferred_layer: Optional[str] = None
    next_check_hint: Optional[str] = None
    branch_effect: Optional[str] = None
    branch_choice_label: Optional[str] = None
    branch_penalty: Optional[str] = None
    allow_llm: Optional[bool] = None


class RemediateRequest(BaseModel):
    node_id: int = 0


def create_token(username: str, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS)
    return jwt.encode({'sub': username, 'role': role, 'exp': exp}, JWT_SECRET, algorithm=JWT_ALGO)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token.') from exc


def require_admin(payload: dict = Depends(verify_token)) -> dict:
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin role required.')
    return payload


def get_engine() -> node_scraper.OSIntrospectionEngine:
    return node_scraper.OSIntrospectionEngine(hostname=AEGIS_NODE_HOST, username=AEGIS_NODE_USERNAME)


def load_kb_entry(fault_code: str) -> Dict[str, str]:
    if not KB_PATH.exists():
        return {'title': 'NVIDIA XID Error Codes Reference', 'last_updated': 'unknown', 'entry': ''}
    with KB_PATH.open('r', encoding='utf-8') as handle:
        payload = json.load(handle)
    return {
        'title': payload.get('title', 'NVIDIA XID Error Codes Reference'),
        'last_updated': str(payload.get('last_updated', 'unknown')),
        'entry': str(payload.get('errors', {}).get(str(fault_code), '')),
    }


def normalize_query_terms(text: str) -> List[str]:
    stop_words = {
        'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'which', 'why',
        'does', 'into', 'have', 'your', 'about', 'then', 'than', 'when', 'where',
        'should', 'next', 'check', 'step', 'current', 'visible', 'state', 'safe',
        'changed', 'matter', 'operationally', 'based', 'first', 'layer', 'owns',
        'infrastructure', 'symptom', 'question', 'operator', 'compare',
    }
    ordered: List[str] = []
    for match in re.findall(r'[a-z0-9_.:/-]+', (text or '').lower()):
        if len(match) < 3 or match in stop_words or match in ordered:
            continue
        ordered.append(match)
    return ordered


LAB_REFERENCE_SOURCE_IDS = {
    'ecc': {'nvidia_xid_errors', 'nvidia_dcgm_overview'},
    'nvlink_fault': {'nvidia_xid_errors'},
    'nvlink': set(),
    'mig': {'nvidia_mig_user_guide'},
    'cuda_stack': {'nvidia_cuda_compatibility'},
    'container': set(),
    'training': set(),
    'allreduce': {'nvidia_nccl_troubleshooting'},
    'ib_fabric': {'nvidia_nccl_troubleshooting'},
    'roce': {'nvidia_nccl_troubleshooting'},
    'nccl_fallback': {'nvidia_nccl_troubleshooting'},
    'storage': {'nvidia_gds_troubleshooting'},
    'gds': {'nvidia_gds_troubleshooting'},
    'monitoring': {'nvidia_dcgm_overview'},
    'slurm': set(),
    'k8s': {'nvidia_gpu_operator_troubleshooting', 'nvidia_mig_user_guide'},
}

MAINTENANCE_GUIDE_TERMS = {
    'thermal', 'temperature', 'temp', 'power', 'watt', 'watts', 'throttle',
    'throttled', 'bmc', 'tray', 'trays', 'gb200', 'nvl72',
}


def load_official_source_pack() -> List[Dict[str, Any]]:
    if not OFFICIAL_SOURCES_PATH.exists():
        return []
    try:
        with OFFICIAL_SOURCES_PATH.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []
    sources = payload.get('sources', [])
    return [item for item in sources if isinstance(item, dict)]


def get_allowed_official_source_ids(lab_id: str, fault_code: str) -> Optional[set]:
    normalized_lab_id = (lab_id or '').strip()
    if normalized_lab_id in LAB_REFERENCE_SOURCE_IDS:
        allowed = set(LAB_REFERENCE_SOURCE_IDS[normalized_lab_id])
    else:
        allowed = set()
    if fault_code:
        allowed.add('nvidia_xid_errors')
    if normalized_lab_id in LAB_REFERENCE_SOURCE_IDS:
        return allowed
    return allowed or None


def should_include_maintenance_guide(query_terms: List[str], visible_evidence: List[str]) -> bool:
    evidence_text = ' '.join(str(item or '').lower() for item in (visible_evidence or []))
    return any(term in MAINTENANCE_GUIDE_TERMS for term in query_terms) or any(
        term in evidence_text for term in MAINTENANCE_GUIDE_TERMS
    )


def load_official_references(question: str, fault_code: str = '', kb_entry: Optional[Dict[str, str]] = None,
                             lab_id: str = '', visible_evidence: Optional[List[str]] = None) -> List[Dict[str, str]]:
    references: List[Dict[str, str]] = []
    kb_payload = kb_entry or (load_kb_entry(fault_code) if fault_code else None)
    evidence = visible_evidence or []
    query_terms = normalize_query_terms(' '.join([question, fault_code, *evidence]))
    allowed_source_ids = get_allowed_official_source_ids(lab_id, fault_code)
    if fault_code and kb_payload and kb_payload.get('entry'):
        references.append({
            'title': kb_payload.get('title', 'NVIDIA XID Error Codes Reference'),
            'excerpt': f'XID {fault_code}: {kb_payload["entry"]}',
            'url': 'https://docs.nvidia.com/deploy/xid-errors/index.html',
        })

    if MAINTENANCE_GUIDE_PATH.exists() and should_include_maintenance_guide(query_terms, evidence):
        try:
            guide_text = MAINTENANCE_GUIDE_PATH.read_text(encoding='utf-8')
        except OSError:
            guide_text = ''
        lines = [
            line.strip()
            for line in guide_text.splitlines()
            if line.strip() and not set(line.strip()) <= {'=', '-'}
        ]
        if lines:
            title = lines[0]
            body_lines = lines[1:]
            matched = [line for line in body_lines if any(term in line.lower() for term in query_terms)]
            excerpt = ' '.join(matched[:2])[:500]
            if excerpt:
                references.append({
                    'title': title,
                    'excerpt': excerpt,
                    'url': '',
                })
    scored_sources: List[Tuple[int, Dict[str, Any]]] = []
    for source in load_official_source_pack():
        source_id = str(source.get('id') or '')
        if allowed_source_ids is not None and source_id not in allowed_source_ids:
            continue
        haystacks = [
            str(source.get('title', '')).lower(),
            str(source.get('summary', '')).lower(),
            ' '.join(str(item).lower() for item in source.get('topics', []) if item),
            ' '.join(str(item).lower() for item in source.get('keywords', []) if item),
        ]
        matched_terms = {
            term for term in query_terms
            if any(term in haystack for haystack in haystacks)
        }
        score = len(matched_terms)
        if fault_code and source_id == 'nvidia_xid_errors':
            score += 1
        if score > 0:
            scored_sources.append((score, source))
    for _score, source in sorted(scored_sources, key=lambda item: (-item[0], str(item[1].get('title', ''))))[:3]:
        title = str(source.get('title') or 'NVIDIA official documentation')
        if any(ref.get('title') == title for ref in references):
            continue
        summary = str(source.get('summary') or '').strip()
        topics = [str(item).strip() for item in source.get('topics', []) if str(item).strip()]
        excerpt = summary
        if topics:
            excerpt = f'{summary} Topics: {", ".join(topics[:4])}.'
        references.append({
            'title': title,
            'excerpt': excerpt[:500],
            'url': str(source.get('url') or ''),
        })
    return references


def extract_xid_codes(text: str) -> List[str]:
    matches = re.findall(r'\bXid[^0-9]*(\d{1,4})\b', text or '', flags=re.IGNORECASE)
    ordered: List[str] = []
    for match in matches:
        if match not in ordered:
            ordered.append(match)
    return ordered


def summarize_fault_alignment(fault_code: str, context: Dict[str, Any]) -> Dict[str, Any]:
    commands = context.get('commands', {}) or {}
    recent_xids = commands.get('recent_xids', '') or ''
    observed_fault_codes = extract_xid_codes(recent_xids)

    if context.get('error'):
        return {
            'status': 'unknown',
            'observed_fault_codes': observed_fault_codes,
            'note': 'Fault alignment could not be checked because the target node was unreachable.',
        }

    if not recent_xids.strip():
        return {
            'status': 'unknown',
            'observed_fault_codes': observed_fault_codes,
            'note': 'Fault alignment could not be checked because no recent XID log evidence was available.',
        }

    if fault_code in observed_fault_codes:
        return {
            'status': 'confirmed',
            'observed_fault_codes': observed_fault_codes,
            'note': f'Recent XID log evidence includes XID {fault_code}.',
        }

    if observed_fault_codes:
        return {
            'status': 'mismatch',
            'observed_fault_codes': observed_fault_codes,
            'note': (
                f'Recent XID log evidence did not show XID {fault_code}; '
                f'observed XIDs: {", ".join(observed_fault_codes)}.'
            ),
        }

    return {
        'status': 'not_found',
        'observed_fault_codes': observed_fault_codes,
        'note': f'Recent XID log evidence was collected but did not contain XID {fault_code}.',
    }


def summarize_grounding(context: Dict[str, Any]) -> Dict[str, Any]:
    preferred_order = ('recent_xids', 'gpu_inventory', 'gpu_health', 'dcgm_discovery', 'dcgm_health', 'topology', 'nvlink', 'fabric', 'fabric_manager', 'nccl_env', 'storage')
    commands = context.get('commands', {}) or {}
    status_map = context.get('command_status', {}) or {}
    grounded_sources: List[str] = []
    unavailable_sources: List[str] = []

    for key in preferred_order:
        status_value = status_map.get(key)
        if status_value is None:
            value = (commands.get(key) or '').strip()
            if not value:
                status_value = 'empty'
            elif value.startswith('ERROR:'):
                status_value = 'error'
            else:
                status_value = 'ok'
        if status_value == 'ok':
            grounded_sources.append(key)
        else:
            unavailable_sources.append(key)

    if context.get('error'):
        status = 'unreachable'
        note = 'No live node evidence was collected because the target node was unreachable. Diagnosis falls back to the NVIDIA XID knowledge base and static runbooks.'
    elif grounded_sources and unavailable_sources:
        status = 'partial'
        note = (
            'Partial grounding: live evidence was collected from '
            + ', '.join(grounded_sources)
            + '. Missing or unusable checks: '
            + ', '.join(unavailable_sources)
            + '. Diagnosis is limited to the available evidence plus the NVIDIA XID knowledge base.'
        )
    elif grounded_sources:
        status = 'grounded'
        note = 'Grounded against the NVIDIA XID knowledge base and live node evidence from ' + ', '.join(grounded_sources) + '.'
    else:
        status = 'kb_only'
        note = 'No usable live node evidence was collected. Diagnosis falls back to the NVIDIA XID knowledge base and static runbooks.'

    return {
        'status': status,
        'grounded_sources': grounded_sources,
        'unavailable_sources': unavailable_sources,
        'note': note,
    }


def build_context_summary(context: Dict[str, Any]) -> str:
    commands = context.get('commands', {})
    grounding = summarize_grounding(context)
    sections = []
    for key in grounding['grounded_sources']:
        value = (commands.get(key) or '').strip()
        if value:
            sections.append(f'[{key}]\n{value[:1200]}')
    return '\n\n'.join(sections)[:6000]


def build_visible_evidence_summary(visible_evidence: List[str]) -> str:
    cleaned = [item.strip() for item in (visible_evidence or []) if item and item.strip()]
    return '\n'.join(f'- {item[:300]}' for item in cleaned[:6])


def llm_available() -> bool:
    if ACTIVE_LLM == 'claude':
        return bool(configured_secret('CLAUDE_API_KEY'))
    if ACTIVE_LLM == 'openai':
        return bool(configured_secret('OPENAI_API_KEY'))
    return False


def build_deterministic_diagnosis(fault_code: str, kb_entry: Dict[str, str], context: Dict[str, Any]) -> str:
    summary = kb_entry.get('entry') or f'XID {fault_code} detected with no vendor KB entry available.'
    context_summary = build_context_summary(context)
    grounding = summarize_grounding(context)
    alignment = summarize_fault_alignment(fault_code, context)
    lines = [
        f'Fault summary: XID {fault_code}. {summary}',
        grounding['note'],
        alignment['note'],
    ]
    if grounding['unavailable_sources']:
        lines.append('Unavailable or unusable live checks: ' + ', '.join(grounding['unavailable_sources']))
    lines.extend(node_scraper.RUNBOOKS.get(str(fault_code), node_scraper._DEFAULT_RUNBOOK)['steps'])
    if context_summary:
        lines.append('Observed node context:\n' + context_summary)
    return '\n'.join(lines)


_CLAUDE_SYSTEM_PROMPT = (
    'You are a senior GPU infrastructure engineer. '
    'Write a concise, numbered remediation plan. '
    'Stay strictly within the provided evidence. '
    'If evidence is missing, say so plainly.'
)

_ASK_AEGIS_SYSTEM_PROMPT = (
    'You are Aegis, a grounded GPU infrastructure assistant. '
    'Answer the operator question using only the supplied lab evidence, diagnosis-path summary, '
    'and NVIDIA reference excerpts. '
    'If the operator sounds confused or asks for help understanding what is going on, '
    'use this exact shape: "What you are looking at:", "What looks normal vs abnormal:", '
    '"Why it matters:", and "Next safe check:". '
    'Be concise. State uncertainty plainly. End with one next safe check.'
)


def maybe_llm_diagnosis(fault_code: str, kb_entry: Dict[str, str], context: Dict[str, Any], allow_llm: bool = True) -> Union[Tuple[str, str], dict]:
    grounding = summarize_grounding(context)
    alignment = summarize_fault_alignment(fault_code, context)
    context_summary = build_context_summary(context) or 'No usable live node context was collected.'
    user_content = (
        f'Fault code: XID {fault_code}\n'
        f'Vendor reference: {kb_entry.get("entry") or "No vendor KB entry provided."}\n'
        f'Grounding status: {grounding["status"]}\n'
        f'Fault alignment: {alignment["status"]}\n'
        f'Observed XIDs: {", ".join(alignment["observed_fault_codes"] or ["none"])}\n'
        f'Unavailable checks: {", ".join(grounding["unavailable_sources"] or ["none"])}\n'
        f'Node context:\n{context_summary}'
    )

    if not allow_llm or not llm_available():
        return build_deterministic_diagnosis(fault_code, kb_entry, context), 'deterministic-runbook'

    def _call_llm():
        if ACTIVE_LLM == 'claude':
            api_key = configured_secret('CLAUDE_API_KEY')
            if api_key:
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model=os.getenv('CLAUDE_MODEL', 'claude-sonnet-4-6'),
                    max_tokens=1024,
                    system=[{
                        'type': 'text',
                        'text': _CLAUDE_SYSTEM_PROMPT,
                        'cache_control': {'type': 'ephemeral'},
                    }],
                    messages=[{'role': 'user', 'content': user_content}],
                )
                return response.content[0].text, 'anthropic-grounded'

        if ACTIVE_LLM == 'openai':
            api_key = configured_secret('OPENAI_API_KEY')
            if api_key:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
                    messages=[{'role': 'user', 'content': user_content}],
                )
                return response.choices[0].message.content, 'openai-grounded'

        return build_deterministic_diagnosis(fault_code, kb_entry, context), 'deterministic-runbook'

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call_llm)
        try:
            return future.result(timeout=30)
        except concurrent.futures.TimeoutError:
            return {'error': 'LLM call timed out after 30 seconds. Try again.'}


def is_confusion_or_explainer_question(question: str) -> bool:
    normalized = ' '.join((question or '').lower().split())
    if not normalized:
        return False
    markers = (
        "don't understand",
        'dont understand',
        'do not understand',
        "what's going on",
        'whats going on',
        'what is going on',
        'help me understand',
        'can you explain',
        'explain this',
        'why is this happening',
    )
    return any(marker in normalized for marker in markers)


def split_visible_evidence(visible_evidence: List[str]) -> List[Tuple[str, str]]:
    pairs: List[Tuple[str, str]] = []
    for item in visible_evidence or []:
        raw = str(item or '').strip()
        if not raw:
            continue
        if ' — ' in raw:
            left, right = raw.split(' — ', 1)
            pairs.append((left.strip(), right.strip()))
        else:
            pairs.append((raw, ''))
    return pairs


def classify_visible_signal(signal: str) -> Dict[str, str]:
    text = (signal or '').strip().lower()
    if not text:
        return {
            'kind': 'ambiguous_checkpoint',
            'normality': 'This line needs context before you can call it healthy or broken.',
            'meaning': 'The current step is showing a checkpoint, but not enough evidence to classify it confidently.',
            'why': 'You need to compare it with the step goal before changing a broader layer.',
            'next_check': 'Compare this output with the expected healthy output for the current step.',
        }
    if 'forward pass complete on all' in text or 'complete on all 16 gpus' in text:
        return {
            'kind': 'healthy_signal',
            'normality': 'This is a healthy compute signal on its own. It shows the workload is making forward progress across the GPUs named in the line.',
            'meaning': 'The training job successfully completed a forward pass, so the GPUs are participating in the workload at this stage.',
            'why': 'That usually means the incident, if there is one, is subtler than "the GPUs are completely down." The next question is whether performance, communication, topology, or fallback behavior is degraded.',
            'next_check': 'Look for communication slowdown, topology mismatch, or fallback clues rather than assuming total GPU failure.',
        }
    if any(term in text for term in ('xid', 'double-bit ecc', 'dbe', 'uncorrectable ecc', 'fallen off the bus', 'gpu has fallen off the bus')):
        return {
            'kind': 'hard_fault_signal',
            'normality': 'This is an abnormal hardware-fault signal, not a healthy checkpoint.',
            'meaning': 'The line points to a concrete GPU fault condition that should be treated as incident evidence.',
            'why': 'These signals usually mean the problem is real and localized enough to investigate before making broad platform changes.',
            'next_check': 'Confirm the owning GPU or node and inspect the nearest fault evidence before taking remediation.',
        }
    if any(term in text for term in ('timeout', 'degraded', 'fallback', 'retry', 'throttle', 'slow', 'pending', 'crashloop', 'blocked', 'stalled')):
        return {
            'kind': 'degraded_signal',
            'normality': 'This looks degraded rather than fully healthy.',
            'meaning': 'The workload or platform is still doing something, but not in the expected way.',
            'why': 'That usually means the system is partially working and you should identify the first degraded layer instead of assuming a total outage.',
            'next_check': 'Find the first layer where behavior diverges from the expected healthy path.',
        }
    if any(term in text for term in ('error', 'failed', 'failure', 'fatal', 'cannot', 'unable', 'refused')):
        return {
            'kind': 'hard_fault_signal',
            'normality': 'This looks abnormal and should be treated as fault evidence.',
            'meaning': 'The line shows an explicit failure condition rather than a neutral checkpoint.',
            'why': 'Explicit failures narrow the search space and should be owned before broader changes.',
            'next_check': 'Identify which layer emitted the failure and validate that layer first.',
        }
    return {
        'kind': 'ambiguous_checkpoint',
        'normality': 'This line does not by itself prove a fault. It is a checkpoint that needs step context.',
        'meaning': 'The current step is showing a clue you should interpret against the lab goal.',
        'why': 'Without the expected healthy output, this line alone is too weak to justify a broad action.',
        'next_check': 'Compare this clue with the expected healthy state for the current lab step.',
    }


def build_explainer_ask_aegis_answer(question: str, visible_evidence: List[str],
                                     official_references: List[Dict[str, str]], grounding_note: str) -> str:
    evidence_pairs = split_visible_evidence(visible_evidence)
    first_signal = evidence_pairs[0][0] if evidence_pairs else 'The current step output.'
    first_meaning = evidence_pairs[0][1] if evidence_pairs and evidence_pairs[0][1] else 'This is the main visible clue in the current step.'
    second_signal = evidence_pairs[1][0] if len(evidence_pairs) > 1 else ''
    second_meaning = evidence_pairs[1][1] if len(evidence_pairs) > 1 and evidence_pairs[1][1] else ''
    classification = classify_visible_signal(first_signal)
    references = ', '.join(ref['title'] for ref in official_references[:2] if ref.get('title'))
    lines = [
        'What you are looking at:',
        f'- The current step is showing `{first_signal}`.',
        f'- In plain language: {classification["meaning"]}',
    ]
    if second_signal:
        lines.append(f'- A second useful clue is `{second_signal}`. {second_meaning}'.strip())
    lines.extend([
        'What looks normal vs abnormal:',
        f'- {classification["normality"]}',
        'Why it matters:',
        f'- {classification["why"]}',
    ])
    if references:
        lines.append(f'- Aegis matched this against: {references}.')
    lines.extend([
        f'Grounding note: {grounding_note}',
        'Next safe check:',
        f'- {classification["next_check"]}',
    ])
    return '\n'.join(lines)


def is_what_changed_question(question: str) -> bool:
    normalized = ' '.join((question or '').lower().split())
    return 'what changed' in normalized or 'why does it matter operationally' in normalized


def is_owning_layer_question(question: str, ask_intent: str = '') -> bool:
    normalized = ' '.join((question or '').lower().split())
    return ask_intent == 'owning_layer' or 'which infrastructure layer owns this symptom first' in normalized


def is_next_check_question(question: str, ask_intent: str = '') -> bool:
    normalized = ' '.join((question or '').lower().split())
    return ask_intent == 'next_check' or 'what is the next safe check' in normalized


def is_branch_reason_question(question: str, ask_intent: str = '') -> bool:
    normalized = ' '.join((question or '').lower().split())
    return ask_intent == 'branch_reason' or 'why is this branch scored this way' in normalized


def summarize_operational_change(visible_evidence: List[str]) -> Optional[Dict[str, str]]:
    evidence_text = '\n'.join(str(item or '') for item in visible_evidence)
    text = evidence_text.lower()

    if 'enabled mig mode' in text:
        return {
            'change': 'The GPU has been switched from full-device mode into MIG-capable partitioning mode.',
            'why': 'That matters because the hardware is now preparing to expose slices instead of one monolithic accelerator.',
            'operational': 'This is a hardware partitioning transition, not just a scheduler label change.',
            'next_check': 'Confirm the intended GPU instances were actually created before treating MIG capacity as available.',
        }
    if 'mig instances created' in text:
        return {
            'change': 'The GPU now has concrete MIG slices created on top of MIG mode.',
            'why': 'That matters because partitioning has moved from a mode toggle into usable capacity layout.',
            'operational': 'This is the point where physical GPU capacity becomes subdivided into schedulable instances.',
            'next_check': 'List the instances and verify the slice sizes match the workload plan before assigning them.',
        }
    if 'mig 1g.10gb' in text or (' gi ' in text and ' ci ' in text):
        return {
            'change': 'The GPU is explicitly exposing MIG instances with a concrete size and identity.',
            'why': 'That matters because operators can now reason about what fraction of the accelerator is actually being offered to workloads.',
            'operational': 'This is inventory visibility for partitioned hardware, not proof that a tenant is using the slice yet.',
            'next_check': 'Confirm the workload is bound to the intended MIG device instead of assuming generic GPU visibility is enough.',
        }
    if 'cuda_visible_devices=mig-' in text:
        return {
            'change': 'The workload has been pointed at a specific MIG device instead of a whole GPU.',
            'why': 'That matters because tenant placement is now bound to a slice-level hardware contract.',
            'operational': 'This is the runtime handoff from partitioned inventory into actual workload targeting.',
            'next_check': 'Verify the application sees the intended MIG device and that the slice size matches the workload expectation.',
        }
    if 'mig mode disabled' in text or 'full gpu restored' in text:
        return {
            'change': 'The accelerator has returned from partitioned MIG mode to full-GPU service.',
            'why': 'That matters because the hardware capacity boundary has changed back to one whole device.',
            'operational': 'This is a hardware-capacity recovery step, not just a cosmetic mode toggle.',
            'next_check': 'Confirm no schedulers or runtimes are still expecting MIG slices before placing full-device workloads.',
        }

    if 'nvrm version' in text:
        return {
            'change': 'The host is reporting a specific loaded NVIDIA driver version.',
            'why': 'That matters because the driver is the lower software boundary that the CUDA stack and frameworks have to match.',
            'operational': 'This is a baseline runtime-contract check, not full proof that user-space frameworks agree with it.',
            'next_check': 'Compare the CUDA toolkit and framework expectations against this driver version before changing packages.',
        }
    if 'cuda compiler driver' in text or 'nvcc:' in text:
        return {
            'change': 'The CUDA toolkit version is now visible as a separate layer from the kernel driver.',
            'why': 'That matters because CUDA toolkit, driver, and framework versions can drift independently.',
            'operational': 'This is a software-boundary check, not a hardware health signal.',
            'next_check': 'Compare this toolkit version against both the loaded driver and the framework build before blaming hardware.',
        }
    if 'available: true' in text and 'cuda:' in text:
        return {
            'change': 'The framework can currently see CUDA and reports a usable runtime version.',
            'why': 'That matters because the stack is holding together all the way up into user-space at this checkpoint.',
            'operational': 'This is a healthy framework-visibility baseline, not a guarantee that every later workload path will be healthy.',
            'next_check': 'Use this as the known-good stack baseline before investigating any later mismatch or container issue.',
        }
    if 'pytorch expects' in text and 'driver supports' in text:
        return {
            'change': 'The framework and driver stack have diverged on the CUDA contract they expect.',
            'why': 'That matters because the failure lives at a software-boundary mismatch, not necessarily in the GPU hardware.',
            'operational': 'The owning layer is runtime delivery and compatibility management, not immediate node remediation.',
            'next_check': 'Compare the loaded driver, CUDA toolkit, and framework build against a known-good stack baseline before changing broader system layers.',
        }
    if 'fixed with ngc' in text:
        return {
            'change': 'The CUDA stack has been re-aligned onto a known-good NVIDIA container baseline.',
            'why': 'That matters because the mismatch has been narrowed into a reproducible software bundle instead of ad hoc package drift.',
            'operational': 'This is a controlled runtime-delivery recovery move, not a hardware fix.',
            'next_check': 'Re-run the framework visibility and workload proof steps to confirm the contract is now clean.',
        }

    if 'nvidia-device-plugin ready' in text or 'nvidia-device-plugin ready 1/1' in text:
        return {
            'change': 'The Kubernetes device plugin is healthy and advertising GPU devices to the cluster.',
            'why': 'That matters because scheduler GPU placement depends on this control-plane plumbing before pods can consume accelerators.',
            'operational': 'This is a cluster-device-plumbing health signal, not proof that any given workload has capacity yet.',
            'next_check': 'Confirm allocatable GPU resources and the target pod specification before debugging workload-level failures.',
        }
    if 'allocatable: nvidia.com/gpu' in text:
        return {
            'change': 'The cluster is explicitly reporting allocatable GPU capacity on the node.',
            'why': 'That matters because the scheduler now has a concrete resource contract to place against.',
            'operational': 'This is a healthy control-plane capacity signal, not proof that the requested workload fits current availability.',
            'next_check': 'Compare the workload request with actual free capacity before blaming the node or image.',
        }
    if 'insufficient nvidia.com/gpu' in text:
        return {
            'change': 'The scheduler is rejecting placement because the requested GPU resource is not currently available.',
            'why': 'That matters because this is a Kubernetes scheduling-capacity problem first, not necessarily a broken GPU node.',
            'operational': 'The owning layer is workload placement and resource accounting, not immediate hardware remediation.',
            'next_check': 'Check current allocations, requests, and node eligibility before changing the application or draining hardware.',
        }
    if 'networkpolicy blocking port 29500' in text:
        return {
            'change': 'The workload is now blocked by cluster network policy on a required communication port.',
            'why': 'That matters because distributed coordination can fail even when GPUs and pods are otherwise healthy.',
            'operational': 'The owning layer is cluster network policy and workload communication, not GPU hardware.',
            'next_check': 'Confirm the policy intent and open the required rank-communication path before changing runtime or node settings.',
        }
    if 'drained successfully' in text and 'node/' in text:
        return {
            'change': 'The node has been deliberately removed from Kubernetes scheduling.',
            'why': 'That matters because containment is now preventing new workloads from landing on a suspect node.',
            'operational': 'This is a control-plane containment boundary, not proof that the underlying fault is fixed.',
            'next_check': 'Confirm the drain reason and recovery evidence before returning the node to service.',
        }
    if ('podgroup' in text and 'running (16/16)' in text) or 'podgroup training-gang running (16/16)' in text:
        return {
            'change': 'The gang-scheduled workload has successfully reached the expected coordinated running state.',
            'why': 'That matters because the cluster satisfied the placement contract for the whole distributed job instead of only part of it.',
            'operational': 'This is a healthy orchestration baseline for the workload placement path.',
            'next_check': 'Use this as the control-plane healthy baseline before diagnosing later application or fabric slowdowns.',
        }

    if 'dcgm_fi_dev_gpu_util' in text:
        return {
            'change': 'The monitoring path is successfully exposing a live GPU telemetry signal.',
            'why': 'That matters because quiet dashboards are only trustworthy if the underlying metric pipeline is actually producing data.',
            'operational': 'This is telemetry-path health, not direct proof that alert coverage is complete.',
            'next_check': 'Confirm scraping and alert rules on top of this signal before treating observability as production-ready.',
        }
    if 'listening on :9400/metrics' in text:
        return {
            'change': 'The DCGM exporter endpoint is up and serving the metrics path.',
            'why': 'That matters because observability starts with a live source before Prometheus or Grafana can add value.',
            'operational': 'This is source-path readiness, not end-to-end monitoring proof yet.',
            'next_check': 'Verify the scrape path and one real metric before assuming the dashboards are trustworthy.',
        }
    if 'prometheus scraping' in text:
        return {
            'change': 'Prometheus is now polling the GPU telemetry targets on a live interval.',
            'why': 'That matters because the monitoring stack has moved from exporter readiness into active data collection.',
            'operational': 'This is scrape-path health, not yet proof that operators can interpret or alert on the data well.',
            'next_check': 'Confirm the dashboards and alert rules are consuming the right metrics before calling the observability loop complete.',
        }
    if 'dashboard 12239 imported' in text:
        return {
            'change': 'The Grafana visualization layer is now wired to the monitoring stack.',
            'why': 'That matters because raw metrics are becoming operator-visible rather than staying buried in the scrape backend.',
            'operational': 'This is presentation-path readiness, not proof that alerting or action thresholds are sound.',
            'next_check': 'Validate one dashboard panel against a known source metric before trusting the view operationally.',
        }
    if 'alert gpudoublebitecc created' in text:
        return {
            'change': 'The monitoring stack now has an explicit GPU fault alert rule configured.',
            'why': 'That matters because observability has moved from passive charts into an active incident trigger path.',
            'operational': 'This is alert-coverage setup, not yet proof that the paging workflow fires correctly end to end.',
            'next_check': 'Trigger a controlled test so you can verify the rule actually reaches the incident channel.',
        }
    if 'pagerduty incident created' in text:
        return {
            'change': 'The alerting path has escalated a GPU fault signal into a real incident destination.',
            'why': 'That matters because the observability loop now reaches human response instead of stopping at dashboards.',
            'operational': 'This is end-to-end monitoring proof, not just exporter or scrape readiness.',
            'next_check': 'Confirm the incident details match the source fault signal before trusting the paging workflow in production.',
        }

    if 'nvme → cpu → pcie → gpu' in text or '2 copies' in text:
        return {
            'change': 'The storage path is still using the older multi-copy route through CPU memory before data reaches the GPU.',
            'why': 'That matters because the direct GPU data path is not active yet, so throughput and CPU overhead stay worse than necessary.',
            'operational': 'This is a baseline data-path architecture state, not a direct-storage success condition.',
            'next_check': 'Verify whether GPUDirect Storage is available before treating this path as optimized.',
        }
    if 'nvme → gpu vram' in text or 'direct dma' in text:
        return {
            'change': 'The storage path has shifted into direct DMA toward GPU memory instead of bouncing through CPU memory.',
            'why': 'That matters because the platform is now using the intended direct data path with fewer copies and less CPU mediation.',
            'operational': 'This is the architectural transition GPUDirect Storage is meant to provide.',
            'next_check': 'Verify the GDS runtime is available and compare benchmark results before calling the path fully proven.',
        }
    if 'gds available' in text:
        return {
            'change': 'The GPUDirect Storage runtime is visible and reports itself as available.',
            'why': 'That matters because the platform can now plausibly use the direct path instead of only describing it on paper.',
            'operational': 'This is capability proof for the data path, not yet performance proof.',
            'next_check': 'Compare before-and-after storage benchmarks to confirm the capability translates into a real throughput gain.',
        }
    if ('traditional:' in text and 'mb/s' in text) or 'traditional: 890 mb/s' in text:
        return {
            'change': 'The baseline benchmark is still measuring the older storage path without GPUDirect acceleration.',
            'why': 'That matters because it gives you the control result you need before claiming the direct path improved anything.',
            'operational': 'This is a before-state measurement, not a target performance result.',
            'next_check': 'Run the direct-path benchmark and compare the delta instead of judging the path from one number alone.',
        }
    if ('gds:' in text and 'faster' in text) or ('gds:' in text and 'gb/s' in text) or 'gds: 2.4 gb/s' in text:
        return {
            'change': 'The direct storage path is now showing a measurable throughput improvement over the traditional path.',
            'why': 'That matters because the architectural change is translating into user-visible performance rather than staying theoretical.',
            'operational': 'This is the performance proof step for GPUDirect Storage.',
            'next_check': 'Confirm the benchmark gain is stable and that the workload path is actually using the same direct route.',
        }

    if 'gpu util:' in text and 'sawtooth' in text:
        return {
            'change': 'GPU utilization is oscillating instead of staying steady, which points to starvation rather than smooth compute saturation.',
            'why': 'That matters because the GPUs are repeatedly waiting on an upstream stage instead of failing at pure math.',
            'operational': 'The owning layer is platform efficiency and feed-path diagnosis, not immediate GPU health.',
            'next_check': 'Trace storage and input throughput before tuning the model or accelerator settings.',
        }
    if ('await' in text and '100% util' in text) or 'await 48.2ms' in text:
        return {
            'change': 'The storage device is saturated and latency is now visible in the input path.',
            'why': 'That matters because the GPUs can only run as fast as the data path feeds them.',
            'operational': 'This is a storage bottleneck, not a compute-core weakness.',
            'next_check': 'Check striping and data-loader concurrency before changing GPU or framework settings.',
        }
    if 'stripe_count: 1' in text:
        return {
            'change': 'The dataset is concentrated on a single storage target instead of being spread across multiple ones.',
            'why': 'That matters because one narrow storage lane can starve the whole training path.',
            'operational': 'The owning problem is storage layout and parallelism, not GPU silicon or scheduler policy.',
            'next_check': 'Increase striping or rebalance the data path before tuning compute settings.',
        }
    if 'stripe_count: 8' in text:
        return {
            'change': 'The storage layout has been widened across more targets to feed the workload in parallel.',
            'why': 'That matters because the data path now has a better chance of keeping the GPUs busy instead of starving them.',
            'operational': 'This is a narrow storage-layout remediation tied directly to the earlier bottleneck evidence.',
            'next_check': 'Re-check utilization and throughput to confirm the wider stripe actually reduced starvation.',
        }
    if 'num_workers=16' in text:
        return {
            'change': 'The input pipeline has been widened so more workers can keep the GPUs fed.',
            'why': 'That matters because loader concurrency can be the difference between bursty starvation and steady accelerator use.',
            'operational': 'This is a feed-path tuning step, not a GPU hardware change.',
            'next_check': 'Check whether the utilization sawtooth actually smooths out after the loader change.',
        }
    if 'throughput +2.3×' in text or 'no more sawtooth' in text:
        return {
            'change': 'The storage and feed-path fixes have pushed the workload back toward a steady-state GPU utilization pattern.',
            'why': 'That matters because the platform bottleneck has moved away from starvation and back toward productive compute.',
            'operational': 'This is the post-remediation proof step for the storage bottleneck path.',
            'next_check': 'Keep this as the healthy efficiency baseline for later workload comparisons.',
        }

    if 'ca mlx5_0 state: active' in text or 'nccl_ib_disable=1 found' in text:
        return {
            'change': 'The NCCL fallback investigation has confirmed the InfiniBand adapter itself is active.',
            'why': 'That matters because the fast fabric is physically present, so the fallback likely belongs to configuration or transport selection.',
            'operational': 'This narrows the problem away from a dead fabric and toward the software path choosing it.',
            'next_check': 'Inspect NCCL environment and selected transport before replacing fabric components.',
        }
    if 'unset nccl_ib_disable' in text or 'using network ib restored' in text:
        return {
            'change': 'The communication stack has returned from fallback mode to the intended InfiniBand path.',
            'why': 'That matters because the distributed workload can now use the high-speed transport it was designed for.',
            'operational': 'This is a targeted transport-path recovery, not a broad cluster repair.',
            'next_check': 'Re-run a throughput or workload check to confirm the restored fast path actually improved behavior.',
        }
    if '23× throughput improvement' in text:
        return {
            'change': 'The post-fix benchmark is now showing a major gain after the transport path returned to InfiniBand.',
            'why': 'That matters because the restored fast path is producing real user-visible performance, not just nicer logs.',
            'operational': 'This is the verification step that ties transport recovery to workload value.',
            'next_check': 'Keep the corrected NCCL transport settings as the baseline before investigating any remaining slowdown.',
        }

    if 'portxmitdiscards: 0' in text:
        return {
            'change': 'The fabric port is not discarding transmit traffic at this checkpoint.',
            'why': 'That matters because it suggests the path is not currently dropping traffic under the observed conditions.',
            'operational': 'This is a healthy port-level integrity clue, not full end-to-end workload proof yet.',
            'next_check': 'Compare this clean port signal with link state and real bandwidth before calling the fabric healthy.',
        }
    if 'bw average:' in text and 'ndr' in text:
        return {
            'change': 'The InfiniBand path is delivering bandwidth close to the expected NDR envelope.',
            'why': 'That matters because the physical fabric is behaving like a usable high-speed transport in practice.',
            'operational': 'This is a healthy fabric-performance baseline, not just an adapter-up signal.',
            'next_check': 'Use this as the known-good transport baseline before diagnosing higher-layer collective problems.',
        }
    if 'physical connection lost' in text or 'state: down' in text:
        return {
            'change': 'The InfiniBand path has crossed from healthy transport into a hard link-availability failure.',
            'why': 'That matters because the communication layer is now unavailable, not merely slow.',
            'operational': 'The owning problem is physical or low-level fabric connectivity, not application tuning.',
            'next_check': 'Identify the failing link or cable path before changing NCCL, jobs, or GPU software.',
        }
    if 'bad cable:' in text:
        return {
            'change': 'The diagnosis has narrowed the fabric failure to a specific bad cable path.',
            'why': 'That matters because the incident now has a concrete physical boundary instead of a vague network symptom.',
            'operational': 'This is hardware-fabric isolation, not a generic cluster slowdown diagnosis.',
            'next_check': 'Isolate or replace the bad cable path and then re-sweep the fabric before returning the route to service.',
        }
    if 'sweep complete:' in text and 'bad isolated' in text:
        return {
            'change': 'The fabric sweep has reduced the fault to one isolated bad path while the rest of the ports look healthy.',
            'why': 'That matters because recovery can now stay narrow instead of disrupting the whole fabric.',
            'operational': 'This is a scoped containment and verification result for the network layer.',
            'next_check': 'Repair the isolated bad path and confirm the clean ports still deliver expected bandwidth afterward.',
        }

    if 'nccl info using network ib' in text:
        return {
            'change': 'NCCL is selecting the intended InfiniBand transport instead of a slower fallback path.',
            'why': 'That matters because collective performance depends heavily on choosing the right communication layer.',
            'operational': 'This is a healthy transport-selection baseline, not yet a benchmark result.',
            'next_check': 'Validate the collective rounds or bus bandwidth so the chosen path is proven in practice.',
        }
    if 'reduce-scatter phase' in text:
        return {
            'change': 'The AllReduce operation has entered the first collective stage where data is being partitioned and reduced across ranks.',
            'why': 'That matters because this is where communication overhead becomes visible as shared work rather than local compute.',
            'operational': 'This is a collective-progress checkpoint, not full proof that the whole ring completed efficiently.',
            'next_check': 'Confirm the collective completes the later gather stage cleanly before calling the path healthy.',
        }
    if 'all-gather complete' in text:
        return {
            'change': 'The collective has completed the second major phase and returned synchronized data to the ranks.',
            'why': 'That matters because the whole ring path stayed coherent long enough to finish the operation.',
            'operational': 'This is a healthy collective-completion signal for the communication layer.',
            'next_check': 'Compare benchmark bandwidth against the expected platform baseline before declaring optimal performance.',
        }
    if 'avg busbw' in text and 'nvlink 4.0' in text:
        return {
            'change': 'The collective benchmark is delivering the kind of bus bandwidth expected from a healthy NVLink-backed path.',
            'why': 'That matters because the communication layer is not just up; it is performing at the level the workload expects.',
            'operational': 'This is the performance proof step for the AllReduce path.',
            'next_check': 'Use this as the healthy collective baseline before diagnosing any later fallback or slowdown.',
        }

    if 'submitted batch job' in text:
        return {
            'change': 'The workload has moved from a user request into Slurm scheduler control.',
            'why': 'That matters because the next state changes are now governed by queue policy, resource availability, and node eligibility rather than by the user shell alone.',
            'operational': 'This is a normal scheduler lifecycle transition, not proof that GPUs were allocated yet.',
            'next_check': 'Check the queue and the scheduler reason field before treating delay as an infrastructure problem.',
        }
    if 'pending' in text and 'priority' in text:
        return {
            'change': 'The job is waiting in the scheduler because priority is currently keeping it behind other work.',
            'why': 'That matters because the job is not blocked by a broken node by default; it is being held by scheduler ordering or policy.',
            'operational': 'The owning layer is scheduler control-plane policy, not immediate GPU hardware failure.',
            'next_check': 'Read the pending reason and fairshare signals before draining nodes or changing the workload.',
        }
    if 'reason=priority' in text:
        return {
            'change': 'Slurm has already explained the wait as a priority-driven pending state.',
            'why': 'That matters because the scheduler is telling you this is an explainable queue condition, not a vague outage symptom.',
            'operational': 'This should keep the diagnosis in scheduler policy and allocation state until contradictory node evidence appears.',
            'next_check': 'Check fairshare and cluster load before escalating this into a hardware or node incident.',
        }
    if 'fairshare' in text:
        return {
            'change': 'The scheduler is lowering job priority because recent usage has reduced fairshare.',
            'why': 'That matters because the user-visible slowdown is coming from policy enforcement on a shared cluster, not from broken GPUs.',
            'operational': 'The owning problem is queue policy and tenant fairness, not node remediation.',
            'next_check': 'Explain the policy effect clearly and confirm there is no separate node-health evidence before intervening.',
        }
    if 'state changed to drain' in text or 'state=drain' in text:
        return {
            'change': 'The node has been moved into drain so Slurm stops placing new work on it.',
            'why': 'That matters because containment reduces blast radius while the node is still under investigation.',
            'operational': 'This is a scheduler-level safety boundary, not a broad shutdown.',
            'next_check': 'Confirm the drain reason matches the actual node-risk evidence before resuming service.',
        }
    if 'state changed to idle' in text or 'state=idle' in text or 'resume acknowledged' in text:
        return {
            'change': 'The node has returned to normal scheduler service and can take fresh jobs again.',
            'why': 'That matters because the cluster is treating the node as safe for placement, not merely reachable.',
            'operational': 'This should only happen after the earlier drain reason has been resolved or validated away.',
            'next_check': 'Confirm the recovery evidence is stronger than the pressure to restore capacity.',
        }

    if 'rx_pfc_frames' in text or 'pfc storm' in text or 'tx_prio3_pause' in text or 'rx_prio3_pause' in text:
        return {
            'change': 'The RoCE path has crossed from a healthy lossless policy into a pause-storm condition.',
            'why': 'That matters because the network can stay up while congestion control itself starts hurting distributed traffic under load.',
            'operational': 'The owning problem is RoCE congestion behavior in the fabric, not a generic GPU or application failure.',
            'next_check': 'Check pause counters, ECN behavior, and the wider fabric blast radius before changing higher software layers.',
        }
    if 'ecn threshold lowered' in text or 'storm resolved' in text or 'updated switch buffer profile' in text:
        return {
            'change': 'The remediation has narrowed to congestion-control tuning that directly targets the earlier RoCE pause-storm evidence.',
            'why': 'That matters because the fix is now aligned with the observed control-plane failure instead of being a broad configuration sweep.',
            'operational': 'This is a network-path remediation step, so the proof should come from post-change transport behavior.',
            'next_check': 'Re-measure the RoCE path and pause counters to confirm the storm is actually gone.',
        }
    if ('peak bw' in text and 'rocev2' in text) or ('bw peak:' in text and 'rocev2' in text):
        return {
            'change': 'The Ethernet RDMA path is delivering healthy RoCE bandwidth in the expected range.',
            'why': 'That matters because the MTU, PFC, and ECN design is now showing up as usable transport performance under load.',
            'operational': 'This is a healthy RoCE baseline, so later slowdowns should be compared against this path before blaming GPUs or frameworks.',
            'next_check': 'Confirm the bandwidth stays stable and revisit congestion-control evidence if real workloads still underperform.',
        }
    if 'ecn active' in text:
        return {
            'change': 'The path is explicitly signaling congestion with ECN on the RDMA priority instead of waiting for collapse.',
            'why': 'That matters because graceful congestion signaling helps RoCE stay usable under pressure.',
            'operational': 'This is a control-plane health signal for the Ethernet RDMA fabric, not just an abstract tuning detail.',
            'next_check': 'Compare ECN behavior with PFC and measured bandwidth before deciding the RoCE path is healthy.',
        }
    if 'pfc lossless enabled' in text or ('rx: on' in text and 'tx: on' in text):
        return {
            'change': 'The host-side RoCE path is configured with pause-based lossless behavior where the design expects it.',
            'why': 'That matters because RDMA traffic depends on the transport policy, not just link-up status.',
            'operational': 'This is a host-to-fabric path-readiness clue, not final proof that performance is healthy.',
            'next_check': 'Compare the PFC state with ECN and practical bandwidth before declaring the path healthy.',
        }
    if 'mtu 9000' in text or 'jumbo frames' in text:
        return {
            'change': 'The Ethernet path is aligned on the jumbo-frame MTU the RoCE design expects.',
            'why': 'That matters because packet-size mismatch can quietly poison the RDMA path before higher-level tuning even matters.',
            'operational': 'This is an early path-consistency signal for the fabric layer, not a benchmark result.',
            'next_check': 'Confirm the rest of the RoCE control story, especially PFC and ECN, before trusting performance.',
        }

    if 'nfs0' in text and ('100% util' in text or 'sawtooth' in text or 'waiting on next batch' in text or 'await 48.2ms' in text or 'nfs0: 100% util' in text):
        return {
            'change': 'The distributed training loop has shifted from a compute or collective problem into an input-path starvation problem.',
            'why': 'That matters because the GPUs can look underused or bursty even when the real bottleneck is storage feeding the ranks too slowly.',
            'operational': 'The owning layer is the data path and platform efficiency path, not the model math or GPU fabric alone.',
            'next_check': 'Confirm storage saturation and batch-wait behavior before tuning the model or collective stack.',
        }
    if 'optimizer.step()' in text and 'replicas identical' in text:
        return {
            'change': 'The distributed loop has completed a synchronized update without rank divergence.',
            'why': 'That matters because it shows compute and communication stayed coherent long enough for the whole job to advance as one system.',
            'operational': 'This is an end-to-end healthy DDP loop checkpoint, not just a local compute signal.',
            'next_check': 'Use this as the healthy baseline before diagnosing any later slowdown or stall.',
        }
    if 'allreduce complete via ib ndr' in text:
        return {
            'change': 'The gradient synchronization path is using the intended high-speed InfiniBand transport and completing cleanly.',
            'why': 'That matters because the collective phase is where distributed training speed often succeeds or fails at the platform level.',
            'operational': 'This is a healthy communication-path baseline for DDP, not just a cosmetic log line.',
            'next_check': 'Compare later iteration time or throughput regressions against this healthy collective baseline.',
        }
    if 'backward pass' in text and 'local gradients computed' in text:
        return {
            'change': 'The job has finished the local gradient stage and is about to hand work into the shared communication phase.',
            'why': 'That matters because the next bottleneck may no longer be rank-local compute; it may move into collective synchronization.',
            'operational': 'This is the boundary between local work and distributed dependency in the training loop.',
            'next_check': 'Watch whether the next AllReduce phase stays healthy before blaming the model or data path.',
        }
    if 'forward pass complete on all' in text:
        return {
            'change': 'The ranks have completed local forward compute across the visible GPUs.',
            'why': 'That matters because the compute phase itself is making progress, so the next question is whether the shared synchronization path stays healthy too.',
            'operational': 'This is a healthy local-compute checkpoint, not yet full proof that the whole distributed loop is efficient.',
            'next_check': 'Compare the upcoming synchronization phase against this healthy local-compute baseline.',
        }
    if 'all 16 ranks connected' in text or 'world size' in text:
        return {
            'change': 'The distributed job has successfully formed its expected rank group.',
            'why': 'That matters because the training system is now one coordinated job instead of isolated processes.',
            'operational': 'This is a launch and control-plane success signal for DDP, not proof that later communication or data stages are healthy.',
            'next_check': 'Move next to local compute and synchronization behavior before declaring the full training path healthy.',
        }

    if '94% sm utilisation' in text or '95% sm utilisation' in text or '96% sm utilisation' in text:
        return {
            'change': 'The running containerized workload is actively driving the GPU instead of merely staying alive.',
            'why': 'That matters because live accelerator activity is the final proof that the container path is operationally real.',
            'operational': 'This confirms runtime behavior, not just image choice or startup success.',
            'next_check': 'Keep this as the known-good runtime baseline when comparing later container regressions.',
        }
    if 'throughput=' in text and 'loss=' in text:
        return {
            'change': 'The containerized training job has moved past smoke checks into real workload progress.',
            'why': 'That matters because a usable platform is measured by end-to-end workload behavior, not by whether a shell or import command succeeded.',
            'operational': 'This is the first meaningful proof that the image, runtime, and framework stack are working together for a real job.',
            'next_check': 'Confirm that live GPU activity matches the workload progress before treating the container path as fully validated.',
        }
    if 'torch.cuda.device_count()' in text or ('torch.cuda.is_available()' in text and 'true' in text):
        return {
            'change': 'The framework inside the container can actually see the GPU devices.',
            'why': 'That matters because container startup alone does not prove the application layer can use CUDA.',
            'operational': 'This moves the validation from host/runtime wiring into in-container framework usability.',
            'next_check': 'Run a real workload next so you can separate basic visibility from operational usefulness.',
        }
    if 'gpu accessible from inside container' in text:
        return {
            'change': 'The runtime is exposing GPU devices inside the container as intended.',
            'why': 'That matters because a valid image is not enough if the container runtime never passes the accelerator path through.',
            'operational': 'This is runtime-delivery evidence, not full application proof yet.',
            'next_check': 'Verify the framework inside the container can use CUDA before moving to a real training job.',
        }
    if 'downloaded nvidia/pytorch' in text or ('nvcr.io' in text and 'digest:' in text):
        return {
            'change': 'The environment has been anchored to a known NVIDIA container image baseline.',
            'why': 'That matters because reproducibility starts with an exact image source and tag before you debug higher software layers.',
            'operational': 'This is an image-baseline control point for the runtime delivery path, not proof that GPUs are usable yet.',
            'next_check': 'Launch the image with GPU access so you can verify the runtime bridge into the container.',
        }

    if 'nv4' in text and not any(term in text for term in ('phb', 'pix', 'pxb', 'soc')):
        return {
            'change': 'The visible topology is showing direct NVLink-connected GPU relationships (`NV4`) across the participating GPUs.',
            'why': 'That matters because the node is using the intended high-bandwidth low-latency GPU fabric instead of falling back to a slower host-bridge path.',
            'operational': 'This is a healthy fabric baseline. It means collective-heavy workloads should be able to use fast GPU-to-GPU communication, so later slowdowns should be compared against this topology before blaming higher layers.',
            'next_check': 'Confirm that collective performance and link counters agree with this healthy topology baseline before moving the diagnosis into NCCL tuning or application code.',
        }
    if 'phb' in text and ('allreduce' in text or 'pcie bottleneck' in text or '3 gb/s' in text or '8 gb/s' in text):
        return {
            'change': 'The GPU-to-GPU path has degraded from direct NVLink-style communication to PCIe host-bridge (`PHB`) traffic.',
            'why': 'That matters because collective communication is no longer using the intended high-bandwidth low-latency fabric, so distributed synchronization slows down sharply.',
            'operational': 'The visible throughput drop on AllReduce means the owning problem is the inter-GPU fabric or topology layer, not a generic application slowdown.',
            'next_check': 'Confirm whether the node topology, NVLink health, or transport selection regressed before changing CUDA, NCCL tuning, or the workload itself.',
        }
    if 'tcp fallback' in text or 'using network socket' in text:
        return {
            'change': 'The communication path has fallen back to TCP sockets instead of the preferred high-speed fabric.',
            'why': 'That matters because collectives can still run while silently losing most of their expected bandwidth and latency characteristics.',
            'operational': 'This points first to transport selection or fabric availability rather than a raw GPU compute failure.',
            'next_check': 'Confirm which transport NCCL selected and why the intended fast path was unavailable.',
        }
    if 'xid 48' in text or 'dbe' in text or 'double-bit ecc' in text:
        return {
            'change': 'The node moved from a warning state into a concrete hardware-integrity fault state.',
            'why': 'That matters because uncorrectable ECC evidence means this is no longer just a performance or software issue.',
            'operational': 'The owning layer is hardware fault containment, so the next action should preserve evidence and isolate impact.',
            'next_check': 'Confirm which GPU owns the fault and whether containment on the node matches the active ECC evidence.',
        }
    if 'xid 74' in text:
        return {
            'change': 'The visible evidence now points to an NVLink fault rather than a generic slowdown.',
            'why': 'That matters because GPU-to-GPU communication integrity is now suspect even if the GPUs are still visible.',
            'operational': 'The owning layer is fabric health, not higher-level application behavior.',
            'next_check': 'Confirm the affected link or GPU pair and compare topology, counters, and collective behavior together.',
        }
    if 'xid 79' in text or 'fallen off the bus' in text:
        return {
            'change': 'The GPU path has crossed into a bus-level failure condition.',
            'why': 'That matters because device reachability itself is compromised, not just performance.',
            'operational': 'The owning problem is hardware recovery and containment, not workload tuning.',
            'next_check': 'Confirm the affected GPU or node and validate the recovery boundary before restarting broader services.',
        }
    return None


def infer_owning_layer_from_context(lab_id: str, visible_evidence: List[str], inferred_layer: str = '') -> str:
    if inferred_layer:
        return inferred_layer
    normalized_lab_id = (lab_id or '').strip()
    if normalized_lab_id in {'ecc', 'nvlink_fault', 'mig', 'monitoring'}:
        return 'hardware and fault isolation'
    if normalized_lab_id in {'nvlink', 'allreduce', 'nccl_fallback', 'ib_fabric', 'roce'}:
        return 'fabric and collective communication'
    if normalized_lab_id in {'cuda_stack', 'container', 'k8s', 'slurm'}:
        return 'runtime delivery and workload placement'
    if normalized_lab_id in {'storage', 'gds', 'training'}:
        return 'data path and platform efficiency'

    text = '\n'.join(str(item or '') for item in visible_evidence).lower()
    if any(term in text for term in ('phb', 'nv4', 'allreduce', 'tcp fallback', 'using network socket', 'xid 74')):
        return 'fabric and collective communication'
    if any(term in text for term in ('xid 48', 'xid 79', 'dbe', 'double-bit ecc', 'fallen off the bus')):
        return 'hardware and fault isolation'
    return 'the currently visible infrastructure layer'


def build_what_changed_ask_aegis_answer(visible_evidence: List[str]) -> str:
    summary = summarize_operational_change(visible_evidence)
    lines: List[str] = []
    if summary:
        lines.append(summary['change'])
        lines.append(summary['why'])
        lines.append(summary['operational'])
        lines.append(f'Next safe check: {summary["next_check"]}')
        return '\n'.join(lines)

    if visible_evidence:
        lines.append('Visible evidence:')
        lines.extend(f'- {item[:220]}' for item in visible_evidence[:3])
    lines.append(f'Grounding: {grounding_note}')
    lines.append('Next safe check: compare the visible evidence against the owning layer before making a broader change.')
    return '\n'.join(lines)


def build_owning_layer_ask_aegis_answer(lab_id: str, visible_evidence: List[str], inferred_layer: str = '') -> str:
    layer = infer_owning_layer_from_context(lab_id, visible_evidence, inferred_layer)
    summary = summarize_operational_change(visible_evidence)
    lines = [f'The current evidence points first to {layer}.']
    if summary:
        lines.append(summary['operational'])
        lines.append(f'Next safe check: {summary["next_check"]}')
        return '\n'.join(lines)
    lines.append('Keep the diagnosis in that layer until the visible evidence stops supporting it.')
    lines.append('Next safe check: confirm the first clue that would move the incident into a different layer before changing anything broader.')
    return '\n'.join(lines)


def build_next_check_ask_aegis_answer(visible_evidence: List[str], next_check_hint: str = '') -> str:
    summary = summarize_operational_change(visible_evidence)
    if summary:
        return f'Next safe check: {summary["next_check"]}'
    if next_check_hint:
        return f'Next safe check: {next_check_hint}'
    return 'Next safe check: compare the visible evidence against the owning layer before making a broader change.'


def build_branch_reason_ask_aegis_answer(branch_effect: str = '', branch_choice_label: str = '',
                                         branch_penalty: str = '', lab_id: str = '',
                                         visible_evidence: Optional[List[str]] = None,
                                         inferred_layer: str = '') -> str:
    choice_label = branch_choice_label or 'That branch'
    normalized_effect = (branch_effect or '').strip().lower()
    layer = infer_owning_layer_from_context(lab_id, visible_evidence or [], inferred_layer)
    if normalized_effect == 'best':
        return (
            f'{choice_label} is scored as strong because it keeps the incident narrow and evidence-led. '
            f'It protects the diagnosis from drifting out of {layer} before the visible clues justify a broader move.'
        )
    if branch_penalty:
        return (
            f'{choice_label} is scored as weak because it adds ambiguity before the owning layer is clear. '
            f'{branch_penalty}'
        )
    if normalized_effect in {'warn', 'bad'}:
        return (
            f'{choice_label} is scored as weak because it broadens the response before the visible evidence has fully narrowed the owning layer. '
            f'That creates operational drag and makes the next step harder to trust.'
        )
    return 'No branch choice is recorded on this step yet. Pick a Decision Drill option first, then Ask Aegis can explain the consequence.'


def build_deterministic_ask_aegis_answer(question: str, visible_evidence: List[str], diagnosis_summary: str,
                                         official_references: List[Dict[str, str]], grounding_note: str,
                                         ask_intent: str = '', lab_id: str = '', inferred_layer: str = '',
                                         next_check_hint: str = '', branch_effect: str = '',
                                         branch_choice_label: str = '', branch_penalty: str = '') -> str:
    if is_confusion_or_explainer_question(question):
        return build_explainer_ask_aegis_answer(question, visible_evidence, official_references, grounding_note)
    if is_what_changed_question(question):
        return build_what_changed_ask_aegis_answer(visible_evidence)
    if is_owning_layer_question(question, ask_intent):
        return build_owning_layer_ask_aegis_answer(lab_id, visible_evidence, inferred_layer)
    if is_next_check_question(question, ask_intent):
        return build_next_check_ask_aegis_answer(visible_evidence, next_check_hint)
    if is_branch_reason_question(question, ask_intent):
        return build_branch_reason_ask_aegis_answer(
            branch_effect=branch_effect,
            branch_choice_label=branch_choice_label,
            branch_penalty=branch_penalty,
            lab_id=lab_id,
            visible_evidence=visible_evidence,
            inferred_layer=inferred_layer,
        )
    lines = [f'Grounded answer: {question.strip()}']
    if visible_evidence:
        lines.append('Visible evidence:')
        lines.extend(f'- {item[:220]}' for item in visible_evidence[:3])
    if diagnosis_summary:
        lines.append('Diagnosis-path summary:')
        lines.append(diagnosis_summary[:700])
    lines.append(f'Grounding note: {grounding_note}')
    lines.append('Next safe check: compare the visible evidence against the owning layer before making a broader change.')
    return '\n'.join(lines)


def maybe_llm_ask_aegis(question: str, visible_evidence: List[str], diagnosis_summary: str,
                        official_references: List[Dict[str, str]], grounding_note: str,
                        ask_intent: str = '', lab_id: str = '', inferred_layer: str = '',
                        next_check_hint: str = '', branch_effect: str = '',
                        branch_choice_label: str = '', branch_penalty: str = '',
                        allow_llm: bool = True) -> Tuple[str, str]:
    evidence_summary = build_visible_evidence_summary(visible_evidence) or 'No explicit visible evidence was provided by the client.'
    official_summary = '\n'.join(
        f'[{ref["title"]}]\nURL: {ref.get("url") or "not provided"}\n{ref["excerpt"][:600]}'
        for ref in official_references[:3]
    ) or 'No NVIDIA reference excerpt was available.'
    user_content = (
        f'Operator question:\n{question.strip()}\n\n'
        f'Visible lab evidence:\n{evidence_summary}\n\n'
        f'Existing diagnosis-path summary:\n{diagnosis_summary or "No XID-specific diagnosis summary was available."}\n\n'
        f'NVIDIA official references:\n{official_summary}\n\n'
        f'Grounding note:\n{grounding_note}'
    )

    if not allow_llm or not llm_available():
        return (
            build_deterministic_ask_aegis_answer(
                question,
                visible_evidence,
                diagnosis_summary,
                official_references,
                grounding_note,
                ask_intent=ask_intent,
                lab_id=lab_id,
                inferred_layer=inferred_layer,
                next_check_hint=next_check_hint,
                branch_effect=branch_effect,
                branch_choice_label=branch_choice_label,
                branch_penalty=branch_penalty,
            ),
            'deterministic-grounded',
        )

    def _call_llm():
        if ACTIVE_LLM == 'claude':
            api_key = configured_secret('CLAUDE_API_KEY')
            if api_key:
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model=os.getenv('CLAUDE_MODEL', 'claude-sonnet-4-6'),
                    max_tokens=900,
                    system=[{
                        'type': 'text',
                        'text': _ASK_AEGIS_SYSTEM_PROMPT,
                        'cache_control': {'type': 'ephemeral'},
                    }],
                    messages=[{'role': 'user', 'content': user_content}],
                )
                return response.content[0].text, 'anthropic-grounded-assistant'

        if ACTIVE_LLM == 'openai':
            api_key = configured_secret('OPENAI_API_KEY')
            if api_key:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
                    messages=[
                        {'role': 'system', 'content': _ASK_AEGIS_SYSTEM_PROMPT},
                        {'role': 'user', 'content': user_content},
                    ],
                )
                return response.choices[0].message.content, 'openai-grounded-assistant'

        return (
            build_deterministic_ask_aegis_answer(
                question,
                visible_evidence,
                diagnosis_summary,
                official_references,
                grounding_note,
            ),
            'deterministic-grounded',
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call_llm)
        try:
            return future.result(timeout=30)
        except concurrent.futures.TimeoutError:
            return (
                build_deterministic_ask_aegis_answer(
                    question,
                    visible_evidence,
                    diagnosis_summary,
                    official_references,
                    grounding_note + ' LLM synthesis timed out, so Aegis fell back to deterministic grounding.',
                    ask_intent=ask_intent,
                    lab_id=lab_id,
                    inferred_layer=inferred_layer,
                    next_check_hint=next_check_hint,
                    branch_effect=branch_effect,
                    branch_choice_label=branch_choice_label,
                    branch_penalty=branch_penalty,
                ),
                'deterministic-grounded-timeout',
            )


def update_live_metric_gauges(metrics: Dict[str, Any]) -> None:
    GPU_UTILIZATION.set(metrics.get('util', 0) or 0)
    GPU_MEMORY_USED.set(metrics.get('vram_used', 0) or 0)
    GPU_MEMORY_TOTAL.set(metrics.get('vram_total', 0) or 0)
    GPU_TEMPERATURE.set(metrics.get('temp', 0) or 0)
    GPU_POWER.set(metrics.get('power', 0) or 0)
    GPU_FAULT_COUNT.set(len(metrics.get('active_faults', []) or []))
    GPU_DEGRADED.set(1 if metrics.get('degraded') else 0)
    GPU_COUNT.set(metrics.get('gpu_count', 0) or 0)


@app.get('/api/v1/status')
def get_status():
    return {
        'status': 'online',
        'running_version': RUNTIME_VERSION,
        'timestamp': time.time(),
        'message': 'Aegis-GPU daemon active.',
        'auth_enabled': True,
        'active_llm': ACTIVE_LLM,
        'llm_available': llm_available(),
        'destructive_remediation_enabled': ALLOW_DESTRUCTIVE_REMEDIATION,
        'node_target': AEGIS_NODE_HOST,
    }


@app.get('/metrics')
def metrics_endpoint():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post('/api/v1/auth/register', status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, request: Request):
    username = body.username.strip()
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail='Username must be 3-32 characters: letters, digits, dot, dash, underscore.')
    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f'Password must be at least {MIN_PASSWORD_LENGTH} characters.')
    if username.lower() in {name.lower() for name in USERS} or get_db_user(username):
        audit(request, 'register_conflict', f'username={username}')
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='That username is taken.')
    if not ensure_incidents_db():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail='Account store unavailable; try again shortly.')
    password_hash = bcrypt.hashpw(body.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        create_db_user(username, password_hash)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='That username is taken.')
    audit(request, 'register_success', f'username={username} role=user', user=username)
    token = create_token(username, 'user')
    return {'token': token, 'role': 'user', 'expires_in': JWT_HOURS * 3600}


@app.post('/api/v1/auth/login')
def login(body: LoginRequest, request: Request):
    user = USERS.get(body.username)
    if not (user and user['hash']):
        db_user = get_db_user(body.username)
        if db_user:
            user = db_user
    dummy = b'$2b$12$123456789012345678901uM9Q2L1qO3JicQ0JGvN9zeps2sonMSK.'
    stored_hash = user['hash'].encode('utf-8') if (user and user['hash']) else dummy
    try:
        password_matches = bcrypt.checkpw(body.password.encode('utf-8'), stored_hash)
    except ValueError:
        password_matches = False
    if not user or not password_matches:
        audit(request, 'login_failed', f'username={body.username}')
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials.')
    token = create_token(body.username, user['role'])
    audit(request, 'login_success', f'username={body.username} role={user["role"]}', user=body.username)
    return {'token': token, 'role': user['role'], 'expires_in': JWT_HOURS * 3600}


@app.get('/api/v1/auth/me')
def me(payload: dict = Depends(verify_token)):
    return {'username': payload['sub'], 'role': payload['role']}


@app.get('/api/v1/hardware/metrics')
def get_metrics(request: Request, payload: dict = Depends(verify_token)):
    request.state.user = payload['sub']
    metrics = get_engine().collect_live_metrics()
    metrics['timestamp'] = int(time.time())
    update_live_metric_gauges(metrics)
    return metrics


@app.post('/api/v1/diagnose/{fault_code}')
def diagnose_fault(fault_code: str, request: Request, payload: dict = Depends(verify_token), body: DiagnoseRequest = None):
    request.state.user = payload['sub']
    if not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code: must be 1-4 digits.')

    audit(request, 'diagnose_requested', f'xid={fault_code}', user=payload['sub'])
    kb_entry = load_kb_entry(fault_code)
    context = get_engine().collect_fault_context(fault_code)
    grounding = summarize_grounding(context)
    alignment = summarize_fault_alignment(fault_code, context)
    use_llm = body.allow_llm if (body and body.allow_llm is not None) else True
    diagnosis = maybe_llm_diagnosis(fault_code, kb_entry, context, allow_llm=use_llm)
    if isinstance(diagnosis, dict) and diagnosis.get('error'):
        DIAGNOSE_REQUESTS.labels(fault_code=fault_code, source='timeout').inc()
        return diagnosis
    remediation_plan, source = diagnosis
    DIAGNOSE_REQUESTS.labels(fault_code=fault_code, source=source).inc()
    audit(request, 'diagnose_completed', f'xid={fault_code} source={source}', user=payload['sub'])
    save_incident('diagnose', fault_code, payload['sub'], source=source,
                  summary=remediation_plan[:500] if remediation_plan else None)
    return {
        'fault': f'XID {fault_code}',
        'diagnosis_source': source,
        'remediation_plan': remediation_plan,
        'hallucination_check': grounding['note'],
        'kb_last_updated': kb_entry.get('last_updated', 'unknown'),
        'grounded_sources': grounding['grounded_sources'],
        'unavailable_sources': grounding['unavailable_sources'],
        'grounding_status': grounding['status'],
        'fault_alignment': alignment['status'],
        'fault_alignment_note': alignment['note'],
        'observed_fault_codes': alignment['observed_fault_codes'],
        'llm_requested': use_llm,
        'llm_available': llm_available(),
    }


@app.post('/api/v1/ask-aegis')
def ask_aegis(request: Request, body: AskAegisRequest, payload: dict = Depends(verify_token)):
    request.state.user = payload['sub']
    question = (body.question or '').strip()
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Question is required.')

    inferred_faults = extract_xid_codes('\n'.join([question, *body.visible_evidence]))
    fault_code = (body.fault_code or '').strip() or (inferred_faults[0] if inferred_faults else '')
    if fault_code and not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code.')

    kb_entry = load_kb_entry(fault_code) if fault_code else {'title': '', 'last_updated': 'unknown', 'entry': ''}
    context = get_engine().collect_fault_context(fault_code) if fault_code else {'commands': {}, 'command_status': {}}
    grounding = summarize_grounding(context)
    diagnosis_summary = build_deterministic_diagnosis(fault_code, kb_entry, context) if fault_code else ''
    official_references = load_official_references(
        '\n'.join([question, body.step_title or '', *body.visible_evidence]),
        fault_code=fault_code,
        kb_entry=kb_entry if fault_code else None,
        lab_id=body.lab_id or '',
        visible_evidence=body.visible_evidence,
    )
    use_llm = body.allow_llm if body.allow_llm is not None else True
    answer, source = maybe_llm_ask_aegis(
        question,
        body.visible_evidence,
        diagnosis_summary,
        official_references,
        grounding['note'] if fault_code else 'Grounded against the visible lab evidence supplied by the client and the checked-in NVIDIA reference excerpts.',
        ask_intent=body.ask_intent or '',
        lab_id=body.lab_id or '',
        inferred_layer=body.inferred_layer or '',
        next_check_hint=body.next_check_hint or '',
        branch_effect=body.branch_effect or '',
        branch_choice_label=body.branch_choice_label or '',
        branch_penalty=body.branch_penalty or '',
        allow_llm=use_llm,
    )
    audit(request, 'ask_aegis_completed', f'fault={fault_code or "none"} source={source} question={question[:120]}', user=payload['sub'])
    save_incident('ask_aegis', fault_code or 'none', payload['sub'], source=source, summary=question[:500])
    return {
        'answer': answer,
        'answer_source': source,
        'fault_code': fault_code or None,
        'official_references': official_references,
        'grounding_status': grounding.get('status', 'client_evidence_only') if fault_code else 'client_evidence_only',
        'grounding_note': grounding['note'] if fault_code else 'Grounded against the visible lab evidence supplied by the client and the checked-in NVIDIA reference excerpts.',
        'llm_requested': use_llm,
        'llm_available': llm_available(),
    }


@app.post('/api/v1/remediate/{fault_code}')
def remediate_fault(fault_code: str, request: Request, payload: dict = Depends(require_admin), body: RemediateRequest = None):
    request.state.user = payload['sub']
    if not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code.')
    audit(request, 'runbook_requested', f'xid={fault_code}', user=payload['sub'])
    node_id = body.node_id if body else 0
    result = get_engine().execute_runbook(fault_code, node_id=node_id, allow_destructive=ALLOW_DESTRUCTIVE_REMEDIATION)
    REMEDIATION_REQUESTS.labels(fault_code=fault_code, status=result.get('status', 'unknown')).inc()
    audit(request, 'runbook_executed', f'xid={fault_code} node_id={node_id}', user=payload['sub'])
    save_incident('remediate', fault_code, payload['sub'],
                  status=result.get('status'), summary=result.get('message'))
    result['requested_by'] = payload['sub']
    result['fault'] = f'XID {fault_code}'
    result['timestamp'] = int(time.time())
    result['node_id'] = node_id
    return result


@app.get('/api/v1/incidents')
def list_incidents(
    request: Request,
    payload: dict = Depends(verify_token),
    limit: int = 50,
    fault: Optional[str] = None,
):
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='limit must be 1-200.')
    if not ensure_incidents_db():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Incident database unavailable.'
        )
    query = 'SELECT id, ts, kind, fault, user, source, status, summary FROM incidents'
    params: List = []
    if fault:
        if not re.match(r'^\d{1,4}$', fault):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault filter.')
        query += ' WHERE fault = ?'
        params.append(fault)
    query += ' ORDER BY ts DESC LIMIT ?'
    params.append(limit)
    try:
        with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail='DB read error.') from exc
    return [dict(r) for r in rows]


if FRONTEND_DIR.is_dir():
    app.mount('/', StaticFiles(directory=str(FRONTEND_DIR), html=True), name='frontend')
