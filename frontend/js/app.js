/**
 * APP MODULE: Main Controller
 * Handles State, Modals, Lab Lifecycles, and Incident Parser.
 */

// --- GLOBAL STATE ---
let currentLab = null;
let currentStep = 0;
let activeAlternateStep = null;
let activeMainRedirectStep = null;
let askAegisState = {
  contextKey: '',
  question: '',
  answer: '',
  source: 'deterministic-coach',
  references: [],
  loading: false,
  error: '',
};
let completedLabs = new Set();
let activeTab = 'term';
let termLines = { term:[], dmesg:[], dcgm:[] };
let clusterSimStore = null;

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
let terminalModeEnabled = localStorage.getItem('gpusim_terminal_mode') === 'true';
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

function getClusterSimApi() {
  return window.AEGIS_CLUSTER_SIM || null;
}

function ensureClusterSimStore() {
  if (clusterSimStore) return clusterSimStore;
  const api = getClusterSimApi();
  if (!api || typeof api.createStore !== 'function') return null;
  clusterSimStore = api.createStore();
  return clusterSimStore;
}

function getClusterSimSummary() {
  const store = ensureClusterSimStore();
  return store && typeof store.getSummary === 'function' ? store.getSummary() : null;
}

function describeClusterSimStatus() {
  const summary = getClusterSimSummary();
  if (!summary) return '';
  return `SIM CLUSTER: ${summary.totalNodes} nodes | ${summary.totalGpus} GPUs | ${summary.runningJobs} running | ${summary.pendingJobs} pending`;
}

function describeClusterSimIdleView() {
  const summary = getClusterSimSummary();
  if (!summary) return 'Select a lab from the sidebar to begin';
  return `${summary.clusterName} ready. ${summary.totalNodes} simulated nodes, ${summary.totalGpus} GPUs, ${summary.runningJobs} running workloads, ${summary.pendingJobs} pending workloads.`;
}
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
const BRANCH_STEP_MODIFIERS = {
  ecc: {
    title: 'ECC Revalidation Stage',
    purpose: 'This step is now about proving whether the node is still in warning-trend territory or has crossed into a hardware-integrity event after the earlier weak call.',
    lookFor: 'Treat every ECC counter and XID signal here as recovery evidence, not just as normal lab progression.',
    meaning: 'The step is no longer only teaching the happy path. It is checking whether you regained control of the memory-integrity story.',
  },
  nvlink_fault: {
    title: 'XID Recovery Stage',
    purpose: 'This step now tests whether the exact XID family has been re-owned before the incident grows wider.',
    lookFor: 'Read the fault code, the driver evidence, and the containment posture together before accepting any recovery narrative.',
    meaning: 'You are no longer on the default flow. This stage is validating that the earlier fault-family mistake was corrected.',
  },
  nvlink: {
    title: 'Fabric Baseline Recovery',
    purpose: 'This step is now about rebuilding the intended NVLink baseline after the earlier wrong-layer move.',
    lookFor: 'Use topology, link health, and throughput as one story. Do not treat any single number as enough on its own.',
    meaning: 'This stage is functioning as a fabric recovery checkpoint rather than a normal guided progression step.',
  },
  nccl_fallback: {
    title: 'Fallback Path Recovery',
    purpose: 'This step now checks whether you have actually cleared the TCP fallback cause instead of just talking around it.',
    lookFor: 'Confirm the transport selected, the config that shaped it, and the resulting bandwidth before moving on.',
    meaning: 'This stage is validating transport ownership after the earlier wrong path decision.',
  },
  storage: {
    title: 'Data Path Recovery',
    purpose: 'This step is now focused on whether the upstream feed path was really fixed before returning to GPU-side interpretation.',
    lookFor: 'Hold storage evidence and utilization evidence together. The question is whether starvation is still present.',
    meaning: 'This stage is no longer just teaching storage fundamentals. It is checking whether the bottleneck was truly re-owned.',
  },
  slurm: {
    title: 'Scheduler Recovery Stage',
    purpose: 'This step now asks whether you separated queue policy from node-health reasoning after the earlier mix-up.',
    lookFor: 'Read scheduler state, fairshare, and drain clues as separate causes, not as one blended delay story.',
    meaning: 'This stage is verifying a cleaner scheduling diagnosis before the lab proceeds normally again.',
  },
  k8s: {
    title: 'GPU Placement Recovery',
    purpose: 'This step now checks whether you separated pod placement, device exposure, and node state after the earlier weak path.',
    lookFor: 'Treat Pending, device-plugin, and node-health clues as distinct layers that need a clear owner.',
    meaning: 'This stage is validating a corrected Kubernetes GPU diagnosis, not just replaying the default lab path.',
  },
};
const ALTERNATE_BRANCH_STEPS = {
  ecc: {
    type: 'branch_ecc_recheck',
    label: 'ECC Recovery Checkpoint',
    cmd: 'dcgmi dmon -e 156,157 -g 0 && dmesg | grep -i "Xid\\|ECC"',
    lookFor: [
      'Whether DBE has stopped growing or is still active.',
      'Whether the evidence now supports containment instead of hopeful monitoring.',
    ],
    meaning: 'This branch-only step checks whether you corrected the earlier weak ECC judgment or are still treating a hardware-integrity signal too casually.',
    takeAction: ['Keep the node contained if DBE or XID evidence remains active.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking ECC evidence after the earlier weak path.' },
      { t: 'dim', v: 'GPU 0  SBE=58  DBE=1  status=containment-required' },
      { t: 'warn', v: 'NVRM: Xid (PCI:0000:17:00): 48 still present in recent logs' },
    ],
  },
  nvlink_fault: {
    type: 'branch_xid_reclassify',
    label: 'XID Recovery Checkpoint',
    cmd: 'journalctl -k | grep -i xid && nvidia-smi -q -x',
    lookFor: [
      'The exact XID family and whether the recovery path matches it.',
      'Whether the incident is still being treated as a generic GPU failure instead of a classified fault.',
    ],
    meaning: 'This branch-only step forces a reclassification of the XID incident before normal lab progression resumes.',
    takeAction: ['Choose the recovery path that matches the exact XID family, not a generic GPU reset story.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-classifying the XID fault family.' },
      { t: 'dim', v: 'Latest fault evidence: XID 79 remains the active incident family' },
      { t: 'warn', v: 'Recovery path mismatch detected: containment and bus-level recovery still required' },
    ],
  },
  nccl_fallback: {
    type: 'branch_nccl_path_recheck',
    label: 'Transport Recovery Checkpoint',
    cmd: 'env | grep NCCL && NCCL_DEBUG=INFO ./all_reduce_perf',
    lookFor: [
      'Whether NCCL is still selecting Socket/TCP.',
      'Whether the earlier wrong-layer fix actually changed the transport path.',
    ],
    meaning: 'This branch-only step checks whether the fallback path was truly cleared before the lab returns to the main flow.',
    takeAction: ['Do not leave this checkpoint until the transport selection story is explicit.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-validating NCCL transport selection.' },
      { t: 'warn', v: 'NCCL INFO Using network Socket' },
      { t: 'dim', v: 'Bandwidth remains degraded because the fallback cause is still unresolved' },
    ],
  },
  storage: {
    type: 'branch_storage_bottleneck_recheck',
    label: 'Storage Recovery Checkpoint',
    cmd: 'iostat -x 1 3 && lfs getstripe /datasets/train',
    lookFor: [
      'Whether the dataset path is still under-striped or saturated.',
      'Whether the GPU symptom still points upstream instead of at compute.',
    ],
    meaning: 'This branch-only step checks whether the starvation cause was truly re-owned before the main lab path resumes.',
    takeAction: ['Keep the investigation on the data path if the GPU is still waiting on input.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking upstream starvation evidence.' },
      { t: 'dim', v: 'sda util=100%  rMB/s=446  stripe_count=1' },
      { t: 'warn', v: 'GPU utilization remains bursty because the feed path is still constrained' },
    ],
  },
  nvlink: {
    type: 'branch_nvlink_topology_recheck',
    label: 'NVLink Recovery Checkpoint',
    cmd: 'nvidia-smi topo -m && nvidia-smi nvlink -e',
    lookFor: [
      'Whether the direct NVLink topology is restored and still clean.',
      'Whether the earlier wrong-layer path hid a fabric problem that is still present.',
    ],
    meaning: 'This branch-only step checks whether the NVLink fast path has really been re-established before the main topology lab resumes.',
    takeAction: ['Do not leave this checkpoint until topology and link-integrity evidence agree.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-baselining NVLink topology after the earlier wrong path.' },
      { t: 'dim', v: 'GPU0 GPU1 GPU2 GPU3  ...  CPU Affinity' },
      { t: 'warn', v: 'Observed path still shows mixed NV4/PHB; fast path not fully restored yet' },
    ],
  },
  cuda_stack: {
    type: 'branch_cuda_boundary_recheck',
    label: 'CUDA Stack Recovery Checkpoint',
    cmd: 'nvidia-smi && python -c "import torch; print(torch.cuda.is_available())"',
    lookFor: [
      'Which layer is still failing: driver visibility, runtime, or framework.',
      'Whether the earlier broad-stack move actually narrowed the boundary at all.',
    ],
    meaning: 'This branch-only step forces a tighter CUDA boundary read before the main stack lab can continue.',
    takeAction: ['Do not advance while the failing contract edge is still ambiguous.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-establishing the CUDA stack boundary.' },
      { t: 'dim', v: 'nvidia-smi reports the GPU, but torch.cuda.is_available() is still false' },
      { t: 'warn', v: 'Framework/runtime boundary remains the active fault edge' },
    ],
  },
  k8s: {
    type: 'branch_k8s_gpu_placement_recheck',
    label: 'Kubernetes Recovery Checkpoint',
    cmd: 'kubectl describe pod trainer-0 && kubectl describe node gpu-node-01',
    lookFor: [
      'Whether the issue is still resource placement, device plumbing, or node readiness.',
      'Whether the earlier mixed diagnosis has now been separated into one owning layer.',
    ],
    meaning: 'This branch-only step forces a cleaner Kubernetes GPU placement read before normal progression returns.',
    takeAction: ['Keep scheduling, runtime, and node-state evidence separated until one of them clearly owns the failure.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-reading Kubernetes GPU placement evidence.' },
      { t: 'dim', v: 'Pod still Pending: Insufficient nvidia.com/gpu on schedulable nodes' },
      { t: 'warn', v: 'Placement remains a scheduler/resource-state issue, not a generic driver failure' },
    ],
  },
  slurm: {
    type: 'branch_slurm_state_recheck',
    label: 'Slurm Recovery Checkpoint',
    cmd: 'squeue && scontrol show job 4821 && sshare',
    lookFor: [
      'Whether the queueing problem is still policy-driven or now tied to node state.',
      'Whether fairshare, reservation, or drain evidence is still being mixed together.',
    ],
    meaning: 'This branch-only step forces a cleaner scheduler-state diagnosis before the main Slurm path continues.',
    takeAction: ['Do not proceed until queue policy and node health are separated cleanly.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking Slurm policy versus node-state ownership.' },
      { t: 'dim', v: 'Job 4821 remains pending due to fairshare pressure; node health is not the primary blocker' },
      { t: 'warn', v: 'Scheduler evidence still points to policy delay rather than hardware loss' },
    ],
  },
  allreduce: {
    type: 'branch_allreduce_collective_recheck',
    label: 'Collective Recovery Checkpoint',
    cmd: 'NCCL_DEBUG=INFO ./all_reduce_perf -b 8M -e 256M -f 2',
    lookFor: [
      'Whether the collective is still weak because of the path or because of another layer.',
      'Whether the earlier interpretation confused compute health with synchronization health.',
    ],
    meaning: 'This branch-only step forces a collective-path re-read before the main all-reduce lab resumes.',
    takeAction: ['Stay on the communication path until the synchronization bottleneck has a clear owner.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking collective-path health.' },
      { t: 'dim', v: 'AllReduce bandwidth remains below healthy baseline despite healthy local compute' },
      { t: 'warn', v: 'Synchronization path remains the active bottleneck' },
    ],
  },
  ib_fabric: {
    type: 'branch_ib_fabric_recheck',
    label: 'InfiniBand Recovery Checkpoint',
    cmd: 'ibstat && perfquery -x',
    lookFor: [
      'Whether the HCA and fabric state actually support the expected transport path.',
      'Whether the earlier response still over-trusts application logs over fabric evidence.',
    ],
    meaning: 'This branch-only step forces a fresh InfiniBand fabric read before the main fabric lab proceeds.',
    takeAction: ['Do not leave this checkpoint until physical or transport-level fabric ownership is explicit.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-reading InfiniBand fabric health.' },
      { t: 'dim', v: 'Port state active on one path, degraded counters still present on the affected link' },
      { t: 'warn', v: 'Fabric integrity is still unresolved despite application-level retries' },
    ],
  },
  mig: {
    type: 'branch_mig_profile_recheck',
    label: 'MIG Recovery Checkpoint',
    cmd: 'nvidia-smi mig -lgi && nvidia-smi -L',
    lookFor: [
      'Whether the expected MIG profiles are still carved and visible.',
      'Whether the earlier path confused partition layout with generic GPU disappearance.',
    ],
    meaning: 'This branch-only step forces a fresh read of MIG partition ownership before the main partitioning lab resumes.',
    takeAction: ['Keep partition visibility separate from node-health and scheduling stories until the active break is explicit.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking MIG partition layout.' },
      { t: 'dim', v: 'GPU 0 GI 3 CI 0 missing from expected profile inventory' },
      { t: 'warn', v: 'Partition exposure remains inconsistent with the requested MIG shape' },
    ],
  },
  container: {
    type: 'branch_container_runtime_recheck',
    label: 'Container Runtime Recovery Checkpoint',
    cmd: 'docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi',
    lookFor: [
      'Whether the container runtime still exposes the GPU contract cleanly.',
      'Whether the earlier recovery attempt blurred host-runtime issues with image-level issues.',
    ],
    meaning: 'This branch-only step forces a cleaner container-to-GPU contract check before the main container lab continues.',
    takeAction: ['Do not advance until host runtime, toolkit injection, and image behavior are clearly separated.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking container GPU runtime exposure.' },
      { t: 'dim', v: 'Container starts, but NVIDIA runtime hook still fails to expose all requested devices' },
      { t: 'warn', v: 'Runtime injection remains the active fault boundary' },
    ],
  },
  training: {
    type: 'branch_training_pipeline_recheck',
    label: 'Training Pipeline Recovery Checkpoint',
    cmd: 'python3 train.py --dry-run --profile-input',
    lookFor: [
      'Whether the slowdown still belongs to the feed path, compute path, or orchestration path.',
      'Whether the earlier weak call mixed utilization symptoms with end-to-end training ownership.',
    ],
    meaning: 'This branch-only step forces a tighter training-pipeline diagnosis before the main training lab resumes.',
    takeAction: ['Keep data feed, compute saturation, and launch behavior separated until one of them clearly owns the slowdown.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking end-to-end training path ownership.' },
      { t: 'dim', v: 'Step time still gated by input wait, not by GPU kernel saturation' },
      { t: 'warn', v: 'Pipeline bottleneck remains upstream of steady-state compute' },
    ],
  },
  roce: {
    type: 'branch_roce_fabric_recheck',
    label: 'RoCE Recovery Checkpoint',
    cmd: 'rdma link show && ethtool -S eth0 | grep -i pause',
    lookFor: [
      'Whether the Ethernet-based RDMA path still shows the expected lossless behavior.',
      'Whether the earlier path treated RoCE symptoms as generic network congestion without reading the RDMA cues.',
    ],
    meaning: 'This branch-only step forces a RoCE-specific transport reread before the main fabric lab continues.',
    takeAction: ['Do not collapse PFC, link health, and application retries into one generic network story.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking RoCE transport integrity.' },
      { t: 'dim', v: 'RoCE link remains up, but pause-frame imbalance still points to lossless-fabric drift' },
      { t: 'warn', v: 'Transport health is still constrained below the application layer' },
    ],
  },
  gds: {
    type: 'branch_gds_capability_recheck',
    label: 'GDS Recovery Checkpoint',
    cmd: 'python3 -c "import cufile; print(cufile.__version__)" && gdscheck -p',
    lookFor: [
      'Whether GPUDirect Storage capability is actually present at runtime.',
      'Whether the earlier response confused architectural intent with verified feature availability.',
    ],
    meaning: 'This branch-only step forces a runtime-capability reread before the main GPUDirect Storage lab resumes.',
    takeAction: ['Do not interpret path diagrams as proof until the runtime support layer is explicit.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking GPUDirect Storage capability.' },
      { t: 'dim', v: 'cuFile import succeeds, but gdscheck still reports partial path readiness' },
      { t: 'warn', v: 'Direct storage path remains only partially verified' },
    ],
  },
  monitoring: {
    type: 'branch_monitoring_signal_recheck',
    label: 'Monitoring Recovery Checkpoint',
    cmd: 'curl -s http://localhost:9090/api/v1/query?query=DCGM_FI_DEV_GPU_UTIL',
    lookFor: [
      'Whether the signal path still reflects the real GPU state cleanly.',
      'Whether the earlier mistake came from trusting dashboards without checking telemetry freshness or source.',
    ],
    meaning: 'This branch-only step forces a monitoring-signal ownership check before the main observability lab resumes.',
    takeAction: ['Keep telemetry freshness, source integrity, and actual device state separated until the broken leg is explicit.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Re-checking telemetry signal integrity.' },
      { t: 'dim', v: 'Dashboard still shows stale utilization while node-side telemetry has already shifted' },
      { t: 'warn', v: 'Observability gap remains in the signal path, not in the GPU itself' },
    ],
  },
};

const ALTERNATE_BRANCH_FOLLOWUPS = {
  ecc: {
    type: 'branch_ecc_containment_verify',
    label: 'ECC Containment Verification',
    cmd: 'dcgmi health -g 0 && scontrol show node gpu-node-01',
    lookFor: [
      'Whether the node is now held out of service while the ECC fault remains active.',
      'Whether containment status and hardware evidence now agree with each other.',
    ],
    meaning: 'This second branch-only step checks whether the ECC incident moved from diagnosis into actual containment instead of remaining a theory.',
    takeAction: ['Do not return to the main flow until the node state reflects the hardware fault classification.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying ECC containment posture.' },
      { t: 'dim', v: 'Node state=drain reason=ECC containment verification in progress' },
      { t: 'warn', v: 'Containment now matches the active DBE/XID evidence' },
    ],
  },
  nvlink_fault: {
    type: 'branch_xid_recovery_verify',
    label: 'XID Recovery Verification',
    cmd: 'nvidia-smi -q -d PERFORMANCE && journalctl -k | tail -n 25',
    lookFor: [
      'Whether the classified XID family now maps to a concrete recovery boundary.',
      'Whether the bus-level or fabric-level fault is still being blurred into a generic reset story.',
    ],
    meaning: 'This second branch-only step checks whether the XID classification now drives the recovery boundary correctly.',
    takeAction: ['Only return to the main path once the recovery boundary matches the XID family you identified.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying XID-aligned recovery boundary.' },
      { t: 'dim', v: 'Bus-level fault handling remains in force for the affected GPU path' },
      { t: 'warn', v: 'Recovery boundary now matches the active XID family instead of a generic reset guess' },
    ],
  },
  nvlink: {
    type: 'branch_nvlink_integrity_verify',
    label: 'NVLink Integrity Verification',
    cmd: 'nvidia-smi nvlink -e && ./nccl-tests/build/all_reduce_perf -b 64M -e 256M -f 2 -g 8',
    lookFor: [
      'Whether topology recovery is now backed by clean link counters and recovering collective performance.',
      'Whether the fabric story is healthy in practice, not just on the map.',
    ],
    meaning: 'This second branch-only step checks that NVLink recovery is now consistent across topology, counters, and communication behavior.',
    takeAction: ['Return to the main flow only when topology evidence and workload behavior no longer disagree.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying recovered NVLink integrity.' },
      { t: 'dim', v: 'CRC counters are flat, but benchmark bandwidth is still recovering toward baseline' },
      { t: 'warn', v: 'Fabric story is now converging across map, counters, and collective behavior' },
    ],
  },
  cuda_stack: {
    type: 'branch_cuda_framework_verify',
    label: 'CUDA Contract Verification',
    cmd: 'python3 -c "import torch; print(torch.__version__); print(torch.cuda.device_count())"',
    lookFor: [
      'Whether the framework now agrees with the lower runtime and driver layers.',
      'Whether the broken contract edge has narrowed enough to leave observation mode.',
    ],
    meaning: 'This second branch-only step checks whether the CUDA stack boundary has been narrowed into a usable framework contract.',
    takeAction: ['Only resume the main flow once the framework view is consistent with the lower stack.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying framework-level CUDA contract.' },
      { t: 'dim', v: 'torch import now succeeds, but device enumeration remains lower than expected' },
      { t: 'warn', v: 'Stack boundary is narrower now, but still needs explicit framework confirmation' },
    ],
  },
  k8s: {
    type: 'branch_k8s_scheduler_verify',
    label: 'Kubernetes Route Verification',
    cmd: 'kubectl get pods -A -o wide && kubectl get events --sort-by=.lastTimestamp | tail -n 20',
    lookFor: [
      'Whether scheduler output, node state, and device exposure now tell one consistent placement story.',
      'Whether pending behavior still belongs to one clear control-plane owner.',
    ],
    meaning: 'This second branch-only step checks whether the Kubernetes placement diagnosis has converged on one clear owner.',
    takeAction: ['Do not return to the main flow until the control-plane evidence stops splitting across layers.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying Kubernetes placement route.' },
      { t: 'dim', v: 'Scheduler and event stream now both point to the same GPU resource bottleneck' },
      { t: 'warn', v: 'Placement ownership is now converging instead of staying split across node and runtime theories' },
    ],
  },
  slurm: {
    type: 'branch_slurm_policy_verify',
    label: 'Slurm Policy Verification',
    cmd: 'scontrol show job 4821 && sinfo -R && squeue -o "%.18i %.9P %.8j %.8u %.2t %.10M %.6D %R"',
    lookFor: [
      'Whether queue policy and node-health evidence now stop contradicting each other.',
      'Whether the pending reason is explicit enough to leave the recovery chain.',
    ],
    meaning: 'This second branch-only step checks whether the scheduler diagnosis has settled on a policy versus health owner cleanly enough to proceed.',
    takeAction: ['Return to the main lab only when the pending reason is explicit and stable.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying scheduler policy ownership.' },
      { t: 'dim', v: 'Pending reason and node commentary now agree on a fairshare-driven delay' },
      { t: 'warn', v: 'Queue behavior is now owned by scheduler policy rather than suspect node state' },
    ],
  },
  allreduce: {
    type: 'branch_collective_path_verify',
    label: 'Collective Path Verification',
    cmd: 'NCCL_DEBUG=INFO ./all_reduce_perf -b 64M -e 512M -f 2 && env | grep NCCL',
    lookFor: [
      'Whether the collective path is now measurably recovering instead of just being renamed.',
      'Whether synchronization behavior aligns with the transport story.',
    ],
    meaning: 'This second branch-only step checks whether the collective-path diagnosis now matches measured synchronization behavior.',
    takeAction: ['Resume the main flow only once transport clues and collective behavior stop disagreeing.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying collective-path recovery.' },
      { t: 'dim', v: 'Collective bandwidth is recovering, but still below the healthy transport baseline' },
      { t: 'warn', v: 'Synchronization behavior now points to a narrowed transport issue rather than generic compute weakness' },
    ],
  },
  ib_fabric: {
    type: 'branch_ib_link_verify',
    label: 'InfiniBand Route Verification',
    cmd: 'ibstat && perfquery -x && ib_write_bw',
    lookFor: [
      'Whether link state, counters, and bandwidth now agree on the same fabric condition.',
      'Whether the transport path is healthy enough to leave the recovery chain.',
    ],
    meaning: 'This second branch-only step checks whether the InfiniBand diagnosis is now consistent across physical, counter, and throughput evidence.',
    takeAction: ['Do not return to the main path until the fabric story is coherent across all three signals.'],
    virtualOutput: [
      { t: 'warn', v: '[branch-step] Verifying InfiniBand route health.' },
      { t: 'dim', v: 'Port state remains active and bandwidth is improving, but degraded counters still need explanation' },
      { t: 'warn', v: 'Fabric health is stabilizing, but not yet fully back to clean-baseline status' },
    ],
  },
};

const ALTERNATE_MAIN_PATH_STEPS = {
  ecc: {
    type: 'branch_ecc_main_redirect',
    label: 'ECC Containment Decision',
    cmd: 'scontrol update NodeName=gpu-node-01 State=DRAIN Reason="ECC containment"',
    lookFor: [
      'Whether the next main decision now reflects containment instead of passive observation.',
      'Whether node state and hardware integrity finally line up before the lab continues.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user has to own the containment decision explicitly.',
    takeAction: ['Drain or isolate the node before continuing normal verification flow.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] Replacing the next main step with an explicit containment decision.' },
      { t: 'dim', v: 'Node gpu-node-01 state updated to DRAIN for ECC containment review' },
      { t: 'warn', v: 'Main path now requires containment alignment before normal progression resumes' },
    ],
  },
  nvlink: {
    type: 'branch_nvlink_main_redirect',
    label: 'Fabric Rejoin Decision',
    cmd: 'nvidia-smi topo -m && ./nccl-tests/build/all_reduce_perf -b 64M -e 128M -f 2 -g 8',
    lookFor: [
      'Whether the node is actually ready to rejoin the intended fast path.',
      'Whether communication behavior now supports leaving recovery mode.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must prove the fabric is ready to rejoin the main path.',
    takeAction: ['Do not resume normal fabric expectations until topology and bandwidth evidence agree.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a fabric rejoin decision.' },
      { t: 'dim', v: 'Topology and collective bandwidth are being checked together before returning to the default flow' },
      { t: 'warn', v: 'Main path remains recovery-aware until the fast path is credibly back' },
    ],
  },
  nccl_fallback: {
    type: 'branch_nccl_main_redirect',
    label: 'Transport Rejoin Decision',
    cmd: 'env | grep NCCL && NCCL_DEBUG=INFO ./all_reduce_perf -b 64M -e 128M -f 2',
    lookFor: [
      'Whether the transport path is now stable enough to resume the default main sequence.',
      'Whether the next main move is grounded in transport evidence instead of hope.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must explicitly decide whether the transport path is ready to rejoin normal flow.',
    takeAction: ['Keep the lab on the transport story until the fallback is clearly resolved.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a transport rejoin decision.' },
      { t: 'dim', v: 'NCCL transport evidence is being re-read before the normal sequence can continue' },
      { t: 'warn', v: 'The main path will not resume until the fallback story is narrowed cleanly' },
    ],
  },
  storage: {
    type: 'branch_storage_main_redirect',
    label: 'Feed Path Rejoin Decision',
    cmd: 'iostat -x 1 2 && nvidia-smi dmon -s u',
    lookFor: [
      'Whether the input path is actually feeding the GPUs steadily enough to leave recovery mode.',
      'Whether the next main step is still compute-facing when the feed path remains weak.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must decide whether the data path is ready to rejoin normal performance analysis.',
    takeAction: ['Return to the main flow only when feed-path evidence stops contradicting GPU behavior.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a feed-path rejoin decision.' },
      { t: 'dim', v: 'Storage and GPU utilization are being checked together before the default path resumes' },
      { t: 'warn', v: 'The main path remains tied to upstream evidence until the starvation story clears' },
    ],
  },
  cuda_stack: {
    type: 'branch_cuda_main_redirect',
    label: 'Stack Contract Decision',
    cmd: 'python3 -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"',
    lookFor: [
      'Whether the next main step now proves the software contract is usable instead of only nominally installed.',
      'Whether the framework layer now agrees with the lower stack strongly enough to leave recovery mode.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must re-establish a credible stack contract before the normal lab path resumes.',
    takeAction: ['Only rejoin the main stack flow when framework visibility and lower-layer evidence align.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a stack contract decision.' },
      { t: 'dim', v: 'Framework visibility is being re-checked against the recovered driver/runtime boundary' },
      { t: 'warn', v: 'The main path stays recovery-aware until the software contract is explicit again' },
    ],
  },
  k8s: {
    type: 'branch_k8s_main_redirect',
    label: 'GPU Placement Decision',
    cmd: 'kubectl describe pod trainer-0 && kubectl get events --sort-by=.lastTimestamp | tail -n 20',
    lookFor: [
      'Whether the next main step now confirms one clear owner for GPU placement instead of blending scheduler, plugin, and node issues.',
      'Whether the pod path is ready to rejoin the normal sequence without hidden control-plane ambiguity.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must explicitly re-own Kubernetes GPU placement before continuing normally.',
    takeAction: ['Do not resume the main Kubernetes flow until placement ownership is clear and singular.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a GPU placement decision.' },
      { t: 'dim', v: 'Scheduler and pod evidence are being re-read together before the default path resumes' },
      { t: 'warn', v: 'The main path remains tied to control-plane ownership until placement is clear' },
    ],
  },
  slurm: {
    type: 'branch_slurm_main_redirect',
    label: 'Scheduler Ownership Decision',
    cmd: 'squeue && scontrol show job 4821 && sinfo -R',
    lookFor: [
      'Whether the next main step now separates queue policy from node-health evidence clearly enough to resume normal flow.',
      'Whether the pending reason is stable enough to leave recovery mode.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must resolve scheduler ownership before the main Slurm path continues.',
    takeAction: ['Only rejoin the main scheduler flow once policy and node state stop competing for ownership.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a scheduler ownership decision.' },
      { t: 'dim', v: 'Pending-reason evidence is being compared with node commentary before the default sequence continues' },
      { t: 'warn', v: 'The main path stays recovery-aware until queue ownership is explicit' },
    ],
  },
  allreduce: {
    type: 'branch_allreduce_main_redirect',
    label: 'Collective Rejoin Decision',
    cmd: 'NCCL_DEBUG=INFO ./all_reduce_perf -b 64M -e 256M -f 2',
    lookFor: [
      'Whether the next main step now proves collective behavior is ready to leave recovery mode.',
      'Whether transport clues and collective bandwidth finally align.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must prove the collective path is healthy enough to rejoin the normal all-reduce flow.',
    takeAction: ['Do not return to the default collective path until bandwidth and transport evidence agree.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a collective rejoin decision.' },
      { t: 'dim', v: 'Collective bandwidth is being re-checked against recovered path evidence' },
      { t: 'warn', v: 'The main path remains recovery-aware until communication behavior and path evidence converge' },
    ],
  },
  ib_fabric: {
    type: 'branch_ib_main_redirect',
    label: 'Fabric Availability Decision',
    cmd: 'ibstat && perfquery -x && ib_write_bw',
    lookFor: [
      'Whether the next main step now proves the fabric is available and clean enough to rejoin the normal path.',
      'Whether physical state, counters, and throughput finally support the same conclusion.',
    ],
    meaning: 'This branch-aware main step replaces the default next stage so the user must prove the fabric is credibly back before normal flow resumes.',
    takeAction: ['Only return to the default fabric path once availability, counters, and throughput align.'],
    virtualOutput: [
      { t: 'warn', v: '[main-redirect] The next main step now requires a fabric availability decision.' },
      { t: 'dim', v: 'Link state, counters, and bandwidth are being re-evaluated together before the default path resumes' },
      { t: 'warn', v: 'The main path stays recovery-aware until fabric availability is credible again' },
    ],
  },
};

function authHdr() {
  return JWT_TOKEN ? { 'Authorization': 'Bearer ' + JWT_TOKEN } : {};
}

function showLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'flex';
}
function hideLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'none';
}

async function refreshLoginVersion() {
  const versionEl = document.getElementById('login-version');
  if (!versionEl) return;
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const version = String(payload.running_version || payload.version || '').trim() || 'unknown';
    versionEl.textContent = `RUNNING VERSION: ${version}`;
  } catch (_err) {
    versionEl.textContent = 'RUNNING VERSION: UNAVAILABLE';
  }
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
  refreshLoginVersion();
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
  const askAegis = renderAskAegisBlock(currentLab, step, currentStep);
  const diagnosis = renderDifferentialDiagnosis(currentLab, step, {
    subtitle: 'Use the nearby wrong paths to keep the screenshot evidence in the right fault family.',
  });

  return `
    <div class="lab-step-coach-callout${step.fault ? ' err' : ''}">
      <p><strong class="lab-step-coach-topic-label lab-step-coach-topic-label-doing">What you’re doing:</strong> ${escHtml(tightenDisplayCopy(step.whatsHappening || describeStepCommand(step)))}</p>
      <p><strong class="lab-step-coach-topic-label lab-step-coach-topic-label-matters">Why it matters:</strong> ${escHtml(tightenDisplayCopy(whyItMatters))}</p>
    </div>
    ${askAegis}
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
  if (Array.isArray(step.virtualOutput)) return step.virtualOutput;
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

function getAskAegisVisibleEvidence(step) {
  return getStepOutput(step)
    .filter(line => line && line.v && line.t !== 'cmd' && line.t !== 'dim')
    .map(line => String(line.v || '').trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .filter(line => !line.startsWith('[branch-step]'))
    .filter(line => !/^simulating\b/i.test(line))
    .slice(0, 5);
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
