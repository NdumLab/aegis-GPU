/**
 * LABS DATA CHUNK: operations_and_schedulers
 */

window.AEGIS_LABS_PARTS = window.AEGIS_LABS_PARTS || {};
window.AEGIS_LABS_PARTS.operations_and_schedulers = {
  gds: {
    name: "GPUDirect Storage",
    icon: "⚡",
    color: "#00d4d4",
    objective: "Bypass CPU for DMA.",
    steps: [
      {
        label:"Traditional Path",
        cmd:"# NVMe->CPU->GPU",
        type:"gds_old",
        explainerMode:"beginner_story",
        screenshotReference:"Use the traditional-path snapshot as the baseline route map. The key thing is seeing the extra CPU-mediated handoff that the optimized path later tries to remove.",
        screenshots:[
          {
            title:"Traditional storage path with CPU hop",
            caption:"This screenshot is the architectural baseline for the GDS lab. It shows the longer data route before any direct-path optimization is considered.",
            lines:[
              "NVMe read -> page cache / CPU memory",
              "CPU copies batch into pinned buffer",
              "CUDA transfer -> GPU memory"
            ]
          }
        ],
        whatsHappening:"You are starting from the normal storage path where data makes extra stops before it reaches GPU memory.",
        deeperContext:"This first step teaches the baseline mental model. Beginners need to understand the longer path before a 'direct' path has any meaning.",
        lookFor:[
          "A route where storage data passes through more software-managed handling",
          "Extra movement and copying before data reaches the GPU",
          "The baseline path you will compare against later"
        ],
        meaning:"This is the conventional path many systems use by default. It works, but it can involve more overhead than necessary for data-heavy workloads.",
        commonMistake:"Jumping straight to the optimized path without first understanding what extra work the traditional path is doing.",
        operatorTakeaway:"Operators need a clear baseline because optimizations only matter if they remove real overhead from a known starting path.",
        takeAction:[
          "Picture the longer route before reasoning about the shorter one.",
          "Treat this step as the baseline story for later comparison.",
          "Keep CPU involvement in mind as part of the path cost."
        ],
        avoid:[
          "Do not treat the default path as 'bad' just because a faster one may exist.",
          "Do not compare optimizations without a baseline."
        ]
      },
      {
        label:"GDS Path",
        cmd:"# NVMe->GPU DMA",
        type:"gds_new",
        explainerMode:"beginner_story",
        screenshotReference:"Use the GDS-path snapshot to understand what the optimization is trying to remove. The important thing is the shorter route with less CPU mediation, not the acronym by itself.",
        screenshots:[
          {
            title:"GPUDirect Storage path concept",
            caption:"This screenshot is the design comparison point for the GDS lab. It makes the architectural difference visible before runtime verification begins.",
            lines:[
              "NVMe read -> cuFile / DMA engine",
              "direct transfer -> GPU memory",
              "reduced CPU copy involvement"
            ]
          }
        ],
        whatsHappening:"You are looking at the shorter storage path where data can move more directly toward GPU memory.",
        deeperContext:"This step introduces the architectural idea behind GDS. The beginner lesson is that performance can improve when you remove unnecessary handoffs, not only when you buy faster devices.",
        lookFor:[
          "A route with fewer software-managed stops",
          "Less CPU involvement in moving data toward the GPU",
          "A path design that should reduce overhead if it is truly supported"
        ],
        meaning:"The direct path is meant to reduce extra handling so the system can move storage data more efficiently into GPU memory.",
        commonMistake:"Assuming the direct-looking diagram proves the feature is active in the real environment.",
        operatorTakeaway:"Operators distinguish between architecture intent and verified runtime reality. A shorter path on paper is only useful if the stack actually provides it.",
        takeAction:[
          "Use this step to understand what GDS is trying to improve.",
          "Compare it mentally against the traditional path you just reviewed.",
          "Prepare to verify the feature before trusting benchmark claims."
        ],
        avoid:[
          "Do not confuse a conceptual path with a proven runtime path.",
          "Do not assume the environment is already using GDS."
        ]
      },
      {
        label:"Verify GDS",
        cmd:"python3 -c \"import cufile\"",
        type:"gds_verify",
        explainerMode:"beginner_story",
        screenshotReference:"Use the verification snapshot as the gate before benchmarking. The key clue is the runtime actually exposing cuFile support instead of only having a direct-path diagram on paper.",
        screenshots:[
          {
            title:"GDS runtime support is present",
            caption:"This screenshot keeps the benchmark story honest. It proves the environment really exposes the software path needed for GPUDirect Storage.",
            lines:[
              ">>> import cufile",
              ">>> cufile.__version__",
              "'1.9.0'",
              "GPUDirect Storage runtime available"
            ]
          }
        ],
        whatsHappening:"You are checking whether the environment actually exposes the interface needed for GPUDirect Storage.",
        deeperContext:"This is the proof-of-availability step. Beginners should learn that an optimization is not real just because the hardware and marketing terms exist; the software path has to be present too.",
        lookFor:[
          "The expected interface appearing in the environment",
          "A sign that the runtime stack can actually support the direct path",
          "Whether the optimization is real enough to benchmark meaningfully"
        ],
        meaning:"This step tells you whether GDS is plausibly available, not just theoretically desirable.",
        commonMistake:"Running performance tests first and only later discovering the feature was never present in the environment.",
        operatorTakeaway:"Operators verify capability before they spend time interpreting performance results.",
        takeAction:[
          "Use feature verification as a gate before benchmarking.",
          "Treat missing support as a real finding, not a minor inconvenience.",
          "Keep software capability in the same story as hardware capability."
        ],
        avoid:[
          "Do not assume the direct path is active because the cluster uses NVIDIA components.",
          "Do not benchmark a feature that has not been verified."
        ]
      },
      {
        label:"Measure Trad",
        cmd:"# 890 MB/s",
        type:"gds_bench_old",
        explainerMode:"beginner_story",
        screenshotReference:"Use the traditional-path benchmark snapshot as the baseline throughput anchor. The important thing is that later gains only matter because this number exists first.",
        screenshots:[
          {
            title:"Traditional path throughput baseline",
            caption:"This screenshot is the before-case for the GDS benchmark story. It gives the optimized path something real to beat.",
            lines:[
              "traditional path throughput : 890 MB/s",
              "CPU utilization elevated during copy path"
            ]
          }
        ],
        whatsHappening:"You are measuring the baseline throughput of the traditional storage path.",
        deeperContext:"This benchmark gives the before case. The point is not the raw number alone, but what the old path delivers under the same workload you will use for the new path.",
        lookFor:[
          "The throughput of the non-GDS route",
          "A stable baseline for later comparison",
          "A result that reflects the longer path you mapped earlier"
        ],
        meaning:"This is the benchmark anchor for deciding whether the shorter path actually delivers better end-to-end movement.",
        commonMistake:"Treating the baseline as irrelevant once the optimized path exists. Without the baseline, you cannot prove the value of the change.",
        operatorTakeaway:"Operators need controlled before-and-after numbers, not just a faster-looking final result.",
        takeAction:[
          "Capture the baseline carefully so later gains mean something.",
          "Keep the workload identical for both comparisons.",
          "Use this step as the reference point for judging real benefit."
        ],
        avoid:[
          "Do not change the workload between before and after measurements.",
          "Do not dismiss the baseline as unimportant."
        ]
      },
      {
        label:"Measure GDS",
        cmd:"# 2.4 GB/s",
        type:"gds_bench_new",
        explainerMode:"beginner_story",
        screenshotReference:"Use the direct-path benchmark snapshot to judge whether the shorter route produced a meaningful real-world gain. The key thing is the before/after comparison, not just a bigger number alone.",
        screenshots:[
          {
            title:"GPUDirect Storage throughput gain",
            caption:"This screenshot closes the GDS loop by showing the optimized path delivering a materially stronger result than the traditional baseline.",
            lines:[
              "traditional path : 0.89 GB/s",
              "GDS path         : 2.4 GB/s",
              "observed gain    : 2.7x"
            ]
          }
        ],
        whatsHappening:"You are measuring the direct storage path to see whether the shorter route actually improves end-to-end throughput.",
        deeperContext:"This final step closes the loop from path design to runtime verification to workload impact. GDS only matters if the shorter path produces a meaningful, repeatable improvement.",
        lookFor:[
          "Higher throughput than the traditional-path baseline",
          "A result that matches the verified direct-path story",
          "Evidence that reduced path overhead translates into user-visible benefit"
        ],
        meaning:"If the direct path performs materially better, the optimization is real and valuable for this workload and environment.",
        commonMistake:"Assuming any higher number proves a universal truth about every workload instead of treating it as evidence for this specific path and test.",
        operatorTakeaway:"Operators judge optimizations by measured outcome, not by feature names alone.",
        takeAction:[
          "Compare the new number directly against the baseline.",
          "Tie the gain back to the verified direct path you established earlier.",
          "Capture the result as evidence of what the platform can really deliver."
        ],
        avoid:[
          "Do not celebrate the acronym without checking the outcome.",
          "Do not generalize one benchmark into a universal guarantee."
        ]
      }
    ],
    draw: drawGDS
  },
  monitoring: {
    name: "DCGM Monitoring",
    icon: "📊",
    color: "#76b900",
    objective: "Metrics at :9400.",
    steps: [
      {
        label:"Deploy Exporter",
        cmd:"docker run dcgm-exporter",
        type:"mon_deploy",
        explainerMode:"beginner_story",
        screenshotReference:"Use the exporter snapshot as the first monitoring health gate. The important thing is that the metric source is actually running, because every later graph and alert depends on this service.",
        screenshots:[
          {
            title:"DCGM exporter starts successfully",
            caption:"This screenshot is the source-of-truth step for monitoring. If the exporter is unhealthy, every downstream monitoring surface becomes untrustworthy.",
            lines:[
              "dcgm-exporter listening on :9400",
              "collecting NVIDIA GPU metrics",
              "exporter startup complete"
            ]
          }
        ],
        whatsHappening:"You are starting the service that exposes GPU health data so the rest of the monitoring stack can see it.",
        deeperContext:"This is the first observability step. Beginners should learn that metrics do not appear magically; something has to publish them in a form the platform can collect.",
        lookFor:[
          "A running exporter process",
          "A clear source for GPU metrics instead of manual spot checks",
          "The first link in the monitoring pipeline"
        ],
        meaning:"This step turns raw GPU state into data the platform can actually collect and reason about over time.",
        commonMistake:"Thinking monitoring begins at the dashboard. It actually begins where the metric leaves the node.",
        operatorTakeaway:"Operators care about the exporter because if the source is broken, every downstream graph and alert becomes untrustworthy.",
        takeAction:[
          "Treat exporter health as part of platform health.",
          "Use this step to establish where the metrics originate.",
          "Remember that good monitoring starts with reliable metric exposure."
        ],
        avoid:[
          "Do not skip source health and jump straight to dashboards.",
          "Do not assume monitoring exists just because software was installed."
        ]
      },
      {
        label:"Verify Metrics",
        cmd:"curl localhost:9400/metrics",
        type:"mon_verify",
        explainerMode:"beginner_story",
        screenshotReference:"Use the metrics-endpoint snapshot as proof that telemetry is not just running, but actually publishing data. The key thing is seeing real metric lines at the expected endpoint.",
        screenshots:[
          {
            title:"Exporter is serving usable metrics",
            caption:"This screenshot turns a running process into a verified telemetry source. It shows the monitoring pipeline has something real to scrape.",
            lines:[
              "# HELP DCGM_FI_DEV_GPU_TEMP GPU temperature",
              "DCGM_FI_DEV_GPU_TEMP{gpu=\"0\"} 39",
              "DCGM_FI_DEV_POWER_USAGE{gpu=\"0\"} 287"
            ]
          }
        ],
        whatsHappening:"You are checking that the exporter is actually serving readable metrics instead of only existing as a running process.",
        deeperContext:"This is the proof-of-telemetry step. Beginners need to see that a service being up is not enough; it must also expose the expected signals cleanly.",
        lookFor:[
          "Real metric output at the expected endpoint",
          "Health and performance signals you expect to see",
          "Evidence that the monitoring pipeline has usable data to collect"
        ],
        meaning:"This step confirms the exporter is not just running, but actually publishing metrics the rest of the system can scrape.",
        commonMistake:"Calling the setup done because the exporter container started, even if the endpoint is empty or wrong.",
        operatorTakeaway:"Operators verify the actual metric stream because missing or malformed telemetry is its own incident class.",
        takeAction:[
          "Use endpoint output as proof that telemetry is alive.",
          "Check that the metrics you care about are actually present.",
          "Treat missing signals as operationally meaningful."
        ],
        avoid:[
          "Do not stop at process status alone.",
          "Do not assume the right metrics exist without checking the endpoint."
        ]
      },
      {
        label:"Prom Scrape",
        cmd:"# Scraping config",
        type:"mon_prom",
        explainerMode:"beginner_story",
        screenshotReference:"Use the scrape snapshot to distinguish live endpoint visibility from historical observability. The key clue is Prometheus seeing the target as up and collecting samples over time.",
        screenshots:[
          {
            title:"Prometheus is scraping the exporter",
            caption:"This screenshot matters because it turns one-off visibility into durable time-series evidence. Without scraping, trends do not exist.",
            lines:[
              "Target: dcgm-exporter:9400",
              "State: UP",
              "Last scrape: 4.1s ago",
              "Scrape duration: 0.118s"
            ]
          }
        ],
        whatsHappening:"You are connecting Prometheus to the exporter so the metrics are collected over time instead of only viewed on demand.",
        deeperContext:"This is where one-off visibility becomes historical visibility. Beginners should learn that trends and comparisons require storage, not just a live endpoint.",
        lookFor:[
          "A scrape target that can reach the exporter",
          "Metrics being collected repeatedly over time",
          "The point where spot checks become time-series evidence"
        ],
        meaning:"This step turns one live metric view into a lasting operational record.",
        commonMistake:"Thinking the endpoint itself is enough. Without scraping and storage, you lose the trend information that makes monitoring useful.",
        operatorTakeaway:"Operators care about scrape health because without it, there is no trustworthy history to compare before and after states.",
        takeAction:[
          "Treat scrape configuration as part of the monitoring pipeline, not a separate detail.",
          "Use this step to connect raw telemetry to historical analysis.",
          "Verify that collection is continuous, not accidental."
        ],
        avoid:[
          "Do not confuse endpoint availability with historical observability.",
          "Do not assume trends will exist if nobody is collecting the metrics."
        ]
      },
      {
        label:"Grafana ID 12239",
        cmd:"# Import dashboard",
        type:"mon_grafana",
        explainerMode:"beginner_story",
        screenshotReference:"Use the dashboard snapshot to see whether the metrics tell an operator-friendly story. The important thing is recognizable health patterns, not a wall of decorative charts.",
        screenshots:[
          {
            title:"GPU health dashboard renders meaningful panels",
            caption:"This screenshot is about operator readability. It shows the metric history becoming a visual tool for faster incident recognition.",
            lines:[
              "Panel: GPU Utilization",
              "Panel: Temperature / Power",
              "Panel: ECC Errors",
              "Panel: NVLink / PCIe health"
            ]
          }
        ],
        whatsHappening:"You are turning raw collected metrics into a visual view that helps people recognize health patterns quickly.",
        deeperContext:"Dashboards are where many beginners first learn to connect numbers to stories like thermal pressure, ECC drift, or missing telemetry. The key is that the chart should help reasoning, not just decoration.",
        lookFor:[
          "Panels that show meaningful health trends",
          "A layout that helps you compare signals instead of hunting blindly",
          "A visual story that supports faster incident recognition"
        ],
        meaning:"This step makes the metric history easier for humans to interpret during normal operations and incidents.",
        commonMistake:"Thinking any dashboard is useful. A dashboard only helps if it makes operational stories and changes obvious.",
        operatorTakeaway:"Operators use dashboards to reduce ambiguity, not to create a wall of unreadable charts.",
        takeAction:[
          "Choose panels that help explain likely decisions.",
          "Use dashboards to compare healthy and unhealthy states.",
          "Keep the focus on operator reasoning, not visual clutter."
        ],
        avoid:[
          "Do not build dashboards that show everything but explain nothing.",
          "Do not treat visualization as the final goal."
        ]
      },
      {
        label:"Create Alert",
        cmd:"# Prometheus rule",
        type:"mon_alert",
        explainerMode:"beginner_story",
        screenshotReference:"Use the alert-rule snapshot as the action boundary between monitoring and response. The key thing is that the rule maps to a real operator decision instead of just another noisy metric.",
        screenshots:[
          {
            title:"Meaningful alert rule defined",
            caption:"This screenshot is about operational intent. It shows the team encoding a metric pattern that should actually trigger action.",
            lines:[
              "alert: GPU_DBE_Detected",
              "expr: DCGM_FI_DEV_ECC_DBE_VOL_TOTAL > 0",
              "for: 1m",
              "labels: severity=critical"
            ]
          }
        ],
        whatsHappening:"You are turning a meaningful metric pattern into a rule that can actively notify someone when the platform drifts into a risky state.",
        deeperContext:"This is where visibility becomes action. Beginners need to learn that alerts should be tied to decisions and response paths, not just to interesting numbers.",
        lookFor:[
          "A rule based on a meaningful failure pattern",
          "Alert logic that maps to a real operator response",
          "The point where passive monitoring becomes active protection"
        ],
        meaning:"This step tells the platform what kinds of metric behavior deserve interruption, notification, or investigation.",
        commonMistake:"Alerting on every noisy metric without deciding what the team should do when it fires.",
        operatorTakeaway:"Operators design alerts to improve response, not to create more background noise.",
        takeAction:[
          "Tie alerts to actions the team can actually take.",
          "Prefer patterns that indicate real degradation or risk.",
          "Use this step to separate useful alerts from vanity alerts."
        ],
        avoid:[
          "Do not create alerts without a response plan.",
          "Do not confuse noisy visibility with operational readiness."
        ]
      },
      {
        label:"Test Alert",
        cmd:"# Simulating DBE",
        type:"mon_test",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Use the alert-test snapshot as the end-to-end proof step. The key clue is the alert actually firing on the simulated fault, because untested monitoring is only paperwork.",
        screenshots:[
          {
            title:"Critical alert fires on simulated DBE",
            caption:"This screenshot closes the monitoring loop by showing the platform actually reacts to the condition it claims to watch.",
            lines:[
              "ALERTS{alertname=\"GPU_DBE_Detected\",severity=\"critical\"} 1",
              "Alertmanager notification sent to ops-gpu channel",
              "Test incident acknowledged"
            ]
          }
        ],
        whatsHappening:"You are simulating a meaningful fault to prove that the alert path really works end to end.",
        deeperContext:"This final step teaches that monitoring is only trustworthy if it is tested. A rule that looks good on paper but never fires correctly during a real fault is not operational protection.",
        lookFor:[
          "The alert firing when the simulated condition appears",
          "A clear end-to-end path from metric change to operator signal",
          "Evidence that the monitoring system reacts the way the design intended"
        ],
        meaning:"This step proves whether the monitoring and alerting chain is actually usable during a real incident.",
        commonMistake:"Assuming an alert is good because the rule syntax exists, without ever testing whether it triggers correctly.",
        operatorTakeaway:"Operators test alerts because untested monitoring creates false confidence at exactly the wrong moment.",
        takeAction:[
          "Use testing to prove the full alert path, not just the metric source.",
          "Capture what good alert behavior looks like for future validation.",
          "Treat failed alert tests as real reliability problems."
        ],
        avoid:[
          "Do not trust untested alerts during production incidents.",
          "Do not stop at configuration without validating behavior."
        ]
      }
    ],
    draw: drawMonitoring
  },
  slurm: {
    name: "Slurm Scheduler",
    icon: "📋",
    color: "#f0b429",
    objective: "Job lifecycle and Fairshare.",
    steps: [
      {
        label:"Submit Job",
        cmd:"sbatch train.sh",
        type:"slurm_submit",
        explainerMode:"beginner_story",
        screenshotReference:"Use the submission snapshot as the first scheduler state transition. The key clue is the job ID, because that marks the point where user intent enters scheduler control.",
        screenshots:[
          {
            title:"Job enters Slurm control",
            caption:"This screenshot is the first scheduler checkpoint. It shows the request was accepted, not that resources were instantly available.",
            lines:[
              "Submitted batch job 99234"
            ]
          }
        ],
        whatsHappening:"You are handing a job request to the scheduler so it can decide when and where that work fits into the cluster.",
        deeperContext:"This first step teaches that a job does not run just because it was requested. The scheduler becomes the control point between user intent and hardware reality.",
        lookFor:["A job entering scheduler control","A recorded request rather than immediate execution","The start of a policy-and-resource decision path"],
        meaning:"The job is now part of the scheduler's queueing and placement logic.",
        commonMistake:"Assuming submission should immediately become execution on a shared cluster.",
        operatorTakeaway:"Operators view submission as the start of scheduling logic, not proof that resources were instantly available.",
        takeAction:["Treat submission as a state transition into scheduler control.","Use later steps to explain why the job did or did not start.","Keep user request and scheduler outcome separate in your reasoning."],
        avoid:["Do not promise immediate start just because submission succeeded.","Do not confuse accepted with running."]
      },
      {
        label:"Check Queue",
        cmd:"squeue -u $USER",
        type:"slurm_queue",
        explainerMode:"beginner_story",
        screenshotReference:"Use the queue snapshot to separate waiting from failure. The important thing is the current scheduler state, not an assumption that a delay means the cluster is broken.",
        screenshots:[
          {
            title:"Job is pending in the queue",
            caption:"This screenshot is the visibility step for scheduler state. It shows that waiting is a normal part of cluster life that still needs interpretation.",
            lines:[
              "JOBID   PARTITION   NAME    USER   ST     TIME   NODES   NODELIST(REASON)",
              "99234   gpu         train   alice  PD     0:00   2       (Priority)"
            ]
          }
        ],
        whatsHappening:"You are checking where the job currently sits in the queue and whether it is waiting or running.",
        deeperContext:"This is the beginner's first scheduler visibility step. Queue state teaches that waiting is a normal state that still needs interpretation.",
        lookFor:["Whether the job is pending or running","Its position within scheduler flow","Signs that the cluster is busy rather than broken"],
        meaning:"This step shows the scheduler's current view of the job lifecycle.",
        commonMistake:"Treating queue visibility as proof of failure instead of as information about scheduler state.",
        operatorTakeaway:"Operators use queue state to separate normal waiting from incidents that need investigation.",
        takeAction:["Use queue state as context before changing anything.","Compare queue behavior with known cluster load or policy.","Prepare to inspect the scheduler's stated reason if the wait seems surprising."],
        avoid:["Do not jump from waiting to failure without checking why.","Do not ignore the queue and go straight to node surgery."]
      },
      {
        label:"Debug PENDING",
        cmd:"scontrol show job",
        type:"slurm_pend",
        explainerMode:"beginner_story",
        screenshotReference:"Use the pending-reason snapshot as the scheduler's own diagnosis. The key clue is the explicit reason field, because it turns vague waiting into an explainable state.",
        screenshots:[
          {
            title:"Scheduler explains the pending state",
            caption:"This screenshot matters because it prevents guessing. It shows Slurm already has a stated reason for the wait.",
            lines:[
              "JobId=99234 JobState=PENDING Reason=Priority",
              "ReqNodes=2 ReqGRES=gpu:8",
              "EligibleTime=2026-04-21T17:11:04"
            ]
          }
        ],
        whatsHappening:"You are asking Slurm why the job is still waiting instead of guessing from the outside.",
        deeperContext:"This step teaches one of the most important scheduler habits: read the scheduler's own explanation before blaming hardware, policy, or users.",
        lookFor:["A clear pending reason","Whether the delay is caused by policy, capacity, or node state","Evidence that turns waiting into an explainable condition"],
        meaning:"This step converts a vague wait into a more specific scheduling story.",
        commonMistake:"Assuming all pending jobs mean capacity failure when the scheduler may be describing a normal policy rule.",
        operatorTakeaway:"Operators trust explicit pending reasons because they reduce guesswork and prevent unnecessary interventions.",
        takeAction:["Use the stated reason to choose the next debugging direction.","Separate policy delay from infrastructure failure.","Preserve the scheduler's explanation when communicating with users."],
        avoid:["Do not diagnose queue behavior without reading the pending reason.","Do not treat policy-driven waiting like a hardware incident."]
      },
      {
        label:"Check Fairshare",
        cmd:"sshare -u alice",
        type:"slurm_fair",
        explainerMode:"beginner_story",
        screenshotReference:"Use the fairshare snapshot to distinguish policy delay from platform failure. The important thing is that a low fairshare can explain a long wait even on a healthy cluster.",
        screenshots:[
          {
            title:"Fairshare policy is reducing priority",
            caption:"This screenshot is the policy-literacy step for Slurm. It shows why user experience can feel slow without any infrastructure incident.",
            lines:[
              "User   Account   RawShares   NormShares   RawUsage   FairShare",
              "alice  research  1          0.125        91324      0.034"
            ]
          }
        ],
        whatsHappening:"You are checking whether recent usage and scheduler policy are lowering a user's priority for new jobs.",
        deeperContext:"This step teaches that queue behavior is often about fairness policy, not cluster malfunction. Beginners need to see that shared systems intentionally make some jobs wait longer than others.",
        lookFor:["A fairshare signal that explains lower priority","Policy-based reasons for queue delay","Evidence that the scheduler is enforcing sharing rather than failing"],
        meaning:"This step explains why one user's wait may be a healthy result of cluster policy.",
        commonMistake:"Blaming hardware or the scheduler itself when fairshare is the real reason the queue moved the way it did.",
        operatorTakeaway:"Operators need policy literacy because many user-facing complaints are actually fairness behavior, not infrastructure incidents.",
        takeAction:["Use fairshare to explain queue differences clearly.","Separate policy pain from platform breakage.","Document when fairness policy, not failure, is driving user experience."],
        avoid:["Do not call policy outcomes bugs just because users dislike them.","Do not skip fairshare when explaining queue order."]
      },
      {
        label:"Drain Node",
        cmd:"scontrol update state=drain",
        type:"slurm_drain",
        explainerMode:"beginner_story",
        screenshotReference:"Use the drain snapshot as the containment step for scheduler risk. The key clue is the node state change, because that stops fresh jobs from landing on questionable hardware.",
        screenshots:[
          {
            title:"Node moved into drain state",
            caption:"This screenshot is the containment move in Slurm. It shows the scheduler no longer trusts the node for new placements.",
            lines:[
              "NodeName=gpu-node-05 State=DRAIN",
              "Reason=Investigating GPU interconnect health"
            ]
          }
        ],
        whatsHappening:"You are telling the scheduler to stop placing fresh work on a node that may be unsafe or under investigation.",
        deeperContext:"This is the core containment move. Draining lets operators protect the cluster from further blast radius without shutting everything down blindly.",
        lookFor:["A scheduler state that blocks new placements","Containment of suspected node risk","A safe operational boundary while diagnosis continues"],
        meaning:"The node is being protected from new work so the incident does not keep spreading to fresh jobs.",
        commonMistake:"Waiting too long to drain because the node is still technically alive. Availability is not the only question; safety matters too.",
        operatorTakeaway:"Operators use drain as a precise containment tool that turns uncertain hardware state into reduced risk.",
        takeAction:["Drain early when node safety is genuinely in doubt.","Treat drain as part of incident control, not as panic.","Record why the node was drained so recovery is cleaner later."],
        avoid:["Do not keep scheduling new work onto a questionable node.","Do not treat drain as an admission of defeat; it is a control mechanism."]
      },
      {
        label:"Resume Node",
        cmd:"scontrol update state=resume",
        type:"slurm_resume",
        explainerMode:"beginner_story",
        screenshotReference:"Treat the resume snapshot as evidence-based recovery, not queue pressure relief. The key thing is the node returning to service only after the reason for drain is resolved.",
        screenshots:[
          {
            title:"Node returns to scheduler service",
            caption:"This screenshot closes the scheduler containment loop by showing controlled recovery rather than a rushed return to capacity.",
            lines:[
              "NodeName=gpu-node-05 State=IDLE",
              "Resume acknowledged by scheduler"
            ]
          }
        ],
        whatsHappening:"You are returning the node to normal scheduling service after the underlying issue is understood or fixed.",
        deeperContext:"This final step teaches disciplined recovery. A node should come back because you have evidence it is safe again, not just because people want capacity back quickly.",
        lookFor:["A node re-entering the scheduling pool","Confidence that the reason for drain has been resolved","A controlled transition from containment back to service"],
        meaning:"The scheduler is being told the node is once again safe to receive fresh jobs.",
        commonMistake:"Resuming too early because the queue is long, even though the underlying issue has not been validated away.",
        operatorTakeaway:"Operators protect trust in the cluster by making recovery evidence-based, not pressure-based.",
        takeAction:["Resume only when the remediation story is solid.","Tie recovery to observed node health, not just to demand pressure.","Use this step to close the containment loop cleanly."],
        avoid:["Do not resume a node for convenience alone.","Do not erase the distinction between temporary containment and verified recovery."]
      }
    ],
    draw: drawSlurm
  },
  k8s: {
    name: "Kubernetes GPU Ops",
    icon: "☸️",
    color: "#4a9eff",
    objective: "GPU Operator and Gang Scheduling.",
    steps: [
      {
        label:"Check Operator",
        cmd:"kubectl get pods -n gpu-operator",
        type:"k8s_operator",
        explainerMode:"beginner_story",
        screenshotReference:"Use the operator snapshot as the first Kubernetes GPU health gate. The key clue is whether the control components are healthy, because a broken operator can make good nodes look empty.",
        screenshots:[
          {
            title:"GPU operator stack is healthy",
            caption:"This screenshot is the control-plane baseline for Kubernetes GPU ops. It shows the enablement layer is functioning before you blame workloads or nodes.",
            lines:[
              "nvidia-device-plugin-daemonset   1/1   Running",
              "gpu-feature-discovery            1/1   Running",
              "nvidia-operator-validator        1/1   Completed"
            ]
          }
        ],
        whatsHappening:"You are checking whether the Kubernetes components responsible for GPU enablement are healthy.",
        deeperContext:"This is the first control-plane health check. Beginners need to learn that GPU availability in Kubernetes often depends on an operator layer before the workload ever reaches a node.",
        lookFor:["A healthy GPU operator stack","No crash-looping control components","Evidence that the cluster is prepared to manage GPU nodes correctly"],
        meaning:"This step tells you whether the software layer that enables GPU usage in the cluster is functioning at all.",
        commonMistake:"Debugging the pod first when the operator itself may already be unhealthy.",
        operatorTakeaway:"Operators check the enablement layer early because a broken operator can make healthy nodes look unusable.",
        takeAction:["Treat operator health as a prerequisite for trustworthy scheduling.","Use this to separate control-plane trouble from workload trouble.","Keep cluster enablement in scope before touching pod-level fixes."],
        avoid:["Do not assume the node is the first failure domain.","Do not ignore operator health when GPUs seem to disappear."]
      },
      {
        label:"Verify Resource",
        cmd:"kubectl describe node",
        type:"k8s_resources",
        explainerMode:"beginner_story",
        screenshotReference:"Use the node-resource snapshot to compare physical GPU reality with scheduler-visible reality. The key thing is whether Kubernetes is actually advertising the GPUs you expect.",
        screenshots:[
          {
            title:"Node advertises schedulable GPUs",
            caption:"This screenshot is the resource-translation proof step for Kubernetes. It shows the scheduler can actually see the hardware as capacity.",
            lines:[
              "Capacity:",
              "  nvidia.com/gpu: 8",
              "Allocatable:",
              "  nvidia.com/gpu: 8"
            ]
          }
        ],
        whatsHappening:"You are checking whether the node is actually advertising GPU resources to the scheduler.",
        deeperContext:"This step teaches that a node can be alive while still failing to expose the resources Kubernetes needs to place GPU workloads there.",
        lookFor:["The expected GPU resource on the node","A resource view that matches cluster expectations","Whether scheduling can even see the hardware it is supposed to use"],
        meaning:"This step confirms whether the cluster's resource model includes the GPUs you expect.",
        commonMistake:"Assuming physical GPUs automatically become schedulable resources without checking advertisement.",
        operatorTakeaway:"Operators compare the hardware story with the scheduler's resource story because orchestration depends on the advertised version of reality.",
        takeAction:["Use node description to verify scheduler-visible GPU capacity.","Treat missing resources as a translation problem, not automatically a hardware death.","Compare node advertisement against operator health and actual hardware."],
        avoid:["Do not skip resource advertisement checks.","Do not equate node reachability with usable GPU capacity."]
      },
      {
        label:"Debug Pending",
        cmd:"kubectl describe pod",
        type:"k8s_pending",
        explainerMode:"beginner_story",
        screenshotReference:"Use the pending-pod snapshot as Kubernetes' own explanation before guessing. The key clue is the explicit event reason, because Pending is only a category until the platform explains it.",
        screenshots:[
          {
            title:"Pod remains Pending for a concrete reason",
            caption:"This screenshot turns a vague stuck pod into a specific scheduler explanation. It narrows the debugging surface immediately.",
            lines:[
              "Events:",
              "  Warning  FailedScheduling  2m   default-scheduler",
              "  0/4 nodes are available: 4 Insufficient nvidia.com/gpu."
            ]
          }
        ],
        whatsHappening:"You are reading Kubernetes' own explanation for why the pod has not been scheduled or started.",
        deeperContext:"This is the equivalent of reading the scheduler's story before guessing. Beginners should learn that Pending is a category, not a diagnosis.",
        lookFor:["A concrete pending reason","Whether the issue is capacity, policy, or missing resources","A clearer boundary between scheduling trouble and node/runtime trouble"],
        meaning:"This step turns a vague stuck pod into a more specific control-plane explanation.",
        commonMistake:"Treating Pending itself as the root cause instead of reading the reason behind it.",
        operatorTakeaway:"Operators rely on the platform's stated reason first because it narrows the debugging surface quickly.",
        takeAction:["Use the pending reason to choose the right next layer to inspect.","Separate placement failure from runtime failure.","Preserve the exact reason when explaining the issue to users."],
        avoid:["Do not guess at Pending causes from symptoms alone.","Do not jump into node surgery before reading the scheduler's explanation."]
      },
      {
        label:"Check NetPol",
        cmd:"kubectl get netpol",
        type:"k8s_netpol",
        explainerMode:"beginner_story",
        screenshotReference:"Use the network-policy snapshot when resource checks look healthy but behavior still fails. The key thing is whether a policy is silently blocking control or workload traffic.",
        screenshots:[
          {
            title:"Network policy is constraining communication",
            caption:"This screenshot is the policy-layer reminder for Kubernetes. It shows that a workload can fail for communication reasons even when resources look fine.",
            lines:[
              "NAME                 POD-SELECTOR      AGE",
              "deny-cross-namespace app=trainer       3d",
              "allow-metrics-only   app=gpu-exporter  3d"
            ]
          }
        ],
        whatsHappening:"You are checking whether network policy is blocking the communication paths the workload or control components need.",
        deeperContext:"This teaches that orchestration problems are not always about resources. A pod can exist with the right request and still fail because control-plane or workload communication is restricted.",
        lookFor:["Policies that may block needed traffic","A control-plane or workload path being restricted unexpectedly","Whether the issue is really about communication rather than GPU scheduling"],
        meaning:"This step checks whether policy-level networking is contributing to the workload problem.",
        commonMistake:"Assuming every Kubernetes GPU issue starts with resources when network policy can break the same user experience from a different angle.",
        operatorTakeaway:"Operators widen their view when resource checks look fine but behavior still fails. Control-plane translation includes connectivity too.",
        takeAction:["Use network policy checks when resource and operator views look healthy.","Treat blocked communication as a first-class orchestration problem.","Keep policy effects in scope for startup failures."],
        avoid:["Do not reduce all pod failures to scheduling only.","Do not ignore policy layers that can block otherwise healthy components."]
      },
      {
        label:"Drain Node",
        cmd:"kubectl drain node-03",
        type:"k8s_drain",
        explainerMode:"beginner_story",
        screenshotReference:"Use the node-drain snapshot as the Kubernetes containment step. The key clue is scheduler removal language, because that protects future pods while the node is investigated.",
        screenshots:[
          {
            title:"Kubernetes node drained for containment",
            caption:"This screenshot is the platform-protection move in the Kubernetes lab. It shows the node being taken out of fresh placement cleanly.",
            lines:[
              "node/gpu-node-03 cordoned",
              "evicting pod trainer-7f9d6c7d8f-abc12",
              "node/gpu-node-03 drained"
            ]
          }
        ],
        whatsHappening:"You are removing a node from active workload placement so new pods stop landing on it while you investigate or repair it.",
        deeperContext:"This is the Kubernetes version of containment. The beginner lesson is that safe platform operations often mean reducing scheduler trust in a node before the whole problem is perfectly understood.",
        lookFor:["A node moving out of active placement","Containment of potential node risk","A safer cluster state while diagnosis continues"],
        meaning:"The node is being taken out of normal service to protect future workloads from a suspected issue.",
        commonMistake:"Leaving a questionable node active because some pods still happen to work there.",
        operatorTakeaway:"Operators use drain to protect the platform from repeated impact while preserving control and auditability.",
        takeAction:["Drain when node trust is low enough that fresh placement is risky.","Use this as a containment step, not as improvisation.","Record why the node was drained so recovery is disciplined."],
        avoid:["Do not keep scheduling onto a suspect node.","Do not wait for a perfect diagnosis before reducing obvious risk."]
      },
      {
        label:"Gang Schedule",
        cmd:"kubectl get podgroup",
        type:"k8s_gang",
        explainerMode:"beginner_story",
        screenshotReference:"Use the podgroup snapshot to judge coordinated placement for distributed work. The key thing is whether the job is treated as a group rather than a set of half-started individual pods.",
        screenshots:[
          {
            title:"Distributed workload is gang-scheduled coherently",
            caption:"This screenshot is the all-or-nothing placement proof for the Kubernetes lab. It shows the scheduler is respecting the workload's coordination shape.",
            lines:[
              "NAME            MIN MEMBER  RUNNING  SCHEDULED",
              "training-gang   16          16       True"
            ]
          }
        ],
        whatsHappening:"You are checking whether the cluster is coordinating tightly coupled distributed pods as one unit instead of letting them start in a broken partial state.",
        deeperContext:"This final step teaches that some distributed workloads need all-or-nothing placement. Starting only part of the job can create a hanging workload that looks alive but is operationally wrong.",
        lookFor:["Whether gang scheduling is configured or expected","A scheduling model that matches the workload's coordination needs","Protection against partially started distributed jobs"],
        meaning:"This step checks whether the scheduler is treating a distributed workload as a coordinated group instead of as unrelated individual pods.",
        commonMistake:"Celebrating that some pods started when the workload actually needs the entire group to start together to be healthy.",
        operatorTakeaway:"Operators think about workload shape, not only about single-pod success. Distributed jobs need coordinated placement to behave correctly.",
        takeAction:["Use gang scheduling for tightly coupled distributed work.","Treat partial start as a problem when the job expects full coordination.","Align scheduler behavior with workload behavior, not just with pod count."],
        avoid:["Do not judge distributed-job health by one pod at a time.","Do not let partial starts masquerade as success."]
      }
    ],
    draw: drawK8s
  }
};
