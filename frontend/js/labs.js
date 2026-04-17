/**
 * LABS MODULE: Definitions for the interactive scenarios.
 * Full data restored from monolithic v2 source.
 */

const LABS = {
  nvlink: {
    name: "NVLink Topology",
    icon: "🔗",
    color: "#4a9eff",
    objective: "Verify NVLink connectivity between 8 H100 GPUs.",
    steps: [
      { label:"View Topology", cmd:"nvidia-smi topo -m", type:"topo" },
      { label:"Check NVLink Errors", cmd:"nvidia-smi nvlink -e", type:"nvlink_err" },
      { label:"Benchmark AllReduce", cmd:"./nccl-tests/build/all_reduce_perf -b 1G -e 4G -f 2 -g 8", type:"benchmark" },
      { label:"Fault: Inject PHB", cmd:"# Simulating NVLink failure", type:"nvlink_fault", fault:true },
      { label:"Diagnose Fallback", cmd:"NCCL_DEBUG=INFO torchrun train.py", type:"nccl_diag" }
    ],
    draw: drawNVLink
  },
  mig: {
    name: "MIG Partitioning",
    icon: "🍕",
    color: "#c87941",
    objective: "Partition one H100 into 7 instances.",
    steps: [
      { label:"Enable MIG Mode", cmd:"sudo nvidia-smi -i 0 -mig 1", type:"mig_enable" },
      { label:"Create 7 Instances", cmd:"sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C", type:"mig_create" },
      { label:"List Instances", cmd:"nvidia-smi mig -lgi", type:"mig_list" },
      { label:"Assign Workloads", cmd:"# Assigning 3 teams", type:"mig_assign" },
      { label:"Disable MIG", cmd:"sudo nvidia-smi -i 0 -mig 0", type:"mig_disable" }
    ],
    draw: drawMIG
  },
  ecc: {
    name: "ECC Error Lifecycle",
    icon: "🔬",
    color: "#f0b429",
    objective: "Observe GPU memory error lifecycle.",
    steps: [
      {
        label:"Healthy Baseline",
        cmd:"dcgmi dmon -e 156,157 -c 5",
        type:"ecc_healthy",
        deeperContext:"This opening step establishes the healthy reference point. Beginners need to see that ECC work starts with a baseline, because later counts only mean something if you know what normal looked like first.",
        lookFor:[
          "Field 156 (SBE) staying at 0 across the polling window",
          "Field 157 (DBE) staying at 0 with no sudden jumps",
          "Stable output that tells you the GPU is not already in a degraded memory state"
        ],
        meaning:"A clean baseline means the card is healthy right now. You are proving that the system starts from corrected-error count 0 and uncorrected-error count 0 before degradation begins.",
        justifiedConclusion:"The GPU is currently healthy enough to establish a trustworthy reference point for the rest of the lab.",
        stillPremature:"It is too early to conclude that the card will remain healthy over time, because one clean baseline only describes the current state.",
        thresholdCrossed:"No fault threshold is crossed yet. This step establishes the baseline you will compare against later.",
        takeAction:[
          "Record the clean SBE and DBE values mentally or in notes before moving on.",
          "Anchor the lesson around the idea that trend matters more than one isolated number.",
          "Use this step as the comparison point for every later poll in the lab."
        ],
        avoid:[
          "Do not skip the baseline and then guess later whether the card worsened.",
          "Do not treat one clean poll as permanent proof that the GPU will stay healthy."
        ]
      },
      {
        label:"SBE Trend Rising",
        cmd:"# Simulating degradation",
        type:"ecc_sbe",
        fault:true,
        deeperContext:"This is the early-warning phase. Single-bit ECC errors are usually corrected automatically, so the workload may keep running. That is exactly why beginners need to learn that corrected does not mean harmless forever.",
        lookFor:[
          "The SBE counter climbing while DBE is still 0",
          "A pattern of repeat corrected errors instead of one random blip",
          "A card that still appears usable even though the memory story is getting worse"
        ],
        meaning:"Rising SBE counts mean the GPU is still catching and fixing bad bits, but the memory path is no longer perfectly clean. Repeated corrected errors are often the warning sign before a more serious uncorrectable event.",
        changedFromPrevious:"The system moved from a clean baseline to accumulating corrected ECC errors. You are no longer looking at a healthy steady state.",
        justifiedConclusion:"The card is showing early degradation signals and now deserves active trending instead of passive trust.",
        stillPremature:"It is still too early to declare the GPU unusable or to call this an uncorrectable hardware incident, because DBE is still 0.",
        thresholdCrossed:"The monitoring threshold is crossed: you now have a rising corrected-error pattern that justifies deeper observation and preparation for containment.",
        takeAction:[
          "Treat repeated SBE growth as a maintenance signal, not as noise.",
          "Continue polling so you can tell whether the trend is stabilizing or escalating.",
          "Start thinking in terms of proactive containment before the job experiences an uncorrectable failure."
        ],
        avoid:[
          "Do not say 'the GPU fixed it, so there is no issue.'",
          "Do not jump straight to RMA on one tiny corrected event without checking the trend."
        ]
      },
      {
        label:"Poll ECC Trend",
        cmd:"dcgmi dmon -e 156,157 -c 10",
        type:"ecc_trend",
        deeperContext:"This step teaches that operations work is about observing the direction of change. A longer poll window helps beginners see whether the SBE rise is a persistent pattern instead of a one-time event.",
        lookFor:[
          "Whether field 156 keeps increasing over repeated samples",
          "Whether field 157 remains 0 or begins to change",
          "Whether the error pattern looks stable, worsening, or suddenly accelerating"
        ],
        meaning:"If SBE keeps climbing during repeated polls, the card is trending the wrong way. The important lesson is that the lifecycle is moving from healthy baseline to corrected-error accumulation, which raises concern even before a DBE appears.",
        changedFromPrevious:"You are no longer seeing a one-step rise. The corrected-error pattern persisted across a longer observation window, which makes the trend more trustworthy.",
        justifiedConclusion:"The degradation signal is persistent enough to treat as real operational evidence, not a random one-off anomaly.",
        stillPremature:"It is still too early to say the card has had an uncorrectable ECC failure unless DBE or an XID confirms that escalation.",
        thresholdCrossed:"The evidence threshold for proactive containment planning is crossed: the trend is now persistent, not just visible once.",
        takeAction:[
          "Compare this poll directly to the first baseline step, not to your intuition.",
          "Use trend language: rising, flat, accelerating, or crossed into DBE.",
          "Prepare to contain the node if the lifecycle moves from corrected to uncorrected errors."
        ],
        avoid:[
          "Do not stare at one row of output and ignore the time dimension.",
          "Do not wait for a catastrophic failure before acknowledging that the memory story is worsening."
        ]
      },
      {
        label:"XID 48 Appears",
        cmd:"dmesg | grep -i xid",
        type:"ecc_xid",
        fault:true,
        deeperContext:"This is the inflection point where the lifecycle stops being just a warning trend and becomes a hard fault. XID 48 is the moment beginners must connect the jargon, the ECC counters, and the operational consequence.",
        lookFor:[
          "An XID 48 entry in dmesg tied to the affected GPU",
          "Evidence that the event is now an uncorrectable memory failure, not only corrected SBEs",
          "The shift from monitoring mode to immediate containment mode"
        ],
        meaning:"XID 48 usually indicates a double-bit ECC error, which is uncorrectable. The GPU could not safely repair the memory corruption, so this is now a hardware-integrity incident rather than a watch-and-trend situation.",
        changedFromPrevious:"The lifecycle crossed from corrected-error trending into an explicit uncorrectable hardware fault. This is the moment where the story changes from observe and prepare to contain and escalate.",
        justifiedConclusion:"The node should now be treated as unsafe for fresh workload placement because the evidence supports a real hardware-integrity incident.",
        stillPremature:"It is still too early to call the issue resolved or to assume a software tweak will safely return the GPU to service.",
        thresholdCrossed:"The hard-fault threshold is crossed: XID 48 and DBE-level behavior justify immediate containment, incident handling, and likely vendor escalation.",
        takeAction:[
          "Identify the affected GPU and node clearly before touching cluster state.",
          "Treat the node as unsafe for new workloads until it is contained.",
          "Move from observation to containment: the next correct step is draining the node."
        ],
        avoid:[
          "Do not keep scheduling fresh jobs on a node that just raised XID 48.",
          "Do not explain XID 48 as 'just another ECC warning'; it is materially more serious than rising SBEs."
        ]
      },
      {
        label:"Drain Node",
        cmd:"kubectl drain gpu-node-03",
        type:"ecc_drain",
        deeperContext:"This final step teaches containment. The beginner lesson is that the job of an operator is not only to diagnose the bad card, but also to protect the rest of the cluster from landing new work on a known-bad node.",
        lookFor:[
          "The scheduler stopping new workloads from landing on the affected node",
          "A clear separation between diagnosis and containment responsibilities",
          "The system moving into a safe state while deeper remediation or RMA is prepared"
        ],
        meaning:"Draining the node does not repair the GPU. It protects users and workloads by taking the unstable hardware out of normal service until the incident is fully handled.",
        changedFromPrevious:"The response moved from diagnosis into containment. Instead of collecting more evidence, the operator is now changing cluster state to protect workloads.",
        justifiedConclusion:"The correct operational priority is now blast-radius control, not continued observation on an in-service node.",
        stillPremature:"It is still too early to say the GPU is repaired, healthy again, or ready to return to normal scheduling.",
        thresholdCrossed:"The scheduling-control threshold is crossed: once an uncorrectable memory incident is confirmed, the node must be removed from normal placement until remediation is complete.",
        takeAction:[
          "Drain the node after confirming the uncorrectable ECC event.",
          "Notify the workload owner or operations channel that the node is being removed from service.",
          "Escalate into hardware remediation or vendor process after containment is complete."
        ],
        avoid:[
          "Do not confuse draining with fixing the card.",
          "Do not return the node to normal scheduling until the hardware issue has been resolved and validated."
        ]
      }
    ],
    draw: drawECC
  },
  nvlink_fault: {
    name: "XID Fault Drill",
    icon: "⚡",
    color: "#e05252",
    objective: "Respond to XID 48, 79, and 74.",
    steps: [
      { label:"XID 48 Alert", cmd:"dmesg | tail -20 | grep xid", type:"xid48", fault:true },
      { label:"Confirm DBE", cmd:"dcgmi dmon -e 157 -c 3", type:"xid48_confirm" },
      { label:"XID 79 Alert", cmd:"# Simulating GPU hang", type:"xid79", fault:true },
      { label:"Attempt GPU Reset", cmd:"sudo nvidia-smi --gpu-reset -i 3", type:"xid79_reset" },
      { label:"XID 74 (NVLink)", cmd:"nvidia-smi nvlink -e", type:"xid74", fault:true }
    ],
    draw: drawFaultDrill
  },
  cuda_stack: {
    name: "CUDA Stack Verification",
    icon: "⚙️",
    color: "#9b7fe8",
    objective: "Verify 5-layer software compatibility.",
    steps: [
      { label:"Check Driver", cmd:"cat /proc/driver/nvidia/version", type:"driver_ver" },
      { label:"Check CUDA", cmd:"nvcc --version", type:"cuda_ver" },
      { label:"Check PyTorch", cmd:"python3 -c \"import torch\"", type:"torch_check" },
      { label:"Fault: Mismatch", cmd:"# Simulating version mismatch", type:"cuda_mismatch", fault:true },
      { label:"Fix with NGC", cmd:"docker pull nvcr.io/nvidia/pytorch", type:"ngc_fix" }
    ],
    draw: drawCUDAStack
  },
  container: {
    name: "NGC Container Flow",
    icon: "📦",
    color: "#76b900",
    objective: "Pull and run validated stacks.",
    steps: [
      { label:"Pull NGC", cmd:"docker pull nvcr.io/nvidia/pytorch", type:"ngc_pull" },
      { label:"Run with GPU", cmd:"docker run --gpus all", type:"ngc_run" },
      { label:"Verify Inside", cmd:"docker run --gpus all python3 -c \"import torch\"", type:"ngc_verify" },
      { label:"Start Training", cmd:"docker run --gpus all python3 train.py", type:"ngc_train" },
      { label:"Monitor Inside", cmd:"docker exec nvidia-smi dmon", type:"ngc_monitor" }
    ],
    draw: drawContainer
  },
  training: {
    name: "Distributed Training (DDP)",
    icon: "🧠",
    color: "#76b900",
    objective: "Walk through AllReduce sync.",
    steps: [
      { label:"Launch DDP", cmd:"torchrun train.py", type:"ddp_launch" },
      { label:"Forward Pass", cmd:"# Sharding batch", type:"ddp_fwd" },
      { label:"Backward Pass", cmd:"# Computing local grads", type:"ddp_bwd" },
      { label:"AllReduce Sync", cmd:"# Averaging grads", type:"ddp_allreduce" },
      { label:"Weight Update", cmd:"optimizer.step()", type:"ddp_update" },
      { label:"Storage Bottleneck", cmd:"iostat -x 1", type:"ddp_storage", fault:true }
    ],
    draw: drawDDP
  },
  allreduce: {
    name: "AllReduce Deep Dive",
    icon: "🔄",
    color: "#00d4d4",
    objective: "Trace Ring Algorithm.",
    steps: [
      { label:"Check Path", cmd:"NCCL_DEBUG=INFO torchrun train.py", type:"nccl_path" },
      { label:"Ring Reduce", cmd:"# Step 1/8", type:"ring1" },
      { label:"Ring Gather", cmd:"# Step 8/8", type:"ring2" },
      { label:"Benchmark", cmd:"./all_reduce_perf", type:"ar_bench" },
      { label:"Fault: IB Disable", cmd:"export NCCL_IB_DISABLE=1", type:"ar_fault", fault:true },
      { label:"Fix IB Path", cmd:"unset NCCL_IB_DISABLE", type:"ar_fix" }
    ],
    draw: drawAllReduce
  },
  ib_fabric: {
    name: "InfiniBand Fabric",
    icon: "🌐",
    color: "#4a9eff",
    objective: "Verify fabric health.",
    steps: [
      { label:"Check Ports", cmd:"ibstat", type:"ib_stat" },
      { label:"Check Errors", cmd:"perfquery", type:"ib_perfq" },
      { label:"RDMA BW Test", cmd:"ib_write_bw", type:"ib_bw" },
      { label:"Fault: Port Down", cmd:"# Cable unplugged", type:"ib_fault", fault:true },
      { label:"ibdiagnet", cmd:"ibdiagnet --pc", type:"ib_diag" },
      { label:"Sweep Fabric", cmd:"ibdiagnet --pc --pm", type:"ib_sweep" }
    ],
    draw: drawIBFabric
  },
  roce: {
    name: "RoCEv2 + PFC/ECN",
    icon: "📡",
    color: "#c87941",
    objective: "Lossless Ethernet config.",
    steps: [
      { label:"Check MTU", cmd:"ip link show eth0", type:"roce_mtu" },
      { label:"Verify PFC", cmd:"ethtool -A eth0", type:"roce_pfc" },
      { label:"Check ECN", cmd:"tc qdisc show", type:"roce_ecn" },
      { label:"Measure BW", cmd:"ib_write_bw -d rxe0", type:"roce_bw" },
      { label:"Fault: PFC Storm", cmd:"ethtool -S eth0", type:"roce_fault", fault:true },
      { label:"Tune Buffers", cmd:"# Tuning switch", type:"roce_fix" }
    ],
    draw: drawRoCE
  },
  nccl_fallback: {
    name: "NCCL Fallback Drill",
    icon: "🛠️",
    color: "#e05252",
    objective: "Diagnose TCP vs IB.",
    steps: [
      { label:"Diagnose", cmd:"NCCL_DEBUG=INFO torchrun train.py", type:"fb_diag" },
      { label:"Check Env", cmd:"env | grep NCCL", type:"fb_env" },
      { label:"Check ibstat", cmd:"ibstat", type:"fb_ib" },
      { label:"Set IB_HCA", cmd:"export NCCL_IB_HCA=mlx5_0", type:"fb_fix" },
      { label:"Verify Fixed", cmd:"NCCL_DEBUG=INFO torchrun", type:"fb_verify" },
      { label:"Compare BW", cmd:"./perf", type:"fb_bench" }
    ],
    draw: drawNCCLFallback
  },
  storage: {
    name: "Storage Bottleneck",
    icon: "💾",
    color: "#9b7fe8",
    objective: "Diagnose Sawtooth pattern.",
    steps: [
      { label:"Watch GPU Util", cmd:"nvidia-smi dmon -s u", type:"stor_gpu" },
      { label:"Check I/O", cmd:"iostat -x 1", type:"stor_io" },
      { label:"Check Stripe", cmd:"lfs getstripe", type:"stor_lustre" },
      { label:"Fix: Stripe", cmd:"lfs setstripe -c 8", type:"stor_fix" },
      { label:"Tune Workers", cmd:"# num_workers=16", type:"stor_dl" },
      { label:"Verify Fix", cmd:"nvidia-smi dmon", type:"stor_verify" }
    ],
    draw: drawStorage
  },
  gds: {
    name: "GPUDirect Storage",
    icon: "⚡",
    color: "#00d4d4",
    objective: "Bypass CPU for DMA.",
    steps: [
      { label:"Traditional Path", cmd:"# NVMe->CPU->GPU", type:"gds_old" },
      { label:"GDS Path", cmd:"# NVMe->GPU DMA", type:"gds_new" },
      { label:"Verify GDS", cmd:"python3 -c \"import cufile\"", type:"gds_verify" },
      { label:"Measure Trad", cmd:"# 890 MB/s", type:"gds_bench_old" },
      { label:"Measure GDS", cmd:"# 2.4 GB/s", type:"gds_bench_new" }
    ],
    draw: drawGDS
  },
  monitoring: {
    name: "DCGM Monitoring",
    icon: "📊",
    color: "#76b900",
    objective: "Metrics at :9400.",
    steps: [
      { label:"Deploy Exporter", cmd:"docker run dcgm-exporter", type:"mon_deploy" },
      { label:"Verify Metrics", cmd:"curl localhost:9400/metrics", type:"mon_verify" },
      { label:"Prom Scrape", cmd:"# Scraping config", type:"mon_prom" },
      { label:"Grafana ID 12239", cmd:"# Import dashboard", type:"mon_grafana" },
      { label:"Create Alert", cmd:"# Prometheus rule", type:"mon_alert" },
      { label:"Test Alert", cmd:"# Simulating DBE", type:"mon_test", fault:true }
    ],
    draw: drawMonitoring
  },
  slurm: {
    name: "Slurm Scheduler",
    icon: "📋",
    color: "#f0b429",
    objective: "Job lifecycle and Fairshare.",
    steps: [
      { label:"Submit Job", cmd:"sbatch train.sh", type:"slurm_submit" },
      { label:"Check Queue", cmd:"squeue -u $USER", type:"slurm_queue" },
      { label:"Debug PENDING", cmd:"scontrol show job", type:"slurm_pend" },
      { label:"Check Fairshare", cmd:"sshare -u alice", type:"slurm_fair" },
      { label:"Drain Node", cmd:"scontrol update state=drain", type:"slurm_drain" },
      { label:"Resume Node", cmd:"scontrol update state=resume", type:"slurm_resume" }
    ],
    draw: drawSlurm
  },
  k8s: {
    name: "Kubernetes GPU Ops",
    icon: "☸️",
    color: "#4a9eff",
    objective: "GPU Operator and Gang Scheduling.",
    steps: [
      { label:"Check Operator", cmd:"kubectl get pods -n gpu-operator", type:"k8s_operator" },
      { label:"Verify Resource", cmd:"kubectl describe node", type:"k8s_resources" },
      { label:"Debug Pending", cmd:"kubectl describe pod", type:"k8s_pending" },
      { label:"Check NetPol", cmd:"kubectl get netpol", type:"k8s_netpol" },
      { label:"Drain Node", cmd:"kubectl drain node-03", type:"k8s_drain" },
      { label:"Gang Schedule", cmd:"kubectl get podgroup", type:"k8s_gang" }
    ],
    draw: drawK8s
  }
};

const TERMINAL_OUTPUT = {
  topo: [
    {t:'cmd',  v:'$ nvidia-smi topo -m'},
    {t:'dim',  v:'        GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7  CPU Affinity'},
    {t:'good', v:'GPU0     X    NV4   NV4   NV4   NV4   NV4   NV4   NV4   0-63'},
    {t:'good', v:'GPU1    NV4    X    NV4   NV4   NV4   NV4   NV4   NV4   0-63'},
    {t:'good', v:'GPU2    NV4   NV4    X    NV4   NV4   NV4   NV4   NV4   0-63'},
    {t:'good', v:'GPU3    NV4   NV4   NV4    X    NV4   NV4   NV4   NV4   0-63'},
    {t:'good', v:'GPU4    NV4   NV4   NV4   NV4    X    NV4   NV4   NV4   0-63'},
    {t:'good', v:'GPU5    NV4   NV4   NV4   NV4   NV4    X    NV4   NV4   0-63'},
    {t:'good', v:'GPU6    NV4   NV4   NV4   NV4   NV4   NV4    X    NV4   0-63'},
    {t:'good', v:'GPU7    NV4   NV4   NV4   NV4   NV4   NV4   NV4    X    0-63'},
    {t:'good', v:'NV4 = connected via NVLink (4 links) ✓'}
  ],
  nvlink_err: [
    {t:'cmd',  v:'$ nvidia-smi nvlink -e'},
    {t:'good', v:'  Link 0: CRC Flit Error Count:       0  ✓'},
    {t:'good', v:'  Link 1: CRC Flit Error Count:       0  ✓'},
    {t:'good', v:'  Link 2: CRC Flit Error Count:       0  ✓'},
    {t:'good', v:'  Link 3: CRC Flit Error Count:       0  ✓'}
  ],
  benchmark: [
    {t:'cmd',  v:'$ ./nccl-tests/all_reduce_perf -g 8'},
    {t:'good', v:'Avg bus bandwidth    : 187.86 GB/s  ✓ (NVLink 4.0)'}
  ],
  nvlink_fault: [
    {t:'warn', v:'# ⚠ Simulating NVLink failure'},
    {t:'err',  v:'GPU0     X    PHB   PHB   PHB   ← NO NVLink — PCIe only!'},
    {t:'err',  v:'Actual AllReduce:   ~  3 GB/s  (PCIe bottleneck)'}
  ],
  nccl_diag: [
    {t:'cmd',  v:'$ NCCL_DEBUG=INFO torchrun train.py'},
    {t:'err',  v:'NCCL WARN Using network Socket  ← TCP fallback!'},
    {t:'info', v:'Fix: Physical — inspect NVLink cables and NVSwitch ports on failing GPU pair'},
    {t:'info', v:'Run: nvidia-smi nvlink -e -i 0  (check error counters per link)'},
    {t:'dim',  v:'If counters non-zero: isolate GPU, replace NVLink cable or reseat NVSwitch'}
  ],
  mig_enable: [{t:'good', v:'Enabled MIG Mode for GPU 0'}],
  mig_create: [{t:'good', v:'7 MIG instances created (1g.10gb)'}],
  mig_list: [{t:'good', v:'GPU  0  GI 1  CI 0  10GB  MIG 1g.10gb'}],
  mig_assign: [{t:'good', v:'CUDA_VISIBLE_DEVICES=MIG-GPU-0:0:0'}],
  mig_disable: [{t:'good', v:'MIG mode disabled — full GPU restored'}],
  ecc_healthy: [{t:'good', v:'GPU:0       0          0   ✓ ECC clean'}],
  ecc_sbe: [{t:'warn', v:'# ⚠ Simulating degrading memory cells'}],
  ecc_trend: [{t:'err', v:'GPU:0      58          2   ← DRAIN AND RMA NOW'}],
  ecc_xid: [{t:'err', v:'NVRM: Xid 48, Double Bit ECC Error Occurred'}],
  ecc_drain: [{t:'good', v:'node/gpu-node-03 cordoned and drained'}],
  xid48: [{t:'err', v:'[86423.441] NVRM: Xid (PCI:0000:83:00): 48'}],
  xid48_confirm: [{t:'err', v:'Entity  Field 157 (DBE): 2'}],
  xid79: [{t:'err', v:'NVRM: GPU Board RmUninitializeClient: GPU hung'}],
  xid79_reset: [{t:'good', v:'Successfully reset GPU 00000000:43:00.0'}],
  xid74: [{t:'err', v:'XID 74 = NVLink Error — CRC Flit Error Count: 8472'}],
  driver_ver: [{t:'good', v:'NVRM version: 545.23.08'}],
  cuda_ver: [{t:'good', v:'nvcc: NVIDIA (R) Cuda compiler driver 12.3'}],
  torch_check: [{t:'good', v:'CUDA: 12.3 | Available: True'}],
  cuda_mismatch: [{t:'err', v:'PyTorch expects 11.8, Driver supports 12.3'}],
  ngc_fix: [{t:'good', v:'Fixed with NGC: CUDA 12.3, cuDNN 8.9, PyTorch 2.2'}],
  ngc_pull: [{t:'good', v:'Status: Downloaded nvidia/pytorch:24.01-py3'}],
  ngc_run: [{t:'good', v:'GPU accessible from inside container ✓'}],
  ngc_verify: [{t:'good', v:'torch.cuda.device_count(): 8 GPUs'}],
  ngc_train: [{t:'info', v:'[Epoch 1] step=100 loss=2.847 throughput=1234 s/s'}],
  ngc_monitor: [{t:'good', v:'GPU 0: 94% SM utilisation'}],
  ddp_launch: [{t:'good', v:'All 16 ranks connected ✓ (2 nodes × 8 GPUs)'}],
  ddp_fwd: [{t:'info', v:'Forward pass complete on all 16 GPUs'}],
  ddp_bwd: [{t:'info', v:'Backward pass: local gradients computed'}],
  ddp_allreduce: [{t:'good', v:'AllReduce complete via IB NDR ✓'}],
  ddp_update: [{t:'good', v:'optimizer.step() — all replicas identical'}],
  ddp_storage: [{t:'err', v:'nfs0: 100% util — sawtooth bottleneck detected'}],
  nccl_path: [{t:'good', v:'NCCL INFO Using network IB ✓'}],
  ring1: [{t:'info', v:'Round 1/7: Reduce-Scatter phase'}],
  ring2: [{t:'good', v:'Round 14/14: All-Gather complete ✓'}],
  ar_bench: [{t:'good', v:'Avg busbw: 187.8 GB/s (NVLink 4.0)'}],
  ar_fault: [{t:'err', v:'NCCL WARN Using network Socket (TCP Fallback)'}],
  ar_fix: [{t:'good', v:'NCCL INFO Using network IB restored ✓'}],
  ib_stat: [{t:'good', v:'State: Active | Rate: 400 Gb/s NDR'}],
  ib_perfq: [{t:'good', v:'PortXmitDiscards: 0 ✓'}],
  ib_bw: [{t:'good', v:'BW average: 380.94 Gb/sec (95% NDR max)'}],
  ib_fault: [{t:'err', v:'State: Down — Physical connection lost'}],
  ib_diag: [{t:'err', v:'BAD CABLE: node-06 → ibswitch-A port 12'}],
  ib_sweep: [{t:'good', v:'Sweep complete: 95 ports clean, 1 bad isolated'}],
  roce_mtu: [{t:'good', v:'mtu 9000 (jumbo frames) ✓'}],
  roce_pfc: [{t:'good', v:'RX: on | TX: on — PFC lossless enabled ✓'}],
  roce_ecn: [{t:'good', v:'ECN active on priority 3 (RDMA) ✓'}],
  roce_bw: [{t:'good', v:'BW peak: 92.34 GB/s (RoCEv2)'}],
  roce_fault: [{t:'err', v:'rx_pfc_frames: 24891 ← PFC storm detected!'}],
  roce_fix: [{t:'good', v:'ECN threshold lowered — PFC storm resolved ✓'}],
  fb_diag: [{t:'err', v:'NCCL WARN Using network Socket'}],
  fb_env: [{t:'err', v:'NCCL_IB_DISABLE=1 found'}],
  fb_ib: [{t:'good', v:'CA mlx5_0 State: Active ✓'}],
  fb_fix: [{t:'good', v:'unset NCCL_IB_DISABLE ✓'}],
  fb_verify: [{t:'good', v:'NCCL INFO Using network IB restored ✓'}],
  fb_bench: [{t:'good', v:'23× throughput improvement ✓'}],
  stor_gpu: [{t:'err', v:'GPU util: 94% → 4% → 91% (Sawtooth)'}],
  stor_io: [{t:'err', v:'nfs0: 100% util | await 48.2ms'}],
  stor_lustre: [{t:'err', v:'stripe_count: 1 (Lustre bottleneck)'}],
  stor_fix: [{t:'good', v:'stripe_count: 8 OSTs set ✓'}],
  stor_dl: [{t:'good', v:'num_workers=16 set ✓'}],
  stor_verify: [{t:'good', v:'No more sawtooth — throughput +2.3× ✓'}],
  gds_old: [{t:'warn', v:'NVMe → CPU → PCIe → GPU (2 copies)'}],
  gds_new: [{t:'good', v:'NVMe → GPU VRAM (direct DMA - 1 copy)'}],
  gds_verify: [{t:'good', v:'GDS available: 1.8.0 ✓'}],
  gds_bench_old: [{t:'warn', v:'Traditional: 890 MB/s'}],
  gds_bench_new: [{t:'good', v:'GDS: 2.4 GB/s (2.7× faster) ✓'}],
  mon_deploy: [{t:'good', v:'Listening on :9400/metrics ✓'}],
  mon_verify: [{t:'good', v:'dcgm_fi_dev_gpu_util 82 ✓'}],
  mon_prom: [{t:'good', v:'Prometheus scraping 8 nodes every 15s ✓'}],
  mon_grafana: [{t:'good', v:'Dashboard 12239 imported ✓'}],
  mon_alert: [{t:'good', v:'Alert GPUDoublebitECC created ✓'}],
  mon_test: [{t:'err', v:'PagerDuty incident created: GPU 3 DBE ✓'}],
  slurm_submit: [{t:'good', v:'Submitted batch job 99234 ✓'}],
  slurm_queue: [{t:'warn', v:'99234  PENDING  (Priority)'}],
  slurm_pend: [{t:'info', v:'Reason=Priority — start in ~2 hours'}],
  slurm_fair: [{t:'warn', v:'FairShare: 0.034 (Alice usage high)'}],
  slurm_drain: [{t:'warn', v:'gpu-node-05 state changed to DRAIN'}],
  slurm_resume: [{t:'good', v:'gpu-node-05 state changed to IDLE ✓'}],
  k8s_operator: [{t:'good', v:'nvidia-device-plugin READY 1/1 ✓'}],
  k8s_resources: [{t:'good', v:'Allocatable: nvidia.com/gpu: 8 ✓'}],
  k8s_pending: [{t:'err', v:'Insufficient nvidia.com/gpu'}],
  k8s_netpol: [{t:'err', v:'NetworkPolicy blocking port 29500'}],
  k8s_drain: [{t:'good', v:'node/gpu-node-03 drained successfully ✓'}],
  k8s_gang: [{t:'good', v:'PodGroup training-gang Running (16/16) ✓'}]
};

const DMESG_CLEAN = [
  {t:'dim',  v:'[    0.000] Linux version 5.14.0-427.16.1.el9_4.x86_64 (gcc version 11.4.1 20231218)'},
  {t:'dim',  v:'[    0.441] pci 0000:03:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:13:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:23:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:33:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:43:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:53:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:63:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'dim',  v:'[    0.441] pci 0000:73:00.0: [10de:2330] type 00 class 0x030200 (H100 SXM5)'},
  {t:'good', v:'[    0.502] nvidia 0000:03:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.521] nvidia 0000:13:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.539] nvidia 0000:23:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.557] nvidia 0000:33:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.575] nvidia 0000:43:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.593] nvidia 0000:53:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.611] nvidia 0000:63:00.0: enabling device (0000 -> 0002)'},
  {t:'good', v:'[    0.629] nvidia 0000:73:00.0: enabling device (0000 -> 0002)'},
  {t:'info', v:'[    4.101] NVRM: loading NVIDIA UNIX x86_64 Kernel Module  545.23.08  Thu Nov 16 00:00:00 UTC 2023'},
  {t:'info', v:'[    4.204] nvidia-nvswitch: detected 4 NVSwitches (LS10)'},
  {t:'good', v:'[    4.318] nvidia-nvlink: NvLink 4.0 Connected — 900 GB/s bidirectional per link  ✓'},
  {t:'good', v:'[    4.502] nvidia-nvswitch: all 8 GPUs fully meshed via NVSwitch fabric  ✓'},
  {t:'info', v:'[    5.012] nvidia-modeset: Loading NVIDIA Kernel Mode Setting Driver for UNIX platforms 545.23.08'},
  {t:'dim',  v:'[    5.234] NVRM: GPU Board Serial Number: [N/A]'},
  {t:'good', v:'[   12.441] nvidia 0000:03:00.0: irq 151 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   12.458] nvidia 0000:13:00.0: irq 167 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   12.475] nvidia 0000:23:00.0: irq 183 for MSI/MSI-X  ✓'},
  {t:'good', v:'[   15.001] nvidia-peermem: module loaded, version 1.4'},
  {t:'good', v:'[   15.441] nvidia-fs: nvidia_fs init successful, version=2.17.0 (GPUDirect Storage ready)  ✓'},
  {t:'good', v:'[   16.020] mlx5_core 0000:c1:00.0: firmware version 28.39.1002 (ConnectX-7 NDR400)'},
  {t:'good', v:'[   16.088] mlx5_core 0000:c1:00.1: firmware version 28.39.1002 (ConnectX-7 NDR400)'}
];

const DCGM_CLEAN = [
  {t:'dim',  v:'# dcgmi dmon -e 100,101,110,140,155,156,157,206 -d 1000'},
  {t:'dim',  v:'#           Utiliz  MemUtil  FBUsed   Temp   Power   SBE     DBE     XID'},
  {t:'dim',  v:'#Entity     (%)     (%)      (MiB)    (°C)   (W)     (cnt)   (cnt)   (cnt)'},
  {t:'good', v:' GPU 0       82      68       43622    71     418     0       0       0'},
  {t:'good', v:' GPU 1       79      65       42187    69     411     0       0       0'},
  {t:'good', v:' GPU 2       85      71       45056    73     432     0       0       0'},
  {t:'good', v:' GPU 3       81      67       43008    70     421     0       0       0'},
  {t:'good', v:' GPU 4       83      69       44032    72     425     0       0       0'},
  {t:'good', v:' GPU 5       80      66       42496    70     415     0       0       0'},
  {t:'good', v:' GPU 6       84      70       44544    71     428     0       0       0'},
  {t:'good', v:' GPU 7       82      68       43520    71     419     0       0       0'},
  {t:'dim',  v:''},
  {t:'dim',  v:'# dcgmi health -g 0 --check'},
  {t:'good', v:'Overall Health: Healthy'},
  {t:'good', v:'  GPU 0 : Healthy  |  GPU 1 : Healthy  |  GPU 2 : Healthy  |  GPU 3 : Healthy'},
  {t:'good', v:'  GPU 4 : Healthy  |  GPU 5 : Healthy  |  GPU 6 : Healthy  |  GPU 7 : Healthy'},
  {t:'dim',  v:''},
  {t:'dim',  v:'# dcgmi nvlink --link-status -g 0'},
  {t:'good', v:'  GPU 0 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 0 - Link  1: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 1 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'},
  {t:'good', v:'  GPU 2 - Link  0: Active  bw=900 GB/s  ✓   CRC Errs: 0   Replay: 0'}
];
