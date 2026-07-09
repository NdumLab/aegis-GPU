import http.server
import shutil
import socket
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse


FRONTEND_ROOT = Path(__file__).resolve().parents[1]


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


class FrontendBrowserSmokeTest(unittest.TestCase):
    def test_browser_branch_flow_reports_success(self):
        result_port = _get_free_loopback_port()
        app_port = _get_free_loopback_port()
        scenarios = [
            'workspace_mode_scoping',
            'learn_hub_merged',
            'landing_hub',
            'progressive_disclosure',
            'study_progress_empty',
            'ask_aegis_main',
            'ask_aegis_detached',
            'ecc_best',
            'ecc_warn',
            'ecc_bad',
            'nvlink_best',
            'nvlink_warn',
            'nvlink_bad',
            'nccl_fallback_best',
            'nccl_fallback',
            'storage_best',
            'storage_warn',
            'storage_bad',
            'cuda_stack_bad',
            'k8s_bad',
            'slurm_bad',
            'allreduce_bad',
            'ib_fabric_bad',
        ]
        result_server = _ThreadedTCPServer(('127.0.0.1', result_port), _ResultHandler)
        result_thread = threading.Thread(target=result_server.serve_forever, daemon=True)
        result_thread.start()

        app_server = subprocess.Popen(
            ['python3', '-m', 'http.server', str(app_port), '--bind', '127.0.0.1'],
            cwd=str(FRONTEND_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        try:
            time.sleep(1.0)
            for scenario in scenarios:
                with self.subTest(scenario=scenario):
                    result_event = threading.Event()
                    _ResultHandler.result = {}
                    _ResultHandler.event = result_event
                    firefox = None
                    profile_dir = tempfile.mkdtemp(prefix='aegis-ff-profile-')
                    try:
                        firefox = subprocess.Popen(
                            [
                                'firefox',
                                '--headless',
                                '--new-instance',
                                '--profile',
                                profile_dir,
                                f'http://127.0.0.1:{app_port}/index.html?smokePort={result_port}#browser-smoke:{scenario}',
                            ],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                        )
                        self.assertTrue(result_event.wait(timeout=35), f'browser smoke result was not reported in time for {scenario}')
                        result = dict(_ResultHandler.result)
                        self.assertEqual(result.get('status'), 'pass', result)
                        if scenario == 'progressive_disclosure':
                            self.assertIn('metrics-hidden-prelab', result.get('details', ''))
                            self.assertIn('terminal-idle-hint', result.get('details', ''))
                            self.assertIn('metrics-visible-in-lab', result.get('details', ''))
                            self.assertIn('metrics-visible-incident', result.get('details', ''))
                            self.assertIn('metrics-hidden-after-reset', result.get('details', ''))
                            continue
                        if scenario == 'landing_hub':
                            self.assertIn('hub-visible', result.get('details', ''))
                            self.assertIn('hub-learn-starts-lab', result.get('details', ''))
                            self.assertIn('hub-fleet-routes', result.get('details', ''))
                            self.assertIn('hub-blueprint-path', result.get('details', ''))
                            continue
                        if scenario == 'learn_hub_merged':
                            self.assertIn('learn-hub-study', result.get('details', ''))
                            self.assertIn('learn-hub-quiz', result.get('details', ''))
                            self.assertIn('learn-hub-roundtrip', result.get('details', ''))
                            self.assertIn('learn-hub-intro', result.get('details', ''))
                            continue
                        if scenario == 'workspace_mode_scoping':
                            self.assertIn('mode-training-scoped', result.get('details', ''))
                            self.assertIn('mode-incident-scoped', result.get('details', ''))
                            self.assertIn('mode-fleet-scoped', result.get('details', ''))
                            self.assertIn('status-always-visible', result.get('details', ''))
                            continue
                        if scenario == 'study_progress_empty':
                            self.assertIn('study-progress-visible', result.get('details', ''))
                            self.assertIn('empty-state-visible', result.get('details', ''))
                            continue
                        if scenario == 'ask_aegis_main':
                            self.assertIn('askaegis-main-visible', result.get('details', ''))
                            self.assertIn('askaegis-main-updated', result.get('details', ''))
                            continue
                        if scenario == 'ask_aegis_detached':
                            self.assertIn('askaegis-detached-visible', result.get('details', ''))
                            self.assertIn('askaegis-detached-updated', result.get('details', ''))
                            continue
                        if scenario.endswith('_best'):
                            self.assertIn('normal-advance', result.get('details', ''))
                            self.assertIn('no-detour', result.get('details', ''))
                        else:
                            self.assertIn('redirected-main-step', result.get('details', ''))
                        if scenario.endswith('_warn'):
                            self.assertIn('effect-warn', result.get('details', ''))
                        if scenario.endswith('_bad') or scenario == 'nccl_fallback':
                            self.assertIn('effect-bad', result.get('details', ''))
                        if scenario.endswith('_best'):
                            self.assertIn('effect-best', result.get('details', ''))
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


if __name__ == '__main__':
    unittest.main()
