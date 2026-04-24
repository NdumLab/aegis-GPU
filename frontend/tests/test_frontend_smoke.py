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
        self.assertIn('recordLabCompletionOutcome', APP_JS)
        self.assertIn('isLabCompletionClean', APP_JS)
        self.assertIn('getLabOutcomeSummary', APP_JS)
        self.assertIn('renderLabOutcomeSummary', APP_JS)
        self.assertIn('renderReasoningProgressSummary', APP_JS)
        self.assertIn('Reasoning Progress', APP_JS)
        self.assertIn('Clean incident finishes', APP_JS)
        self.assertIn('Next training focus', APP_JS)
        self.assertIn('Recent risk pattern', APP_JS)
        self.assertIn('getReasoningFocusRecommendation', APP_JS)
        self.assertIn('getRecentRiskPattern', APP_JS)
        self.assertIn('Incident Outcome', APP_JS)
        self.assertIn('Recent incident outcomes', APP_JS)

    def test_consequence_branching_is_available(self):
        self.assertIn('CONSEQUENCE_BRANCHES', APP_JS)
        self.assertIn('loadBranchingState', APP_JS)
        self.assertIn('chooseIncidentBranch', APP_JS)
        self.assertIn('renderConsequenceBranch', APP_JS)
        self.assertIn('getBranchConsequenceContext', APP_JS)
        self.assertIn('isBranchDetourPending', APP_JS)
        self.assertIn('runBranchDetour', APP_JS)
        self.assertIn('BRANCH_DETOUR_PLAYBOOKS', APP_JS)
        self.assertIn('ECC Integrity Recovery', APP_JS)
        self.assertIn('XID Fault Recovery', APP_JS)
        self.assertIn('NVLink Topology Recovery', APP_JS)
        self.assertIn('NCCL Fallback Recovery', APP_JS)
        self.assertIn('Storage Starvation Recovery', APP_JS)
        self.assertIn('BRANCH_STEP_MODIFIERS', APP_JS)
        self.assertIn('ECC Revalidation Stage', APP_JS)
        self.assertIn('Fallback Path Recovery', APP_JS)
        self.assertIn('ALTERNATE_BRANCH_STEPS', APP_JS)
        self.assertIn('ALTERNATE_BRANCH_FOLLOWUPS', APP_JS)
        self.assertIn('ALTERNATE_MAIN_PATH_STEPS', APP_JS)
        self.assertIn('getAlternateBranchChain', APP_JS)
        self.assertIn('getMainPathRedirectStep', APP_JS)
        self.assertIn('ECC Recovery Checkpoint', APP_JS)
        self.assertIn('ECC Containment Verification', APP_JS)
        self.assertIn('ECC Containment Decision', APP_JS)
        self.assertIn('Stack Contract Decision', APP_JS)
        self.assertIn('GPU Placement Decision', APP_JS)
        self.assertIn('Scheduler Ownership Decision', APP_JS)
        self.assertIn('Collective Rejoin Decision', APP_JS)
        self.assertIn('Fabric Availability Decision', APP_JS)
        self.assertIn('NVLink Recovery Checkpoint', APP_JS)
        self.assertIn('CUDA Stack Recovery Checkpoint', APP_JS)
        self.assertIn('Kubernetes Recovery Checkpoint', APP_JS)
        self.assertIn('Slurm Recovery Checkpoint', APP_JS)
        self.assertIn('Collective Recovery Checkpoint', APP_JS)
        self.assertIn('InfiniBand Recovery Checkpoint', APP_JS)
        self.assertIn('MIG Recovery Checkpoint', APP_JS)
        self.assertIn('Container Runtime Recovery Checkpoint', APP_JS)
        self.assertIn('Training Pipeline Recovery Checkpoint', APP_JS)
        self.assertIn('RoCE Recovery Checkpoint', APP_JS)
        self.assertIn('GDS Recovery Checkpoint', APP_JS)
        self.assertIn('Monitoring Recovery Checkpoint', APP_JS)
        self.assertIn('runAlternateBranchStep', APP_JS)
        self.assertIn('Recovery chain step', APP_JS)
        self.assertIn('Redirected Main Step', APP_JS)
        self.assertIn('Containment Recovery', APP_JS)
        self.assertIn('Transport Recovery', APP_JS)
        self.assertIn('Route Change Pending', APP_JS)
        self.assertIn('Branch consequence', APP_JS)
        self.assertIn('Decision Drill', APP_JS)
        self.assertIn('Clean incident finish', APP_JS)
        self.assertIn('Compromised incident finish', APP_JS)

    def test_frontend_uses_same_origin_api_prefix(self):
        self.assertIn('/api/v1', APP_JS)
        self.assertRegex(APP_JS, r'API_BASE\s*=')

    def test_no_hardcoded_bearer_token_exists(self):
        self.assertNotIn('Bearer ey', APP_JS)
        self.assertNotRegex(APP_JS, re.compile(r'sk-[A-Za-z0-9_-]{20,}'))


if __name__ == '__main__':
    unittest.main()
