const EXAM_STUDY_GUIDES = {
  nca_aiio: {
    code: 'NCA-AIIO',
    title: 'NVIDIA-Certified Associate: AI Infrastructure and Operations',
    examShape: 'Associate-level, 50 questions, 60 minutes. The goal is foundational infrastructure reasoning, not memorizing every command flag.',
    officialBlueprint: {
      source: 'NVIDIA certification page',
      sourceUrl: 'https://www.nvidia.com/en-us/learn/certification/ai-infrastructure-operations-associate/',
      details: [
        'Duration: one hour',
        'Questions: 50',
        'Certification level: Associate',
        'Validity: two years from issuance',
        'Prerequisite: basic data center infrastructure understanding',
        'Blueprint retrieved from the official NVIDIA certification page on 2026-07-09'
      ],
      weights: [
        { label: 'Essential AI Knowledge', value: '38%' },
        { label: 'AI Infrastructure', value: '40%' },
        { label: 'AI Operations', value: '22%' }
      ]
    },
    mentalModel: [
      'GPU hardware is the capacity. The driver makes it visible to Linux. CUDA and libraries make it usable by applications. Containers and schedulers deliver it to workloads. Telemetry and logs tell operators whether that chain is still trustworthy.',
      'When an exam question gives you a symptom, first locate the broken layer: hardware, driver, CUDA/runtime, container, scheduler, network, storage, or observability.',
      'A correct operator answer usually preserves evidence, protects running workloads, and chooses the smallest safe recovery step before broad changes.'
    ],
    memoryWriteup: {
      title: 'How To Build Mental Memory',
      intro: 'Do not memorize the labs as separate facts. Memorize them as one stack that gets wider and more operational as you move down the path.',
      ladder: [
        'Start with `cuda_stack`, `mig`, and `nvlink` so you know what the hardware, driver, runtime, and GPU-to-GPU path actually do.',
        'Move to `ecc`, `nvlink_fault`, and `monitoring` so you can read the language of failure: SBE, DBE, XID, and telemetry counters.',
        'Then study `container`, `k8s`, `slurm`, and `training` so you can tell the difference between missing GPU access and missing GPU capacity.',
        'After that, learn `ib_fabric`, `roce`, `allreduce`, and `nccl_fallback` so you can separate local GPU health from distributed communication problems.',
        'Finish with `storage` and `gds` so you can recognize GPU starvation caused by the data path instead of compute.'
      ],
      anchor: 'If you feel lost, ask one question: what dependency must already be healthy for this symptom to be possible? That usually tells you the next lab.',
      mnemonic: 'Foundation -> fault signals -> delivery -> collectives -> storage. That is the order the brain can keep in working memory.'
    },
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
          'XID 48, 74, and 79 point to different fault families, so they should not all trigger the same recovery path.',
          'XID 13, 31, and 43 usually mean the application misbehaved — check the job, not the hardware. XID 45 is cleanup context, not a root cause.',
          'The memory story is a spectrum: XID 92 is a corrected-error rate warning, 63 is a page/row queued for retirement (fixed by a reset), 64 is retirement failing (RMA path), 94 is a contained error (one job dies), 95 is uncontained (drain and reset).',
          'XID 119 means the GSP firmware stopped answering — a driver/firmware fault family of its own on modern GPUs.',
          'On Blackwell-class systems the NVLink fault family reports as XID 149 instead of 74, and XID 154 is an informational companion naming the recovery the driver wants — GPU reset versus node reboot.'
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
      },
      {
        phase: '6',
        title: 'Essential AI Knowledge',
        labs: ['ai_concepts', 'inference', 'nvidia_stack'],
        examFocus: 'Differentiate AI/ML/DL, compare training vs inference and GPU vs CPU, and map the NVIDIA software stack and solutions to the AI lifecycle.',
        plain: 'This is the largest exam domain (38%). It is conceptual: place a technique in the AI/ML/DL hierarchy, explain why deep learning runs on GPUs, and name which NVIDIA solution owns which job.',
        connectDots: [
          'Deep learning is a subset of machine learning, which is a subset of AI.',
          'Training is throughput- and memory-heavy; inference is latency-sensitive and request-driven.',
          'NeMo builds models, Triton and NIM serve them, RAPIDS preps data, TensorRT optimizes.'
        ],
        trap: 'Do not answer that a CPU is defective when it loses a parallel benchmark. That is an architecture trade-off, not a fault.'
      },
      {
        phase: '7',
        title: 'Infrastructure And Virtualization Planning',
        labs: ['infra_planning', 'dpu_cloud', 'vgpu'],
        examFocus: 'Size hardware, budget power and cooling, scale in balanced units, offload with a DPU, choose cloud vs on-prem, and pick a GPU virtualization model.',
        plain: 'This closes the AI Infrastructure (40%) planning objectives and the AI Operations virtualization objective. Reason from workload to facility, and match the sharing model to the isolation need.',
        connectDots: [
          'GPU racks are power-dense, so kilowatts and cooling cap density before floor space.',
          'A DPU offloads networking, storage, and security from the host CPU and isolates the infra domain.',
          'MIG is spatial hardware isolation; vGPU virtualizes GPUs for VMs; time-slicing has no isolation.'
        ],
        trap: 'Do not scale GPU count without scaling fabric, power, and cooling, and do not read oversubscription contention as a hardware fault.'
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

    <section class="learn-section study-official">
      <div class="learn-heading-row">
        <h4>Official Exam Shape</h4>
        <span class="learn-mode-tag">${escHtml(guide.officialBlueprint.source)}</span>
      </div>
      <div class="study-official-grid">
        ${guide.officialBlueprint.details.map(item => `
          <div class="study-official-card">${escHtml(item)}</div>
        `).join('')}
      </div>
      <div class="study-blueprint-bars">
        ${guide.officialBlueprint.weights.map(item => `
          <div class="study-blueprint-row">
            <div class="study-blueprint-label">${escHtml(item.label)}</div>
            <div class="study-blueprint-track"><span style="width:${escHtml(item.value)}"></span></div>
            <div class="study-blueprint-value">${escHtml(item.value)}</div>
          </div>
        `).join('')}
      </div>
      <a class="study-source-link" href="${escHtml(guide.officialBlueprint.sourceUrl)}" target="_blank" rel="noreferrer">NVIDIA certification page</a>
      <p class="study-disclaimer" style="font-size:11px;color:#7f8ea3;margin-top:12px;line-height:1.6;">Aegis-GPU is an independent study tool and is not affiliated with, sponsored by, or endorsed by NVIDIA Corporation. NVIDIA, NCA-AIIO, DGX, and related marks are trademarks of NVIDIA Corporation. Blueprint details above summarize the public NVIDIA certification page; lab environments are simulations, and completing them does not guarantee any exam result.</p>
    </section>

    <section class="learn-section study-model">
      <div class="learn-heading-row">
        <h4>The Chain To Remember</h4>
        <span class="learn-mode-tag">Connect the dots</span>
      </div>
      ${renderParagraphs(guide.mentalModel)}
    </section>

    <section class="learn-section learn-callout">
      <div class="learn-heading-row">
        <h4>${escHtml(guide.memoryWriteup.title)}</h4>
        <span class="learn-mode-tag">Memory ladder</span>
      </div>
      <p>${escHtml(tightenDisplayCopy(guide.memoryWriteup.intro))}</p>
      ${renderBulletList(guide.memoryWriteup.ladder, 'learn-list')}
      <div class="study-trap" style="margin-top:10px"><strong>Memory anchor:</strong> ${escHtml(tightenDisplayCopy(guide.memoryWriteup.anchor))}</div>
      <div class="study-trap" style="margin-top:10px"><strong>Mnemonic:</strong> ${escHtml(tightenDisplayCopy(guide.memoryWriteup.mnemonic))}</div>
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

function updateLearnTabs(view) {
  document.querySelectorAll('[data-learn-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-learn-tab') === view);
  });
}

function switchLearnTab(view) {
  if (view === 'intro') {
    if (typeof currentLab !== 'undefined' && currentLab) {
      closeStudyGuide();
      closeQuiz();
      showIntro(currentLab);
    }
    return;
  }
  if (view === 'quiz') {
    closeStudyGuide();
    openQuiz();
  } else {
    closeQuiz();
    openStudyGuide('nca_aiio');
  }
}

function openStudyGuide(examId = 'nca_aiio') {
  const content = document.getElementById('study-content');
  if (!content) return;
  content.dataset.examId = examId;
  content.innerHTML = renderStudyGuide(examId);
  document.getElementById('study-overlay')?.classList.add('show');
  updateLearnTabs('study');
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
   ans:1,exp:"XID 48 is the driver telling you the GPU hit a double-bit ECC memory failure. For beginners: ECC can fix some single-bit errors, but DBE means the data can no longer be trusted. The safe move is to stop new work, preserve the evidence, drain or isolate the node, and follow the hardware support or RMA path."},

  {q:"dcgmi dmon -e 157 shows value 1 on GPU 3 after 3 consecutive polls. What is your immediate action?",
   opts:["Wait for more polls to confirm","Drain the node, notify job owner, open NVIDIA RMA","Restart the NVIDIA driver","Reduce GPU power limit"],
   ans:1,exp:"Field 157 is the DBE counter. A non-zero volatile DBE means the GPU reported an uncorrectable memory event during this boot window. Drain the node, protect active jobs, and capture the evidence before the counter resets."},

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

  {q:"A Kubernetes pod fails with 'CUDA error: no kernel image is available for execution on the device'. Container was built with CUDA 11.8. Cluster nodes have a current NVIDIA driver. What is the correct fix?",
   opts:["Run 'nvidia-smi --gpu-reset' on the node","Rebuild the container using an NGC base image (nvcr.io/nvidia/pytorch:24.03-py3) that includes CUDA 12.x","Downgrade the node driver to match the container","Set CUDA_VISIBLE_DEVICES='' in the pod spec"],
   ans:1,exp:"CUDA 11.8 does not include sm_90 kernels required by H100 GPUs (compute capability 9.0 was introduced in CUDA 11.8 but full support arrived in CUDA 12.x). Rebuilding with an NGC image based on CUDA 12.x ensures the correct sm_90 PTX/SASS kernels are present. Note: newer drivers ARE backwards-compatible with older CUDA runtimes — the issue here is missing GPU architecture support, not driver version mismatch."},

  // Essential AI Knowledge — NCA-AIIO Domain 1: AI/ML/DL taxonomy
  {q:"A team uses a multi-layer neural network to generate text. How should this technique be classified?",
   opts:["Machine learning but explicitly not AI","Deep learning, which is a subset of machine learning and of AI","A rule-based AI system that does not learn from data","Traditional statistics unrelated to AI"],
   ans:1,exp:"AI, ML, and DL are nested. A many-layer neural network is deep learning, which is a subset of machine learning, which is a subset of AI. Generative and large language models are deep learning, so they inherit the GPU-heavy training profile."},

  // Essential AI Knowledge — Domain 1: GPU vs CPU architecture
  {q:"A dense 8192x8192 matrix multiply runs about 160x faster on an H100 than on a 32-core CPU. What is the best explanation?",
   opts:["The CPU is defective and should be replaced","The GPU's thousands of throughput-optimized cores and Tensor Cores match the parallel workload","The CPU simply lacks enough system RAM","The benchmark is actually measuring network speed"],
   ans:1,exp:"The GPU wins because dense matrix math is massively parallel and maps onto many throughput-optimized cores plus Tensor Cores. The CPU is latency-optimized for serial/branchy work — it is a design trade-off, not a defect. 'The CPU is broken' is the classic wrong answer."},

  // Essential AI Knowledge — Domain 1: training vs inference architecture
  {q:"Which statement best distinguishes training from inference resource profiles?",
   opts:["Inference needs far more memory than training because of optimizer states","Training sustains high utilization and holds gradients and optimizer state, while inference is latency-sensitive and request-driven","Training is latency-bound while inference is throughput-bound","They stress hardware identically"],
   ans:1,exp:"Training runs forward and backward passes with large batches and holds weights, activations, gradients, and optimizer state, so it is throughput-first and memory-heavy. Inference runs only the forward pass and is judged by latency under load. Their architecture requirements differ."},

  // Essential AI Knowledge — Domain 1: NVIDIA solutions (serve)
  {q:"You must deploy a trained model as a scalable inference microservice with a standard API. Which NVIDIA solution fits best?",
   opts:["NeMo","RAPIDS","NVIDIA NIM or Triton Inference Server","DCGM"],
   ans:2,exp:"Serving trained models is the job of Triton Inference Server and NIM (NVIDIA Inference Microservices). NeMo builds and customizes models, RAPIDS accelerates data science, and DCGM monitors GPUs — none of those serve inference requests."},

  // Essential AI Knowledge — Domain 1: NVIDIA solutions (build)
  {q:"Which NVIDIA offering is purpose-built for building and customizing large language models?",
   opts:["NeMo","Triton Inference Server","cuBLAS","Base Command Manager"],
   ans:0,exp:"NeMo is NVIDIA's framework for building and customizing LLMs and generative models. Triton serves models, cuBLAS is a CUDA-X linear-algebra library, and Base Command Manager is cluster management — they own different jobs in the stack."},

  // Essential AI Knowledge — Domain 1: NVIDIA software stack (CUDA-X)
  {q:"A PyTorch job runs, but multi-GPU AllReduce is far slower than expected and the collective library is missing. Which CUDA-X library is implicated?",
   opts:["cuDNN","NCCL","cuFFT","RAPIDS cuDF"],
   ans:1,exp:"NCCL is the CUDA-X library that provides multi-GPU and multi-node collective communication such as AllReduce. cuDNN accelerates neural-net primitives, cuFFT does Fourier transforms, and cuDF is dataframes — none of those own collectives."},

  // Essential AI Knowledge — Domain 1: AI lifecycle
  {q:"In the AI development and deployment lifecycle, which stage sits between training and deployment and is owned by TensorRT?",
   opts:["Data preparation","Model optimization such as quantization and layer fusion","Post-deployment monitoring","Data labeling"],
   ans:1,exp:"TensorRT optimizes a trained model (kernel fusion, reduced precision like FP16/INT8) before it is deployed on Triton or NIM. Data prep (RAPIDS/DALI) comes before training, and monitoring (DCGM) comes after deployment."},

  // AI Infrastructure — NCA-AIIO Domain 2: power & cooling
  {q:"A rack has a 40 kW power feed and each DGX H100 node draws about 10.2 kW. What primarily limits how many nodes fit?",
   opts:["The number of rack units physically available","The rack power and cooling budget, which caps it near 3-4 nodes","The length of the InfiniBand cables","A Kubernetes node-count limit"],
   ans:1,exp:"GPU nodes are power-dense, so the kilowatt budget of the power feed (and the matching heat the cooling can remove) usually caps density before physical rack space does. A 40 kW feed supports only about three to four 10 kW nodes."},

  // AI Infrastructure — Domain 2: scaling
  {q:"Why do reference architectures like DGX SuperPOD grow in fixed scalable units (for example 32 nodes plus an InfiniBand spine)?",
   opts:["To simplify purchasing paperwork only","So compute, network, power, and cooling scale together in a validated, balanced ratio","Because GPUs must be purchased in prime-number counts","To avoid using InfiniBand entirely"],
   ans:1,exp:"Scalable units keep the interconnect, power, and cooling proportioned to the compute as the cluster grows. Adding GPUs without matching fabric and facility creates bottlenecks and thermal or power faults."},

  // AI Infrastructure — Domain 2: DPU
  {q:"Host CPU is saturated by OVS virtual switching, TLS, and NVMe-oF storage while the GPUs idle-wait for data. What is the purpose of adding a BlueField DPU?",
   opts:["To add more GPU memory","To offload networking, storage, and security from the host CPU and isolate the infrastructure domain","To raise the host CPU clock speed","To replace the InfiniBand fabric"],
   ans:1,exp:"A DPU (BlueField) is a programmable processor on the NIC that offloads infrastructure services — virtual switching, storage, security — from the host CPU. That frees host cores to feed the GPUs and adds a security-isolation boundary. Adding GPUs would not fix a CPU-bound infrastructure problem."},

  // AI Infrastructure — Domain 2: cloud vs on-prem
  {q:"GPUs will run at high sustained utilization for several years with strict data-residency requirements. Which deployment model is favored?",
   opts:["Cloud, because it is always cheaper","On-premises, because sustained high utilization and data gravity favor owned infrastructure","Cloud, because on-prem cannot run GPUs at scale","The choice never matters"],
   ans:1,exp:"Sustained high utilization makes owned infrastructure win on TCO over time, and strict data-residency (data gravity) reinforces on-prem. Cloud wins for bursty or uncertain demand and low upfront cost. There is no universal winner; utilization and control drive the choice."},

  // AI Operations — NCA-AIIO Domain 3: virtualization
  {q:"Six time-shared vGPU guests on one GPU all slow down under concurrent load, but DCGM shows no ECC or XID errors. What is happening?",
   opts:["The GPU has failed and needs an RMA","Oversubscription contention on time-shared compute — reduce the guest count or use MIG for hard isolation","An NVLink cable is broken","A thermal throttling event"],
   ans:1,exp:"Time-shared vGPU and time-slicing have no compute isolation, so too many concurrent guests raise scheduler wait time and each one slows down. The hardware is healthy (clean counters); the sharing ratio is the problem. MIG would provide spatial isolation if it is required."}
];

const QUIZ_WRONG_CHOICE_FEEDBACK = {
  0: {
    0: 'Your choice is not correct. NVLink CRC errors are communication-link problems between GPUs or through NVSwitch. They usually point to XID 74 and signal-integrity issues, not XID 48. This question is about GPU memory integrity, so look for the ECC answer.',
    2: 'Your choice is not correct. A GPU falling off the bus means the system lost contact with the GPU, which maps to XID 79. XID 48 is different: it points at an uncorrectable ECC memory error.',
    3: 'Your choice is not correct. Thermal throttling happens when the GPU is too hot and clocks down to protect itself. XID 48 is not a temperature warning; it is an ECC memory-failure signal.',
  },
  1: {
    0: 'Your choice is not correct. Waiting is appropriate for weak or noisy evidence, but DCGM field 157 is the double-bit ECC counter. Any non-zero DBE means the GPU reported uncorrectable memory trouble, so beginners should treat it as contain-now evidence, not wait-and-see evidence.',
    2: 'Your choice is not correct. Restarting the NVIDIA driver is a broad software recovery step. A DBE is a hardware memory-integrity signal; restarting software could erase useful evidence without making the GPU trustworthy again.',
    3: 'Your choice is not correct. Reducing the power limit is a thermal or power mitigation. Field 157 is not a heat or power clue; it is an ECC DBE clue, so the safe action is to drain or isolate the node and preserve evidence.',
  },
  2: {
    0: 'Your choice is not correct. XID 48 means double-bit ECC memory trouble. The phrase "fallen off the bus" means Linux or the driver lost contact with the GPU, which is the XID 79 failure family.',
    1: 'Your choice is not correct. XID 74 is tied to NVLink CRC flit errors. This prompt is not describing link corruption; it says the GPU fell off the bus, which points to XID 79.',
    3: 'Your choice is not correct. XID 13 is generally a graphics or engine exception. This question gives the specific "fallen off the bus" wording, so the beginner anchor is XID 79.',
  },
  3: {
    0: 'Your choice is not correct. Killing processes and retrying can be reasonable for some reset-blocked situations, but this scenario says the reset after XID 79 failed. For the exam, a failed reset on a fallen-off-bus GPU means move to a hard node reboot.',
    2: 'Your choice is not correct. Lowering power helps when the symptom is thermal slowdown or power pressure. XID 79 is a GPU hang or bus-loss condition, not a power-cap tuning problem.',
    3: 'Your choice is not correct. Updating the driver is not the immediate incident action. During an XID 79 recovery path, the operator first tries reset, and if reset fails, reboots the node before considering software maintenance later.',
  },
  4: {
    0: 'Your choice is not correct. XID 48 is memory integrity, specifically double-bit ECC. The prompt gives a CRC flit error on an NVLink, which is a communication-link signal rather than a GPU memory signal.',
    1: 'Your choice is not correct. XID 79 means the GPU has fallen off the bus or become unreachable. Here the GPU is reachable enough to report NVLink CRC counters, so the issue is the link path, not a full GPU bus loss.',
    3: 'Your choice is not correct. XID 13 points to an engine exception. CRC flit errors are about corrupted packets on the NVLink fabric, which beginners should associate with XID 74.',
  },
  5: {
    0: 'Your choice is not correct. VRAM pressure can cause allocation failures or paging-like behavior, but the prompt gives high temperature plus SM utilization dropping in bursts. That is the classic shape of thermal throttling.',
    2: 'Your choice is not correct. NCCL TCP fallback hurts distributed communication throughput, but it does not explain a GPU sitting at 87C and throttling SM utilization. The strongest clue here is temperature.',
    3: 'Your choice is not correct. A storage bottleneck can create sawtooth GPU utilization, but the prompt explicitly says the GPU is hot enough to throttle. Temperature is the deciding evidence.',
  },
  6: {
    0: 'Your choice is not correct. RMA is for hardware failure evidence such as DBE or persistent physical faults. This prompt says no ECC errors and shows thermal slowdown, so the first path is cooling inspection and temporary power mitigation, not immediate replacement.',
    2: 'Your choice is not correct. Reinstalling the driver is a software action. HW Thermal SlowDown means the GPU is protecting itself from heat, so fix airflow, heatsink contact, or power behavior first.',
    3: 'Your choice is not correct. Increasing batch size is a performance-tuning move. It does not solve an 88C thermal condition and can even increase heat. Operators should protect jobs and inspect cooling.',
  },
  7: {
    0: 'Your choice is not correct. Field 100 is GPU utilization, which tells you how busy the GPU is. It does not count ECC memory corrections, so it cannot warn you about rising SBE trends.',
    2: 'Your choice is not correct. Field 157 is the double-bit ECC counter. DBE is already uncorrectable; the question asks for single-bit ECC monitoring before things escalate, which is field 156.',
    3: 'Your choice is not correct. Field 203 is about SM clock speed. Clock speed can explain performance changes, but it is not the counter for corrected memory errors.',
  },
  8: {
    0: 'Your choice is not correct. Reinstalling NCCL is too broad for the first move. The log says NCCL is using Socket, so beginners should first check the environment variables that can force TCP fallback.',
    2: 'Your choice is not correct. Rebooting all training nodes is disruptive and not targeted. The most common simple cause is NCCL_IB_DISABLE=1, so inspect the environment before touching nodes.',
    3: 'Your choice is not correct. Batch size tuning changes compute and memory behavior, but the prompt shows the communication path is wrong. Fix the NCCL network path before tuning the model.',
  },
  9: {
    0: 'Your choice is not correct. If ibstat shows ports Active, the basic fabric and driver visibility are probably not the next clue. The remaining likely issue is that NCCL is pointed at the wrong HCA name.',
    2: 'Your choice is not correct. NVLink is the fast path inside or closely between GPUs, but this question is about NCCL still using TCP even though InfiniBand ports are active. That points at NCCL HCA selection.',
    3: 'Your choice is not correct. A Kubernetes NetworkPolicy can block rendezvous traffic, but the given evidence is about NCCL transport selection after IB detection. The targeted next check is NCCL_IB_HCA.',
  },
  10: {
    0: 'Your choice is not correct. InfiniBand fabric failure would be a different fabric type and evidence pattern. The prompt says RoCEv2 and rising PFC frames, which is Ethernet lossless-congestion behavior.',
    2: 'Your choice is not correct. NCCL TCP fallback means NCCL is using sockets instead of the intended high-speed path. Rising rx_pfc_frames points to pause-frame congestion, not simply a transport fallback.',
    3: 'Your choice is not correct. ECC errors affect GPU memory correctness. PFC frames are network switch flow-control signals, so the problem is in the fabric behavior, not corrupted GPU memory.',
  },
  11: {
    0: 'Your choice is not correct. NCCL TCP fallback would show logs like "Using network Socket." This prompt gives topology output changing from NV4 to PHB, so the local GPU-to-GPU path changed to PCIe host-bridge traversal.',
    2: 'Your choice is not correct. ECC errors affect memory reliability, not the topology label between two GPUs. PHB instead of NV4 means the NVLink path is unavailable.',
    3: 'Your choice is not correct. Thermal throttling reduces clocks because of heat. It does not change nvidia-smi topo output from NVLink to PHB.',
  },
  12: {
    0: 'Your choice is not correct. MIG is not enabled by asking for seven instances in one flag. First enable MIG mode, then create specific GPU and compute instances with the right profile.',
    2: 'Your choice is not correct. "nvidia-smi partition" is not the H100 MIG command sequence. The exam expects the MIG mode enable step followed by nvidia-smi mig profile creation.',
    3: 'Your choice is not correct. Kubernetes can consume MIG resources after the node is configured, but kubectl does not create the physical MIG slices on the GPU. The GPU must be partitioned with nvidia-smi first.',
  },
  13: {
    0: 'Your choice is not correct. Thermal throttling usually comes with high temperatures or HW Thermal SlowDown evidence. This prompt instead pairs sawtooth GPU utilization with NFS at 100 percent utilization, which points to input starvation.',
    1: 'Your choice is not correct. ECC retry storms would need ECC counters or XID evidence. The prompt gives storage saturation, so the GPU is likely waiting for data rather than retrying bad memory reads.',
    3: 'Your choice is not correct. An AllReduce stall is a distributed communication problem. The evidence here names NFS at 100 percent utilization, so the data path is the bottleneck.',
  },
  14: {
    0: 'Your choice is not correct. More DataLoader workers can help feed GPUs, but if Lustre stripe_count is 1, all reads still hit one OST. Fix the filesystem striping first so storage bandwidth can spread out.',
    2: 'Your choice is not correct. GPUDirect Storage can reduce CPU bounce-buffer overhead, but it is not the first fix for a dataset striped across only one OST. Correct the stripe count before jumping to a bigger architecture change.',
    3: 'Your choice is not correct. More CPU on storage nodes might help some workloads, but the direct evidence is bad striping. The simplest high-impact fix is to distribute reads across more OSTs.',
  },
  15: {
    0: 'Your choice is not correct. Port 9090 is commonly used by Prometheus itself. DCGM Exporter exposes GPU metrics separately, and its default endpoint is on port 9400.',
    2: 'Your choice is not correct. Port 8080 is a common generic web-app port, but it is not the default DCGM Exporter metrics port.',
    3: 'Your choice is not correct. Port 2049 is associated with NFS. DCGM Exporter is a metrics exporter, not a filesystem service.',
  },
  16: {
    0: 'Your choice is not correct. If every node reports nvidia.com/gpu resources, the GPU Operator is probably doing its basic job. Pending with Insufficient nvidia.com/gpu usually means the allocatable GPU slots are already consumed.',
    2: 'Your choice is not correct. A pod requesting zero GPUs would not be blocked by insufficient GPU capacity. The scheduler complains because the pod needs GPUs that are not currently free.',
    3: 'Your choice is not correct. A kubelet restart issue would usually affect resource visibility on nodes. The prompt says nodes show eight GPUs, so visibility exists; the problem is allocation pressure.',
  },
  17: {
    1: 'Your choice is not correct. A very low FairShare value does not mean Alice has used little. It means her recent usage is high relative to her allocation, so Slurm lowers priority until usage decays.',
    2: 'Your choice is not correct. A lost Slurm controller or node contact would show node or controller health symptoms. Reason=Priority with FairShare 0.034 is a scheduling-policy clue.',
    3: 'Your choice is not correct. Not enough GPUs would show a resource or capacity reason. This prompt says Reason=Priority, so the job is delayed by fair-share priority, not by GPU count.',
  },
  18: {
    0: 'Your choice is not correct. Pod affinity can influence where pods land, but it does not guarantee that all ranks start together. Distributed training needs an all-or-nothing scheduling guarantee.',
    2: 'Your choice is not correct. A DaemonSet runs one pod per selected node, which is useful for agents. It does not coordinate a 16-pod training job so all ranks start at the same time.',
    3: 'Your choice is not correct. ResourceQuota limits how much a namespace can consume. It does not hold a distributed job until every required pod can be scheduled.',
  },
  19: {
    0: 'Your choice is not correct. GPU reset helps with some hung-GPU incidents, but this error says the container lacks a kernel image for the H100 architecture. That is a build/runtime compatibility issue.',
    2: 'Your choice is not correct. Newer NVIDIA drivers are generally backward-compatible with older CUDA runtimes. The problem is not that the driver is too new; the container was built without the needed sm_90 support.',
    3: 'Your choice is not correct. Setting CUDA_VISIBLE_DEVICES empty hides GPUs from the application. That would avoid using the GPU instead of fixing the missing H100-compatible CUDA kernels.',
  },
  20: {
    0: 'Your choice is not correct. It cannot be ML but not AI, because machine learning is a subset of AI. Anything that is ML is also AI by definition.',
    2: 'Your choice is not correct. A rule-based system that does not learn is AI but not machine learning. A neural network that learns from data is deep learning.',
    3: 'Your choice is not correct. Deep learning uses statistical ideas but is a form of AI. A many-layer neural network is squarely deep learning, not something unrelated to AI.',
  },
  21: {
    0: 'Your choice is not correct. Losing a parallel-throughput benchmark does not mean the CPU is broken. It is latency-optimized for different work, so this is a design trade-off, not a defect.',
    2: 'Your choice is not correct. The gap is architectural, not a RAM shortage. Even with ample RAM, a few latency-optimized cores cannot match thousands of parallel GPU cores on dense matmul.',
    3: 'Your choice is not correct. The benchmark measures on-device compute, not the network. The speedup comes from the GPU\'s parallel architecture and Tensor Cores.',
  },
  22: {
    0: 'Your choice is not correct. Training, not inference, is the memory-heavy side because it holds gradients and optimizer state. Inference runs only the forward pass.',
    2: 'Your choice is not correct. It is reversed: training is throughput-oriented while inference is latency-sensitive. Do not swap the two profiles.',
    3: 'Your choice is not correct. They are not identical. Training sustains high utilization and memory for backprop; inference is request-driven and latency-bound.',
  },
  23: {
    0: 'Your choice is not correct. NeMo builds and customizes models; it is not the scalable serving layer. Serving is Triton or NIM.',
    1: 'Your choice is not correct. RAPIDS accelerates data science and data preparation, not model serving. Use NIM or Triton to serve inference.',
    3: 'Your choice is not correct. DCGM monitors GPU health and metrics. It does not serve model inference requests.',
  },
  24: {
    1: 'Your choice is not correct. Triton serves trained models as inference endpoints. Building and customizing LLMs is the job of NeMo.',
    2: 'Your choice is not correct. cuBLAS is a CUDA-X linear-algebra library used under the hood, not a model-building framework. NeMo builds LLMs.',
    3: 'Your choice is not correct. Base Command Manager handles cluster management. Building and customizing LLMs is NeMo\'s role.',
  },
  25: {
    0: 'Your choice is not correct. cuDNN accelerates neural-network primitives like convolutions and attention, not multi-GPU collectives. AllReduce is NCCL.',
    2: 'Your choice is not correct. cuFFT handles fast Fourier transforms. The collective communication library behind AllReduce is NCCL.',
    3: 'Your choice is not correct. RAPIDS cuDF is a GPU dataframe library for data science. Multi-GPU AllReduce is provided by NCCL.',
  },
  26: {
    0: 'Your choice is not correct. Data preparation (RAPIDS/DALI) comes before training, not between training and deployment. TensorRT owns optimization.',
    2: 'Your choice is not correct. Monitoring (DCGM/Prometheus) comes after deployment. The stage TensorRT owns is model optimization.',
    3: 'Your choice is not correct. Data labeling is part of the data stage before training. TensorRT owns the optimization stage between training and deployment.',
  },
  27: {
    0: 'Your choice is not correct. Physical rack units rarely bind first for GPU nodes; the power (and cooling) budget does. A 40 kW feed caps you near three to four 10 kW nodes.',
    2: 'Your choice is not correct. Cable length is not the limiter here. The rack power feed and matching cooling budget determine node count.',
    3: 'Your choice is not correct. Kubernetes does not impose the ceiling here. The physical power feed and cooling envelope do.',
  },
  28: {
    0: 'Your choice is not correct. Paperwork is not the reason. Scalable units keep compute, network, power, and cooling in a validated, balanced ratio as the cluster grows.',
    2: 'Your choice is not correct. GPU counts are not required to be prime. Scalable units exist to keep the fabric and facility proportioned to the compute.',
    3: 'Your choice is not correct. SuperPOD uses InfiniBand; it does not avoid it. Scalable units balance compute with fabric, power, and cooling.',
  },
  29: {
    0: 'Your choice is not correct. A DPU does not add GPU memory. It offloads infrastructure work (networking, storage, security) from the host CPU.',
    2: 'Your choice is not correct. A DPU does not raise the host CPU clock. It removes infrastructure overhead from host cores by running it on the DPU.',
    3: 'Your choice is not correct. The DPU does not replace the InfiniBand fabric; it integrates a NIC and offloads services from the host CPU.',
  },
  30: {
    0: 'Your choice is not correct. Cloud is not always cheaper. For sustained high utilization over years, owned infrastructure usually wins on TCO.',
    2: 'Your choice is not correct. On-prem clusters run GPUs at large scale routinely (for example DGX SuperPOD). The deciding factors are utilization and data gravity.',
    3: 'Your choice is not correct. The choice does matter. Utilization, data residency, and control all steer this decision.',
  },
  31: {
    0: 'Your choice is not correct. Clean ECC and XID counters mean the hardware is healthy. This is contention from oversubscription, not a failed GPU.',
    2: 'Your choice is not correct. A broken NVLink cable would show topology or CRC evidence. Here all guests slow together on shared compute, which is oversubscription.',
    3: 'Your choice is not correct. Thermal throttling shows high temperature or thermal-slowdown evidence. This is scheduler contention among too many time-shared guests.',
  },
};

const QUIZ_CORRECT_CHOICE_FEEDBACK = {
  0: 'Correct. XID 48 is the beginner anchor for double-bit ECC memory failure. The important operator idea is trust: once memory reports an uncorrectable error, you protect workloads and stop scheduling new work there.',
  1: 'Correct. DCGM field 157 is the DBE counter. A non-zero value is not just a warning trend; it means uncorrectable memory trouble has already appeared in this boot window.',
  2: 'Correct. "Fallen off the bus" means the driver or OS lost contact with the GPU. That phrase should make you think XID 79, not ECC, NVLink CRC, or thermal throttling.',
  3: 'Correct. After XID 79, a failed GPU reset means the safe recovery path escalates to a hard node reboot. The key lesson is not to keep poking a GPU the system can no longer reliably control.',
  4: 'Correct. CRC flit errors are packet corruption on the NVLink path. That points to XID 74 and a physical or signal-integrity problem on the cable, connector, or NVSwitch path.',
  5: 'Correct. High temperature plus utilization dropping in bursts is the thermal-throttle pattern. Beginners should tie heat evidence to clocks and SM utilization before blaming network or storage.',
  6: 'Correct. HW Thermal SlowDown is cooling evidence. Drain first to protect jobs, inspect airflow or heatsink contact, then use a power cap as a temporary mitigation while the physical issue is handled.',
  7: 'Correct. Field 156 is the single-bit ECC counter. SBE is corrected, so it is usually a trend and maintenance signal rather than an immediate stop-the-node signal like DBE.',
  8: 'Correct. "Using network Socket" means NCCL is not using the intended high-speed IB path. The first cheap, targeted check is whether an environment variable forced IB off.',
  9: 'Correct. If IB ports are Active but NCCL still uses TCP, the fabric exists but NCCL may be pointed at the wrong HCA name. This separates hardware visibility from application configuration.',
  10: 'Correct. Rising PFC frames on RoCE point to pause-frame congestion. The beginner lesson is that Ethernet lossless behavior can hurt training throughput even when GPUs themselves are healthy.',
  11: 'Correct. PHB instead of NV4 means traffic is crossing the PCIe host bridge instead of the expected NVLink path. The topology output is the evidence, not the utilization number by itself.',
  12: 'Correct. MIG setup is a two-step mental model: enable MIG mode, then create the specific GPU instances and compute instances. Kubernetes consumes the result later; it does not carve the GPU by itself.',
  13: 'Correct. Sawtooth GPU utilization plus saturated NFS is input starvation. The GPU is not weak; it is waiting for data between bursts of work.',
  14: 'Correct. A stripe count of 1 sends the dataset through one OST. Striping across more OSTs spreads reads out and often fixes the largest bottleneck before application tuning.',
  15: 'Correct. DCGM Exporter exposes GPU metrics on port 9400 by default. Prometheus may scrape it, but Prometheus itself is usually a different service and port.',
  16: 'Correct. The nodes advertise GPUs, so visibility exists. "Insufficient nvidia.com/gpu" usually means the GPU slots are already allocated to other pods.',
  17: 'Correct. Low FairShare means Alice has consumed more than her share recently. Slurm is applying scheduling policy, not reporting a broken GPU or lost controller.',
  18: 'Correct. Gang scheduling is the all-or-nothing concept. Distributed training ranks often need to start together, or early ranks wait and NCCL initialization can hang.',
  19: 'Correct. "No kernel image is available" means the container lacks code for the GPU architecture. For H100, rebuild on a CUDA 12-era NGC base image with sm_90 support.',
  20: 'Correct. AI, ML, and DL are nested. A learning multi-layer neural network is deep learning, which is inside machine learning, which is inside AI. GenAI and LLMs are deep learning.',
  21: 'Correct. The GPU wins because dense matmul is massively parallel and fits its throughput-optimized cores and Tensor Cores. The CPU is a different tool, not a broken one.',
  22: 'Correct. Training sustains high utilization and holds gradients and optimizer state (memory-heavy, throughput-first); inference runs the forward pass and is latency-sensitive and request-driven.',
  23: 'Correct. NIM and Triton serve trained models as scalable inference endpoints. NeMo builds models, RAPIDS preps data, and DCGM monitors GPUs.',
  24: 'Correct. NeMo is NVIDIA\'s framework for building and customizing LLMs and generative models. Triton serves, cuBLAS accelerates math, and Base Command manages clusters.',
  25: 'Correct. NCCL is the CUDA-X collective communication library behind AllReduce across GPUs and nodes. A missing or slow NCCL path is a classic multi-GPU bottleneck.',
  26: 'Correct. TensorRT owns the optimization stage between training and deployment, applying kernel fusion and reduced precision. Data prep is before training; monitoring is after deployment.',
  27: 'Correct. GPU nodes are power-dense, so the rack power feed and cooling budget cap density before floor space. A 40 kW feed supports roughly three to four 10 kW nodes.',
  28: 'Correct. Scalable units grow compute, network, power, and cooling together in a validated ratio, avoiding the imbalance you get from bolting GPUs onto an unchanged facility.',
  29: 'Correct. A BlueField DPU offloads networking, storage, and security from the host CPU, freeing cores to feed the GPUs and isolating the infrastructure domain. Adding GPUs would not help.',
  30: 'Correct. Sustained high utilization plus data-residency needs favor on-premises TCO and control. Cloud wins for bursty or uncertain demand; hybrid blends both.',
  31: 'Correct. Clean ECC and XID counters plus a shared slowdown mean oversubscription contention on time-shared compute. Reduce the guest count or use MIG for hard isolation.',
};

// Fold the extended bank (js/quiz-bank.js, loaded before this file) into the
// same QUIZ + per-choice feedback structures the renderer already uses.
if (Array.isArray(window.AEGIS_QUIZ_BANK)) {
  window.AEGIS_QUIZ_BANK.forEach((item) => {
    const qi = QUIZ.push(item) - 1;
    if (item.correct) QUIZ_CORRECT_CHOICE_FEEDBACK[qi] = item.correct;
    if (item.wrong) QUIZ_WRONG_CHOICE_FEEDBACK[qi] = item.wrong;
  });
}

function getQuizChoiceFeedback(qi, q, chosenIdx) {
  const questionIndex = Number.isInteger(qi) ? qi : QUIZ.indexOf(q);
  if (chosenIdx === q.ans) {
    return QUIZ_CORRECT_CHOICE_FEEDBACK[questionIndex]
      || 'Correct. This answer matches the strongest evidence in the scenario and chooses the smallest safe operator action.';
  }
  return QUIZ_WRONG_CHOICE_FEEDBACK[questionIndex]?.[chosenIdx]
    || 'Your choice is not correct. This quiz option is missing a specific explanation, so flag it for review. The intended learning flow should explain the exact failure class behind every wrong answer.';
}

function renderQuizExplanation(q, chosenIdx, revealCorrect = chosenIdx === q.ans, qi = null) {
  const correctLetter = String.fromCharCode(65 + q.ans);
  const correctText = q.opts[q.ans] || '';
  const chosenLetter = String.fromCharCode(65 + chosenIdx);
  const chosenText = q.opts[chosenIdx] || '';
  const isCorrect = chosenIdx === q.ans;
  const choiceReason = getQuizChoiceFeedback(qi, q, chosenIdx);
  return `
    <div class="quiz-explain-kicker">${isCorrect ? 'Correct' : 'Not quite'}</div>
    <div class="quiz-choice-feedback ${isCorrect ? 'correct' : 'wrong'}">
      <span>${escHtml(chosenLetter)}</span>
      <div>
        <strong>${escHtml(tightenDisplayCopy(chosenText))}</strong>
        <p>${escHtml(tightenDisplayCopy(choiceReason))}</p>
      </div>
    </div>
    ${revealCorrect ? `
      <div class="quiz-correct-answer">
        <span>${escHtml(correctLetter)}</span>
        <strong>${escHtml(tightenDisplayCopy(correctText))}</strong>
      </div>
      <p>${escHtml(tightenDisplayCopy(q.exp))}</p>
    ` : ''}
  `;
}

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
  updateLearnTabs('quiz');
  renderDetachedPanel('quizOverlay');
}

function selectAnswer(qi, optIdx) {
  if(quizState.submitted) return;
  quizState.answers[qi] = optIdx;
  const q = QUIZ[qi];
  document.querySelectorAll(`[id^="qo-${qi}-"]`).forEach(el=>{
    el.classList.remove('selected', 'correct', 'wrong');
  });
  document.getElementById(`qo-${qi}-${optIdx}`)?.classList.add('selected');
  if(optIdx === q.ans) {
    document.getElementById(`qo-${qi}-${optIdx}`)?.classList.add('correct');
  } else {
    document.getElementById(`qo-${qi}-${optIdx}`)?.classList.add('wrong');
  }
  const explanation = document.getElementById(`qe-${qi}`);
  if (explanation) {
    explanation.innerHTML = renderQuizExplanation(q, optIdx, optIdx === q.ans, qi);
    explanation.classList.add('show');
  }
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
    const explanation = document.getElementById(`qe-${i}`);
    if (explanation) {
      explanation.innerHTML = renderQuizExplanation(q, chosen, true, i);
      explanation.classList.add('show');
    }
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
  if (typeof window.scheduleProgressSync === 'function') window.scheduleProgressSync();
  renderDetachedPanel('quizOverlay');
}

function resetQuiz() { quizState = {}; openQuiz(); }
function closeQuiz() { document.getElementById('quiz-overlay').classList.remove('show'); }
