/**
 * APP MODULE: Main Controller
 * Handles State, Modals, Lab Lifecycles, and Incident Parser.
 */

// --- GLOBAL STATE ---
let currentLab = null;
let currentStep = 0;
let completedLabs = new Set();
let activeTab = 'term';
let termLines = { term:[], dmesg:[], dcgm:[] };

let isProvisioned = false;
let currentBlueprint = null;
const API_BASE = window.__AEGIS_API_BASE__ || `${window.location.origin}/api/v1`;
// Sprint 16: JWT-based authentication — token fetched at login, never hard-coded.
let JWT_TOKEN = sessionStorage.getItem('aegis_jwt') || '';
let _appInitialized = false;
let USER_ROLE  = sessionStorage.getItem('aegis_role') || '';
let currentFaultNode = 0;
let _uiHandlersBound = false;
let lastLiveTelemetry = null;
let beginnerMode = localStorage.getItem('gpusim_beginner_mode');
beginnerMode = beginnerMode === null ? true : beginnerMode === 'true';
let incidentMode = localStorage.getItem('gpusim_incident_mode') === 'true';
let explanationLevel = localStorage.getItem('gpusim_explain_level') || 'beginner';
let explanationRole = localStorage.getItem('gpusim_explain_role') || 'cluster_operator';
let llmDiagnosisEnabled = localStorage.getItem('gpusim_allow_llm_diagnosis');
llmDiagnosisEnabled = llmDiagnosisEnabled === null ? true : llmDiagnosisEnabled === 'true';
let backendLLMAvailable = false;
let backendLLMMode = 'deterministic';
let labCoachOpen = localStorage.getItem('gpusim_lab_coach_open');
labCoachOpen = labCoachOpen === null ? true : labCoachOpen === 'true';
let detachedPanels = {
  liveExplainer: null,
  stepCoach: null,
};
let reasoningScoreState = {
  byLab: {},
  lastQuiz: null,
};
let reasoningProgress = loadReasoningProgress();
let branchingState = loadBranchingState();
const DIFFERENTIAL_DIAGNOSIS = {
  ecc: [
    {
      label: 'Not a generic slowdown',
      not: 'Low throughput on its own is not enough to call this an ECC incident.',
      why: 'ECC reasoning starts with error counters, XID evidence, and containment signals, not just poor job performance.',
    },
    {
      label: 'Not safe because jobs are still running',
      not: 'A still-running job does not clear the hardware.',
      why: 'Corrected and uncorrected memory errors can coexist with partial service, so the decision still hinges on integrity evidence.',
    },
  ],
  nvlink_fault: [
    {
      label: 'Not all XIDs are the same fault',
      not: 'Do not treat XID 48, 74, and 79 as one generic GPU failure.',
      why: 'The code family decides whether to confirm memory integrity, fabric health, or bus reachability next.',
    },
    {
      label: 'Not a user-space-only problem',
      not: 'An application stack trace does not outrank the driver fault code.',
      why: 'Once the driver is reporting a hardware fault family, the operator path starts with containment and confirmation.',
    },
  ],
  nvlink: [
    {
      label: 'Not just GPU visibility',
      not: 'Seeing all GPUs does not prove the fast path is healthy.',
      why: 'Topology and CRC evidence decide whether the node still has the intended NVLink fabric.',
    },
    {
      label: 'Not an NCCL-only issue yet',
      not: 'Do not start with library tuning before you verify the physical path.',
      why: 'If the fabric baseline is degraded, NCCL behavior is downstream of that hardware story.',
    },
  ],
  mig: [
    {
      label: 'Not a scheduler-only partition',
      not: 'MIG is not just a software quota label.',
      why: 'The GPU changes hardware mode and instance layout before schedulers can place tenants correctly.',
    },
    {
      label: 'Not equivalent to a full GPU',
      not: 'One MIG slice is not a one-for-one replacement for a whole accelerator.',
      why: 'The slice has narrower compute and memory boundaries, so capacity claims must match the final layout.',
    },
  ],
  cuda_stack: [
    {
      label: 'Not automatically a hardware incident',
      not: 'GPU visibility problems and CUDA runtime failures are different layers.',
      why: 'Version contracts between driver, CUDA, and framework are often the real break point.',
    },
    {
      label: 'Not fixed by changing everything',
      not: 'A full-stack upgrade destroys the evidence trail.',
      why: 'Operators narrow the fault to one software boundary before changing packages or images.',
    },
  ],
  container: [
    {
      label: 'Not just an image problem',
      not: 'A valid image can still fail the GPU runtime path.',
      why: 'Container reasoning separates image quality from host runtime exposure and in-container GPU visibility.',
    },
    {
      label: 'Not proof from process start alone',
      not: 'A container starting cleanly does not prove CUDA is usable inside it.',
      why: 'The operator check is whether the workload can actually reach the GPU stack, not whether the shell opened.',
    },
  ],
  training: [
    {
      label: 'Not only a model-code question',
      not: 'Busy GPUs do not guarantee a healthy distributed loop.',
      why: 'Training incidents often live in synchronization, data feed, or one unhealthy rank rather than the model itself.',
    },
    {
      label: 'Not solved by one-rank inspection',
      not: 'A single healthy rank does not clear the job.',
      why: 'The distributed path is only as healthy as its slowest critical stage or participant.',
    },
  ],
  allreduce: [
    {
      label: 'Not raw compute weakness',
      not: 'A slow collective is not the same thing as a weak GPU.',
      why: 'AllReduce diagnosis starts with synchronization path, collective bandwidth, and rank coordination evidence.',
    },
    {
      label: 'Not storage starvation first',
      not: 'Do not call this a data pipeline issue before you check the collective path.',
      why: 'If the slowdown appears during gradient exchange, the inter-rank communication layer owns the first read.',
    },
  ],
  ib_fabric: [
    {
      label: 'Not just an NCCL log quirk',
      not: 'A bad InfiniBand path is not only a library symptom.',
      why: 'Link state, subnet evidence, and HCA selection decide whether the network itself is healthy.',
    },
    {
      label: 'Not a storage bottleneck',
      not: 'Transport-level errors should be cleared before blaming data feed or filesystems.',
      why: 'This family is about the east-west fabric that distributed jobs depend on for collectives.',
    },
  ],
  roce: [
    {
      label: 'Not generic Ethernet health',
      not: 'Simple link-up status does not prove RoCE is safe for GPU traffic.',
      why: 'PFC, ECN, and congestion behavior decide whether the supposedly lossless path is real under load.',
    },
    {
      label: 'Not a GPU silicon fault',
      not: 'Drops and pauses on RoCE should not be framed as GPU defects first.',
      why: 'This path lives in the network control plane and switch behavior before it becomes a training symptom.',
    },
  ],
  nccl_fallback: [
    {
      label: 'Not healthy just because it runs',
      not: 'A running job on TCP sockets can still be the wrong path.',
      why: 'Fallback reasoning asks whether NCCL selected the intended fast transport, not whether the process survived startup.',
    },
    {
      label: 'Not always hardware damage',
      not: 'One bad environment variable can look like fabric failure.',
      why: 'The operator path checks selected transport and configuration before escalating to hardware.',
    },
  ],
  storage: [
    {
      label: 'Not a weak GPU first',
      not: 'Low utilization is not enough to call the accelerator unhealthy.',
      why: 'The sawtooth pattern often means the GPU is waiting on data rather than failing to compute.',
    },
    {
      label: 'Not only a storage dashboard issue',
      not: 'The symptom can surface on the GPU side before the storage team sees a complaint.',
      why: 'The operator read is about starvation across the pipeline, not one isolated chart.',
    },
  ],
  gds: [
    {
      label: 'Not active by default',
      not: 'Owning NVIDIA GPUs does not prove GPUDirect Storage is in use.',
      why: 'The direct path has to be verified with feature and benchmark evidence.',
    },
    {
      label: 'Not proven by one faster run',
      not: 'A benchmark bump alone does not establish the data path change.',
      why: 'You need path verification and controlled before/after comparisons to justify the conclusion.',
    },
  ],
  monitoring: [
    {
      label: 'Not every chart is a signal',
      not: 'A bigger dashboard does not mean a better operational read.',
      why: 'Useful monitoring ties specific metrics to trend detection and action thresholds.',
    },
    {
      label: 'Not healthy because no alert fired',
      not: 'Missing telemetry can hide behind a quiet page.',
      why: 'Operators still verify the source, scrape path, and rule coverage before trusting silence.',
    },
  ],
  slurm: [
    {
      label: 'Not always a GPU incident',
      not: 'Queued or drained work does not automatically point at hardware failure.',
      why: 'Slurm reasoning starts with allocation state, policy, reservations, and node health together.',
    },
    {
      label: 'Not only a scheduler policy problem',
      not: 'A scheduling symptom can still reflect an unhealthy node underneath.',
      why: 'The operator job is to separate placement logic from node-integrity evidence before taking action.',
    },
  ],
  k8s: [
    {
      label: 'Not just a container image issue',
      not: 'A pod starting poorly is not enough to blame the image or app.',
      why: 'GPU scheduling in Kubernetes depends on device plugins, resource requests, and node state as well.',
    },
    {
      label: 'Not a cluster-wide outage by default',
      not: 'One Pending or CrashLooping GPU workload does not prove the whole cluster is broken.',
      why: 'The first read is whether the problem belongs to the pod spec, device plumbing, or the selected node.',
    },
  ],
};
const CONSEQUENCE_BRANCHES = {
  fault_isolation: {
    title: 'Containment Decision',
    prompt: 'A hard fault signal is visible. What do you do first?',
    choices: [
      {
        id: 'contain',
        label: 'Contain and preserve evidence',
        outcome: 'Strong call. The node is isolated before more jobs land, and the evidence trail stays intact for support and root-cause work.',
        effect: 'best',
      },
      {
        id: 'retry',
        label: 'Retry the workload first',
        outcome: 'Weak call. The job may restart briefly, but the hardware story is still unresolved and the blast radius is still open.',
        effect: 'warn',
      },
      {
        id: 'broad_fix',
        label: 'Change drivers and runtime packages',
        outcome: 'Bad call. You changed multiple layers before owning the fault family, which destroys evidence and delays containment.',
        effect: 'bad',
      },
    ],
  },
  fabric_path: {
    title: 'Path Decision',
    prompt: 'Performance is wrong, but the workload is still alive. What is the best next move?',
    choices: [
      {
        id: 'verify_path',
        label: 'Verify the actual transport path',
        outcome: 'Strong call. You confirm whether the fast path is present before tuning software or escalating hardware.',
        effect: 'best',
      },
      {
        id: 'tune_model',
        label: 'Tune the model or batch size first',
        outcome: 'Weak call. You may mask the symptom, but the communication path remains unproven and could keep wasting the cluster.',
        effect: 'warn',
      },
      {
        id: 'reboot_cluster',
        label: 'Reboot nodes across the cluster',
        outcome: 'Bad call. That creates unnecessary disruption without first proving whether the issue is configuration, path selection, or a localized link problem.',
        effect: 'bad',
      },
    ],
  },
  runtime_delivery: {
    title: 'Layer Decision',
    prompt: 'The GPU stack is failing at runtime. Where do you narrow first?',
    choices: [
      {
        id: 'own_boundary',
        label: 'Identify the exact layer boundary',
        outcome: 'Strong call. You preserve the evidence chain and keep the fix narrow: driver, CUDA, framework, runtime, or scheduler.',
        effect: 'best',
      },
      {
        id: 'rebuild_everything',
        label: 'Upgrade the whole stack',
        outcome: 'Bad call. A broad rebuild may appear productive, but it destroys the contract mismatch evidence and makes rollback harder.',
        effect: 'bad',
      },
      {
        id: 'blame_gpu',
        label: 'Treat it as a GPU hardware failure immediately',
        outcome: 'Weak call. Hardware might be healthy. You need to prove the software handoff is broken before you escalate to hardware response.',
        effect: 'warn',
      },
    ],
  },
  platform_efficiency: {
    title: 'Bottleneck Decision',
    prompt: 'The accelerators are underperforming. What do you test first?',
    choices: [
      {
        id: 'trace_upstream',
        label: 'Trace the upstream feed path',
        outcome: 'Strong call. You test whether storage, data delivery, or the direct path is starving the GPUs before changing compute settings.',
        effect: 'best',
      },
      {
        id: 'lower_expectations',
        label: 'Accept lower GPU utilization as normal',
        outcome: 'Weak call. That leaves cluster capacity stranded and misses the upstream bottleneck that users are actually feeling.',
        effect: 'warn',
      },
      {
        id: 'swap_gpu_settings',
        label: 'Change power or clock settings first',
        outcome: 'Bad call. You changed compute behavior before proving the GPUs were the limiting stage at all.',
        effect: 'bad',
      },
    ],
  },
  general_diagnosis: {
    title: 'Diagnosis Decision',
    prompt: 'The symptom is visible but still ambiguous. What is the safest move?',
    choices: [
      {
        id: 'collect_evidence',
        label: 'Collect one more decisive clue',
        outcome: 'Strong call. You narrow the problem with evidence instead of letting the first plausible explanation take over.',
        effect: 'best',
      },
      {
        id: 'guess',
        label: 'Go with the most familiar explanation',
        outcome: 'Weak call. Familiarity is not proof, and it often leads operators into the wrong layer.',
        effect: 'warn',
      },
      {
        id: 'change_many',
        label: 'Change several things at once',
        outcome: 'Bad call. Multi-change fixes break the evidence trail and make it harder to know what actually mattered.',
        effect: 'bad',
      },
    ],
  },
  knowledge_check: {
    title: 'Assessment Consequence',
    prompt: 'What should the quiz result change operationally?',
    choices: [
      {
        id: 'guided_more',
        label: 'Target the weak categories next',
        outcome: 'Strong call. Use the score as routing information for more lab work, not just as a grade.',
        effect: 'best',
      },
      {
        id: 'ignore',
        label: 'Treat the score as final proof',
        outcome: 'Weak call. Quiz percentage alone does not prove field-ready troubleshooting judgment.',
        effect: 'warn',
      },
      {
        id: 'skip_labs',
        label: 'Skip the scenarios and ship anyway',
        outcome: 'Bad call. That jumps past the part of the product that tests evidence handling and safe actions under ambiguity.',
        effect: 'bad',
      },
    ],
  },
};
const BRANCH_DETOUR_PLAYBOOKS = {
  ecc: {
    title: 'ECC Integrity Recovery',
    desc: 'Route correction required: ECC containment checkpoint',
    commands: [
      'dcgmi dmon -e 156,157 -g 0',
      'dmesg | grep -i "Xid\\|ECC"',
      'kubectl cordon gpu-node-01',
    ],
    checks: [
      'Re-check SBE versus DBE instead of treating all ECC signals the same.',
      'Preserve the memory-integrity evidence before any hardware recovery step.',
      'Keep the node out of fresh scheduling until the hardware story is stable.',
    ],
    terminal: [
      '[detour] ECC counters are being re-read to separate trend from hard fault.',
      '[detour] The node is being held out of new placement while integrity is re-checked.',
      '[detour] The lab will not advance until memory health is back under control.',
    ],
  },
  nvlink_fault: {
    title: 'XID Fault Recovery',
    desc: 'Route correction required: XID fault-family checkpoint',
    commands: [
      'journalctl -k | grep -i xid',
      'nvidia-smi -q -x',
      'dcgmi diag -g 0 -r 1',
    ],
    checks: [
      'Re-classify the fault family before choosing reset, containment, or hardware escalation.',
      'Use the exact XID evidence, not a generic GPU-failure label.',
      'Do not continue until the blast radius is under control.',
    ],
    terminal: [
      '[detour] The driver fault code is being reclassified before recovery proceeds.',
      '[detour] Containment and fault-family ownership are required before the next stage.',
      '[detour] The lab remains in incident mode until the XID path is narrowed again.',
    ],
  },
  nvlink: {
    title: 'NVLink Topology Recovery',
    desc: 'Route correction required: NVLink baseline checkpoint',
    commands: [
      'nvidia-smi topo -m',
      'nvidia-smi nvlink -e',
      'NCCL_DEBUG=INFO ./all_reduce_perf',
    ],
    checks: [
      'Rebuild the healthy topology baseline before tuning collectives.',
      'Hold path shape and link integrity together.',
      'Do not advance on throughput alone if the topology story is still wrong.',
    ],
    terminal: [
      '[detour] Topology and NVLink integrity are being re-baselined.',
      '[detour] The fast path must be visible before the simulator allows the next stage.',
      '[detour] The lab is waiting for a clean NVLink read, not only a performance guess.',
    ],
  },
  nccl_fallback: {
    title: 'NCCL Fallback Recovery',
    desc: 'Route correction required: transport-selection checkpoint',
    commands: [
      'env | grep NCCL',
      'ibstat',
      'NCCL_DEBUG=INFO ./all_reduce_perf',
    ],
    checks: [
      'Re-check environment overrides before blaming the fabric.',
      'Confirm the selected transport path and the achieved bandwidth together.',
      'Do not move forward while TCP fallback is still unowned.',
    ],
    terminal: [
      '[detour] NCCL environment and transport selection are being re-read.',
      '[detour] The fallback route must be explained before the next stage opens.',
      '[detour] The lab is holding on the communication path, not on workload tuning.',
    ],
  },
  storage: {
    title: 'Storage Starvation Recovery',
    desc: 'Route correction required: data-path checkpoint',
    commands: [
      'iostat -x 1 3',
      'lfs getstripe /datasets/train',
      'nvidia-smi dmon -s pucm',
    ],
    checks: [
      'Re-read the storage feed path before touching GPU settings.',
      'Pair the storage metrics with the utilization pattern.',
      'Do not continue until the starvation owner is explicit.',
    ],
    terminal: [
      '[detour] Storage throughput and GPU starvation evidence are being compared again.',
      '[detour] The simulator is forcing the bottleneck back upstream before the next step.',
      '[detour] The lab will not advance on accelerator tuning while the feed path stays unresolved.',
    ],
  },
  slurm: {
    title: 'Slurm Scheduling Recovery',
    desc: 'Route correction required: scheduler-state checkpoint',
    commands: [
      'squeue',
      'scontrol show job <id>',
      'sshare',
    ],
    checks: [
      'Re-separate policy delay from node-health delay.',
      'Confirm whether the scheduler is waiting on fairshare, reservation, or drain state.',
      'Do not continue while policy and hardware clues are still mixed together.',
    ],
    terminal: [
      '[detour] Scheduler state is being re-read before any hardware conclusion is accepted.',
      '[detour] Slurm policy and node health must be separated before the next stage.',
      '[detour] The lab is holding on allocation reasoning, not only queue frustration.',
    ],
  },
  k8s: {
    title: 'Kubernetes GPU Recovery',
    desc: 'Route correction required: pod-placement checkpoint',
    commands: [
      'kubectl describe pod <name>',
      'kubectl describe node gpu-node-01',
      'kubectl get pods -A -o wide',
    ],
    checks: [
      'Re-check resource request, device exposure, and node state separately.',
      'Do not collapse scheduling and runtime problems into one label.',
      'Advance only when the placement failure has a clear owner.',
    ],
    terminal: [
      '[detour] Pod placement and node GPU exposure are being separated again.',
      '[detour] The lab requires a cleaner Kubernetes ownership call before the next stage.',
      '[detour] Device plumbing and scheduling state must agree before progression resumes.',
    ],
  },
  fault_isolation: {
    title: 'Containment Recovery',
    desc: 'Route correction required: containment checkpoint',
    commands: [
      'kubectl cordon gpu-node-01',
      'dcgmi diag -g 0 -r 1',
      'journalctl -k | grep -i xid',
    ],
    checks: [
      'Stop new placement before touching remediation.',
      'Capture the current fault evidence again so support still has a clean trail.',
      'Do not resume normal flow until the node is in a controlled state.',
    ],
    terminal: [
      '[detour] Node scheduling has been restricted.',
      '[detour] Hardware-integrity evidence has been re-collected for review.',
      '[detour] Normal progression remains blocked until containment is re-established.',
    ],
  },
  fabric_path: {
    title: 'Transport Recovery',
    desc: 'Route correction required: path verification checkpoint',
    commands: [
      'env | grep NCCL',
      'ibstat',
      'NCCL_DEBUG=INFO ./all_reduce_perf',
    ],
    checks: [
      'Prove the selected transport path before tuning the workload.',
      'Re-read the fabric state and throughput together.',
      'Clear the wrong-layer tuning loop before continuing.',
    ],
    terminal: [
      '[detour] Transport-selection evidence is being re-validated.',
      '[detour] Fabric state and collective path must agree before the next stage.',
      '[detour] The lab will not advance on model tuning alone.',
    ],
  },
  runtime_delivery: {
    title: 'Stack Boundary Recovery',
    desc: 'Route correction required: layer boundary checkpoint',
    commands: [
      'nvidia-smi',
      'python -c "import torch; print(torch.cuda.is_available())"',
      'docker run --gpus all nvcr.io/... nvidia-smi',
    ],
    checks: [
      'Re-establish the failing handoff boundary before any broad rebuild.',
      'Keep driver, runtime, framework, and container checks separate.',
      'Only continue once one layer clearly owns the failure.',
    ],
    terminal: [
      '[detour] Layer ownership is being narrowed again.',
      '[detour] Broad stack changes remain blocked until the contract boundary is clear.',
      '[detour] The next stage depends on a specific layer call, not a generic failure label.',
    ],
  },
  platform_efficiency: {
    title: 'Feed Path Recovery',
    desc: 'Route correction required: upstream bottleneck checkpoint',
    commands: [
      'iostat -x 1 3',
      'lfs getstripe /datasets/train',
      'nvidia-smi dmon -s pucm',
    ],
    checks: [
      'Re-check the feed path before changing compute behavior.',
      'Hold storage and GPU evidence side by side.',
      'Do not continue until the bottleneck owner is visible.',
    ],
    terminal: [
      '[detour] Upstream delivery evidence is being compared against GPU behavior.',
      '[detour] Compute tuning remains blocked until the starvation path is re-read.',
      '[detour] The next stage requires a cleaner bottleneck call.',
    ],
  },
  general_diagnosis: {
    title: 'Evidence Recovery',
    desc: 'Route correction required: ambiguity checkpoint',
    commands: [
      'collect one stronger clue',
      'compare output with the previous healthy baseline',
    ],
    checks: [
      'Resolve the ambiguity before continuing.',
      'Prefer one decisive clue over several weak guesses.',
    ],
    terminal: [
      '[detour] The earlier explanation was not strong enough to advance cleanly.',
      '[detour] A stronger clue is required before the next stage can open.',
    ],
  },
};

function authHdr() {
  return JWT_TOKEN ? { 'Authorization': 'Bearer ' + JWT_TOKEN } : {};
}

function loadReasoningProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem('gpusim_reasoning_progress') || '{}');
    return {
      steps: parsed.steps || {},
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      completion: parsed.completion || {},
    };
  } catch (e) {
    localStorage.removeItem('gpusim_reasoning_progress');
    return { steps: {}, quizzes: [], completion: {} };
  }
}

function loadBranchingState() {
  try {
    const parsed = JSON.parse(localStorage.getItem('gpusim_branching_state') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    localStorage.removeItem('gpusim_branching_state');
    return {};
  }
}

function showLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'flex';
}
function hideLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'none';
}

async function aegisLogin() {
  const u = (document.getElementById('login-user') || {}).value?.trim() || '';
  const p = (document.getElementById('login-pass') || {}).value || '';
  const errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  try {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await r.json();
    if (!r.ok) {
      if (errEl) { errEl.textContent = data.detail || 'Login failed.'; errEl.style.display = 'block'; }
      return;
    }
    JWT_TOKEN = data.token;
    USER_ROLE  = data.role;
    sessionStorage.setItem('aegis_jwt', JWT_TOKEN);
    sessionStorage.setItem('aegis_role', USER_ROLE);
    hideLoginOverlay();
    initApp();
  } catch(e) {
    if (errEl) { errEl.textContent = 'Connection error. Is the backend reachable?'; errEl.style.display = 'block'; }
  }
}

function aegisLogout() {
  JWT_TOKEN = '';
  USER_ROLE  = '';
  sessionStorage.removeItem('aegis_jwt');
  sessionStorage.removeItem('aegis_role');
  if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
  appMode = 'simulation';
  ['toggle-live','sidebar-toggle-live','quiz-toggle-live'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  showLoginOverlay();
}

function handle401() {
  logTerm([{t:'err', v:'[AUTH] Session expired or unauthorised. Please log in again.'}]);
  setTimeout(aegisLogout, 1500);
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tightenDisplayCopy(value) {
  let text = String(value ?? '').trim();
  if (!text) return '';

  const replacements = [
    [/^Use the [^.]+ snapshot to /i, 'Use the snapshot to '],
    [/^Use the [^.]+ snapshot as /i, 'Use the snapshot as '],
    [/^Treat the [^.]+ snapshot as /i, 'Treat the snapshot as '],
    [/^Read the [^.]+ snapshot as /i, 'Read the snapshot as '],
    [/^Compare this [^.]+ snapshot against the [^.]+ screenshot\.\s*/i, 'Compare this snapshot with the earlier baseline. '],
    [/\bThe key clue is that\b/gi, ''],
    [/\bThe key clue is\b/gi, ''],
    [/\bThe key thing is that\b/gi, ''],
    [/\bThe key thing is\b/gi, ''],
    [/\bThe important thing is that\b/gi, ''],
    [/\bThe important thing is\b/gi, ''],
    [/\bThe important move is\b/gi, ''],
    [/\bThe important cue is\b/gi, ''],
    [/\bThe value is\b/gi, ''],
    [/\bIt is not\.\s+/g, ''],
    [/\bThat is why\b/gi, 'So'],
    [/\s{2,}/g, ' '],
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  text = text.replace(/\.\s*\./g, '.').replace(/\s+,/g, ',').trim();
  text = text.replace(/^,\s*/, '');
  return text;
}

function getReasoningDomain(labId, step) {
  if (['ecc', 'nvlink_fault'].includes(labId) || ['xid48', 'xid48_confirm', 'xid79', 'xid74', 'ecc_xid'].includes(step?.type)) return 'fault_isolation';
  if (['nvlink', 'allreduce', 'nccl_fallback', 'ib_fabric', 'roce'].includes(labId)) return 'fabric_path';
  if (['cuda_stack', 'container', 'training', 'k8s', 'slurm'].includes(labId)) return 'runtime_delivery';
  if (['storage', 'gds', 'monitoring'].includes(labId)) return 'platform_efficiency';
  return 'general_diagnosis';
}

function getReasoningScorecardContext(labId, step) {
  const guide = labId ? getLearningGuide(labId) : null;
  const output = step ? getStepOutput(step) : [];
  const hasCounters = output.some(line => /dcgm|ecc|dbe|sbe|crc/i.test(line?.v || ''));
  const hasLogs = output.some(line => /xid|nvrm|dmesg|socket|fallback/i.test(line?.v || ''));
  const hasScheduler = output.some(line => /pending|fairshare|drain|nvidia\.com\/gpu|pod/i.test(line?.v || ''));
  const hasScreenshots = !!(step?.screenshots && step.screenshots.length);
  const safeActionPresent = !!(step?.takeAction?.length || guide?.safeActions?.length);

  const categories = [
    {
      key: 'layer',
      label: 'Layer call',
      status: step?.fault ? 'strong' : 'good',
      text: step?.fault
        ? 'This step clearly belongs to a fault family, so the user should identify the owning layer before touching remediation.'
        : 'This step should let the user name the owning layer before jumping to commands or tuning.',
    },
    {
      key: 'evidence',
      label: 'Evidence quality',
      status: hasCounters || hasLogs || hasScheduler ? 'strong' : hasScreenshots ? 'good' : 'watch',
      text: hasCounters || hasLogs || hasScheduler
        ? 'The current view provides explicit evidence, so the diagnosis should be grounded in what changed on screen.'
        : hasScreenshots
          ? 'The screenshot is useful, but the user should still tie it back to the step goal before concluding.'
          : 'This step is lighter on explicit evidence, so conclusions should stay narrow.',
    },
    {
      key: 'safety',
      label: 'Action safety',
      status: safeActionPresent ? 'good' : 'watch',
      text: safeActionPresent
        ? 'A safe next action is available here. Good reasoning means choosing the narrowest justified move.'
        : 'No strong action cue is present here, so the user should stay in observation mode.',
    },
  ];

  const score = categories.reduce((total, item) => total + (item.status === 'strong' ? 2 : item.status === 'good' ? 1 : 0), 0);
  return {
    domain: getReasoningDomain(labId, step),
    score,
    maxScore: categories.length * 2,
    categories,
  };
}

function renderReasoningScorecard(scorecard, options = {}) {
  if (!scorecard) return '';
  const title = options.title || 'Reasoning Scorecard';
  const subtitle = options.subtitle || 'How Aegis is grading the quality of the diagnosis, not just task completion.';
  return `
    <section class="reasoning-scorecard">
      <div class="reasoning-scorecard-top">
        <div>
          <div class="reasoning-scorecard-title">${escHtml(title)}</div>
          <div class="reasoning-scorecard-subtitle">${escHtml(subtitle)}</div>
        </div>
        <div class="reasoning-scorecard-total">
          <span>${scorecard.score}/${scorecard.maxScore}</span>
          <small>${escHtml(scorecard.domain.replace(/_/g, ' '))}</small>
        </div>
      </div>
      <div class="reasoning-scorecard-grid">
        ${scorecard.categories.map(item => `
          <article class="reasoning-card reasoning-card-${escHtml(item.status)}">
            <div class="reasoning-card-head">
              <span>${escHtml(item.label)}</span>
              <strong>${item.status === 'strong' ? 'Strong' : item.status === 'good' ? 'Good' : 'Watch'}</strong>
            </div>
            <p>${escHtml(tightenDisplayCopy(item.text))}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function getReasoningStatusValue(status) {
  return status === 'strong' ? 2 : status === 'good' ? 1 : 0;
}

function persistBranchingState() {
  localStorage.setItem('gpusim_branching_state', JSON.stringify(branchingState));
}

function persistReasoningProgress() {
  localStorage.setItem('gpusim_reasoning_progress', JSON.stringify(reasoningProgress));
}

function getReasoningProgressSummary() {
  const stepEntries = Object.values(reasoningProgress.steps || {});
  const categoryTotals = {};
  let totalScore = 0;
  let totalMax = 0;
  let cleanLabs = 0;
  let compromisedLabs = 0;

  stepEntries.forEach(entry => {
    totalScore += entry.score || 0;
    totalMax += entry.maxScore || 0;
    (entry.categories || []).forEach(category => {
      if (!categoryTotals[category.key]) categoryTotals[category.key] = { total: 0, max: 0, count: 0, label: category.label };
      categoryTotals[category.key].total += category.value;
      categoryTotals[category.key].max += 2;
      categoryTotals[category.key].count += 1;
    });
  });

  const categoryAverages = Object.entries(categoryTotals).map(([key, value]) => ({
    key,
    label: value.label,
    pct: value.max ? Math.round((value.total / value.max) * 100) : 0,
  }));
  const completionEntries = Object.values(reasoningProgress.completion || {});
  completionEntries.forEach(entry => {
    if (entry.clean) cleanLabs += 1;
    else compromisedLabs += 1;
  });
  const quizAttempts = reasoningProgress.quizzes || [];
  const lastQuiz = quizAttempts.length ? quizAttempts[quizAttempts.length - 1] : null;
  const avgQuiz = quizAttempts.length
    ? Math.round(quizAttempts.reduce((sum, item) => sum + item.pct, 0) / quizAttempts.length)
    : null;

  return {
    judgmentPct: totalMax ? Math.round((totalScore / totalMax) * 100) : null,
    completedSteps: stepEntries.length,
    categoryAverages,
    lastQuizPct: lastQuiz ? lastQuiz.pct : null,
    avgQuizPct: avgQuiz,
    quizAttempts: quizAttempts.length,
    cleanLabs,
    compromisedLabs,
  };
}

function updateReasoningProgressUI() {
  const summary = getReasoningProgressSummary();
  const el = document.getElementById('h-judgment');
  if (el) el.textContent = summary.judgmentPct === null ? '—' : `${summary.judgmentPct}%`;
}

function recordLabReasoningProgress(labId, stepIdx, scorecard) {
  if (!labId || typeof stepIdx !== 'number' || !scorecard) return;
  const branchContext = getBranchConsequenceContext(labId, stepIdx);
  const penalty = Math.min(branchContext.badCount * 2 + branchContext.warnCount, scorecard.maxScore - 1);
  const adjustedScore = Math.max(scorecard.score - penalty, 0);
  reasoningProgress.steps[`${labId}:${stepIdx}`] = {
    score: adjustedScore,
    maxScore: scorecard.maxScore,
    penalty,
    categories: scorecard.categories.map(category => ({
      key: category.key,
      label: category.label,
      value: Math.max(getReasoningStatusValue(category.status) - (category.key === 'safety' ? Math.min(branchContext.badCount + branchContext.warnCount, 2) : 0), 0),
    })),
  };
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function recordLabCompletionOutcome(labId, clean) {
  if (!reasoningProgress.completion) reasoningProgress.completion = {};
  reasoningProgress.completion[labId] = {
    clean: !!clean,
    ts: Date.now(),
  };
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function isLabCompletionClean(labId) {
  const context = getBranchConsequenceContext(labId, Number.POSITIVE_INFINITY);
  return !context.badCount && !context.warnCount;
}

function recordQuizReasoningProgress(pct, scorecard) {
  reasoningProgress.quizzes.push({
    pct,
    score: scorecard?.score || 0,
    maxScore: scorecard?.maxScore || 0,
    ts: Date.now(),
  });
  reasoningProgress.quizzes = reasoningProgress.quizzes.slice(-20);
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function renderReasoningProgressSummary() {
  const summary = getReasoningProgressSummary();
  if (summary.judgmentPct === null && summary.lastQuizPct === null) return '';
  return `
    <section class="learn-section study-progress">
      <div class="learn-heading-row">
        <h4>Reasoning Progress</h4>
        <span class="learn-mode-tag">v3 analytics</span>
      </div>
      <div class="study-progress-grid">
        <article class="study-progress-card">
          <div class="study-mini-title">Troubleshooting judgment</div>
          <div class="study-progress-value">${summary.judgmentPct === null ? '—' : `${summary.judgmentPct}%`}</div>
          <p>${summary.completedSteps} guided steps have stored reasoning snapshots.</p>
        </article>
        <article class="study-progress-card">
          <div class="study-mini-title">Quiz accuracy</div>
          <div class="study-progress-value">${summary.lastQuizPct === null ? '—' : `${summary.lastQuizPct}%`}</div>
          <p>${summary.quizAttempts ? `Average across ${summary.quizAttempts} attempts: ${summary.avgQuizPct}%.` : 'No quiz attempt recorded yet.'}</p>
        </article>
        <article class="study-progress-card">
          <div class="study-mini-title">Clean incident finishes</div>
          <div class="study-progress-value">${summary.cleanLabs}</div>
          <p>${summary.compromisedLabs ? `${summary.compromisedLabs} labs reached the end with branch penalties still active.` : 'No compromised completions recorded.'}</p>
        </article>
      </div>
      ${summary.categoryAverages.length ? `
        <div class="study-progress-breakdown">
          ${summary.categoryAverages.map(item => `
            <div class="study-progress-chip">
              <strong>${escHtml(item.label)}</strong>
              <span>${item.pct}%</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function getBranchingFamily(labId, step) {
  return getReasoningDomain(labId, step);
}

function getBranchingKey(labId, stepIdx) {
  return `${labId}:${stepIdx}`;
}

function getBranchMetaKey(labId, stepIdx, suffix) {
  return `${labId}:${stepIdx}:${suffix}`;
}

function getConsequenceBranch(labId, step) {
  return CONSEQUENCE_BRANCHES[getBranchingFamily(labId, step)] || CONSEQUENCE_BRANCHES.general_diagnosis;
}

function getSelectedBranchChoice(labId, stepIdx) {
  if (!labId || typeof stepIdx !== 'number' || stepIdx < 0) return null;
  const step = LABS[labId]?.steps?.[stepIdx];
  const branch = getConsequenceBranch(labId, step);
  const choiceId = branchingState[getBranchingKey(labId, stepIdx)];
  return branch.choices.find(item => item.id === choiceId) || null;
}

function getSelectedBranchChoicesForLab(labId, maxStepIdx = Infinity) {
  const results = [];
  Object.entries(branchingState).forEach(([key, choiceId]) => {
    const [entryLab, rawStep] = key.split(':');
    const stepIdx = Number(rawStep);
    if (entryLab !== labId || Number.isNaN(stepIdx) || stepIdx >= maxStepIdx) return;
    const step = LABS[labId]?.steps?.[stepIdx];
    const branch = getConsequenceBranch(labId, step);
    const choice = branch.choices.find(item => item.id === choiceId);
    if (choice) results.push({ stepIdx, choice, domain: getBranchingFamily(labId, step) });
  });
  return results.sort((a, b) => a.stepIdx - b.stepIdx);
}

function getBranchConsequenceContext(labId, stepIdx) {
  const priorChoices = getSelectedBranchChoicesForLab(labId, stepIdx);
  const badCount = priorChoices.filter(item => item.choice.effect === 'bad').length;
  const warnCount = priorChoices.filter(item => item.choice.effect === 'warn').length;
  const bestCount = priorChoices.filter(item => item.choice.effect === 'best').length;
  const dominantDomain = priorChoices.length ? priorChoices[priorChoices.length - 1].domain : null;
  return {
    priorChoices,
    badCount,
    warnCount,
    bestCount,
    hasPenalty: badCount > 0 || warnCount > 0,
    dominantDomain,
  };
}

function getBranchPenaltyMessages(labId, stepIdx) {
  const context = getBranchConsequenceContext(labId, stepIdx);
  if (!context.hasPenalty) return [];
  const messages = [];
  if (context.dominantDomain === 'fault_isolation') {
    if (context.badCount) messages.push('[branch] Earlier broad changes delayed containment. Fresh jobs kept landing on unstable hardware.');
    else messages.push('[branch] Earlier hesitation left the fault visible longer than necessary. The node stayed exposed to additional workload risk.');
  } else if (context.dominantDomain === 'fabric_path') {
    if (context.badCount) messages.push('[branch] The fast path stayed unresolved. Collective traffic kept using the degraded route and cluster time was lost.');
    else messages.push('[branch] The path issue was not narrowed quickly. Throughput stayed soft while the wrong layer absorbed attention.');
  } else if (context.dominantDomain === 'runtime_delivery') {
    if (context.badCount) messages.push('[branch] Broad stack changes blurred the fault boundary. Recovery is now slower because the original mismatch evidence was disturbed.');
    else messages.push('[branch] The runtime boundary stayed ambiguous, so later steps still carry unresolved contract risk.');
  } else if (context.dominantDomain === 'platform_efficiency') {
    if (context.badCount) messages.push('[branch] Compute settings were changed before the feed path was fixed. GPU efficiency remains degraded and the bottleneck still leaks upstream.');
    else messages.push('[branch] Upstream starvation was not cleared early, so the node continues to waste accelerator time.');
  } else {
    messages.push('[branch] Earlier choices left the incident less controlled, so the current step carries more ambiguity and operational drag.');
  }
  return messages;
}

function isBranchDetourPending(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  if (!choice || choice.effect === 'best') return false;
  return branchingState[getBranchMetaKey(labId, stepIdx, 'detour_done')] !== true;
}

function markBranchDetourDone(labId, stepIdx) {
  branchingState[getBranchMetaKey(labId, stepIdx, 'detour_done')] = true;
  persistBranchingState();
}

function getBranchDetourMessage(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  const domain = getBranchConsequenceContext(labId, stepIdx).dominantDomain;
  if (!choice) return null;
  if (domain === 'fault_isolation') {
    return choice.effect === 'bad'
      ? 'Recovery detour: re-establish containment, stop new workload placement, and rebuild the evidence trail before advancing.'
      : 'Recovery detour: confirm containment now so the next step starts from a controlled incident state.';
  }
  if (domain === 'fabric_path') {
    return choice.effect === 'bad'
      ? 'Recovery detour: verify the transport path and clear the wrong-layer tuning loop before the lab proceeds.'
      : 'Recovery detour: confirm the communication route so the next stage is grounded in path evidence instead of guesswork.';
  }
  if (domain === 'runtime_delivery') {
    return choice.effect === 'bad'
      ? 'Recovery detour: re-narrow the broken boundary before any more stack changes accumulate.'
      : 'Recovery detour: validate the software contract edge so the next step is not built on a vague layer call.';
  }
  if (domain === 'platform_efficiency') {
    return choice.effect === 'bad'
      ? 'Recovery detour: trace the feed path first and stop treating compute settings as the primary fix.'
      : 'Recovery detour: re-check the upstream bottleneck so the next stage is not measured on a distorted baseline.';
  }
  return choice.effect === 'bad'
    ? 'Recovery detour: collect a stronger clue and unwind the earlier over-broad move before continuing.'
    : 'Recovery detour: resolve the ambiguity before the lab advances.';
}

function getBranchDetourPlaybook(labId, stepIdx) {
  if (BRANCH_DETOUR_PLAYBOOKS[labId]) return BRANCH_DETOUR_PLAYBOOKS[labId];
  const domain = getBranchConsequenceContext(labId, stepIdx).dominantDomain || 'general_diagnosis';
  return BRANCH_DETOUR_PLAYBOOKS[domain] || BRANCH_DETOUR_PLAYBOOKS.general_diagnosis;
}

function renderBranchRouteStatus(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  if (!choice) return '';
  const pending = isBranchDetourPending(labId, stepIdx);
  const playbook = getBranchDetourPlaybook(labId, stepIdx);
  return `
    <section class="branch-route-status">
      <div class="branch-route-status-title">${pending ? 'Route Change Pending' : 'Route Change Recorded'}</div>
      <p><strong>${escHtml(playbook.title)}</strong></p>
      <p>${escHtml(getBranchDetourMessage(labId, stepIdx) || '')}</p>
      <p>${escHtml(pending ? 'The next Run will go through a recovery detour before the lab advances.' : 'A recovery detour was required before this lab could continue normally.')}</p>
    </section>
  `;
}

function chooseIncidentBranch(labId, stepIdx, choiceId) {
  if (!labId || typeof stepIdx !== 'number' || !choiceId) return;
  branchingState[getBranchingKey(labId, stepIdx)] = choiceId;
  persistBranchingState();
  renderLabStepCoach();
}

function renderConsequenceBranch(labId, step, stepIdx, options = {}) {
  if (!labId || typeof stepIdx !== 'number' || !step) return '';
  const branch = getConsequenceBranch(labId, step);
  const selectedId = branchingState[getBranchingKey(labId, stepIdx)];
  const selectedChoice = branch.choices.find(item => item.id === selectedId) || null;
  const title = options.title || 'Decision Drill';
  const subtitle = options.subtitle || 'Choose the next move. Aegis will show what that operator choice does to the incident, not just whether it sounds plausible.';
  return `
    <section class="consequence-branch">
      <div class="consequence-branch-title">${escHtml(title)}</div>
      <div class="consequence-branch-subtitle">${escHtml(subtitle)}</div>
      <div class="consequence-branch-prompt">${escHtml(branch.prompt)}</div>
      <div class="consequence-branch-grid">
        ${branch.choices.map(choice => `
          <button
            type="button"
            class="consequence-choice${selectedId === choice.id ? ' is-selected' : ''}"
            data-branch-choice="${escHtml(choice.id)}"
            data-branch-lab="${escHtml(labId)}"
            data-branch-step="${stepIdx}"
          >
            <span>${escHtml(choice.label)}</span>
          </button>
        `).join('')}
      </div>
      ${selectedChoice ? `
        <div class="consequence-outcome consequence-outcome-${escHtml(selectedChoice.effect)}">
          <div class="consequence-outcome-title">${selectedChoice.effect === 'best' ? 'Operational Result' : selectedChoice.effect === 'warn' ? 'Operational Risk' : 'Operational Consequence'}</div>
          <p>${escHtml(tightenDisplayCopy(selectedChoice.outcome))}</p>
        </div>
      ` : `
        <div class="consequence-outcome consequence-outcome-idle">
          <div class="consequence-outcome-title">Make the call</div>
          <p>Pick one path to see the downstream operational consequence.</p>
        </div>
      `}
    </section>
  `;
}

function runBranchDetour(labId, stepIdx) {
  const lab = LABS[labId];
  const choice = getSelectedBranchChoice(labId, stepIdx);
  const playbook = getBranchDetourPlaybook(labId, stepIdx);
  if (!lab || !choice) return false;

  switchTab('term');
  clearTerminal();
  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Recovery detour after Step ${stepIdx + 1}/${lab.steps.length}`;
  document.getElementById('scen-desc').textContent = playbook.desc;
  logTerm([{ t: 'warn', v: `# ${playbook.title}` }]);
  playbook.commands.forEach(cmd => logTerm([{ t: 'cmd', v: cmd }]));
  logTerm([{ t: 'warn', v: getBranchDetourMessage(labId, stepIdx) || 'Recovery detour in progress.' }]);
  playbook.terminal.forEach(line => logTerm([{ t: 'dim', v: line }]));
  scrollTerminal();

  const log = document.getElementById('xid-log-entries');
  if (log) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = `xid-entry ${choice.effect === 'bad' ? 'crit' : 'warn'}`;
    entry.textContent = `[${time}] ${playbook.title} inserted before the next stage`;
    log.prepend(entry);
    while (log.children.length > 8) log.removeChild(log.lastChild);
  }

  markBranchDetourDone(labId, stepIdx);
  renderLabStepCoach();
  return true;
}

function getDifferentialDiagnosisEntries(labId, step) {
  const entries = DIFFERENTIAL_DIAGNOSIS[labId] || [];
  if (!entries.length) return [];
  if (!step?.fault) return entries;
  return entries.slice(0, 2);
}

function renderDifferentialDiagnosis(labId, step, options = {}) {
  const entries = getDifferentialDiagnosisEntries(labId, step);
  if (!entries.length) return '';
  const title = options.title || 'Differential Diagnosis';
  const subtitle = options.subtitle || 'Use these comparisons to keep the fault in the right layer and avoid the nearby wrong path.';
  return `
    <section class="differential-diagnosis">
      <div class="differential-diagnosis-top">
        <div class="differential-diagnosis-title">${escHtml(title)}</div>
        <div class="differential-diagnosis-subtitle">${escHtml(subtitle)}</div>
      </div>
      <div class="differential-diagnosis-grid">
        ${entries.map(entry => `
          <article class="diagnosis-card">
            <div class="diagnosis-card-title">${escHtml(entry.label)}</div>
            <p><strong>Not this:</strong> ${escHtml(tightenDisplayCopy(entry.not))}</p>
            <p><strong>Read instead:</strong> ${escHtml(tightenDisplayCopy(entry.why))}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function getIncidentModeContext(labId, step) {
  const guide = labId ? getLearningGuide(labId) : null;
  const clues = step ? getKeyOutputClues(step).slice(0, 2).map(item => item.text) : [];
  const observations = step?.lookFor?.slice(0, 2) || [];
  const evidence = clues.length ? clues : observations.length ? observations : (guide?.watchFor || []).slice(0, 2);
  const safeMove = step?.takeAction?.[0] || guide?.safeActions?.[0] || 'Keep the node in observation mode until the owning layer is clear.';
  const unproven = step?.stillPremature || guide?.commonMisreads?.[0] || 'Do not collapse this incident into the first explanation that sounds plausible.';
  const brief = step?.fault
    ? 'Treat this stage as an active incident signal: preserve the evidence, isolate the owning layer, and avoid broad fixes.'
    : 'Treat this stage as an incident baseline: decide what looks healthy now so later degradation is easier to justify.';
  return { evidence, safeMove, unproven, brief };
}

function renderIncidentModeBrief(labId, step, options = {}) {
  const context = getIncidentModeContext(labId, step);
  const title = options.title || 'Incident Brief';
  const subtitle = options.subtitle || 'Reduced guidance mode: what is known, what is still open, and the next safe move.';
  return `
    <section class="incident-brief">
      <div class="incident-brief-title">${escHtml(title)}</div>
      <div class="incident-brief-subtitle">${escHtml(subtitle)}</div>
      <div class="incident-brief-grid">
        <article class="incident-brief-card">
          <div class="incident-brief-card-title">Known Now</div>
          ${renderBulletList(context.evidence.length ? context.evidence : ['Collect one confirming clue before deciding the fault family.'], 'incident-brief-list')}
        </article>
        <article class="incident-brief-card">
          <div class="incident-brief-card-title">Still Unproven</div>
          <p>${escHtml(tightenDisplayCopy(context.unproven))}</p>
        </article>
        <article class="incident-brief-card">
          <div class="incident-brief-card-title">Next Safe Move</div>
          <p>${escHtml(tightenDisplayCopy(context.safeMove))}</p>
          <p>${escHtml(tightenDisplayCopy(context.brief))}</p>
        </article>
      </div>
    </section>
  `;
}

function getLearningGuide(id) {
  const guides = window.AEGIS_LEARNING || {};
  return guides[id] || null;
}

function getExplainEngine() {
  return window.AEGIS_EXPLAINER || null;
}

function getExplanationOptions() {
  return {
    beginnerMode,
    incidentMode,
    level: explanationLevel,
    role: explanationRole,
  };
}

function syncBeginnerModeUI() {
  const toggle = document.getElementById('toggle-beginner');
  if (toggle) toggle.checked = beginnerMode;
  const incidentToggle = document.getElementById('toggle-incident-mode');
  if (incidentToggle) incidentToggle.checked = incidentMode;
  const levelSel = document.getElementById('sel-explain-level');
  if (levelSel) levelSel.value = explanationLevel;
  const roleSel = document.getElementById('sel-explain-role');
  if (roleSel) roleSel.value = explanationRole;
  const llmToggle = document.getElementById('toggle-llm-diagnosis');
  if (llmToggle) {
    llmToggle.checked = llmDiagnosisEnabled && backendLLMAvailable;
    llmToggle.disabled = !backendLLMAvailable;
    llmToggle.title = backendLLMAvailable
      ? `LLM-backed diagnosis is available via ${backendLLMMode}.`
      : 'Backend is currently using deterministic runbooks only.';
  }
  const coachBtn = document.getElementById('btn-toggle-coach');
  if (coachBtn) coachBtn.classList.toggle('active', labCoachOpen);
  syncDetachedPanelButtons();
  const learnBtn = document.getElementById('btn-learn');
  if (learnBtn) {
    const engine = getExplainEngine();
    const level = engine ? engine.getLevel(explanationLevel).label : explanationLevel;
    learnBtn.textContent = beginnerMode ? `📘 ${level} Guide` : '📘 Lab Brief';
  }
}

function refreshExplanationSurfaces() {
  if (currentLab && document.getElementById('intro-overlay')?.classList.contains('show')) showIntro(currentLab);
  if (appMode === 'live') renderBeginnerTelemetryExplanation(lastLiveTelemetry);
  renderLabStepCoach();
}

function setBeginnerMode(enabled) {
  beginnerMode = !!enabled;
  localStorage.setItem('gpusim_beginner_mode', beginnerMode ? 'true' : 'false');
  syncBeginnerModeUI();
  refreshExplanationSurfaces();
}

function setIncidentMode(enabled) {
  incidentMode = !!enabled;
  localStorage.setItem('gpusim_incident_mode', incidentMode ? 'true' : 'false');
  syncBeginnerModeUI();
  refreshExplanationSurfaces();
}

function setExplanationLevel(level) {
  explanationLevel = level || 'beginner';
  localStorage.setItem('gpusim_explain_level', explanationLevel);
  syncBeginnerModeUI();
  refreshExplanationSurfaces();
}

function setExplanationRole(role) {
  explanationRole = role || 'cluster_operator';
  localStorage.setItem('gpusim_explain_role', explanationRole);
  syncBeginnerModeUI();
  refreshExplanationSurfaces();
}

function setLLMDiagnosisEnabled(enabled) {
  llmDiagnosisEnabled = !!enabled;
  localStorage.setItem('gpusim_allow_llm_diagnosis', llmDiagnosisEnabled ? 'true' : 'false');
  syncBeginnerModeUI();
}

function setBackendLLMCapability(mode, available) {
  backendLLMMode = mode || 'deterministic';
  backendLLMAvailable = !!available;
  syncBeginnerModeUI();
}

function setLabCoachOpen(open) {
  labCoachOpen = !!open;
  localStorage.setItem('gpusim_lab_coach_open', labCoachOpen ? 'true' : 'false');
  syncBeginnerModeUI();
  renderLabStepCoach();
}

function toggleLabCoach() {
  setLabCoachOpen(!labCoachOpen);
}

function handleLabCoachClick(event) {
  if (event.target.closest('#btn-close-coach') || event.target.closest('.lab-step-coach-close')) {
    event.preventDefault();
    event.stopPropagation();
    setLabCoachOpen(false);
    return;
  }

  const choice = event.target.closest('[data-branch-choice]');
  if (choice) {
    event.preventDefault();
    event.stopPropagation();
    chooseIncidentBranch(choice.dataset.branchLab, Number(choice.dataset.branchStep), choice.dataset.branchChoice);
  }
}

function renderBulletList(items, cssClass) {
  if (!items || !items.length) return '';
  return `<ul class="${cssClass}">${items.map(item => `<li>${escHtml(tightenDisplayCopy(item))}</li>`).join('')}</ul>`;
}

function renderParagraphs(items) {
  if (!items || !items.length) return '';
  return items.map(item => `<p>${escHtml(tightenDisplayCopy(item))}</p>`).join('');
}

function isDetachedPanelOpen(kind) {
  const win = detachedPanels[kind];
  return !!(win && !win.closed);
}

function syncDetachedPanelButtons() {
  const liveBtn = document.getElementById('btn-popout-live-explainer');
  if (liveBtn) {
    liveBtn.classList.toggle('active', isDetachedPanelOpen('liveExplainer'));
    liveBtn.textContent = isDetachedPanelOpen('liveExplainer') ? 'Detached' : 'Pop out';
  }
  const coachBtn = document.getElementById('btn-popout-coach');
  if (coachBtn) {
    coachBtn.classList.toggle('active', isDetachedPanelOpen('stepCoach'));
    coachBtn.textContent = isDetachedPanelOpen('stepCoach') ? 'Detached' : 'Pop out';
  }
  ['introOverlay', 'studyOverlay', 'quizOverlay'].forEach(kind => {
    const id = kind === 'introOverlay'
      ? 'btn-popout-intro'
      : kind === 'studyOverlay'
        ? 'btn-popout-study'
        : 'btn-popout-quiz';
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('active', isDetachedPanelOpen(kind));
    btn.textContent = isDetachedPanelOpen(kind) ? 'Detached' : 'Pop out';
  });
}

function getDetachedPanelSnapshot(kind) {
  if (kind === 'liveExplainer') {
    return {
      title: 'Live Explain',
      kicker: 'Telemetry Guide',
      shellClass: 'metric-group live-explainer',
      bodyHtml: document.getElementById('live-explainer-body')?.innerHTML || '<p>Live explanation is unavailable.</p>',
    };
  }

  if (kind === 'introOverlay') {
    return {
      title: document.querySelector('#intro-content h2')?.textContent || 'Lab Guide',
      shellClass: 'panel lab-intro detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        ${document.getElementById('intro-content')?.innerHTML || '<p>Lab guide is unavailable.</p>'}
        <div style="display:flex;gap:8px;margin-top:20px">
          <button class="btn-sm" id="btn-detached-intro-skip" type="button">Skip Intro</button>
          <button class="btn-sm primary" id="btn-detached-intro-start" type="button">▶ Start Lab</button>
        </div>
      `,
    };
  }

  if (kind === 'studyOverlay') {
    return {
      title: document.querySelector('#study-panel h2')?.textContent || 'Exam Prep',
      shellClass: 'panel study-panel detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        <div class="study-panel-header">
          <h2>${escHtml(document.querySelector('#study-panel h2')?.textContent || 'NVIDIA Exam Prep')}</h2>
          <p>${escHtml(document.getElementById('study-panel-subtitle')?.textContent || '')}</p>
        </div>
        ${document.getElementById('study-content')?.innerHTML || '<p>Study guide unavailable.</p>'}
      `,
    };
  }

  if (kind === 'quizOverlay') {
    return {
      title: document.querySelector('#quiz-panel h2')?.textContent || 'Practice Quiz',
      shellClass: 'panel quiz-panel detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        <div class="quiz-panel-header">
          <h2>${escHtml(document.querySelector('#quiz-panel h2')?.textContent || 'NCA-AIIO Practice Quiz')}</h2>
          <p>${escHtml(document.querySelector('#quiz-panel .quiz-panel-header p')?.textContent || '')}</p>
        </div>
        ${document.getElementById('quiz-content')?.innerHTML || '<p>Quiz unavailable.</p>'}
      `,
    };
  }

  return {
    title: document.querySelector('#lab-step-coach .lab-step-coach-title')?.textContent || 'Lab Guide',
    kicker: document.querySelector('#lab-step-coach .lab-step-coach-kicker')?.textContent || 'Lab Coach',
    shellClass: 'lab-step-coach-shell',
    bodyHtml: document.getElementById('lab-step-coach-content')?.innerHTML || '<p>Lab guide is unavailable.</p>',
  };
}

function renderDetachedPanel(kind) {
  const win = detachedPanels[kind];
  if (!win || win.closed) {
    detachedPanels[kind] = null;
    syncDetachedPanelButtons();
    return;
  }

  const snapshot = getDetachedPanelSnapshot(kind);
  const doc = win.document;

  if (!doc.getElementById('detached-panel-root')) {
    doc.open();
    doc.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aegis ${escHtml(snapshot.title)}</title>
  <link rel="stylesheet" href="css/styles.css?v=20260423c">
</head>
<body class="detached-panel-window">
  <div class="detached-panel-frame" id="detached-panel-root"></div>
</body>
</html>`);
    doc.close();
    win.addEventListener('beforeunload', () => {
      detachedPanels[kind] = null;
      syncDetachedPanelButtons();
    });
  }

  const root = doc.getElementById('detached-panel-root');
  if (!root) return;

  if (kind === 'liveExplainer') {
    root.innerHTML = `
      <section class="${snapshot.shellClass}">
        <div class="metric-group-title metric-group-title-row">
          <span>${escHtml(snapshot.title)}</span>
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
        </div>
        <div class="live-explainer-body">${snapshot.bodyHtml}</div>
      </section>
    `;
  } else if (kind === 'stepCoach') {
    root.innerHTML = `
      <section class="${snapshot.shellClass}">
        <div class="lab-step-coach-topbar">
          <div>
            <div class="lab-step-coach-kicker">${escHtml(snapshot.kicker)}</div>
            <div class="lab-step-coach-title">${escHtml(snapshot.title)}</div>
          </div>
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
        </div>
        <div class="lab-step-coach-content">${snapshot.bodyHtml}</div>
      </section>
    `;
  } else {
    root.innerHTML = `<section class="${snapshot.shellClass}">${snapshot.bodyHtml}</section>`;
  }

  const focusBtn = doc.getElementById('btn-detached-focus-main');
  if (focusBtn) focusBtn.onclick = () => window.focus();
  const closeBtn = doc.getElementById('btn-detached-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (kind === 'introOverlay') closeIntro();
      if (kind === 'studyOverlay') closeStudyGuide();
      if (kind === 'quizOverlay') closeQuiz();
      win.close();
    };
  }
  if (kind === 'introOverlay') {
    const skipBtn = doc.getElementById('btn-detached-intro-skip');
    if (skipBtn) skipBtn.onclick = () => { closeIntro(); win.close(); };
    const startBtn = doc.getElementById('btn-detached-intro-start');
    if (startBtn) startBtn.onclick = () => { startLab(); win.close(); };
  }
  if (kind === 'studyOverlay') {
    const detachedStudyRoot = doc.querySelector('.detached-overlay-panel');
    if (detachedStudyRoot) detachedStudyRoot.onclick = event => {
      const labLink = event.target.closest('[data-study-lab]');
      if (!labLink) return;
      openStudyLab(labLink.dataset.studyLab);
      win.close();
    };
  }
  if (kind === 'quizOverlay') {
    const detachedQuizRoot = doc.querySelector('.detached-overlay-panel');
    if (detachedQuizRoot) detachedQuizRoot.onclick = event => {
      const option = event.target.closest('.quiz-option[data-quiz-question]');
      if (option) {
        selectAnswer(Number(option.dataset.quizQuestion), Number(option.dataset.quizOption));
        renderDetachedPanel('quizOverlay');
        return;
      }
      const action = event.target.closest('[data-quiz-action]');
      if (!action) return;
      if (action.dataset.quizAction === 'submit') submitQuiz();
      if (action.dataset.quizAction === 'reset') resetQuiz();
      renderDetachedPanel('quizOverlay');
    };
  }
}

function syncDetachedPanels() {
  renderDetachedPanel('liveExplainer');
  renderDetachedPanel('stepCoach');
  renderDetachedPanel('introOverlay');
  renderDetachedPanel('studyOverlay');
  renderDetachedPanel('quizOverlay');
}

function openDetachedPanel(kind) {
  const existing = detachedPanels[kind];
  if (existing && !existing.closed) {
    existing.focus();
    syncDetachedPanelButtons();
    renderDetachedPanel(kind);
    return;
  }

  const width = kind === 'liveExplainer'
    ? 560
    : kind === 'stepCoach'
      ? 720
      : 980;
  const height = kind === 'liveExplainer' ? 860 : 980;
  const left = window.screenX + 80;
  const top = window.screenY + 60;
  const win = window.open('', `aegis_${kind}`, `popup=yes,resizable=yes,scrollbars=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!win) return;
  detachedPanels[kind] = win;
  syncDetachedPanelButtons();
  renderDetachedPanel(kind);
  win.focus();
}

function renderOperatorStoryGuide(guide) {
  const sections = [];
  const plainPicture = guide.plainPicture || guide.quickAnswer || '';

  if (plainPicture) {
    sections.push(`
      <section class="learn-section learn-callout">
        <h4>Plain-Language Picture</h4>
        <p>${escHtml(tightenDisplayCopy(plainPicture))}</p>
      </section>
    `);
  }

  if (guide.whyOperatorsCare && guide.whyOperatorsCare.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Why Operators Care</h4>
        ${renderParagraphs(guide.whyOperatorsCare)}
      </section>
    `);
  }

  if (guide.wholePlatform && guide.wholePlatform.length) {
    sections.push(`
      <section class="learn-section">
        <h4>How This Fits The Bigger Picture</h4>
        ${renderParagraphs(guide.wholePlatform)}
      </section>
    `);
  }

  if (guide.coreTerms && guide.coreTerms.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Key Terms</h4>
        <div class="term-grid">
          ${guide.coreTerms.map(term => `
            <article class="term-card">
              <div class="term-name">${escHtml(term.term)}</div>
              <p>${escHtml(tightenDisplayCopy(term.plain))}</p>
              ${term.why ? `<div class="term-why">Why operators care: ${escHtml(tightenDisplayCopy(term.why))}</div>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `);
  }

  if (guide.commonMisreads && guide.commonMisreads.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Common Beginner Mistakes</h4>
        ${renderBulletList(guide.commonMisreads, 'learn-list')}
      </section>
    `);
  }

  if (guide.safeActions && guide.safeActions.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Safe Beginner Actions</h4>
        ${renderBulletList(guide.safeActions, 'learn-list')}
      </section>
    `);
  }

  const takeHome = buildGuideTakeHome(guide);
  if (takeHome.length) {
    sections.push(`
      <section class="learn-section learn-take-home">
        <h4>Take Home</h4>
        ${renderBulletList(takeHome, 'learn-list')}
      </section>
    `);
  }

  return sections.join('');
}

function buildGuideTakeHome(guide) {
  const takeHome = [];
  if (guide.plainPicture) {
    takeHome.push('First explain the plain picture in your own words before memorizing commands or acronyms.');
  }
  if (guide.commonMisreads && guide.commonMisreads.length) {
    takeHome.push(guide.commonMisreads[0]);
  }
  if (guide.safeActions && guide.safeActions.length) {
    takeHome.push(guide.safeActions[0]);
  }
  if (guide.wholePlatform && guide.wholePlatform.length) {
    takeHome.push('Connect the local signal back to platform impact: capacity, reliability, scheduling, or user-visible workload health.');
  }
  return takeHome.slice(0, 4);
}

function renderBeginnerStoryStepCoach(step, lab, outputClues, tabNote) {
  const topKicker = document.querySelector('#lab-step-coach .lab-step-coach-kicker');
  const topTitle = document.querySelector('#lab-step-coach .lab-step-coach-title');
  if (topKicker) topKicker.textContent = `${lab.name} • Step ${currentStep + 1}/${lab.steps.length}`;
  if (topTitle) topTitle.textContent = step.label;

  const whatToNotice = [
    ...(step.lookFor || []),
    ...outputClues.map(clue => `${clue.text} — ${clue.meaning}`),
  ];
  const nextAction = step.takeAction && step.takeAction.length ? step.takeAction[0] : 'Compare this step with the previous one before moving on.';
  const beginnerMistake = step.commonMistake || 'Do not move on until you can explain what changed and why it matters.';
  const operatorTakeaway = step.operatorTakeaway || step.meaning || nextAction;
  const whyItMatters = step.deeperContext || step.meaning || describeStepCommand(step);
  const commandNote = step.cmd?.startsWith('#')
    ? 'This stage represents the operational state change you would need to reason about, even when there is no literal shell command to memorize.'
    : tabNote;
  const screenshotSection = renderStepScreenshots(step);
  const scorecard = renderReasoningScorecard(getReasoningScorecardContext(currentLab, step), {
    subtitle: 'This rubric shows whether the user is identifying the right layer, grounding the diagnosis, and choosing a safe action.',
  });
  const diagnosis = renderDifferentialDiagnosis(currentLab, step, {
    subtitle: 'Use the nearby wrong paths to keep the screenshot evidence in the right fault family.',
  });

  return `
    <div class="lab-step-coach-callout${step.fault ? ' err' : ''}">
      <p><strong>What you’re doing:</strong> ${escHtml(tightenDisplayCopy(step.whatsHappening || describeStepCommand(step)))}</p>
      <p><strong>Why it matters:</strong> ${escHtml(tightenDisplayCopy(whyItMatters))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Command</div>
      <code class="lab-step-coach-code">${escHtml(step.cmd || '# simulated stage')}</code>
      <p>${escHtml(tightenDisplayCopy(commandNote))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">What To Notice</div>
      ${renderBulletList(whatToNotice.length ? whatToNotice : ['Use the visible output to decide what changed in the node state.'], 'lab-step-coach-list')}
    </div>
    ${screenshotSection}
    ${scorecard}
    ${diagnosis}
    ${step.screenshots && step.screenshots.length ? `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Use The Snapshot</div>
        <p>${escHtml(describeScreenshotUse(step))}</p>
      </div>
    ` : ''}
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Common Wrong Conclusion</div>
      <p>${escHtml(tightenDisplayCopy(beginnerMistake))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Operator Takeaway</div>
      <p>${escHtml(tightenDisplayCopy(operatorTakeaway))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Next Action</div>
      <p>${escHtml(tightenDisplayCopy(nextAction))}</p>
    </div>
  `;
}

function renderBeginnerStoryGuidedDetails(step) {
  const blocks = [];

  if (step.deeperContext || step.meaning) {
    blocks.push(`
      <div class="guided-step-block guided-step-context">
        <div class="guided-step-title">Why It Matters</div>
        <p>${escHtml(tightenDisplayCopy(step.deeperContext || step.meaning))}</p>
      </div>
    `);
  }

  if (step.lookFor && step.lookFor.length) {
    blocks.push(`
      <div class="guided-step-block">
        <div class="guided-step-title">What To Notice</div>
        ${renderBulletList(step.lookFor, 'guided-step-list')}
      </div>
    `);
  }

  const screenshotSection = renderStepScreenshots(step, 'guided');
  if (screenshotSection) {
    blocks.push(screenshotSection);
    blocks.push(`
      <div class="guided-step-block">
        <div class="guided-step-title">Use The Snapshot</div>
        <p>${escHtml(describeScreenshotUse(step))}</p>
      </div>
    `);
  }

  if (step.commonMistake) {
    blocks.push(`
      <div class="guided-step-block guided-step-compare">
        <div class="guided-step-title">Common Beginner Mistake</div>
        <p>${escHtml(tightenDisplayCopy(step.commonMistake))}</p>
      </div>
    `);
  }

  if (step.operatorTakeaway || step.meaning) {
    blocks.push(`
      <div class="guided-step-block">
        <div class="guided-step-title">Operator Takeaway</div>
        <p>${escHtml(tightenDisplayCopy(step.operatorTakeaway || step.meaning))}</p>
      </div>
    `);
  }

  if (step.takeAction && step.takeAction.length) {
    blocks.push(`
      <div class="guided-step-block">
        <div class="guided-step-title">Do This</div>
        ${renderBulletList(step.takeAction, 'guided-step-list')}
      </div>
    `);
  }

  return blocks.join('');
}

function getStepOutput(step) {
  if (!step || typeof TERMINAL_OUTPUT === 'undefined') return [];
  return TERMINAL_OUTPUT[step.type] || [];
}

function renderTerminalSnapshot(snapshot) {
  if (!snapshot || !snapshot.lines || !snapshot.lines.length) return '';
  const title = snapshot.title ? `<div class="lab-step-shot-title">${escHtml(snapshot.title)}</div>` : '';
  const points = beginnerMode ? getSnapshotPointsOfInterest(snapshot) : [];
  const captionText = shouldSuppressSnapshotCaption(snapshot, points) ? '' : (snapshot.caption || '');
  const caption = captionText ? `<div class="lab-step-shot-caption">${escHtml(tightenDisplayCopy(captionText))}</div>` : '';
  const lines = snapshot.lines.map(line => `<div class="lab-step-shot-line">${escHtml(line)}</div>`).join('');
  return `
    <figure class="lab-step-shot-frame">
      ${title}
      <div class="lab-step-shot-terminal">
        ${lines}
      </div>
      ${caption}
      ${points.length ? `
        <div class="snapshot-interest">
          <div class="snapshot-interest-title">Snapshot Read</div>
          <ul>
            ${points.map(point => `<li>${point}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </figure>
  `;
}

function getSnapshotPointsOfInterest(snapshot) {
  const rawLines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  const lines = rawLines
    .map(line => String(line || '').trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('$') && !line.startsWith('#'))
    .filter(line => !isSnapshotHeaderLine(line))
    .slice(0, 6);

  const summaries = [];
  const seenMeanings = new Set();

  lines.forEach(line => {
    const meaning = explainOutputLineText(line, { fallback: false });
    if (!meaning || seenMeanings.has(meaning)) return;
    seenMeanings.add(meaning);
    summaries.push({ line, meaning });
  });

  if (!summaries.length) return [];

  const repeatedSignals = getRepeatedSnapshotSignals(lines);
  if (repeatedSignals.length) {
    return repeatedSignals.slice(0, 2).map(signal =>
      `<span>${escHtml(signal.summary)}</span>`
    );
  }

  return summaries.slice(0, 3).map(item =>
    `<code>${escHtml(item.line)}</code><span>${escHtml(item.meaning)}</span>`
  );
}

function shouldSuppressSnapshotCaption(snapshot, points) {
  if (!snapshot?.caption || !points?.length) return false;
  const rawLines = Array.isArray(snapshot?.lines) ? snapshot.lines : [];
  const lines = rawLines.map(line => String(line || '').trim()).filter(Boolean);
  return isTopologyMatrixSnapshot(lines) || isRepeatedSignalSnapshot(lines);
}

function isSnapshotHeaderLine(line) {
  const lower = String(line || '').toLowerCase();
  if (!lower) return false;
  if (lower.includes('cpu affinity') && lower.includes('gpu0')) return true;
  if (lower.includes('gpu   pid') && lower.includes('type')) return true;
  if (lower.includes('timestamp') && lower.includes('value')) return true;
  return false;
}

function getRepeatedSnapshotSignals(lines) {
  const signals = [];
  const joined = lines.join(' ').toLowerCase();
  const nv4Rows = lines.filter(line => /\bnv4\b/i.test(line)).length;
  const phbRows = lines.filter(line => /\bphb\b/i.test(line)).length;

  if (nv4Rows >= 2) {
    signals.push({
      summary: 'The topology is consistently reporting NV4 between the visible GPU pairs. That indicates the expected direct NVLink path is present.'
    });
  }

  if (phbRows >= 2) {
    signals.push({
      summary: 'The repeated PHB labels show traffic is crossing the PCIe host bridge instead of direct NVLink. That points to a slower inter-GPU path.'
    });
  }

  if ((joined.includes('using network socket') || joined.includes('tcp fallback')) && lines.length >= 2) {
    signals.push({
      summary: 'NCCL is consistently selecting TCP sockets instead of the intended high-speed fabric. Treat this as a transport-path issue, not a model issue.'
    });
  }

  return signals;
}

function isTopologyMatrixSnapshot(lines) {
  const joined = lines.join(' ').toLowerCase();
  const gpuRowCount = lines.filter(line => /^gpu\d+\s+/i.test(line)).length;
  return joined.includes('cpu affinity') && gpuRowCount >= 4;
}

function isRepeatedSignalSnapshot(lines) {
  const joined = lines.join(' ').toLowerCase();
  const nv4Rows = lines.filter(line => /\bnv4\b/i.test(line)).length;
  const phbRows = lines.filter(line => /\bphb\b/i.test(line)).length;
  if (nv4Rows >= 2 || phbRows >= 2) return true;
  if ((joined.includes('using network socket') || joined.includes('tcp fallback')) && lines.length >= 2) return true;
  return false;
}

function describeScreenshotUse(step) {
  if (!step || !step.screenshots || !step.screenshots.length) return '';
  return tightenDisplayCopy(step.screenshotReference || 'Use the output snapshot as your visual anchor before you scan the live terminal output.');
}

function renderStepScreenshots(step, variant = 'coach') {
  if (!step || !step.screenshots || !step.screenshots.length) return '';
  const shellClass = variant === 'guided'
    ? 'guided-step-block guided-step-screenshots'
    : 'lab-step-coach-section lab-step-coach-screenshots';
  const titleClass = variant === 'guided'
    ? 'guided-step-title'
    : 'lab-step-coach-section-title';
  const snapshots = step.screenshots.map(renderTerminalSnapshot).join('');
  return `
    <div class="${shellClass}">
      <div class="${titleClass}">Output Snapshot</div>
      <div class="lab-step-shot-grid">
        ${snapshots}
      </div>
    </div>
  `;
}

function describeStepCommand(step) {
  const cmd = step?.cmd || '';
  if (!cmd || cmd.startsWith('#')) {
    return 'This stage simulates a state change so you can focus on the operational effect before and after it appears in logs, metrics, and topology views.';
  }

  const lower = cmd.toLowerCase();
  if (lower.includes('topo -m')) return 'Shows the GPU-to-GPU connectivity map so you can compare the intended fast path against the path the node is actually using.';
  if (lower.includes('nvlink -e')) return 'Reads NVLink error counters so you can decide whether the visible links are electrically clean or already degraded.';
  if (lower.includes('dcgmi dmon')) return 'Polls DCGM counters over time so you can spot trends instead of trusting one isolated sample.';
  if (lower.includes('dmesg') && lower.includes('xid')) return 'Searches kernel logs for NVIDIA XID fault codes so you can confirm whether the issue crossed into an explicit driver-reported fault.';
  if (lower.includes('kubectl drain') || lower.includes('state=drain')) return 'Removes a node from scheduling so new work does not land on hardware that is no longer safe to trust.';
  if (lower.includes('all_reduce_perf') || lower.includes('./perf')) return 'Runs a collective benchmark so you can see whether the fabric is performing at the level the workload expects.';
  if (lower.includes('nccl_debug=info')) return 'Turns on NCCL path logging so you can see whether collective traffic is using IB, NVLink, or a slower fallback path.';
  if (lower.includes('env | grep nccl')) return 'Lists NCCL-related environment variables so you can catch configuration mistakes before blaming the network.';
  if (lower.includes('ibstat')) return 'Shows InfiniBand adapter and port state so you can confirm whether the fabric is physically up.';
  if (lower.includes('perfquery') || lower.includes('ib_write_bw')) return 'Checks InfiniBand error or bandwidth behavior so you can tell whether the fabric is healthy enough to trust.';
  if (lower.includes('iostat')) return 'Shows storage utilization and latency so you can tell whether the GPUs are waiting on data instead of compute.';
  if (lower.includes('lfs getstripe')) return 'Shows how a Lustre dataset is striped across storage targets so you can judge whether reads are parallel enough.';
  if (lower.includes('lfs setstripe')) return 'Changes the Lustre striping layout so reads can spread across more OSTs and feed the GPUs faster.';
  if (lower.includes('nvidia-smi dmon')) return 'Shows live GPU utilization and health counters so you can correlate workload behavior with hardware signals.';
  if (lower.includes('kubectl describe pod') || lower.includes('kubectl describe node')) return 'Describes Kubernetes scheduling state so you can see why a workload did or did not land on a node.';
  if (lower.includes('squeue') || lower.includes('scontrol') || lower.includes('sshare')) return 'Shows scheduler state so you can distinguish policy delay from hardware failure.';
  return 'Runs the operator command for this stage so you can inspect the evidence it produces.';
}

function explainOutputLineText(text, options = {}) {
  const { fallback = true } = options;
  const lower = String(text || '').toLowerCase();
  if (lower.includes('nv4')) return 'NV4 means the GPUs are using a direct NVLink relationship, which is the fast path you want in this scenario.';
  if (lower.includes('phb')) return 'PHB means traffic is going through the PCIe host bridge instead of direct NVLink, which is much slower for collectives.';
  if (lower.includes('nvrm version')) return 'This line identifies the NVIDIA kernel driver module. The number at the end is the installed NVIDIA driver version.';
  if (lower.includes('gcc version')) return 'This is the compiler used to build the kernel module. It is supporting evidence, not the NVIDIA driver version.';
  if (lower.includes('kernel module build')) return 'This timestamp tells you when the loaded NVIDIA kernel module was built.';
  if (lower.includes('driver version')) return 'This is the NVIDIA driver version reported by user-space tools such as nvidia-smi.';
  if (lower.includes('cuda version')) return 'This is the CUDA version reported by the tool or runtime. It is a different layer from the driver.';
  if (lower.includes('pytorch') || lower.includes('torch')) return 'This points to the framework layer. A framework can fail even when the driver layer is working.';
  if (lower.includes('tensorflow')) return 'This points to the framework layer. Use it to confirm whether the application library can see the CUDA stack.';
  if (lower.includes('mig mode')) return 'MIG mode tells you whether the GPU is exposing partitioned instances or one full device.';
  if (lower.includes('ngc') || lower.includes('nvcr.io')) return 'This points to a validated NVIDIA container image, which reduces software stack mismatch risk.';
  if (lower.includes('crc flit error count:       0') || lower.includes('crc errs: 0')) return 'Zero CRC or flit errors means the link looks clean right now.';
  if (lower.includes('crc flit error count') || lower.includes('crc')) return 'A rising CRC or flit error count points to link-integrity trouble rather than a software-only issue.';
  if (lower.includes('using network socket') || lower.includes('tcp fallback')) return 'This means NCCL is not using the preferred high-speed fabric path and has fallen back to TCP.';
  if (lower.includes('using network ib')) return 'This means NCCL is using InfiniBand as intended, which is the healthy fast path in this scenario.';
  if (lower.includes('xid 48')) return 'XID 48 is an uncorrectable ECC event, which means the card crossed from warning signs into a hardware fault.';
  if (lower.includes('xid 74')) return 'XID 74 points to NVLink trouble, so GPU-to-GPU communication is now suspect.';
  if (lower.includes('xid 79')) return 'XID 79 means the GPU fell off the bus or hung badly enough that reset or reboot is usually required.';
  if (lower.includes('dbe')) return 'DBE means double-bit ECC. Unlike corrected single-bit errors, this is treated as an immediate hardware-integrity problem.';
  if (lower.includes('sawtooth')) return 'A sawtooth utilization pattern usually means the GPUs are repeatedly waiting for storage or input data.';
  if (lower.includes('100% util')) return 'A storage device at 100% utilization is saturated and can starve the GPUs.';
  if (lower.includes('stripe_count: 1')) return 'A stripe count of 1 means reads are concentrated on one storage target instead of being spread out.';
  if (lower.includes('insufficient nvidia.com/gpu')) return 'Kubernetes is telling you no schedulable GPU resource is free for this pod right now.';
  if (lower.includes('fairshare')) return 'This is a scheduler policy clue: the job is delayed by user-share rules, not necessarily by broken hardware.';
  if (lower.includes('state: active')) return 'Active means the fabric or port is up, so the next question is performance or configuration, not basic link existence.';
  if (lower.includes('state: down')) return 'Down means the fabric path itself is unavailable, so this is a physical or low-level connectivity problem.';
  if (lower.includes('187') || lower.includes('180 gb/s')) return 'This is the kind of high collective bandwidth you expect from a healthy fast-path configuration in this simulator.';
  if (lower.includes('3 gb/s') || lower.includes('8 gb/s')) return 'This is a degraded throughput clue, not just a cosmetic number change.';
  if (lower.includes('ready 1/1') || lower.includes('running (16/16)')) return 'This is the success signal that the control plane or gang-scheduled workload reached the expected ready state.';
  if (lower.includes('gpu accessible') || lower.includes('available: true')) return 'This output confirms the container or runtime can actually see CUDA devices.';
  return fallback
    ? 'Treat this line as one of the important clues for the current stage and compare it with the step goal before moving on.'
    : '';
}

function getKeyOutputClues(step) {
  return getStepOutput(step)
    .filter(line => line && line.v && line.t !== 'cmd' && line.t !== 'dim')
    .slice(0, 3)
    .map(line => ({
      text: line.v,
      meaning: explainOutputLineText(line.v),
    }));
}

function getMetricsToWatch(labId, step) {
  if (['ecc', 'nvlink_fault'].includes(labId) || ['ecc_healthy', 'ecc_sbe', 'ecc_trend', 'ecc_xid', 'xid48', 'xid48_confirm', 'xid79', 'xid74'].includes(step?.type)) {
    return ['ECC Status: watch SBE, DBE, and XID together.', 'Event Log: treat new XID entries as fault-lifecycle milestones, not cosmetic text.'];
  }
  if (['nvlink', 'allreduce', 'nccl_fallback', 'ib_fabric', 'roce'].includes(labId)) {
    return ['Network: compare IB State, NCCL path, and AllReduce bandwidth together.', 'Event Log: use fault entries to confirm whether the slowdown has a hardware-side explanation.'];
  }
  if (['storage', 'training', 'gds'].includes(labId)) {
    return ['GPU Cluster + Storage: compare GPU util against storage %util and read throughput.', 'Sawtooth GPU utilization usually means the data path is the bottleneck, not the SMs themselves.'];
  }
  if (['monitoring'].includes(labId)) {
    return ['ECC Status and Event Log: use them as the example alert signals for this observability lab.', 'The goal here is not only to see data, but to understand what operators would alert on.'];
  }
  if (['slurm', 'k8s'].includes(labId)) {
    return ['Event Log and scheduler output: these labs are about control-plane state more than GPU counters.', 'The important question is why work did or did not schedule, not whether the GPU temperature changed.'];
  }
  return ['Use the terminal output as the primary clue, then compare it with the metrics sidebar and event log before deciding what the step means.'];
}

function renderLabStepCoach() {
  const el = document.getElementById('lab-step-coach');
  const content = document.getElementById('lab-step-coach-content');
  if (!el || !content) return;

  if (activeTab === 'parser') {
    el.classList.add('is-hidden');
    syncDetachedPanels();
    return;
  }

  el.classList.toggle('is-hidden', !labCoachOpen);

  if (!currentLab) {
    content.innerHTML = `
      <p>Select a lab, read the intro, then start the first step. This panel stays beside the terminal so beginners do not have to remember what they are looking at.</p>
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Work</div>
        <ul class="lab-step-coach-list">
          <li>Use the step buttons or the Run button. You are not expected to memorize every command.</li>
          <li>Read the terminal, metrics sidebar, and event log together.</li>
          <li>Move on only when you can explain what changed and why it matters.</li>
        </ul>
      </div>
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const lab = LABS[currentLab];
  if (!lab) return;

  if (currentStep < 0 || !lab.steps[currentStep]) {
    content.innerHTML = `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">Before You Start</div>
        <p>${beginnerMode ? 'This lab is guided. Start with step 1 and let the simulator show you the evidence in order.' : 'Use the step buttons to replay the scenario in order.'}</p>
      </div>
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Use This Lab</div>
        <ul class="lab-step-coach-list">
          <li>Each step represents one operator question: what am I checking, and what answer do I expect?</li>
          <li>Use the terminal output as the main clue, then confirm the story in the side metrics.</li>
          <li>Fault steps are supposed to look bad. The lesson is learning what that bad output means.</li>
        </ul>
      </div>
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const step = lab.steps[currentStep];
  const outputClues = getKeyOutputClues(step);
  const useTip = step.cmd?.startsWith('#')
    ? 'This step is a simulated transition. You are meant to study the new state it creates, not to memorize a literal shell command.'
    : 'Click Run to replay this step. The command is shown for realism, but the learning goal is understanding the evidence it produces, not memorizing the syntax.';
  const completion = step.fault
    ? (step.justifiedConclusion || step.meaning || 'This fault step is complete once you can explain why the degraded signal is significant.')
    : (step.justifiedConclusion || step.meaning || 'This step is complete once the expected healthy signal is visible and you can explain why it matters.');
  const nextAction = step.takeAction && step.takeAction.length ? step.takeAction[0] : 'Compare this step with the previous one before you move on.';
  const observationList = step.lookFor && step.lookFor.length ? step.lookFor : ['Use the key output clues below to decide what changed and whether the step looks healthy or degraded.'];
  const sidePanels = getMetricsToWatch(currentLab, step);
  const tabNote = activeTab === 'term'
    ? 'You are on the main Terminal tab, which is the primary output for the active step.'
    : activeTab === 'dmesg'
      ? 'You are on dmesg, which is useful for kernel and NVIDIA fault confirmation.'
      : 'You are on dcgm, which is useful for counter and health correlation.';
  const calloutClass = step.fault ? 'lab-step-coach-callout err' : 'lab-step-coach-callout';
  const scorecard = getReasoningScorecardContext(currentLab, step);
  reasoningScoreState.byLab[currentLab] = scorecard;
  const diagnosis = renderDifferentialDiagnosis(currentLab, step);
  const incidentBrief = renderIncidentModeBrief(currentLab, step);
  const consequenceBranch = renderConsequenceBranch(currentLab, step, currentStep);
  const routeStatus = renderBranchRouteStatus(currentLab, currentStep);

  if (beginnerMode && step.explainerMode === 'beginner_story') {
    content.innerHTML = renderBeginnerStoryStepCoach(step, lab, outputClues, tabNote);
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  if (incidentMode) {
    content.innerHTML = `
      <div class="${calloutClass}">
        <p><strong>Incident goal:</strong> ${escHtml(describeStepCommand(step))}</p>
        <p>${escHtml(tightenDisplayCopy('Use only the evidence on screen, keep the layer call narrow, and avoid any fix you cannot justify yet.'))}</p>
      </div>
      ${renderReasoningScorecard(scorecard, {
        subtitle: 'Incident mode scores the diagnosis on evidence control, layer ownership, and safe movement under uncertainty.',
      })}
      ${incidentBrief}
      ${consequenceBranch}
      ${routeStatus}
      ${diagnosis}
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">Command In Focus</div>
        <code class="lab-step-coach-code">${escHtml(step.cmd || '# simulated stage')}</code>
      </div>
      ${renderStepScreenshots(step)}
      ${outputClues.length ? `
        <div class="lab-step-coach-section">
          <div class="lab-step-coach-section-title">Visible Evidence</div>
          ${outputClues.map(clue => `
            <div class="lab-step-coach-clue">
              <div class="lab-step-coach-clue-line">${escHtml(clue.text)}</div>
              <div class="lab-step-coach-clue-meaning">${escHtml(clue.meaning)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const topKicker = document.querySelector('#lab-step-coach .lab-step-coach-kicker');
  const topTitle = document.querySelector('#lab-step-coach .lab-step-coach-title');
  if (topKicker) topKicker.textContent = `${lab.name} • Step ${currentStep + 1}/${lab.steps.length}`;
  if (topTitle) topTitle.textContent = step.label;

  content.innerHTML = `
    <div class="${calloutClass}">
      <p><strong>What this step is for:</strong> ${escHtml(describeStepCommand(step))}</p>
      <p>${escHtml(tightenDisplayCopy(useTip))}</p>
    </div>
    ${renderReasoningScorecard(scorecard)}
    ${(step.fault || incidentMode) ? consequenceBranch : ''}
    ${routeStatus}
    ${diagnosis}
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Command In Focus</div>
      <code class="lab-step-coach-code">${escHtml(step.cmd || '# simulated stage')}</code>
      <p>${escHtml(tightenDisplayCopy(tabNote))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">What To Look For</div>
      ${renderBulletList(observationList, 'lab-step-coach-list')}
    </div>
    ${renderStepScreenshots(step)}
    ${step.screenshots && step.screenshots.length ? `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Use This Snapshot</div>
        <p>${escHtml(describeScreenshotUse(step))}</p>
      </div>
    ` : ''}
    ${outputClues.length ? `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Read This Output</div>
        ${outputClues.map(clue => `
          <div class="lab-step-coach-clue">
            <div class="lab-step-coach-clue-line">${escHtml(clue.text)}</div>
            <div class="lab-step-coach-clue-meaning">${escHtml(clue.meaning)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">What It Means</div>
      <p>${escHtml(tightenDisplayCopy(step.meaning || completion))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">How To Tell You Are Done</div>
      <p>${escHtml(tightenDisplayCopy(completion))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Watch These Side Panels</div>
      ${renderBulletList(sidePanels, 'lab-step-coach-list')}
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Next Action</div>
      <p>${escHtml(tightenDisplayCopy(nextAction))}</p>
    </div>
  `;
  content.scrollTop = 0;
  syncDetachedPanels();
}

function renderGuidedStepDetails(step, prevStep) {
  if (!step) return '';

  if (beginnerMode && step.explainerMode === 'beginner_story') {
    return renderBeginnerStoryGuidedDetails(step);
  }

  const deeperContext = beginnerMode && step.deeperContext
    ? `<div class="guided-step-block guided-step-context"><div class="guided-step-title">Why This Stage Matters</div><p>${escHtml(tightenDisplayCopy(step.deeperContext))}</p></div>`
    : '';
  const comparisonItems = [];
  if (beginnerMode && step.changedFromPrevious) {
    const prevLabel = prevStep ? ` compared with ${prevStep.label}` : '';
    comparisonItems.push(`<li><strong>What changed${escHtml(prevLabel)}</strong>: ${escHtml(tightenDisplayCopy(step.changedFromPrevious))}</li>`);
  }
  if (beginnerMode && step.justifiedConclusion) {
    comparisonItems.push(`<li><strong>Conclusion you can justify now</strong>: ${escHtml(tightenDisplayCopy(step.justifiedConclusion))}</li>`);
  }
  if (beginnerMode && step.stillPremature) {
    comparisonItems.push(`<li><strong>What is still too early to conclude</strong>: ${escHtml(tightenDisplayCopy(step.stillPremature))}</li>`);
  }
  if (beginnerMode && step.thresholdCrossed) {
    comparisonItems.push(`<li><strong>Threshold crossed</strong>: ${escHtml(tightenDisplayCopy(step.thresholdCrossed))}</li>`);
  }
  const comparativeReasoning = comparisonItems.length
    ? `<div class="guided-step-block guided-step-compare"><div class="guided-step-title">Reasoning Check</div><ul class="guided-step-list">${comparisonItems.join('')}</ul></div>`
    : '';
  const lookFor = step.lookFor && step.lookFor.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Look For</div>${renderBulletList(step.lookFor, 'guided-step-list')}</div>`
    : '';
  const meaning = step.meaning
    ? `<div class="guided-step-block"><div class="guided-step-title">What It Means</div><p>${escHtml(tightenDisplayCopy(step.meaning))}</p></div>`
    : '';
  const action = step.takeAction && step.takeAction.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Do This</div>${renderBulletList(step.takeAction, 'guided-step-list')}</div>`
    : '';
  const avoid = step.avoid && step.avoid.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Avoid This</div>${renderBulletList(step.avoid, 'guided-step-list')}</div>`
    : '';
  const screenshots = renderStepScreenshots(step, 'guided');
  const screenshotUsage = step.screenshots && step.screenshots.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Use The Snapshot</div><p>${escHtml(describeScreenshotUse(step))}</p></div>`
    : '';
  const engine = getExplainEngine();
  const coach = engine ? engine.renderStepCoach(step, prevStep, getExplanationOptions()) : '';
  const diagnosis = renderDifferentialDiagnosis(currentLab, step, {
    title: 'What This Is Not',
    subtitle: 'Keep the current step separated from the nearby failure classes that can look similar at first glance.',
  });

  return [deeperContext, comparativeReasoning, diagnosis, lookFor, screenshots, screenshotUsage, meaning, action, avoid, coach].filter(Boolean).join('');
}

function renderGuidedFlowSteps(lab) {
  return `
    <div class="guided-steps">
      ${lab.steps.map((s, i) => {
        const prevStep = i > 0 ? lab.steps[i - 1] : null;
        return `
        <article class="guided-step-card${s.fault ? ' guided-step-card-fault' : ''}">
          <div class="guided-step-top">
            <div class="step-num">${i + 1}</div>
            <div class="guided-step-header">
              <div class="guided-step-label">${escHtml(s.label)}</div>
              <div class="step-hint">${escHtml(s.cmd).slice(0, 100)}</div>
            </div>
          </div>
          ${renderGuidedStepDetails(s, prevStep)}
        </article>
      `;
      }).join('')}
    </div>
  `;
}

function renderLearningGuide(id) {
  const guide = getLearningGuide(id);
  if (!guide) return '';

  if (guide.beginnerTemplate === 'operator_story') {
    return renderOperatorStoryGuide(guide);
  }

  const engine = getExplainEngine();
  const explainOptions = getExplanationOptions();
  const sections = [];
  if (engine) sections.push(engine.renderProfileBanner(explainOptions));
  if (incidentMode) {
    sections.push(renderIncidentModeBrief(id, null, {
      subtitle: 'Incident mode keeps the lab brief shorter and pushes the user toward evidence, uncertainty, and safe action.',
    }));
  }
  sections.push(`
    <section class="learn-section learn-callout">
      <h4>Quick Answer</h4>
      <p>${escHtml(tightenDisplayCopy(guide.quickAnswer || ''))}</p>
    </section>
  `);

  if (!incidentMode && beginnerMode && guide.whyItMatters) {
    sections.push(`
      <section class="learn-section">
        <h4>Why This Matters</h4>
        <p>${escHtml(tightenDisplayCopy(guide.whyItMatters))}</p>
      </section>
    `);
  }

  if (!incidentMode && guide.coreTerms && guide.coreTerms.length) {
    sections.push(`
      <section class="learn-section">
        <div class="learn-heading-row">
          <h4>Key Terms</h4>
          <span class="learn-mode-tag">${beginnerMode ? 'Annotated jargon' : 'Core vocabulary'}</span>
        </div>
        <div class="term-grid">
          ${guide.coreTerms.map(term => `
            <article class="term-card">
              <div class="term-name">${escHtml(term.term)}</div>
              <p>${escHtml(tightenDisplayCopy(term.plain))}</p>
              ${beginnerMode && term.why ? `<div class="term-why">Why it matters: ${escHtml(tightenDisplayCopy(term.why))}</div>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `);
  }

  if (!incidentMode && beginnerMode && guide.lifecycle && guide.lifecycle.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Lifecycle</h4>
        <ol class="learn-timeline">
          ${guide.lifecycle.map(step => `
            <li>
              <div class="timeline-title">${escHtml(step.title)}</div>
              <div class="timeline-body">${escHtml(tightenDisplayCopy(step.detail))}</div>
            </li>
          `).join('')}
        </ol>
      </section>
    `);
  }

  if (!incidentMode && beginnerMode && guide.watchFor && guide.watchFor.length) {
    sections.push(`
      <section class="learn-section">
        <h4>What To Watch</h4>
        ${renderBulletList(guide.watchFor, 'learn-list')}
      </section>
    `);
  }

  if (guide.safeActions && guide.safeActions.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Safe Beginner Actions</h4>
        ${renderBulletList(guide.safeActions, 'learn-list')}
      </section>
    `);
  }

  if (!incidentMode && beginnerMode && guide.whatNotToDo && guide.whatNotToDo.length) {
    sections.push(`
      <section class="learn-section">
        <h4>What Not To Do</h4>
        ${renderBulletList(guide.whatNotToDo, 'learn-list')}
      </section>
    `);
  }

  if (!incidentMode && beginnerMode && guide.escalateWhen && guide.escalateWhen.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Escalate When</h4>
        ${renderBulletList(guide.escalateWhen, 'learn-list')}
      </section>
    `);
  }

  if (!incidentMode && beginnerMode && guide.readMore && guide.readMore.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Read This Slowly</h4>
        ${guide.readMore.map(item => `<p>${escHtml(tightenDisplayCopy(item))}</p>`).join('')}
      </section>
    `);
  }

  if (!incidentMode && engine) {
    const glossaryNetwork = engine.renderGlossaryNetwork(guide.coreTerms || [], explainOptions);
    if (glossaryNetwork) sections.push(glossaryNetwork);
  }

  const diagnosis = renderDifferentialDiagnosis(id, null, {
    subtitle: 'This is the operator comparison layer: the closest wrong reads that beginners and rushed responders make in this lab family.',
  });
  if (diagnosis) sections.push(diagnosis);

  return sections.join('');
}

function describeCollectionError(code) {
  const messages = {
    dcgm_unavailable: 'DCGM is unavailable, so advanced GPU health counters and deeper fleet metrics are missing.',
    nvidia_smi_unavailable: 'nvidia-smi is unavailable or returned unusable data, so direct GPU telemetry could not be collected.',
    nvlink_status_unavailable: 'NVLink status could not be collected, so link-health conclusions are limited.',
  };
  return messages[code] || `${code} means one expected evidence source could not be collected.`;
}

function describeGroundingStatus(status) {
  const messages = {
    grounded: 'Grounded means the diagnosis is strongly backed by live evidence collected from the node.',
    partial: 'Partial grounding means some evidence was collected, but important sources were still missing.',
    kb_only: 'Knowledge-base only means the system is explaining the fault from trusted runbooks and fault references, not from live node evidence.',
  };
  return messages[status] || 'Grounding status explains how much of the diagnosis is backed by live machine evidence.';
}

function renderBeginnerTelemetryExplanation(liveData) {
  const body = document.getElementById('live-explainer-body');
  if (!body) return;

  if (!liveData) {
    body.innerHTML = '<p>Turn on Live Telemetry to see the current hardware state and evidence quality.</p>';
    syncDetachedPanels();
    return;
  }

  const engine = getExplainEngine();
  const runtimeCoach = engine ? engine.renderRuntimeCoach('telemetry', liveData, getExplanationOptions()) : '';

  if (!beginnerMode) {
    const source = escHtml(liveData.source || 'unknown-source');
    const quality = liveData.degraded ? 'best-effort' : 'direct';
    body.innerHTML = `<p><strong>Compact view:</strong> telemetry is coming from <strong>${source}</strong> using a <strong>${quality}</strong> evidence path. Turn on Beginner Mode for more context on scope, missing evidence, grounding, and action confidence.</p>`;
    syncDetachedPanels();
    return;
  }

  const scopeText = liveData.telemetry_scope === 'host'
    ? 'Telemetry scope is <strong>host</strong>, which means the backend is reading machine-level fallback data instead of direct GPU counters.'
    : `Telemetry scope is <strong>${escHtml(liveData.telemetry_scope || 'unknown')}</strong>, which means the backend has direct hardware visibility.`;

  const sourceText = (liveData.telemetry_sources && liveData.telemetry_sources.length)
    ? `Sources in use: ${liveData.telemetry_sources.map(escHtml).join(', ')}.`
    : 'No telemetry source list was provided.';

  const degradedText = liveData.degraded
    ? `<p><strong>Degraded mode</strong> means the system is still returning useful signals, but the preferred hardware evidence path was unavailable. ${escHtml(liveData.degraded_reason || '')}</p>`
    : '<p><strong>Healthy evidence path</strong> means the backend is collecting from its preferred hardware telemetry sources.</p>';

  const collectionErrors = (liveData.collection_errors || []).map(code => `<li><strong>${escHtml(code)}</strong>: ${escHtml(describeCollectionError(code))}</li>`).join('');
  const fabricSummary = liveData.fabric_summary
    ? `<li><strong>fabric_summary</strong>: NVLink is ${escHtml(liveData.fabric_summary.nvlink || 'unknown')}, DCGM is ${escHtml(liveData.fabric_summary.dcgm || 'unknown')}.</li>`
    : '';
  const perGpu = Array.isArray(liveData.per_gpu) && liveData.per_gpu.length
    ? `<li><strong>per_gpu</strong>: ${liveData.per_gpu.length} GPU-specific snapshots are available.</li>`
    : '<li><strong>per_gpu</strong>: no per-GPU snapshots were collected.</li>';

  body.innerHTML = `
    ${runtimeCoach}
    <p>${scopeText}</p>
    ${degradedText}
    <p><strong>telemetry_sources</strong> shows where the numbers came from. ${sourceText}</p>
    <ul class="live-explainer-list">
      ${fabricSummary}
      ${perGpu}
    </ul>
    ${collectionErrors ? `<div class="live-explainer-block"><div class="live-explainer-title">Missing evidence sources</div><ul class="live-explainer-list">${collectionErrors}</ul></div>` : ''}
  `;
  syncDetachedPanels();
}

function renderDiagnosisExplanation(data) {
  if (!beginnerMode) return '';

  const grounding = describeGroundingStatus(data.grounding_status);
  const grounded = (data.grounded_sources || []).length
    ? `<li><strong>grounded_sources</strong>: ${data.grounded_sources.map(escHtml).join(', ')}</li>`
    : '<li><strong>grounded_sources</strong>: none were collected for this diagnosis.</li>';
  const unavailable = (data.unavailable_sources || []).length
    ? `<li><strong>unavailable_sources</strong>: ${data.unavailable_sources.map(escHtml).join(', ')}</li>`
    : '<li><strong>unavailable_sources</strong>: none were reported.</li>';
  const engine = getExplainEngine();
  const runtimeCoach = engine ? engine.renderRuntimeCoach('diagnosis', data, getExplanationOptions()) : '';

  return `
    <div class="diag-block">
      <div class="diag-title">Diagnosis Read</div>
      ${runtimeCoach}
      <p><strong>diagnosis_source</strong> shows where the explanation came from. Here it is <strong>${escHtml(data.diagnosis_source || 'unknown')}</strong>.</p>
      <p><strong>grounding_status</strong> is <strong>${escHtml(data.grounding_status || 'unknown')}</strong>. ${escHtml(grounding)}</p>
      <ul class="diag-list">
        ${grounded}
        ${unavailable}
      </ul>
      <p><strong>hallucination_check</strong> is the system's note about whether the diagnosis used live evidence or relied on runbooks.</p>
    </div>
  `;
}

function setLiveExplainerIdle(message) {
  const body = document.getElementById('live-explainer-body');
  if (!body) return;
  body.innerHTML = `<p>${escHtml(message)}</p>`;
  syncDetachedPanels();
}

function describeIncidentKind(kind) {
  const messages = {
    diagnose: 'A diagnose entry means the system analyzed a fault and produced a remediation recommendation.',
    remediate: 'A remediate entry means the system tried to act on a runbook or recovery workflow.',
  };
  return messages[kind] || 'This incident entry records one step in the fault response workflow.';
}

function explainParsedXid(xid) {
  const messages = {
    '48': 'XID 48 usually points to an uncorrectable ECC memory event, which is a hardware-integrity problem rather than just a performance warning.',
    '74': 'XID 74 usually points to NVLink link trouble such as CRC errors, which means GPU-to-GPU communication may be degraded.',
    '79': 'XID 79 usually means the GPU became unreachable on the bus, which is a severe stability failure and often requires reset or reboot.',
  };
  return messages[xid] || 'The parser found a known NVIDIA fault code, but this code does not yet have a beginner-specific explanation in the UI.';
}


let metrics = {
  util:82, vram_used:54, vram_total:80, temp:71, power:420,
  sbe:0, dbe:0, xid:'none',
  ib:'Active', nccl:'IB', ar:'180 GB/s',
  sutil:24, srw:890
};

// --- RECONSTITUTION LOGIC ---
function runInstantSentinel() {
    const bp = document.getElementById('sel-blueprint').value;
    const fab = document.getElementById('sel-fabric').value;
    const warning = document.getElementById('sentinel-warning');

    if (typeof validateHardwareConfig === 'function') {
        const audit = validateHardwareConfig(bp, fab);
        if (!audit.isMatch) {
            warning.innerHTML = `⚠ INSTANTANEOUS MISMATCH:<br>${audit.reason}`;
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }
}

function applyProvisioning() {
    const selection = document.getElementById('sel-blueprint').value;
    const fabric = document.getElementById('sel-fabric').value;

    if (typeof HARDWARE_LIBRARY !== 'undefined') {
        currentBlueprint = { ...HARDWARE_LIBRARY[selection], fabric };
    }

    isProvisioned = true;
    // Sprint 13: Persist blueprint choice so page refresh restores provisioning
    localStorage.setItem('gpusim_blueprint', selection);
    localStorage.setItem('gpusim_fabric', fabric);
    document.getElementById('recon-overlay').style.display = 'none';
    document.getElementById('sys-status').innerHTML = `SYSTEM: <span style="color:var(--green)">ONLINE</span> | RACK: <span style="color:var(--green)">${currentBlueprint ? currentBlueprint.name : selection}</span>`;

    const svg = document.getElementById('diagram-canvas');
    clearCanvas();
    if (typeof drawRackElevation === 'function') {
        drawRackElevation(svg);
    } else {
        drawWelcome(svg);
    }
}

// --- ENGINE LOGIC ---
function loadLab(id) {
  if (!isProvisioned) return;
  clearCanvas();
  clearTerminal();
  currentLab = id;
  currentStep = -1;
  if (beginnerMode && !labCoachOpen) setLabCoachOpen(true);

  const lab = LABS[id];
  document.getElementById('scen-title').textContent = lab.name;
  document.getElementById('scen-desc').textContent  = lab.objective;
  document.getElementById('scen-step').style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-'+id)?.classList.add('active');

  const sc = document.getElementById('step-controls');
  sc.innerHTML = '';
  lab.steps.forEach((s,i) => {
    const btn = document.createElement('button');
    btn.className = 'step-btn' + (s.fault ? ' fault' : '');
    btn.textContent = (i+1) + '. ' + s.label;
    btn.onclick = () => runStep(id, i);
    sc.appendChild(btn);
  });

  termLines.dmesg = typeof DMESG_CLEAN !== 'undefined' ? DMESG_CLEAN : [];
  termLines.dcgm  = typeof DCGM_CLEAN !== 'undefined' ? DCGM_CLEAN : [];
  if(activeTab==='dmesg') renderTab('dmesg');
  if(activeTab==='dcgm')  renderTab('dcgm');
  renderLabStepCoach();

  showIntro(id);

  const svg = document.getElementById('diagram-canvas');
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  if(lab.draw) lab.draw(svg, -1);
}

function runStep(labId, stepIdx) {
  if(currentLab !== labId) return;
  currentStep = stepIdx;
  if (beginnerMode && !labCoachOpen) setLabCoachOpen(true);
  const lab = LABS[labId];
  const step = lab.steps[stepIdx];

  document.querySelectorAll('.step-btn').forEach((btn,i) => {
    btn.classList.toggle('active', i===stepIdx);
  });

  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Step ${stepIdx+1}/${lab.steps.length}`;
  document.getElementById('scen-desc').textContent = step.label;
  const cmdInput = document.getElementById('cmd-input');
  if (cmdInput) cmdInput.value = step.cmd || '';

  switchTab('term');
  clearTerminal();
  logTerm([{t:'prompt',v:`[gpu-node-01] `},{t:'cmd',v:step.cmd}]);

  const out = (typeof TERMINAL_OUTPUT !== 'undefined' && TERMINAL_OUTPUT[step.type]) ? [...TERMINAL_OUTPUT[step.type]] : [{t:'dim',v:'# (output executed)'}];
  getBranchPenaltyMessages(labId, stepIdx).forEach(message => {
    out.push({ t: 'warn', v: message });
  });
  let delay = 300;
  out.forEach((line,i) => {
    setTimeout(()=>{
      logTerm([line]);
      scrollTerminal();
    }, delay + i*60);
  });

  const svg = document.getElementById('diagram-canvas');
  clearCanvas();
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  setTimeout(()=> { if(lab.draw) lab.draw(svg, stepIdx); }, 100);

  updateMetrics(labId, stepIdx, step);
  addXIDLog(labId, stepIdx, step);
  renderLabStepCoach();
  recordLabReasoningProgress(labId, stepIdx, getReasoningScorecardContext(labId, step));

  // Sprint 18: Surface AIOps Engine for fault steps
  const aiFaultTargets = {
    ecc_xid: { xid: '48', node: 2 },
    xid48: { xid: '48', node: 2 },
    xid79: { xid: '79', node: 3 },
    xid74: { xid: '74', node: 0 }
  };
  const aiFault = aiFaultTargets[step.type];
  if (step.fault && aiFault) {
    const aiBtn = document.createElement('button');
    aiBtn.className = 'btn';
    aiBtn.style.cssText = 'background:var(--copper);color:#000;font-weight:700;width:100%;margin-top:12px;padding:9px 0;font-size:12px;letter-spacing:0.05em;';
    aiBtn.textContent = '🤖 Engage AIOps Engine — XID ' + aiFault.xid;
    aiBtn.onclick = () => requestAI_Remediation(aiFault.xid, aiFault.node);
    document.getElementById('step-controls').appendChild(aiBtn);
  }

  if(stepIdx === lab.steps.length-1) {
    const cleanFinish = isLabCompletionClean(labId);
    completedLabs.add(labId);
    localStorage.setItem('gpusim_completed', JSON.stringify([...completedLabs]));
    recordLabCompletionOutcome(labId, cleanFinish);
    document.getElementById('b-'+labId).textContent = cleanFinish ? '✓' : '!';
    document.getElementById('nav-'+labId).classList.add('done');
    if (!cleanFinish) document.getElementById('nav-'+labId).classList.add('fault');
    document.getElementById('h-done').textContent = completedLabs.size;
    setTimeout(() => logTerm([{
      t: cleanFinish ? 'good' : 'warn',
      v: cleanFinish
        ? `\n✓ Lab complete: ${lab.name}`
        : `\n! Lab reached the end, but the incident path stayed compromised: ${lab.name}`
    }]), out.length*60+500);
  }
}

function runCurrentStep() {
  if(!currentLab) return;
  if (currentStep >= 0 && isBranchDetourPending(currentLab, currentStep)) {
    if (runBranchDetour(currentLab, currentStep)) return;
  }
  const lab = LABS[currentLab];
  const next = currentStep+1;
  if(next < lab.steps.length) runStep(currentLab, next);
}

function updateMetrics(labId, step, stepDef) {
  const branchContext = getBranchConsequenceContext(labId, step);
  const fault = stepDef.fault;
  let util=82, vram=54, temp=71, power=420;
  let sbe=0, dbe=0, xid='none';
  let ib='Active', nccl='IB', ar='180 GB/s';
  let sutil=24, srw=890;

  if(labId==='ecc') {
    sbe = [0,0,0,3,16,58,58][Math.min(step,6)];
    dbe = [0,0,0,0,0,1,2][Math.min(step,6)];
    xid = dbe>0?'48':sbe>20?'—':'none';
  }
  if(labId==='nvlink_fault' && step>=2) { ar='3 GB/s'; }
  if(labId==='allreduce' && step===4) { nccl='TCP'; ar='8 GB/s'; }
  if(labId==='nccl_fallback' && step<3) { nccl='TCP'; ar='8 GB/s'; }
  if(labId==='storage' && step>=1 && step<5) { util=40; sutil=100; srw=446; }
  if(labId==='storage' && step>=5) { util=93; sutil=28; srw=3200; }
  if(labId==='ib_fabric' && step>=3) { ib='Down (node-06)'; }
  if(labId==='nvlink_fault' && step===0) { dbe=2; xid='48'; }
  if(labId==='nvlink_fault' && step===2) { xid='79'; util=0; }
  if(labId==='nvlink_fault' && step===4) { xid='74'; }
  if(fault) temp = Math.min(temp+12, 86);
  if(labId==='training' && step>=1 && step<=4) { util=94; }

  if (branchContext.hasPenalty) {
    if (branchContext.dominantDomain === 'fault_isolation') {
      temp = Math.min(temp + (branchContext.badCount ? 4 : 2), 91);
      util = Math.max(util - (branchContext.badCount ? 26 : 12), 0);
      if (step >= 1 && xid === 'none') xid = 'risk';
    } else if (branchContext.dominantDomain === 'fabric_path') {
      nccl = 'TCP';
      ar = branchContext.badCount ? '5 GB/s' : '8 GB/s';
      ib = branchContext.badCount && labId === 'ib_fabric' ? 'Flapping' : ib;
    } else if (branchContext.dominantDomain === 'runtime_delivery') {
      util = Math.max(util - (branchContext.badCount ? 18 : 10), 0);
      power = Math.max(power - (branchContext.badCount ? 80 : 40), 240);
    } else if (branchContext.dominantDomain === 'platform_efficiency') {
      util = Math.max(util - (branchContext.badCount ? 24 : 12), 0);
      sutil = Math.min(sutil + (branchContext.badCount ? 25 : 12), 100);
      srw = Math.max(srw - (branchContext.badCount ? 350 : 180), 120);
    }
  }

  setMetric('m-util', util+'%', util<20?'err':util>85?'ok':'warn');
  setMetric('m-vram', `${vram}/80GB`, 'ok');
  setMetric('m-temp', temp+'°C', temp>83?'err':temp>78?'warn':'ok');
  setMetric('m-power', power+'W', power>680?'warn':'ok');
  setMetric('m-sbe', sbe.toString(), sbe>0?'warn':'ok');
  setMetric('m-dbe', dbe.toString(), dbe>0?'err':'ok');
  setMetric('m-xid', xid, xid!=='none'?'err':'dim');
  setMetric('m-ib',  ib, ib==='Active'?'ok':'err');
  setMetric('m-nccl',nccl, nccl==='IB'?'ok':'warn');
  setMetric('m-ar',  ar, ar==='180 GB/s'||ar.includes('182')||ar.includes('187')?'ok':'warn');
  setMetric('m-sutil',sutil+'%', sutil>90?'err':sutil>60?'warn':'ok');
  setMetric('m-srw', srw.toString(), 'ok');

  setBar('mb-util',  util, util<30?'var(--red)':util>80?'var(--green)':'var(--yellow)');
  setBar('mb-vram',  (vram/80)*100, 'var(--blue)');
  setBar('mb-temp',  (temp/100)*100, temp>83?'var(--red)':temp>78?'var(--yellow)':'var(--yellow)');
  setBar('mb-power', (power/700)*100, 'var(--copper)');
  setBar('mb-sutil', sutil, sutil>90?'var(--red)':sutil>60?'var(--yellow)':'var(--cyan)');
}

function setMetric(id, val, cls) {
  const el = document.getElementById(id);
  if(el){ el.textContent=val; el.className='metric-value '+cls; }
}
function setBar(id, pct, color) {
  const el = document.getElementById(id);
  if(el){ el.style.width=Math.min(pct,100)+'%'; el.style.background=color; }
}

function addXIDLog(labId, step, stepDef) {
  const branchContext = getBranchConsequenceContext(labId, step);
  const log = document.getElementById('xid-log-entries');
  const time = new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const entry = document.createElement('div');
  entry.className = 'xid-entry';
  let msg = `[${time}] ${LABS[labId].name}: step ${step+1}`;
  if(stepDef.fault) { entry.className = 'xid-entry warn'; msg = `[${time}] ⚠ ${stepDef.label}`; }
  if(labId==='ecc' && step>=3) { entry.className = 'xid-entry crit'; msg = `[${time}] ✗ XID 48 — DBE error`; }
  if(labId==='nvlink_fault' && step===2) { entry.className = 'xid-entry crit'; msg = `[${time}] ✗ XID 79 — GPU hung`; }
  entry.textContent = msg;
  log.prepend(entry);
  if (branchContext.hasPenalty) {
    const branchEntry = document.createElement('div');
    branchEntry.className = `xid-entry ${branchContext.badCount ? 'crit' : 'warn'}`;
    branchEntry.textContent = `[${time}] Branch consequence — ${getBranchPenaltyMessages(labId, step)[0]}`;
    log.prepend(branchEntry);
  }
  while(log.children.length > 8) log.removeChild(log.lastChild);
}

function logTerm(lines) {
  const out = document.getElementById('terminal-output');
  lines.forEach(({t,v}) => {
    const span = document.createElement('div');
    span.className = 't-'+t;
    span.textContent = v;
    out.appendChild(span);
    termLines.term.push({t, v});
    if(termLines.term.length > 500) termLines.term.shift();
  });
}

function clearTerminal() {
  document.getElementById('terminal-output').innerHTML = '';
  termLines.term = [];
}

function scrollTerminal() {
  const out = document.getElementById('terminal-output');
  out.scrollTop = out.scrollHeight;
}

function switchTab(tab) {
  activeTab = tab;
  
  // 1. Highlight the active tab
  ['term','dmesg','dcgm','parser'].forEach(t => {
    const el = document.getElementById('tab-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });
  
  const out = document.getElementById('terminal-output');
  const parserUi = document.getElementById('parser-ui');
  const inputRow = document.getElementById('terminal-input-row');
  
  // 2. Toggle UI Visibility
  if (tab === 'parser') {
      if(out) out.style.display = 'none';
      if(inputRow) inputRow.style.display = 'none';
      if(parserUi) parserUi.style.display = 'flex';
  } else {
      if(out) out.style.display = 'block';
      if(inputRow) inputRow.style.display = 'flex';
      if(parserUi) parserUi.style.display = 'none';
      
      // 3. Render standard logs if not the parser
      out.innerHTML = '';
      if (tab === 'term') {
        termLines.term.forEach(({t,v}) => {
          const div = document.createElement('div');
          div.className = 't-' + t;
          div.textContent = v;
          out.appendChild(div);
        });
      } else {
        const data = (tab==='dmesg') ? (typeof DMESG_CLEAN!=='undefined'?DMESG_CLEAN:[]) : (typeof DCGM_CLEAN!=='undefined'?DCGM_CLEAN:[]);
        data.forEach(({t,v}) => {
          const div = document.createElement('div');
          div.className = 't-' + t;
          div.textContent = v;
          out.appendChild(div);
        });
      }
  }
  renderLabStepCoach();
}

function renderTab(tab) {
  const out = document.getElementById('terminal-output');
  out.innerHTML='';
  const data = (tab==='dmesg') ? (typeof DMESG_CLEAN !== 'undefined' ? DMESG_CLEAN : []) : (typeof DCGM_CLEAN !== 'undefined' ? DCGM_CLEAN : []);
  data.forEach(({t,v})=>{
    const div = document.createElement('div');
    div.className='t-'+t; div.textContent=v;
    out.appendChild(div);
  });
}

function handleCustomCommand(cmd) {
  const c = cmd.toLowerCase();
  if(c.includes('nvidia-smi') && !c.includes('dmon') && !c.includes('topo') && !c.includes('nvlink')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.smi_check?.forEach(l=>logTerm([l]));
  } else if(c.includes('ibstat')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.ib_stat?.forEach(l=>logTerm([l]));
  } else if(c.includes('dmesg')) {
    if(typeof DMESG_CLEAN !== 'undefined') DMESG_CLEAN.slice(-5).forEach(l=>logTerm([l]));
  } else if(c.includes('kubectl get pods')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.k8s_operator?.forEach(l=>logTerm([l]));
  } else {
    logTerm([{t:'dim',v:'# Tip: use the step buttons above for guided lab output and read the Lab Coach panel on the right for what to look for.'}]);
  }
}

function showIntro(id) {
  const lab = LABS[id];
  const guide = getLearningGuide(id);
  const el = document.getElementById('intro-content');
  if (!lab || !el) return;

  const guideMarkup = renderLearningGuide(id);
  const modeNote = incidentMode
    ? '<div class="learn-banner learn-banner-compact"><div class="learn-banner-title">Incident Mode is on</div><p>This lab is now using reduced scaffolding. Focus on what is known, what is still unproven, and the next safe move.</p></div>'
    : guide?.hideModeNote ? '' : (beginnerMode
    ? '<div class="learn-banner"><div class="learn-banner-title">Beginner Mode is on</div><p>Real operator jargon stays visible, but each term is explained in plain language so you build vocabulary while you learn.</p></div>'
    : '<div class="learn-banner learn-banner-compact"><div class="learn-banner-title">Compact lab brief</div><p>Turn on Beginner Mode for deeper explanations, lifecycle context, and slower reading material.</p></div>');
  const objectiveTitle = guide?.objectiveTitle || 'Objective';
  const objectiveText = guide?.objectiveText || lab.objective;

  el.innerHTML = `
    <h2>${lab.icon} ${lab.name}</h2>
    ${modeNote}
    <div class="objective">
      <h4>${escHtml(objectiveTitle)}</h4>
      <p>${escHtml(tightenDisplayCopy(objectiveText))}</p>
    </div>
    ${guide ? guideMarkup : ''}
    <section class="learn-section">
      <div class="learn-heading-row">
        <h4>Lab Steps</h4>
        <span class="learn-mode-tag">Guided flow</span>
      </div>
      ${renderGuidedFlowSteps(lab)}
    </section>
  `;
  document.getElementById('intro-overlay').classList.add('show');
  renderDetachedPanel('introOverlay');
}

function closeIntro() {
  document.getElementById('intro-overlay').classList.remove('show');
}

function startLab() {
  closeIntro();
  if(currentLab) runStep(currentLab, 0);
}

const EXAM_STUDY_GUIDES = {
  nca_aiio: {
    code: 'NCA-AIIO',
    title: 'NVIDIA-Certified Associate: AI Infrastructure and Operations',
    examShape: 'Associate-level, 50 questions, 60 minutes. The goal is foundational infrastructure reasoning, not memorizing every command flag.',
    mentalModel: [
      'GPU hardware is the capacity. The driver makes it visible to Linux. CUDA and libraries make it usable by applications. Containers and schedulers deliver it to workloads. Telemetry and logs tell operators whether that chain is still trustworthy.',
      'When an exam question gives you a symptom, first locate the broken layer: hardware, driver, CUDA/runtime, container, scheduler, network, storage, or observability.',
      'A correct operator answer usually preserves evidence, protects running workloads, and chooses the smallest safe recovery step before broad changes.'
    ],
    path: [
      {
        phase: '1',
        title: 'GPU Foundations',
        labs: ['cuda_stack', 'mig', 'nvlink'],
        examFocus: 'Know what the GPU, driver, CUDA runtime, MIG, and NVLink each do in the stack.',
        plain: 'This is the vocabulary layer. If you cannot explain what each layer owns, every later troubleshooting question feels random.',
        connectDots: [
          'A visible GPU does not prove CUDA is healthy.',
          'A healthy driver does not prove the container can access the GPU.',
          'A multi-GPU node is only valuable for distributed work if the fast GPU-to-GPU path is healthy.'
        ],
        trap: 'Do not collapse all GPU problems into hardware failure. Many exam scenarios are compatibility or exposure problems above healthy hardware.'
      },
      {
        phase: '2',
        title: 'Health Signals And Fault Codes',
        labs: ['ecc', 'nvlink_fault', 'monitoring'],
        examFocus: 'Read ECC counters, XID events, DCGM signals, and alert evidence as an operator story.',
        plain: 'This is where raw numbers become decisions. SBE is a warning trend, DBE is an integrity problem, and XID codes tell you which fault family to confirm next.',
        connectDots: [
          'SBE means the GPU corrected memory trouble. Trend matters.',
          'DBE means uncorrectable memory trouble. Containment matters.',
          'XID 48, 74, and 79 point to different fault families, so they should not all trigger the same recovery path.'
        ],
        trap: 'The code is not the whole diagnosis. Use it to choose the next evidence source and the safe containment step.'
      },
      {
        phase: '3',
        title: 'Workload Delivery',
        labs: ['container', 'k8s', 'slurm', 'training'],
        examFocus: 'Understand how validated images, GPU runtimes, Kubernetes, Slurm, and distributed jobs consume GPU capacity.',
        plain: 'This is the scheduling layer. The machine may be healthy while the workload still cannot land, start, or see a GPU.',
        connectDots: [
          'Containers reduce environment drift, but the runtime still has to expose GPUs.',
          'Kubernetes extended resources such as nvidia.com/gpu are allocated as whole integer resources.',
          'Distributed training may need gang scheduling so all ranks start together.'
        ],
        trap: 'A Pending pod or delayed Slurm job is not automatically a broken GPU. Read scheduler reasons before changing hardware or drivers.'
      },
      {
        phase: '4',
        title: 'Networking And Collectives',
        labs: ['ib_fabric', 'roce', 'allreduce', 'nccl_fallback'],
        examFocus: 'Connect InfiniBand, RoCE, NCCL path selection, topology, and AllReduce throughput.',
        plain: 'Distributed AI jobs spend a lot of time exchanging gradients. If the fabric falls back to a slow path, the GPUs may be present but expensive time is wasted.',
        connectDots: [
          'NCCL chooses a communication path. Logs reveal whether it is using IB, NVLink, or TCP fallback.',
          'InfiniBand Active means the port is up, not that every collective is configured correctly.',
          'RoCE depends on Ethernet lossless behavior, so PFC and ECN mistakes can become performance incidents.'
        ],
        trap: 'Do not tune batch size before checking whether NCCL is on the intended network path.'
      },
      {
        phase: '5',
        title: 'Storage And Data Flow',
        labs: ['storage', 'gds'],
        examFocus: 'Recognize GPU starvation caused by slow data delivery and know why GPUDirect Storage changes the path.',
        plain: 'A GPU can look underutilized because it is waiting for data, not because compute is weak. The exam often tests whether you can separate compute bottlenecks from input bottlenecks.',
        connectDots: [
          'Sawtooth GPU utilization often means data arrives in bursts.',
          'High storage utilization with low GPU utilization points away from CUDA and toward I/O.',
          'GPUDirect Storage can reduce CPU bounce-buffer overhead when the platform supports it.'
        ],
        trap: 'Low GPU utilization is not always a GPU problem. Check the data path before changing accelerator settings.'
      }
    ],
    checkpoints: [
      {
        title: 'Layer Check',
        prompt: 'A container starts, but PyTorch says CUDA is unavailable. Which layer do you inspect first?',
        answer: 'Container GPU exposure and runtime configuration. The image starting only proves the container process ran; it does not prove CUDA devices were passed through.'
      },
      {
        title: 'Evidence Check',
        prompt: 'A log shows XID 48 and DCGM DBE is non-zero. What is the safe operator posture?',
        answer: 'Treat it as a hardware-integrity incident: preserve evidence, drain or isolate the node, notify owners, and follow the hardware support path.'
      },
      {
        title: 'Performance Check',
        prompt: 'All GPUs are visible, but AllReduce is much slower and NCCL says Socket. What changed?',
        answer: 'The collective communication path fell back to TCP/socket instead of the intended high-speed fabric.'
      },
      {
        title: 'Scheduler Check',
        prompt: 'A Kubernetes pod is Pending with Insufficient nvidia.com/gpu. What does that usually mean?',
        answer: 'The requested GPU resource is not currently allocatable on schedulable nodes. It is a capacity or scheduling state clue, not proof of a driver failure.'
      }
    ]
  }
};

function getLabName(id) {
  return LABS[id]?.name || id;
}

function renderStudyLabLinks(labIds) {
  if (!labIds || !labIds.length) return '';
  return `
    <div class="study-lab-links">
      ${labIds.map(id => `
        <button class="study-lab-link" type="button" data-study-lab="${escHtml(id)}">
          <span>${escHtml(getLabName(id))}</span>
          <small>${escHtml(id)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderStudyGuide(examId = 'nca_aiio') {
  const guide = EXAM_STUDY_GUIDES[examId];
  if (!guide) return '<p>Study guide unavailable.</p>';

  return `
    <section class="study-hero">
      <div class="study-hero-kicker">${escHtml(guide.code)}</div>
      <h3>${escHtml(guide.title)}</h3>
      <p>${escHtml(tightenDisplayCopy(guide.examShape))}</p>
    </section>

    ${renderReasoningProgressSummary()}

    <section class="learn-section study-model">
      <div class="learn-heading-row">
        <h4>The Chain To Remember</h4>
        <span class="learn-mode-tag">Connect the dots</span>
      </div>
      ${renderParagraphs(guide.mentalModel)}
    </section>

    <section class="learn-section">
      <div class="learn-heading-row">
        <h4>Study Path</h4>
        <span class="learn-mode-tag">${guide.path.length} phases</span>
      </div>
      <div class="study-path">
        ${guide.path.map(item => `
          <article class="study-phase">
            <div class="study-phase-top">
              <div class="study-phase-num">${escHtml(item.phase)}</div>
              <div>
                <h5>${escHtml(item.title)}</h5>
                <div class="study-focus">${escHtml(item.examFocus)}</div>
              </div>
            </div>
            <p>${escHtml(tightenDisplayCopy(item.plain))}</p>
            <div class="study-mini-title">How it connects</div>
            ${renderBulletList(item.connectDots, 'study-list')}
            <div class="study-trap"><strong>Exam trap:</strong> ${escHtml(tightenDisplayCopy(item.trap))}</div>
            ${renderStudyLabLinks(item.labs)}
          </article>
        `).join('')}
      </div>
    </section>

    <section class="learn-section">
      <div class="learn-heading-row">
        <h4>Self Check</h4>
        <span class="learn-mode-tag">Explain out loud</span>
      </div>
      <div class="study-check-grid">
        ${guide.checkpoints.map(item => `
          <article class="study-check">
            <div class="study-mini-title">${escHtml(item.title)}</div>
            <p>${escHtml(item.prompt)}</p>
            <details>
              <summary>Show answer</summary>
              <div>${escHtml(item.answer)}</div>
            </details>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function openStudyGuide(examId = 'nca_aiio') {
  const content = document.getElementById('study-content');
  if (!content) return;
  content.innerHTML = renderStudyGuide(examId);
  document.getElementById('study-overlay')?.classList.add('show');
  renderDetachedPanel('studyOverlay');
}

function closeStudyGuide() {
  document.getElementById('study-overlay')?.classList.remove('show');
}

function openStudyLab(labId) {
  closeStudyGuide();
  if (!isProvisioned) {
    document.getElementById('recon-overlay').style.display = 'flex';
    return;
  }
  loadLab(labId);
}

// --- QUIZ DATA (Sprint 13: expanded to 20 questions, mapped to NCA-AIIO objectives) ---
const QUIZ = [
  // XID & ECC — NCA-AIIO: Hardware Fault Response
  {q:"dmesg shows 'NVRM: Xid (PCI:0000:83:00): 48'. What does XID 48 indicate and what is the first action?",
   opts:["NVLink CRC error — swap the NVLink cable","Double-Bit ECC uncorrectable error — drain the node and open an RMA","GPU fallen off the bus — reset the driver","Thermal throttle — reduce workload"],
   ans:1,exp:"XID 48 = Double-Bit ECC (DBE). A DBE is a hardware memory failure that cannot be corrected. The node must be drained immediately and an RMA opened with NVIDIA."},

  {q:"dcgmi dmon -e 157 shows value 1 on GPU 3 after 3 consecutive polls. What is your immediate action?",
   opts:["Wait for more polls to confirm","Drain the node, notify job owner, open NVIDIA RMA","Restart the NVIDIA driver","Reduce GPU power limit"],
   ans:1,exp:"Field 157 = DCGM_FI_DEV_ECC_DBE_VOL_TOTAL. Any non-zero volatile DBE count means an uncorrectable hardware error. Drain and RMA immediately."},

  {q:"dmesg reports 'GPU Board RmUninitializeClient: GPU-0000:43:00 has fallen off the bus'. Which XID code corresponds to this event?",
   opts:["XID 48","XID 74","XID 79","XID 13"],
   ans:2,exp:"XID 79 = GPU fallen off the bus (completely hung). First recovery step is 'nvidia-smi --gpu-reset -i <id>'. If that fails, a hard node reboot is required."},

  {q:"You run 'nvidia-smi --gpu-reset -i 3' after an XID 79 event and it fails with 'GPU is still in use'. What is the correct next step?",
   opts:["Kill all processes using the GPU, then retry the reset","Reboot the node — a failed reset after XID 79 requires a hard restart","Reduce the GPU power limit","Update the NVIDIA driver"],
   ans:1,exp:"If nvidia-smi --gpu-reset fails because processes are still attached, the node must be hard rebooted. A GPU that has fallen off the bus cannot be safely recovered without a full reboot."},

  {q:"nvidia-smi nvlink -e shows 'CRC Flit Error Count: 8472' on Link 2. Which XID and root cause does this represent?",
   opts:["XID 48 — memory hardware failure","XID 79 — GPU hang","XID 74 — NVLink CRC Flit error (cable or NVSwitch port fault)","XID 13 — graphics engine exception"],
   ans:2,exp:"XID 74 = NVLink CRC Flit Error. Indicates a signal integrity problem on the NVLink connection — faulty cable, connector, or NVSwitch port. Isolate the link and inspect physically."},

  // Thermal Throttling — NCA-AIIO: Thermal Management
  {q:"'nvidia-smi dmon -s p' shows GPU temp at 87C and SM utilization dropping from 94% to 40% intermittently. What is the most likely cause?",
   opts:["Insufficient VRAM causing page faults","GPU thermal throttling exceeding temperature threshold","NCCL TCP fallback reducing throughput","Lustre storage bottleneck"],
   ans:1,exp:"H100 GPUs begin thermal throttling around 83-87C, reducing clock speeds. The sawtooth SM utilization pattern is the classic signature. Check cooling, airflow, and power delivery."},

  {q:"A GPU consistently hits 88C. dcgmi shows no ECC errors. nvidia-smi -q -d PERFORMANCE shows 'HW Thermal SlowDown'. What is the correct escalation path?",
   opts:["Open an RMA immediately","Drain the node, inspect airflow and heatsink contact, then lower power cap with nvidia-smi -pl","Reinstall the NVIDIA driver","Increase batch size to reduce per-sample overhead"],
   ans:1,exp:"Thermal throttling is a cooling/infrastructure problem, not a software one. Drain to protect jobs, physically inspect airflow, and set a power cap ('nvidia-smi -pl <watts>') as a temporary mitigation."},

  {q:"Which DCGM field ID should you monitor to detect Single-Bit ECC errors (SBE) before they escalate to uncorrectable DBEs?",
   opts:["Field 100 (GPU utilization)","Field 156 (DCGM_FI_DEV_ECC_SBE_VOL_TOTAL)","Field 157 (DCGM_FI_DEV_ECC_DBE_VOL_TOTAL)","Field 203 (SM clock)"],
   ans:1,exp:"Field 156 = SBE volatile total. A rising SBE trend is a leading indicator of memory degradation. Alert on SBE trend (e.g. >50 SBEs) and schedule proactive maintenance before a DBE occurs."},

  // NCCL & Networking — NCA-AIIO: Distributed Training Networking
  {q:"NCCL_DEBUG=INFO shows 'Using network Socket'. Training is at 8 GB/s instead of 180 GB/s. What is the most targeted first check?",
   opts:["Reinstall NCCL","Run env | grep NCCL — check for NCCL_IB_DISABLE=1","Reboot all training nodes","Increase batch size"],
   ans:1,exp:"NCCL_IB_DISABLE=1 is the most common cause of TCP fallback. It overrides all IB detection. Always check env variables first before any hardware or software investigation."},

  {q:"After unsetting NCCL_IB_DISABLE, NCCL still falls back to TCP. ibstat shows all ports Active. What is the next most likely cause?",
   opts:["The NVIDIA driver needs updating","NCCL_IB_HCA is set to a non-existent HCA name — verify with ibstat and correct it","The NVLink topology is broken","A Kubernetes NetworkPolicy is blocking the rendezvous port"],
   ans:1,exp:"If IB hardware is active but NCCL still uses TCP, a misconfigured NCCL_IB_HCA pointing to a wrong HCA name is the next most common cause. Verify the exact HCA name from ibstat and set NCCL_IB_HCA accordingly."},

  {q:"A RoCEv2 cluster shows 'rx_pfc_frames' counter rising rapidly on the storage switch. Training throughput has degraded 40%. What condition does this indicate?",
   opts:["InfiniBand fabric failure","PFC storm — a feedback loop of pause frames causing fabric-wide head-of-line blocking","NCCL TCP fallback","GPU ECC errors corrupting gradient sync"],
   ans:1,exp:"A PFC storm occurs when pause frames propagate in a loop causing head-of-line blocking. Fix: lower ECN marking thresholds to reduce congestion before it triggers PFC, and verify no circular dependencies in the switch topology."},

  // NVLink & MIG — NCA-AIIO: Hardware Topology
  {q:"nvidia-smi topo -m shows 'PHB' between GPU0 and GPU1 instead of 'NV4'. AllReduce drops from 187 GB/s to 3 GB/s. What is the root cause?",
   opts:["NCCL TCP fallback due to NCCL_IB_DISABLE=1","The NVLink connection between those GPUs is broken, forcing PCIe traversal","ECC errors degrading VRAM bandwidth","GPU thermal throttling"],
   ans:1,exp:"PHB = PCIe Host Bridge traversal — NVLink is not active between those GPUs. AllReduce is forced over PCIe (~32 GB/s theoretical vs 900 GB/s for NVLink 4.0). Physical inspection or RMA may be required."},

  {q:"You need to partition one H100 into 7 isolated GPU slices with independent fault domains. What is the correct command sequence?",
   opts:["nvidia-smi -i 0 --multi-instance-gpu 7","sudo nvidia-smi -i 0 -mig 1 && sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C","sudo nvidia-smi partition --count 7","kubectl apply -f mig-7x.yaml"],
   ans:1,exp:"Profile '9' = 1g.10gb (1/7th of an H100). First enable MIG mode with '-mig 1', then create 7 compute instances. Each instance has independent ECC error domains."},

  // Storage — NCA-AIIO: I/O Optimization
  {q:"nvidia-smi dmon shows GPU utilization oscillating between 94% and 4% (sawtooth pattern). iostat shows NFS at 100% utilization. What is the correct diagnosis?",
   opts:["GPU thermal throttling","ECC memory errors causing retry storms","Storage I/O bottleneck — the DataLoader is starving the GPU","NCCL AllReduce stall"],
   ans:2,exp:"The sawtooth GPU utilization pattern is the definitive signature of a storage I/O bottleneck. The GPU finishes batches faster than the DataLoader can supply them. Fix: increase Lustre stripe count, increase DataLoader num_workers."},

  {q:"A Lustre filesystem shows 'stripe_count: 1' for a 2TB training dataset directory spread across 16 OSTs. What is the correct fix?",
   opts:["Increase PyTorch DataLoader num_workers only","Run 'lfs setstripe -c 8 /mnt/lustre/dataset' to stripe across 8 OSTs","Migrate to GPUDirect Storage immediately","Add more CPU cores to storage nodes"],
   ans:1,exp:"stripe_count:1 means all reads hit a single OST. Setting stripe_count to 8+ distributes reads across multiple OSTs, multiplying effective read bandwidth. Often the single highest-impact fix for storage-bound training."},

  // Monitoring & Operations — NCA-AIIO: Observability
  {q:"You need to scrape GPU metrics into Prometheus. On which port does DCGM Exporter expose its /metrics endpoint by default?",
   opts:[":9090 (same as Prometheus)",":9400",":8080",":2049"],
   ans:1,exp:"The DCGM Exporter exposes metrics on port 9400 by default. Grafana dashboard ID 12239 is the standard NVIDIA-provided dashboard for visualizing these metrics."},

  {q:"A Kubernetes training pod is stuck in Pending. 'kubectl describe pod' shows 'Insufficient nvidia.com/gpu'. All nodes show 'nvidia.com/gpu: 8' in describe node. What is the most likely cause?",
   opts:["The NVIDIA GPU Operator is not installed","All 8 GPU slots on every available node are currently allocated to other running pods","The pod spec requests nvidia.com/gpu: 0","The kubelet has not restarted since driver install"],
   ans:1,exp:"nvidia.com/gpu is an extended resource with integer semantics. If all slots are allocated, the pod must wait. Check for zombie or runaway GPU-holding pods that should be terminated."},

  {q:"A Slurm job shows Reason='Priority' in squeue. 'sshare -u alice' shows FairShare: 0.034. What does this mean?",
   opts:["Alice has consumed far more than her fair share — the scheduler deprioritizes her new jobs until usage decays","Alice has used very little and will be scheduled next","The Slurm controller has lost contact with Alice's node","The job needs more GPUs than are available"],
   ans:0,exp:"FairShare < 1.0 means a user has consumed more than their allocated share. The scheduler penalizes heavy users by reducing their priority. The share decays over time via PriorityDecayHalfLife. No admin action needed unless the policy itself is wrong."},

  // Kubernetes & Containers — NCA-AIIO: Orchestration
  {q:"A distributed training job requires all 16 pods across 2 nodes to start simultaneously or NCCL will hang. What Kubernetes feature enforces this all-or-nothing guarantee?",
   opts:["Pod Affinity with requiredDuringScheduling","Gang Scheduling via a PodGroup resource (Volcano or Coscheduler)","DaemonSet with a node selector","ResourceQuota at the namespace level"],
   ans:1,exp:"Gang scheduling (PodGroup via Volcano or Kubernetes Coscheduler) holds all pods in a group until the entire group can be scheduled simultaneously. Without it, partial scheduling causes NCCL init to hang waiting for all ranks."},

  {q:"A Kubernetes pod fails with 'CUDA error: no kernel image is available for execution on the device'. Container was built with CUDA 11.8. Cluster nodes have Driver 12.3. What is the correct fix?",
   opts:["Run 'nvidia-smi --gpu-reset' on the node","Rebuild the container using an NGC base image (nvcr.io/nvidia/pytorch:24.01-py3) that includes CUDA 12.x","Downgrade the node driver to match the container","Set CUDA_VISIBLE_DEVICES='' in the pod spec"],
   ans:1,exp:"CUDA 11.8 does not include sm_90 kernels required by H100 GPUs (compute capability 9.0 was introduced in CUDA 11.8 but full support arrived in CUDA 12.x). Rebuilding with an NGC image based on CUDA 12.x ensures the correct sm_90 PTX/SASS kernels are present. Note: newer drivers ARE backwards-compatible with older CUDA runtimes — the issue here is missing GPU architecture support, not driver version mismatch."}
];

let quizState = {};

function openQuiz() {
  quizState = { answers:{}, submitted:false };
  const el = document.getElementById('quiz-content');
  if (!el) return;

  el.replaceChildren();
  QUIZ.forEach((q, i) => {
    const question = document.createElement('div');
    question.className = 'quiz-q';
    question.id = `qq-${i}`;

    const text = document.createElement('div');
    text.className = 'q-text';
    text.textContent = `${i + 1}. ${q.q}`;
    question.appendChild(text);

    q.opts.forEach((opt, j) => {
      const option = document.createElement('div');
      option.className = 'quiz-option';
      option.id = `qo-${i}-${j}`;
      option.dataset.quizQuestion = String(i);
      option.dataset.quizOption = String(j);

      const key = document.createElement('span');
      key.className = 'opt-key';
      key.textContent = String.fromCharCode(65 + j);
      option.appendChild(key);
      option.appendChild(document.createTextNode(opt));
      question.appendChild(option);
    });

    const explain = document.createElement('div');
    explain.className = 'quiz-explain';
    explain.id = `qe-${i}`;
    explain.textContent = tightenDisplayCopy(q.exp);
    question.appendChild(explain);

    el.appendChild(question);
  });

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;margin-top:16px;align-items:center';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-sm primary';
  submitBtn.dataset.quizAction = 'submit';
  submitBtn.textContent = 'Submit Answers';
  actions.appendChild(submitBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-sm';
  resetBtn.dataset.quizAction = 'reset';
  resetBtn.textContent = 'Reset';
  actions.appendChild(resetBtn);

  const progress = document.createElement('div');
  progress.id = 'quiz-progress';
  progress.style.cssText = 'margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--dim)';
  progress.textContent = `0/${QUIZ.length} answered`;
  actions.appendChild(progress);

  const result = document.createElement('div');
  result.id = 'quiz-result';

  el.appendChild(actions);
  el.appendChild(result);
  document.getElementById('quiz-overlay').classList.add('show');
  renderDetachedPanel('quizOverlay');
}

function selectAnswer(qi, optIdx) {
  if(quizState.submitted) return;
  quizState.answers[qi] = optIdx;
  document.querySelectorAll(`[id^="qo-${qi}-"]`).forEach(el=>el.classList.remove('selected'));
  document.getElementById(`qo-${qi}-${optIdx}`).classList.add('selected');
  document.getElementById('quiz-progress').textContent = `${Object.keys(quizState.answers).length}/${QUIZ.length} answered`;
  renderDetachedPanel('quizOverlay');
}

function submitQuiz() {
  quizState.submitted = true;
  let correct=0;
  QUIZ.forEach((q,i)=>{
    const chosen = quizState.answers[i];
    if(chosen === undefined) return;
    if(chosen === q.ans) correct++;
    document.getElementById(`qo-${i}-${q.ans}`).classList.add('correct');
    if(chosen !== q.ans) document.getElementById(`qo-${i}-${chosen}`)?.classList.add('wrong');
    document.getElementById(`qe-${i}`).classList.add('show');
  });
  const pct = Math.round((correct/QUIZ.length)*100);
  const quizScorecard = {
    domain: 'knowledge_check',
    score: Math.round((correct / QUIZ.length) * 6),
    maxScore: 6,
    categories: [
      {
        label: 'Coverage',
        status: Object.keys(quizState.answers).length === QUIZ.length ? 'strong' : 'watch',
        text: Object.keys(quizState.answers).length === QUIZ.length
          ? 'All questions were answered, so the score reflects full coverage.'
          : 'Some questions were skipped, so the result is incomplete.',
      },
      {
        label: 'Accuracy',
        status: pct >= 85 ? 'strong' : pct >= 65 ? 'good' : 'watch',
        text: pct >= 85
          ? 'The user is recognizing the intended operator answers consistently.'
          : pct >= 65
            ? 'The user is catching many of the intended answers, but there are still reasoning gaps.'
            : 'The quiz result suggests the user is still missing core distinctions between failure classes.',
      },
      {
        label: 'Troubleshooting readiness',
        status: pct >= 80 ? 'good' : 'watch',
        text: pct >= 80
          ? 'This score suggests the user is approaching deployable troubleshooting judgment for these scenarios.'
          : 'This score suggests more guided lab work is needed before relying on unaided troubleshooting judgment.',
      },
    ],
  };
  reasoningScoreState.lastQuiz = quizScorecard;
  recordQuizReasoningProgress(pct, quizScorecard);
  document.getElementById('quiz-result').innerHTML = `
    <div class="quiz-score">
      <span class="score-num">${pct}%</span>
      <div class="score-label">Quiz accuracy</div>
    </div>
    ${renderReasoningScorecard(quizScorecard, {
      title: 'Assessment Scorecard',
      subtitle: 'This scorecard treats the quiz as a readiness check, not just a percent grade.',
    })}
  `;
  document.getElementById('h-score').textContent = pct+'%';
  localStorage.setItem('gpusim_score', pct);
  renderDetachedPanel('quizOverlay');
}

function resetQuiz() { quizState = {}; openQuiz(); }
function closeQuiz() { document.getElementById('quiz-overlay').classList.remove('show'); }

function renderRunbookButton(xid) {
  const stepControls = document.getElementById('step-controls');
  if (!stepControls) return;

  stepControls.replaceChildren();
  const button = document.createElement('button');
  button.className = 'btn';
  button.style.cssText = 'background:var(--copper); color:#000; font-weight:bold; width:100%; margin-top:10px;';
  button.textContent = '▶ EXECUTE AUTONOMOUS RUNBOOK';
  button.addEventListener('click', () => executeRunbook(xid));
  stepControls.appendChild(button);
}

function setIncidentBodyMessage(body, message, color = 'var(--dim)') {
  body.replaceChildren();
  const notice = document.createElement('div');
  notice.style.cssText = `color:${color};font-size:11px;padding:10px`;
  notice.textContent = message;
  body.appendChild(notice);
}

function renderIncidentHistory(body, rows) {
  body.replaceChildren();
  const fmt = ts => new Date(ts * 1000).toISOString().replace('T',' ').slice(0,19);
  const kindColor = kind => kind === 'diagnose' ? 'var(--blue)' : 'var(--copper)';

  rows.forEach(row => {
    const item = document.createElement('div');
    item.style.cssText = 'border-bottom:1px solid var(--border);padding:8px 0;font-size:11px;font-family:var(--font-mono)';

    const kind = document.createElement('span');
    kind.style.cssText = `color:${kindColor(row.kind)};text-transform:uppercase;font-weight:700`;
    kind.textContent = String(row.kind || 'unknown');
    item.appendChild(kind);

    const fault = document.createElement('span');
    fault.style.cssText = 'color:var(--text);margin:0 8px';
    fault.textContent = `XID ${row.fault ?? 'unknown'}`;
    item.appendChild(fault);

    const timestamp = document.createElement('span');
    timestamp.style.cssText = 'color:var(--dim)';
    timestamp.textContent = fmt(row.ts);
    item.appendChild(timestamp);

    const user = document.createElement('span');
    user.style.cssText = 'color:var(--dim);margin-left:8px';
    user.textContent = `by ${row.user || 'unknown'}`;
    item.appendChild(user);

    if (row.status) {
      const status = document.createElement('span');
      status.style.cssText = 'color:var(--green);margin-left:8px';
      status.textContent = `[${row.status}]`;
      item.appendChild(status);
    }

    if (row.source) {
      const source = document.createElement('span');
      source.style.cssText = 'color:var(--dim);margin-left:8px';
      source.textContent = `src:${row.source}`;
      item.appendChild(source);
    }

    if (row.summary) {
      const summary = document.createElement('div');
      summary.style.cssText = 'color:var(--dim);margin-top:4px;white-space:pre-wrap;word-break:break-word';
      const truncated = row.summary.length > 200 ? `${row.summary.slice(0, 200)}…` : row.summary;
      summary.textContent = truncated;
      item.appendChild(summary);
    }

    if (beginnerMode) {
      const explain = document.createElement('div');
      explain.className = 'incident-explain';
      explain.textContent = describeIncidentKind(row.kind || 'unknown');
      item.appendChild(explain);
    }

    body.appendChild(item);
  });
}

function resetAll() {
  completedLabs.clear();
  document.getElementById('h-done').textContent='0';
  document.getElementById('h-score').textContent='—';
  document.getElementById('h-judgment').textContent='—';
  localStorage.removeItem('gpusim_completed');
  localStorage.removeItem('gpusim_score');
  localStorage.removeItem('gpusim_reasoning_progress');
  localStorage.removeItem('gpusim_branching_state');
  reasoningProgress = { steps: {}, quizzes: [], completion: {} };
  branchingState = {};
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active','done'));
  clearCanvas();
  clearTerminal();
  currentLab=null; currentStep=-1;
  document.getElementById('scen-title').textContent='GPU Infrastructure Simulator';
  document.getElementById('scen-step').style.display='none';
  document.getElementById('step-controls').innerHTML='';

  const svg=document.getElementById('diagram-canvas');
  if (typeof drawRackElevation === 'function' && isProvisioned) {
      drawRackElevation(svg);
  } else if (typeof drawWelcome === 'function') {
      drawWelcome(svg);
  }
}


// ── Sprint 21: bindUIHandlers — replaces all inline HTML event handlers ──
function bindUIHandlers() {
  if (_uiHandlersBound) return;
  _uiHandlersBound = true;
  const on = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

  // Login overlay
  on('btn-login',  'click', aegisLogin);
  const passEl = document.getElementById('login-pass');
  if (passEl) passEl.addEventListener('keydown', e => { if(e.key==='Enter') aegisLogin(); });

  // Header
  on('btn-quiz',    'click', openQuiz);
  on('btn-study',   'click', () => openStudyGuide('nca_aiio'));
  on('btn-blueprint', 'click', () => { document.getElementById('recon-overlay').style.display = 'flex'; });
  on('btn-learn',   'click', () => { if (currentLab) showIntro(currentLab); });
  on('btn-logout',  'click', aegisLogout);
  on('btn-reset',   'click', resetAll);
  on('toggle-beginner', 'change', e => setBeginnerMode(e.target.checked));
  on('toggle-incident-mode', 'change', e => setIncidentMode(e.target.checked));
  on('toggle-llm-diagnosis', 'change', e => setLLMDiagnosisEnabled(e.target.checked));
  on('sel-explain-level', 'change', e => setExplanationLevel(e.target.value));
  on('sel-explain-role', 'change', e => setExplanationRole(e.target.value));
  on('btn-toggle-coach', 'click', toggleLabCoach);
  on('btn-close-coach', 'click', () => setLabCoachOpen(false));
  on('btn-popout-coach', 'click', () => openDetachedPanel('stepCoach'));
  on('btn-popout-live-explainer', 'click', () => openDetachedPanel('liveExplainer'));
  on('btn-popout-intro', 'click', () => openDetachedPanel('introOverlay'));
  on('btn-popout-study', 'click', () => openDetachedPanel('studyOverlay'));
  on('btn-popout-quiz', 'click', () => openDetachedPanel('quizOverlay'));
  const coachEl = document.getElementById('lab-step-coach');
  if (coachEl) coachEl.addEventListener('click', handleLabCoachClick);

  // Sidebar
  on('sidebar-btn-study', 'click', () => openStudyGuide('nca_aiio'));
  on('sidebar-btn-quiz', 'click', openQuiz);

  // Provisioning
  on('sel-blueprint', 'change', runInstantSentinel);
  on('sel-fabric',    'change', runInstantSentinel);
  on('btn-apply',     'click',  applyProvisioning);

  // Live/thermal toggles (3 instances each)
  ['toggle-live','sidebar-toggle-live','quiz-toggle-live'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleAppMode(el.checked));
  });
  ['toggle-thermal','sidebar-toggle-thermal','quiz-toggle-thermal'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleThermalView(el.checked));
  });

  // Terminal controls
  on('btn-clear-term', 'click', clearTerminal);
  on('toggle-ai-btn',  'click', toggleAIDoc);
  on('run-btn',        'click', runCurrentStep);
  on('btn-analyze',    'click', analyzeLog);

  // Terminal tabs
  ['term','dmesg','dcgm','parser'].forEach(tab => {
    on('tab-'+tab, 'click', () => switchTab(tab));
  });

  // Intro modal
  on('btn-intro-close', 'click', closeIntro);
  on('btn-intro-skip',  'click', closeIntro);
  on('btn-intro-start', 'click', startLab);

  // Quiz modal
  on('btn-quiz-close', 'click', closeQuiz);
  on('btn-study-close', 'click', closeStudyGuide);
  const studyContent = document.getElementById('study-content');
  if (studyContent) studyContent.addEventListener('click', e => {
    const labLink = e.target.closest('[data-study-lab]');
    if (labLink) openStudyLab(labLink.dataset.studyLab);
  });

  const quizContent = document.getElementById('quiz-content');
  if (quizContent) quizContent.addEventListener('click', e => {
    const option = e.target.closest('.quiz-option[data-quiz-question]');
    if (option) {
      selectAnswer(Number(option.dataset.quizQuestion), Number(option.dataset.quizOption));
      return;
    }

    const action = e.target.closest('[data-quiz-action]');
    if (!action) return;
    if (action.dataset.quizAction === 'submit') submitQuiz();
    if (action.dataset.quizAction === 'reset') resetQuiz();
  });

  // Remediation panel
  on('btn-dismiss-remediation', 'click', dismissRemediationPanel);

  // Incident history
  on('btn-incidents', 'click', openIncidentHistory);
  on('btn-incidents-close', 'click', closeIncidentHistory);

  // Lab navigation — event delegation
  const navList = document.querySelector('.sidebar-scroll');
  if(navList) navList.addEventListener('click', e => {
    const item = e.target.closest('[id^="nav-"]');
    if(item) loadLab(item.id.replace('nav-', ''));
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && currentLab) runCurrentStep();
    if (e.key === 'ArrowLeft' && currentLab && currentStep > 0) runStep(currentLab, currentStep - 1);
  });
}

// --- INIT BOOTSTRAP ---
function initApp() {
  bindUIHandlers();
  syncBeginnerModeUI();
  // Always show the cluster chooser after login instead of auto-entering a saved rack.
  const savedBp  = localStorage.getItem('gpusim_blueprint');
  const savedFab = localStorage.getItem('gpusim_fabric');
  const bpSelect  = document.getElementById('sel-blueprint');
  const fabSelect = document.getElementById('sel-fabric');
  const defaultBlueprint = (savedBp && typeof HARDWARE_LIBRARY !== 'undefined' && HARDWARE_LIBRARY[savedBp])
    ? savedBp
    : 'H100_HGX';

  if (bpSelect) {
    bpSelect.value = defaultBlueprint;
  }
  if (fabSelect) {
    const fallbackFabric = (typeof HARDWARE_LIBRARY !== 'undefined' && bpSelect && HARDWARE_LIBRARY[bpSelect.value])
      ? HARDWARE_LIBRARY[bpSelect.value].fabricDefault
      : 'IB_NDR';
    fabSelect.value = savedFab || fallbackFabric;
  }

  isProvisioned = false;
  currentBlueprint = null;
  runInstantSentinel();
  const reconOverlay = document.getElementById('recon-overlay');
  if (reconOverlay) reconOverlay.style.display = 'flex';
  const initialSvg = document.getElementById('diagram-canvas');
  if (initialSvg && typeof drawWelcome === 'function') drawWelcome(initialSvg);

  // Restore completed labs and quiz score from previous session
  const _savedCompleted = localStorage.getItem('gpusim_completed');
  if (_savedCompleted) {
    try {
      completedLabs = new Set(JSON.parse(_savedCompleted));
      completedLabs.forEach(id => {
        const badge = document.getElementById('b-' + id);
        const nav   = document.getElementById('nav-' + id);
        if (badge) badge.textContent = '✓';
        if (nav)   nav.classList.add('done');
      });
      document.getElementById('h-done').textContent = completedLabs.size;
    } catch(e) { localStorage.removeItem('gpusim_completed'); }
  }
  const _savedScore = localStorage.getItem('gpusim_score');
  if (_savedScore) document.getElementById('h-score').textContent = _savedScore + '%';
  updateReasoningProgressUI();

  // Attach Terminal listener once per session bootstrap
  if (!_appInitialized) {
    _appInitialized = true;
    const cmdInput = document.getElementById('cmd-input');
    if(cmdInput) {
        cmdInput.addEventListener('keydown', e => {
          if(e.key==='Enter') {
            const cmd = e.target.value.trim();
            if(!cmd) return;
            e.target.value='';
            switchTab('term');
            logTerm([{t:'cmd',v:'$ '+cmd}]);
            handleCustomCommand(cmd);
            scrollTerminal();
          }
        });
    }
  }

  // Draw Initial State
  const svg = document.getElementById('diagram-canvas');
  setTimeout(()=>{
    if(svg && !isProvisioned) {
        const w=svg.clientWidth, h=svg.clientHeight;
        svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
        if(typeof drawWelcome === 'function') drawWelcome(svg);
    }
  }, 100);
}

window.addEventListener('load', async ()=>{
  bindUIHandlers();
  // Sprint 16: Verify existing JWT or show login overlay
  if (JWT_TOKEN) {
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { headers: authHdr() });
      if (r.ok) { hideLoginOverlay(); initApp(); return; }
    } catch(e) { /* fall through to login */ }
  }
  showLoginOverlay();
});

window.addEventListener('resize', ()=>{
  if(currentLab) {
    const svg=document.getElementById('diagram-canvas');
    clearCanvas();
    const w=svg.clientWidth, h=svg.clientHeight;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(typeof LABS[currentLab].draw === 'function') LABS[currentLab].draw(svg, currentStep);
  }
});

// ════════════════════════════════════════════════════════════════════
// SPRINT 3: INCIDENT PARSER (LOG REVERSE ENGINEERING)
// ════════════════════════════════════════════════════════════════════
function analyzeLog() {
    const rawLog = document.getElementById('log-input').value;
    switchTab('term');
    clearTerminal();

    if (!rawLog || rawLog.trim() === '') {
        logTerm([{t:'err', v:'ERROR: No log data provided. Please paste a dmesg or syslog excerpt.'}]);
        return;
    }

    logTerm([{t:'info', v:'[SYSTEM] Initiating Reverse Engineering Log Parser...'}]);

    setTimeout(() => {
        // THE FIX: Bulletproof Regex that ignores colons inside the (PCI:...) brackets
        const xidMatch = rawLog.match(/Xid(?:.*?\))?:\s*(\d+)/i);
        const pcieMatch = rawLog.match(/PCI:0000:([0-9a-fA-F]{2}):/i);
        const gpuMatch = rawLog.match(/GPU\s*(\d+)/i);

        let xid = xidMatch ? xidMatch[1] : null;
        let pci = pcieMatch ? pcieMatch[1] : null;
        let gpuNum = gpuMatch ? gpuMatch[1] : null;

        if (xid) {
            logTerm([{t:'warn', v:`[PARSER] Identified XID Fault Code: ${xid}`}]);

            if (xid === '48') logTerm([{t:'err', v:`[DECODE] XID 48 = Double-Bit ECC (Uncorrectable Memory Hardware Failure).`}]);
            else if (xid === '79') logTerm([{t:'err', v:`[DECODE] XID 79 = GPU Fallen off the bus (Completely Hung).`}]);
            else if (xid === '74') logTerm([{t:'err', v:`[DECODE] XID 74 = NVLink CRC Flit Error (Cable or Switch failure).`}]);
            else logTerm([{t:'err', v:`[DECODE] Unrecognized hardware fault.`}]);

            if (beginnerMode) {
                logTerm([{t:'info', v:`[BEGINNER] ${explainParsedXid(xid)}`}]);
                logTerm([{t:'dim', v:'[BEGINNER] XID is the NVIDIA driver fault code. The parser keeps the real code visible so you learn the operator vocabulary while reading the explanation.'}]);
            }

            let failingNodeIndex = 0; 
            if (gpuNum) {
                failingNodeIndex = parseInt(gpuNum);
            } else if (pci) {
                // Build topology-aware PCIe map covering 4/8/18-node blueprints
                const pcieTopologyMap = {};
                for (let _n = 0; _n < 18; _n++) {
                  const bus = _n.toString(16) + '3';  // e.g. 0→'03', 4→'43', 10→'a3'
                  pcieTopologyMap[bus] = _n;
                  pcieTopologyMap[bus.toUpperCase()] = _n;
                }
                if (pcieTopologyMap[pci] !== undefined) {
                    failingNodeIndex = pcieTopologyMap[pci];
                } else {
                    logTerm([{t:'warn', v:`[WARN] Unrecognized PCIe bus ${pci}. Cannot confidently map to physical node.`}]);
                }
            }

            logTerm([{t:'info', v:`[MAPPING] PCIe Address maps to physical node index: 0${failingNodeIndex + 1}`}]);
            if (beginnerMode) {
                logTerm([{t:'dim', v:'[BEGINNER] Mapping means the parser is translating a low-level bus or GPU identifier into the physical machine you would inspect or drain.'}]);
            }
            logTerm([{t:'warn', v:`[ACTION] Pushing CRITICAL fault telemetry to Rack Digital Twin...`}]);

            const svg = document.getElementById('diagram-canvas');
            clearCanvas();
            drawRackElevation(svg, { node: failingNodeIndex, xid: xid });

        } else {
            logTerm([{t:'good', v:'[PARSER] No XID hardware faults detected in the provided log block.'}]);
        }
    }, 800);
}

// ════════════════════════════════════════════════════════════════════
// SPRINT 4: DUAL-MODE STATE MANAGEMENT & THERMAL LOGIC
// ════════════════════════════════════════════════════════════════════

let appMode = 'simulation'; 
let thermalMode = false;

let liveInterval = null;

async function toggleAppMode(forcedState) {
    const isLive = forcedState !== undefined ? forcedState : document.getElementById('toggle-live').checked;
    // Sync all three checkbox instances (header, sidebar, quiz panel)
    ['toggle-live', 'sidebar-toggle-live', 'quiz-toggle-live'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = isLive;
    });
    appMode = isLive ? 'live' : 'simulation';

    if (isLive) {
        switchTab('term');
        logTerm([{t:'warn', v:'[SYSTEM] Switching to Live Telemetry Mode. Attempting to connect to the secured Aegis-GPU API...'}]);

        document.querySelectorAll('.nav-item').forEach(el => el.style.opacity = '0.3');
        document.getElementById('scen-title').textContent = 'LIVE DATACENTER VIEW';
        document.getElementById('scen-desc').textContent = 'Establishing secure API connection...';
        document.getElementById('step-controls').innerHTML = '';
        if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }

        try {
            const response = await fetch(`${API_BASE}/status`, { headers: authHdr() });
            if (response.status === 401) { handle401(); return; }
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();

            if(data.status === 'online') {
                setBackendLLMCapability(data.active_llm, data.llm_available);
                logTerm([{t:'good', v:`[NETWORK] SUCCESS! Handshake complete.`}]);
                logTerm([{t:'info', v:`[DAEMON] Aegis-GPU daemon active.`}]);
                logTerm([{t:'dim', v:data.llm_available ? `[DIAGNOSIS MODE] ${data.active_llm} available. Users may opt in to LLM-backed diagnosis.` : '[DIAGNOSIS MODE] Deterministic runbooks only. LLM diagnosis is currently unavailable.'}]);
                document.getElementById('scen-desc').textContent = 'Connected. Waiting for live telemetry...';

                // --- START LIVE POLLING ---
                liveInterval = setInterval(fetchLiveMetrics, 3000);
                fetchLiveMetrics();
            }
        } catch (err) {
            logTerm([{t:'err', v:`[NETWORK] Connection refused: Make sure the Aegis-GPU API is running. Error: ${err.message}`}]);
        }

    } else {
        logTerm([{t:'info', v:'[SYSTEM] Connection severed. Reverting to Student Simulation Mode.'}]);
        document.querySelectorAll('.nav-item').forEach(el => el.style.opacity = '1');
        setLiveExplainerIdle('Live Telemetry is off. Turn it on to see beginner explanations of evidence quality, telemetry scope, and diagnosis trust level.');
        resetAll();
        if(liveInterval) clearInterval(liveInterval);
    }
}

// Sprint 13: toggleThermalView — was called from HTML but never defined.
// Syncs all three checkbox instances and redraws the active canvas.
function toggleThermalView(forcedState) {
    const isThermal = forcedState !== undefined ? forcedState : document.getElementById('toggle-thermal').checked;
    thermalMode = isThermal;
    ['toggle-thermal', 'sidebar-toggle-thermal', 'quiz-toggle-thermal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = isThermal;
    });
    const svg = document.getElementById('diagram-canvas');
    if (!svg) return;
    clearCanvas();
    const w = svg.clientWidth, h = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (currentLab && LABS[currentLab] && typeof LABS[currentLab].draw === 'function') {
        LABS[currentLab].draw(svg, currentStep);
    } else if (isProvisioned && typeof drawRackElevation === 'function') {
        drawRackElevation(svg, null, thermalMode);
    }
}

// Function to grab the data and update the UI sidebar
async function fetchLiveMetrics() {
    try {
        const res = await fetch(`${API_BASE}/hardware/metrics`, { headers: authHdr() });
        if (res.status === 401) { handle401(); return; }
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const liveData = await res.json();
        lastLiveTelemetry = liveData;
        const source = liveData.source || 'unknown-source';
        const modeMsg = liveData.degraded
            ? `Connected in degraded mode (${source}). Displaying best-effort host telemetry.`
            : `Connected. Streaming live hardware telemetry from ${source}.`;
        document.getElementById('scen-desc').textContent = modeMsg;

        logTerm([{t:'dim', v:`[POLL] ${source} -> Temp: ${liveData.temp}°C | Pwr: ${liveData.power}W | Util: ${liveData.util}% | VRAM: ${liveData.vram_used}/${liveData.vram_total}GB`}]);
        scrollTerminal();

        setMetric('m-util', liveData.util + '%', liveData.degraded ? 'warn' : 'ok');
        setMetric('m-vram', liveData.vram_total ? `${liveData.vram_used}/${liveData.vram_total}GB` : 'n/a', liveData.vram_total ? 'ok' : 'warn');
        setMetric('m-temp', liveData.temp + '°C', liveData.temp > 80 ? 'warn' : 'ok');
        setMetric('m-power', liveData.power + 'W', liveData.power > 0 ? 'ok' : 'warn');
        setMetric('m-xid', (liveData.active_faults && liveData.active_faults.length) ? 'active' : 'none', (liveData.active_faults && liveData.active_faults.length) ? 'err' : 'dim');

        setBar('mb-util', liveData.util, liveData.degraded ? 'var(--yellow)' : 'var(--green)');
        setBar('mb-vram', liveData.vram_total ? (liveData.vram_used / liveData.vram_total) * 100 : 0, 'var(--blue)');
        setBar('mb-temp', (liveData.temp / 100) * 100, liveData.temp > 80 ? 'var(--yellow)' : 'var(--blue)');
        setBar('mb-power', liveData.power > 0 ? (liveData.power / 700) * 100 : 0, 'var(--copper)');
        renderBeginnerTelemetryExplanation(liveData);

    } catch (e) {
        setLiveExplainerIdle('Live telemetry polling failed, so the beginner explainer cannot interpret the current hardware state.');
        logTerm([{t:'err', v:`[POLLING ERROR] ${e.message}`}]);
        scrollTerminal();
    }
}

// ════════════════════════════════════════════════════════════════════
// SPRINT 10: AUTONOMOUS REMEDIATION UI (AIOps)
// ════════════════════════════════════════════════════════════════════

async function requestAI_Remediation(xid, nodeIndex = 6) {
    if (appMode !== 'live') {
        logTerm([{t:'err', v:'[SYSTEM] Please switch to Live Telemetry Mode to use the AIOps Engine.'}]);
        return;
    }
    currentFaultNode = nodeIndex;

    // 1. Visually trigger the fault on the Digital Twin
    const svg = document.getElementById('diagram-canvas');
    if (svg) {
        clearCanvas();
        drawRackElevation(svg, {node: nodeIndex, xid: xid}, thermalMode);
    }

    logTerm([{t:'warn', v:`[AIOps] Intercepted fault XID ${xid} on Node 0${nodeIndex + 1}. Consulting Knowledge Base...`}]);
    scrollTerminal();
    
    try {
        // 2. Query the Python RAG Backend
        const res = await fetch(`${API_BASE}/diagnose/${xid}`, {
            method: 'POST',
            headers: { ...authHdr(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ allow_llm: llmDiagnosisEnabled && backendLLMAvailable })
        });
        if (res.status === 401) { handle401(); return; }
        const data = await res.json();
        
        if (data.error) { logTerm([{t:"err", v:`[AIOps REJECTED] ${data.error}`}]); scrollTerminal(); } else if (data.remediation_plan) {
            logTerm([{t:'info', v:`[DIAGNOSIS] Source: ${data.diagnosis_source}`}]);
            logTerm([{t:'good', v:`[REMEDIATION PLAN] ${data.remediation_plan}`}]);
            logTerm([{t:'dim',  v:`[AUDIT] ${data.hallucination_check}`}]);
            scrollTerminal();
            
            // 3. Capture into static overlay and show toggle button
            captureStaticDiagnosis(data);

            // 4. Spawn the Self-Healing Runbook Button
            renderRunbookButton(xid);
        }
    } catch(e) {
        logTerm([{t:'err', v:`[AIOps ERROR] Backend unreachable: ${e.message}`}]);
    }
}

async function executeRunbook(xid) {
    logTerm([{t:"warn", v:`[EXECUTION] Calling Backend Remediation Engine for XID ${xid}...`}]);
    try {
        const res = await fetch(`${API_BASE}/remediate/${xid}`, {
            method: "POST",
            headers: { ...authHdr(), "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: currentFaultNode })
        });
        if (res.status === 401) { handle401(); return; }
        const data = await res.json();
        if (!res.ok) {
            logTerm([{t:"err", v:`[FAILURE] ${data.detail || data.message || `HTTP ${res.status}`}`}]);
            return;
        }

        if(data.status === "success") {
            logTerm([{t:"good", v:`[SUCCESS] ${data.message}`}]);
            logTerm([{t:"dim", v:`[LOG] ${data.log}`}]);
            document.getElementById("step-controls").innerHTML = "";
            const svg = document.getElementById("diagram-canvas");
            if (svg) { clearCanvas(); drawRackElevation(svg, null, thermalMode); }
            showRemediationPanel(data.message, data.log, "success");
        } else if (data.status === "manual_required") {
            logTerm([{t:"warn", v:`[MANUAL] ${data.message}`}]);
            logTerm([{t:"dim", v:`[RUNBOOK] ${data.log}`}]);
            showRemediationPanel(data.message, data.log, "manual_required");
        } else {
            logTerm([{t:"err", v:`[FAILURE] ${data.message || 'Unknown remediation failure.'}`}]);
        }
    } catch (err) {
        logTerm([{t:"err", v:`[FAILURE] ${err.message}`}]);
    }
}

function showRemediationPanel(message, log, status = "success") {
    const panel = document.getElementById("remediation-status-panel");
    if (!panel) return;
    const titleEl = document.getElementById("remediation-status-title");
    const configs = {
        success: { icon: "✓", label: "AUTONOMOUS RUNBOOK — SUCCESS", color: "#00e676", border: "3px solid #00e676", bg: "#071f0f" },
        manual_required: { icon: "⚠", label: "MANUAL ACTION REQUIRED", color: "#f4a261", border: "3px solid #f4a261", bg: "#1a1000" },
        error: { icon: "✗", label: "REMEDIATION FAILED", color: "#ff5252", border: "3px solid #ff5252", bg: "#1a0000" },
    };
    const cfg = configs[status] || configs.success;
    if (titleEl) {
        titleEl.textContent = cfg.icon + " " + cfg.label;
        titleEl.style.color = cfg.color;
    }
    panel.style.borderTop = cfg.border;
    panel.style.background = cfg.bg;
    document.getElementById("remediation-msg").textContent = message || "";
    document.getElementById("remediation-log").textContent = log || "";
    panel.style.display = "flex";
}

function dismissRemediationPanel() {
    const panel = document.getElementById("remediation-status-panel");
    if (panel) panel.style.display = "none";
}
// SPRINT 11: STATIC DIAGNOSTIC TOGGLE
// ══════════════════════════════════════════════════════════════════════

/**
 * toggleAIDoc - shows/hides the static AI diagnosis overlay panel.
 * Called by the #toggle-ai-btn button in the terminal toolbar.
 */
function toggleAIDoc() {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || !btn) return;

    if (overlay.style.display === "none" || overlay.style.display === "") {
        overlay.style.display = "block";
        btn.innerHTML = "\u274c CLOSE DIAGNOSIS";
        btn.style.background = "#ff4c4c";
        btn.style.color = "#fff";
    } else {
        overlay.style.display = "none";
        btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
        btn.style.background = "#f4a261";
        btn.style.color = "#000";
    }
}

/**
 * captureStaticDiagnosis - writes AI remediation data into the static
 * overlay div and makes the toggle button visible.
 * Called from requestAI_Remediation on a successful API response.
 */
function captureStaticDiagnosis(data) {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || !btn) return;

    if (data.remediation_plan) {
        const beginnerExplain = renderDiagnosisExplanation(data);
        overlay.innerHTML = `
          <div class="diag-block">
            <div class="diag-title">Fault</div>
            <p>${escHtml(data.fault || 'Unknown fault')}</p>
          </div>
          <div class="diag-block">
            <div class="diag-title">Diagnosis Source</div>
            <p>${escHtml(data.diagnosis_source || 'unknown')}</p>
          </div>
          ${beginnerExplain}
          <div class="diag-block">
            <div class="diag-title">Remediation Plan</div>
            ${data.remediation_plan.split('\n').filter(Boolean).map(line => `<p>${escHtml(line)}</p>`).join('')}
          </div>
          <div class="diag-block">
            <div class="diag-title">Honesty Check</div>
            <p>${escHtml(data.hallucination_check || 'No explanation provided.')}</p>
          </div>
        `;

        overlay.style.display = "none";
        btn.style.display = "inline-block";
        btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
        btn.style.background = "#f4a261";
        btn.style.color = "#000";

        logTerm([{t:"good", v:"[AIOps] Full diagnosis captured. Click the button above to read the remediation plan."}]);
        scrollTerminal();
    }
}

// ════════════════════════════════════════════════════════════════════
// INCIDENT HISTORY
// ════════════════════════════════════════════════════════════════════
async function openIncidentHistory() {
  const overlay = document.getElementById('incident-overlay');
  const body    = document.getElementById('incident-body');
  if (!overlay || !body) return;
  setIncidentBodyMessage(body, 'Loading…');
  overlay.style.display = 'flex';
  try {
    const r = await fetch(`${API_BASE}/incidents?limit=50`, { headers: authHdr() });
    if (r.status === 401) { handle401(); return; }
    if (!r.ok) { setIncidentBodyMessage(body, 'Failed to load incidents.', 'var(--red)'); return; }
    const rows = await r.json();
    if (!rows.length) {
      setIncidentBodyMessage(body, 'No incidents recorded yet.');
      return;
    }
    renderIncidentHistory(body, rows);
  } catch(e) {
    setIncidentBodyMessage(body, `Error: ${e.message}`, 'var(--red)');
  }
}

function closeIncidentHistory() {
  const overlay = document.getElementById('incident-overlay');
  if (overlay) overlay.style.display = 'none';
}

// Click-outside handler: close ai-static-overlay when clicking outside it
document.addEventListener("click", function(e) {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || overlay.style.display === "none") return;
    if (!overlay.contains(e.target) && e.target !== btn) {
        overlay.style.display = "none";
        if (btn) {
            btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
            btn.style.background = "#f4a261";
            btn.style.color = "#000";
        }
    }
});
