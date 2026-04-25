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
  content.dataset.examId = examId;
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
