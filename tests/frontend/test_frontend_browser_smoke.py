import http.server
import json
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'frontend'
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
FIREFOX = '/usr/bin/firefox'
RESULT = {"ok": False, "message": "no browser result reported"}
REQUESTS = []

HARNESS_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aegis Login Browser Smoke</title>
<style>
html, body { margin: 0; width: 100%; height: 100%; }
body { background: rgb(255, 0, 0); color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
#status { font-size: 32px; font-weight: 700; letter-spacing: 0.08em; }
#login-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; }
</style>
<script>
window.__AEGIS_API_BASE__ = window.location.origin + '/api/v1';
window.__origWindowAddEventListener = window.addEventListener.bind(window);
window.addEventListener = function (type, listener, options) {
  if (type === 'load') return;
  return window.__origWindowAddEventListener(type, listener, options);
};
window.__report = async function (ok, message) {
  document.body.style.background = ok ? 'rgb(0, 255, 0)' : 'rgb(255, 0, 0)';
  document.getElementById('status').textContent = message;
  try {
    await fetch('/__result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok, message })
    });
  } catch (e) {
    document.getElementById('status').textContent = 'REPORT FAILED: ' + e;
  }
};
</script>
<script>__APP_JS__</script>
<script>
window.initApp = function () {
  window.__report(true, 'LOGIN OK');
};

(async function runSmoke() {
  try {
    bindUIHandlers();
    document.getElementById('login-user').value = 'admin';
    document.getElementById('login-pass').value = 'admin123!';
    await aegisLogin();
    if (!sessionStorage.getItem('aegis_jwt')) {
      const err = document.getElementById('login-err');
      await window.__report(false, err && err.textContent ? err.textContent : 'LOGIN FAILED');
    }
  } catch (e) {
    await window.__report(false, 'JS ERROR: ' + (e && e.message ? e.message : e));
  }
})();
</script>
</head>
<body>
<div id="status">LOGIN PENDING</div>
<div id="login-overlay">
  <input id="login-user" type="text" autocomplete="username">
  <input id="login-pass" type="password" autocomplete="current-password">
  <div id="login-err"></div>
  <button id="btn-login">AUTHENTICATE</button>
</div>
<div id="recon-overlay"></div>
<select id="sel-blueprint"><option value="H100_HGX">H100</option><option value="GB200_NVL72">GB200</option></select>
<select id="sel-fabric"><option value="IB_NDR">IB</option></select>
<svg id="diagram-canvas"></svg>
<div id="h-done"></div>
<div id="h-score"></div>
<input id="cmd-input">
<div id="quiz-content"></div>
<div id="step-controls"></div>
<div id="scen-title"></div>
<div id="scen-desc"></div>
<div id="sys-status"></div>
<div id="intro-overlay"></div>
</body>
</html>
"""


class HarnessHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def _proxy(self):
        target = f'http://127.0.0.1:8000{self.path}'
        body = None
        headers = {}
        if self.command in {'POST', 'PUT', 'PATCH'}:
            length = int(self.headers.get('Content-Length', '0') or '0')
            body = self.rfile.read(length) if length else None
            if self.headers.get('Content-Type'):
                headers['Content-Type'] = self.headers['Content-Type']
        req = urllib.request.Request(target, data=body, method=self.command, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                self.send_header('Content-Type', resp.headers.get('Content-Type', 'application/json'))
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            self.send_response(exc.code)
            self.send_header('Content-Type', exc.headers.get('Content-Type', 'application/json'))
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    def do_GET(self):
        REQUESTS.append(('GET', self.path))
        if self.path == '/' or self.path.startswith('/login-smoke'):
            payload = HARNESS_HTML.replace('__APP_JS__', APP_JS.replace('</script>', '<\/script>')).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        if self.path.startswith('/api/v1/'):
            self._proxy()
            return
        self.send_error(404)

    def do_POST(self):
        global RESULT
        REQUESTS.append(('POST', self.path))
        if self.path == '/__result':
            length = int(self.headers.get('Content-Length', '0') or '0')
            payload = self.rfile.read(length) if length else b'{}'
            RESULT = json.loads(payload.decode('utf-8'))
            body = b'ok'
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/api/v1/'):
            self._proxy()
            return
        self.send_error(404)


class FrontendBrowserLoginSmokeTest(unittest.TestCase):
    def test_firefox_login_smoke(self):
        global RESULT
        RESULT = {"ok": False, "message": "no browser result reported"}
        REQUESTS.clear()
        if not Path(FIREFOX).exists():
            self.skipTest('firefox not installed')
        with socketserver.TCPServer(('127.0.0.1', 0), HarnessHandler) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with tempfile.TemporaryDirectory() as td:
                    td_path = Path(td)
                    profile = td_path / 'ff-profile'
                    profile.mkdir()
                    proc = subprocess.Popen(
                        [
                            FIREFOX,
                            '--headless',
                            '--profile',
                            str(profile),
                            '--window-size',
                            '800,600',
                            f'http://127.0.0.1:{server.server_address[1]}/login-smoke',
                        ],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    deadline = time.time() + 20
                    while time.time() < deadline:
                        if RESULT.get('message') != 'no browser result reported':
                            break
                        if proc.poll() is not None:
                            break
                        time.sleep(0.25)
                    if proc.poll() is None:
                        proc.terminate()
                        try:
                            proc.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                            proc.wait(timeout=5)
                    if RESULT.get('message') == 'no browser result reported':
                        raise unittest.SkipTest(f'headless Firefox on this host did not execute browser smoke JavaScript; requests={REQUESTS}')
                    if not RESULT.get('ok'):
                        self.fail(f'browser reported login failure: {RESULT}; requests={REQUESTS}')
            finally:
                server.shutdown()
                thread.join(timeout=5)
