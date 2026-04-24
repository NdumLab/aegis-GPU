import http.server
import os
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse


FRONTEND_ROOT = Path(__file__).resolve().parents[1]
RESULT_PORT = 18080
APP_PORT = 18081


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


class FrontendBrowserSmokeTest(unittest.TestCase):
    def test_browser_branch_flow_reports_success(self):
        result_event = threading.Event()
        _ResultHandler.result = {}
        _ResultHandler.event = result_event

        result_server = _ThreadedTCPServer(('127.0.0.1', RESULT_PORT), _ResultHandler)
        result_thread = threading.Thread(target=result_server.serve_forever, daemon=True)
        result_thread.start()

        app_server = subprocess.Popen(
            ['python3', '-m', 'http.server', str(APP_PORT), '--bind', '127.0.0.1'],
            cwd=str(FRONTEND_ROOT),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        firefox = None
        try:
            time.sleep(1.0)
            with tempfile.TemporaryDirectory(prefix='aegis-ff-profile-') as profile_dir:
                firefox = subprocess.Popen(
                    [
                        'firefox',
                        '--headless',
                        '--new-instance',
                        '--profile',
                        profile_dir,
                        f'http://127.0.0.1:{APP_PORT}/index.html#browser-smoke',
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                self.assertTrue(result_event.wait(timeout=30), 'browser smoke result was not reported in time')
                result = dict(_ResultHandler.result)
                self.assertEqual(result.get('status'), 'pass', result)
                self.assertIn('redirected-main-step', result.get('details', ''))
        finally:
            if firefox is not None:
                firefox.terminate()
                try:
                    firefox.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    firefox.kill()
            app_server.terminate()
            try:
                app_server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                app_server.kill()
            result_server.shutdown()
            result_server.server_close()


if __name__ == '__main__':
    unittest.main()
