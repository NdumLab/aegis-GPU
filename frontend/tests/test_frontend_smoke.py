import re
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / 'index.html').read_text(encoding='utf-8')
APP_JS = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
ANALYTICS_JS = (ROOT / 'js' / 'analytics.js').read_text(encoding='utf-8')
BRANCHING_JS = (ROOT / 'js' / 'branching.js').read_text(encoding='utf-8')
COACH_JS = (ROOT / 'js' / 'coach.js').read_text(encoding='utf-8')
STUDY_QUIZ_JS = (ROOT / 'js' / 'study-quiz.js').read_text(encoding='utf-8')
RUNTIME_JS = (ROOT / 'js' / 'runtime.js').read_text(encoding='utf-8')
RENDER_JS = (ROOT / 'js' / 'render.js').read_text(encoding='utf-8')
LEARNING_PART1_JS = (ROOT / 'js' / 'learning-part-1.js').read_text(encoding='utf-8')
LABS_JS = (ROOT / 'js' / 'labs.js').read_text(encoding='utf-8')
LABS_PART1_JS = (ROOT / 'js' / 'labs-part-1.js').read_text(encoding='utf-8')
CLUSTER_SIM_JS = (ROOT / 'js' / 'cluster-sim.js').read_text(encoding='utf-8')
CLUSTER_DASHBOARD_JS = (ROOT / 'js' / 'cluster-dashboard.js').read_text(encoding='utf-8')
CLUSTER_TERMINAL_JS = (ROOT / 'js' / 'cluster-terminal.js').read_text(encoding='utf-8')
FRONTEND_JS = APP_JS + '\n' + ANALYTICS_JS + '\n' + BRANCHING_JS + '\n' + COACH_JS + '\n' + STUDY_QUIZ_JS + '\n' + RUNTIME_JS + '\n' + RENDER_JS + '\n' + LEARNING_PART1_JS + '\n' + LABS_JS + '\n' + CLUSTER_SIM_JS + '\n' + CLUSTER_DASHBOARD_JS + '\n' + CLUSTER_TERMINAL_JS


class FrontendSmokeTest(unittest.TestCase):
    def test_expected_assets_are_referenced(self):
        self.assertIn('css/styles.css', INDEX)
        self.assertIn('js/labs-part-1.js', INDEX)
        self.assertIn('js/labs-part-4.js', INDEX)
        self.assertIn('js/analytics.js', INDEX)
        self.assertIn('js/branching.js', INDEX)
        self.assertIn('js/coach.js', INDEX)
        self.assertIn('js/study-quiz.js', INDEX)
        self.assertIn('js/cluster-sim.js', INDEX)
        self.assertIn('js/cluster-dashboard.js', INDEX)
        self.assertIn('js/cluster-terminal.js', INDEX)
        self.assertIn('js/runtime.js', INDEX)
        self.assertIn('js/app.js', INDEX)
        self.assertIn('js/learning-part-1.js', INDEX)
        self.assertIn('js/render.js', INDEX)
        self.assertIn('toggle-incident-mode', INDEX)
        self.assertIn('h-judgment', INDEX)

    def test_exam_prep_section_is_available(self):
        self.assertIn('id="btn-study"', INDEX)
        self.assertIn('id="sidebar-btn-study"', INDEX)
        self.assertIn('id="study-overlay"', INDEX)
        self.assertIn('EXAM_STUDY_GUIDES', FRONTEND_JS)
        self.assertIn('NVIDIA-Certified Associate: AI Infrastructure and Operations', FRONTEND_JS)
        self.assertIn('Official Exam Shape', FRONTEND_JS)
        self.assertIn('Essential AI Knowledge', FRONTEND_JS)
        self.assertIn('AI Infrastructure', FRONTEND_JS)
        self.assertIn('AI Operations', FRONTEND_JS)

    def test_workspace_modes_are_available(self):
        self.assertIn('data-workspace-mode="training"', INDEX)
        self.assertIn('data-workspace-mode="incident"', INDEX)
        self.assertIn('data-workspace-mode="fleet"', INDEX)
        self.assertIn('data-mode-scope="training"', INDEX)
        self.assertIn('data-mode-scope="incident"', INDEX)
        self.assertIn('data-mode-scope="fleet"', INDEX)
        self.assertIn('function setWorkspaceMode', RUNTIME_JS)
        self.assertIn("nextMode !== 'incident' && incidentMode", RUNTIME_JS)

    def test_overlay_popouts_are_available(self):
        self.assertIn('id="btn-popout-intro"', INDEX)
        self.assertIn('id="btn-popout-study"', INDEX)
        self.assertIn('id="btn-popout-quiz"', INDEX)
        self.assertIn("openDetachedPanel('introOverlay')", FRONTEND_JS)
        self.assertIn("openDetachedPanel('studyOverlay')", FRONTEND_JS)
        self.assertIn("openDetachedPanel('quizOverlay')", FRONTEND_JS)
        self.assertIn('data-intro-action="skip"', FRONTEND_JS)
        self.assertIn('data-intro-action="start"', FRONTEND_JS)
        self.assertIn('intro-action-row-top', FRONTEND_JS)
        self.assertIn('lab-step-coach-topic-label-purpose', FRONTEND_JS)
        self.assertIn('lab-step-coach-topic-label-doing', FRONTEND_JS)
        self.assertIn('lab-step-coach-topic-label-matters', FRONTEND_JS)

    def test_study_quiz_surface_is_available(self):
        self.assertIn('renderStudyGuide', FRONTEND_JS)
        self.assertIn('openStudyGuide', FRONTEND_JS)
        self.assertIn('openStudyLab', FRONTEND_JS)
        self.assertIn('renderStudyLabLinks', FRONTEND_JS)
        self.assertIn('QUIZ = [', FRONTEND_JS)
        self.assertIn('openQuiz', FRONTEND_JS)
        self.assertIn('selectAnswer', FRONTEND_JS)
        self.assertIn('submitQuiz', FRONTEND_JS)
        self.assertIn('resetQuiz', FRONTEND_JS)
        self.assertIn('closeQuiz', FRONTEND_JS)
        self.assertIn('QUIZ_WRONG_CHOICE_FEEDBACK', FRONTEND_JS)
        self.assertIn('QUIZ_CORRECT_CHOICE_FEEDBACK', FRONTEND_JS)
        self.assertIn('getQuizChoiceFeedback', FRONTEND_JS)
        self.assertIn('The Chain To Remember', FRONTEND_JS)
        self.assertIn('Submit Answers', FRONTEND_JS)
        self.assertIn('Quiz accuracy', FRONTEND_JS)

    def test_quiz_wrong_answers_have_feedback(self):
        script = f"""
        const fs = require('fs');
        const source = fs.readFileSync({str(ROOT / 'js' / 'study-quiz.js')!r}, 'utf8');
        eval(source + `
          const missing = [];
          QUIZ.forEach((question, questionIndex) => {{
            if (!QUIZ_CORRECT_CHOICE_FEEDBACK[questionIndex]) {{
              missing.push(questionIndex + ':correct');
            }}
            question.opts.forEach((_, optionIndex) => {{
              if (optionIndex !== question.ans && !QUIZ_WRONG_CHOICE_FEEDBACK[questionIndex]?.[optionIndex]) {{
                missing.push(questionIndex + ':' + optionIndex);
              }}
            }});
          }});
          if (missing.length) throw new Error('Missing quiz feedback for ' + missing.join(', '));
        `);
        """
        subprocess.check_call(['node', '-e', script])

    def test_runtime_surface_is_available(self):
        self.assertIn('function loadLab', FRONTEND_JS)
        self.assertIn('function runStep', FRONTEND_JS)
        self.assertIn('function runCurrentStep', FRONTEND_JS)
        self.assertIn('function setTerminalModeEnabled', FRONTEND_JS)
        self.assertIn('function updateTerminalModeUI', FRONTEND_JS)
        self.assertIn('function executeLabTerminalCommand', FRONTEND_JS)
        self.assertIn('function resolveLabTerminalCommand', FRONTEND_JS)
        self.assertIn('function initApp', FRONTEND_JS)
        self.assertIn('function toggleAppMode', FRONTEND_JS)
        self.assertIn('function toggleThermalView', FRONTEND_JS)
        self.assertIn('function fetchLiveMetrics', FRONTEND_JS)
        self.assertIn('function requestAI_Remediation', FRONTEND_JS)
        self.assertIn('function openIncidentHistory', FRONTEND_JS)
        self.assertIn('The terminal is intentionally limited', FRONTEND_JS)
        self.assertIn('Accepted probes for the current checkpoint', FRONTEND_JS)
        self.assertIn('LIVE DATACENTER VIEW', FRONTEND_JS)
        self.assertIn('AUTONOMOUS RUNBOOK', FRONTEND_JS)
        self.assertIn('gpusim_terminal_mode', FRONTEND_JS)
        self.assertIn('id="btn-terminal-mode"', INDEX)
        self.assertIn('id="terminal-mode-status"', INDEX)
        self.assertIn('Guided Replay', FRONTEND_JS + INDEX)
        self.assertIn('Type Probes', FRONTEND_JS)
        self.assertIn('Focus Input', FRONTEND_JS)
        self.assertIn('The checkpoint advances only after you type an accepted probe.', FRONTEND_JS)
        self.assertNotIn('Terminal Mode On', FRONTEND_JS)
        self.assertNotIn('Terminal Mode Off', FRONTEND_JS)

    def test_cluster_sim_foundation_is_available(self):
        self.assertIn('AEGIS_CLUSTER_SIM', CLUSTER_SIM_JS)
        self.assertIn('createInitialState', CLUSTER_SIM_JS)
        self.assertIn('createStore', CLUSTER_SIM_JS)
        self.assertIn('tickState', CLUSTER_SIM_JS)
        self.assertIn('getFleetSummary', CLUSTER_SIM_JS)
        self.assertIn('DEFAULT_FAULT_PRESETS', CLUSTER_SIM_JS)
        self.assertIn('injectFault', CLUSTER_SIM_JS)
        self.assertIn('clearAllFaults', CLUSTER_SIM_JS)
        self.assertIn('ensureClusterSimStore', APP_JS)
        self.assertIn('describeClusterSimIdleView', APP_JS)
        self.assertIn('updateClusterSimFoundationUI', RUNTIME_JS)
        self.assertIn('startClusterSimFoundationLoop', RUNTIME_JS)

    def test_cluster_fleet_dashboard_surface_is_available(self):
        self.assertIn('id="nav-cluster_fleet"', INDEX)
        self.assertIn('id="cluster-dashboard-pane"', INDEX)
        self.assertIn('id="cluster-fleet-kpis"', INDEX)
        self.assertIn('id="cluster-fleet-side"', INDEX)
        self.assertIn('AEGIS_CLUSTER_DASHBOARD', CLUSTER_DASHBOARD_JS)
        self.assertIn('renderFleetKpis', CLUSTER_DASHBOARD_JS)
        self.assertIn('renderFleetGrid', CLUSTER_DASHBOARD_JS)
        self.assertIn('renderFleetSidebar', CLUSTER_DASHBOARD_JS)
        self.assertIn('renderWorkloadControls', CLUSTER_DASHBOARD_JS)
        self.assertIn('renderJobTable', CLUSTER_DASHBOARD_JS)
        self.assertIn('openClusterDashboard', RUNTIME_JS)
        self.assertIn('renderClusterDashboardView', RUNTIME_JS)
        self.assertIn('cluster-fleet-kpis', RUNTIME_JS)
        self.assertIn('cluster-fleet-side', RUNTIME_JS)
        self.assertIn('submitClusterWorkload', RUNTIME_JS)
        self.assertIn('cancelClusterWorkload', RUNTIME_JS)
        self.assertIn('injectClusterFault', RUNTIME_JS)
        self.assertIn('clearClusterFault', RUNTIME_JS)
        self.assertIn('Clear All Faults', CLUSTER_DASHBOARD_JS)
        self.assertIn('Cluster Fleet Simulator', RUNTIME_JS)

    def test_cluster_terminal_surface_is_available(self):
        self.assertIn('AEGIS_CLUSTER_TERMINAL', CLUSTER_TERMINAL_JS)
        self.assertIn('runCommand', CLUSTER_TERMINAL_JS)
        self.assertIn('buildSqueue', CLUSTER_TERMINAL_JS)
        self.assertIn('buildSinfo', CLUSTER_TERMINAL_JS)
        self.assertIn('buildSacct', CLUSTER_TERMINAL_JS)
        self.assertIn('buildNodeNvidiaSmi', CLUSTER_TERMINAL_JS)
        self.assertIn('buildTopo', CLUSTER_TERMINAL_JS)
        self.assertIn('runClusterTerminalCommand', RUNTIME_JS)
        self.assertIn('ssh gb200-node-00', RUNTIME_JS)

    def test_terminal_fixtures_cover_early_fault_labs(self):
        self.assertIn('ECC baseline probe accepted', LABS_PART1_JS)
        self.assertIn('simulate ecc degradation', LABS_PART1_JS)
        self.assertIn('XID 48 alert probe accepted', LABS_PART1_JS)
        self.assertIn('sudo nvidia-smi --gpu-reset -i 3', LABS_PART1_JS)

    def test_reasoning_scorecard_is_available(self):
        self.assertIn('getReasoningScorecardContext', FRONTEND_JS)
        self.assertIn('renderReasoningScorecard', FRONTEND_JS)
        self.assertIn('Reasoning Scorecard', FRONTEND_JS)
        self.assertIn('Assessment Scorecard', FRONTEND_JS)

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
        self.assertIn('loadReasoningProgress', FRONTEND_JS)
        self.assertIn('recordLabReasoningProgress', FRONTEND_JS)
        self.assertIn('recordQuizReasoningProgress', FRONTEND_JS)
        self.assertIn('recordLabCompletionOutcome', FRONTEND_JS)
        self.assertIn('isLabCompletionClean', FRONTEND_JS)
        self.assertIn('getLabOutcomeSummary', FRONTEND_JS)
        self.assertIn('renderLabOutcomeSummary', FRONTEND_JS)
        self.assertIn('renderReasoningProgressSummary', FRONTEND_JS)
        self.assertIn('Reasoning Progress', FRONTEND_JS)
        self.assertIn('Clean incident finishes', FRONTEND_JS)
        self.assertIn('Next training focus', FRONTEND_JS)
        self.assertIn('Recent risk pattern', FRONTEND_JS)
        self.assertIn('getReasoningFocusRecommendation', FRONTEND_JS)
        self.assertIn('getRecentRiskPattern', FRONTEND_JS)
        self.assertIn('getRecommendedLabsForDomain', FRONTEND_JS)
        self.assertIn('getUniqueLabs', FRONTEND_JS)
        self.assertIn('getRecoveryProgressSignal', FRONTEND_JS)
        self.assertIn('getReasoningProgressReport', FRONTEND_JS)
        self.assertIn('downloadReasoningProgressReport', FRONTEND_JS)
        self.assertIn('Export reasoning report', FRONTEND_JS)
        self.assertIn('Pilot-ready JSON snapshot', FRONTEND_JS)
        self.assertIn('aegis_reasoning_progress', FRONTEND_JS)
        self.assertIn('Start one lab or quiz', FRONTEND_JS)
        self.assertIn('fault isolation', FRONTEND_JS)
        self.assertIn('fabric path', FRONTEND_JS)
        self.assertIn('last compromised lab', FRONTEND_JS)
        self.assertIn('clean finishes in', FRONTEND_JS)
        self.assertIn('Picked because your last compromised run was', FRONTEND_JS)
        self.assertIn('recommended drill', FRONTEND_JS)
        self.assertIn('Incident Outcome', FRONTEND_JS)
        self.assertIn('Recent incident outcomes', FRONTEND_JS)

    def test_ask_aegis_is_available(self):
        self.assertIn('renderAskAegisBlock', FRONTEND_JS)
        self.assertIn('getAskAegisResponse', FRONTEND_JS)
        self.assertIn('Ask Aegis', FRONTEND_JS)
        self.assertIn('What changed?', FRONTEND_JS)
        self.assertIn('Which layer owns this?', FRONTEND_JS)
        self.assertIn('What should I check next?', FRONTEND_JS)
        self.assertIn('Why is this branch scored this way?', FRONTEND_JS)

    def test_consequence_branching_is_available(self):
        self.assertIn('CONSEQUENCE_BRANCHES', FRONTEND_JS)
        self.assertIn('loadBranchingState', FRONTEND_JS)
        self.assertIn('chooseIncidentBranch', FRONTEND_JS)
        self.assertIn('renderConsequenceBranch', FRONTEND_JS)
        self.assertIn('getBranchConsequenceContext', FRONTEND_JS)
        self.assertIn('isBranchDetourPending', FRONTEND_JS)
        self.assertIn('runBranchDetour', FRONTEND_JS)
        self.assertIn('BRANCH_DETOUR_PLAYBOOKS', FRONTEND_JS)
        self.assertIn('ECC Integrity Recovery', FRONTEND_JS)
        self.assertIn('XID Fault Recovery', FRONTEND_JS)
        self.assertIn('NVLink Topology Recovery', FRONTEND_JS)
        self.assertIn('NCCL Fallback Recovery', FRONTEND_JS)
        self.assertIn('Storage Starvation Recovery', FRONTEND_JS)
        self.assertIn('BRANCH_STEP_MODIFIERS', FRONTEND_JS)
        self.assertIn('ECC Revalidation Stage', FRONTEND_JS)
        self.assertIn('Fallback Path Recovery', FRONTEND_JS)
        self.assertIn('ALTERNATE_BRANCH_STEPS', FRONTEND_JS)
        self.assertIn('ALTERNATE_BRANCH_FOLLOWUPS', FRONTEND_JS)
        self.assertIn('ALTERNATE_MAIN_PATH_STEPS', FRONTEND_JS)
        self.assertIn('getAlternateBranchChain', FRONTEND_JS)
        self.assertIn('getMainPathRedirectStep', FRONTEND_JS)
        self.assertIn('ECC Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('ECC Containment Verification', FRONTEND_JS)
        self.assertIn('ECC Containment Decision', FRONTEND_JS)
        self.assertIn('Stack Contract Decision', FRONTEND_JS)
        self.assertIn('GPU Placement Decision', FRONTEND_JS)
        self.assertIn('Scheduler Ownership Decision', FRONTEND_JS)
        self.assertIn('Collective Rejoin Decision', FRONTEND_JS)
        self.assertIn('Fabric Availability Decision', FRONTEND_JS)
        self.assertIn('NVLink Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('CUDA Stack Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Kubernetes Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Slurm Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Collective Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('InfiniBand Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('MIG Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Container Runtime Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Training Pipeline Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('RoCE Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('GDS Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('Monitoring Recovery Checkpoint', FRONTEND_JS)
        self.assertIn('runAlternateBranchStep', FRONTEND_JS)
        self.assertIn('Recovery chain step', FRONTEND_JS)
        self.assertIn('Redirected Main Step', FRONTEND_JS)
        self.assertIn('Containment Recovery', FRONTEND_JS)
        self.assertIn('Transport Recovery', FRONTEND_JS)
        self.assertIn('Route Change Pending', FRONTEND_JS)
        self.assertIn('Branch consequence', FRONTEND_JS)
        self.assertIn('Decision Drill', FRONTEND_JS)
        self.assertIn('Clean incident finish', FRONTEND_JS)
        self.assertIn('Compromised incident finish', FRONTEND_JS)

    def test_frontend_uses_same_origin_api_prefix(self):
        self.assertIn('/api/v1', APP_JS)

    def test_mig_visual_modes_cover_intro_and_all_steps(self):
        self.assertIn('Start state: MIG Mode OFF', RENDER_JS)
        self.assertIn('Step 1: MIG mode enabled at the device level', RENDER_JS)
        self.assertIn('Step 2: 7 instances created', RENDER_JS)
        self.assertIn('Step 3: Instance listing verified', RENDER_JS)
        self.assertIn('Step 4: Instances assigned', RENDER_JS)
        self.assertIn('Step 5: MIG Mode OFF', RENDER_JS)
        self.assertIn('80GB HBM3 · full GPU restored', RENDER_JS)
        self.assertIn('Enabled MIG Mode for GPU 00000000:17:00.0', LABS_JS)
        for gi in range(1, 8):
            self.assertIn(f'Successfully created GPU instance ID {gi} on GPU 0 using profile MIG 1g.10gb', LABS_JS)
            self.assertIn(f'GPU  0  GI {gi}  CI 0  10GB  MIG 1g.10gb', LABS_JS)
            self.assertIn(f'Destroyed GPU instance ID {gi} on GPU 0', LABS_JS)
        self.assertIn('Team A -> GI 1, GI 2', LABS_JS)
        self.assertIn('Team B -> GI 3, GI 4', LABS_JS)
        self.assertIn('Team C -> GI 5, GI 6, GI 7', LABS_JS)
        self.assertIn('CUDA_VISIBLE_DEVICES=MIG-GPU-0:5:0,MIG-GPU-0:6:0,MIG-GPU-0:7:0', LABS_JS)
        self.assertIn('Full GPU restored: H100 SXM5 80GB available as one device', LABS_JS)

    def test_hardware_section_terminal_outputs_are_complete(self):
        self.assertIn('GPU7    NV4   NV4   NV4   NV4   NV4   NV4   NV4    X    96-191', LABS_JS)
        self.assertIn('GPU 7, Link 3: Replay Error Count:   0', LABS_JS)
        self.assertIn('4294967296  1073741824   float    sum      -1    46.91 ms  182.7   182.7    0', LABS_JS)
        self.assertIn('GPU7    PHB   PHB   PHB   PHB   PHB   PHB   PHB    X    96-191', LABS_JS)
        self.assertIn('NCCL INFO Connected all rings using fallback transport', LABS_JS)
        self.assertIn('6         0    61                   0', LABS_JS)
        self.assertIn('[86423.447] NVRM: A GPU crash dump has been created', LABS_JS)
        self.assertIn('evicting pod inference-batch-42-6dd79b8b9d-r2k4v', LABS_JS)
        self.assertIn('[92741.105] NVRM: RmInitAdapter failed during fault handling', LABS_JS)
        self.assertIn('2         0    1', LABS_JS)
        self.assertIn("GPU Reset couldn't complete because the device is not responding", LABS_JS)
        self.assertIn('GPU 5, Link 0: Replay Error Count:   29', LABS_JS)

    def test_software_section_terminal_outputs_are_complete(self):
        self.assertIn('NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54.15', LABS_JS)
        self.assertIn('Cuda compilation tools, release 12.4, V12.4.131', LABS_JS)
        self.assertIn("'2.4.0+cu124'", LABS_JS)
        self.assertIn('RuntimeError: CUDA driver version is insufficient for CUDA runtime version', LABS_JS)
        self.assertIn('Status: Downloaded newer image for nvcr.io/nvidia/pytorch:24.03-py3', LABS_JS)
        self.assertIn('GPU 1: NVIDIA H100 80GB HBM3', LABS_JS)
        self.assertIn('torch.cuda.device_count()', LABS_JS)
        self.assertIn('Epoch 0 | step 3/100 | loss 5.94 | throughput 1827 samples/s', LABS_JS)
        self.assertIn('RANK 7/8 initialized | backend=nccl', LABS_JS)
        self.assertIn('bucket 2 allreduce complete | 6.9 ms', LABS_JS)
        self.assertIn('iteration time expanded from 420 ms to 1180 ms', LABS_JS)
        self.assertIn('NCCL INFO Connected all rings using IB transport', LABS_JS)
        self.assertIn('rank7 -> rank0 | chunk 7 reduced', LABS_JS)
        self.assertIn('size 2147483648 | algbw 182.8 GB/s | busbw 182.8 GB/s', LABS_JS)
        self.assertIn('NCCL WARN Falling back from IB to socket transport', LABS_JS)
        self.assertIn('Benchmark recovered to expected bandwidth envelope', LABS_JS)

    def test_network_storage_section_terminal_outputs_are_complete(self):
        self.assertIn("CA 'mlx5_0'", LABS_JS)
        self.assertIn('PortXmitDiscards...............0', LABS_JS)
        self.assertIn('262144     1000           380.02             379.31', LABS_JS)
        self.assertIn('node-06 / mlx5_0 / port 1 -> switch-a / port 12', LABS_JS)
        self.assertIn('Blast radius: single endpoint pair', LABS_JS)
        self.assertIn('2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000', LABS_JS)
        self.assertIn('qdisc fq_codel 8011: dev eth0 parent :2 limit 10240 ecn', LABS_JS)
        self.assertIn('pfc_storm_warning: threshold exceeded', LABS_JS)
        self.assertIn('NCCL WARN Falling back to TCP transport', LABS_JS)
        self.assertIn('NCCL_IB_DISABLE=1', LABS_JS)
        self.assertIn('NCCL INFO Socket fallback no longer selected', LABS_JS)
        self.assertIn('after fix  : 181.9 GB/s', LABS_JS)
        self.assertIn('Sawtooth GPU utilization: accelerators are waiting for input', LABS_JS)
        self.assertIn('nvme1n1         1774  915332   32.8   99.7', LABS_JS)
        self.assertIn('Dataset now spread across 8 OSTs', LABS_JS)
        self.assertIn('input queue depth stable above threshold', LABS_JS)
        self.assertIn('Sawtooth cleared; GPUs are being fed steadily', LABS_JS)
        self.assertIn('NVMe read -> page cache / CPU memory', LABS_JS)
        self.assertIn('cuFile runtime available for GDS', LABS_JS)
        self.assertIn('observed gain    : 2.7x', LABS_JS)
        self.assertIn('dcgm-exporter listening on :9400', LABS_JS)
        self.assertIn('DCGM_FI_DEV_GPU_UTIL{gpu="0"} 82', LABS_JS)
        self.assertIn('Target: dcgm-exporter:9400', LABS_JS)
        self.assertIn('Panel: NVLink / PCIe health', LABS_JS)
        self.assertIn('ALERTS{alertname="GPU_DBE_Detected",severity="critical"} 1', LABS_JS)

    def test_operations_section_terminal_outputs_are_complete(self):
        self.assertIn('Submitted batch job 99234', LABS_JS)
        self.assertIn('JOBID   PARTITION   NAME    USER   ST     TIME   NODES   NODELIST(REASON)', LABS_JS)
        self.assertIn('JobId=99234 JobState=PENDING Reason=Priority', LABS_JS)
        self.assertIn('alice  research  1           0.125        91324      0.034', LABS_JS)
        self.assertIn('NodeName=gpu-node-05 State=DRAIN', LABS_JS)
        self.assertIn('Node returned to scheduling pool after validation', LABS_JS)
        self.assertIn('nvidia-device-plugin-daemonset   1/1   Running', LABS_JS)
        self.assertIn('gpu-feature-discovery            1/1   Running', LABS_JS)
        self.assertIn('Scheduler-visible GPU capacity matches node design', LABS_JS)
        self.assertIn('0/4 nodes are available: 4 Insufficient nvidia.com/gpu.', LABS_JS)
        self.assertIn('deny-cross-namespace   app=trainer       3d', LABS_JS)
        self.assertIn('evicting pod trainer-7f9d6c7d8f-abc12', LABS_JS)
        self.assertIn('training-gang   16          16       True', LABS_JS)

    def test_lab_renderers_normalize_unselected_intro_step(self):
        draw_functions = re.findall(r'function (draw[A-Za-z0-9]+)\(svg, step=0\)', RENDER_JS)
        lab_draw_functions = [name for name in draw_functions if name not in {'drawRackElevation', 'drawWelcome'}]
        self.assertGreaterEqual(len(lab_draw_functions), 16)
        for name in lab_draw_functions:
            start = RENDER_JS.index(f'function {name}(svg, step=0)')
            next_match = re.search(r'\nfunction draw[A-Za-z0-9]+\(', RENDER_JS[start + 1:])
            end = start + 1 + next_match.start() if next_match else len(RENDER_JS)
            body = RENDER_JS[start:end]
            self.assertIn('if(step < 0)', body, msg=f'{name} does not handle the unselected intro step')

    def test_visual_modes_align_with_lab_step_meaning(self):
        self.assertIn('const isFault = step>=3', RENDER_JS)
        self.assertIn('XID 48 detected — uncorrectable DBE event', RENDER_JS)
        self.assertIn('Node drained — no new workloads scheduled', RENDER_JS)
        self.assertIn('const isMismatch = step===3 && i===1', RENDER_JS)
        self.assertIn('Framework/CUDA version mismatch found', RENDER_JS)
        self.assertIn('DDP launched — all ranks joined the world', RENDER_JS)
        self.assertIn('const traditionalPath = step===0 || step===3', RENDER_JS)
        self.assertIn('GDS runtime verified — cuFile software path available', RENDER_JS)
        self.assertRegex(APP_JS, r'API_BASE\s*=')

    def test_no_hardcoded_bearer_token_exists(self):
        self.assertNotIn('Bearer ey', APP_JS)
        self.assertNotRegex(APP_JS, re.compile(r'sk-[A-Za-z0-9_-]{20,}'))


if __name__ == '__main__':
    unittest.main()
