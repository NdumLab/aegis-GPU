import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')


class FrontendSmokeTest(unittest.TestCase):
    def test_expected_assets_are_referenced(self):
        self.assertIn('css/styles.css', INDEX)
        self.assertIn('js/labs-part-1.js', INDEX)
        self.assertIn('js/labs-part-4.js', INDEX)
        self.assertIn('js/app.js', INDEX)
        self.assertIn('js/learning-part-1.js', INDEX)
        self.assertIn('js/render.js', INDEX)
        self.assertIn('toggle-incident-mode', INDEX)
        self.assertIn('h-judgment', INDEX)

    def test_exam_prep_section_is_available(self):
        self.assertIn('id="btn-study"', INDEX)
        self.assertIn('id="sidebar-btn-study"', INDEX)
        self.assertIn('id="study-overlay"', INDEX)
        self.assertIn('EXAM_STUDY_GUIDES', APP_JS)
        self.assertIn('NVIDIA-Certified Associate: AI Infrastructure and Operations', APP_JS)

    def test_overlay_popouts_are_available(self):
        self.assertIn('id="btn-popout-intro"', INDEX)
        self.assertIn('id="btn-popout-study"', INDEX)
        self.assertIn('id="btn-popout-quiz"', INDEX)
        self.assertIn("openDetachedPanel('introOverlay')", APP_JS)
        self.assertIn("openDetachedPanel('studyOverlay')", APP_JS)
        self.assertIn("openDetachedPanel('quizOverlay')", APP_JS)

    def test_reasoning_scorecard_is_available(self):
        self.assertIn('getReasoningScorecardContext', APP_JS)
        self.assertIn('renderReasoningScorecard', APP_JS)
        self.assertIn('Reasoning Scorecard', APP_JS)
        self.assertIn('Assessment Scorecard', APP_JS)

    def test_differential_diagnosis_is_available(self):
        self.assertIn('DIFFERENTIAL_DIAGNOSIS', APP_JS)
        self.assertIn('renderDifferentialDiagnosis', APP_JS)
        self.assertIn('Differential Diagnosis', APP_JS)
        self.assertIn('What This Is Not', APP_JS)

    def test_incident_mode_is_available(self):
        self.assertIn('incidentMode', APP_JS)
        self.assertIn('setIncidentMode', APP_JS)
        self.assertIn('renderIncidentModeBrief', APP_JS)
        self.assertIn('Incident Brief', APP_JS)

    def test_reasoning_progress_is_available(self):
        self.assertIn('loadReasoningProgress', APP_JS)
        self.assertIn('recordLabReasoningProgress', APP_JS)
        self.assertIn('recordQuizReasoningProgress', APP_JS)
        self.assertIn('renderReasoningProgressSummary', APP_JS)
        self.assertIn('Reasoning Progress', APP_JS)

    def test_consequence_branching_is_available(self):
        self.assertIn('CONSEQUENCE_BRANCHES', APP_JS)
        self.assertIn('loadBranchingState', APP_JS)
        self.assertIn('chooseIncidentBranch', APP_JS)
        self.assertIn('renderConsequenceBranch', APP_JS)
        self.assertIn('getBranchConsequenceContext', APP_JS)
        self.assertIn('Branch consequence', APP_JS)
        self.assertIn('Decision Drill', APP_JS)

    def test_frontend_uses_same_origin_api_prefix(self):
        self.assertIn('/api/v1', APP_JS)
        self.assertRegex(APP_JS, r'API_BASE\s*=')

    def test_no_hardcoded_bearer_token_exists(self):
        self.assertNotIn('Bearer ey', APP_JS)
        self.assertNotRegex(APP_JS, re.compile(r'sk-[A-Za-z0-9_-]{20,}'))


if __name__ == '__main__':
    unittest.main()
