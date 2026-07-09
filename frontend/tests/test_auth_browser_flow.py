"""End-to-end browser test for registration + password reset.

Spawns the REAL FastAPI backend (uvicorn, temp SQLite user store), serves the
static frontend, and drives headless Firefox through the actual login overlay:
register -> recovery code reveal -> auto-login -> logout -> reset with the
recovery code (rotation asserted) -> old password rejected -> new password
logs in. The frontend is pointed at the local backend via the loopback-only
?apiBase= hook in app.js.
"""
import http.server
import os
import shutil
import socket
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import bcrypt


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = FRONTEND_ROOT.parent / 'backend'


class _ResultHandler(http.server.BaseHTTPRequestHandler):
    result = {}
    event = None

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path != '/result':
            self.send_response(404)
            self.end_headers()
            return
        query = parse_qs(parsed.query)
        _ResultHandler.result = {
            'status': query.get('status', [''])[0],
            'summary': query.get('summary', [''])[0],
            'details': query.get('details', [''])[0],
        }
        self.send_response(204)
        self.end_headers()
        if _ResultHandler.event:
            _ResultHandler.event.set()

    def log_message(self, format, *args):
        return


class _ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


def _get_free_loopback_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class AuthBrowserFlowTest(unittest.TestCase):
    def test_register_and_reset_in_real_browser(self):
        result_port = _get_free_loopback_port()
        app_port = _get_free_loopback_port()
        api_port = _get_free_loopback_port()
        incidents_db = Path(tempfile.gettempdir()) / f'aegis-auth-browser-{os.getpid()}.db'

        backend_env = dict(os.environ)
        backend_env.update({
            'ACTIVE_LLM': 'deterministic',
            'CLAUDE_API_KEY': 'your-anthropic-key-here',
            'OPENAI_API_KEY': 'your-openai-key-here',
            'JWT_SECRET': 'browser-test-secret-0123456789abcdef01234567',
            'JWT_HOURS': '1',
            'ADMIN_HASH': bcrypt.hashpw(b'browser-test-admin', bcrypt.gensalt()).decode('utf-8'),
            'ANALYST_HASH': bcrypt.hashpw(b'browser-test-analyst', bcrypt.gensalt()).decode('utf-8'),
            'ALLOW_DESTRUCTIVE_REMEDIATION': 'false',
            'ALLOWED_ORIGINS': f'http://127.0.0.1:{app_port}',
            'AEGIS_AUDIT_LOG_PATH': str(Path(tempfile.gettempdir()) / 'aegis-auth-browser-audit.log'),
            'AEGIS_INCIDENTS_DB': str(incidents_db),
        })

        result_server = _ThreadedTCPServer(('127.0.0.1', result_port), _ResultHandler)
        threading.Thread(target=result_server.serve_forever, daemon=True).start()

        backend = subprocess.Popen(
            ['python3', '-m', 'uvicorn', 'aegis_api:app', '--host', '127.0.0.1', '--port', str(api_port)],
            cwd=str(BACKEND_ROOT),
            env=backend_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        app_server = subprocess.Popen(
            ['python3', '-m', 'http.server', str(app_port), '--bind', '127.0.0.1'],
            cwd=str(FRONTEND_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        firefox = None
        profile_dir = tempfile.mkdtemp(prefix='aegis-ff-auth-')
        try:
            deadline = time.time() + 30
            while time.time() < deadline:
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{api_port}/api/v1/status', timeout=2) as res:
                        if res.status == 200:
                            break
                except Exception:
                    time.sleep(0.5)
            else:
                self.fail('backend did not become ready')

            result_event = threading.Event()
            _ResultHandler.result = {}
            _ResultHandler.event = result_event
            url = (
                f'http://127.0.0.1:{app_port}/index.html'
                f'?smokePort={result_port}&apiBase=http://127.0.0.1:{api_port}/api/v1'
                f'#browser-smoke:auth_register_reset'
            )
            firefox = subprocess.Popen(
                ['firefox', '--headless', '--new-instance', '--profile', profile_dir, url],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self.assertTrue(result_event.wait(timeout=60), 'auth browser flow did not report a result in time')
            result = dict(_ResultHandler.result)
            self.assertEqual(result.get('status'), 'pass', result)
            for marker in (
                'register-mode',
                'registered-code-shown',
                'register-auto-login',
                'progress-sync-roundtrip',
                'reset-mode',
                'reset-code-rotated',
                'reset-auto-login',
                'old-password-rejected',
                'new-password-login',
            ):
                self.assertIn(marker, result.get('details', ''), result)
        finally:
            if firefox is not None:
                firefox.terminate()
                try:
                    firefox.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    firefox.kill()
            shutil.rmtree(profile_dir, ignore_errors=True)
            for proc in (backend, app_server):
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
            result_server.shutdown()
            incidents_db.unlink(missing_ok=True)


if __name__ == '__main__':
    unittest.main()
