import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2] / 'frontend'
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
LEARNING_JS = (ROOT / 'js' / 'learning.js').read_text(encoding='utf-8')


class FrontendSmokeTest(unittest.TestCase):
    def test_expected_assets_are_referenced(self):
        self.assertIn('css/styles.css', INDEX)
        self.assertIn('js/learning.js', INDEX)
        self.assertIn('js/app.js?v=', INDEX)
        self.assertIn('js/render.js', INDEX)

    def test_frontend_uses_same_origin_api_prefix(self):
        self.assertIn('/api/v1', APP_JS)
        self.assertRegex(APP_JS, r'API_BASE\s*=')

    def test_no_hardcoded_bearer_token_exists(self):
        self.assertNotIn('Bearer ey', APP_JS)
        self.assertNotRegex(APP_JS, re.compile(r'sk-[A-Za-z0-9_-]{20,}'))

    def test_no_inline_onclick_handlers_remain_in_app_bundle(self):
        self.assertNotIn('onclick=', APP_JS)

    def test_login_bootstrap_binds_handlers_on_window_load(self):
        self.assertIn("window.addEventListener('load', async ()=>{", APP_JS)
        self.assertIn('bindUIHandlers();', APP_JS)
        self.assertIn('showLoginOverlay();', APP_JS)

    def test_init_app_opens_cluster_chooser_without_auto_provisioning(self):
        self.assertIn("const reconOverlay = document.getElementById('recon-overlay');", APP_JS)
        self.assertIn("reconOverlay.style.display = 'flex';", APP_JS)
        init_app_start = APP_JS.index('function initApp() {')
        init_app_end = APP_JS.index("window.addEventListener('load'", init_app_start)
        init_block = APP_JS[init_app_start:init_app_end]
        self.assertIn('isProvisioned = false;', init_block)
        self.assertNotIn('applyProvisioning();', init_block)

    def test_beginner_mode_controls_and_learning_module_exist(self):
        self.assertIn('toggle-beginner', INDEX)
        self.assertIn('btn-learn', INDEX)
        self.assertIn('Beginner Mode', INDEX)
        self.assertIn('live-explainer-body', INDEX)
        self.assertIn('gpusim_beginner_mode', APP_JS)
        self.assertIn('renderBeginnerTelemetryExplanation', APP_JS)
        self.assertIn('renderDiagnosisExplanation', APP_JS)
        self.assertIn('describeIncidentKind', APP_JS)
        self.assertIn('explainParsedXid', APP_JS)
        self.assertIn('window.AEGIS_LEARNING', LEARNING_JS)
        self.assertIn('ecc:', LEARNING_JS)
        self.assertIn('quickAnswer', LEARNING_JS)


if __name__ == '__main__':
    unittest.main()
