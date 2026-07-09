/**
 * LEARNING DATA CHUNK: platform_operations
 */

window.AEGIS_LEARNING_PARTS = window.AEGIS_LEARNING_PARTS || {};
window.AEGIS_LEARNING_PARTS.platform_operations = {
  nccl_fallback: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "NCCL is the communication layer many distributed GPU jobs use to move data between ranks. In this lab, fallback means NCCL drops from its preferred fast transport to a slower one. The beginner goal is to stop treating a running job as proof of a healthy job and to learn how to spot expensive slow success.",
    plainPicture: "Picture NCCL as the dispatcher that chooses how GPUs talk during distributed training. The preferred route is the fast express lane, such as InfiniBand. Fallback means the dispatcher could not or did not use that express lane, so it sends traffic through a slower city street such as TCP sockets. The job may still move, but every synchronized step takes longer. This lab teaches you to read the route label first: if the job is using Socket instead of IB, the problem is the communication path, not necessarily the model code.",
    whyOperatorsCare: [
      "This is one of the clearest beginner examples of slow success. Nothing crashes, but throughput drops enough to waste expensive GPU time.",
      "Fallback often points to configuration mistakes, transport selection problems, or hidden fabric issues that users only notice as 'training feels slow.'",
      "The operator lesson is that availability is not the same as health. A running job can still be operationally wrong."
    ],
    wholePlatform: [
      "From the platform view, NCCL fallback means the scheduler, nodes, and network may all look normal while the workload still misses the fast path the cluster was built for.",
      "That makes fallback a platform-efficiency problem, not just a library detail. One bad path choice can reduce the effective value of a whole multi-node job or rack.",
      "So this lab matters because it teaches how users experience hidden infrastructure mistakes: not always as crashes, but often as very expensive slowness."
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
        term: "Fabric",
        plain: "The network that connects the nodes into one cluster — the switches, cables, and adapters acting as a single system.",
        why: "When people say 'the fabric is degraded,' they mean the cluster's internal highway system, not one server."
      },
      { term: "Fallback", plain: "A backup path used when the preferred fast path is unavailable or misconfigured.", why: "Fallback keeps jobs alive but can hide the real problem if nobody checks throughput." },
      { term: "TCP", plain: "A general-purpose network transport that is usually much slower for distributed GPU training than RDMA-based paths.", why: "Seeing TCP where you expected InfiniBand is a major clue." },
      { term: "NCCL_IB_DISABLE", plain: "An environment variable that can force NCCL not to use InfiniBand.", why: "It is a common misconfiguration with a large performance impact." },
      { term: "NCCL_IB_HCA", plain: "An environment variable that tells NCCL which host-channel adapter to use for InfiniBand traffic.", why: "A wrong HCA name can quietly force the job onto a slower path." }
    ],
    commonMisreads: [
      "If the job is still running, the communication path must be good enough. That is false. Fallback often means the workload is wasting time on a much slower route.",
      "A fallback must mean broken hardware. That is often false because one bad environment variable or path-selection mistake can cause it.",
      "NCCL logs are too low-level to matter. That is false. They are often the first place the hidden path problem becomes visible."
    ],
    safeActions: [
      "Check environment variables before changing hardware or drivers.",
      "Use the screenshot sequence to compare slow fallback, configuration cause, verified fast path, and recovered bandwidth as one story.",
      "Confirm the network path NCCL actually selected.",
      "Compare observed bandwidth with the cluster's expected healthy range."
    ]
  },
  storage: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "A storage bottleneck happens when the data path feeding the GPUs is slower than the GPUs' ability to process that data. We are figuring out whether the GPUs are being starved by that upstream path instead of by their own compute limits. The beginner goal is to stop blaming the most visible component first and to learn how to trace starvation upstream.",
    plainPicture: "Picture the GPU as a chef who can cook very fast, but ingredients arrive from the pantry one small box at a time. The chef looks idle between boxes even though the kitchen is powerful. That is what a storage bottleneck looks like. The sawtooth GPU graph is the chef cooking quickly, then waiting, then cooking again. The real fix may be in the pantry route: storage striping, read throughput, or DataLoader workers. This lab teaches you to follow the ingredient path before blaming the chef.",
    whyOperatorsCare: [
      "This is one of the best beginner lessons in whole-system reasoning because the most visible symptom appears on the accelerator while the actual bottleneck sits elsewhere.",
      "Expensive GPUs lose value quickly when they spend time waiting on datasets, loaders, or shared storage paths instead of computing.",
      "The operator skill here is learning to ask which stage is starving which other stage instead of blaming the most visible component first."
    ],
    wholePlatform: [
      "Across the platform, storage performance is part of the same user experience as GPU speed and network speed. A fast rack still feels slow if the data path cannot feed it.",
      "That means this lab is not just about one dataset. Shared storage design, striping policy, loader settings, and job concurrency all shape how much useful work the cluster can actually deliver.",
      "So this matters because storage bottlenecks can waste cluster-wide capacity even when the GPUs, drivers, and network all look healthy on their own."
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
        term: "Bandwidth",
        plain: "How much data a link can move per second (GB/s). Think highway width: more lanes, more simultaneous traffic.",
        why: "Bandwidth numbers are how you compare NVLink, PCIe, InfiniBand, and storage paths."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      { term: "Sawtooth utilization", plain: "A repeated pattern where GPU utilization spikes and then falls because data arrives in bursts.", why: "It is a classic sign of an input pipeline problem." },
      { term: "Stripe count", plain: "How many storage targets a file or directory spreads data across.", why: "Low stripe count can limit read bandwidth." },
      { term: "DataLoader", plain: "The part of a training pipeline that feeds data batches to the GPU workload.", why: "Storage issues often appear through the DataLoader first." },
      { term: "I/O bottleneck", plain: "A point where storage throughput or latency limits the whole workload.", why: "This is the key operational story behind a storage-bound training job." }
    ],
    commonMisreads: [
      "Low GPU utilization must mean the GPU is faulty or weak. That is false when the accelerator is mostly waiting for data.",
      "If storage is the issue, the symptom should appear only on storage dashboards. That is false. The user often notices it first as bursty or disappointing GPU behavior.",
      "One fix in the storage layer should solve everything. That is often false because storage layout and loader settings can each contribute to the same starvation pattern."
    ],
    safeActions: [
      "Look at storage counters at the same time as GPU utilization.",
      "Use the screenshot sequence to keep the causal chain clear: symptom, I/O evidence, layout issue, fix, feeder tuning, verification.",
      "Treat low GPU utilization as a symptom, not always the root cause.",
      "Change one bottleneck-control knob at a time, such as stripe count or worker count."
    ]
  },
  gds: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "GPUDirect Storage (GDS) can shorten the storage-to-GPU path, but only after the right driver and filesystem pieces are enabled. The beginner goal is to compare the traditional and direct paths, identify what has to be enabled for GDS, verify the cuFile software path, and only then trust the benchmark result.",
    plainPicture: "Picture training data as boxes moving from storage to the GPU. In the traditional route, the boxes stop in CPU memory first and the CPU helps move them along. With GDS, the goal is to remove that extra bounce-buffer handling so storage can DMA data more directly toward GPU memory. That does not happen automatically just because NVIDIA GPUs are present. The driver stack, cuFile runtime, supported filesystem path, and workload all have to line up before the direct path is real. This lab first compares the two routes, then checks the enablement pieces, and finally measures whether the shorter route actually helped.",
    whyOperatorsCare: [
      "This lab teaches that performance is often about path design, not just raw device speed. A faster route can matter as much as a faster component.",
      "GDS can reduce CPU overhead and improve data movement for storage-heavy workloads when the environment really supports it.",
      "The operator lesson is that optimizations only count if the direct path is real, measurable, and stable under workload."
    ],
    wholePlatform: [
      "At the platform level, GDS is about how storage, drivers, and GPUs cooperate as one data path. A good rack is not only fast at compute; it is also efficient at moving data to where compute happens.",
      "That means GDS sits at the intersection of storage design, driver capability, and workload shape. If one of those pieces is missing, the fancy direct path is mostly marketing, not production value.",
      "So this lab matters because it teaches how infrastructure design choices change the real path users depend on, not just the names of the technologies involved."
    ],
    coreTerms: [
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      {
        term: "CPU",
        plain: "Central processing unit — the computer's general-purpose brain: a few fast, flexible cores good at one complicated task at a time. The opposite of a GPU, which uses thousands of simple cores for massive parallel work.",
        why: "Knowing which work belongs on the CPU and which belongs on the GPU explains most performance conversations."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      { term: "GPUDirect Storage", plain: "A technology that can let storage DMA data to or from GPU memory without the usual CPU bounce buffer.", why: "It can reduce CPU overhead and improve throughput when the stack really supports it." },
      { term: "DMA", plain: "Direct Memory Access, a hardware-assisted way to move data without constant CPU handling.", why: "It is the mechanism that makes direct paths efficient." },
      { term: "cuFile", plain: "The software interface commonly used for GPUDirect Storage operations.", why: "Its presence is a practical sign that the GDS software path is available in the environment." },
      { term: "Data path", plain: "The route data takes from storage to the GPU.", why: "GDS only makes sense if beginners can picture the path it is shortening." }
    ],
    commonMisreads: [
      "If the cluster uses NVIDIA GPUs, GDS must already be active. That is false. The direct path has to be verified, not assumed.",
      "A GDS feature check alone proves user benefit. That is false. Operators care whether throughput and CPU overhead actually improve.",
      "A faster benchmark always means GDS was the reason. That is false unless the before-and-after path comparison is controlled."
    ],
    safeActions: [
      "Verify the feature exists before benchmarking it.",
      "Enable GDS deliberately: the `nvidia-fs` and cuFile stack must be present and the storage path must be one the platform supports.",
      "Use the screenshot sequence to keep design, verification, and benchmark evidence separate.",
      "Compare the old path and new path with the same workload.",
      "Treat GDS as an optimization, not a default assumption."
    ]
  },
  monitoring: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are turning GPU health from something you check manually into something the platform watches continuously. The beginner goal is to understand the full monitoring path from metric source to alert, not just the dashboard at the end.",
    plainPicture: "Picture monitoring as a dashboard of sensors on a GPU cluster: temperature gauges, error counters, utilization meters, and network signs. DCGM Exporter is like the sensor box that exposes GPU readings. Prometheus is the collector that keeps asking for those readings over time. Grafana is the wall display where humans see the trend. Alerts are the rules that ring before users have to complain. This lab shows the full path from sensor, to collector, to dashboard, to action.",
    whyOperatorsCare: [
      "Monitoring is where operators stop relying on luck and start seeing trends like rising ECC, thermal drift, or missing telemetry before jobs fail visibly.",
      "Dashboards and alerts shorten the time between a problem starting and someone responding to it.",
      "The operator lesson is that metrics are only useful when they help explain what is changing and what action should follow."
    ],
    wholePlatform: [
      "Across the platform, monitoring connects GPUs, nodes, dashboards, and alerting systems into one operational feedback loop. It is how a rack becomes observable instead of mysterious.",
      "That means monitoring is not just a support tool. It affects incident response, capacity planning, and whether teams learn about problems from telemetry or from angry users.",
      "So this lab matters because a platform without good monitoring may still run, but it becomes much harder to trust or operate safely at scale."
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
        term: "DBE",
        plain: "Double-bit error — memory corruption too large for ECC to repair. The data is lost, so the work using it must stop.",
        why: "A DBE is a stop-now event, unlike single-bit errors which are corrected warnings."
      },
      {
        term: "Container",
        plain: "A packaged piece of software bundled with all its dependencies, so it runs identically on any node.",
        why: "AI stacks ship as containers because matching CUDA/driver/framework versions by hand is error-prone."
      },
      { term: "DCGM", plain: "Data Center GPU Manager, NVIDIA's management and monitoring toolkit for GPUs.", why: "Many GPU health dashboards and exporters are built on it." },
      { term: "Exporter", plain: "A service that exposes metrics in a format another system can scrape.", why: "It is how GPU signals reach Prometheus." },
      { term: "Prometheus", plain: "A monitoring system that collects and queries time-series metrics.", why: "It is often the first place operators see cluster health trends." },
      { term: "Alert rule", plain: "A condition that turns a metric pattern into a notification or page.", why: "This is where visibility becomes operational action." }
    ],
    commonMisreads: [
      "Monitoring means putting every number on a dashboard. That is false. Operators care about the signals that change decisions.",
      "If no alert fired, the platform must be healthy. That is false when telemetry itself is missing or badly designed.",
      "A graph is enough on its own. That is false unless the team also knows what action should follow when the graph changes."
    ],
    safeActions: [
      "Know which signals are health indicators and which are just workload indicators.",
      "Use the screenshot sequence to keep the monitoring chain clear: source, metrics, scrape, dashboard, rule, test.",
      "Create alerts for trend-based failures, not only binary outages.",
      "Use dashboards to compare before and after, not just to stare at a single value."
    ]
  },
  slurm: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how the scheduler decides when jobs run, why they wait, and how operators keep bad nodes from receiving fresh work. The beginner goal is to stop treating every delay like failure and to learn when waiting is normal, when policy is doing its job, and when containment is the right move.",
    plainPicture: "Picture Slurm as the dispatch desk for a shared GPU lab. Users submit jobs like requests for rooms and equipment. Slurm checks who is waiting, what resources are free, what priority each user has, and which nodes are safe to use. A job waiting in the queue is not automatically broken; it may be waiting because someone else is using the GPUs, because fairshare lowered its priority, or because an operator drained a node for safety. This lab teaches you to read the dispatch reason before touching the machines.",
    whyOperatorsCare: [
      "Slurm is where operators separate user frustration from actual system failure. A waiting job and a broken cluster can look similar from far away, but they are not the same incident.",
      "Scheduler state controls safety as well as fairness. Draining a node is often the cleanest way to contain hardware trouble without shutting down the whole cluster.",
      "The operator lesson is that queueing, policy, and containment are part of normal operations, not just signs of trouble."
    ],
    wholePlatform: [
      "At the platform level, Slurm sits between users and hardware. It translates resource requests, policy, and node state into the actual job flow across the cluster.",
      "That means scheduler behavior shapes the user experience just as much as GPU performance does. A healthy cluster can still make jobs wait, while a damaged cluster can be kept safe by good scheduler control.",
      "So this lab matters because it teaches how policy, fairness, and node containment affect real workload flow across the whole system."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      { term: "Scheduler", plain: "The system that decides when jobs start and where they run.", why: "It explains why a healthy cluster can still make you wait." },
      { term: "Fairshare", plain: "A policy signal showing how a user's recent resource usage affects new job priority.", why: "It helps explain queue behavior without blaming hardware." },
      { term: "Drain", plain: "A scheduler state that stops new jobs from landing on a node.", why: "It is a safe containment tool during incidents." },
      { term: "Pending reason", plain: "The scheduler's explanation for why a job is waiting instead of running.", why: "This is often the first clue that the delay is policy, not failure." }
    ],
    commonMisreads: [
      "If my job is pending, the cluster must be broken. That is false. Pending often reflects healthy scheduling policy or temporary resource pressure.",
      "Drain means the node is dead forever. That is false. Drain is usually a containment step, not a permanent verdict.",
      "Fairshare is just paperwork. That is false. It directly changes who runs next and explains many queue behaviors."
    ],
    safeActions: [
      "Check why a job is pending before changing cluster state.",
      "Use the screenshot sequence to keep the scheduler story clear: submitted, queued, explained, policy-affected, contained, resumed.",
      "Use drain as a protective step during hardware incidents.",
      "Record policy-driven delays differently from hardware failures."
    ]
  },
  k8s: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how Kubernetes turns a GPU request in a pod spec into a real running workload on a node. The beginner goal is to stop treating every stuck pod like a dead GPU and to learn where the translation can fail: operator, resource advertisement, scheduling, policy, or coordinated startup.",
    plainPicture: "Picture Kubernetes as a warehouse manager placing boxes, called pods, onto shelves, called nodes. GPUs are special shelves that must be advertised correctly before workloads can use them. The NVIDIA GPU Operator helps install and manage the pieces that make those shelves visible. A Pending pod is the manager saying, 'I cannot place this box yet.' That might mean no GPU shelf is free, the request is too large, policy blocks it, or the whole distributed group must start together. This lab follows the placement story before blaming the GPU hardware.",
    whyOperatorsCare: [
      "Kubernetes introduces another control layer between the user and the node, which means incidents can live in the request, the scheduler, the operator, or the node runtime.",
      "GPU availability in Kubernetes depends on both infrastructure health and correct resource advertisement through the control plane.",
      "The operator lesson is that orchestration issues often feel like hardware issues until you separate where the translation failed."
    ],
    wholePlatform: [
      "Across the platform, Kubernetes is the system that turns cluster hardware into a shared service. It connects users, control-plane policy, node software, and accelerator runtime into one delivery path.",
      "That means a GPU problem in Kubernetes may really be a scheduling problem, an operator problem, or a node advertisement problem. The whole platform has to agree before the workload can run.",
      "So this lab matters because it teaches how modern GPU platforms fail by translation and coordination, not only by hardware faults."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      { term: "GPU Operator", plain: "A Kubernetes-managed package that helps install and manage NVIDIA GPU software components on cluster nodes.", why: "It automates many cluster-side GPU dependencies." },
      { term: "Extended resource", plain: "A schedulable resource type like nvidia.com/gpu that Kubernetes tracks in integer quantities.", why: "It explains why GPU requests and availability behave differently from CPU and memory." },
      { term: "Gang scheduling", plain: "A scheduling approach that waits until all pods in a distributed job can start together.", why: "It prevents partially started training jobs from hanging." },
      { term: "Pending", plain: "A pod state meaning the workload has been accepted but not yet placed and started successfully.", why: "This is where beginners often misread orchestration delay as hardware failure." }
    ],
    commonMisreads: [
      "If the pod is pending, the physical GPU must be broken. That is false. Pending often starts as a scheduling or advertisement problem.",
      "The pod spec is the only place to debug. That is false when the operator or node resource view is wrong.",
      "If one pod started, a distributed job is healthy. That is false when the workload really needs all pods to start together."
    ],
    safeActions: [
      "Read the scheduling reason before changing nodes or workloads.",
      "Use the screenshot sequence to keep the control-plane order clear: operator, resource view, pending reason, policy, containment, coordinated placement.",
      "Check both operator health and node resource advertisement.",
      "Use gang scheduling for tightly coupled distributed jobs."
    ]
  },
  ai_concepts: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are separating three exam terms that beginners constantly blur — AI, machine learning, and deep learning — and then proving with a benchmark why deep learning runs on GPUs instead of CPUs. The goal is to classify a technique correctly and to explain the GPU-versus-CPU choice as an architecture trade-off, not a hardware defect.",
    plainPicture: "Picture three nested rings. The outer ring is AI: any system that acts intelligently. Inside it is machine learning: systems that learn patterns from data. Inside that is deep learning: many-layer neural networks. Now picture the same heavy matrix-multiply job run twice, once on a CPU and once on a GPU. The CPU is a few very strong workers who are great at complicated one-off tasks. The GPU is thousands of simple workers who all do the same small multiply at once. Deep learning is mostly the same small multiply repeated billions of times, which is why the crowd of simple workers wins.",
    whyOperatorsCare: [
      "Domain 1 is the largest slice of the exam, and much of it is classification: given a described technique, is it AI, ML, or DL, and does it need a GPU?",
      "Operators are often asked why a workload needs expensive GPUs. The honest answer is workload shape, and being able to explain that builds credibility.",
      "The most common wrong answer on GPU-versus-CPU questions is 'the CPU is broken.' Learning the trade-off framing keeps you from picking it."
    ],
    wholePlatform: [
      "This lab is the vocabulary floor for the whole platform. Every later infrastructure and operations decision assumes you know why AI workloads are GPU-heavy.",
      "If you cannot place a workload in the AI/ML/DL hierarchy, you cannot reason about whether it belongs on a GPU cluster at all.",
      "The CPU-versus-GPU trade-off reappears in sizing, scheduling, and virtualization, so getting it right here pays off across the rest of the labs.",
      "Factors driving AI adoption (exam-relevant theory): more data, cheaper accelerated compute, better algorithms and transformer models, mature frameworks and pretrained models, and cloud access. These reinforce each other, which is why adoption accelerated.",
      "Key use cases and industries (theory): generative AI and chat assistants, computer vision, recommender systems, and speech; applied in healthcare (medical imaging, drug discovery), finance (fraud detection), retail (recommendations), manufacturing and robotics, and autonomous vehicles."
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
        term: "Bandwidth",
        plain: "How much data a link can move per second (GB/s). Think highway width: more lanes, more simultaneous traffic.",
        why: "Bandwidth numbers are how you compare NVLink, PCIe, InfiniBand, and storage paths."
      },
      { term: "AI", plain: "Any system that mimics human-like reasoning or decisions.", why: "It is the broad outer category that contains ML and DL." },
      { term: "Machine learning", plain: "Systems that learn patterns from data instead of following fixed rules.", why: "It is the data-driven subset of AI." },
      { term: "Deep learning", plain: "Multi-layer neural networks that learn features automatically.", why: "It is the GPU-hungry subset of ML behind modern GenAI." },
      { term: "Throughput vs latency", plain: "Throughput is total work per second; latency is time for one task.", why: "GPUs optimize throughput, CPUs optimize latency, which explains the benchmark." },
      { term: "SIMT", plain: "Single Instruction, Multiple Threads — many cores run the same instruction on different data.", why: "It is why GPUs excel at the repeated matrix math in deep learning." }
    ],
    commonMisreads: [
      "AI, ML, and DL are three separate technologies. That is false. They are nested: all DL is ML, and all ML is AI.",
      "A GPU is always faster than a CPU. That is false. It is faster for parallel throughput work, not for every task.",
      "A CPU that loses a matmul benchmark is defective. That is false. It is optimized for a different kind of work."
    ],
    safeActions: [
      "Classify a described technique into AI, ML, or DL before answering.",
      "Capture the CPU baseline before claiming any GPU speedup.",
      "Explain the GPU win as parallelism and Tensor Cores, not hardware superiority.",
      "Reject answer choices that call a design trade-off a defect."
    ]
  },
  inference: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are contrasting how a training job and an inference service use hardware, then deploying a model with Triton and tuning it for a latency target. The goal is to explain why training and inference have different architecture requirements and to make a batch-size decision that respects a latency SLA.",
    plainPicture: "Picture training as a factory running flat out: big batches, lots of memory for gradients and optimizer state, and the machines pinned near 100 percent for hours. Now picture inference as a restaurant kitchen: orders arrive one at a time, and what matters is how fast each plate comes out. Batching orders together makes the kitchen more efficient, but every diner waits a little longer. The skill is choosing the biggest batch that still gets each plate out before the customer's patience — the latency SLA — runs out.",
    whyOperatorsCare: [
      "The exam repeatedly asks you to compare training and inference architecture requirements, and operators must size and serve each differently.",
      "Inference is judged by latency under load, so an operator who only watches throughput will ship an endpoint that violates its SLA.",
      "Serving stacks like Triton, NIM, and TensorRT are core NVIDIA solutions, and knowing which stage each one owns is a Domain 1 objective."
    ],
    wholePlatform: [
      "Training and inference are two ends of the AI lifecycle, and the platform must support both: high-memory, high-throughput training and latency-bound serving.",
      "Inference optimization with TensorRT and serving with Triton/NIM is how a trained model becomes a product, which is why these show up across NVIDIA's portfolio.",
      "The latency-versus-throughput trade-off shapes how many GPUs a serving tier needs, tying this lab back to infrastructure planning."
    ],
    coreTerms: [
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
        term: "Latency",
        plain: "How long one single request takes from arrival to answer. The opposite concern from throughput, which is total volume per second.",
        why: "Inference serving lives and dies by latency; training barely notices it."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "SM",
        plain: "Streaming multiprocessor — one of the dozens of compute blocks inside a GPU. 'GPU utilization' is really a statement about how many SMs are busy.",
        why: "Low SM occupancy with high memory use means the GPU is waiting, not working."
      },
      { term: "Training", plain: "Learning model weights via forward and backward passes over data.", why: "It is throughput-first and memory-heavy, which drives cluster sizing." },
      { term: "Inference", plain: "Using a trained model to answer requests with only a forward pass.", why: "It is latency-sensitive and request-driven, unlike training." },
      { term: "Triton / NIM", plain: "NVIDIA's inference server and packaged inference microservices.", why: "They turn an optimized model into a scalable endpoint." },
      { term: "TensorRT", plain: "NVIDIA's inference optimizer that fuses layers and lowers precision.", why: "It reduces latency and cost, but precision must be validated." },
      { term: "Dynamic batching", plain: "Grouping incoming requests so the GPU processes them together.", why: "It raises throughput but also raises per-request latency." }
    ],
    commonMisreads: [
      "Training and inference stress hardware the same way. That is false. Training holds far more state and runs the backward pass.",
      "Maximizing throughput is always the goal. That is false for inference, where an SLA-violating config is a failure.",
      "Lower precision is always free. That is false. Aggressive quantization can hurt accuracy without calibration."
    ],
    safeActions: [
      "Capture the training profile (sustained utilization, high memory) before comparing to inference.",
      "Confirm a serving endpoint is healthy before sending production traffic.",
      "Choose the largest batch size that still meets the latency SLA.",
      "Validate accuracy after any quantization, not just speed."
    ]
  },
  nvidia_stack: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are inventorying the NVIDIA AI software stack from the driver up and mapping the higher-level NVIDIA solutions to the AI lifecycle stages they own. The goal is to describe what each layer provides and to pick the right NVIDIA product for a described use case.",
    plainPicture: "Picture the stack as a building. The foundation is the GPU and its driver. On top sits CUDA, the framing that lets software talk to the GPU. Above that are the CUDA-X libraries — cuDNN, cuBLAS, NCCL, TensorRT — the pre-built machinery frameworks rely on. Higher still are the finished rooms: NeMo for building models, Triton and NIM for serving them, RAPIDS for data prep, Base Command and AI Enterprise for managing and supporting the whole building. Each floor depends on the one beneath it.",
    whyOperatorsCare: [
      "Domain 1 asks operators to describe the NVIDIA software stack and the purpose of various NVIDIA solutions, so naming the layers is directly testable.",
      "When a framework is unexpectedly slow, a missing or mismatched CUDA-X library is a prime suspect, so knowing the layers speeds diagnosis.",
      "Choosing the right solution — build versus serve versus data prep versus manage — is a decision operators help make, and mixing them up wastes effort."
    ],
    wholePlatform: [
      "The stack is how raw GPU capacity becomes usable AI compute; every workload rides on these layers.",
      "NGC ships these layers pre-validated as containers, which is why validated images reduce so many environment problems.",
      "The lifecycle mapping (data prep, train, optimize, deploy, monitor) ties the software portfolio to the operational reality of running AI in production."
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
        term: "Inference",
        plain: "Using an already-trained model to answer live requests. The opposite of training: short bursts, latency-sensitive, often many small jobs instead of one big one.",
        why: "Operations teams usually run far more inference than training."
      },
      {
        term: "Container",
        plain: "A packaged piece of software bundled with all its dependencies, so it runs identically on any node.",
        why: "AI stacks ship as containers because matching CUDA/driver/framework versions by hand is error-prone."
      },
      {
        term: "NGC",
        plain: "NVIDIA GPU Cloud — NVIDIA's catalog of pre-built, tested containers, models, and charts.",
        why: "Pulling from NGC is how you get a known-good, version-matched AI software stack."
      },
      {
        term: "DGX",
        plain: "NVIDIA's integrated GPU server — for example 8 GPUs, NVLink, and networking pre-assembled and validated as one system. The standard building block AI clusters are sized around.",
        why: "Power, cooling, and scaling plans are usually expressed in DGX-node units."
      },
      {
        term: "Triton",
        plain: "NVIDIA's inference server — one service that loads trained models and serves them over the network with batching and scaling built in.",
        why: "It is the standard answer to 'how do we put this model in production?'"
      },
      {
        term: "cuDNN",
        plain: "A CUDA-X library of deep-learning building blocks (convolutions, attention) that frameworks like PyTorch call under the hood.",
        why: "Frameworks get their GPU speed from libraries like cuDNN, not from magic."
      },
      {
        term: "DCGM",
        plain: "Data Center GPU Manager — NVIDIA's monitoring service that exposes GPU health and telemetry counters.",
        why: "It is the standard source of GPU metrics in production clusters."
      },
      {
        term: "Prometheus",
        plain: "A metrics database that scrapes numbers from services on a schedule and stores them as time series you can graph and alert on.",
        why: "GPU telemetry usually flows DCGM → exporter → Prometheus → dashboards."
      },
      { term: "CUDA-X", plain: "The family of NVIDIA acceleration libraries built on CUDA, such as cuDNN, cuBLAS, NCCL, and TensorRT.", why: "These are the engines frameworks call to run fast." },
      { term: "NeMo", plain: "NVIDIA's framework for building and customizing LLMs and generative models.", why: "It owns the model-building stage of the lifecycle." },
      { term: "NIM", plain: "NVIDIA Inference Microservices — packaged, ready-to-run model endpoints.", why: "It owns the deploy stage alongside Triton." },
      { term: "RAPIDS", plain: "GPU-accelerated data science libraries (cuDF, cuML).", why: "It owns the data-preparation stage." },
      { term: "AI Enterprise", plain: "NVIDIA's supported software suite spanning the stack.", why: "It provides management and enterprise support for production." }
    ],
    commonMisreads: [
      "CUDA is a single thing. That is false. CUDA is the platform, and CUDA-X is the family of libraries built on it.",
      "NeMo, NIM, and Triton are interchangeable. That is false. NeMo builds models; NIM and Triton serve them.",
      "The lifecycle is just train then deploy. That is false. Data prep, optimization, and monitoring are first-class stages."
    ],
    safeActions: [
      "Name each stack layer from driver to framework before reasoning about a problem.",
      "Confirm CUDA-X libraries are present and version-matched when a framework is slow.",
      "Pair each NVIDIA solution with the one lifecycle stage it owns.",
      "Watch for scenarios that skip data prep or monitoring."
    ]
  },
  infra_planning: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are turning a training workload into concrete infrastructure: how many GPUs, how much power, how much cooling, and how to scale it in balanced units. The goal is to reason from workload requirements to a data center design that is neither starved nor unbuildable.",
    plainPicture: "Picture planning a kitchen for a restaurant. First you size the equipment to the menu — a big menu needs more stoves. Then you check the electrical panel: each stove draws power, and the panel has a limit. Then you check ventilation: every watt of cooking becomes heat that must leave the room. Finally you plan to grow in whole stations, not random stoves, so the wiring and venting stay balanced. GPU clusters work the same way: size to the workload, budget the power, plan the cooling, and scale in validated units.",
    whyOperatorsCare: [
      "Domain 2 is the largest infrastructure slice, and it asks directly about hardware sizing, power and cooling, facility needs, and scaling.",
      "GPU racks are power-dense, so operators who plan by rack units instead of kilowatts will overfill a rack the facility cannot power or cool.",
      "Scaling in unbalanced ways — adding GPUs without matching fabric, power, and cooling — creates the exact bottlenecks and thermal faults operators later have to firefight."
    ],
    wholePlatform: [
      "Infrastructure planning is where the workload meets the building; get it wrong and no amount of software tuning helps.",
      "Power and cooling are the real ceilings on GPU density, which is why liquid cooling and high-capacity power feeds appear in AI data centers.",
      "Reference architectures like DGX SuperPOD exist so compute, network, power, and cooling scale together in validated units instead of ad hoc."
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
        term: "CPU",
        plain: "Central processing unit — the computer's general-purpose brain: a few fast, flexible cores good at one complicated task at a time. The opposite of a GPU, which uses thousands of simple cores for massive parallel work.",
        why: "Knowing which work belongs on the CPU and which belongs on the GPU explains most performance conversations."
      },
      {
        term: "NIC",
        plain: "Network interface card — the hardware port that connects a server to the network.",
        why: "In AI clusters each node may carry several high-speed NICs, one per GPU pair or rail."
      },
      {
        term: "Throughput",
        plain: "How much total work finishes per second — images/s, tokens/s, GB/s. The opposite concern from latency, which is how long one single item takes.",
        why: "GPUs and training pipelines are judged on throughput; user-facing requests are judged on latency."
      },
      {
        term: "DGX",
        plain: "NVIDIA's integrated GPU server — for example 8 GPUs, NVLink, and networking pre-assembled and validated as one system. The standard building block AI clusters are sized around.",
        why: "Power, cooling, and scaling plans are usually expressed in DGX-node units."
      },
      {
        term: "Training",
        plain: "The learning phase — the model repeatedly sees data and adjusts its internal weights. Long-running GPU work judged by throughput, meaning how much work finishes per second. The opposite end of the lifecycle from inference, which uses the finished model.",
        why: "Training jobs are the workloads most of this cluster's design exists to serve."
      },
      { term: "Sizing", plain: "Choosing GPU type and count from a workload's memory and throughput needs.", why: "It prevents both starvation and wasteful over-provisioning." },
      { term: "Power budget", plain: "The kilowatts a rack or feed can supply versus what the nodes draw.", why: "It usually limits GPU density before floor space does." },
      { term: "Cooling envelope", plain: "The heat a cooling method can remove at a given rack density.", why: "Air cooling caps out; liquid cooling unlocks dense GPU racks." },
      { term: "Scalable unit", plain: "A validated building block of nodes plus fabric used to grow a cluster.", why: "It keeps compute, network, and facility in balance as you scale." },
      { term: "Facility requirements", plain: "Power distribution, cooling, weight, and space a data center must provide.", why: "They gate whether a design can actually be deployed." }
    ],
    commonMisreads: [
      "Pick the GPU count first. That is false. Workload memory and throughput should drive the hardware.",
      "Fill a rack to its physical capacity. That is false. GPU nodes usually run out of power before space.",
      "Cooling can be planned after power. That is false. Every watt drawn is a watt of heat to remove."
    ],
    safeActions: [
      "Estimate the workload's memory footprint before choosing GPUs.",
      "Budget the rack in kilowatts and compare against the power feed.",
      "Match the cooling method (air vs liquid) to the rack's power density.",
      "Scale in balanced units so fabric and facility grow with the GPUs."
    ]
  },
  dpu_cloud: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are diagnosing host CPU saturated by infrastructure work, offloading that work to a BlueField DPU, and then deciding between cloud and on-premises deployment. The goal is to explain the purpose and benefits of a DPU and to frame the cloud-versus-on-prem choice as a utilization and control trade-off.",
    plainPicture: "Picture a chef (the CPU) who is supposed to cook (run the application) but keeps getting pulled away to answer the door, sign for deliveries, and check IDs (networking, storage, security). The food (GPU work) sits waiting. A DPU is like hiring a dedicated doorman on the NIC — its own little staff with its own hands — so the chef can just cook. Separately, deciding cloud versus on-prem is like renting a commercial kitchen by the hour versus building your own: renting wins for occasional use, owning wins when you cook every day.",
    whyOperatorsCare: [
      "Domain 2 asks operators to explain the purpose and benefits of a DPU and to weigh on-premises versus cloud infrastructure.",
      "When host CPU drowns in networking and storage overhead, operators who add GPUs instead of offloading are solving the wrong problem.",
      "The cloud-versus-on-prem decision is a recurring real choice, and the exam wants the utilization-driven reasoning, not a blanket 'cloud is cheaper.'"
    ],
    wholePlatform: [
      "A DPU is a third processor type beside CPU and GPU, and it changes how much host CPU is actually available to feed accelerators.",
      "Offloading networking, storage, and security to the DPU frees host cores and creates a security-isolation boundary independent of the host OS.",
      "The deployment-model decision shapes the whole platform: sustained utilization favors owned infrastructure, while variable demand favors rented capacity, and hybrid blends both."
    ],
    coreTerms: [
      {
        term: "NIC",
        plain: "Network interface card — the hardware port that connects a server to the network.",
        why: "In AI clusters each node may carry several high-speed NICs, one per GPU pair or rail."
      },
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      {
        term: "CPU",
        plain: "Central processing unit — the computer's general-purpose brain: a few fast, flexible cores good at one complicated task at a time. The opposite of a GPU, which uses thousands of simple cores for massive parallel work.",
        why: "Knowing which work belongs on the CPU and which belongs on the GPU explains most performance conversations."
      },
      {
        term: "TCO",
        plain: "Total cost of ownership — everything a system costs over its life: hardware, power, cooling, space, and people, not just the purchase price.",
        why: "Cloud-versus-on-prem decisions are TCO comparisons, not sticker-price comparisons."
      },
      { term: "DPU", plain: "Data processing unit — a programmable processor on the NIC with its own cores and OS.", why: "It offloads infrastructure work from the host CPU." },
      { term: "BlueField", plain: "NVIDIA's DPU line integrating a ConnectX NIC with Arm cores.", why: "It is the concrete DPU the exam references." },
      { term: "DOCA", plain: "NVIDIA's software framework for programming BlueField DPUs.", why: "It is how offload services are built and run on the DPU." },
      { term: "Offload", plain: "Moving networking, storage, or security services from host CPU to the DPU.", why: "It frees host cores and isolates the infrastructure domain." },
      { term: "On-prem vs cloud", plain: "Owning infrastructure versus renting capacity from a provider.", why: "Utilization and control drive which one wins." }
    ],
    commonMisreads: [
      "Idle GPUs mean a GPU fault. That is false when the host CPU is the bottleneck doing infrastructure work.",
      "A DPU is just a fast NIC. That is false. It is a programmable processor with its own OS and cores.",
      "Cloud or on-prem is always cheaper. That is false. It depends on utilization, data gravity, and control."
    ],
    safeActions: [
      "Check host CPU (sys and softirq) before blaming the GPU for idle time.",
      "Offload the saturating services to the DPU and re-measure host CPU.",
      "Describe DPU value as freed CPU plus security isolation, not just network speed.",
      "Frame cloud-versus-on-prem by sustained versus bursty utilization, and consider hybrid."
    ]
  },
  vgpu: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are exploring how to virtualize accelerated infrastructure by comparing vGPU, MIG, and time-slicing, and then diagnosing an oversubscription slowdown. The goal is to pick the right sharing model for a tenancy need and to recognize contention instead of blaming healthy hardware.",
    plainPicture: "Picture one big GPU that several tenants want to share. There are three ways to do it. MIG is like building permanent interior walls: each tenant gets a real, isolated room. vGPU is like a scheduled shared workshop where each tenant gets their own locked toolbox (framebuffer) but takes turns on the machines (time-shared compute), and you need a paid membership (license). Plain time-slicing is like letting everyone into one room at once with no walls and no schedule — cheap, but they get in each other's way. When too many people crowd in, everyone slows down, and that is contention, not a broken machine.",
    whyOperatorsCare: [
      "Domain 3 asks operators to identify key considerations for virtualizing accelerated infrastructure, and the sharing models differ sharply in isolation.",
      "Choosing time-slicing where isolation is required, or expecting vGPU to isolate compute like MIG, leads to noisy-neighbor incidents.",
      "Oversubscription slowdowns look like faults, and operators who reset healthy GPUs instead of fixing the sharing ratio waste time and cause outages."
    ],
    wholePlatform: [
      "Virtualization decides how one physical GPU is presented to many tenants, which affects fairness, isolation, and capacity across the platform.",
      "vGPU ties into licensing (AI Enterprise) and hypervisors, so it is an operations and procurement concern, not just a technical toggle.",
      "Knowing when to reach for MIG versus vGPU versus time-slicing connects this lab back to MIG partitioning and to multi-tenant scheduling."
    ],
    coreTerms: [
      {
        term: "GPU",
        plain: "Graphics processing unit — a chip with thousands of small cores that work on many pieces of data at the same time. The opposite of a CPU, which has a few fast cores that do one complicated thing at a time.",
        why: "Every lab here is ultimately about keeping these chips busy, healthy, and shared fairly."
      },
      { term: "vGPU", plain: "NVIDIA GPU virtualization that gives VMs a licensed slice of a GPU via mediated devices.", why: "It is the VM-oriented sharing model with fixed framebuffer." },
      { term: "MIG", plain: "Multi-Instance GPU — spatial hardware partitions of one GPU.", why: "It provides the strongest isolation, on bare metal." },
      { term: "Time-slicing", plain: "Interleaving multiple contexts on one GPU with no isolation.", why: "It oversubscribes for best-effort sharing like dev/test." },
      { term: "Mediated device", plain: "A software-created device (mdev) a hypervisor attaches to a VM.", why: "It is the mechanism behind vGPU." },
      { term: "Oversubscription", plain: "Putting more concurrent guests on shared compute than it can serve at full speed.", why: "It causes contention slowdowns that look like faults." }
    ],
    commonMisreads: [
      "All GPU sharing is the same. That is false. Isolation guarantees differ sharply across MIG, vGPU, and time-slicing.",
      "vGPU isolates compute like MIG. That is false. vGPU time-shares the compute engine across guests.",
      "A shared-guest slowdown is a hardware fault. That is false when it is contention from oversubscription."
    ],
    safeActions: [
      "Distinguish vGPU (for VMs, licensed) from MIG (bare-metal partitions).",
      "Rank MIG, vGPU, and time-slicing by isolation strength before choosing.",
      "Confirm hardware counters are clean before treating a slowdown as a fault.",
      "Reduce concurrent guests or move to MIG when tenants need real isolation."
    ]
  }
};
