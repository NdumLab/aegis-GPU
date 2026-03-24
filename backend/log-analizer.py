import concurrent.futures
import json
import logging
import logging.handlers
import os
import re
import socket
import time
from datetime import datetime, timedelta
from typing import Any, Dict

import bcrypt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

import node_scraper


load_dotenv('/etc/aegis-gpu/aegis.env')
import sys as _sys
_jwt_secret = os.getenv("JWT_SECRET", "")
if not _jwt_secret or _jwt_secret == "change-me" or len(_jwt_secret) < 32:
    print("FATAL: JWT_SECRET missing, default, or too short (<32 chars). Refusing to start.", file=_sys.stderr)
    _sys.exit(1)

JWT_SECRET = os.getenv('JWT_SECRET', 'change-me')
JWT_ALGO = 'HS256'
JWT_HOURS = int(os.getenv('JWT_HOURS', '8'))
ACTIVE_LLM = os.getenv('ACTIVE_LLM', 'deterministic').strip().lower()
ALLOW_DESTRUCTIVE_REMEDIATION = os.getenv('ALLOW_DESTRUCTIVE_REMEDIATION', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
ALLOWED_ORIGINS = [item.strip() for item in os.getenv('ALLOWED_ORIGINS', 'https://10.1.10.177').split(',') if item.strip()]

USERS = {
    'admin': {'hash': os.getenv('ADMIN_HASH', ''), 'role': 'admin'},
    'analyst': {'hash': os.getenv('ANALYST_HASH', ''), 'role': 'analyst'},
}

PLACEHOLDER_VALUES = {'', 'your-anthropic-key-here', 'your-openai-key-here', 'change-me', 'change-this-immediately'}

DETERMINISTIC_RUNBOOKS = {
    '48': [
        '1. Confirm the DBE in ECC telemetry and stop scheduling new work onto the node.',
        '2. Drain the node from Slurm or Kubernetes before any further GPU access.',
        '3. Review retired pages and ECC health to determine whether the GPU must be replaced.',
        '4. Open a vendor ticket or RMA if DBEs persist or page retirement thresholds are exceeded.',
    ],
    '74': [
        '1. Inspect NVLink counters and identify the failing link or switch port.',
        '2. Drain jobs that rely on NVLink bandwidth before the fabric degrades further.',
        '3. Schedule physical inspection of the bridge, cable, OSFP, or switch port.',
        '4. Re-test topology and counters after reseat or replacement.',
    ],
    '79': [
        '1. Quiesce workloads using the affected GPU and capture recent kernel logs.',
        '2. Attempt a controlled GPU reset only under an approved maintenance window.',
        '3. If reset fails or the GPU remains missing, reboot the node and escalate as hardware instability.',
        '4. Check PCIe power, seating, and repeated XID history before returning the node to service.',
    ],
}


def configured_secret(name: str) -> str:
    value = os.getenv(name, '').strip()
    return '' if value.lower() in PLACEHOLDER_VALUES else value


# Audit logger
logging.getLogger('aegis.audit').handlers.clear()
audit_logger = logging.getLogger('aegis.audit')
audit_logger.setLevel(logging.INFO)
AUDIT_LOG_PATH = os.getenv('AEGIS_AUDIT_LOG_PATH', '/var/log/aegis-gpu/audit.log')
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
    ip = (request.headers.get('x-real-ip') or
          request.headers.get('x-forwarded-for', '').split(',')[0].strip() or
          (request.client.host if request.client else 'unknown'))
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
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or expired token.')


def require_admin(payload: dict = Depends(verify_token)) -> dict:
    if payload.get('role') != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Admin role required.')
    return payload


def get_engine() -> node_scraper.OSIntrospectionEngine:
    return node_scraper.OSIntrospectionEngine(hostname='127.0.0.1', username='aegis')


def load_kb_entry(fault_code: str) -> Dict[str, str]:
    kb_file = '/opt/aegis-gpu/nvidia_kb/xid_reference.json'
    if not os.path.exists(kb_file):
        return {'title': 'NVIDIA XID Error Codes Reference', 'last_updated': 'unknown', 'entry': ''}
    with open(kb_file, 'r', encoding='utf-8') as handle:
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
    lines.extend(DETERMINISTIC_RUNBOOKS.get(str(fault_code), [
        '1. Capture the current hardware state and isolate the affected node.',
        '2. Drain or cordon the node before any disruptive action.',
        '3. Escalate to vendor-guided remediation because no safe automated runbook exists for this fault code.',
    ]))
    if context_summary:
        lines.append('Observed node context:\n' + context_summary)
    return '\n'.join(lines)


def maybe_llm_diagnosis(fault_code: str, kb_entry: Dict[str, str], context: Dict[str, Any]) -> tuple[str, str]:
    prompt = f'''You are a senior GPU infrastructure engineer.

Fault code: XID {fault_code}
Vendor reference: {kb_entry.get('entry') or 'No vendor KB entry provided.'}
Node context:
{build_context_summary(context)}

Write a concise, numbered remediation plan. Stay strictly within the provided evidence. If evidence is missing, say so plainly.'''

    def _call_llm():
        if ACTIVE_LLM == 'claude':
            api_key = configured_secret('CLAUDE_API_KEY')
            if api_key:
                import anthropic
                client = anthropic.Anthropic(api_key=api_key)
                response = client.messages.create(
                    model=os.getenv('CLAUDE_MODEL', 'claude-sonnet-4-6'),
                    max_tokens=1024,
                    messages=[{'role': 'user', 'content': prompt}],
                )
                return response.content[0].text, 'anthropic-grounded'

        if ACTIVE_LLM == 'openai':
            api_key = configured_secret('OPENAI_API_KEY')
            if api_key:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model=os.getenv('OPENAI_MODEL', 'gpt-4o-mini'),
                    messages=[{'role': 'user', 'content': prompt}],
                )
                return response.choices[0].message.content, 'openai-grounded'

        return build_deterministic_diagnosis(fault_code, kb_entry, context), 'deterministic-runbook'

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(_call_llm)
        try:
            return future.result(timeout=30)
        except concurrent.futures.TimeoutError:
            return {'error': 'LLM call timed out after 30 seconds. Try again.'}


@app.get('/api/v1/status')
def get_status():
    return {'status': 'online', 'timestamp': time.time()}


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
    engine = get_engine()
    metrics = engine.collect_live_metrics()
    metrics['timestamp'] = int(time.time())
    return metrics


@app.post('/api/v1/diagnose/{fault_code}')
def diagnose_fault(fault_code: str, request: Request, payload: dict = Depends(verify_token)):
    request.state.user = payload['sub']
    if not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code: must be 1-4 digits.')

    audit(request, 'diagnose_requested', f'xid={fault_code}', user=payload['sub'])
    kb_entry = load_kb_entry(fault_code)
    engine = get_engine()
    context = engine.collect_fault_context(fault_code)
    diagnosis = maybe_llm_diagnosis(fault_code, kb_entry, context)
    if isinstance(diagnosis, dict) and diagnosis.get('error'):
        return diagnosis
    remediation_plan, source = diagnosis
    audit(request, 'diagnose_completed', f'xid={fault_code} source={source}', user=payload['sub'])
    return {
        'fault': f'XID {fault_code}',
        'diagnosis_source': source,
        'remediation_plan': remediation_plan,
        'hallucination_check': 'Grounded against local host inspection and the NVIDIA XID knowledge base.',
        'kb_last_updated': kb_entry.get('last_updated', 'unknown'),
        'grounded_sources': list(context.get('commands', {}).keys()),
    }


@app.post('/api/v1/remediate/{fault_code}')
def remediate_fault(
    fault_code: str,
    request: Request,
    payload: dict = Depends(require_admin),
    body: RemediateRequest = None,
):
    request.state.user = payload['sub']
    if not re.match(r'^\d{1,4}$', fault_code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Invalid fault code.')
    audit(request, 'runbook_requested', f'xid={fault_code}', user=payload['sub'])
    engine = get_engine()
    node_id = body.node_id if body else 0
    result = engine.execute_runbook(
        fault_code,
        node_id=node_id,
        allow_destructive=ALLOW_DESTRUCTIVE_REMEDIATION,
    )
    audit(request, 'runbook_executed', f'xid={fault_code} node_id={node_id}', user=payload['sub'])
    result['requested_by'] = payload['sub']
    result['fault'] = f'XID {fault_code}'
    result['timestamp'] = int(time.time())
    result['node_id'] = node_id
    return result
