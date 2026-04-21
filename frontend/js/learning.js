/**
 * BEGINNER LEARNING MODULE
 * Curated explanations that keep operator jargon visible while adding plain-language guidance.
 */

window.AEGIS_LEARNING = {
  ecc: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are watching how GPU memory errors move from healthy baseline, to warning signs, to a hard containment decision. Think of this like noticing hairline cracks in a pressure pipe before it finally bursts under load.",
    plainPicture: "ECC is the GPU's memory protection system. A few corrected errors mean the hardware caught bad data and repaired it, but a repeated trend can mean the memory is getting weaker. An uncorrected error means the GPU could not safely fix the corruption anymore.",
    whyOperatorsCare: [
      "Operators care about ECC because it is one of the clearest early-warning systems for GPU memory health. It tells you whether the card is still correcting problems quietly or has crossed into unsafe hardware behavior.",
      "This matters because the node may still look available while the memory story is getting worse. Beginners need to learn that 'still running' does not mean 'still safe.'",
      "The operator skill here is to separate three states clearly: healthy baseline, warning trend, and stop-now containment event."
    ],
    wholePlatform: [
      "In the bigger platform, ECC is one of the signals that tells you whether a GPU node is still trustworthy enough to keep in the scheduling pool.",
      "Schedulers, workload owners, and the rest of the rack depend on operators making the right call here. If a bad card stays in service too long, jobs can crash, data can be corrupted, and the incident can spread into user-visible disruption.",
      "So ECC is not just about one chip having bad memory. It directly affects whether the node stays available to the cluster and whether the rack is still delivering reliable GPU capacity."
    ],
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
    commonMisreads: [
      "Corrected means harmless. That is false. Corrected means the card saved you this time, not that the memory is healthy forever.",
      "One poll is enough to understand the situation. That is false. ECC work is often about trend, not one isolated number.",
      "If jobs are still running, the GPU must still be safe. That is false once uncorrectable events appear."
    ],
    safeActions: [
      "Record the GPU ID, timestamp, and ECC counter values before changing anything.",
      "If you only see corrected errors, keep monitoring the trend and notify the operator team.",
      "If you see an uncorrected error or XID 48, treat the node as unsafe for fresh workloads and contain it."
    ]
  },
  nvlink_fault: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how to read NVIDIA XID fault codes as operator signals instead of mysterious numbers. Think of this like learning emergency alarm tones: the code is short, but it tells you what kind of failure you may be dealing with and how fast you need to react.",
    plainPicture: "An XID code is the GPU driver's shorthand for a fault family. The number itself is not the goal. The goal is to translate it into a likely hardware story, judge the severity, and take the least risky correct next action.",
    whyOperatorsCare: [
      "Operators often see the code before they see the explanation. Logs, alerts, and support tickets may only show an XID number, so the operator has to turn that number into a containment decision quickly.",
      "This matters because different XIDs imply different fault families. A memory-integrity problem, a hung GPU, and a fabric fault do not all deserve the same response.",
      "The beginner skill here is not memorizing every number. It is learning the workflow: identify the code, classify the fault family, confirm with evidence, contain the blast radius, and escalate appropriately."
    ],
    wholePlatform: [
      "In the bigger platform, XID faults are one of the ways a single failing GPU turns into a node, rack, or workload problem. The code helps operators decide whether the issue stays local or threatens the wider cluster.",
      "A good XID response protects schedulers, users, and neighboring workloads from landing on hardware that is already unstable or from depending on a broken fabric path.",
      "So this is not just about reading logs. It is about keeping the whole platform reliable by turning short fault codes into fast, grounded operational decisions."
    ],
    coreTerms: [
      { term: "XID", plain: "An NVIDIA driver event code used to classify GPU faults.", why: "These codes are what operators usually see in logs first." },
      { term: "XID 48", plain: "A fault code often tied to an uncorrectable ECC event.", why: "This usually points to memory hardware trouble." },
      { term: "XID 79", plain: "A code associated with a GPU that has fallen off the bus or become unreachable.", why: "This often means reset or reboot level recovery." },
      { term: "XID 74", plain: "A fault often associated with NVLink problems such as link CRC errors.", why: "It connects log data to interconnect health." },
      { term: "Containment", plain: "The first phase of response where you stop the fault from hurting more jobs or more hardware paths.", why: "Beginners need to know the first goal is control, not perfect diagnosis." }
    ],
    commonMisreads: [
      "The number itself is the diagnosis. That is false. The number is the starting point for a hardware story, not the whole story.",
      "All XIDs deserve the same response. That is false. Memory faults, bus faults, and fabric faults often have different confirmation and recovery paths.",
      "If the job is still partly alive, the fault must be minor. That is false. Some severe faults still leave part of the system standing while the hardware underneath is no longer trustworthy."
    ],
    safeActions: [
      "Capture the exact XID code and the GPU or PCI address involved.",
      "Drain or isolate the affected node before trying risky recovery steps.",
      "Use the code to choose the right next check instead of guessing."
    ]
  },
  nvlink: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether 8 H100 GPUs are talking to each other over the fast NVLink fabric they were designed to use. Think of this like checking whether traffic is flowing on the dedicated express lanes instead of being forced onto a slower city street.",
    plainPicture: "NVLink is the fast direct path between GPUs. If that path disappears, the workload may still run, but communication can fall back to a much slower route through PCIe and the CPU host bridge.",
    whyOperatorsCare: [
      "Operators care about NVLink because distributed training is not just about whether GPUs are visible. It is about whether they can exchange data over the path the cluster was designed for.",
      "A node can look alive and still be operationally degraded. That is what makes topology reading important for beginners: uptime is not the same as healthy interconnect performance.",
      "This lab teaches a core operator habit: first learn the expected fabric layout, then check whether the links are clean, then confirm whether the workload sees the same story."
    ],
    wholePlatform: [
      "In the bigger platform, NVLink is part of the communication spine inside the server. If it is healthy, multi-GPU jobs get the fast collective path they were sized and scheduled for.",
      "If it degrades, the whole node can still appear online, but distributed workloads may slow down sharply, waste expensive GPU time, or fall back to less efficient communication paths.",
      "So this is not just a low-level fabric detail. It affects how well the server contributes to the rack, how efficiently the scheduler uses the node, and whether real training workloads get the performance the platform promised."
    ],
    coreTerms: [
      { term: "NVLink", plain: "A direct high-bandwidth GPU-to-GPU connection used for fast communication inside systems like DGX or HGX.", why: "This is the fast path that high-performance collective workloads expect." },
      { term: "Topology", plain: "The map of which GPUs connect directly to which other GPUs and what path traffic takes between them.", why: "You cannot reason about good or bad communication performance without knowing the intended map." },
      { term: "PHB", plain: "PCIe Host Bridge, meaning traffic is taking a slower PCIe-and-host path instead of a direct NVLink path.", why: "Seeing PHB where you expected NVLink is one of the clearest signs of degraded communication." },
      { term: "CRC error", plain: "A link-integrity error showing that data on the interconnect may be arriving damaged and needing retry or correction.", why: "This is often how a sick fabric announces itself before or during performance degradation." }
    ],
    commonMisreads: [
      "If the GPUs are visible, the fabric must be healthy. That is false. Visibility only tells you the devices exist, not that the fast path is working.",
      "A training slowdown must be an NCCL or software tuning problem. That is often false when the interconnect path itself has degraded.",
      "A topology map is just background information. It is not. It is the baseline that makes later fault signals meaningful."
    ],
    safeActions: [
      "Read the expected topology before you interpret any benchmark numbers.",
      "Use link-error counters to decide whether the fabric is clean before blaming higher software layers.",
      "Document which GPU pairs or links look degraded so the right physical path can be inspected later.",
      "Treat a PHB fallback as an operator signal about blast radius, not just as a cosmetic label in the matrix."
    ]
  },
  mig: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are taking one H100 GPU and carving it into 7 isolated slices with MIG. Think of it like cutting one large pizza into seven personal slices: each slice is smaller, but each one is deliberately separated from the others.",
    plainPicture: "MIG is hardware partitioning, not just scheduling. The GPU itself changes shape so multiple workloads can use isolated slices instead of fighting over one full device.",
    whyOperatorsCare: [
      "When you partition a GPU, you are not only sharing capacity. You are changing the isolation story of the node.",
      "That matters because operators care about blast radius: if one tenant, one process, or one slice has a problem, how much of the machine is affected?",
      "Beginners often assume MIG is just a Kubernetes trick. It is not. The GPU must enter MIG mode first, and that changes what the hardware advertises to the software stack."
    ],
    wholePlatform: [
      "In the bigger platform, MIG partitions become the GPU resources that schedulers and users actually consume. A workload does not just get 'GPU access' in the abstract; it gets one specific slice with a specific amount of compute and memory.",
      "That means the partition layout affects tenancy, capacity planning, fairness, and performance expectations across the node. A badly planned layout can make the server look shared while still giving users the wrong resource shape.",
      "So MIG is not only a hardware trick inside one card. It changes how the node presents capacity to Kubernetes, Slurm, or users, and it directly shapes how the rack's GPU inventory is consumed."
    ],
    coreTerms: [
      { term: "MIG", plain: "Multi-Instance GPU, a way to carve one physical GPU into smaller isolated hardware slices.", why: "This is how one expensive GPU can be shared more safely across teams." },
      { term: "Instance", plain: "One slice of GPU compute and memory that behaves like its own small accelerator.", why: "Each instance is what a workload actually lands on after partitioning." },
      { term: "Fault domain", plain: "The part of the system affected when something breaks.", why: "Operators use this idea to reason about isolation and blast radius." }
    ],
    commonMisreads: [
      "MIG is not just software scheduling. The hardware itself must switch modes before slices can exist.",
      "A slice is not a full GPU. If a team gets one slice, they are getting part of the accelerator, not the whole card.",
      "Successful partition creation does not prove the node is ready. You still verify the final layout and check it matches the tenant plan."
    ],
    safeActions: [
      "Explain the partition plan before you create any instances.",
      "Verify the final layout after creation instead of assuming the command worked exactly as intended.",
      "Tell users clearly that one slice is not the same thing as one full GPU.",
      "Check whether the node is still safe to keep in service before changing MIG mode on a busy machine."
    ]
  },
  cuda_stack: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether the software layers above the GPU actually fit together. Think of this like checking whether every adapter in a power chain matches before blaming the appliance at the end.",
    plainPicture: "The CUDA stack is a compatibility chain: driver, CUDA runtime, libraries, framework, and application. If one layer does not match the others, the workload can fail even when the GPU hardware itself is perfectly healthy.",
    whyOperatorsCare: [
      "Beginners often blame the GPU first when the real problem is software compatibility. Operators learn to check the whole stack before calling it a hardware incident.",
      "This matters because a stack mismatch can waste expensive debugging time, pull healthy nodes out of service, or make supposedly identical servers behave differently under the same workload.",
      "The key operator skill here is to move layer by layer and prove where the contract breaks instead of changing multiple parts of the stack at once."
    ],
    wholePlatform: [
      "In the bigger platform, the CUDA stack is what turns rack GPU capacity into usable compute for real workloads. Healthy hardware does not help if the software layers above it cannot agree on versions and capabilities.",
      "Schedulers, images, frameworks, and users all depend on a valid stack contract. If that contract breaks, the node may stay online but become unusable for the jobs that were supposed to land there.",
      "So this is not just a developer problem inside one environment. Stack compatibility affects whether the server contributes reliable capacity to the cluster and whether operations can trust the node for production work."
    ],
    coreTerms: [
      { term: "Driver", plain: "The software that lets the operating system talk to the GPU.", why: "Without it, GPU tools and workloads cannot function correctly." },
      { term: "CUDA runtime", plain: "The software layer applications use to run work on NVIDIA GPUs.", why: "It must be compatible with the GPU architecture and driver." },
      { term: "NGC", plain: "NVIDIA GPU Cloud container images with validated software stacks.", why: "These images reduce mismatch risk for beginners." },
      { term: "Compatibility matrix", plain: "A vendor-supported mapping of which driver, CUDA, library, and framework versions work together.", why: "This is how experts reduce guesswork during stack incidents." }
    ],
    commonMisreads: [
      "If the GPU is visible, the software stack must be fine. That is false. Visibility only proves one layer is partly working.",
      "A CUDA or PyTorch failure must mean bad hardware. That is often false when the real issue is a version contract mismatch.",
      "The fastest fix is to upgrade everything at once. That is false. Changing too many layers together destroys the evidence trail."
    ],
    safeActions: [
      "Record exact versions instead of saying something is just old or new.",
      "Prefer validated container images for first recovery attempts.",
      "Avoid changing multiple stack layers at once."
    ]
  },
  container: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how to use a validated GPU container image as a known-good runtime environment. Think of this like shipping a sealed toolkit instead of rebuilding every tool by hand at each destination.",
    plainPicture: "A GPU container image packages the application environment so the same stack can be reused across nodes. The goal is not just convenience. The goal is consistency: the same image should behave the same way wherever the platform runs it.",
    whyOperatorsCare: [
      "Operators care about containers because they reduce environment drift. Instead of debugging every node as a unique snowflake, they can start from one reproducible image baseline.",
      "This matters because many 'GPU problems' are really environment problems: the wrong libraries, the wrong framework build, or a runtime that does not actually expose the GPU inside the container.",
      "The beginner skill here is to separate two questions clearly: is the image itself valid, and is the GPU runtime path configured so that the image can really use the hardware?"
    ],
    wholePlatform: [
      "In the bigger platform, container images are one of the main ways schedulers and users consume GPU infrastructure. Jobs do not land on bare hardware in the abstract; they land with a specific image, runtime, and environment contract.",
      "That means image quality affects whether the server contributes usable capacity to the cluster. A healthy node with a broken image path is still operationally useless to the workload.",
      "So container flow is not just packaging detail. It is part of how the rack turns GPU hardware into repeatable, schedulable, user-facing compute."
    ],
    coreTerms: [
      { term: "Container image", plain: "A packaged application environment with code, libraries, and dependencies.", why: "It reduces drift between systems." },
      { term: "NGC", plain: "NVIDIA's registry of GPU-focused container images.", why: "It gives beginners a supported starting point." },
      { term: "Runtime", plain: "The environment used when the container actually runs with GPU access.", why: "A good image still fails if the runtime is not configured for GPUs." }
    ],
    commonMisreads: [
      "If the image starts, the GPU path must be working. That is false. A container can run fine while still having no usable CUDA access.",
      "Containers remove the need to verify the environment. That is false. They reduce drift, but the runtime and GPU exposure still have to be checked.",
      "A custom image is always better than a validated vendor image. That is false when the real need is a known-good baseline."
    ],
    safeActions: [
      "Pull a known-good image first.",
      "Verify GPU visibility inside the container before starting a long job.",
      "Keep the image tag with your incident notes so others can reproduce the environment."
    ]
  },
  training: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are walking through how one distributed training step actually works across many GPUs. Think of this like a relay team: each runner does their part, but the overall pace depends on how well the handoffs work too.",
    plainPicture: "Distributed training is not just many GPUs computing at once. Each GPU does local work, then the group has to synchronize before the whole job can move forward together.",
    whyOperatorsCare: [
      "Many cluster incidents look like model or code problems when they are actually synchronization, storage, or network timing problems.",
      "Operators care because a distributed job only moves as well as its slowest critical stage. A single weak rank, slow input path, or bad communication phase can drag the whole training job down.",
      "The beginner skill here is learning to separate local compute work from shared synchronization work, and to understand that both matter to job health."
    ],
    wholePlatform: [
      "In the bigger platform, distributed training is one of the main reasons the rack exists at all. The server, fabric, storage path, and scheduler all matter because they feed the same training loop.",
      "That means a distributed training issue is rarely 'just the model.' It can expose weakness anywhere in the platform: one bad node, one slow storage path, one bad communication phase, or one unhealthy rank.",
      "So this lab matters because it teaches how real workloads experience the platform end to end, not just how individual GPUs look in isolation."
    ],
    coreTerms: [
      { term: "DDP", plain: "Distributed Data Parallel, a way to run the same training process across many GPUs and combine their gradients.", why: "It is a common default for multi-GPU training." },
      { term: "Gradient", plain: "The update signal that tells the model how to change its weights.", why: "Synchronization exists because each GPU computes only part of the batch." },
      { term: "AllReduce", plain: "A collective operation that combines and redistributes gradient data across ranks.", why: "It is often the communication bottleneck." },
      { term: "Rank", plain: "One participating process in a distributed training job.", why: "A single unhealthy rank can stall the entire job." }
    ],
    commonMisreads: [
      "If every GPU is busy, the training loop must be healthy. That is false. Busy compute does not prove the synchronization stages are healthy.",
      "A slow training job must be a model-code problem. That is often false when storage, communication, or one lagging rank is the real bottleneck.",
      "Looking at one GPU tells the whole story. That is false in distributed systems where one bad participant can slow the entire job."
    ],
    safeActions: [
      "Separate compute issues from sync issues.",
      "Watch utilization during forward, backward, and synchronization phases.",
      "Treat storage stalls as part of training performance, not a separate unrelated problem."
    ]
  },
  allreduce: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are tracing how many GPUs combine their gradient updates into one shared answer. Think of it like a group trying to agree on one final number before everyone can continue working.",
    plainPicture: "AllReduce is the teamwork checkpoint inside distributed training. Each GPU has part of the update, and the job only stays correct if the group combines that information and gives the same result back to everyone.",
    whyOperatorsCare: [
      "This is one of the clearest places where a cluster can fail softly. The job stays up, but communication slows down enough to waste large amounts of GPU time.",
      "Operators care because a weak transport path, bad rank, or wrong NCCL path selection usually shows up here before users can explain why training suddenly feels slow.",
      "The beginner lesson is that healthy distributed jobs are not just about compute. Shared synchronization quality matters just as much."
    ],
    wholePlatform: [
      "In the bigger platform, AllReduce is where the node, rack fabric, and scheduler promises meet the workload. Fast GPUs do not help much if the communication phase between them is weak.",
      "A bad AllReduce path can make an expensive rack behave like a much smaller system because every iteration waits on the slowest communication link.",
      "That is why this lab matters beyond one command. It teaches how a user actually experiences platform quality during distributed work."
    ],
    coreTerms: [
      { term: "Ring algorithm", plain: "A pattern where each rank passes data to neighbors in stages until the reduction is complete.", why: "It helps beginners picture why one weak link hurts the whole group." },
      { term: "Collective", plain: "An operation involving many ranks at once, not just one sender and one receiver.", why: "Many GPU communication failures are collective failures." },
      { term: "NCCL", plain: "NVIDIA's library for multi-GPU communication collectives.", why: "It is the common tool behind AllReduce performance and failures." },
      { term: "Bandwidth baseline", plain: "The expected healthy throughput range for a given rack design and transport path.", why: "Without a baseline, beginners cannot tell whether a job is slow or normal." }
    ],
    commonMisreads: [
      "If the training job started, the communication path must be fine. That is false. AllReduce can still be badly degraded while the job stays alive.",
      "A slow collective must be a model-code problem. That is often false when the real issue is path selection, transport health, or one weak participant.",
      "Seeing NCCL logs is enough. It is not. Operators care about whether throughput matches the healthy baseline, not just whether a library printed output."
    ],
    safeActions: [
      "Check what path NCCL actually chose before touching deeper code.",
      "Compare collective throughput to a healthy baseline, not just to your intuition.",
      "Treat one weak communication phase as a cluster-efficiency problem, not merely a library detail."
    ]
  },
  ib_fabric: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether the cluster's InfiniBand network is actually healthy enough for multi-node GPU jobs. Think of this like inspecting the highway between servers, not just the servers themselves.",
    plainPicture: "InfiniBand is the fast fabric that lets servers exchange data quickly during distributed work. A node can look healthy by itself while the path between nodes is still weak, noisy, or partially down.",
    whyOperatorsCare: [
      "Many distributed training problems feel like software issues until someone checks the fabric and finds bad ports, dirty counters, or an unstable path.",
      "Operators care because the interconnect decides whether multi-node GPU jobs scale cleanly or waste time waiting on the network.",
      "The beginner skill here is learning that the network path is part of the AI system, not just background plumbing."
    ],
    wholePlatform: [
      "In the bigger platform, InfiniBand is what turns many separate GPU servers into one usable cluster for distributed jobs. If the fabric is unhealthy, the rack stops behaving like one coordinated system.",
      "That affects more than one benchmark. Scheduler placement, NCCL efficiency, and user-visible training throughput all depend on this path being clean.",
      "So this lab matters because it teaches how problems spread beyond one host: one bad port, cable, HCA, or switch path can hurt many jobs at once."
    ],
    coreTerms: [
      { term: "InfiniBand", plain: "A high-performance network technology used for low-latency cluster communication.", why: "Many GPU clusters depend on it for distributed training." },
      { term: "Port state", plain: "Whether a network port is active, down, or otherwise unhealthy.", why: "A single bad port can collapse an entire path." },
      { term: "perfquery", plain: "A tool that reads InfiniBand performance counters and error counters.", why: "It turns a vague network suspicion into evidence." },
      { term: "Fabric sweep", plain: "A broader inspection of multiple links and devices across the interconnect.", why: "This helps distinguish one bad node from a wider network problem." }
    ],
    commonMisreads: [
      "If nodes can still ping or SSH, the fabric must be fine. That is false. Management reachability does not prove the RDMA path is healthy.",
      "A network issue only matters if the link is completely down. That is false. A noisy or unstable path can damage performance long before it becomes a full outage.",
      "If one host looks bad, the problem must stay local. That is often false because fabric faults can affect many nodes or shared switch paths."
    ],
    safeActions: [
      "Check link state before tuning anything.",
      "Use counters to see whether the fabric is clean or noisy.",
      "Document the exact host and port that is unhealthy."
    ]
  },
  roce: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether Ethernet is configured well enough to carry RDMA traffic for distributed GPU jobs. Think of this as testing whether an ordinary-looking road has the traffic rules needed for very fast freight, not just whether the road exists.",
    plainPicture: "RoCE lets GPU jobs use RDMA over Ethernet, but that only works well if the congestion controls across the path are aligned. The network can still look up while behaving badly for the kind of traffic AI jobs depend on.",
    whyOperatorsCare: [
      "RoCE teaches that a network can be available yet still be wrong for distributed training because congestion handling, not just link speed, determines whether the path stays healthy under load.",
      "Operators care because pause storms, MTU mismatches, or weak ECN behavior can quietly turn a high-speed fabric into a bottleneck for many jobs at once.",
      "The beginner lesson is that policy and flow control are part of system health, not background details reserved for network specialists."
    ],
    wholePlatform: [
      "In the bigger platform, RoCE sits between the GPU servers, the switches, and the job scheduler. If the Ethernet fabric is mis-tuned, distributed jobs lose efficiency even when the servers themselves look fine.",
      "That means this lab is really about platform coordination: host settings, switch behavior, and workload traffic patterns all have to agree for the rack to behave like one fast system.",
      "So this matters beyond one interface. A RoCE mistake can reduce scaling efficiency across a rack or cluster without creating a simple hard outage."
    ],
    coreTerms: [
      { term: "RoCEv2", plain: "RDMA over Converged Ethernet version 2, a way to get low-latency remote memory access over Ethernet.", why: "It is common in Ethernet-based AI clusters." },
      { term: "PFC", plain: "Priority Flow Control, a pause mechanism meant to prevent packet loss for important traffic classes.", why: "Misconfiguration can create serious congestion behavior." },
      { term: "ECN", plain: "Explicit Congestion Notification, a way for the network to signal congestion before packet loss occurs.", why: "It helps keep performance stable without overusing pause frames." },
      { term: "PFC storm", plain: "A feedback loop of pause traffic that spreads congestion instead of containing it.", why: "This is one of the most important bad outcomes beginners should recognize." }
    ],
    commonMisreads: [
      "If Ethernet link-up looks normal, RoCE must be healthy. That is false. Ordinary connectivity does not prove the RDMA path is handling congestion correctly.",
      "A fast cable or high link speed guarantees good distributed performance. That is false when PFC, ECN, or MTU settings are misaligned.",
      "Congestion problems must show up as a full outage. That is false. RoCE issues often show up as slow, unstable, or bursty distributed performance instead."
    ],
    safeActions: [
      "Check MTU, PFC, and ECN together rather than in isolation.",
      "Treat a rising pause-frame count as a clue, not a final diagnosis.",
      "Document switch-side counters when network problems affect training."
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
