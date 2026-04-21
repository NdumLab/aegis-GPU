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
      {
        label:"View Topology",
        cmd:"nvidia-smi topo -m",
        type:"topo",
        explainerMode:"beginner_story",
        whatsHappening:"You are reading the map of how the 8 GPUs connect to each other. This tells you which communication paths should be fast and direct before you look at performance.",
        deeperContext:"Beginners need a mental map before they can reason about slowdown. A throughput number is only meaningful if you know which links should exist and which path the traffic is supposed to take.",
        lookFor:[
          "NV4-style NVLink relationships instead of PCIe-only paths such as PHB",
          "A mostly symmetric topology across the 8-GPU set",
          "Any missing or weaker path that would change collective behavior later"
        ],
        meaning:"This step establishes the healthy fabric baseline. You are learning what the node should look like when direct GPU-to-GPU communication is working correctly.",
        commonMistake:"Treating the topology map as optional background. It is not. This map is what lets you tell later whether a slowdown is normal, software-driven, or caused by a path downgrade.",
        operatorTakeaway:"Operators read topology first because it defines the communication contract for the node. If that contract breaks later, the performance story changes immediately.",
        takeAction:[
          "Notice which GPU pairs should be direct NVLink neighbors.",
          "Treat this topology output as the design contract for later troubleshooting.",
          "Remember that a path mismatch later is meaningful only because this baseline exists."
        ],
        avoid:[
          "Do not skip straight to benchmarking without understanding the intended link map.",
          "Do not assume all multi-GPU slowdowns are software problems if the fabric map is wrong."
        ]
      },
      {
        label:"Check NVLink Errors",
        cmd:"nvidia-smi nvlink -e",
        type:"nvlink_err",
        explainerMode:"beginner_story",
        whatsHappening:"You are checking whether the visible NVLink paths are electrically clean. A link can exist in the map and still be degraded in reality.",
        deeperContext:"This is where beginners learn that a topology diagram only tells you the intended route. Error counters tell you whether that route is actually healthy enough to trust under load.",
        lookFor:[
          "CRC or flit error counts staying at 0 or near-clean values",
          "Any link showing non-zero growth that makes one path look weaker than the rest",
          "Whether the fabric looks electrically clean before performance testing"
        ],
        meaning:"This step tells you whether the fabric is clean enough to benchmark. Clean counters mean the fast path is not only present, but also behaving like a healthy interconnect.",
        commonMistake:"Assuming a good topology matrix automatically means the fabric is healthy. Links can be present but noisy, and those errors often show up before the workload fully collapses.",
        operatorTakeaway:"Operators use this step to separate hardware-path concerns from higher-level software concerns. If the counters are dirty, the fabric itself is already suspect.",
        takeAction:[
          "Use this step to decide whether a future bandwidth issue is likely fabric-related or higher-level.",
          "Treat non-zero link errors as an early warning, even if workloads still run.",
          "Move to benchmark only after the fabric looks clean enough to trust."
        ],
        avoid:[
          "Do not assume a correct topology map means the interconnect is healthy in practice.",
          "Do not ignore low but growing link errors if they line up with later performance loss."
        ]
      },
      {
        label:"Benchmark AllReduce",
        cmd:"./nccl-tests/build/all_reduce_perf -b 1G -e 4G -f 2 -g 8",
        type:"benchmark",
        explainerMode:"beginner_story",
        whatsHappening:"You are measuring whether the workload actually gets the high-speed collective bandwidth the healthy NVLink fabric should deliver.",
        deeperContext:"This is where the hardware story becomes operational. Topology and counters told you what should happen. The benchmark tells you whether real collective traffic sees the same healthy path.",
        lookFor:[
          "AllReduce bandwidth near the healthy NVLink-backed expectation",
          "No sudden collapse that would contradict the healthy topology picture",
          "A result that matches what this node design should deliver"
        ],
        meaning:"A good benchmark confirms the fabric is healthy in practice, not just on paper. This is the proof that the node is delivering the collective communication performance it was built for.",
        commonMistake:"Reading the benchmark as just a big number. The number matters because it confirms the earlier topology and error checks were telling the truth about the usable fast path.",
        operatorTakeaway:"This result becomes your healthy baseline. If performance collapses later, you compare it to this known-good state instead of guessing.",
        takeAction:[
          "Use the throughput number as the healthy comparison point for later degraded steps.",
          "Keep the benchmark result tied mentally to the clean topology and error checks.",
          "Treat any later collapse as meaningful because you already proved the good path."
        ],
        avoid:[
          "Do not memorize the command and forget the purpose of the throughput result.",
          "Do not compare a bad benchmark to guesswork; compare it to this healthy baseline."
        ]
      },
      {
        label:"Fault: Inject PHB",
        cmd:"# Simulating NVLink failure",
        type:"nvlink_fault",
        fault:true,
        explainerMode:"beginner_story",
        whatsHappening:"You are simulating a path downgrade where direct NVLink communication is gone and traffic falls back to a slower PCIe host-bridge route.",
        deeperContext:"This is an important beginner lesson: a node can still be up while the interconnect is no longer healthy. The job may continue to run, but it is no longer running on the fast path the cluster was designed for.",
        lookFor:[
          "NVLink path collapsing to PHB or another weaker traversal",
          "A topology story that no longer matches the earlier healthy baseline",
          "The kind of path downgrade that explains a future throughput cliff"
        ],
        meaning:"The fast GPU fabric is no longer healthy. Communication now takes a slower route, which means collective workloads should be expected to degrade sharply.",
        commonMistake:"Thinking the node is mostly fine because the workload still launches. If the path has fallen back to PHB, the interconnect is already in a degraded state even before you read the next benchmark or log line.",
        operatorTakeaway:"Once PHB replaces the expected NVLink path, the node has crossed out of a healthy interconnect state. The question is no longer whether there is a problem, but how large the blast radius is.",
        takeAction:[
          "Treat the topology shift as the primary clue before touching software tuning.",
          "Expect benchmark degradation to be a consequence, not a separate mystery.",
          "Use the next step to connect the topology fault to the software-visible fallback story."
        ],
        avoid:[
          "Do not call this a minor cosmetic topology issue.",
          "Do not start with environment variables if the physical path has already degraded."
        ]
      },
      {
        label:"Diagnose Fallback",
        cmd:"NCCL_DEBUG=INFO torchrun train.py",
        type:"nccl_diag",
        explainerMode:"beginner_story",
        whatsHappening:"You are checking whether the software layer now shows the same degraded communication story that the hardware path already hinted at.",
        deeperContext:"This is the cross-layer reasoning step. Beginners often treat hardware and software symptoms as separate mysteries. Operators connect them into one story: bad path, then bad bandwidth, then bad NCCL behavior.",
        lookFor:[
          "NCCL logs indicating a less efficient path or degraded communication behavior",
          "Software evidence that matches the earlier topology change",
          "A consistent story from fabric map to benchmark to collective diagnosis"
        ],
        meaning:"The software output now confirms the hardware fault story. This is how you prove the slowdown is grounded in interconnect evidence instead of blaming the training job blindly.",
        commonMistake:"Treating NCCL logs as the root cause by themselves. In this lab, the logs are the software echo of a hardware-path problem you already established earlier.",
        operatorTakeaway:"The best diagnosis is one connected chain: healthy topology, clean links, healthy baseline, degraded path, degraded software behavior. That is the kind of explanation operators can act on.",
        takeAction:[
          "Explain the fault as one connected narrative across hardware and software layers.",
          "Use the combined evidence to justify repair or containment instead of more speculation.",
          "Make sure the remediation plan targets the degraded link path, not just the training command."
        ],
        avoid:[
          "Do not treat NCCL logs as the whole problem when the hardware path already explained the slowdown.",
          "Do not mark the node healthy again until both path and throughput recover."
        ]
      }
    ],
    draw: drawNVLink
  },
  mig: {
    name: "MIG Partitioning",
    icon: "🍕",
    color: "#c87941",
    objective: "Partition one H100 into 7 instances.",
    steps: [
      {
        label:"Enable MIG Mode",
        cmd:"sudo nvidia-smi -i 0 -mig 1",
        type:"mig_enable",
        explainerMode:"beginner_story",
        whatsHappening:"You are turning on the GPU's ability to be sliced. This is a hardware mode change, not just a scheduler flag.",
        deeperContext:"Beginners need to see that MIG starts at the device itself. The GPU must enter a different operating mode before isolated slices can exist.",
        lookFor:[
          "A clear confirmation that MIG mode was enabled for GPU 0",
          "A state change that tells you the card is now ready for partition creation",
          "No sign that workloads were still depending on the full-GPU mode during the switch"
        ],
        meaning:"The GPU is now capable of being partitioned into smaller hardware-backed instances.",
        commonMistake:"Thinking MIG is just a Kubernetes or software scheduling feature. It starts with a hardware mode change on the GPU itself.",
        operatorTakeaway:"Before you enable MIG on a real node, confirm the GPU is safe to reconfigure and not actively serving production work.",
        takeAction:[
          "Confirm the node was quiet enough for a mode change before moving to the partition step.",
          "Treat this as a hardware reconfiguration, not as a cosmetic toggle."
        ],
        avoid:[
          "Do not enable MIG blindly on a busy node.",
          "Do not assume the software stack can create slices until the device confirms MIG mode is on."
        ]
      },
      {
        label:"Create 7 Instances",
        cmd:"sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C",
        type:"mig_create",
        explainerMode:"beginner_story",
        whatsHappening:"You are carving the H100 into seven 1g.10gb-style slices. You are defining the exact hardware layout the node will expose.",
        deeperContext:"This step teaches that MIG does not auto-balance or guess what you want. Operators declare the slice layout deliberately because the layout controls capacity and isolation.",
        lookFor:[
          "A creation message showing that 7 MIG instances were created",
          "Evidence that the command applied the exact layout requested",
          "No ambiguity about how many slices now exist on the GPU"
        ],
        meaning:"The GPU has been partitioned into seven isolated instances, each ready to be verified and assigned.",
        commonMistake:"Assuming the GPU will auto-size or auto-balance slices for you. It will not. The layout is exactly what you ask it to create.",
        operatorTakeaway:"Partition layout is a policy decision. It should match tenant needs, isolation goals, and the service plan for the node.",
        takeAction:[
          "Compare the created layout with the intended tenant plan before you move on.",
          "Remember that a wrong layout can still be a successful command from the CLI's point of view."
        ],
        avoid:[
          "Do not treat command success as layout success.",
          "Do not assume all workloads need or deserve the same slice size."
        ]
      },
      {
        label:"List Instances",
        cmd:"nvidia-smi mig -lgi",
        type:"mig_list",
        explainerMode:"beginner_story",
        whatsHappening:"You are verifying that the hardware actually created the slices you intended.",
        deeperContext:"This is where beginners learn that verification is part of the work. Operators do not stop at creation; they confirm the machine is in the state they believe it is in.",
        lookFor:[
          "Seven visible GPU instances in the listing",
          "A clear mapping between the requested layout and the reported layout",
          "Enough detail to explain what resources each slice now represents"
        ],
        meaning:"The listing is your proof that the partition plan became real hardware state.",
        commonMistake:"Skipping verification because the previous command said it succeeded.",
        operatorTakeaway:"Verification is part of blast-radius control. If the layout is wrong, you want to catch it before workloads land on the wrong slices.",
        takeAction:[
          "Match the reported instances against the intended design.",
          "Use this output as the source of truth before assigning work."
        ],
        avoid:[
          "Do not assume a successful create command means the resulting topology is correct.",
          "Do not hand slices to users until you have verified the actual layout."
        ]
      },
      {
        label:"Assign Workloads",
        cmd:"# Assigning 3 teams",
        type:"mig_assign",
        explainerMode:"beginner_story",
        whatsHappening:"You are mapping real workloads or teams to specific MIG slices. This is where the partition plan becomes an operating model.",
        deeperContext:"Beginners often stop thinking once the slices exist. Operators keep going: who gets which slice, how many, and what happens if one tenant misbehaves?",
        lookFor:[
          "A clear example of which workload lands on which MIG slice",
          "A plan that matches slice count to team or tenant needs",
          "No sign that users are being told a slice is equivalent to a full GPU"
        ],
        meaning:"The node is now being used as a shared GPU platform with hardware-backed isolation boundaries.",
        commonMistake:"Thinking the scheduler will magically spread workloads in a sensible way without you understanding what resources were actually advertised.",
        operatorTakeaway:"This is where capacity planning and blast-radius thinking matter. You are deciding how much of the GPU each team gets and what isolation boundary they actually have.",
        takeAction:[
          "Explain the assignment model in plain language to users or trainees.",
          "Check that no one is oversubscribed relative to the created slice layout."
        ],
        avoid:[
          "Do not promise full-GPU behavior from a small slice.",
          "Do not treat MIG as a substitute for thinking through tenant placement."
        ]
      },
      {
        label:"Disable MIG",
        cmd:"sudo nvidia-smi -i 0 -mig 0",
        type:"mig_disable",
        explainerMode:"beginner_story",
        whatsHappening:"You are returning the GPU to full-device mode. This removes the MIG slices and gives the card back as one large accelerator.",
        deeperContext:"Cleanup is part of the lesson. Disabling MIG is not harmless undo; it changes the hardware state again and destroys the partition layout.",
        lookFor:[
          "A confirmation that MIG mode was disabled",
          "Evidence that the full GPU has been restored",
          "No assumption that slice-based workloads could keep running through the transition"
        ],
        meaning:"The GPU is back to full-device mode and the slice-based sharing model is gone.",
        commonMistake:"Forgetting that disabling MIG destroys the slices and should only happen when workloads are drained or no longer need the partitioned layout.",
        operatorTakeaway:"Mode cleanup is safe only when the node is empty or intentionally being reconfigured. Treat it as a service-impacting action, not casual cleanup.",
        takeAction:[
          "Confirm the node is safe to return to full-GPU mode before cleanup.",
          "Explain to beginners that cleanup changes the hardware contract for every workload that depended on MIG."
        ],
        avoid:[
          "Do not disable MIG while slice-based work is still supposed to be running.",
          "Do not treat cleanup as separate from safety and workload coordination."
        ]
      }
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
      {
        label:"XID 48 Alert",
        cmd:"dmesg | tail -20 | grep xid",
        type:"xid48",
        fault:true,
        deeperContext:"This drill starts with a memory-integrity alert. The beginner goal is to stop treating XID numbers as mysterious codes and instead see them as operator signals with specific severity and response expectations.",
        lookFor:[
          "An XID 48 event tied to a specific GPU",
          "A log entry that points toward uncorrectable ECC behavior rather than a generic slowdown",
          "The need to move from interpretation into confirmation"
        ],
        meaning:"XID 48 is a serious memory fault signal and usually points toward double-bit ECC failure. It is not just another warning event.",
        justifiedConclusion:"The node may already be in a hardware-integrity incident and needs immediate confirmation work, not passive observation.",
        stillPremature:"It is still too early to drain or RMA based on the code alone until you confirm the DBE evidence path.",
        thresholdCrossed:"The fault-investigation threshold is crossed: the alert is strong enough that confirmation must happen immediately.",
        takeAction:[
          "Tie the code to the affected device before acting broadly.",
          "Use the next step to confirm the DBE evidence path.",
          "Treat the alert as a probable hardware issue, not just a performance event."
        ],
        avoid:[
          "Do not dismiss the XID because the job may still look partially alive.",
          "Do not jump to generic remediation before confirming which fault family you are in."
        ]
      },
      {
        label:"Confirm DBE",
        cmd:"dcgmi dmon -e 157 -c 3",
        type:"xid48_confirm",
        deeperContext:"This is the confirmation step that separates suspicion from grounded incident response. It teaches beginners that a strong operator decision should be backed by a second, independent evidence source when possible.",
        lookFor:[
          "Field 157 showing DBE activity instead of staying at 0",
          "Alignment between the XID alert and ECC counter evidence",
          "A hardware-integrity story that is now evidence-backed rather than inferred"
        ],
        meaning:"DBE confirmation turns the XID 48 alert into a grounded uncorrectable-memory incident. The system now has both log evidence and hardware-counter evidence pointing the same way.",
        changedFromPrevious:"The incident moved from probable fault to confirmed uncorrectable ECC condition.",
        justifiedConclusion:"Containment and vendor-style remediation are now justified because the evidence supports a real DBE event.",
        stillPremature:"It is still too early to think a lightweight software fix will make the GPU safe again.",
        thresholdCrossed:"The containment threshold is crossed once DBE confirmation aligns with the XID 48 alert.",
        takeAction:[
          "Treat the incident as confirmed, not hypothetical.",
          "Prepare containment and escalation based on the grounded evidence.",
          "Use this as the pattern for how to confirm other severe alerts in the future."
        ],
        avoid:[
          "Do not continue arguing that the code might be harmless once DBE is confirmed.",
          "Do not keep the node in normal service while waiting for even more proof."
        ]
      },
      {
        label:"XID 79 Alert",
        cmd:"# Simulating GPU hang",
        type:"xid79",
        fault:true,
        deeperContext:"Now the drill changes fault family. Beginners should learn that not all XIDs mean the same thing: XID 79 is a stability and bus-reachability problem, not an ECC-memory story.",
        lookFor:[
          "Evidence that the GPU is hung or has fallen off the bus",
          "A different failure shape than the earlier ECC incident",
          "The need for a reset-style recovery path instead of just containment"
        ],
        meaning:"XID 79 usually means the GPU became unreachable on the bus. This is a severe stability event and often requires reset or reboot behavior rather than memory-RMA reasoning.",
        changedFromPrevious:"The incident shifted from memory-integrity failure to GPU reachability and stability failure. The recovery playbook must change with it.",
        justifiedConclusion:"A reset attempt is now the right next move because the failure mode suggests the GPU is hung, not just degraded.",
        stillPremature:"It is still too early to assume a node reboot is required until you see whether a targeted GPU reset succeeds.",
        thresholdCrossed:"The recovery-path threshold is crossed: the evidence now justifies trying a hardware reset workflow.",
        takeAction:[
          "Recognize that this is a different fault family with a different response model.",
          "Use a reset attempt before escalating to full node reboot when appropriate.",
          "Keep the distinction between memory faults and bus faults clear in your reasoning."
        ],
        avoid:[
          "Do not respond to XID 79 as if it were just another ECC case.",
          "Do not reboot first if a targeted reset could safely answer the recovery question."
        ]
      },
      {
        label:"Attempt GPU Reset",
        cmd:"sudo nvidia-smi --gpu-reset -i 3",
        type:"xid79_reset",
        deeperContext:"This step teaches conditional recovery: not every severe fault goes straight to reboot. Beginners should learn that the operator tests the least disruptive justified recovery action first when the fault family supports it.",
        lookFor:[
          "Whether the GPU reset succeeds or fails cleanly",
          "Whether the device becomes reachable again after reset",
          "Whether the incident remains local to one GPU or implies a wider node issue"
        ],
        meaning:"A successful reset means the GPU-hang path may be recoverable without full node reboot. A failed reset pushes the incident into a more disruptive recovery tier.",
        changedFromPrevious:"The workflow moved from identifying the fault family to actively testing the least disruptive justified recovery path.",
        justifiedConclusion:"Reset outcome now decides whether recovery can stay GPU-scoped or must escalate to node-scoped action.",
        stillPremature:"It is still too early to declare the node healthy again until the device is reachable and validated after reset.",
        thresholdCrossed:"The escalation threshold is crossed if the reset fails or the GPU remains unreachable afterward.",
        takeAction:[
          "Use the reset result to drive the next escalation level instead of guessing.",
          "If reset fails, treat reboot escalation as grounded, not impulsive.",
          "If reset succeeds, validate before returning the GPU to service."
        ],
        avoid:[
          "Do not confuse a reset attempt with proof of recovery.",
          "Do not keep experimenting indefinitely if the device remains unreachable."
        ]
      },
      {
        label:"XID 74 (NVLink)",
        cmd:"nvidia-smi nvlink -e",
        type:"xid74",
        fault:true,
        deeperContext:"The final step introduces a third fault family: interconnect faults. This teaches that XID literacy includes understanding whether the problem is memory, device stability, or fabric communication.",
        lookFor:[
          "NVLink CRC or related link-error evidence tied to the fault",
          "A communication-path issue rather than a pure GPU-compute failure",
          "Hardware-link symptoms that can degrade collectives without fully crashing the node"
        ],
        meaning:"XID 74 usually points to NVLink link trouble such as CRC errors. This is a fabric-quality incident and should be reasoned about as a communication-path problem.",
        changedFromPrevious:"The drill shifted again, from bus-stability recovery to interconnect diagnosis. The operator now needs fabric reasoning, not reset-only reasoning.",
        justifiedConclusion:"The node may still compute locally, but GPU-to-GPU communication integrity is now in question and must be treated seriously.",
        stillPremature:"It is still too early to blame the application stack alone when link-level evidence points to the fabric path.",
        thresholdCrossed:"The fabric-diagnosis threshold is crossed once XID 74 aligns with NVLink error evidence.",
        takeAction:[
          "Read the incident as a link-health problem first.",
          "Use topology and link counters to ground the diagnosis before tuning software.",
          "Treat communication degradation as a production issue even if jobs still start."
        ],
        avoid:[
          "Do not lump XID 74 together with memory or bus faults as if the response were identical.",
          "Do not ignore fabric evidence just because the GPUs themselves still appear online."
        ]
      }
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
      {
        label:"Diagnose",
        cmd:"NCCL_DEBUG=INFO torchrun train.py",
        type:"fb_diag",
        deeperContext:"This drill begins at the symptom layer. Beginners often stop at 'the job is slow'; this step teaches them to use NCCL logs to identify that the communication path is already telling a story.",
        lookFor:[
          "NCCL choosing Socket or TCP instead of the expected InfiniBand path",
          "A communication mode that does not match the node's intended fabric design",
          "The first concrete evidence that slow success is not normal success"
        ],
        meaning:"The workload is likely using a slower fallback path. The key lesson is that distributed jobs can still run while the communication layer is badly degraded.",
        justifiedConclusion:"A path-selection problem is now a plausible explanation for the slowdown and deserves targeted investigation.",
        stillPremature:"It is still too early to blame hardware or reboot anything until environment and IB availability are checked.",
        thresholdCrossed:"The path-investigation threshold is crossed: the logs justify tracing why NCCL is not on the expected fast path.",
        takeAction:[
          "Treat the communication mode as evidence, not just noise in the logs.",
          "Use the next steps to separate configuration mistakes from true fabric issues.",
          "Keep the healthy-path expectation in mind while you investigate."
        ],
        avoid:[
          "Do not accept slow TCP operation as 'good enough' just because the job launched.",
          "Do not jump to driver surgery before checking the simpler path-selection causes."
        ]
      },
      {
        label:"Check Env",
        cmd:"env | grep NCCL",
        type:"fb_env",
        deeperContext:"This step teaches a core debugging habit: check the highest-leverage, lowest-cost explanation first. Environment variables can override the whole fabric story with one bad setting.",
        lookFor:[
          "Variables such as NCCL_IB_DISABLE or a suspicious HCA override",
          "A direct software explanation for why TCP was chosen",
          "Whether the fallback could be self-inflicted by configuration"
        ],
        meaning:"If a disabling or mismatched environment variable is present, the fallback may be caused by configuration alone rather than hardware failure.",
        changedFromPrevious:"The investigation moved from symptom recognition to the simplest high-impact cause: configuration override.",
        justifiedConclusion:"A config-driven fallback is now more plausible if the environment contradicts the intended fabric path.",
        stillPremature:"It is still too early to blame the InfiniBand fabric itself until you confirm the environment is not forcing the slower path.",
        thresholdCrossed:"The configuration-cause threshold is crossed if NCCL environment settings directly explain the fallback.",
        takeAction:[
          "Use environment inspection to clear or confirm the easiest root-cause class first.",
          "If the environment looks wrong, fix that before doing deeper cluster investigation.",
          "Preserve the distinction between misconfiguration and hardware outage."
        ],
        avoid:[
          "Do not ignore the environment because hardware debugging feels more serious.",
          "Do not keep digging into fabric state if a single variable already explains the symptom."
        ]
      },
      {
        label:"Check ibstat",
        cmd:"ibstat",
        type:"fb_ib",
        deeperContext:"Once configuration is checked, the next teaching move is to verify the transport is actually available. Beginners need to learn that software and fabric evidence must be compared, not studied in isolation.",
        lookFor:[
          "IB ports in Active state",
          "Expected HCAs present and named as the environment would reference them",
          "Whether the transport exists independently of the NCCL symptom"
        ],
        meaning:"This step shows whether the fast transport is genuinely available. Healthy IB state means the fallback is more likely a selection problem than a dead fabric.",
        changedFromPrevious:"The reasoning moves from config-only suspicion to validating the transport layer itself.",
        justifiedConclusion:"If IB is active, the fallback is increasingly likely to be a naming, selection, or override problem rather than a hard transport outage.",
        stillPremature:"It is still too early to declare the fix obvious until the selected HCA and resulting behavior are verified.",
        thresholdCrossed:"The transport-availability threshold is crossed when IB health confirms the fast path should be usable in principle.",
        takeAction:[
          "Compare actual HCA names against any configured NCCL HCA setting.",
          "Use this step to decide whether you are debugging availability or selection.",
          "Prepare a narrow fix that matches the observed HCA reality."
        ],
        avoid:[
          "Do not say 'IB is fine' without checking the exact device names and active state.",
          "Do not keep treating the issue as a total fabric outage if ibstat says the ports are healthy."
        ]
      },
      {
        label:"Set IB_HCA",
        cmd:"export NCCL_IB_HCA=mlx5_0",
        type:"fb_fix",
        deeperContext:"This is a targeted correction step. The beginner lesson is that a good operator applies the smallest fix that matches the evidence instead of making broad uncontrolled changes.",
        lookFor:[
          "A corrected HCA selection that matches the actual active device",
          "Removal of the mismatch between observed IB state and NCCL's chosen path",
          "A fix that directly addresses the selection problem you just validated"
        ],
        meaning:"The system is now being pointed at the right transport interface. If the prior evidence was correct, this should restore NCCL's ability to use the fast path.",
        changedFromPrevious:"The workflow moved from diagnosis into a narrowly targeted remediation based on evidence rather than guesswork.",
        justifiedConclusion:"If the path issue was selection-related, this fix should materially change the next NCCL run.",
        stillPremature:"It is still too early to declare success until the workload logs and bandwidth both confirm the path really changed.",
        thresholdCrossed:"The remediation threshold is crossed once a specific mismatch has been identified and corrected.",
        takeAction:[
          "Keep the fix tied to the exact HCA evidence you observed.",
          "Use the next step to prove the communication path actually changed.",
          "Think in terms of verify-after-change, not hope-after-change."
        ],
        avoid:[
          "Do not pile multiple environment edits on top of each other without verification.",
          "Do not call the issue solved merely because a config export was issued."
        ]
      },
      {
        label:"Verify Fixed",
        cmd:"NCCL_DEBUG=INFO torchrun",
        type:"fb_verify",
        deeperContext:"Verification is where remediation becomes trustworthy. This step teaches beginners that a change only counts when the system behavior changes in the expected direction.",
        lookFor:[
          "NCCL selecting the intended IB path instead of TCP",
          "A log story that now matches the fabric design",
          "Clear evidence that the prior fallback condition no longer applies"
        ],
        meaning:"If NCCL now selects the intended transport, the diagnosis and targeted fix were correct. The communication stack has moved back onto the expected path.",
        changedFromPrevious:"The evidence shifts from proposed fix to observed post-fix behavior.",
        justifiedConclusion:"The root cause was likely path selection or environment mismatch if the logs now show the proper transport.",
        stillPremature:"It is still too early to declare full performance recovery until bandwidth is compared against the healthy baseline.",
        thresholdCrossed:"The verification threshold is crossed when the software path changes in exactly the way the fix predicted.",
        takeAction:[
          "Use the logs to confirm the fix changed the actual transport choice.",
          "Preserve the before/after reasoning so the diagnosis remains teachable.",
          "Move to bandwidth comparison to prove user-visible recovery."
        ],
        avoid:[
          "Do not stop at log improvement if the real performance result still needs proof.",
          "Do not declare victory until the workload-visible throughput is checked."
        ]
      },
      {
        label:"Compare BW",
        cmd:"./perf",
        type:"fb_bench",
        deeperContext:"This final step closes the loop from symptom to fix to user-visible impact. Aegis should teach that the real success condition is restored throughput, not just prettier logs.",
        lookFor:[
          "Bandwidth moving back toward the healthy expected range",
          "A result that confirms the faster communication path matters to the actual workload",
          "A coherent before-and-after story that ties logs to performance"
        ],
        meaning:"Recovered bandwidth proves the issue was real, the diagnosis was grounded, and the remediation materially restored cluster efficiency.",
        changedFromPrevious:"The workflow moved from software-path verification to operational outcome verification.",
        justifiedConclusion:"The fallback incident is resolved only if the throughput returns to the expected performance envelope.",
        stillPremature:"It is still too early to call the environment permanently healthy until the improvement is repeatable across runs or jobs.",
        thresholdCrossed:"The recovery threshold is crossed once the bandwidth result confirms the path correction actually restored performance.",
        takeAction:[
          "Use the recovered bandwidth as the proof that the system is back on the right path.",
          "Tie remediation success to outcome, not just configuration state.",
          "Capture the before/after lesson so future fallbacks are diagnosed faster."
        ],
        avoid:[
          "Do not measure success only by whether logs look cleaner.",
          "Do not forget that users experience throughput, not just transport names."
        ]
      }
    ],
    draw: drawNCCLFallback
  },
  storage: {
    name: "Storage Bottleneck",
    icon: "💾",
    color: "#9b7fe8",
    objective: "Diagnose Sawtooth pattern.",
    steps: [
      {
        label:"Watch GPU Util",
        cmd:"nvidia-smi dmon -s u",
        type:"stor_gpu",
        deeperContext:"This drill starts where beginners usually start: the GPU. The teaching goal is to show that the most visible symptom is not always the root cause.",
        lookFor:[
          "Sawtooth or bursty GPU utilization instead of a stable high plateau",
          "Idle gaps between compute bursts",
          "A pattern suggesting the accelerator is waiting for something else"
        ],
        meaning:"The GPUs are not being fed smoothly. This is a symptom of starvation, not proof that the GPUs themselves are faulty.",
        justifiedConclusion:"There is a pipeline problem worth investigating, and the GPU symptom points upstream.",
        stillPremature:"It is still too early to blame storage specifically until I/O evidence supports that story.",
        thresholdCrossed:"The starvation-investigation threshold is crossed once utilization becomes visibly bursty instead of steady.",
        takeAction:[
          "Treat utilization shape as a clue, not a complete diagnosis.",
          "Follow the starvation trail into the input path.",
          "Use the next steps to identify which upstream stage is limiting throughput."
        ],
        avoid:[
          "Do not call the GPU broken just because utilization is low or bursty.",
          "Do not stop at the most visible symptom."
        ]
      },
      {
        label:"Check I/O",
        cmd:"iostat -x 1",
        type:"stor_io",
        deeperContext:"This step teaches cross-component reasoning. You are testing whether the waiting pattern you saw on the GPU side has a matching story on the storage side.",
        lookFor:[
          "High storage utilization or long wait patterns",
          "An I/O path that looks saturated while GPUs are bursty",
          "Evidence that the bottleneck is outside the accelerator itself"
        ],
        meaning:"If the storage side is saturated while GPU utilization is sawtoothing, the system now has a plausible storage-backed explanation for the training slowdown.",
        changedFromPrevious:"The investigation moved from symptom at the GPU to corroborating evidence in the I/O path.",
        justifiedConclusion:"The slowdown is increasingly likely to be storage-fed starvation rather than a GPU-compute problem.",
        stillPremature:"It is still too early to say the fix is obvious until you inspect how the dataset is laid out and fed.",
        thresholdCrossed:"The storage-suspicion threshold is crossed when I/O pressure aligns with the GPU starvation pattern.",
        takeAction:[
          "Use the I/O evidence to shift your mental model away from GPU fault-first thinking.",
          "Investigate data layout and feeder configuration next.",
          "Keep comparing symptoms across components rather than in isolation."
        ],
        avoid:[
          "Do not keep debugging GPU hardware if the I/O system is clearly saturated.",
          "Do not treat one metric alone as enough to finish the diagnosis."
        ]
      },
      {
        label:"Check Stripe",
        cmd:"lfs getstripe",
        type:"stor_lustre",
        deeperContext:"This step teaches that storage layout is part of performance reasoning. A dataset can sit on healthy hardware but still be laid out badly for the workload.",
        lookFor:[
          "A stripe count that is too narrow for the workload",
          "Dataset placement that would concentrate reads onto too few targets",
          "A concrete mechanical reason for why the I/O path is not scaling"
        ],
        meaning:"Poor striping can create an avoidable storage bottleneck by limiting parallelism in the data path. The problem is no longer just 'storage is busy'; it becomes 'storage is laid out suboptimally.'",
        changedFromPrevious:"The diagnosis moved from generic storage pressure to a specific layout-level cause.",
        justifiedConclusion:"A striping problem is now a grounded candidate root cause for the starvation pattern.",
        stillPremature:"It is still too early to say striping alone explains everything until you change it and observe improvement.",
        thresholdCrossed:"The layout-remediation threshold is crossed once the stripe configuration clearly conflicts with expected throughput needs.",
        takeAction:[
          "Tie the bottleneck story to the dataset layout, not just the storage appliance.",
          "Apply a narrow fix that increases data-path parallelism.",
          "Use the next steps to separate storage-layout gain from input-pipeline gain."
        ],
        avoid:[
          "Do not call the storage system universally bad if the dataset layout itself is poor.",
          "Do not jump to many application changes before fixing an obvious layout issue."
        ]
      },
      {
        label:"Fix: Stripe",
        cmd:"lfs setstripe -c 8",
        type:"stor_fix",
        deeperContext:"Now the workflow turns from diagnosis to targeted storage remediation. The beginner lesson is that fixes should correspond directly to the identified bottleneck mechanism.",
        lookFor:[
          "A striping change that increases expected data-path parallelism",
          "A fix that directly addresses the layout issue you just identified",
          "The setup needed for a meaningful before/after comparison"
        ],
        meaning:"You are increasing storage-side parallelism so reads can spread more effectively across targets. This should reduce one major source of starvation if striping was the limiting factor.",
        changedFromPrevious:"The workflow moved from layout diagnosis into a targeted storage-layout remediation.",
        justifiedConclusion:"If striping was a major bottleneck, the system should now be capable of feeding GPUs more smoothly than before.",
        stillPremature:"It is still too early to call the issue solved because the data loader may still underfeed the GPUs even after the stripe fix.",
        thresholdCrossed:"The storage-remediation threshold is crossed when the layout mismatch is specific enough to justify changing it.",
        takeAction:[
          "Treat this as one controlled performance intervention.",
          "Keep the next tuning step separate so you can learn what each change contributed.",
          "Verify the workload effect instead of assuming the stripe change was sufficient."
        ],
        avoid:[
          "Do not change striping and loader settings simultaneously if you want a trustworthy causal read.",
          "Do not assume a storage-side fix automatically eliminates all starvation."
        ]
      },
      {
        label:"Tune Workers",
        cmd:"# num_workers=16",
        type:"stor_dl",
        deeperContext:"This step teaches that the input pipeline is part of the same story. Even after storage layout improves, the DataLoader can remain the bottleneck if it cannot parallelize enough work to keep the GPUs fed.",
        lookFor:[
          "Whether the data feeder itself is still underutilizing the improved storage path",
          "A loader configuration that could limit batch delivery",
          "The distinction between storage bandwidth and input-pipeline throughput"
        ],
        meaning:"The bottleneck may be partly in the data loader layer, not just in the storage layout. This step teaches that end-to-end feeding requires both a healthy path and a capable feeder.",
        changedFromPrevious:"The reasoning moved from storage-layout correction into feeder-layer optimization.",
        justifiedConclusion:"A full recovery may require both storage tuning and application-side input parallelism.",
        stillPremature:"It is still too early to say the pipeline is fixed until GPU utilization actually becomes smoother in the verification step.",
        thresholdCrossed:"The pipeline-optimization threshold is crossed when storage-side fixes alone are not enough to guarantee smooth GPU feeding.",
        takeAction:[
          "Use this step to teach that one bottleneck can hand off to another upstream stage.",
          "Tune loader parallelism as a distinct hypothesis, not as a random extra tweak.",
          "Prepare to verify on the GPU side again."
        ],
        avoid:[
          "Do not assume storage and DataLoader are the same problem.",
          "Do not lose track of which intervention changed which part of the pipeline."
        ]
      },
      {
        label:"Verify Fix",
        cmd:"nvidia-smi dmon",
        type:"stor_verify",
        deeperContext:"Verification closes the loop. The final proof is not that settings changed, but that the GPU now receives data smoothly enough to stay busy.",
        lookFor:[
          "Higher and smoother GPU utilization than the original sawtooth baseline",
          "Reduced idle gaps between work bursts",
          "A visible before/after improvement that matches the storage and loader changes"
        ],
        meaning:"Smoother GPU utilization means the pipeline is feeding the accelerator more effectively. This proves the diagnosis and remediation addressed the true limiting path.",
        changedFromPrevious:"The workflow moved from applying fixes to verifying whether end-to-end workload behavior improved.",
        justifiedConclusion:"The storage and input pipeline have improved enough to restore healthier GPU feeding if utilization smooths out as expected.",
        stillPremature:"It is still too early to assume the system is fully optimized for every workload, but the original starvation story is now materially improved.",
        thresholdCrossed:"The recovery threshold is crossed once the GPU-side symptom improves in a way that matches the storage-side remediation story.",
        takeAction:[
          "Use the GPU utilization shape as the final proof that the right bottleneck was fixed.",
          "Explain the complete causal chain from storage layout to loader tuning to accelerator behavior.",
          "Capture the healthy post-fix pattern as a new comparison baseline."
        ],
        avoid:[
          "Do not declare success based only on changed settings without workload-visible improvement.",
          "Do not forget that the end user cares about throughput, not just cleaner infrastructure metrics."
        ]
      }
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
