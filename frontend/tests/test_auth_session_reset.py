import json
import subprocess
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CLUSTER_SIM_JS = ROOT / 'js' / 'cluster-sim.js'
CLUSTER_TERMINAL_JS = ROOT / 'js' / 'cluster-terminal.js'
APP_JS = ROOT / 'js' / 'app.js'


def load_logout_reset_payload():
    script = textwrap.dedent(
        f"""
        const fs = require('fs');
        globalThis.window = globalThis;
        globalThis.window.location = {{ origin: 'https://example.test' }};
        globalThis.document = {{
          getElementById() {{
            return {{
              style: {{}},
              textContent: '',
              innerHTML: '',
              checked: false,
              value: '',
              addEventListener() {{}},
              setAttribute() {{}},
            }};
          }},
          querySelectorAll() {{ return []; }},
          addEventListener() {{}},
        }};
        globalThis.localStorage = {{ getItem() {{ return null; }}, setItem() {{}}, removeItem() {{}} }};
        globalThis.sessionStorage = {{ getItem() {{ return ''; }}, setItem() {{}}, removeItem() {{}} }};
        globalThis.fetch = async () => ({{ ok: true, json: async () => ({{ token: 'token', role: 'operator' }}) }});
        globalThis.setTimeout = () => 0;
        globalThis.setInterval = () => 99;
        globalThis.clearInterval = () => {{}};
        globalThis.clearCanvas = () => {{}};
        globalThis.drawWelcome = () => {{}};
        globalThis.runInstantSentinel = () => {{}};
        globalThis.updateReasoningProgressUI = () => {{}};
        globalThis.updateTerminalModeUI = () => {{}};
        globalThis.updateTerminalInputHint = () => {{}};
        globalThis.renderClusterDashboardView = () => {{}};
        globalThis.syncBeginnerModeUI = () => {{}};
        globalThis.logTerm = () => {{}};
        globalThis.scrollTerminal = () => {{}};
        globalThis.switchTab = () => {{}};
        globalThis.hideLoginOverlay = () => {{}};
        globalThis.showLoginOverlay = () => {{}};
        globalThis.refreshLoginVersion = () => {{}};
        globalThis.loadReasoningProgress = () => ({{ steps: {{}}, quizzes: [], completion: {{}} }});
        globalThis.loadBranchingState = () => ({{}});
        globalThis.HARDWARE_LIBRARY = {{ H100_HGX: {{ fabricDefault: 'IB_NDR', name: 'H100' }} }};
        globalThis.clusterSimInterval = 42;
        globalThis.liveInterval = 11;
        globalThis.appMode = 'live';
        globalThis.currentLab = 'cluster_fleet';
        globalThis.currentStep = 4;
        globalThis.activeAlternateStep = 2;
        globalThis.activeMainRedirectStep = 3;
        globalThis.clusterDashboardActive = true;

        eval(fs.readFileSync({json.dumps(str(CLUSTER_SIM_JS))}, 'utf8'));
        eval(fs.readFileSync({json.dumps(str(CLUSTER_TERMINAL_JS))}, 'utf8'));
        eval(fs.readFileSync({json.dumps(str(APP_JS))}, 'utf8'));

        const store = ensureClusterSimStore();
        store.injectFault('xid_79');
        window.AEGIS_CLUSTER_TERMINAL.runCommand(store.state, 'ssh gb200-node-03');
        aegisLogout();
        const node = store.getNode('gb200-node-02');

        process.stdout.write(JSON.stringify({{
          context: window.AEGIS_CLUSTER_TERMINAL.getContext(),
          activeFaults: store.state.activeFaults.length,
          nodeHealth: node.healthState,
          nodeXid: node.gpus[3].xid,
        }}));
        """
    )
    output = subprocess.check_output(['node', '-e', script], text=True)
    return json.loads(output)


class AuthSessionResetTest(unittest.TestCase):
    def test_logout_resets_cluster_session_state(self):
        payload = load_logout_reset_payload()
        self.assertEqual(payload['context']['host'], 'login-01')
        self.assertEqual(payload['context']['mode'], 'login')
        self.assertIsNone(payload['context']['nodeId'])
        self.assertEqual(payload['activeFaults'], 0)
        self.assertEqual(payload['nodeHealth'], 'healthy')
        self.assertIsNone(payload['nodeXid'])


if __name__ == '__main__':
    unittest.main()
