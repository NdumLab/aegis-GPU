/**
 * BEGINNER LEARNING MODULE
 * Curated explanations that keep operator jargon visible while adding plain-language guidance.
 */

window.AEGIS_LEARNING = {
  ecc: {
    quickAnswer: "ECC errors mean GPU memory protection detected bad data. Corrected errors were fixed automatically, but repeated corrected errors can signal degrading memory. Uncorrected errors are more serious because the GPU could not safely repair the corruption.",
    whyItMatters: "ECC is one of the clearest early-warning signals for GPU memory health. Beginners should learn the difference between a warning trend and a stop-now hardware failure.",
    coreTerms: [
      {
        term: "ECC",
        plain: "Error-correcting code, a protection mechanism that checks memory data and can often repair a single bad bit before software sees it.",
        why: "You will see ECC counters in NVIDIA tools, DCGM, and incident reports."
      },
      {
        term: "SBE",
        plain: "Single-bit error, a memory error the hardware was able to correct.",
        why: "A rising SBE trend often appears before a more serious hardware failure."
      },
      {
        term: "DBE",
        plain: "Double-bit error, a memory corruption event that the hardware cannot safely correct.",
        why: "A DBE usually means drain the node and treat the GPU as suspect hardware."
      },
      {
        term: "XID 48",
        plain: "An NVIDIA driver fault code commonly associated with an uncorrectable ECC event.",
        why: "Beginners need to connect log codes to the real hardware story behind them."
      },
      {
        term: "Page retirement",
        plain: "The GPU stops using a damaged memory page so that page cannot keep causing future errors.",
        why: "It explains why some cards limp along for a while after memory trouble begins."
      }
    ],
    lifecycle: [
      {
        title: "Healthy baseline",
        detail: "ECC counters are flat, temperatures are stable, and workloads run normally. This is the reference state you compare against later."
      },
      {
        title: "Corrected errors begin to rise",
        detail: "The GPU still fixes the memory mistakes, so jobs may keep running. The important beginner lesson is that corrected does not mean harmless forever."
      },
      {
        title: "Trend becomes persistent",
        detail: "Repeated SBEs suggest the card or memory region is weakening. Operators start watching rate-of-change, not just raw count."
      },
      {
        title: "Uncorrectable event appears",
        detail: "A DBE means the hardware could not repair the corruption. This is where the situation becomes an availability and data-integrity issue, not just a health warning."
      },
      {
        title: "Node is drained and hardware is evaluated",
        detail: "The immediate goal is protecting running jobs. After that, the operator decides whether the GPU is safe to return to service or should be replaced."
      }
    ],
    watchFor: [
      "Rising SBE count across repeated polls, not just one isolated number",
      "Any non-zero DBE count",
      "XID 48 or related memory-failure messages in logs",
      "Page-retirement events that suggest bad memory is being fenced off"
    ],
    safeActions: [
      "Record the GPU ID, timestamp, and ECC counter values before changing anything.",
      "If you only see corrected errors, keep monitoring the trend and notify the operator team.",
      "If you see an uncorrected error or XID 48, drain the node before putting more work on it."
    ],
    whatNotToDo: [
      "Do not treat repeated corrected errors as harmless just because jobs are still running.",
      "Do not keep scheduling new workloads onto a GPU with a known DBE."
    ],
    escalateWhen: [
      "Any DBE is present",
      "SBE counts keep climbing over multiple checks",
      "The same GPU repeatedly returns to service and relapses",
      "Users report crashes, corrupted jobs, or repeated driver faults"
    ],
    readMore: [
      "Corrected ECC errors are early warning signs. They matter because memory failure often shows up as a trend before it becomes a hard stop.",
      "Uncorrected ECC errors are operationally different. They are not just noisy counters; they are evidence that the GPU could not guarantee clean data."
    ]
  },
  nvlink_fault: {
    quickAnswer: "XID fault drills teach you how to translate a short NVIDIA fault code into a likely hardware story and an immediate response. The code itself is jargon, but the goal is simple: identify what failed and contain the blast radius.",
    whyItMatters: "Beginners often see the code first and the explanation second. This module teaches them to keep the code while attaching meaning to it.",
    coreTerms: [
      { term: "XID", plain: "An NVIDIA driver event code used to classify GPU faults.", why: "These codes are what operators usually see in logs first." },
      { term: "XID 48", plain: "A fault code often tied to an uncorrectable ECC event.", why: "This usually points to memory hardware trouble." },
      { term: "XID 79", plain: "A code associated with a GPU that has fallen off the bus or become unreachable.", why: "This often means reset or reboot level recovery." },
      { term: "XID 74", plain: "A fault often associated with NVLink problems such as link CRC errors.", why: "It connects log data to interconnect health." },
      { term: "Containment", plain: "The first phase of response where you stop the fault from hurting more jobs or more hardware paths.", why: "Beginners need to know the first goal is control, not perfect diagnosis." }
    ],
    lifecycle: [
      { title: "Alert appears", detail: "A log entry or monitoring alert reports an XID code." },
      { title: "Meaning is decoded", detail: "The code is mapped to a likely fault family such as memory, bus, or NVLink." },
      { title: "Containment comes first", detail: "The beginner-safe response is to protect jobs and isolate the affected hardware path." },
      { title: "Recovery is attempted or hardware is removed", detail: "Some faults allow reset; others are strong signs of failing hardware." },
      { title: "Pattern is reviewed", detail: "Operators ask whether this was isolated, repeated, or spreading across a fabric or node family." }
    ],
    watchFor: [
      "Repeated appearance of the same XID on the same GPU",
      "Faults that line up with ECC counters, NVLink errors, or missing GPUs",
      "A fault moving from one-off alert to repeated operational disruption"
    ],
    safeActions: [
      "Capture the exact XID code and the GPU or PCI address involved.",
      "Drain or isolate the affected node before trying risky recovery steps.",
      "Use the code to choose the right next check instead of guessing."
    ],
    whatNotToDo: [
      "Do not memorize only the number without learning the fault family behind it.",
      "Do not jump straight to rebooting a shared production node without capturing evidence first.",
      "Do not assume every XID has the same severity or recovery path."
    ],
    escalateWhen: [
      "The fault repeats after recovery",
      "The GPU disappears from the bus",
      "The fault affects shared fabric like NVLink",
      "The same code begins appearing across multiple nodes"
    ],
    readMore: [
      "The educational goal is not memorizing every XID, but learning the workflow: identify, classify, contain, and escalate.",
      "A good beginner habit is to ask: what evidence would make this a memory problem, a link problem, or a full GPU availability problem?"
    ]
  },
  nvlink: {
    quickAnswer: "NVLink is a high-speed GPU-to-GPU interconnect. In this lab, you are learning how to tell the difference between a healthy direct GPU fabric and a slower fallback path through PCIe.",
    whyItMatters: "Distributed training performance depends heavily on the path used for GPU communication.",
    coreTerms: [
      { term: "NVLink", plain: "A direct high-bandwidth connection between GPUs.", why: "It is much faster than routing traffic through the CPU and PCIe path." },
      { term: "Topology", plain: "A map of which GPUs are directly connected and how data moves between them.", why: "Poor topology understanding leads to poor fault diagnosis." },
      { term: "PHB", plain: "PCIe Host Bridge path instead of a direct NVLink path.", why: "Seeing PHB where you expect NVLink often means degraded communication." },
      { term: "CRC error", plain: "A transmission-integrity error showing that data on the link may be arriving corrupted and needing retry or correction.", why: "This is one of the clearest signs of a sick interconnect path." }
    ],
    lifecycle: [
      { title: "Inspect topology", detail: "Read the GPU connectivity map before assuming the fabric is healthy." },
      { title: "Check NVLink error counters", detail: "Link errors reveal whether the path is clean or degraded." },
      { title: "Measure workload impact", detail: "AllReduce throughput makes the hardware story visible in performance terms." },
      { title: "Correlate path and performance", detail: "The key beginner lesson is that bad topology and bad throughput often explain each other." }
    ],
    watchFor: [
      "PHB or other fallback paths where you expected direct NVLink",
      "Rising CRC or link-error counts",
      "Strong throughput collapse during collective communication"
    ],
    safeActions: [
      "Compare current topology with the expected rack design.",
      "Use error counters before assuming a software issue.",
      "Document which GPU pairs are degraded so operators can inspect the right physical path."
    ],
    whatNotToDo: [
      "Do not call a topology healthy just because the GPUs are visible to the driver.",
      "Do not blame NCCL first if the hardware path itself is degraded."
    ],
    escalateWhen: [
      "Link errors continue increasing under repeated checks",
      "Collective throughput remains far below the expected rack baseline",
      "Multiple GPU pairs show the same degraded path signature"
    ],
    readMore: [
      "A useful beginner mental model is that NVLink is not just extra speed. It is often the difference between a healthy distributed training design and a badly degraded one.",
      "When NVLink disappears, workloads may still run. That is why path verification matters as much as uptime."
    ]
  },
  mig: {
    quickAnswer: "MIG lets one physical GPU act like several isolated slices. Beginners should think of it as hardware partitioning, not just software scheduling.",
    whyItMatters: "It changes how capacity, isolation, and fault domains are explained to users.",
    coreTerms: [
      { term: "MIG", plain: "Multi-Instance GPU, a feature that partitions a GPU into smaller isolated instances.", why: "It is a common way to share expensive accelerators safely." },
      { term: "Instance", plain: "One isolated slice of GPU compute and memory resources.", why: "Each slice can be assigned to a different workload or tenant." },
      { term: "Fault domain", plain: "The part of the system affected when something fails.", why: "Isolation is easier to understand when beginners know what a fault domain means." }
    ],
    safeActions: [
      "Explain the partition plan before creating instances.",
      "Verify the resulting layout after creation.",
      "Make sure users know a slice is not the same as a full GPU."
    ]
  },
  cuda_stack: {
    quickAnswer: "The CUDA stack is a compatibility chain: driver, CUDA runtime, libraries, framework, and application. Version mismatch at any layer can break the whole workload.",
    whyItMatters: "Beginners often blame the GPU first when the real problem is stack compatibility.",
    coreTerms: [
      { term: "Driver", plain: "The software that lets the operating system talk to the GPU.", why: "Without it, GPU tools and workloads cannot function correctly." },
      { term: "CUDA runtime", plain: "The software layer applications use to run work on NVIDIA GPUs.", why: "It must be compatible with the GPU architecture and driver." },
      { term: "NGC", plain: "NVIDIA GPU Cloud container images with validated software stacks.", why: "These images reduce mismatch risk for beginners." },
      { term: "Compatibility matrix", plain: "A vendor-supported mapping of which driver, CUDA, library, and framework versions work together.", why: "This is how experts reduce guesswork during stack incidents." }
    ],
    lifecycle: [
      { title: "Check the base layers", detail: "Start with the driver and CUDA runtime before blaming frameworks or code." },
      { title: "Verify the framework", detail: "Make sure PyTorch or another framework actually supports the target GPU architecture." },
      { title: "Use a validated image when in doubt", detail: "A known-good container is often the fastest way to separate environment problems from application bugs." },
      { title: "Change one layer at a time", detail: "Beginners get into trouble when they change drivers, frameworks, and images all at once and lose the ability to tell what fixed the problem." }
    ],
    watchFor: [
      "Driver present but frameworks still fail to see the target GPU architecture",
      "Errors that mention unsupported kernels, missing images, or bad architecture targets",
      "Different nodes behaving differently with the same training code"
    ],
    safeActions: [
      "Record exact versions instead of saying something is just old or new.",
      "Prefer validated container images for first recovery attempts.",
      "Avoid changing multiple stack layers at once."
    ],
    whatNotToDo: [
      "Do not downgrade or upgrade the driver blindly without checking compatibility first.",
      "Do not assume a newer version is automatically better for every layer in the stack."
    ],
    escalateWhen: [
      "The same workload fails across multiple supposedly identical nodes",
      "You cannot identify a supported version combination from vendor guidance",
      "A stack fix would affect many users or many production jobs"
    ],
    readMore: [
      "A stack problem often looks like a GPU problem because the crash happens near CUDA or PyTorch. The real issue is usually the contract between layers, not the silicon itself.",
      "Validated images matter because they collapse a large compatibility search space into one tested baseline."
    ]
  },
  container: {
    quickAnswer: "Container flow labs teach how to use prebuilt GPU images without rebuilding the software stack from scratch. The lesson is consistency: the same image should behave the same way across nodes.",
    coreTerms: [
      { term: "Container image", plain: "A packaged application environment with code, libraries, and dependencies.", why: "It reduces drift between systems." },
      { term: "NGC", plain: "NVIDIA's registry of GPU-focused container images.", why: "It gives beginners a supported starting point." },
      { term: "Runtime", plain: "The environment used when the container actually runs with GPU access.", why: "A good image still fails if the runtime is not configured for GPUs." }
    ],
    safeActions: [
      "Pull a known-good image first.",
      "Verify GPU visibility inside the container before starting a long job.",
      "Keep the image tag with your incident notes so others can reproduce the environment."
    ]
  },
  training: {
    quickAnswer: "Distributed training spreads work across multiple GPUs and then synchronizes gradients. Beginners need to understand that the training loop includes both computation and communication.",
    whyItMatters: "Many cluster incidents look like model or code problems when they are actually synchronization, storage, or network timing problems.",
    coreTerms: [
      { term: "DDP", plain: "Distributed Data Parallel, a way to run the same training process across many GPUs and combine their gradients.", why: "It is a common default for multi-GPU training." },
      { term: "Gradient", plain: "The update signal that tells the model how to change its weights.", why: "Synchronization exists because each GPU computes only part of the batch." },
      { term: "AllReduce", plain: "A collective operation that combines and redistributes gradient data across ranks.", why: "It is often the communication bottleneck." },
      { term: "Rank", plain: "One participating process in a distributed training job.", why: "A single unhealthy rank can stall the entire job." }
    ],
    lifecycle: [
      { title: "Launch the ranks", detail: "A distributed job starts multiple workers that need to agree on the same world view." },
      { title: "Compute local gradients", detail: "Each GPU processes its own batch shard and computes an update signal." },
      { title: "Synchronize across the group", detail: "Collective communication shares and combines those updates so all ranks stay aligned." },
      { title: "Update together or stall together", detail: "If storage, fabric, or one rank misbehaves, the whole training job can slow or hang." }
    ],
    watchFor: [
      "High compute utilization followed by long synchronization delays",
      "One rank lagging far behind the others",
      "Storage or network symptoms appearing at the same time as training slowdown"
    ],
    safeActions: [
      "Separate compute issues from sync issues.",
      "Watch utilization during forward, backward, and synchronization phases.",
      "Treat storage stalls as part of training performance, not a separate unrelated problem."
    ],
    whatNotToDo: [
      "Do not assume every slow training job is a model-code problem.",
      "Do not look only at one GPU when the whole workflow is distributed."
    ],
    escalateWhen: [
      "Ranks disagree, hang, or repeatedly time out during initialization or synchronization",
      "One node keeps becoming the slow member of the job",
      "The same distributed symptom appears across multiple training runs"
    ],
    readMore: [
      "A beginner-friendly way to think about distributed training is this: the GPUs can only move as fast as the slowest critical stage in the loop, whether that stage is compute, communication, or data feeding.",
      "That is why cluster operators care about storage, network, and GPU health at the same time."
    ]
  },
  allreduce: {
    quickAnswer: "AllReduce is how distributed training makes every GPU agree on the same gradient update. When it breaks or slows down, training still looks alive but performance collapses.",
    whyItMatters: "Beginners often focus on whether the job started. AllReduce teaches them to care about whether the distributed system is synchronizing efficiently.",
    coreTerms: [
      { term: "Ring algorithm", plain: "A pattern where each rank passes data to neighbors in stages until the reduction is complete.", why: "It helps beginners picture why one weak link hurts the whole group." },
      { term: "Collective", plain: "An operation involving many ranks at once, not just one sender and one receiver.", why: "Many GPU communication failures are collective failures." },
      { term: "NCCL", plain: "NVIDIA's library for multi-GPU communication collectives.", why: "It is the common tool behind AllReduce performance and failures." },
      { term: "Bandwidth baseline", plain: "The expected healthy throughput range for a given rack design and transport path.", why: "Without a baseline, beginners cannot tell whether a job is slow or normal." }
    ],
    lifecycle: [
      { title: "Choose the communication path", detail: "NCCL selects the path it believes is best for the cluster topology and transport configuration." },
      { title: "Reduce the partial results", detail: "Each rank contributes data into the collective so the group can compute one shared update." },
      { title: "Distribute the final result", detail: "The synchronized value is sent back out so every rank can keep training from the same state." },
      { title: "Performance exposes weak links", detail: "If one path, rank, or transport is unhealthy, the collective still runs but its throughput drops sharply." }
    ],
    watchFor: [
      "Large gap between expected and observed collective throughput",
      "One communication phase dominating the training timeline",
      "Topology or transport changes lining up with bandwidth collapse"
    ],
    safeActions: [
      "Use throughput numbers to confirm whether the collective path is healthy.",
      "Check whether NCCL is using the intended transport path.",
      "Do not assume a code bug until the communication path is verified."
    ],
    whatNotToDo: [
      "Do not judge AllReduce health by uptime alone; the collective can be alive and still badly degraded.",
      "Do not compare bandwidth numbers without knowing the expected rack baseline."
    ],
    escalateWhen: [
      "Collective throughput stays far below the healthy design target",
      "The same collective slowdown appears across repeated runs or multiple jobs",
      "The transport path flips unexpectedly after a cluster or environment change"
    ],
    readMore: [
      "AllReduce is one of the best places to teach that distributed systems can fail softly. The operation still completes, but the job loses most of its efficiency.",
      "That is why operator vocabulary includes not just faults and outages, but path selection and throughput verification."
    ]
  },
  ib_fabric: {
    quickAnswer: "InfiniBand fabric health determines whether multi-node GPU jobs can move data fast enough. The beginner lesson is that link state and error counters matter as much as raw bandwidth numbers.",
    whyItMatters: "InfiniBand problems often look like training or NCCL problems until someone checks the fabric itself.",
    coreTerms: [
      { term: "InfiniBand", plain: "A high-performance network technology used for low-latency cluster communication.", why: "Many GPU clusters depend on it for distributed training." },
      { term: "Port state", plain: "Whether a network port is active, down, or otherwise unhealthy.", why: "A single bad port can collapse an entire path." },
      { term: "perfquery", plain: "A tool that reads InfiniBand performance counters and error counters.", why: "It turns a vague network suspicion into evidence." },
      { term: "Fabric sweep", plain: "A broader inspection of multiple links and devices across the interconnect.", why: "This helps distinguish one bad node from a wider network problem." }
    ],
    lifecycle: [
      { title: "Verify the link comes up", detail: "Before testing performance, confirm the expected ports are active and visible." },
      { title: "Read the counters", detail: "Error counters reveal whether the path is merely present or actually clean enough for production traffic." },
      { title: "Measure the workload impact", detail: "Bandwidth and job behavior tell you whether the network problem is theoretical or already hurting training." },
      { title: "Expand from local to fabric-wide", detail: "If one path looks bad, the next step is deciding whether the issue is isolated or systemic." }
    ],
    watchFor: [
      "Ports that are down or unstable when the cluster expects them to be active",
      "Error counters increasing under traffic",
      "Collective or RDMA performance collapsing even though nodes are otherwise healthy"
    ],
    safeActions: [
      "Check link state before tuning anything.",
      "Use counters to see whether the fabric is clean or noisy.",
      "Document the exact host and port that is unhealthy."
    ],
    whatNotToDo: [
      "Do not assume a port is healthy just because the node itself is reachable.",
      "Do not jump into application tuning before verifying the underlying fabric path."
    ],
    escalateWhen: [
      "Multiple ports or nodes show the same unhealthy pattern",
      "The fabric issue affects production job throughput",
      "Counter growth suggests a recurring physical or switch-side problem"
    ],
    readMore: [
      "A fabric problem often feels mysterious because jobs still start and nodes still ping. Counters and link state are how operators turn that mystery into a concrete network story.",
      "For beginners, the important mental shift is to treat the interconnect as a first-class part of the AI system, not just background plumbing."
    ]
  },
  roce: {
    quickAnswer: "RoCEv2 runs RDMA over Ethernet, so correct lossless-network configuration matters. Beginners should learn that the network can look up while still behaving badly for GPU traffic.",
    whyItMatters: "RoCE incidents are a strong lesson in how congestion control, not just link speed, determines whether distributed training is healthy.",
    coreTerms: [
      { term: "RoCEv2", plain: "RDMA over Converged Ethernet version 2, a way to get low-latency remote memory access over Ethernet.", why: "It is common in Ethernet-based AI clusters." },
      { term: "PFC", plain: "Priority Flow Control, a pause mechanism meant to prevent packet loss for important traffic classes.", why: "Misconfiguration can create serious congestion behavior." },
      { term: "ECN", plain: "Explicit Congestion Notification, a way for the network to signal congestion before packet loss occurs.", why: "It helps keep performance stable without overusing pause frames." },
      { term: "PFC storm", plain: "A feedback loop of pause traffic that spreads congestion instead of containing it.", why: "This is one of the most important bad outcomes beginners should recognize." }
    ],
    lifecycle: [
      { title: "Set the lossless assumptions", detail: "MTU, PFC, and ECN must align across the path before the cluster behaves as intended." },
      { title: "Carry RDMA traffic under load", detail: "The network only proves itself when real traffic and congestion arrive." },
      { title: "Watch congestion signals", detail: "Pause frames and ECN behavior tell you whether the fabric is controlling congestion or amplifying it." },
      { title: "Tune or isolate the problem", detail: "The operator decides whether the issue is a host setting, a switch policy, or a topology-level problem." }
    ],
    watchFor: [
      "Pause counters rising quickly under training load",
      "RDMA jobs slowing down while ordinary connectivity still looks fine",
      "Symptoms that appear only during congestion or multi-node traffic"
    ],
    safeActions: [
      "Check MTU, PFC, and ECN together rather than in isolation.",
      "Treat a rising pause-frame count as a clue, not a final diagnosis.",
      "Document switch-side counters when network problems affect training."
    ],
    whatNotToDo: [
      "Do not assume Ethernet link-up means the RoCE path is healthy for RDMA.",
      "Do not change only one congestion-control knob without understanding the rest of the path."
    ],
    escalateWhen: [
      "Pause storms or congestion patterns affect multiple jobs or racks",
      "Switch-side counters confirm the issue is beyond one host",
      "Fabric tuning changes could affect many tenants or production users"
    ],
    readMore: [
      "RoCE teaches beginners that performance depends on policy and congestion control, not just cable speed.",
      "A fabric can be technically up and still operationally wrong for GPU traffic."
    ]
  },
  nccl_fallback: {
    quickAnswer: "NCCL fallback means the communication library is using a slower path than expected, often TCP instead of InfiniBand or another high-speed transport. The job runs, but performance drops sharply.",
    whyItMatters: "This is one of the best beginner examples of a problem that is not a crash, but still a serious operational issue.",
    coreTerms: [
      { term: "Fallback", plain: "A backup path used when the preferred fast path is unavailable or misconfigured.", why: "Fallback keeps jobs alive but can hide the real problem if nobody checks throughput." },
      { term: "TCP", plain: "A general-purpose network transport that is usually much slower for distributed GPU training than RDMA-based paths.", why: "Seeing TCP where you expected InfiniBand is a major clue." },
      { term: "NCCL_IB_DISABLE", plain: "An environment variable that can force NCCL not to use InfiniBand.", why: "It is a common misconfiguration with a large performance impact." },
      { term: "NCCL_IB_HCA", plain: "An environment variable that tells NCCL which host-channel adapter to use for InfiniBand traffic.", why: "A wrong HCA name can quietly force the job onto a slower path." }
    ],
    lifecycle: [
      { title: "Expected fast path exists", detail: "The cluster appears to have the right hardware and topology for fast collective communication." },
      { title: "NCCL chooses a slower path", detail: "A configuration issue, missing device, or path failure causes a fallback to TCP or another less capable transport." },
      { title: "Job still runs but throughput collapses", detail: "This is why beginners must learn to diagnose slow success, not just obvious failure." },
      { title: "Environment and hardware are compared", detail: "The operator checks whether the fallback came from a bad environment variable, missing interface, or real fabric problem." }
    ],
    watchFor: [
      "NCCL logs that mention Socket or TCP instead of the expected RDMA path",
      "Large bandwidth drop without a full job crash",
      "Environment variables that override transport selection"
    ],
    safeActions: [
      "Check environment variables before changing hardware or drivers.",
      "Confirm the network path NCCL actually selected.",
      "Compare observed bandwidth with the cluster's expected healthy range."
    ],
    whatNotToDo: [
      "Do not celebrate that the job is still running if throughput is catastrophically below baseline.",
      "Do not start with a full cluster reboot when a single environment variable may explain the fallback."
    ],
    escalateWhen: [
      "The job keeps falling back even after environment cleanup",
      "InfiniBand ports look healthy but NCCL still refuses the expected path",
      "Fallback affects many jobs or many nodes at once"
    ],
    readMore: [
      "NCCL fallback is a perfect beginner lesson in why operators care about performance regressions, not only outages. Slow success can still be a major production failure.",
      "The best debugging order is usually environment, path selection, fabric health, then deeper software changes."
    ]
  },
  storage: {
    quickAnswer: "A storage bottleneck means GPUs spend time waiting for data instead of computing. Beginners often misread this as a GPU issue because the slow symptom shows up in GPU utilization.",
    whyItMatters: "Storage is where beginners learn that the GPU can be innocent while still looking underutilized.",
    coreTerms: [
      { term: "Sawtooth utilization", plain: "A repeated pattern where GPU utilization spikes and then falls because data arrives in bursts.", why: "It is a classic sign of an input pipeline problem." },
      { term: "Stripe count", plain: "How many storage targets a file or directory spreads data across.", why: "Low stripe count can limit read bandwidth." },
      { term: "DataLoader", plain: "The part of a training pipeline that feeds data batches to the GPU workload.", why: "Storage issues often appear through the DataLoader first." },
      { term: "I/O bottleneck", plain: "A point where storage throughput or latency limits the whole workload.", why: "This is the key operational story behind a storage-bound training job." }
    ],
    lifecycle: [
      { title: "GPU finishes its batch", detail: "The accelerator is ready for more work and waits for the input pipeline." },
      { title: "Storage cannot keep up", detail: "The dataset path, stripe layout, or loader settings deliver data too slowly." },
      { title: "Utilization turns into a sawtooth", detail: "The GPU alternates between busy bursts and idle waiting, which creates the visible pattern beginners often notice first." },
      { title: "Pipeline tuning restores flow", detail: "Storage layout and input-pipeline changes are used to feed the GPU continuously again." }
    ],
    watchFor: [
      "GPU utilization oscillating instead of staying consistently high",
      "High storage utilization or poor dataset striping at the same time as slow training",
      "More waiting in the data path than in the model compute path"
    ],
    safeActions: [
      "Look at storage counters at the same time as GPU utilization.",
      "Treat low GPU utilization as a symptom, not always the root cause.",
      "Change one bottleneck-control knob at a time, such as stripe count or worker count."
    ],
    whatNotToDo: [
      "Do not assume low GPU utilization means the GPU itself is failing.",
      "Do not tune many loader and storage settings at once if you want to know what actually helped."
    ],
    escalateWhen: [
      "Multiple jobs show the same storage-starvation pattern",
      "Storage counters indicate the shared data path itself is saturated",
      "Fixes at the application layer are not enough to restore expected throughput"
    ],
    readMore: [
      "Storage bottlenecks are a good beginner lesson because they break the habit of blaming the most visible component. The visible component is the GPU, but the limiting component is elsewhere.",
      "A good operator asks which stage is starving which other stage."
    ]
  },
  gds: {
    quickAnswer: "GPUDirect Storage shortens the data path by reducing CPU involvement in moving data from storage to GPU memory. Beginners should think of it as removing extra copies and extra stops.",
    whyItMatters: "GDS is a clean teaching example of how architecture choices, not just device speed, affect end-to-end throughput.",
    coreTerms: [
      { term: "GPUDirect Storage", plain: "A technology that allows data to move more directly between storage and GPU memory.", why: "It can reduce CPU overhead and improve throughput." },
      { term: "DMA", plain: "Direct Memory Access, a hardware-assisted way to move data without constant CPU handling.", why: "It is the mechanism that makes direct paths efficient." },
      { term: "cufile", plain: "The software interface commonly used for GPUDirect Storage operations.", why: "It is a practical sign that the feature is available in the environment." },
      { term: "Data path", plain: "The route data takes from storage to the GPU.", why: "GDS only makes sense if beginners can picture the path it is shortening." }
    ],
    lifecycle: [
      { title: "Start with the traditional path", detail: "Data moves through more software and CPU-managed steps before reaching the GPU." },
      { title: "Enable the direct path", detail: "The system uses GPUDirect Storage to reduce unnecessary handling and copies." },
      { title: "Verify the feature is real", detail: "The operator confirms the environment actually supports the needed interfaces before trusting any benchmark." },
      { title: "Compare end-to-end results", detail: "The value of GDS is proven by the throughput and CPU-overhead change, not by the acronym alone." }
    ],
    watchFor: [
      "Whether the environment actually exposes the interfaces needed for GDS",
      "Reduced CPU involvement alongside improved storage-to-GPU throughput",
      "Benchmarks that improve only after the direct path is confirmed"
    ],
    safeActions: [
      "Verify the feature exists before benchmarking it.",
      "Compare the old path and new path with the same workload.",
      "Treat GDS as an optimization, not a default assumption."
    ],
    whatNotToDo: [
      "Do not assume GDS is active just because the cluster uses NVIDIA GPUs.",
      "Do not compare different workloads and call it a valid before-and-after benchmark."
    ],
    escalateWhen: [
      "The direct path is expected by design but missing in production",
      "Benchmark gains do not appear even after the feature is supposedly enabled",
      "Changes to enable GDS would affect shared storage or driver policy"
    ],
    readMore: [
      "GDS is useful educationally because it teaches that throughput is often about path design, not just device specs.",
      "A shorter path is only valuable if it is real, measurable, and stable under workload."
    ]
  },
  monitoring: {
    quickAnswer: "Monitoring turns one-off troubleshooting into continuous visibility. The beginner lesson is that metrics are not just numbers; they are early warnings and confirmation signals.",
    whyItMatters: "A strong monitoring layer is where beginners stop reacting to surprises and start noticing patterns before users report them.",
    coreTerms: [
      { term: "DCGM", plain: "Data Center GPU Manager, NVIDIA's management and monitoring toolkit for GPUs.", why: "Many GPU health dashboards and exporters are built on it." },
      { term: "Exporter", plain: "A service that exposes metrics in a format another system can scrape.", why: "It is how GPU signals reach Prometheus." },
      { term: "Prometheus", plain: "A monitoring system that collects and queries time-series metrics.", why: "It is often the first place operators see cluster health trends." },
      { term: "Alert rule", plain: "A condition that turns a metric pattern into a notification or page.", why: "This is where visibility becomes operational action." }
    ],
    lifecycle: [
      { title: "Expose the metrics", detail: "An exporter publishes GPU health and performance signals in a scrapeable format." },
      { title: "Scrape and store", detail: "Prometheus collects those signals over time so you can spot patterns, not just snapshots." },
      { title: "Visualize the behavior", detail: "Dashboards help beginners connect numbers with operational stories like heat, ECC growth, or degraded throughput." },
      { title: "Alert on the right patterns", detail: "Good alerts focus on meaningful changes such as rising ECC trends or degraded telemetry coverage, not only hard crashes." }
    ],
    watchFor: [
      "Signals that trend upward over time, such as ECC or thermal stress",
      "Gaps in expected metrics that indicate telemetry itself is degraded",
      "Alerts that fire too often or not at all"
    ],
    safeActions: [
      "Know which signals are health indicators and which are just workload indicators.",
      "Create alerts for trend-based failures, not only binary outages.",
      "Use dashboards to compare before and after, not just to stare at a single value."
    ],
    whatNotToDo: [
      "Do not alert on every noisy metric without deciding what action the alert should trigger.",
      "Do not assume missing metrics mean everything is healthy; they may mean telemetry is broken."
    ],
    escalateWhen: [
      "Critical health metrics disappear unexpectedly",
      "Alert rules are noisy enough to hide the real incidents",
      "Teams are repeatedly learning about failures from users instead of dashboards"
    ],
    readMore: [
      "Monitoring is not just about visibility. It is about building trust in the system's story over time.",
      "For beginners, the most useful dashboards are the ones that connect a metric to a likely next action."
    ]
  },
  slurm: {
    quickAnswer: "Slurm decides who gets cluster resources and when. Beginners should understand that not every delayed job is broken; sometimes it is waiting because of policy or resource pressure.",
    whyItMatters: "Slurm is where beginners learn the difference between a healthy busy cluster and a broken cluster.",
    coreTerms: [
      { term: "Scheduler", plain: "The system that decides when jobs start and where they run.", why: "It explains why a healthy cluster can still make you wait." },
      { term: "Fairshare", plain: "A policy signal showing how a user's recent resource usage affects new job priority.", why: "It helps explain queue behavior without blaming hardware." },
      { term: "Drain", plain: "A scheduler state that stops new jobs from landing on a node.", why: "It is a safe containment tool during incidents." },
      { term: "Pending reason", plain: "The scheduler's explanation for why a job is waiting instead of running.", why: "This is often the first clue that the delay is policy, not failure." }
    ],
    lifecycle: [
      { title: "Submit the job", detail: "The scheduler records the request and decides how it fits into cluster policy and available resources." },
      { title: "Wait or start", detail: "A job may run immediately or remain pending based on priority, availability, and scheduling rules." },
      { title: "Protect unhealthy nodes", detail: "During incidents, operators drain nodes so the scheduler stops sending fresh work there." },
      { title: "Return the node to service", detail: "Once the issue is resolved, the scheduler state is restored so jobs can land there again." }
    ],
    watchFor: [
      "Pending reasons that point to policy, not hardware",
      "Nodes that remain drained longer than expected",
      "Fairshare or priority signals changing queue behavior"
    ],
    safeActions: [
      "Check why a job is pending before changing cluster state.",
      "Use drain as a protective step during hardware incidents.",
      "Record policy-driven delays differently from hardware failures."
    ],
    whatNotToDo: [
      "Do not call the scheduler broken just because your job is waiting.",
      "Do not resume a drained node until the hardware or software incident is actually understood."
    ],
    escalateWhen: [
      "The scheduler reason does not match observed cluster behavior",
      "Nodes remain drained without a clear owner or remediation path",
      "Policy behavior is causing repeated user confusion or production pain"
    ],
    readMore: [
      "A good beginner habit is to separate scheduling policy from system failure. They can feel similar to a user but require very different responses.",
      "Drain is one of the most important operational verbs in cluster management because it turns diagnosis into safe containment."
    ]
  },
  k8s: {
    quickAnswer: "Kubernetes GPU operations combine container orchestration with accelerator scheduling. The beginner lesson is that a pod being pending does not automatically mean the GPU is broken.",
    whyItMatters: "Kubernetes adds another control plane between the user and the hardware, so beginners need help separating scheduling, operator, and node-level issues.",
    coreTerms: [
      { term: "GPU Operator", plain: "A Kubernetes-managed package that helps install and manage NVIDIA GPU software components on cluster nodes.", why: "It automates many cluster-side GPU dependencies." },
      { term: "Extended resource", plain: "A schedulable resource type like nvidia.com/gpu that Kubernetes tracks in integer quantities.", why: "It explains why GPU requests and availability behave differently from CPU and memory." },
      { term: "Gang scheduling", plain: "A scheduling approach that waits until all pods in a distributed job can start together.", why: "It prevents partially started training jobs from hanging." },
      { term: "Pending", plain: "A pod state meaning the workload has been accepted but not yet placed and started successfully.", why: "This is where beginners often misread orchestration delay as hardware failure." }
    ],
    lifecycle: [
      { title: "Advertise GPU resources", detail: "Nodes and operators expose the GPU resources Kubernetes can schedule." },
      { title: "Schedule the workload", detail: "Kubernetes decides where the pod can land based on requested resources and policy." },
      { title: "Start the GPU environment", detail: "The container, runtime, and node-level GPU stack all have to line up for the pod to work." },
      { title: "Coordinate distributed jobs", detail: "For tightly coupled training, scheduling all pods together may matter as much as launching one pod successfully." }
    ],
    watchFor: [
      "Pods stuck in Pending because resources are exhausted or not advertised",
      "Operator health problems that prevent GPUs from being exposed correctly",
      "Distributed jobs partially starting when they really need gang scheduling"
    ],
    safeActions: [
      "Read the scheduling reason before changing nodes or workloads.",
      "Check both operator health and node resource advertisement.",
      "Use gang scheduling for tightly coupled distributed jobs."
    ],
    whatNotToDo: [
      "Do not assume a Pending pod means the physical GPU is broken.",
      "Do not troubleshoot only the pod manifest if the operator or node advertisement is unhealthy."
    ],
    escalateWhen: [
      "GPU resources disappear from multiple nodes unexpectedly",
      "The operator stack itself is unhealthy or crash-looping",
      "Scheduling behavior is blocking distributed jobs cluster-wide"
    ],
    readMore: [
      "Kubernetes incidents are often about translation: the user asks for GPUs, the control plane decides placement, and the node stack has to make that request real.",
      "A beginner gets much stronger when they can ask: is this problem in the request, the scheduler, the operator, or the node?"
    ]
  }

};
