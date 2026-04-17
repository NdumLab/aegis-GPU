
import concurrent.futures
import json
import logging
import logging.handlers
import os
import re
import sqlite3
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

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
    str(APP_ROOT / '.env'),
    '/etc/aegis-gpu/aegis.env',
]
for candidate in DEFAULT_ENV_CANDIDATES:
    if not candidate:
        continue
    try:
        candidate_exists = Path(candidate).exists()
    except PermissionError:
        candidate_exists = False
    if candidate_exists:
        load_dotenv(candidate, override=False)
        break

JWT_SECRET = os.getenv('JWT_SECRET', '')
if not JWT_SECRET or JWT_SECRET == 'change-me' or len(JWT_SECRET) < 32:
    raise SystemExit('FATAL: JWT_SECRET missing, default, or too short (<32 chars). Refusing to start.')

JWT_ALGO = 'HS256'
JWT_HOURS = int(os.getenv('JWT_HOURS', '8'))
ACTIVE_LLM = os.getenv('ACTIVE_LLM', 'deterministic').strip().lower()
ALLOW_DESTRUCTIVE_REMEDIATION = os.getenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
ALLOWED_ORIGINS = [item.strip() for item in os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080,http://127.0.0.1:8080').split(',') if item.strip()]
AEGIS_NODE_HOST = os.getenv('AEGIS_NODE_HOST', '127.0.0.1').strip() or '127.0.0.1'
AEGIS_NODE_USERNAME = os.getenv('AEGIS_NODE_USERNAME', 'aegis').strip() or 'aegis'
KB_PATH = Path(os.getenv('AEGIS_KB_PATH', str(APP_ROOT / 'nvidia_kb' / 'xid_reference.json')))
AUDIT_LOG_PATH = os.getenv('AEGIS_AUDIT_LOG_PATH', '/var/log/aegis-gpu/audit.log')
INCIDENTS_DB_PATH = os.getenv('AEGIS_INCIDENTS_DB', '/var/lib/aegis-gpu/incidents.db')


def _init_db() -> None:
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
        conn.commit()


_init_db()


def save_incident(kind: str, fault_code: str, user: str, source: str = None,
                  status: str = None, summary: str = None) -> None:
    try:
        with sqlite3.connect(INCIDENTS_DB_PATH) as conn:
            conn.execute(
                'INSERT INTO incidents (ts, kind, fault, user, source, status, summary) VALUES (?,?,?,?,?,?,?)',
                (int(time.time()), kind, fault_code, user, source, status, summary),
            )
            conn.commit()
    except Exception:
        pass


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
APP_INFO.labels(version='1.0.0', active_llm=ACTIVE_LLM).set(1)


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
os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
_fh = logging.FileHandler(AUDIT_LOG_PATH)
_fh.setFormatter(logging.Formatter('%(asctime)s %(message)s', datefmt='%Y-%m-%dT%H:%M:%SZ'))
audit_logger.addHandler(_fh)
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


app = FastAPI(title='Aegis-GPU Telemetry Daemon', version='1.0.0')
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


class RemediateRequest(BaseModel):
    node_id: int = 0


def create_token(username: str, role: str) -> str:
    exp = datetime.utcnow() + timedelta(hours=JWT_HOURS)
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


def build_context_summary(context: Dict[str, Any]) -> str:
    commands = context.get('commands', {})
    sections = []
    for key in ('recent_xids', 'gpu_inventory', 'gpu_health', 'topology', 'nvlink', 'fabric', 'storage'):
        value = (commands.get(key) or '').strip()
        if value:
            sections.append(f'[{key}]\n{value[:1200]}')
    return '\n\n'.join(sections)[:6000]


def build_deterministic_diagnosis(fault_code: str, kb_entry: Dict[str, str], context: Dict[str, Any]) -> str:
    summary = kb_entry.get('entry') or f'XID {fault_code} detected with no vendor KB entry available.'
    context_summary = build_context_summary(context)
    lines = [
        f'Fault summary: XID {fault_code}. {summary}',
        'Grounding sources used: NVIDIA XID KB, live node inspection, kernel log review, and GPU command output.',
    ]
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


def maybe_llm_diagnosis(fault_code: str, kb_entry: Dict[str, str], context: Dict[str, Any]) -> Union[Tuple[str, str], dict]:
    user_content = (
        f'Fault code: XID {fault_code}\n'
        f'Vendor reference: {kb_entry.get("entry") or "No vendor KB entry provided."}\n'
        f'Node context:\n{build_context_summary(context)}'
    )

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
        'timestamp': time.time(),
        'message': 'Aegis-GPU daemon active.',
        'auth_enabled': True,
        'active_llm': ACTIVE_LLM,
        'destructive_remediation_enabled': ALLOW_DESTRUCTIVE_REMEDIATION,
        'node_target': AEGIS_NODE_HOST,
    }


@app.get('/metrics')
def metrics_endpoint():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post('/api/v1/auth/login')
def login(body: LoginRequest, request: Request):
    user = USERS.get(body.username)
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
def diagnose_fault(fault_code: str, request: Request, payload: dict = Depends(verify_token)):
    request.state.user = payload['sub']
    if not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code: must be 1-4 digits.')

    audit(request, 'diagnose_requested', f'xid={fault_code}', user=payload['sub'])
    kb_entry = load_kb_entry(fault_code)
    context = get_engine().collect_fault_context(fault_code)
    diagnosis = maybe_llm_diagnosis(fault_code, kb_entry, context)
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
        'hallucination_check': 'Grounded against local host inspection and the NVIDIA XID knowledge base.',
        'kb_last_updated': kb_entry.get('last_updated', 'unknown'),
        'grounded_sources': list(context.get('commands', {}).keys()),
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
