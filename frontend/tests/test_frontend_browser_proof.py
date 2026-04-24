import http.client
import http.server
import json
import os
import shutil
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
RESULT_PORT = 18082
APP_PORT = 18084
REPORT_PATH = os.environ.get('AEGIS_BROWSER_PROOF_REPORT', '')


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


def _wait_for_http_ready(port, path='/', timeout=5.0):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        conn = None
        try:
            conn = http.client.HTTPConnection('127.0.0.1', port, timeout=1.0)
            conn.request('GET', path)
            response = conn.getresponse()
            response.read()
            return
        except OSError as exc:
            last_error = exc
            time.sleep(0.1)
        finally:
            if conn is not None:
                conn.close()
    raise AssertionError(f'HTTP server on port {port} did not become ready: {last_error}')


class FrontendBrowserProofTest(unittest.TestCase):
    def test_browser_proof_surfaces_report_success(self):
        scenarios = [
            {
                'name': 'study_progress_empty',
                'expected_details': ['study-progress-visible', 'empty-state-visible'],
            },
            {
                'name': 'ask_aegis_main',
                'expected_details': ['askaegis-main-visible', 'askaegis-main-updated'],
            },
            {
                'name': 'ask_aegis_detached',
                'expected_details': ['askaegis-detached-visible', 'askaegis-detached-updated'],
            },
            {
                'name': 'analytics_recommendation_transition',
                'expected_details': ['analytics-focus-visible', 'analytics-risk-visible', 'analytics-initial-rationale', 'analytics-domain-adapted', 'analytics-recovery-rationale'],
            },
            {
                'name': 'ecc_bad',
                'expected_details': ['effect-bad', 'detour-rendered', 'redirected-main-step'],
            },
            {
                'name': 'nvlink_bad',
                'expected_details': ['effect-bad', 'detour-rendered', 'redirected-main-step'],
            },
            {
                'name': 'storage_warn',
                'expected_details': ['effect-warn', 'detour-rendered', 'redirected-main-step'],
            },
        ]
        report_rows = []
        result_server = _ThreadedTCPServer(('127.0.0.1', RESULT_PORT), _ResultHandler)
        result_thread = threading.Thread(target=result_server.serve_forever, daemon=True)
        result_thread.start()

        app_server = subprocess.Popen(
            ['python3', '-m', 'http.server', str(APP_PORT), '--bind', '127.0.0.1'],
            cwd=str(FRONTEND_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        try:
            _wait_for_http_ready(RESULT_PORT, '/result?status=ready&summary=probe&details=probe')
            _wait_for_http_ready(APP_PORT, '/index.html')
            for scenario in scenarios:
                scenario_name = scenario['name']
                expected_details = scenario['expected_details']
                with self.subTest(scenario=scenario_name):
                    result_event = threading.Event()
                    _ResultHandler.result = {}
                    _ResultHandler.event = result_event
                    firefox = None
                    profile_dir = tempfile.mkdtemp(prefix='aegis-proof-profile-')
                    try:
                        firefox = subprocess.Popen(
                            [
                                'firefox',
                                '--headless',
                                '--new-instance',
                                '--profile',
                                profile_dir,
                                f'http://127.0.0.1:{APP_PORT}/index.html?smokePort={RESULT_PORT}#browser-smoke:{scenario_name}',
                            ],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        self.assertTrue(result_event.wait(timeout=35), f'browser proof result was not reported in time for {scenario_name}')
                        result = dict(_ResultHandler.result)
                        self.assertEqual(result.get('status'), 'pass', result)
                        for marker in expected_details:
                            self.assertIn(marker, result.get('details', ''))
                        report_rows.append({
                            'scenario': scenario_name,
                            'status': result.get('status', ''),
                            'summary': result.get('summary', ''),
                            'details': result.get('details', ''),
                        })
                    except Exception as exc:
                        report_rows.append({
                            'scenario': scenario_name,
                            'status': 'fail',
                            'summary': str(exc),
                            'details': dict(_ResultHandler.result).get('details', ''),
                        })
                        raise
                    finally:
                        if firefox is not None:
                            firefox.terminate()
                            try:
                                firefox.wait(timeout=5)
                            except subprocess.TimeoutExpired:
                                firefox.kill()
                        shutil.rmtree(profile_dir, ignore_errors=True)
        finally:
            app_server.terminate()
            try:
                app_server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                app_server.kill()
            result_server.shutdown()
            result_server.server_close()
            if REPORT_PATH:
                Path(REPORT_PATH).parent.mkdir(parents=True, exist_ok=True)
                Path(REPORT_PATH).write_text(json.dumps({
                    'suite': 'frontend_browser_proof',
                    'result_port': RESULT_PORT,
                    'app_port': APP_PORT,
                    'scenarios': report_rows,
                }, indent=2), encoding='utf-8')


if __name__ == '__main__':
    unittest.main()
