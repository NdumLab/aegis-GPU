/**
 * LEARNING DATA CHUNK: platform_operations
 */

window.AEGIS_LEARNING_PARTS = window.AEGIS_LEARNING_PARTS || {};
window.AEGIS_LEARNING_PARTS.platform_operations = {
  nccl_fallback: {
    beginnerTemplate: "operator_story",
    hideModeNote: true,
    objectiveTitle: "What We're Doing",
    objectiveText: "We are learning how to recognize when NCCL silently drops onto a slower communication path. The beginner goal is to stop treating a running job as proof of a healthy job and to learn how to spot expensive slow success.",
    plainPicture: "NCCL fallback means distributed training is still alive, but it is no longer using the fast transport the platform was designed to provide. The job keeps moving, yet the rack delivers much less value than it should. That is why this lab now walks through the fallback screenshot, the environment screenshot, the healthy InfiniBand screenshot, the targeted HCA fix, the verified fast-path screenshot, and the recovered-bandwidth screenshot. Operators care about the before-and-after transport story, not just whether the process stayed up.",
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
    objectiveText: "We are figuring out whether the GPUs are being starved by the data path instead of by their own compute limits. The beginner goal is to stop blaming the most visible component first and to learn how to trace starvation upstream.",
    plainPicture: "A storage bottleneck means the GPUs are ready to work, but data is not arriving fast enough to keep them busy. The visible symptom shows up on the GPU, but the real limiting stage may live in storage layout or the input pipeline. That is why this lab now uses the sawtooth-GPU screenshot first, then the saturated-I/O screenshot, then the under-striped dataset screenshot, then the stripe fix, the loader-tuning step, and the smoother post-fix utilization screenshot. Operators follow the starvation trail instead of stopping at the first graph they see.",
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
    objectiveText: "We are comparing the normal storage-to-GPU path with a more direct one. The beginner goal is to understand the path change first, verify the feature second, and only then trust the benchmark result.",
    plainPicture: "GPUDirect Storage shortens the route data takes from storage to GPU memory. The point is not just that it sounds advanced, but that fewer copies and fewer CPU-managed steps can improve end-to-end throughput. That is why this lab now walks through the traditional-path screenshot, the direct-path screenshot, the feature-verification screenshot, the old-path benchmark, and the new-path benchmark. Operators do not celebrate the acronym. They prove the path exists and then measure whether it actually helped.",
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
      { term: "GPUDirect Storage", plain: "A technology that allows data to move more directly between storage and GPU memory.", why: "It can reduce CPU overhead and improve throughput." },
      { term: "DMA", plain: "Direct Memory Access, a hardware-assisted way to move data without constant CPU handling.", why: "It is the mechanism that makes direct paths efficient." },
      { term: "cufile", plain: "The software interface commonly used for GPUDirect Storage operations.", why: "It is a practical sign that the feature is available in the environment." },
      { term: "Data path", plain: "The route data takes from storage to the GPU.", why: "GDS only makes sense if beginners can picture the path it is shortening." }
    ],
    commonMisreads: [
      "If the cluster uses NVIDIA GPUs, GDS must already be active. That is false. The direct path has to be verified, not assumed.",
      "A GDS feature check alone proves user benefit. That is false. Operators care whether throughput and CPU overhead actually improve.",
      "A faster benchmark always means GDS was the reason. That is false unless the before-and-after path comparison is controlled."
    ],
    safeActions: [
      "Verify the feature exists before benchmarking it.",
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
    plainPicture: "Monitoring means the cluster keeps collecting health signals over time instead of waiting for a user to say something feels wrong. The value is not just seeing numbers, but turning patterns into earlier decisions. That is why this lab now walks through the exporter screenshot, the metrics-endpoint screenshot, the scrape-health screenshot, the dashboard view, the alert-rule screenshot, and the alert-test screenshot. Operators care about the full chain: source, collection, visibility, and action.",
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
    plainPicture: "Slurm decides when jobs start and where they land. A job can wait for healthy reasons such as policy or temporary pressure, or it can wait because a node is intentionally protected. That is why this lab now walks through the submit screenshot, the queue screenshot, the pending-reason screenshot, the fairshare screenshot, the drain screenshot, and the resume screenshot. Operators read the scheduler's own story before they touch cluster state.",
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
    plainPicture: "Kubernetes GPU operations are about making the control plane, the GPU operator, the node, and the workload all agree on what resources exist and how they should be started. A pod being stuck does not automatically mean the GPU itself is broken. That is why this lab now walks through the operator-health screenshot, the node-resource screenshot, the pending-pod screenshot, the network-policy screenshot, the node-drain screenshot, and the gang-scheduling screenshot. Operators follow the control-plane story before they blame hardware.",
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
  }
};
