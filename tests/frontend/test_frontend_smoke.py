import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2] / 'frontend'
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
LABS_JS = (ROOT / 'js' / 'labs.js').read_text(encoding='utf-8')
LEARNING_JS = (ROOT / 'js' / 'learning.js').read_text(encoding='utf-8')
DEPLOY_SH = (ROOT.parent / 'scripts' / 'deploy.sh').read_text(encoding='utf-8')


class FrontendSmokeTest(unittest.TestCase):
    def test_expected_assets_are_referenced(self):
        self.assertIn('css/styles.css', INDEX)
        self.assertIn('js/learning.js', INDEX)
        self.assertIn('js/explain.js', INDEX)
        self.assertIn('js/app.js?v=', INDEX)
        self.assertIn('js/render.js', INDEX)

    def test_deploy_script_syncs_explanation_asset(self):
        self.assertIn('frontend/js/explain.js', DEPLOY_SH)
        self.assertIn('/var/www/html/js/explain.js', DEPLOY_SH)

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
        self.assertIn('sel-explain-level', INDEX)
        self.assertIn('sel-explain-role', INDEX)
        self.assertIn('live-explainer-body', INDEX)
        self.assertIn('lab-step-coach', INDEX)
        self.assertIn('gpusim_beginner_mode', APP_JS)
        self.assertIn('gpusim_explain_level', APP_JS)
        self.assertIn('gpusim_explain_role', APP_JS)
        self.assertIn('renderBeginnerTelemetryExplanation', APP_JS)
        self.assertIn('renderDiagnosisExplanation', APP_JS)
        self.assertIn('describeIncidentKind', APP_JS)
        self.assertIn('explainParsedXid', APP_JS)
        self.assertIn('renderGuidedFlowSteps', APP_JS)
        self.assertIn('renderGuidedStepDetails', APP_JS)
        self.assertIn('renderLabStepCoach', APP_JS)
        self.assertIn('getExplainEngine', APP_JS)
        self.assertIn('Why This Stage Matters', APP_JS)
        self.assertIn('Reasoning Check', APP_JS)
        self.assertIn('Conclusion you can justify now', APP_JS)
        self.assertIn('How To Use Labs', APP_JS)
        self.assertIn('How To Read This Output', APP_JS)
        self.assertIn('How To Tell You Are Done', APP_JS)
        self.assertIn('window.AEGIS_LEARNING', LEARNING_JS)
        self.assertIn('window.AEGIS_EXPLAINER', (ROOT / 'js' / 'explain.js').read_text(encoding='utf-8'))
        self.assertIn('Counterfactual Check', (ROOT / 'js' / 'explain.js').read_text(encoding='utf-8'))
        self.assertIn('Glossary Network', (ROOT / 'js' / 'explain.js').read_text(encoding='utf-8'))
        self.assertIn('ecc:', LEARNING_JS)
        self.assertIn('quickAnswer', LEARNING_JS)

    def test_guided_flow_step_content_supports_richer_beginner_instruction(self):
        self.assertIn('deeperContext', LABS_JS)
        self.assertIn('changedFromPrevious', LABS_JS)
        self.assertIn('justifiedConclusion', LABS_JS)
        self.assertIn('stillPremature', LABS_JS)
        self.assertIn('thresholdCrossed', LABS_JS)
        self.assertIn('lookFor', LABS_JS)
        self.assertIn('takeAction', LABS_JS)
        self.assertIn('avoid', LABS_JS)
        self.assertIn('Field 156 (SBE) staying at 0 across the polling window', LABS_JS)
        self.assertIn('The lifecycle crossed from corrected-error trending into an explicit uncorrectable hardware fault', LABS_JS)
        self.assertIn('The scheduling-control threshold is crossed', LABS_JS)
        self.assertIn('The topology-integrity threshold is crossed', LABS_JS)
        self.assertIn('The configuration-cause threshold is crossed', LABS_JS)
        self.assertIn('The storage-suspicion threshold is crossed', LABS_JS)
        self.assertIn('A reset attempt is now the right next move', LABS_JS)


if __name__ == '__main__':
    unittest.main()
