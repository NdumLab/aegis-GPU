/**
 * LEARNING DATA CHUNK: hardware_foundations
 */

window.AEGIS_LEARNING_PARTS = window.AEGIS_LEARNING_PARTS || {};
window.AEGIS_LEARNING_PARTS.hardware_foundations = {
  ecc: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are watching how GPU memory errors move from healthy baseline, to warning signs, to a hard containment decision. Think of this like noticing hairline cracks in a pressure pipe before it finally bursts under load.",
    plainPicture: "Picture GPU memory as a long wall of tiny storage boxes where the training job keeps numbers. ECC is the checker that looks at each box before the number is used. A single-bit error is like one smudged digit that the checker can repair before the job notices. That is useful, but if the same wall keeps getting smudges, the wall may be wearing out. A double-bit error is different: too much of the number is damaged, so the checker can no longer know the safe value. That is why corrected errors are warning lights, while uncorrected errors become a stop-and-protect-the-node event.",
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
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
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
    objectiveText: "We are learning how to read NVIDIA XID fault codes as operator signals instead of treating them like mysterious numbers. The beginner goal is not to memorize every code. It is to look at a code, classify the fault family, and decide what evidence and containment step should come next.",
    plainPicture: "Picture the NVIDIA driver as the control-room operator watching the GPU. When something breaks, it writes a short incident code in the log instead of a long story. That short code is the XID. XID 48 is like the operator saying memory integrity failed. XID 79 is like saying the GPU stopped answering the bus. XID 74 is like saying the GPU-to-GPU link is noisy or damaged. And a whole family of codes — XID 13, 31, 43 — is the operator saying the running application misbehaved, not the hardware. The number is not the whole diagnosis; it is the signpost that tells you which room to inspect next: the memory room, the bus room, the fabric room, or the application's own code.",
    whyOperatorsCare: [
      "Operators often see the XID code before they see a human explanation. Logs, alerts, and support tickets may give you only a short number, so the operator has to turn that into a safe containment decision quickly.",
      "This matters because different XIDs imply different fault families. A memory-integrity problem, a bus or hang problem, and a fabric problem do not all deserve the same response or the same recovery path.",
      "The real operator skill here is not memorizing numbers. It is learning the workflow: identify the code, classify the fault family, confirm with evidence, contain the blast radius, and only then decide how far recovery should go."
    ],
    wholePlatform: [
      "In the bigger platform, XID faults are one of the ways a single bad GPU turns into a node, rack, or workload problem. The code helps operators decide whether the issue stays local to one device or threatens the wider cluster.",
      "A good XID response protects schedulers, users, and neighboring workloads from landing on unstable hardware or from depending on a broken communication path.",
      "So this is not just about reading logs. It is about keeping the platform reliable by turning a short driver signal into a fast, evidence-backed operational decision."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "ECC",
        plain: "Error-correcting code — memory protection that checks stored bits and can often repair a single flipped bit before software ever sees it.",
        why: "ECC counters are one of the first places GPU memory trouble becomes visible."
      },
      {
        term: "CRC",
        plain: "Cyclic redundancy check — a checksum stamped on each transfer so the receiver can detect that data arrived corrupted.",
        why: "Rising CRC error counts on a link mean the physical connection is degrading."
      },
      {
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
      { term: "XID", plain: "An NVIDIA driver event code used to classify GPU faults.", why: "These are often the first hardware fault signals operators see in logs." },
      { term: "XID 48", plain: "A fault code commonly associated with an uncorrectable ECC event — a double-bit memory error the hardware cannot repair.", why: "This usually points toward memory-integrity trouble and containment." },
      { term: "XID 79", plain: "A code associated with a GPU that has fallen off the bus or become unreachable.", why: "This often points toward reset-or-reboot style recovery, not memory-only reasoning." },
      { term: "XID 74", plain: "A fault often associated with NVLink problems such as link CRC errors.", why: "It connects log evidence to interconnect-path health instead of memory or bus failure." },
      { term: "XID 13", plain: "Graphics engine exception — most often the running application executed an illegal instruction or touched an out-of-range address.", why: "It is usually the job's bug, not broken silicon. Check the application before blaming the GPU." },
      { term: "XID 31", plain: "GPU memory page fault — the application asked the GPU to read or write an invalid memory address.", why: "Overwhelmingly an application bug (the CUDA 'illegal memory access'). The fix lives in code, not in an RMA." },
      { term: "XID 43", plain: "A user application hit an error and was stopped, while the GPU itself recovered and kept serving other work.", why: "It tells you a job died, not that the node is unhealthy — no containment needed for the hardware." },
      { term: "XID 45", plain: "Preemptive cleanup — the driver tore down a job's channels, often because the job was killed or a preceding fault forced cleanup.", why: "It is a context signal: look at what happened just before it, rather than treating it as the root cause." },
      { term: "XID 63", plain: "The GPU recorded a degraded memory page or row for retirement/remapping; the fix takes effect on the next GPU reset.", why: "It is the card self-healing. Schedule a drain and reset rather than reacting like the GPU already failed." },
      { term: "XID 64", plain: "A memory page/row could not be retired or remapped — the self-healing path itself failed.", why: "Unlike XID 63, this one points toward the RMA path instead of a scheduled reset." },
      { term: "XID 92", plain: "The driver observed a high rate of corrected single-bit ECC errors on the GPU.", why: "Nothing is corrupted yet, but the correction machinery is working overtime — a monitoring and maintenance-planning signal." },
      { term: "XID 94", plain: "Contained ECC error — on A100/H100-class GPUs the hardware isolated an uncorrectable error to the one application that touched the bad data.", why: "Only that job needs to restart; the GPU can keep serving the rest after cleanup." },
      { term: "XID 95", plain: "Uncontained ECC error — the containment attempt failed, so the GPU's wider state can no longer be trusted.", why: "This is the drain-and-reset (or reboot) case, closer in severity to XID 48." },
      { term: "XID 119", plain: "GSP RPC timeout — the GPU System Processor firmware that modern drivers delegate work to stopped responding.", why: "A growing share of real-world faults on current drivers; recovery is usually GPU reset or node reboot, and persistent cases are driver/firmware issues." },
      { term: "GSP", plain: "GPU System Processor — a small controller on the GPU that runs firmware handling tasks the driver used to do on the CPU.", why: "When GSP hangs, the whole GPU can look frozen even though the silicon that does the math is fine." },
      { term: "Containment", plain: "The first phase of response where you stop the fault from hurting more jobs or more hardware paths.", why: "Beginners need to know the first goal is control, not perfect root cause." }
    ],
    commonMisreads: [
      "The number itself is the diagnosis. That is false. The code is the start of the hardware story, not the whole story.",
      "All XIDs deserve the same response. That is false. Memory faults, bus faults, and fabric faults often need different confirmation and recovery steps.",
      "Every XID means broken hardware. That is false. XID 13, 31, and 43 usually mean the application misbehaved — the safe response is to check the job's code, not to open an RMA.",
      "If the job is still partly alive, the fault must be minor. That is false. Some severe faults still leave part of the system standing while the hardware underneath is no longer safe to trust."
    ],
    safeActions: [
      "Capture the exact XID code and the GPU or PCI address involved before changing anything.",
      "Use the code to choose the next confirmation step instead of guessing across fault families.",
      "Drain or isolate the affected node before risky recovery steps if the evidence points to unsafe hardware state."
    ]
  },
  nvlink: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "NVLink is the high-speed GPU-to-GPU interconnect built to let GPUs within a server exchange data much faster than the PCIe host-bridge (PHB) path. We are checking whether 8 H100 GPUs are actually using that fast fabric. The beginner goal is not just to spot whether GPUs exist. It is to tell the difference between a healthy fast interconnect and a slower fallback path that can quietly waste the whole node.",
    plainPicture: "Picture eight GPUs in one server as eight workers passing heavy crates to each other. NVLink is the private high-speed hallway between those workers. When the hallway is open, crates move directly and training stays fast. If that hallway is blocked, the workers may still pass crates through the building lobby, which is the slower PCIe host-bridge path shown as PHB. The job may still run, but the route is much worse. The topology screenshot is the floor plan that shows whether traffic is using the private hallway or the slow lobby route.",
    whyOperatorsCare: [
      "Operators care about NVLink because distributed training health is not just 'can I see eight GPUs?' The real question is whether those GPUs can exchange data over the fast path the node was designed to use.",
      "A node can stay online, launch jobs, and still be operationally degraded. That is why the first screenshot in this lab matters: uptime is not the same as healthy interconnect performance.",
      "The operator workflow here is deliberate: read the healthy topology screenshot first, compare later screenshots against it, then decide whether counters, benchmark results, and NCCL behavior still tell the same story."
    ],
    wholePlatform: [
      "In the bigger platform, NVLink is part of the communication spine inside the server. If it is healthy, the node contributes the fast collective path the scheduler and workload owners think they are getting.",
      "If it degrades, the node may still look schedulable, but multi-GPU jobs can slow down sharply, consume expensive GPU hours inefficiently, and fall back to weaker communication paths without a hard outage.",
      "So this is not just a low-level topology detail. It changes whether the server is still safe to keep in service for distributed work, how large the blast radius is, and whether the rack is actually delivering the performance it promised."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "PCIe",
        plain: "PCI Express — the standard slot and bus that connects add-in cards (GPUs, network cards) to the rest of the server. It is the ordinary road; NVLink is the express lane built just for GPU-to-GPU traffic.",
        why: "When GPU traffic says 'PHB' or falls back to PCIe, it means the fast path is not being used."
      },
      {
        term: "Bandwidth",
        plain: "How much data a link can move per second (GB/s). Think highway width: more lanes, more simultaneous traffic.",
        why: "Bandwidth numbers are how you compare NVLink, PCIe, InfiniBand, and storage paths."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      {
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
      { term: "NVLink", plain: "A direct high-bandwidth GPU-to-GPU connection used for fast communication inside systems like DGX or HGX.", why: "This is the fast path that collective workloads expect to use." },
      { term: "Topology", plain: "The map of which GPUs connect directly to which other GPUs and what path traffic takes between them.", why: "The topology screenshot is your baseline for deciding whether later output is healthy or degraded." },
      { term: "PHB", plain: "PCIe Host Bridge, meaning traffic is taking a slower PCIe-and-host path instead of a direct NVLink path.", why: "Seeing PHB where the baseline screenshot showed NV4 is one of the clearest degradation signals in this lab." },
      { term: "CRC error", plain: "A link-integrity error showing that data on the interconnect may be arriving damaged and needing retry or correction.", why: "CRC counters help you decide whether the path is only present on paper or actually healthy enough to trust." }
    ],
    commonMisreads: [
      "If the GPUs are visible, the fabric must be healthy. That is false. Visibility only proves the devices exist, not that the direct path is intact.",
      "A training slowdown must start in NCCL or software tuning. That is often false when the topology screenshot, counter screenshot, and fallback screenshot already show a hardware-path problem.",
      "The topology screenshot is just background information. It is not. It is the design contract that makes later PHB fallbacks and bandwidth collapse meaningful."
    ],
    safeActions: [
      "Start with the healthy topology screenshot before you interpret any benchmark or NCCL output.",
      "Use the error-counter screenshot and live counters to decide whether the visible path is clean before blaming higher software layers.",
      "Document which GPU pairs or links changed from the healthy screenshot to the degraded screenshot so the right physical path can be inspected later.",
      "Treat a PHB fallback as an operator signal about containment and blast radius, not just as a cosmetic label in the matrix."
    ]
  },
  mig: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are taking one H100 GPU and carving it into 7 isolated MIG slices. The beginner goal is not just to see that partitioning exists. It is to understand that the hardware itself changes shape, and that this changes what the node can safely advertise to users and schedulers.",
    plainPicture: "Picture one large GPU as a big apartment building. Without MIG, one tenant can rent the whole building. With MIG, the building is divided into smaller locked apartments, each with its own share of compute and memory. This is not just a calendar reservation; the hardware itself changes how it presents the rooms. Enabling MIG turns on apartment mode, creating instances builds the apartments, and verification checks that the expected apartments really exist before users move in.",
    whyOperatorsCare: [
      "When you partition a GPU, you are not only sharing capacity. You are changing the isolation story of the node.",
      "That matters because operators care about blast radius: if one tenant, one process, or one slice has a problem, how much of the machine is affected and what still remains safe to use?",
      "Beginners often assume MIG is just a Kubernetes or scheduler trick. It is not. The GPU must enter MIG mode first, and that changes what the hardware advertises to the software stack."
    ],
    wholePlatform: [
      "In the bigger platform, MIG partitions become the GPU resources that schedulers and users actually consume. A workload does not get 'GPU access' in the abstract. It gets one specific slice with one specific compute and memory shape.",
      "That means the partition layout affects tenancy, fairness, capacity planning, and user expectations across the node. A badly planned layout can make the server look shared while still advertising the wrong resource shape to the cluster.",
      "So MIG is not only a hardware trick inside one card. It changes how the node presents capacity to Kubernetes, Slurm, and users, and it directly shapes how the rack's GPU inventory is consumed."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "Kubernetes",
        plain: "A container orchestrator — software that schedules containers across many servers and decides what runs where.",
        why: "Many AI platforms hand GPU nodes to Kubernetes instead of a traditional HPC scheduler."
      },
      {
        term: "Oversubscription",
        plain: "Promising users more capacity than physically exists, betting they will not all use it at once. Works for bursty use; hurts when everyone shows up.",
        why: "Most sharing incidents trace back to oversubscription meeting simultaneous demand."
      },
      { term: "MIG", plain: "Multi-Instance GPU, a way to carve one physical GPU into smaller isolated hardware slices.", why: "This is how one expensive GPU can be shared more safely across teams." },
      { term: "Instance", plain: "One slice of GPU compute and memory that behaves like its own small accelerator.", why: "Each instance is what a workload actually lands on after partitioning." },
      { term: "Fault domain", plain: "The part of the system affected when something breaks.", why: "Operators use this to reason about isolation and blast radius after partitioning." }
    ],
    commonMisreads: [
      "MIG is just software scheduling. That is false. The hardware itself must switch modes before slices can exist.",
      "A slice is a full GPU in smaller packaging. That is false. A slice is only part of the accelerator, with narrower compute and memory limits.",
      "Successful partition creation proves the node is ready. That is false. You still verify the final layout and check it matches the tenant plan."
    ],
    safeActions: [
      "Explain the partition plan before you create any instances.",
      "Use the creation and listing screenshots as proof points instead of assuming the command worked exactly as intended.",
      "Tell users clearly that one slice is not the same thing as one full GPU.",
      "Check whether the node is safe to reconfigure before changing MIG mode on a busy machine."
    ]
  },
  cuda_stack: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether the software layers above the GPU actually fit together. The beginner goal is to stop treating every CUDA failure like a hardware incident and to learn how to find the exact layer where the contract breaks.",
    plainPicture: "Think of the CUDA stack as a chain of handoffs: GPU hardware -> NVIDIA driver -> CUDA runtime -> framework -> training script.",
    stackHandoffs: [
      {
        title: "GPU hardware",
        tone: "green",
        text: "The GPU hardware provides the actual compute and memory, so there is nothing useful to accelerate unless the physical device is present and healthy."
      },
      {
        title: "NVIDIA driver",
        tone: "blue",
        text: "The NVIDIA driver makes the GPU available to the Linux OS, because Linux needs a hardware-specific driver before it can control the device, expose it to tools, and accept work for it."
      },
      {
        title: "CUDA",
        tone: "yellow",
        text: "CUDA gives applications a supported way to send work through that driver, because most training software does not talk to GPU hardware directly."
      },
      {
        title: "Framework - PyTorch or TensorFlow",
        tone: "purple",
        text: "PyTorch or TensorFlow uses CUDA to run model code, because the framework needs CUDA kernels and libraries that match the CUDA version and GPU architecture."
      },
      {
        title: "Training job or script",
        tone: "cyan",
        text: "Your training script sits at the top, because it depends on the framework to translate model operations into valid GPU work. That is the compatibility chain."
      }
    ],
    stackProblemSummary: "A GPU can be visible in Linux and still fail a CUDA workload if the driver is too old for the CUDA runtime. CUDA can be installed and still fail if the framework was built for a different CUDA version or GPU architecture. The important operator lesson is this: healthy hardware does not prove a healthy workload path. When a CUDA job fails, check which handoff broke before blaming the GPU.",
    stackVersionCheck: {
      title: "How Do I Know The Versions Are Correct?",
      intro: "A golden image is the fastest trusted baseline, but it is not the only proof. Correct means the whole chain is supported together and the framework can actually run a tiny GPU workload.",
      checks: [
        "Collect exact versions: GPU model, driver version, CUDA runtime or toolkit version, framework version, framework CUDA build, container tag, and training code release.",
        "Compare the chain against a supported source: a golden image manifest, NVIDIA compatibility matrix, NGC container tag, framework install table, or your site-approved build matrix.",
        "Check the direction of dependency: the driver must support the CUDA runtime, the framework must be built for that CUDA version, and the GPU architecture must be supported by the framework build.",
        "Prove it with a small framework test, not only `nvidia-smi`. For PyTorch, confirm `torch.cuda.is_available()` and run a tiny tensor operation on the GPU.",
        "If the custom stack disagrees with the golden image, treat that as evidence to investigate. The golden image is a known-good comparison point, not magic by itself."
      ]
    },
    whyOperatorsCare: [
      "Beginners often blame the GPU first when the real problem is software compatibility. Operators check the stack before calling it a hardware incident.",
      "This matters because a stack mismatch can waste expensive debugging time, pull healthy nodes out of service, or make supposedly identical servers behave differently under the same workload.",
      "The operator skill here is to move layer by layer and prove where the contract breaks instead of changing many parts of the stack at once."
    ],
    wholePlatform: [
      "In the bigger platform, the CUDA stack is what turns rack GPU capacity into usable compute for real workloads. Healthy hardware does not help if the software layers above it cannot agree on versions and capabilities.",
      "Schedulers, images, frameworks, and users all depend on a valid stack contract. If that contract breaks, the node may stay online but still be unusable for the jobs that were supposed to land there.",
      "So this is not just a developer problem inside one environment. Stack compatibility decides whether the server contributes reliable capacity to the cluster and whether operations can trust the node for production work."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      { term: "Driver", plain: "The software that lets the operating system talk to the GPU.", why: "Without it, higher GPU tools and frameworks cannot function correctly." },
      { term: "CUDA runtime", plain: "The software layer applications use to run work on NVIDIA GPUs.", why: "It must be compatible with the driver and the framework above it." },
      { term: "NGC", plain: "NVIDIA GPU Cloud container images with validated software stacks.", why: "These images reduce mismatch risk when you need a known-good baseline." },
      { term: "Compatibility matrix", plain: "A vendor-supported mapping of which driver, CUDA, library, and framework versions work together.", why: "This is how operators reduce guesswork during stack incidents." }
    ],
    commonMisreads: [
      "If the GPU is visible, the software stack must be fine. That is false. Visibility only proves one layer is partly working.",
      "A CUDA or PyTorch failure must mean bad hardware. That is often false when the real issue is a version contract mismatch.",
      "The fastest fix is to upgrade everything at once. That is false. Changing too many layers together destroys the evidence trail."
    ],
    safeActions: [
      "Record exact versions instead of saying something is just old or new.",
      "Use the step screenshots to keep the stack order clear: driver, then CUDA, then framework.",
      "Prefer validated container images for first recovery attempts.",
      "Avoid changing multiple stack layers at once."
    ]
  },
  container: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how to use a validated GPU container image as a known-good runtime environment. The beginner goal is to separate image quality from runtime quality and to prove both before trusting the workload.",
    plainPicture: "Picture a container image as a sealed toolbox for an AI job. Inside the toolbox are Python, CUDA libraries, PyTorch, and the application code. That makes the job easier to move from one server to another. But the toolbox still needs a working power outlet. The GPU runtime is that outlet: it connects the sealed toolbox to the real NVIDIA GPU on the host. A good image without GPU runtime access is like a perfect power tool with no electricity. This lab checks both the toolbox and the outlet.",
    whyOperatorsCare: [
      "Operators care about containers because they reduce environment drift. Instead of debugging every node as a unique snowflake, they can start from one reproducible image baseline.",
      "This matters because many 'GPU problems' are really environment problems: the wrong libraries, the wrong framework build, or a runtime that does not actually expose the GPU inside the container.",
      "The operator skill here is to separate two questions clearly: is the image itself valid, and is the GPU runtime path configured so that the image can really use the hardware?"
    ],
    wholePlatform: [
      "In the bigger platform, container images are one of the main ways schedulers and users consume GPU infrastructure. Jobs do not land on bare hardware in the abstract. They land with a specific image, runtime, and environment contract.",
      "That means image quality affects whether the server contributes usable capacity to the cluster. A healthy node with a broken image path is still operationally useless to the workload.",
      "So container flow is not just packaging detail. It is part of how the rack turns GPU hardware into repeatable, schedulable, user-facing compute."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "CUDA",
        plain: "NVIDIA's programming platform that lets software run on the GPU. Applications are built against a CUDA version, and the GPU driver must be new enough to support it.",
        why: "Most 'GPU app won't start' incidents are a mismatch between driver version and CUDA version."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      { term: "Container image", plain: "A packaged application environment with code, libraries, and dependencies.", why: "It reduces drift between systems." },
      { term: "NGC", plain: "NVIDIA's registry of GPU-focused container images.", why: "It gives operators a supported starting point and a known-good baseline." },
      { term: "Runtime", plain: "The environment used when the container actually runs with GPU access.", why: "A good image still fails if the runtime is not configured for GPUs." }
    ],
    commonMisreads: [
      "If the image starts, the GPU path must be working. That is false. A container can run fine while still having no usable CUDA access.",
      "Containers remove the need to verify the environment. That is false. They reduce drift, but the runtime and GPU exposure still have to be checked.",
      "A custom image is always better than a validated vendor image. That is false when the real need is a known-good baseline."
    ],
    safeActions: [
      "Pull a known-good image first.",
      "Use the screenshots to prove the path in order: image, runtime, in-container framework, workload, live GPU activity.",
      "Verify GPU visibility inside the container before starting a long job.",
      "Keep the image tag with your incident notes so others can reproduce the environment."
    ]
  },
  training: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are walking through how one distributed training step actually works across many GPUs. The beginner goal is to separate local compute from shared synchronization so you can tell where a training job is actually healthy and where it is only pretending to be healthy.",
    plainPicture: "Picture distributed training as a classroom where many students solve different parts of the same assignment. Each GPU, called a rank, works on its own mini-batch first. Then everyone must compare answers before the class can move to the next question. That compare step is synchronization. If one student is slow, missing, or cannot hear the group, the whole class waits. That is why operators look at launch, compute, synchronization, and update as separate stages instead of saying only that the job is running.",
    whyOperatorsCare: [
      "Many cluster incidents look like model or code problems when they are actually synchronization, storage, or network timing problems.",
      "A distributed job only moves as well as its slowest critical stage. One weak rank, one slow input path, or one bad communication phase can drag the whole run down.",
      "The operator skill here is learning to separate local compute work from shared synchronization work and to decide which phase deserves the next investigation step."
    ],
    wholePlatform: [
      "At the platform level, distributed training is one of the main reasons the rack exists at all. The server, fabric, storage path, and scheduler all matter because they feed the same training loop.",
      "That means a distributed training issue is rarely 'just the model.' It can expose weakness anywhere in the platform: one bad node, one slow storage path, one bad communication phase, or one unhealthy rank.",
      "So this lab matters because it teaches how real workloads experience the platform end to end, not just how one GPU looks in isolation."
    ],
    coreTerms: [
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "Batch",
        plain: "A group of samples processed together in one step. Bigger batches keep the GPU's many cores busier, but need more memory.",
        why: "Batch size is the first knob everyone turns when GPUs sit idle or memory runs out."
      },
      {
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
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
      "Use the phase screenshots to keep the loop order clear: launch, local compute, synchronization, update.",
      "Watch utilization during forward, backward, and synchronization phases.",
      "Treat storage stalls as part of training performance, not a separate unrelated problem."
    ]
  },
  allreduce: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are tracing how many GPUs combine their gradient updates into one shared answer. The beginner goal is to stop treating collectives as invisible library magic and to see how one weak communication path can slow the whole job.",
    plainPicture: "Picture each GPU holding one page of notes about how the model should change. AllReduce is the group huddle where every GPU shares its page, the group combines the notes, and every GPU leaves with the same final answer. If the huddle uses the fast room-to-room path, training moves quickly. If it has to use a slow hallway or a bad network route, everyone still may get the answer, but much later. This lab shows the route, the sharing pattern, and the speed so you can see why collectives matter.",
    whyOperatorsCare: [
      "This is one of the clearest places where a cluster can fail softly. The job stays up, but communication slows down enough to waste large amounts of GPU time.",
      "A weak transport path, bad rank, or wrong NCCL path selection usually shows up here before users can explain why training suddenly feels slow.",
      "The operator takeaway is that healthy distributed jobs are not just about compute. Shared synchronization quality matters just as much."
    ],
    wholePlatform: [
      "Across the platform, AllReduce is where the node, rack fabric, and scheduler promises meet the workload. Fast GPUs do not help much if the communication phase between them is weak.",
      "A bad AllReduce path can make an expensive rack behave like a much smaller system because every iteration waits on the slowest communication link.",
      "That is why this lab matters beyond one command. It teaches how users actually experience platform quality during distributed work."
    ],
    coreTerms: [
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "Gradient",
        plain: "The correction signal computed during training — for every weight, how much and in which direction to adjust it. This is the data GPUs exchange after each step.",
        why: "All-reduce traffic is almost entirely gradients; that is why network health shapes training speed."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
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
      "Use the screenshot sequence to compare healthy path, healthy benchmark, and degraded fallback as one story.",
      "Compare collective throughput to a healthy baseline, not just to your intuition.",
      "Treat one weak communication phase as a cluster-efficiency problem, not merely a library detail."
    ]
  },
  ib_fabric: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether the cluster's InfiniBand network is actually healthy enough for multi-node GPU jobs. The beginner goal is to stop thinking only in terms of nodes and to start thinking in terms of the path between nodes.",
    plainPicture: "Picture a GPU cluster as several buildings connected by private express roads. InfiniBand is the express-road system. A server can look healthy inside its own building, but training still suffers if the road between buildings is closed, full of errors, or much slower than expected. An Active port means the road entrance is open. Clean counters mean cars are not constantly hitting debris. Bandwidth tests show whether traffic can actually move at highway speed. This lab teaches you to inspect the road, not just the building.",
    whyOperatorsCare: [
      "Many distributed training problems feel like software issues until someone checks the fabric and finds bad ports, dirty counters, or an unstable path.",
      "The interconnect decides whether multi-node GPU jobs scale cleanly or waste time waiting on the network.",
      "The operator skill here is learning that the network path is part of the AI system, not just background plumbing."
    ],
    wholePlatform: [
      "Across the rack, InfiniBand is what turns many separate GPU servers into one usable cluster for distributed jobs. If the fabric is unhealthy, the rack stops behaving like one coordinated system.",
      "That affects more than one benchmark. Scheduler placement, NCCL efficiency, and user-visible training throughput all depend on this path being clean.",
      "So this lab matters because it teaches how problems spread beyond one host: one bad port, cable, HCA, or switch path can hurt many jobs at once."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "NCCL",
        plain: "NVIDIA Collective Communications Library — the software layer GPUs use to exchange results with each other during multi-GPU work.",
        why: "When GPU-to-GPU communication is slow or failing, NCCL logs are where the story is told."
      },
      {
        term: "RDMA",
        plain: "Remote direct memory access — one server's network card writes data straight into another server's memory, bypassing the CPU. This is why the fabric is so fast, and why it needs special network behavior.",
        why: "InfiniBand and RoCE are both just ways of delivering RDMA."
      },
      {
        term: "HCA",
        plain: "Host channel adapter — the InfiniBand network card installed in each server. The IB equivalent of an Ethernet NIC.",
        why: "Commands like ibstat are reading the state of this card."
      },
      {
        term: "Bandwidth",
        plain: "How much data a link can move per second (GB/s). Think highway width: more lanes, more simultaneous traffic.",
        why: "Bandwidth numbers are how you compare NVLink, PCIe, InfiniBand, and storage paths."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
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
      "Use the screenshots to keep the order clear: port state, counters, bandwidth, then wider sweep.",
      "Use counters to see whether the fabric is clean or noisy.",
      "Document the exact host and port that is unhealthy."
    ]
  },
  roce: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are checking whether Ethernet is configured well enough to carry RDMA traffic for distributed GPU jobs. The beginner goal is to understand that a link can be up and still be wrong for AI traffic if congestion behavior is unhealthy.",
    plainPicture: "Picture RoCE as trying to run express-lane truck traffic on an Ethernet highway. RDMA traffic wants a smooth path with very little packet loss. PFC pause frames are like traffic officers who can stop a lane when congestion builds. ECN is like an early warning sign that tells drivers to slow down before the lane has to stop. If those controls are tuned badly, the road can technically be open but traffic freezes in waves. This lab shows why RoCE health is about congestion behavior, not just link-up status.",
    whyOperatorsCare: [
      "RoCE teaches that a network can be available yet still be wrong for distributed training because congestion handling, not just link speed, determines whether the path stays healthy under load.",
      "Pause storms, MTU mismatches, or weak ECN behavior can quietly turn a high-speed fabric into a bottleneck for many jobs at once.",
      "The key operator lesson is that policy and flow control are part of system health, not background details reserved for network specialists."
    ],
    wholePlatform: [
      "At the platform level, RoCE sits between the GPU servers, the switches, and the job scheduler. If the Ethernet fabric is mis-tuned, distributed jobs lose efficiency even when the servers themselves look fine.",
      "That means this lab is really about platform coordination: host settings, switch behavior, and workload traffic patterns all have to agree for the rack to behave like one fast system.",
      "So this matters beyond one interface. A RoCE mistake can reduce scaling efficiency across a rack or cluster without creating a simple hard outage."
    ],
    coreTerms: [
      {
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "RDMA",
        plain: "Remote direct memory access — one server's network card writes data straight into another server's memory, bypassing the CPU. This is why the fabric is so fast, and why it needs special network behavior.",
        why: "InfiniBand and RoCE are both just ways of delivering RDMA."
      },
      {
        term: "MTU",
        plain: "Maximum transmission unit — the largest packet the network will carry in one piece. Both ends and every switch in between must agree on it.",
        why: "Mismatched MTU is a classic silent killer of RDMA performance."
      },
      {
        term: "Lossless",
        plain: "A network tuned so switches pause traffic instead of dropping packets when buffers fill. RDMA assumes this — a single dropped packet costs far more than a brief pause.",
        why: "PFC and ECN exist to make ordinary Ethernet behave losslessly for RoCE."
      },
      {
        term: "Bandwidth",
        plain: "How much data a link can move per second (GB/s). Think highway width: more lanes, more simultaneous traffic.",
        why: "Bandwidth numbers are how you compare NVLink, PCIe, InfiniBand, and storage paths."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
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
      "Use the screenshot sequence to compare healthy path-control settings against the pause-storm failure mode.",
      "Treat a rising pause-frame count as a clue, not a final diagnosis.",
      "Document switch-side counters when network problems affect training."
    ]
  },
};
