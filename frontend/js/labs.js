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
        screenshotReference:"Start with the topology snapshot and verify that the matrix stays dominated by NV4 entries. If your eyes land on PHB or another weaker path in the screenshot, treat that as a topology problem before you even benchmark.",
        screenshots:[
          {
            title:"Healthy DGX-style topology capture",
            caption:"Read this like a screenshot, not a wall of text. The key clue is that GPU neighbors keep showing NV4, which means the node is still on the intended fast path.",
            lines:[
              "GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7  CPU Affinity",
              "GPU0   X    NV4   NV4   NV4   NV4   NV4   NV4   NV4   0-95",
              "GPU1  NV4    X    NV4   NV4   NV4   NV4   NV4   NV4   0-95",
              "GPU2  NV4   NV4    X    NV4   NV4   NV4   NV4   NV4   0-95",
              "GPU3  NV4   NV4   NV4    X    NV4   NV4   NV4   NV4   0-95",
              "GPU4  NV4   NV4   NV4   NV4    X    NV4   NV4   NV4   96-191",
              "GPU5  NV4   NV4   NV4   NV4   NV4    X    NV4   NV4   96-191",
              "GPU6  NV4   NV4   NV4   NV4   NV4   NV4    X    NV4   96-191",
              "GPU7  NV4   NV4   NV4   NV4   NV4   NV4   NV4    X    96-191"
            ]
          }
        ],
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
        screenshotReference:"Use the snapshot to scan for the one thing that matters first: clean zeroed counters. If a row in the screenshot breaks that pattern, that is the link you should distrust before moving on.",
        screenshots:[
          {
            title:"Healthy NVLink counter capture",
            caption:"This screenshot is healthy because the important error counters stay at zero. Treat any future non-zero CRC or replay value as a hardware-path clue, not just noisy output.",
            lines:[
              "GPU 0, Link 0: CRC FLIT Error Count: 0",
              "GPU 0, Link 0: Replay Error Count:   0",
              "GPU 1, Link 2: CRC FLIT Error Count: 0",
              "GPU 1, Link 2: Replay Error Count:   0",
              "GPU 4, Link 1: CRC FLIT Error Count: 0",
              "GPU 4, Link 1: Replay Error Count:   0",
              "GPU 7, Link 3: CRC FLIT Error Count: 0",
              "GPU 7, Link 3: Replay Error Count:   0"
            ]
          }
        ],
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
        screenshotReference:"Read the benchmark snapshot as the operational proof of the earlier healthy screenshots. The bandwidth line should look strong enough that it does not contradict the clean topology and clean counter story.",
        screenshots:[
          {
            title:"Healthy all-reduce benchmark capture",
            caption:"This is the healthy reference screenshot for later comparison. The exact number can vary by platform, but it should still look like a strong NVLink-backed result instead of a collapsed fallback path.",
            lines:[
              "# nThread 1 nGpus 8 minBytes 1073741824 maxBytes 4294967296 step: 2(factor) warmup iters: 5 iters: 20",
              "     size         count    type   redop    root      time   algbw   busbw  #wrong",
              "1073741824   268435456   float    sum      -1    11.82 ms  181.7   181.7    0",
              "2147483648   536870912   float    sum      -1    23.45 ms  183.1   183.1    0",
              "4294967296  1073741824   float    sum      -1    46.91 ms  182.7   182.7    0",
              "# Avg bus bandwidth : 182.5 GB/s"
            ]
          }
        ],
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
        screenshotReference:"Compare this degraded snapshot against the first topology screenshot. The important move is noticing that NV4 gave way to PHB, because that visual shift explains why the workload is about to slow down.",
        screenshots:[
          {
            title:"Degraded topology after PHB fallback",
            caption:"This screenshot is bad because the communication contract changed. Once PHB appears where NV4 used to dominate, the node is no longer on the intended fast path.",
            lines:[
              "GPU0  GPU1  GPU2  GPU3  GPU4  GPU5  GPU6  GPU7  CPU Affinity",
              "GPU0   X    PHB   PHB   PHB   PHB   PHB   PHB   PHB   0-95",
              "GPU1  PHB    X    PHB   PHB   PHB   PHB   PHB   PHB   0-95",
              "GPU2  PHB   PHB    X    PHB   PHB   PHB   PHB   PHB   0-95",
              "GPU3  PHB   PHB   PHB    X    PHB   PHB   PHB   PHB   0-95",
              "GPU4  PHB   PHB   PHB   PHB    X    PHB   PHB   PHB   96-191",
              "GPU5  PHB   PHB   PHB   PHB   PHB    X    PHB   PHB   96-191",
              "GPU6  PHB   PHB   PHB   PHB   PHB   PHB    X    PHB   96-191",
              "GPU7  PHB   PHB   PHB   PHB   PHB   PHB   PHB    X    96-191"
            ]
          }
        ],
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
        screenshotReference:"Use the NCCL snapshot to confirm what the degraded topology screenshot already suggested. When the log starts naming socket or fallback behavior, treat it as software evidence that matches the earlier hardware-path break.",
        screenshots:[
          {
            title:"NCCL fallback log capture",
            caption:"This is the software-layer echo of the PHB downgrade. The important part is not the volume of logs, but the fact that the transport story now looks slower and less direct than the healthy baseline.",
            lines:[
              "NCCL INFO Channel 00/08 : 0[0] -> 1[1] via SHM/direct/direct",
              "NCCL INFO NET/IB : No device found for requested path, falling back",
              "NCCL INFO NET/Socket : Using eth0:10.0.0.24<0>",
              "NCCL INFO Trees [0] -1/-1/-1->7->6",
              "NCCL INFO Connected all rings using fallback transport",
              "NCCL WARN Collective bandwidth below expected NVLink baseline"
            ]
          }
        ],
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
        screenshotReference:"Use the snapshot to confirm that MIG mode actually flipped on at the device level. The key clue is the explicit enabled state, because everything else in this lab depends on that hardware transition happening first.",
        screenshots:[
          {
            title:"MIG mode enabled confirmation",
            caption:"This screenshot matters because it proves the GPU itself accepted the mode change. Without this confirmation, any later slice-creation command is built on the wrong assumption.",
            lines:[
              "Enabled MIG Mode for GPU 00000000:17:00.0",
              "All done.",
              "",
              "GPU  GI  CI  MIG",
              "  0   -   -  Enabled"
            ]
          }
        ],
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
        screenshotReference:"Read the creation snapshot as proof of exactly what layout you asked the GPU to build. If the screenshot does not show seven created instances, do not mentally round it up and assume the layout is correct.",
        screenshots:[
          {
            title:"Seven MIG instances created",
            caption:"The important thing in this screenshot is count and repeatability. You want the command output to show that all requested instances were created, not just that the command returned successfully.",
            lines:[
              "Successfully created GPU instance ID 1 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 2 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 3 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 4 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 5 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 6 on GPU 0 using profile MIG 1g.10gb",
              "Successfully created GPU instance ID 7 on GPU 0 using profile MIG 1g.10gb"
            ]
          }
        ],
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
        screenshotReference:"Use the listing snapshot as your verification source of truth. The important move is matching the visible seven instances in the screenshot against the seven-instance plan you thought you created one step earlier.",
        screenshots:[
          {
            title:"Verified MIG instance listing",
            caption:"This screenshot is the confirmation step, not a duplicate of the create command. Operators trust the listing because it reflects resulting hardware state rather than command intent.",
            lines:[
              "GPU 0  GPU instance ID 1  Profile 1g.10gb  Placement Start:0 Size:1",
              "GPU 0  GPU instance ID 2  Profile 1g.10gb  Placement Start:1 Size:1",
              "GPU 0  GPU instance ID 3  Profile 1g.10gb  Placement Start:2 Size:1",
              "GPU 0  GPU instance ID 4  Profile 1g.10gb  Placement Start:3 Size:1",
              "GPU 0  GPU instance ID 5  Profile 1g.10gb  Placement Start:4 Size:1",
              "GPU 0  GPU instance ID 6  Profile 1g.10gb  Placement Start:5 Size:1",
              "GPU 0  GPU instance ID 7  Profile 1g.10gb  Placement Start:6 Size:1"
            ]
          }
        ],
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
        screenshotReference:"Treat the assignment snapshot as an operating model, not a shell transcript. The value is seeing which teams consume which slices so you can reason about isolation and oversubscription at a glance.",
        screenshots:[
          {
            title:"Example tenant-to-slice assignment",
            caption:"This is a policy screenshot rather than a low-level device output. Its job is to make the sharing model visible enough that a beginner can reason about blast radius and fairness.",
            lines:[
              "Team A -> GI 1, GI 2",
              "Team B -> GI 3, GI 4",
              "Team C -> GI 5, GI 6, GI 7",
              "Isolation boundary: each team stays within assigned MIG instances"
            ]
          }
        ],
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
        screenshotReference:"Use the cleanup snapshot to verify that the hardware contract really changed back to full-device mode. If the screenshot still suggests MIG is enabled, do not assume cleanup happened just because you expected it to.",
        screenshots:[
          {
            title:"MIG disabled and full GPU restored",
            caption:"This screenshot matters because cleanup is a hardware state change too. The operator should confirm that the device really returned to full-GPU mode before declaring the reset complete.",
            lines:[
              "Disabled MIG Mode for GPU 00000000:17:00.0",
              "All done.",
              "",
              "GPU  GI  CI  MIG",
              "  0   -   -  Disabled"
            ]
          }
        ],
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the baseline snapshot to lock in what healthy looks like before any fault appears. The important pattern is simple: SBE and DBE stay at zero across the whole visible polling window.",
        screenshots:[
          {
            title:"Healthy ECC baseline capture",
            caption:"This is the clean reference screenshot for the rest of the lifecycle. Later screenshots only matter because this one established what normal looked like first.",
            lines:[
              "# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL",
              "0         0    0                    0",
              "1         0    0                    0",
              "2         0    0                    0",
              "3         0    0                    0",
              "4         0    0                    0"
            ]
          }
        ],
        whatsHappening:"You are checking the GPU's memory health before any failure signs appear. This gives you the clean reference point for everything that comes later.",
        deeperContext:"ECC work starts with a baseline. Beginners need to see normal first, because later counts only matter if you know what healthy memory looked like at the start.",
        lookFor:[
          "Field 156 (SBE) staying at 0 across the polling window",
          "Field 157 (DBE) staying at 0 with no sudden jumps",
          "Stable output that tells you the GPU is not already in a degraded memory state"
        ],
        meaning:"A clean baseline means the card is healthy right now. You are proving that both corrected and uncorrected ECC counters start from zero before degradation begins.",
        commonMistake:"Skipping the baseline and trying to judge later numbers in isolation. Without a clean starting point, it is much harder to tell whether the memory story is getting worse.",
        operatorTakeaway:"Operators establish normal first. A later rise only matters because you already proved what healthy looked like on this card.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Compare this warning snapshot to the baseline snapshot. The key visual change is that SBE started climbing while DBE stayed at zero, which means the memory story worsened without yet crossing into uncorrectable territory.",
        screenshots:[
          {
            title:"Corrected-error warning phase",
            caption:"This is the warning screenshot, not the catastrophic one. The learner should notice that only the corrected side is climbing, which is exactly why this step is about trend recognition rather than panic.",
            lines:[
              "# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL",
              "0         0    4                    0",
              "1         0    7                    0",
              "2         0    11                   0",
              "3         0    15                   0",
              "4         0    19                   0"
            ]
          }
        ],
        whatsHappening:"You are seeing corrected memory errors begin to accumulate. The GPU is still fixing them, but the memory is no longer perfectly clean.",
        deeperContext:"This is the early-warning phase. Single-bit ECC errors are usually corrected automatically, so the workload may keep running. That is exactly why beginners need to learn that corrected does not mean harmless forever.",
        lookFor:[
          "The SBE counter climbing while DBE is still 0",
          "A pattern of repeat corrected errors instead of one random blip",
          "A card that still appears usable even though the memory story is getting worse"
        ],
        meaning:"Rising SBE counts mean the GPU is catching and fixing bad bits, but the memory path is no longer perfectly healthy. This is a warning trend, not yet a hard stop.",
        commonMistake:"Saying 'the GPU fixed it, so there is no issue.' A repeated corrected-error trend is exactly how weakening memory often introduces itself before a harder failure.",
        operatorTakeaway:"This is the moment to stop passively trusting the card. You are now in monitoring-and-preparation mode, not healthy-baseline mode.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the longer trend snapshot to answer a time-based question: is the SBE rise persisting? The screenshot should look worse than the prior warning snapshot in a way that proves the memory story is continuing, not resetting.",
        screenshots:[
          {
            title:"Persistent ECC trend capture",
            caption:"This screenshot matters because it shows persistence over a longer poll window. The issue is no longer a single corrected blip once the counter keeps stepping upward sample after sample.",
            lines:[
              "# Entity  GPU  FBECC_SBE_VOL_TOTAL  FBECC_DBE_VOL_TOTAL",
              "0         0    21                   0",
              "1         0    25                   0",
              "2         0    31                   0",
              "3         0    38                   0",
              "4         0    46                   0",
              "5         0    53                   0",
              "6         0    61                   0"
            ]
          }
        ],
        whatsHappening:"You are checking whether the corrected-error rise was a one-off event or a persistent trend.",
        deeperContext:"This step teaches that operations work is about observing the direction of change. A longer poll window helps beginners see whether the SBE rise is a persistent pattern instead of a one-time event.",
        lookFor:[
          "Whether field 156 keeps increasing over repeated samples",
          "Whether field 157 remains 0 or begins to change",
          "Whether the error pattern looks stable, worsening, or suddenly accelerating"
        ],
        meaning:"If SBE keeps climbing across repeated polls, the card is trending the wrong way. The memory story is now persistent enough to treat as real evidence, not random noise.",
        commonMistake:"Looking at one row of output and ignoring the time dimension. ECC troubleshooting is often about rate and persistence, not just absolute count.",
        operatorTakeaway:"At this stage, the operator question becomes: is this card still safe to keep in service while I watch it, or is it moving toward containment territory?",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the XID snapshot to identify the moment the ECC story crosses into a hard fault. The visual clue is the explicit XID 48 line, because that line changes the operator response from watch closely to contain now.",
        screenshots:[
          {
            title:"Hard fault transition: XID 48",
            caption:"This screenshot is the inflection point of the lifecycle. It is no longer just a counter trend; the driver is now reporting an uncorrectable fault event directly.",
            lines:[
              "[86423.441] NVRM: Xid (PCI:0000:17:00): 48, pid=42117, name=python3, DBE detected on GPU memory",
              "[86423.442] NVRM: GPU 00000000:17:00.0: Uncorrectable ECC error detected",
              "[86423.447] NVRM: A GPU crash dump has been created"
            ]
          }
        ],
        whatsHappening:"You are seeing the memory warning story turn into a hard NVIDIA fault event. This is where the situation changes from monitor-and-watch to contain-and-protect.",
        deeperContext:"This is the inflection point where the lifecycle stops being just a warning trend and becomes a hard fault. XID 48 is the moment beginners must connect the jargon, the ECC counters, and the operational consequence.",
        lookFor:[
          "An XID 48 entry in dmesg tied to the affected GPU",
          "Evidence that the event is now an uncorrectable memory failure, not only corrected SBEs",
          "The shift from monitoring mode to immediate containment mode"
        ],
        meaning:"XID 48 usually indicates a double-bit ECC event, which is uncorrectable. The GPU could not safely repair the corruption, so this is now a hardware-integrity incident, not just a warning trend.",
        commonMistake:"Explaining XID 48 as just another ECC warning. It is materially more serious than rising corrected errors because the GPU could not guarantee clean data anymore.",
        operatorTakeaway:"This is the line where the node stops being safe for fresh work. Once the memory story crosses into uncorrectable territory, containment becomes the operator priority.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the drain snapshot to distinguish containment from repair. The key thing to notice is scheduler removal language in the screenshot, because that tells you the cluster is being protected even though the GPU itself is not fixed yet.",
        screenshots:[
          {
            title:"Containment via node drain",
            caption:"This screenshot is about blast-radius control. It shows the cluster moving the bad node out of service so new workloads stop landing on known-unsafe hardware.",
            lines:[
              "node/gpu-node-03 cordoned",
              "evicting pod training-job-7f9d6c7d8f-2pkhq",
              "evicting pod inference-batch-42-6dd79b8b9d-r2k4v",
              "node/gpu-node-03 drained"
            ]
          }
        ],
        whatsHappening:"You are taking the node out of normal scheduling so new jobs do not land on hardware that is no longer safe to trust.",
        deeperContext:"This final step teaches containment. The beginner lesson is that the job of an operator is not only to diagnose the bad card, but also to protect the rest of the cluster from landing new work on a known-bad node.",
        lookFor:[
          "The scheduler stopping new workloads from landing on the affected node",
          "A clear separation between diagnosis and containment responsibilities",
          "The system moving into a safe state while deeper remediation or RMA is prepared"
        ],
        meaning:"Draining the node does not fix the GPU. It protects users and workloads by taking unstable hardware out of normal service until the incident is fully handled.",
        commonMistake:"Confusing draining with repair. Containment only controls blast radius. The hardware issue still has to be remediated and validated separately.",
        operatorTakeaway:"At this point the priority is no longer collecting more evidence on a live node. It is protecting the cluster and moving the incident into remediation.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the alert snapshot to identify the fault family before you start reacting. The important cue is the XID 48 line itself, because it tells you this drill is starting in the uncorrectable-memory branch rather than a bus or fabric branch.",
        screenshots:[
          {
            title:"XID 48 alert capture",
            caption:"This screenshot is the opening clue, not the whole diagnosis. Its job is to orient the operator to the likely fault family quickly and accurately.",
            lines:[
              "[92741.102] NVRM: Xid (PCI:0000:17:00): 48, pid=16742, name=python3, DBE detected",
              "[92741.104] NVRM: GPU 00000000:17:00.0: Uncorrectable ECC error reported",
              "[92741.105] NVRM: RmInitAdapter failed during fault handling"
            ]
          }
        ],
        whatsHappening:"You are seeing an XID 48 alert, which is the first sign that this incident may be an uncorrectable memory problem rather than a routine slowdown.",
        deeperContext:"This drill starts with a memory-integrity alert. The beginner goal is to stop treating XID numbers as mysterious codes and instead see them as operator signals with specific severity and response expectations.",
        lookFor:[
          "An XID 48 event tied to a specific GPU",
          "A log entry that points toward uncorrectable ECC behavior rather than a generic slowdown",
          "The need to move from interpretation into confirmation"
        ],
        meaning:"XID 48 is a serious memory fault signal and usually points toward double-bit ECC failure. It is not just another warning event.",
        commonMistake:"Treating the code like random jargon or like a generic performance warning. XID 48 is already telling you this may be a hardware-integrity problem.",
        operatorTakeaway:"The right response is not to guess, but to confirm quickly. This alert is strong enough that immediate evidence gathering is justified.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the confirmation snapshot to check whether the DBE counter moved off zero. That screenshot matters because it upgrades the incident from a plausible XID story to a grounded uncorrectable-ECC diagnosis.",
        screenshots:[
          {
            title:"DBE confirmation capture",
            caption:"The entire point of this screenshot is alignment. Once the DBE field is non-zero, the log alert and the hardware counter evidence are telling the same story.",
            lines:[
              "# Entity  GPU  FBECC_DBE_VOL_TOTAL",
              "0         0    1",
              "1         0    1",
              "2         0    1"
            ]
          }
        ],
        whatsHappening:"You are checking whether the XID 48 alert is backed by uncorrectable ECC counter evidence.",
        deeperContext:"This is the confirmation step that separates suspicion from grounded incident response. It teaches beginners that a strong operator decision should be backed by a second, independent evidence source when possible.",
        lookFor:[
          "Field 157 showing DBE activity instead of staying at 0",
          "Alignment between the XID alert and ECC counter evidence",
          "A hardware-integrity story that is now evidence-backed rather than inferred"
        ],
        meaning:"DBE confirmation turns the XID 48 alert into a grounded uncorrectable-memory incident. The system now has both log evidence and hardware-counter evidence pointing the same way.",
        commonMistake:"Continuing to talk about the incident as hypothetical once DBE is confirmed. At this point the evidence is aligned and the memory fault is real.",
        operatorTakeaway:"This is where the response becomes grounded enough for containment and hardware-style escalation. You are no longer just investigating.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the XID 79 snapshot to recognize that the failure shape changed. The key clue is the bus-or-hang language in the screenshot, because that points you toward reset-style recovery instead of more ECC reasoning.",
        screenshots:[
          {
            title:"GPU hang / bus-loss alert",
            caption:"This screenshot is useful because it looks different from the ECC fault screenshots. The operator should learn to notice that difference quickly and change recovery logic accordingly.",
            lines:[
              "[93111.772] NVRM: Xid (PCI:0000:65:00): 79, GPU has fallen off the bus",
              "[93111.774] NVRM: GPU 00000000:65:00.0 is no longer responding to commands",
              "[93111.776] NVRM: RmInitAdapter failed! (0x26:0xffff:1290)"
            ]
          }
        ],
        whatsHappening:"You are seeing a different fault family now: the GPU appears hung or has fallen off the bus, which is a stability and reachability problem rather than a memory-integrity trend.",
        deeperContext:"Now the drill changes fault family. Beginners should learn that not all XIDs mean the same thing: XID 79 is a stability and bus-reachability problem, not an ECC-memory story.",
        lookFor:[
          "Evidence that the GPU is hung or has fallen off the bus",
          "A different failure shape than the earlier ECC incident",
          "The need for a reset-style recovery path instead of just containment"
        ],
        meaning:"XID 79 usually means the GPU became unreachable on the bus. This is a severe stability event and often requires reset or reboot behavior rather than memory-RMA reasoning.",
        commonMistake:"Responding to XID 79 as if it were just another ECC case. It is a different failure shape, so the recovery logic has to change too.",
        operatorTakeaway:"The node may need recovery, but you still start with the least disruptive justified action. For this fault family, that usually means testing a reset path first.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Read the reset snapshot as a branch point, not as a victory screen. The important question is whether the screenshot shows clean reset success or continued unreachable-state language that forces the next escalation step.",
        screenshots:[
          {
            title:"Targeted GPU reset attempt",
            caption:"This snapshot is about conditional recovery. Its value is telling you whether the incident can stay GPU-scoped or whether it just proved the node needs a more disruptive action.",
            lines:[
              "Resetting GPU 00000000:65:00.0",
              "GPU Reset couldn't complete because the device is not responding",
              "Suggested next action: reboot the node before returning GPU to service"
            ]
          }
        ],
        whatsHappening:"You are testing whether the hung GPU can be recovered with a targeted reset instead of a whole-node reboot.",
        deeperContext:"This step teaches conditional recovery: not every severe fault goes straight to reboot. Beginners should learn that the operator tests the least disruptive justified recovery action first when the fault family supports it.",
        lookFor:[
          "Whether the GPU reset succeeds or fails cleanly",
          "Whether the device becomes reachable again after reset",
          "Whether the incident remains local to one GPU or implies a wider node issue"
        ],
        meaning:"A successful reset means the GPU-hang path may be recoverable without full node reboot. A failed reset pushes the incident into a more disruptive recovery tier.",
        commonMistake:"Treating the reset attempt itself as proof of recovery. The point of this step is to answer whether the fault can stay GPU-scoped or must escalate.",
        operatorTakeaway:"Reset outcome is what drives the next escalation level. This is an evidence-based branch point, not a ritual command.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the XID 74 snapshot to distinguish fabric trouble from memory or bus trouble. The key move is spotting non-zero link-error counters in the screenshot and treating them as communication-path evidence.",
        screenshots:[
          {
            title:"NVLink fault evidence capture",
            caption:"This screenshot is about path quality, not device disappearance. The GPUs can still exist while the communication path between them becomes unhealthy enough to hurt production traffic.",
            lines:[
              "GPU 2, Link 1: CRC FLIT Error Count: 184",
              "GPU 2, Link 1: Replay Error Count:   27",
              "GPU 5, Link 0: CRC FLIT Error Count: 191",
              "GPU 5, Link 0: Replay Error Count:   29"
            ]
          }
        ],
        whatsHappening:"You are looking at a third fault family: an interconnect problem where the GPUs may still exist, but the fabric between them is degraded.",
        deeperContext:"The final step introduces a third fault family: interconnect faults. This teaches that XID literacy includes understanding whether the problem is memory, device stability, or fabric communication.",
        lookFor:[
          "NVLink CRC or related link-error evidence tied to the fault",
          "A communication-path issue rather than a pure GPU-compute failure",
          "Hardware-link symptoms that can degrade collectives without fully crashing the node"
        ],
        meaning:"XID 74 usually points to NVLink link trouble such as CRC errors. This is a fabric-quality incident and should be reasoned about as a communication-path problem.",
        commonMistake:"Lumping XID 74 together with memory or bus faults as if the response were identical. Fabric faults need path reasoning, not just reset or RMA reflexes.",
        operatorTakeaway:"A node can still compute locally while its GPU-to-GPU communication path is compromised. That is why operators treat fabric faults as production problems even when the box is still online.",
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
      {
        label:"Check Driver",
        cmd:"cat /proc/driver/nvidia/version",
        type:"driver_ver",
        explainerMode:"beginner_story",
        screenshotReference:"Use the driver snapshot as the bottom anchor of the stack. The key clue is the exact NVIDIA driver version, because every later compatibility judgment depends on it.",
        screenshots:[
          {
            title:"Driver layer identified",
            caption:"This screenshot is the foundation of the software stack story. If the driver version is unknown or missing, everything above it becomes guesswork.",
            lines:[
              "NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54.15",
              "GCC version:  gcc version 11.4.1 20231218 (Red Hat 11.4.1-3)",
              "Kernel module build: Tue Mar 19 18:42:11 UTC 2026"
            ]
          }
        ],
        whatsHappening:"You are checking the lowest visible software layer that connects the operating system to the GPU.",
        deeperContext:"The driver is the base of the stack. Beginners need to start here because if the driver layer is wrong or missing, every higher layer can fail in confusing ways.",
        lookFor:[
          "A clear NVIDIA driver version string",
          "Evidence that the operating system can actually talk to the GPU",
          "A concrete version you can compare against CUDA and framework expectations later"
        ],
        meaning:"This step establishes whether the base GPU software layer is present and identifiable.",
        commonMistake:"Jumping straight to PyTorch or training code without first confirming the driver layer exists and has a known version.",
        operatorTakeaway:"Operators start from the bottom of the stack. If the base layer is uncertain, every higher-layer error becomes harder to trust.",
        takeAction:[
          "Record the exact driver version.",
          "Use it as the first anchor in the compatibility chain.",
          "Keep later version checks tied back to this base layer."
        ],
        avoid:[
          "Do not describe the driver as just 'old' or 'new' without the version.",
          "Do not blame frameworks before the driver is confirmed."
        ]
      },
      {
        label:"Check CUDA",
        cmd:"nvcc --version",
        type:"cuda_ver",
        explainerMode:"beginner_story",
        screenshotReference:"Read the CUDA snapshot against the driver snapshot, not in isolation. The important thing is whether the CUDA toolkit version looks plausible on top of the driver you already saw.",
        screenshots:[
          {
            title:"CUDA toolkit version capture",
            caption:"The point of this screenshot is compatibility context. CUDA version text only becomes meaningful once you compare it to the driver and framework layers.",
            lines:[
              "nvcc: NVIDIA (R) Cuda compiler driver",
              "Cuda compilation tools, release 12.4, V12.4.131",
              "Build cuda_12.4.r12.4/compiler.34097967_0"
            ]
          }
        ],
        whatsHappening:"You are checking whether the CUDA toolkit/runtime layer matches the driver and exposes a usable CUDA environment.",
        deeperContext:"This is the layer many beginners think of first, but it only makes sense after the driver is known. The operator question here is whether the runtime layer fits the driver layer you already observed.",
        lookFor:[
          "A concrete CUDA version",
          "No obvious mismatch between CUDA and the known driver baseline",
          "A runtime/toolkit level that could plausibly support the intended framework"
        ],
        meaning:"This step checks the next compatibility link in the chain: the CUDA layer above the driver.",
        commonMistake:"Treating CUDA version output as meaningful by itself. It only matters in relation to the driver below it and the framework above it.",
        operatorTakeaway:"Operators compare layers, not isolated facts. The CUDA version becomes useful only when tied to the driver and framework contract.",
        takeAction:[
          "Compare CUDA against the driver you already recorded.",
          "Use the exact version in later compatibility reasoning.",
          "Keep moving upward one layer at a time."
        ],
        avoid:[
          "Do not stop at 'CUDA is installed' as if that proves compatibility.",
          "Do not change the CUDA layer before checking the framework layer above it."
        ]
      },
      {
        label:"Check PyTorch",
        cmd:"python3 -c \"import torch\"",
        type:"torch_check",
        explainerMode:"beginner_story",
        screenshotReference:"Use the framework snapshot as the user-facing proof step. The important move is checking whether PyTorch both imports and reports CUDA visibility instead of assuming the lower layers guarantee that automatically.",
        screenshots:[
          {
            title:"Framework sees CUDA successfully",
            caption:"This screenshot matters because it upgrades the stack story from plausible to usable. Users care about whether the framework can really talk to CUDA, not just whether nvcc prints a version.",
            lines:[
              ">>> import torch",
              ">>> torch.__version__",
              "'2.4.0+cu124'",
              ">>> torch.cuda.is_available()",
              "True",
              ">>> torch.cuda.get_device_name(0)",
              "'NVIDIA H100 80GB HBM3'"
            ]
          }
        ],
        whatsHappening:"You are checking whether the framework layer can actually use the CUDA stack you just verified below it.",
        deeperContext:"This is where the stack becomes user-visible. A framework may import, fail, or partially see CUDA depending on whether the lower layers truly match what it expects.",
        lookFor:[
          "Successful framework import",
          "Framework visibility into CUDA and the GPU",
          "Whether the software users actually run is aligned with the lower layers"
        ],
        meaning:"This step tests whether the framework layer is compatible enough to sit on top of the driver and CUDA layers.",
        commonMistake:"Assuming the stack is good because CUDA tools worked. Users care about whether the framework works, not only whether `nvcc` prints a version.",
        operatorTakeaway:"The framework layer is where stack mismatches become operationally visible to users. A healthy lower stack still has to prove itself here.",
        takeAction:[
          "Use framework behavior as the user-facing proof step.",
          "Compare framework results against the lower-layer versions you already collected.",
          "If this layer breaks, reason downward before touching everything."
        ],
        avoid:[
          "Do not assume a framework failure is automatically a hardware issue.",
          "Do not change multiple stack layers before identifying which contract broke."
        ]
      },
      {
        label:"Fault: Mismatch",
        cmd:"# Simulating version mismatch",
        type:"cuda_mismatch",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Treat the mismatch snapshot as a software-contract failure, not a hardware failure. The visual cue is the explicit unsupported-version language, because that tells you the stack layers disagree even if the GPU is healthy.",
        screenshots:[
          {
            title:"Framework/stack mismatch failure",
            caption:"This screenshot is valuable because it keeps the diagnosis in the software layer. The GPU can still be fine while the framework refuses to use it due to a version contract break.",
            lines:[
              "RuntimeError: CUDA driver version is insufficient for CUDA runtime version",
              "PyTorch built against CUDA 12.4, detected runtime support is incompatible",
              "Suggested action: use a validated container image or align driver/CUDA/framework versions"
            ]
          }
        ],
        whatsHappening:"You are seeing what a real compatibility break looks like when one layer in the software chain no longer matches the others.",
        deeperContext:"This is the main teaching moment in the lab. The GPU may be healthy, the node may be online, and the stack can still fail because the layers no longer agree on what is supported.",
        lookFor:[
          "A clear mismatch signal between framework and lower software layers",
          "An error that points to unsupported versions, missing support, or wrong architecture targeting",
          "A failure story that is software-contract based rather than hardware-integrity based"
        ],
        meaning:"The stack contract is broken. This is a compatibility problem, not necessarily a GPU hardware problem.",
        commonMistake:"Escalating immediately as a hardware incident because the failure mentions CUDA or the GPU. In this lab, the fault is the software chain, not the silicon.",
        operatorTakeaway:"A healthy GPU can still be unusable to workloads if the software stack is mismatched. Operators have to protect the cluster from false hardware blame here.",
        takeAction:[
          "Describe the problem as a compatibility break, not a generic GPU failure.",
          "Keep the diagnosis tied to the layer mismatch you observed.",
          "Move to a validated image or known-good stack rather than random upgrades."
        ],
        avoid:[
          "Do not upgrade or downgrade multiple layers blindly.",
          "Do not take healthy hardware out of service before proving the fault is not just a stack contract problem."
        ]
      },
      {
        label:"Fix with NGC",
        cmd:"docker pull nvcr.io/nvidia/pytorch",
        type:"ngc_fix",
        explainerMode:"beginner_story",
        screenshotReference:"Use the NGC snapshot as proof that you moved onto a validated software baseline. The important thing is not just that an image pulled, but that the source and tag now give you a known-good compatibility contract.",
        screenshots:[
          {
            title:"Validated NGC image selected",
            caption:"This screenshot is about narrowing uncertainty. A validated image reduces the stack search space and gives you a tested baseline to compare against the failing custom stack.",
            lines:[
              "Using default tag: 24.03-py3",
              "24.03-py3: Pulling from nvidia/pytorch",
              "Digest: sha256:3df6d5b7c8b1e81f2e66f4a31d2b4b2b6f0d0f4f9a6b7e9f8d2a7a4c5e3c9b1a",
              "Status: Downloaded newer image for nvcr.io/nvidia/pytorch:24.03-py3"
            ]
          }
        ],
        whatsHappening:"You are switching to a validated NVIDIA container image to collapse the stack problem into a known-good baseline.",
        deeperContext:"This teaches a practical operator move: when the compatibility search space is too wide, use a validated image to remove guesswork and restore a tested stack contract.",
        lookFor:[
          "A trusted image source with a tested software combination",
          "A stack that aligns driver, CUDA, libraries, and framework more predictably",
          "A recovery path that is narrower and safer than random layer changes"
        ],
        meaning:"Using a validated image is a controlled way to restore a known-good software stack.",
        commonMistake:"Treating container images as just packaging convenience. In this context, the image is also a compatibility-control tool.",
        operatorTakeaway:"A validated image is often the fastest safe way to tell whether the problem is your custom stack or the underlying node.",
        takeAction:[
          "Use the validated image as a compatibility baseline.",
          "Compare behavior before and after the image change.",
          "Preserve the old and new version details so the root-cause story stays clear."
        ],
        avoid:[
          "Do not keep guessing across many stack layers once a validated baseline is available.",
          "Do not call the issue resolved until the workload behavior confirms the stack is actually usable again."
        ]
      }
    ],
    draw: drawCUDAStack
  },
  container: {
    name: "NGC Container Flow",
    icon: "📦",
    color: "#76b900",
    objective: "Pull and run validated stacks.",
    steps: [
      {
        label:"Pull NGC",
        cmd:"docker pull nvcr.io/nvidia/pytorch",
        type:"ngc_pull",
        explainerMode:"beginner_story",
        screenshotReference:"Use the pull snapshot to anchor the environment around an exact image tag. The key clue is the explicit NGC tag and digest, because that is what makes the environment reproducible later.",
        screenshots:[
          {
            title:"NGC image pull baseline",
            caption:"This screenshot matters because reproducibility starts with a precise image, not a vague idea of 'some NVIDIA container.'",
            lines:[
              "Using default tag: 24.03-py3",
              "24.03-py3: Pulling from nvidia/pytorch",
              "Digest: sha256:3df6d5b7c8b1e81f2e66f4a31d2b4b2b6f0d0f4f9a6b7e9f8d2a7a4c5e3c9b1a",
              "Status: Image is up to date for nvcr.io/nvidia/pytorch:24.03-py3"
            ]
          }
        ],
        whatsHappening:"You are pulling a validated NVIDIA GPU image so you start from a tested software baseline instead of building the environment from scratch.",
        deeperContext:"This first step teaches that reproducibility starts with the image choice. Beginners should see that image selection is part of operations, not just developer preference.",
        lookFor:[
          "A known-good NGC image tag",
          "A successful image pull from a trusted source",
          "A baseline environment you can reuse across nodes"
        ],
        meaning:"This step establishes the software package you intend to trust and reuse.",
        commonMistake:"Treating the image as just a blob you happened to pull. The image is the environment baseline, so its source and tag matter operationally.",
        operatorTakeaway:"Operators reduce drift by standardizing on known-good images before they begin blaming nodes or frameworks.",
        takeAction:[
          "Record the exact image tag.",
          "Treat this image as your reproducible baseline.",
          "Use a trusted image before attempting custom stack repair."
        ],
        avoid:[
          "Do not pull an untracked image and expect easy reproduction later.",
          "Do not start rebuilding the stack manually if a validated baseline already exists."
        ]
      },
      {
        label:"Run with GPU",
        cmd:"docker run --gpus all",
        type:"ngc_run",
        explainerMode:"beginner_story",
        screenshotReference:"Treat the runtime snapshot as a bridge check between the image and the hardware. The important thing is seeing explicit GPU exposure inside the container path, not just a container that happens to start.",
        screenshots:[
          {
            title:"Container launched with GPU runtime",
            caption:"This screenshot is about runtime wiring, not application logic. It tells you whether the container received the accelerator devices and libraries it needs.",
            lines:[
              "$ docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L",
              "GPU 0: NVIDIA H100 80GB HBM3 (UUID: GPU-3b1f3d52-2b2f-4f0d-8c1c-6e0f9a1f4b6d)",
              "GPU 1: NVIDIA H100 80GB HBM3 (UUID: GPU-7c2e1baf-8d3f-4a4d-a8ae-67d7e88232ef)"
            ]
          }
        ],
        whatsHappening:"You are starting the container with explicit GPU access so the runtime can expose the hardware inside the image.",
        deeperContext:"A good image alone is not enough. The runtime has to pass GPU devices and libraries through correctly, or the container becomes an isolated shell with no usable accelerator access.",
        lookFor:[
          "A container run path that explicitly requests GPU access",
          "No obvious runtime-side failure to expose the accelerator",
          "Evidence that the container is not just running, but running with the intended hardware path"
        ],
        meaning:"This step checks the bridge between the image and the physical GPU runtime.",
        commonMistake:"Confusing 'the container started' with 'the GPU is available inside the container.' Those are not the same success condition.",
        operatorTakeaway:"Operators verify both halves of the contract: image correctness and runtime GPU exposure.",
        takeAction:[
          "Treat GPU runtime setup as a separate verification point.",
          "Use this step to confirm the image is being launched in the right mode.",
          "Keep going upward only after the runtime path looks plausible."
        ],
        avoid:[
          "Do not assume container startup proves CUDA access.",
          "Do not debug training logic before the runtime path is confirmed."
        ]
      },
      {
        label:"Verify Inside",
        cmd:"docker run --gpus all python3 -c \"import torch\"",
        type:"ngc_verify",
        explainerMode:"beginner_story",
        screenshotReference:"Use the in-container framework snapshot as the first real proof point. The key move is confirming that PyTorch inside the image sees CUDA, not just that the host or runtime does.",
        screenshots:[
          {
            title:"In-container CUDA sanity check",
            caption:"This screenshot turns a launched container into a validated application environment. The framework now confirms the GPU path from inside the image.",
            lines:[
              ">>> import torch",
              ">>> torch.cuda.is_available()",
              "True",
              ">>> torch.cuda.device_count()",
              "8"
            ]
          }
        ],
        whatsHappening:"You are checking from inside the container whether the framework actually sees and can use the GPU.",
        deeperContext:"This is the user-facing proof step. The operator is no longer just asking whether the container launched, but whether the application layer inside it can really use the accelerator.",
        lookFor:[
          "Successful framework import inside the container",
          "Framework visibility into the GPU",
          "No mismatch between container startup success and actual CUDA usability"
        ],
        meaning:"This step confirms whether the containerized application environment can actually see the GPU as intended.",
        commonMistake:"Stopping after the runtime launch step and never proving the application layer works inside the container.",
        operatorTakeaway:"A valid container path is only real when the software inside it confirms the GPU is available.",
        takeAction:[
          "Use in-container framework checks as the proof step.",
          "Compare inside-container behavior against the host-level expectation.",
          "Treat this as the minimum bar before longer workloads."
        ],
        avoid:[
          "Do not launch long jobs before doing a quick in-container GPU sanity check.",
          "Do not assume host GPU health automatically means in-container framework health."
        ]
      },
      {
        label:"Start Training",
        cmd:"docker run --gpus all python3 train.py",
        type:"ngc_train",
        explainerMode:"beginner_story",
        screenshotReference:"Read the training snapshot as the first end-to-end workload proof. The important thing is that the job progresses beyond startup into real iterations, because that separates a bootable image from a usable one.",
        screenshots:[
          {
            title:"Containerized training job starts cleanly",
            caption:"This screenshot matters because it shows the path survived contact with a real workload. Smoke tests are useful, but real job progress is the stronger operational signal.",
            lines:[
              "Epoch 0 | step 1/100 | loss 6.21 | throughput 1820 samples/s",
              "Epoch 0 | step 2/100 | loss 6.05 | throughput 1834 samples/s",
              "Epoch 0 | step 3/100 | loss 5.94 | throughput 1827 samples/s"
            ]
          }
        ],
        whatsHappening:"You are moving from environment validation into a real workload path to see whether the containerized stack behaves like a usable training environment.",
        deeperContext:"This is where the platform view matters. A container flow is not truly validated until a real workload can run through it instead of just passing tiny smoke checks.",
        lookFor:[
          "A training job that starts and advances normally",
          "No obvious collapse between smoke-test success and workload reality",
          "A usable path from image to runtime to real application behavior"
        ],
        meaning:"This step shows whether the containerized environment is operationally useful to a real GPU workload.",
        commonMistake:"Declaring the path healthy after a tiny import test without seeing whether a real job can actually run through it.",
        operatorTakeaway:"The real measure of a good image path is whether it supports the workload the platform is supposed to carry.",
        takeAction:[
          "Treat workload launch as the first meaningful end-to-end proof.",
          "Use it to separate 'image boots' from 'platform is usable.'",
          "Keep watching for the difference between startup success and stable runtime behavior."
        ],
        avoid:[
          "Do not stop at toy checks if the actual user workload is still unproven.",
          "Do not assume end-to-end success until the job really progresses."
        ]
      },
      {
        label:"Monitor Inside",
        cmd:"docker exec nvidia-smi dmon",
        type:"ngc_monitor",
        explainerMode:"beginner_story",
        screenshotReference:"Use the runtime-monitoring snapshot to confirm that the running workload is truly exercising the GPU. The important visual cue is sustained utilization and power draw rather than a container that merely stays alive.",
        screenshots:[
          {
            title:"Live GPU activity inside container flow",
            caption:"This is the final proof screenshot for the container lab. It shows the workload is not just launched, but actively driving the accelerator in a way that matches the training story.",
            lines:[
              "# gpu   sm   mem   enc   dec   mclk   pclk   pwr",
              "0      96   71    0     0     1593   1980   648",
              "1      95   69    0     0     1593   1980   644"
            ]
          }
        ],
        whatsHappening:"You are checking live GPU behavior from inside the running containerized workflow.",
        deeperContext:"This final step teaches that validation does not end at launch. Operators watch the live runtime to confirm the containerized workload is truly using the GPU the way they expected.",
        lookFor:[
          "Real GPU activity while the containerized job runs",
          "Metrics that show the containerized workload is exercising the accelerator",
          "No disconnect between application launch and live GPU usage"
        ],
        meaning:"This step confirms that the running containerized workload is really consuming GPU resources, not just pretending to be healthy.",
        commonMistake:"Trusting a started job without checking whether it is actually driving the GPU.",
        operatorTakeaway:"Operators verify live behavior, not only startup logs. Real GPU use is the final proof that the container flow is doing what the platform needs.",
        takeAction:[
          "Use live metrics to confirm the containerized job is real GPU work.",
          "Treat runtime monitoring as part of validation, not a separate optional task.",
          "Preserve the image tag and live behavior together as your known-good baseline."
        ],
        avoid:[
          "Do not assume progress messages alone prove the GPU path is healthy.",
          "Do not separate environment validation from runtime observation."
        ]
      }
    ],
    draw: drawContainer
  },
  training: {
    name: "Distributed Training (DDP)",
    icon: "🧠",
    color: "#76b900",
    objective: "Walk through AllReduce sync.",
    steps: [
      {
        label:"Launch DDP",
        cmd:"torchrun train.py",
        type:"ddp_launch",
        explainerMode:"beginner_story",
        screenshotReference:"Use the launch snapshot to confirm that all expected ranks joined the same world. The key clue is the repeated rank/world-size language, because that tells you the distributed job formed correctly before any math begins.",
        screenshots:[
          {
            title:"Distributed job forms its rank group",
            caption:"This screenshot is the first health gate for DDP. It proves the workers agreed on the same distributed context instead of starting as isolated single processes.",
            lines:[
              "RANK 0/8 initialized | MASTER_ADDR=10.1.10.177 MASTER_PORT=29500",
              "RANK 1/8 initialized | backend=nccl",
              "RANK 7/8 initialized | backend=nccl",
              "World size 8 established successfully"
            ]
          }
        ],
        whatsHappening:"You are starting a distributed training job so multiple ranks can agree on the same training world and begin working together.",
        deeperContext:"This is where the distributed system comes alive. Beginners need to see that training does not begin with math alone; it begins with many workers agreeing on the same shared job context.",
        lookFor:[
          "All expected ranks launching successfully",
          "A coherent distributed job startup instead of one process running alone",
          "No immediate disagreement or timeout during initialization"
        ],
        meaning:"This step proves the distributed job can form its working group correctly.",
        commonMistake:"Thinking distributed training starts only when the GPUs begin computing. In reality, the first success condition is that the ranks actually form one job.",
        operatorTakeaway:"Operators care about initialization because a job that cannot form its rank group will never reach useful computation or synchronization.",
        takeAction:[
          "Confirm the whole rank set came up.",
          "Treat startup agreement as the first health gate.",
          "Use later steps to separate formation success from runtime success."
        ],
        avoid:[
          "Do not assume one visible process means the full distributed job is healthy.",
          "Do not skip the initialization story when diagnosing a distributed workload."
        ]
      },
      {
        label:"Forward Pass",
        cmd:"# Sharding batch",
        type:"ddp_fwd",
        explainerMode:"beginner_story",
        screenshotReference:"Read the forward-pass snapshot as local compute evidence, not full distributed proof. The important thing is that each rank is processing its own shard cleanly before synchronization pressure arrives.",
        screenshots:[
          {
            title:"Healthy local forward compute",
            caption:"This screenshot is intentionally local-looking. It helps the learner distinguish per-rank compute progress from the shared synchronization stages that come next.",
            lines:[
              "rank0 | batch shard 0/8 | forward 42.1 ms",
              "rank1 | batch shard 1/8 | forward 41.7 ms",
              "rank7 | batch shard 7/8 | forward 42.4 ms"
            ]
          }
        ],
        whatsHappening:"Each rank is processing its own shard of the batch and doing local model computation.",
        deeperContext:"This is the compute phase most beginners imagine first. It is important, but it is only one part of the loop. The job is healthy here only if the ranks can later rejoin and synchronize.",
        lookFor:[
          "Local work progressing on each rank",
          "No sign that one rank is already far behind the rest",
          "A clean compute phase before synchronization begins"
        ],
        meaning:"This step is the local-compute part of distributed training, where each GPU does its share of the work independently.",
        commonMistake:"Treating successful forward computation as proof that the whole distributed job is healthy. The expensive part may still fail during synchronization.",
        operatorTakeaway:"Operators distinguish local compute from shared coordination. A good forward pass does not yet prove the distributed system is healthy end to end.",
        takeAction:[
          "Use this step to understand the local-work portion of the loop.",
          "Keep watching for imbalance between ranks.",
          "Prepare to compare this healthy local phase against later synchronization behavior."
        ],
        avoid:[
          "Do not stop the analysis at compute-only success.",
          "Do not assume later slowdowns are unrelated if local compute looked fine."
        ]
      },
      {
        label:"Backward Pass",
        cmd:"# Computing local grads",
        type:"ddp_bwd",
        explainerMode:"beginner_story",
        screenshotReference:"Use the backward snapshot to mark the boundary between local work and shared work. The key move is seeing gradients finish locally while remembering they are not useful cluster-wide until the next collective step completes.",
        screenshots:[
          {
            title:"Local gradient computation completes",
            caption:"This screenshot matters because it shows the last stage that is mostly rank-local. The next stage is where communication quality starts to dominate the story.",
            lines:[
              "rank0 | backward complete | grad buckets ready",
              "rank1 | backward complete | grad buckets ready",
              "rank7 | backward complete | grad buckets ready"
            ]
          }
        ],
        whatsHappening:"Each rank is computing local gradients that will soon need to be synchronized with the rest of the group.",
        deeperContext:"This is the phase where local compute begins preparing shared state. Beginners should see that gradients are not the final answer yet; they still have to be reconciled across the whole job.",
        lookFor:[
          "Local gradient computation completing normally",
          "No immediate stall before the collective stage",
          "A clear handoff point between local work and shared communication"
        ],
        meaning:"This step produces the update information that will be shared across ranks in the next stage.",
        commonMistake:"Thinking each GPU's gradients are enough on their own. In DDP, local gradients still need collective synchronization before the model can update coherently.",
        operatorTakeaway:"The training loop is starting to move from local work into shared dependency. That boundary is where many platform problems start to show up.",
        takeAction:[
          "Use this step to understand what each rank contributes before synchronization.",
          "Treat the next collective phase as the real distributed stress point.",
          "Keep the local-to-shared transition in mind as you diagnose bottlenecks."
        ],
        avoid:[
          "Do not confuse local gradient computation with successful distributed synchronization.",
          "Do not treat every slowdown here as a model-only issue without checking the next step."
        ]
      },
      {
        label:"AllReduce Sync",
        cmd:"# Averaging grads",
        type:"ddp_allreduce",
        explainerMode:"beginner_story",
        screenshotReference:"Use the AllReduce snapshot to judge whether the shared communication phase looks healthy. The important cue is that the collective finishes quickly enough that it does not dominate the whole iteration.",
        screenshots:[
          {
            title:"Healthy AllReduce synchronization",
            caption:"This screenshot is where cluster communication becomes user-visible. It shows a collective that completes like a fast-path operation instead of turning into the bottleneck.",
            lines:[
              "bucket 0 allreduce complete | 6.8 ms",
              "bucket 1 allreduce complete | 7.1 ms",
              "bucket 2 allreduce complete | 6.9 ms",
              "iteration sync overhead | 8.4%"
            ]
          }
        ],
        whatsHappening:"The ranks are now sharing and averaging gradients so every participant ends up with the same update view.",
        deeperContext:"This is the shared coordination step that often decides whether distributed training is efficient or miserable. A job can compute well locally and still collapse here if the communication path is weak.",
        lookFor:[
          "Successful gradient synchronization across ranks",
          "No sign that communication is dominating the whole loop unexpectedly",
          "A collective phase that behaves like a healthy fast path"
        ],
        meaning:"This step is where the distributed job becomes one coherent training system instead of many separate local workers.",
        commonMistake:"Treating AllReduce as background plumbing. In practice, it is often the phase where a bad fabric, weak rank, or slow path becomes visible.",
        operatorTakeaway:"Operators watch this phase closely because it is where cluster communication quality directly hits user-visible training speed.",
        takeAction:[
          "Compare collective behavior against the expected healthy platform path.",
          "Use this step to connect communication health to training health.",
          "Remember that a slow collective can waste the whole rack's GPU time."
        ],
        avoid:[
          "Do not reduce distributed training health to local GPU utilization only.",
          "Do not ignore communication behavior if the job feels slower than expected."
        ]
      },
      {
        label:"Weight Update",
        cmd:"optimizer.step()",
        type:"ddp_update",
        explainerMode:"beginner_story",
        screenshotReference:"Treat the update snapshot as proof that the full distributed loop completed coherently. The key thing is that every rank can move to the next step from the same synchronized model state.",
        screenshots:[
          {
            title:"Synchronized model update completes",
            caption:"This screenshot is the payoff of the earlier synchronization steps. It confirms the job can keep training as one coherent system rather than diverging rank by rank.",
            lines:[
              "optimizer.step() applied on rank0",
              "optimizer.step() applied on rank1",
              "global step 184 complete | loss 4.82"
            ]
          }
        ],
        whatsHappening:"The synchronized update is now being applied so every rank can continue from the same model state.",
        deeperContext:"This step shows the payoff of the earlier synchronization. If the loop reached this point cleanly, the job can continue coherently across ranks instead of diverging into inconsistent local models.",
        lookFor:[
          "A clean update phase after synchronization",
          "No sign that ranks are drifting into different training states",
          "A training loop that can continue to the next batch as one coordinated system"
        ],
        meaning:"This step closes the loop by applying one shared update across the distributed job.",
        commonMistake:"Forgetting that the update only has meaning because the earlier collective made the ranks agree. The update is the result of the whole loop, not just one line of code.",
        operatorTakeaway:"The value of the platform is that all these stages work together. A clean update means compute and communication stayed aligned long enough for the job to progress correctly.",
        takeAction:[
          "Treat this as the loop-completion proof step.",
          "Use it to reason about whether earlier stages stayed coherent.",
          "Compare it mentally with later fault steps where the loop becomes unhealthy."
        ],
        avoid:[
          "Do not isolate the update from the synchronization work that made it valid.",
          "Do not assume a job is healthy over time without watching repeated loop behavior."
        ]
      },
      {
        label:"Storage Bottleneck",
        cmd:"iostat -x 1",
        type:"ddp_storage",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Use the storage-bottleneck snapshot to recognize that a distributed job can stall outside the GPU and fabric path. The key clue is storage pressure lining up with the training slowdown, because that means the loop is starving for input rather than failing inside pure compute or collectives.",
        screenshots:[
          {
            title:"Input path is starving the distributed loop",
            caption:"This screenshot is the whole-platform reminder in the DDP lab. It shows the job can be healthy in launch and synchronization terms while still slowing down because the data path is falling behind.",
            lines:[
              "Device            r/s   rkB/s  await  %util",
              "nfs0            1821  944128   47.9  100.0",
              "gpu ranks waiting on next batch",
              "iteration time expanded from 420 ms to 1180 ms"
            ]
          }
        ],
        whatsHappening:"You are seeing a non-GPU part of the platform slow the whole training loop down because data is not arriving fast enough.",
        deeperContext:"This final step teaches that distributed training health depends on more than compute and communication. Even a perfect GPU and fabric path still stall if the data path cannot feed the ranks fast enough.",
        lookFor:[
          "Storage signals that line up with sawtooth or stalled training behavior",
          "Evidence that the GPUs are waiting on input instead of pure compute or synchronization",
          "A platform bottleneck that lives outside the GPU but still hurts the whole job"
        ],
        meaning:"The training job is being slowed by the data path, not necessarily by the GPUs themselves.",
        commonMistake:"Blaming the model or the accelerators first when the real bottleneck is storage feeding the loop too slowly.",
        operatorTakeaway:"Distributed training is a whole-platform workload. Storage, network, scheduler, and GPUs all matter because the slowest critical stage controls the job.",
        takeAction:[
          "Treat storage evidence as part of training diagnosis, not as a separate unrelated issue.",
          "Use the data path to explain why GPU-side symptoms may be misleading.",
          "Keep whole-platform reasoning in view when diagnosing slow training."
        ],
        avoid:[
          "Do not assume every training slowdown is rooted in the model or GPU.",
          "Do not analyze the loop without checking the input path that feeds it."
        ]
      }
    ],
    draw: drawDDP
  },
  allreduce: {
    name: "AllReduce Deep Dive",
    icon: "🔄",
    color: "#00d4d4",
    objective: "Trace Ring Algorithm.",
    steps: [
      {
        label:"Check Path",
        cmd:"NCCL_DEBUG=INFO torchrun train.py",
        type:"nccl_path",
        explainerMode:"beginner_story",
        screenshotReference:"Use the NCCL path snapshot to identify the selected transport before you trust any benchmark. The key clue is the explicit transport language, because that tells you whether the collective started on the intended fast path.",
        screenshots:[
          {
            title:"NCCL selects the intended fast path",
            caption:"This screenshot anchors the collective on a healthy transport before any performance numbers enter the story.",
            lines:[
              "NCCL INFO NET/IB : Using mlx5_0 port 1",
              "NCCL INFO Using network IB for inter-node collectives",
              "NCCL INFO Connected all rings using IB transport"
            ]
          }
        ],
        whatsHappening:"You are checking how NCCL plans to move collective traffic before trusting the job's performance.",
        deeperContext:"This first step teaches that distributed training can look alive while already using the wrong path. Beginners need to learn that communication health starts with path selection, not just with whether processes launched.",
        lookFor:[
          "Which transport path NCCL actually selected",
          "Whether the software story matches the hardware you expected to use",
          "Any clue that the collective may already be on a weaker path than intended"
        ],
        meaning:"This step tells you whether the job is even starting from the right communication plan.",
        commonMistake:"Assuming the cluster will always choose the best path automatically. In practice, environment mistakes and transport issues can quietly change what NCCL uses.",
        operatorTakeaway:"Operators check the chosen path early because a wrong path can waste an otherwise healthy rack before any obvious fault appears.",
        takeAction:[
          "Use this step to establish the healthy-path expectation before judging performance.",
          "Compare the selected path with the node and fabric design you intended.",
          "Treat path selection as the first health gate for collectives."
        ],
        avoid:[
          "Do not judge collective health by process startup alone.",
          "Do not skip the path check and go straight to blaming the model."
        ]
      },
      {
        label:"Ring Reduce",
        cmd:"# Step 1/8",
        type:"ring1",
        explainerMode:"beginner_story",
        screenshotReference:"Read the ring-reduce snapshot as the first half of the collective relay. The important thing is that each hop progresses smoothly, because one slow handoff can drag the whole ring.",
        screenshots:[
          {
            title:"Ring reduce phase progresses evenly",
            caption:"This screenshot is useful because it makes the collective feel mechanical rather than magical. The relay only works if each hop keeps up.",
            lines:[
              "rank0 -> rank1 | chunk 0 reduced",
              "rank1 -> rank2 | chunk 1 reduced",
              "rank7 -> rank0 | chunk 7 reduced"
            ]
          }
        ],
        whatsHappening:"Each rank is sending part of its gradient data around the ring so the group can start combining one shared answer.",
        deeperContext:"This is the first half of the collective. The beginner lesson is that AllReduce is not magic; it is many small coordinated handoffs, which means one slow link can slow the whole ring.",
        lookFor:[
          "A smooth early reduction phase across all participants",
          "No sign that one rank or path is already lagging behind the rest",
          "A collective that behaves like a coordinated relay rather than isolated local work"
        ],
        meaning:"The group is beginning to combine separate gradient pieces into one shared result.",
        commonMistake:"Thinking only the final throughput number matters. The ring itself matters because each stage depends on the previous handoff working cleanly.",
        operatorTakeaway:"Operators care because this step makes the rack act like one system. A weak hop here becomes a whole-job slowdown, not a small local defect.",
        takeAction:[
          "Mentally picture the ring as many handoffs, not one big invisible operation.",
          "Use lag or asymmetry here as a clue that one path may already be unhealthy.",
          "Connect local link quality to shared job efficiency."
        ],
        avoid:[
          "Do not think of collective communication as background noise.",
          "Do not assume one fast GPU can compensate for one slow communication hop."
        ]
      },
      {
        label:"Ring Gather",
        cmd:"# Step 8/8",
        type:"ring2",
        explainerMode:"beginner_story",
        screenshotReference:"Use the ring-gather snapshot to confirm that the synchronized result returns to every rank, not just some of them. The key clue is completion across the full ring rather than partial progress.",
        screenshots:[
          {
            title:"Ring gather returns the shared result",
            caption:"This screenshot closes the loop. The collective only becomes useful when the final value makes it back to every participant.",
            lines:[
              "rank0 received final reduced chunk",
              "rank3 received final reduced chunk",
              "rank7 received final reduced chunk"
            ]
          }
        ],
        whatsHappening:"The shared result is being distributed back out so every rank ends with the same synchronized update.",
        deeperContext:"This step completes the agreement loop. The job is only truly synchronized when every participant receives the same final value and can continue from the same model state.",
        lookFor:[
          "The synchronized result returning cleanly to all ranks",
          "No sign that one part of the ring is delaying the final redistribution",
          "A full-group outcome instead of a partial or uneven result"
        ],
        meaning:"This is the moment the collective becomes useful to training because all participants can now move forward together.",
        commonMistake:"Focusing only on the reduce phase and forgetting that the final redistribution is part of the same health story.",
        operatorTakeaway:"Operators watch the whole collective path, not just the first half, because the job only benefits if every rank ends in the same place.",
        takeAction:[
          "Treat reduce and gather as one health story with two visible phases.",
          "Use this step to reinforce that synchronization must finish everywhere, not just somewhere.",
          "Think about the user impact: one delayed rank delays everyone."
        ],
        avoid:[
          "Do not call the collective healthy if only part of the ring looks good.",
          "Do not confuse partial progress with synchronized success."
        ]
      },
      {
        label:"Benchmark",
        cmd:"./all_reduce_perf",
        type:"ar_bench",
        explainerMode:"beginner_story",
        screenshotReference:"Use the benchmark snapshot as the operational proof that the collective path is healthy in practice. The important thing is that the bandwidth looks like a strong fast-path result, not just a successful command.",
        screenshots:[
          {
            title:"Healthy collective benchmark result",
            caption:"This screenshot is the throughput proof stage for the ring story. It shows the collective path behaving like a rack-grade fast path.",
            lines:[
              "size 1073741824 | algbw 181.2 GB/s | busbw 181.2 GB/s",
              "size 2147483648 | algbw 182.8 GB/s | busbw 182.8 GB/s",
              "# Avg bus bandwidth : 182.0 GB/s"
            ]
          }
        ],
        whatsHappening:"You are measuring whether the collective path delivers the throughput the platform is supposed to provide.",
        deeperContext:"This is where theory becomes evidence. A healthy path should not just exist; it should produce throughput near the expected design range for the node or rack.",
        lookFor:[
          "Bandwidth near the healthy expected baseline",
          "A benchmark result that matches the chosen path and topology story",
          "Whether communication is efficient enough for real training jobs"
        ],
        meaning:"This step tells you whether the collective is healthy in practice, not just in logs or diagrams.",
        commonMistake:"Calling the path healthy because the operation completed. Completion is not the same as acceptable distributed efficiency.",
        operatorTakeaway:"Operators use benchmarks to prove whether users are getting the rack performance they paid for.",
        takeAction:[
          "Compare the result to a known healthy baseline.",
          "Tie the benchmark back to the earlier path-selection evidence.",
          "Use low throughput as a reason to keep investigating transport quality."
        ],
        avoid:[
          "Do not use raw numbers without context.",
          "Do not assume success means the performance is good enough."
        ]
      },
      {
        label:"Fault: IB Disable",
        cmd:"export NCCL_IB_DISABLE=1",
        type:"ar_fault",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Use the fault snapshot to see what a soft transport failure looks like. The key clue is the explicit fallback away from IB, because that explains why throughput can collapse even while the job stays up.",
        screenshots:[
          {
            title:"Collective falls back off InfiniBand",
            caption:"This screenshot is the soft-failure lesson for collectives. Nothing crashed, but the transport path degraded into a slower mode that wastes GPU time.",
            lines:[
              "NCCL INFO NCCL_IB_DISABLE set by environment",
              "NCCL INFO NET/Socket : Using eth0:10.1.10.177<0>",
              "NCCL WARN Falling back from IB to socket transport"
            ]
          }
        ],
        whatsHappening:"You are forcing NCCL off the fast InfiniBand path so the collective has to use a weaker fallback route.",
        deeperContext:"This fault teaches one of the most important beginner lessons in distributed systems: the job can keep running while efficiency collapses. The platform looks alive, but the workload experience becomes much worse.",
        lookFor:[
          "A clear path change away from the intended fast transport",
          "Bandwidth or timing getting noticeably worse even though the job still runs",
          "A concrete example of soft failure rather than hard outage"
        ],
        meaning:"The collective is still functioning, but it is no longer using the transport path the platform was designed for.",
        commonMistake:"Thinking this is a minor detail because nothing crashed. In production, slow collectives can waste huge amounts of GPU time without triggering an outright outage.",
        operatorTakeaway:"Operators treat fallback paths seriously because users feel them as slow training, poor scaling, and wasted rack capacity.",
        takeAction:[
          "Use this step to connect transport quality to user-visible throughput loss.",
          "Notice that slow success is still an operational failure.",
          "Preserve the before-and-after story so the fault stays teachable."
        ],
        avoid:[
          "Do not dismiss a fallback just because the job remains up.",
          "Do not confuse availability with health."
        ]
      },
      {
        label:"Fix IB Path",
        cmd:"unset NCCL_IB_DISABLE",
        type:"ar_fix",
        explainerMode:"beginner_story",
        screenshotReference:"Read the fix snapshot as proof that the intended fast path came back, not just that a variable was unset. The important thing is seeing IB selected again after the change.",
        screenshots:[
          {
            title:"IB transport restored after fix",
            caption:"This screenshot closes the remediation loop by showing the collective returned to the intended transport rather than only changing configuration text.",
            lines:[
              "NCCL INFO NET/IB : Using mlx5_0 port 1",
              "NCCL INFO Connected all rings using IB transport",
              "Benchmark recovered to expected bandwidth envelope"
            ]
          }
        ],
        whatsHappening:"You are restoring access to the intended fast transport so the collective can return to its healthy path.",
        deeperContext:"This final step teaches disciplined remediation. The goal is not just to reverse a setting, but to prove that the communication path, and therefore user-facing throughput, recovers as expected.",
        lookFor:[
          "The fast transport becoming available again",
          "The collective story returning to the healthy expected path",
          "Evidence that the prior slowdown came from path choice, not random chance"
        ],
        meaning:"The system is being returned to the transport path it was designed to use for efficient distributed synchronization.",
        commonMistake:"Stopping after the config change and assuming the issue is solved without checking the resulting throughput or logs.",
        operatorTakeaway:"Operators close the loop by verifying that a targeted fix actually restores cluster efficiency, not just configuration intent.",
        takeAction:[
          "Verify the path and the resulting bandwidth after the fix.",
          "Use this step to reinforce the habit of proof-after-change.",
          "Capture the lesson that communication fixes must be measured, not assumed."
        ],
        avoid:[
          "Do not call the fix complete without post-change validation.",
          "Do not separate remediation from outcome verification."
        ]
      }
    ],
    draw: drawAllReduce
  },
  ib_fabric: {
    name: "InfiniBand Fabric",
    icon: "🌐",
    color: "#4a9eff",
    objective: "Verify fabric health.",
    steps: [
      {
        label:"Check Ports",
        cmd:"ibstat",
        type:"ib_stat",
        explainerMode:"beginner_story",
        screenshotReference:"Use the port-state snapshot as the first fabric health gate. The key clue is the explicit Active state, because no higher-level tuning matters if the fast path is not even up.",
        screenshots:[
          {
            title:"InfiniBand ports are active",
            caption:"This screenshot is the link-availability baseline for the fabric lab. It proves the expected HCA and port are present and up before you measure anything more advanced.",
            lines:[
              "CA 'mlx5_0'",
              "  Port 1: State: Active",
              "  Physical state: LinkUp",
              "  Rate: 400 Gb/sec (4X NDR)"
            ]
          }
        ],
        whatsHappening:"You are checking whether the expected InfiniBand ports are actually up before trusting anything about cluster performance.",
        deeperContext:"This is the first health gate for the fabric. Beginners need to learn that a distributed cluster can look available while the fast interconnect path between nodes is not actually ready for production traffic.",
        lookFor:[
          "Ports in the expected Active state",
          "Expected HCAs and ports present on the host",
          "A fabric path that exists before you start measuring it"
        ],
        meaning:"This step tells you whether the network path is even available in principle.",
        commonMistake:"Assuming the cluster is fine because the server itself is reachable. Server reachability and fabric health are not the same thing.",
        operatorTakeaway:"Operators start here because no amount of later tuning matters if the expected RDMA path is not actually up.",
        takeAction:[
          "Use this as the first availability check for the fast network path.",
          "Record which host and port you are looking at so later evidence stays specific.",
          "Treat missing or down ports as fabric evidence, not just host trivia."
        ],
        avoid:[
          "Do not jump straight to application tuning before link state is known.",
          "Do not confuse node health with fabric health."
        ]
      },
      {
        label:"Check Errors",
        cmd:"perfquery",
        type:"ib_perfq",
        explainerMode:"beginner_story",
        screenshotReference:"Use the counter snapshot to separate an available port from a clean port. The important thing is whether error counters stay flat instead of creeping upward under traffic.",
        screenshots:[
          {
            title:"Fabric counters remain clean",
            caption:"This screenshot is healthy because the fabric is not just up, but quiet. Flat counters give you a stronger basis for trusting later bandwidth tests.",
            lines:[
              "SymbolErrorCounter.............0",
              "LinkErrorRecoveryCounter.......0",
              "PortRcvErrors..................0",
              "PortXmitDiscards...............0"
            ]
          }
        ],
        whatsHappening:"You are checking whether the active InfiniBand path is clean or already accumulating errors under traffic.",
        deeperContext:"A port being up is not enough. This step teaches that links can be present but noisy, and noisy links often explain mysterious distributed slowdowns before a full outage happens.",
        lookFor:[
          "Error counters that stay flat in a healthy case",
          "Counter growth that suggests a dirty or unstable path",
          "Evidence that the fabric is present but not trustworthy"
        ],
        meaning:"This step separates an available path from a healthy production path.",
        commonMistake:"Stopping at link-up and assuming that means the network is fine. Dirty counters tell a more operationally useful story than link state alone.",
        operatorTakeaway:"Operators rely on counters because they turn vague network suspicion into concrete physical-path evidence.",
        takeAction:[
          "Use counters to decide whether the path is clean enough to trust.",
          "Compare error growth with the timing of workload symptoms.",
          "Treat persistent counter growth as an early warning, not something to ignore."
        ],
        avoid:[
          "Do not call the fabric healthy based on link state alone.",
          "Do not ignore low-level counter evidence because jobs still run."
        ]
      },
      {
        label:"RDMA BW Test",
        cmd:"ib_write_bw",
        type:"ib_bw",
        explainerMode:"beginner_story",
        screenshotReference:"Use the RDMA bandwidth snapshot as the practical proof that the fabric can carry the kind of traffic the cluster expects. The key clue is throughput in the expected healthy range, not just benchmark completion.",
        screenshots:[
          {
            title:"Healthy RDMA bandwidth result",
            caption:"This screenshot is the operational proof stage for the fabric. It turns link state and counters into a user-visible throughput answer.",
            lines:[
              "65536 bytes | peak BW 378.4 Gb/sec | avg BW 377.9 Gb/sec",
              "131072 bytes | peak BW 379.1 Gb/sec | avg BW 378.5 Gb/sec",
              "BW steady within healthy NDR envelope"
            ]
          }
        ],
        whatsHappening:"You are measuring whether the fabric delivers the throughput the cluster design promises for RDMA traffic.",
        deeperContext:"This is the proof stage. A healthy fabric should not just look connected; it should behave like a fast path under load when a benchmark exercises it.",
        lookFor:[
          "Bandwidth near the expected healthy range",
          "Results that line up with the earlier link-state and counter story",
          "Whether the network is fast enough for real distributed workloads"
        ],
        meaning:"This step tells you whether the interconnect is operationally healthy, not just electrically present.",
        commonMistake:"Treating a successful benchmark run as enough without checking whether the number is actually good for this platform.",
        operatorTakeaway:"Operators care about user-visible throughput. The benchmark tells you whether the fabric is delivering the performance the rack is supposed to provide.",
        takeAction:[
          "Compare the result with a known-good baseline for the platform.",
          "Tie the throughput result back to the earlier port and counter evidence.",
          "Use low bandwidth as a reason to widen the investigation."
        ],
        avoid:[
          "Do not judge success by command completion alone.",
          "Do not compare numbers without platform context."
        ]
      },
      {
        label:"Fault: Port Down",
        cmd:"# Cable unplugged",
        type:"ib_fault",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Treat the port-down snapshot as a topology break, not a cosmetic host issue. The key clue is the explicit Down state, because that means the fast network path itself is gone.",
        screenshots:[
          {
            title:"Critical InfiniBand port is down",
            caption:"This screenshot is the hard-path failure in the fabric lab. The node may still be reachable in other ways, but the production fabric route is no longer intact.",
            lines:[
              "CA 'mlx5_0'",
              "  Port 1: State: Down",
              "  Physical state: Polling",
              "  Rate: 0 Gb/sec"
            ]
          }
        ],
        whatsHappening:"You are looking at what happens when a critical InfiniBand path is no longer up, which breaks the expected fast route through the fabric.",
        deeperContext:"This fault step makes the failure concrete. Beginners need to see that one missing path can change the behavior of many-node workloads even if the host itself still appears alive and usable.",
        lookFor:[
          "A missing or down port in a place where the cluster expects an active path",
          "A mismatch between intended topology and current fabric state",
          "The beginning of a blast-radius question: who else depends on this path"
        ],
        meaning:"The cluster no longer has the full network path it expected for healthy distributed traffic.",
        commonMistake:"Treating this as just one server issue. In reality, a down fabric path can reduce performance or break communication for many jobs that cross it.",
        operatorTakeaway:"Operators think beyond the single host here. The key question becomes what jobs, nodes, or switch paths are affected by this missing link.",
        takeAction:[
          "Use the fault to start blast-radius reasoning, not just host-local reasoning.",
          "Connect the missing port to the workloads that depend on it.",
          "Prepare to widen the investigation beyond one node."
        ],
        avoid:[
          "Do not dismiss a down port because the server still boots and logs in.",
          "Do not assume the effect stays local."
        ]
      },
      {
        label:"ibdiagnet",
        cmd:"ibdiagnet --pc",
        type:"ib_diag",
        explainerMode:"beginner_story",
        screenshotReference:"Use the broader diagnostic snapshot to decide whether the fault story stays local or starts to look shared. The key thing is whether the wider fabric diagnostic echoes the same bad path you saw locally.",
        screenshots:[
          {
            title:"Fabric diagnostic confirms a bad path",
            caption:"This screenshot is the scope-expansion step in the InfiniBand lab. It shows the issue is no longer just a local suspicion from one host command.",
            lines:[
              "ibdiagnet: bad cable or signal quality detected",
              "node-06 / mlx5_0 / port 1 -> switch-a / port 12",
              "Port counters inconsistent with healthy baseline"
            ]
          }
        ],
        whatsHappening:"You are collecting broader fabric diagnostics so the issue can be compared against the rest of the interconnect, not just one local command view.",
        deeperContext:"This is the point where the investigation grows from host-local evidence into network-level evidence. Beginners need to learn when a problem deserves a wider fabric diagnostic instead of staying trapped on one node.",
        lookFor:[
          "A wider picture of path health beyond one interface",
          "Whether the observed issue is isolated or echoed elsewhere",
          "Evidence that helps distinguish host-side from fabric-wide trouble"
        ],
        meaning:"This step expands the investigation from one symptom to a more trustworthy network view.",
        commonMistake:"Staying on one host too long and assuming that local evidence alone explains the whole incident.",
        operatorTakeaway:"Operators widen scope at the right time. Once the local evidence suggests fabric trouble, broader diagnostics help separate one bad endpoint from a shared network problem.",
        takeAction:[
          "Use wider diagnostics to test whether the issue repeats elsewhere in the fabric.",
          "Preserve the difference between isolated and systemic evidence.",
          "Treat this as the transition from node troubleshooting to cluster troubleshooting."
        ],
        avoid:[
          "Do not keep the whole investigation trapped on one node when the fabric itself may be involved.",
          "Do not assume one local symptom describes the entire network."
        ]
      },
      {
        label:"Sweep Fabric",
        cmd:"ibdiagnet --pc --pm",
        type:"ib_sweep",
        explainerMode:"beginner_story",
        screenshotReference:"Use the sweep snapshot to define blast radius instead of guessing it. The key clue is whether the bad pattern repeats across multiple paths or stays isolated to one endpoint pair.",
        screenshots:[
          {
            title:"Fabric sweep defines incident scope",
            caption:"This screenshot is the blast-radius step for the fabric lab. It tells you whether you are looking at one damaged path or a broader shared-fabric event.",
            lines:[
              "Sweep summary: 95 healthy ports, 1 unhealthy path",
              "Impacted path: node-06 <-> switch-a port 12",
              "No wider switch-wide congestion signature detected"
            ]
          }
        ],
        whatsHappening:"You are sweeping the broader InfiniBand fabric to understand whether the issue is isolated, repeated, or systemic across the cluster.",
        deeperContext:"This final step teaches real operator scope control. Once there is enough evidence that the problem may extend beyond one host, the right move is to check the wider fabric and decide on blast radius and containment.",
        lookFor:[
          "Patterns repeated across more than one host or path",
          "Signs that switch-side or multi-path issues are involved",
          "Whether the incident should be treated as a local repair or a wider cluster risk"
        ],
        meaning:"This step tells you how far the fabric problem reaches and therefore how big the operational response needs to be.",
        commonMistake:"Stopping after one local fix attempt and missing that the same pattern exists elsewhere in the rack or cluster.",
        operatorTakeaway:"Operators use the sweep to decide whether this is a single-host incident, a shared-path incident, or a broader network event that needs containment.",
        takeAction:[
          "Use the sweep to define blast radius clearly.",
          "Tie containment decisions to observed scope, not guesswork.",
          "Escalate the issue appropriately if the fabric problem is wider than one node."
        ],
        avoid:[
          "Do not assume the incident is isolated until the wider fabric is checked.",
          "Do not make rack-level claims from host-only evidence."
        ]
      }
    ],
    draw: drawIBFabric
  },
  roce: {
    name: "RoCEv2 + PFC/ECN",
    icon: "📡",
    color: "#c87941",
    objective: "Lossless Ethernet config.",
    steps: [
      {
        label:"Check MTU",
        cmd:"ip link show eth0",
        type:"roce_mtu",
        explainerMode:"beginner_story",
        screenshotReference:"Use the MTU snapshot as the first RoCE path-consistency check. The key clue is the explicit MTU value, because a mismatched packet size can poison the path before congestion tuning even matters.",
        screenshots:[
          {
            title:"RoCE host MTU matches design",
            caption:"This screenshot is the baseline alignment check for the Ethernet RDMA path. It proves the host is at least speaking the right packet-size language.",
            lines:[
              "2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9000 qdisc mq state UP",
              "link/ether 00:1a:4b:16:01:77 brd ff:ff:ff:ff:ff:ff"
            ]
          }
        ],
        whatsHappening:"You are checking whether the Ethernet path is using the MTU size the RDMA workflow expects before trusting higher-level performance.",
        deeperContext:"This is a foundational path-consistency check. Beginners need to see that RoCE success depends on agreement across the path, not just on one interface being up.",
        lookFor:[
          "MTU values that match the intended RDMA design",
          "No obvious mismatch between what the host expects and what the fabric should carry",
          "A clean baseline before deeper congestion reasoning"
        ],
        meaning:"This step tells you whether the path starts from a sensible packet-size assumption for RoCE traffic.",
        commonMistake:"Ignoring MTU because the link looks up. A mismatched MTU can quietly undermine the whole traffic path before you ever discuss congestion.",
        operatorTakeaway:"Operators check basic path alignment first so later congestion symptoms are not blamed on the wrong thing.",
        takeAction:[
          "Use MTU as a first consistency check for the Ethernet path.",
          "Treat a mismatch as a real clue, not cosmetic configuration drift.",
          "Keep the host-side setting tied to the wider network design in your reasoning."
        ],
        avoid:[
          "Do not assume link-up means path alignment is correct.",
          "Do not skip the basic path check and jump straight to tuning."
        ]
      },
      {
        label:"Verify PFC",
        cmd:"ethtool -A eth0",
        type:"roce_pfc",
        explainerMode:"beginner_story",
        screenshotReference:"Use the PFC snapshot to confirm the host-side lossless policy is actually enabled where the design expects it. The important cue is the pause-control state, not just that Ethernet is up.",
        screenshots:[
          {
            title:"Pause flow control is enabled as expected",
            caption:"This screenshot matters because RoCE stability depends on control behavior, not just link speed. It shows the host is configured for the intended lossless policy.",
            lines:[
              "Pause parameters for eth0:",
              "Autonegotiate: off",
              "RX: on",
              "TX: on"
            ]
          }
        ],
        whatsHappening:"You are checking whether pause-based flow control is configured as expected for the traffic class carrying RDMA.",
        deeperContext:"This step introduces the beginner to policy-level health. RoCE is not just about bandwidth; it depends on the network applying the right congestion behavior to the right traffic.",
        lookFor:[
          "PFC enabled where the design expects it",
          "No obvious mismatch between host expectations and lossless-traffic policy",
          "A path that is prepared to handle RDMA traffic without random packet loss"
        ],
        meaning:"This step tells you whether the Ethernet fabric is using the pause behavior the RoCE design depends on.",
        commonMistake:"Thinking PFC is a low-level setting only network teams need to care about. In reality, it directly affects whether distributed GPU traffic stays stable.",
        operatorTakeaway:"Operators need enough PFC literacy to know whether the path is even configured for the kind of workload the rack is trying to run.",
        takeAction:[
          "Confirm the host-side pause settings line up with the intended traffic design.",
          "Use this to decide whether the fabric is plausibly ready for RoCE.",
          "Treat missing or mismatched PFC as a serious path-quality clue."
        ],
        avoid:[
          "Do not treat congestion settings as irrelevant to GPU performance.",
          "Do not assume a healthy Ethernet link implies correct flow-control policy."
        ]
      },
      {
        label:"Check ECN",
        cmd:"tc qdisc show",
        type:"roce_ecn",
        explainerMode:"beginner_story",
        screenshotReference:"Read the ECN snapshot as proof that the path has a congestion signal before collapse. The key thing is seeing explicit qdisc/marking behavior instead of hoping the network handles pressure gracefully on its own.",
        screenshots:[
          {
            title:"ECN-capable queuing policy is present",
            caption:"This screenshot is about graceful congestion behavior. It shows the path has a way to mark pressure before the fabric melts into pauses or loss.",
            lines:[
              "qdisc mq 0: dev eth0 root",
              "qdisc fq_codel 8010: dev eth0 parent :1 limit 10240 ecn",
              "qdisc fq_codel 8011: dev eth0 parent :2 limit 10240 ecn"
            ]
          }
        ],
        whatsHappening:"You are checking whether the network has a way to signal congestion before the path collapses into pause-heavy behavior or packet loss.",
        deeperContext:"This step teaches that stable performance often depends on warning and control mechanisms, not just raw speed. ECN helps the fabric react before congestion becomes destructive.",
        lookFor:[
          "Congestion signaling configured where the design expects it",
          "Evidence that the path has a graceful way to handle buildup under load",
          "Whether the fabric can control pressure instead of only reacting after the fact"
        ],
        meaning:"This step tells you whether the network has a healthier congestion-response path than relying only on brute pause behavior.",
        commonMistake:"Focusing only on PFC and forgetting that ECN is part of making the whole path behave well under load.",
        operatorTakeaway:"Operators think in terms of the whole congestion-control story, not one knob at a time.",
        takeAction:[
          "Use ECN as part of the full path-health picture, not as an isolated detail.",
          "Compare it with the PFC and MTU evidence you already collected.",
          "Treat missing congestion signaling as a reason to be cautious about later performance results."
        ],
        avoid:[
          "Do not change one congestion-control mechanism while ignoring the rest of the path.",
          "Do not assume high speed is enough without healthy congestion behavior."
        ]
      },
      {
        label:"Measure BW",
        cmd:"ib_write_bw -d rxe0",
        type:"roce_bw",
        explainerMode:"beginner_story",
        screenshotReference:"Use the RoCE bandwidth snapshot as the practical proof that the Ethernet RDMA path is healthy enough for work. The important cue is steady bandwidth in the expected range, not just a benchmark that ran.",
        screenshots:[
          {
            title:"Healthy RoCE throughput result",
            caption:"This screenshot turns the MTU/PFC/ECN story into a user-visible performance answer. The path only counts as healthy if it behaves well under load.",
            lines:[
              "65536 bytes | peak BW 184.2 Gb/sec | avg BW 183.6 Gb/sec",
              "131072 bytes | peak BW 185.1 Gb/sec | avg BW 184.4 Gb/sec",
              "Bandwidth stable within expected RoCE envelope"
            ]
          }
        ],
        whatsHappening:"You are measuring whether the Ethernet fabric actually delivers the throughput the RoCE path is supposed to provide under RDMA traffic.",
        deeperContext:"This is the proof step. The prior settings only matter if they result in the kind of stable throughput the distributed workload needs in real life.",
        lookFor:[
          "Bandwidth near the healthy expected range",
          "A result that matches the policy and path assumptions you validated earlier",
          "Whether the Ethernet fabric behaves like a usable RDMA transport in practice"
        ],
        meaning:"This step tells you whether the configured RoCE path is operationally good enough for real distributed work.",
        commonMistake:"Treating the benchmark as good just because it finishes. Operators care whether the result is healthy for the platform, not merely nonzero.",
        operatorTakeaway:"Users feel throughput and scaling quality, so benchmark results are where path design becomes user experience.",
        takeAction:[
          "Compare the result with a known-good RoCE baseline.",
          "Use low or unstable bandwidth to revisit the congestion-control story.",
          "Tie performance back to the earlier MTU, PFC, and ECN checks."
        ],
        avoid:[
          "Do not read the number without platform context.",
          "Do not assume command success means the path is healthy."
        ]
      },
      {
        label:"Fault: PFC Storm",
        cmd:"ethtool -S eth0",
        type:"roce_fault",
        fault:true,
        explainerMode:"beginner_story",
        screenshotReference:"Use the pause-counter snapshot to recognize a soft network-control failure. The key clue is rapidly rising pause counters, because that explains slowdown without requiring a hard link-down event.",
        screenshots:[
          {
            title:"Pause storm evidence on Ethernet path",
            caption:"This screenshot is the soft-failure lesson for RoCE. The link is still up, but congestion control is now amplifying the problem instead of containing it.",
            lines:[
              "tx_prio3_pause: 48291",
              "rx_prio3_pause: 51744",
              "pfc_storm_warning: threshold exceeded"
            ]
          }
        ],
        whatsHappening:"You are observing a congestion-control failure where pause traffic starts amplifying the problem instead of containing it.",
        deeperContext:"This is the classic RoCE warning story. The network is still present, but its control behavior under load is now making the distributed path worse instead of protecting it.",
        lookFor:[
          "Pause-related counters rising rapidly",
          "A path that looks alive but behaves badly under pressure",
          "Evidence that congestion handling itself has become the problem"
        ],
        meaning:"The Ethernet fabric is no longer managing RDMA traffic cleanly. The control mechanism meant to help is now contributing to the incident.",
        commonMistake:"Thinking a pause storm is just a noisy statistic. In practice, it explains why jobs can slow down dramatically without a simple link-down event.",
        operatorTakeaway:"Operators treat this as a shared-fabric risk because pause storms can affect more than one host or workload at once.",
        takeAction:[
          "Use pause counters to connect job slowdown to network-control behavior.",
          "Start thinking about blast radius, not just one interface.",
          "Preserve the distinction between an available network and a healthy network."
        ],
        avoid:[
          "Do not ignore pause storms because the link is still technically up.",
          "Do not reduce this to a host-only issue without checking the wider fabric."
        ]
      },
      {
        label:"Tune Buffers",
        cmd:"# Tuning switch",
        type:"roce_fix",
        explainerMode:"beginner_story",
        screenshotReference:"Treat the remediation snapshot as a narrow congestion-control fix, not a magic reset. The key thing is that the change matches the earlier pause-storm evidence rather than blindly touching unrelated knobs.",
        screenshots:[
          {
            title:"Targeted congestion tuning applied",
            caption:"This screenshot is about disciplined remediation. It shows a narrow fix tied to the observed problem instead of a broad, untraceable configuration sweep.",
            lines:[
              "Updated switch buffer profile for RoCE priority class 3",
              "Applied ECN threshold 48KB / 96KB",
              "Reduced pause storm behavior on validation run"
            ]
          }
        ],
        whatsHappening:"You are applying congestion-control or buffering changes so the Ethernet fabric can carry RDMA traffic without collapsing into pause-heavy instability.",
        deeperContext:"This final step teaches careful remediation. RoCE fixes usually live at the boundary between host and network policy, so the operator has to make deliberate, evidence-based changes instead of random tuning.",
        lookFor:[
          "A targeted change that matches the earlier congestion evidence",
          "A path that should now handle pressure more gracefully",
          "Whether the remediation is aimed at the actual control problem you observed"
        ],
        meaning:"The fabric is being adjusted so its congestion behavior aligns better with the workload the platform is trying to carry.",
        commonMistake:"Turning many knobs at once and then not knowing which change actually helped.",
        operatorTakeaway:"Operators fix RoCE by matching the change to the observed congestion story, then verifying that the distributed workload path really improves.",
        takeAction:[
          "Keep the fix narrow and tied to the evidence you collected.",
          "Verify the impact after the change instead of assuming it worked.",
          "Treat this as platform tuning, not just a one-host tweak."
        ],
        avoid:[
          "Do not shotgun multiple tuning changes without a verification plan.",
          "Do not separate remediation from post-change measurement."
        ]
      }
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the fallback-diagnosis snapshot to identify the wrong transport immediately. The key clue is NCCL naming Socket or TCP instead of IB, because that explains slow success before deeper debugging begins.",
        screenshots:[
          {
            title:"NCCL is using the slow fallback path",
            caption:"This screenshot is the symptom anchor for the fallback drill. It tells you the job is alive but already on the wrong communication path.",
            lines:[
              "NCCL INFO NET/Socket : Using eth0:10.1.10.177<0>",
              "NCCL INFO NET/IB : No device selected",
              "NCCL WARN Falling back to TCP transport"
            ]
          }
        ],
        whatsHappening:"You are checking the NCCL logs to see whether the job is already using a slower communication path than the platform was designed for.",
        deeperContext:"This drill begins at the symptom layer. Beginners often stop at 'the job is slow'; this step teaches them to use NCCL logs to identify that the communication path is already telling a story.",
        lookFor:[
          "NCCL choosing Socket or TCP instead of the expected InfiniBand path",
          "A communication mode that does not match the node's intended fabric design",
          "The first concrete evidence that slow success is not normal success"
        ],
        meaning:"The workload is likely using a slower fallback path. The key lesson is that distributed jobs can still run while the communication layer is badly degraded.",
        commonMistake:"Treating a launched job as a healthy job. Slow success can still mean a major platform efficiency failure.",
        operatorTakeaway:"Operators use the log path choice as the first clue that the workload is missing the fast transport and needs targeted investigation.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Read the environment snapshot as the cheapest root-cause check first. The important thing is whether a single variable already explains the whole fallback story.",
        screenshots:[
          {
            title:"Environment is forcing the wrong path",
            caption:"This screenshot matters because it can collapse a complex-looking incident into one bad setting. It is the highest-leverage explanation to clear first.",
            lines:[
              "NCCL_IB_DISABLE=1",
              "NCCL_DEBUG=INFO"
            ]
          }
        ],
        whatsHappening:"You are checking whether environment variables are forcing NCCL onto the wrong path before blaming hardware.",
        deeperContext:"This step teaches a core debugging habit: check the highest-leverage, lowest-cost explanation first. Environment variables can override the whole fabric story with one bad setting.",
        lookFor:[
          "Variables such as NCCL_IB_DISABLE or a suspicious HCA override",
          "A direct software explanation for why TCP was chosen",
          "Whether the fallback could be self-inflicted by configuration"
        ],
        meaning:"If a disabling or mismatched environment variable is present, the fallback may be caused by configuration alone rather than hardware failure.",
        commonMistake:"Skipping the easy explanation and escalating straight into fabric debugging or host repair.",
        operatorTakeaway:"Operators check environment first because one bad variable can explain the whole slowdown without any hardware failure.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the ibstat snapshot to compare transport availability against NCCL's path choice. The key clue is that IB can be healthy while NCCL still ignores it due to selection problems.",
        screenshots:[
          {
            title:"InfiniBand is healthy despite fallback",
            caption:"This screenshot is the comparison point that keeps the diagnosis honest. It shows the fast path exists even though the job is not using it.",
            lines:[
              "CA 'mlx5_0'",
              "  Port 1: State: Active",
              "  Physical state: LinkUp",
              "  Rate: 400 Gb/sec (4X NDR)"
            ]
          }
        ],
        whatsHappening:"You are checking whether the fast InfiniBand transport is actually available on the host.",
        deeperContext:"Once configuration is checked, the next teaching move is to verify the transport is actually available. Beginners need to learn that software and fabric evidence must be compared, not studied in isolation.",
        lookFor:[
          "IB ports in Active state",
          "Expected HCAs present and named as the environment would reference them",
          "Whether the transport exists independently of the NCCL symptom"
        ],
        meaning:"This step shows whether the fast transport is genuinely available. Healthy IB state means the fallback is more likely a selection problem than a dead fabric.",
        commonMistake:"Saying 'the network is fine' without confirming that the exact fast transport NCCL needs is really active.",
        operatorTakeaway:"Operators compare transport availability with path selection so they can tell whether they are debugging hardware absence or software choice.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the HCA-fix snapshot as the narrowest evidence-backed correction. The important thing is matching NCCL to the actual active HCA you just verified.",
        screenshots:[
          {
            title:"NCCL pointed at the correct HCA",
            caption:"This screenshot is about targeted correction. It keeps the remediation small enough that the causal story stays intact.",
            lines:[
              "export NCCL_IB_HCA=mlx5_0",
              "unset NCCL_IB_DISABLE",
              "Ready to re-run NCCL path selection"
            ]
          }
        ],
        whatsHappening:"You are correcting NCCL's transport selection so it points at the actual active HCA instead of the wrong path.",
        deeperContext:"This is a targeted correction step. The beginner lesson is that a good operator applies the smallest fix that matches the evidence instead of making broad uncontrolled changes.",
        lookFor:[
          "A corrected HCA selection that matches the actual active device",
          "Removal of the mismatch between observed IB state and NCCL's chosen path",
          "A fix that directly addresses the selection problem you just validated"
        ],
        meaning:"The system is now being pointed at the right transport interface. If the prior evidence was correct, this should restore NCCL's ability to use the fast path.",
        commonMistake:"Applying multiple config changes at once and then losing the causal story of what actually fixed the problem.",
        operatorTakeaway:"Operators prefer the smallest evidence-backed fix because it keeps validation clean and lowers risk.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the verify snapshot to prove the behavior changed, not just the settings. The key clue is NCCL naming IB again after the fix.",
        screenshots:[
          {
            title:"NCCL returns to the fast path",
            caption:"This screenshot is the behavioral proof step for the fallback drill. It shows the remediation changed the actual transport choice.",
            lines:[
              "NCCL INFO NET/IB : Using mlx5_0 port 1",
              "NCCL INFO Connected all rings using IB transport",
              "NCCL INFO Socket fallback no longer selected"
            ]
          }
        ],
        whatsHappening:"You are checking whether NCCL now chooses the intended fast transport after the configuration change.",
        deeperContext:"Verification is where remediation becomes trustworthy. This step teaches beginners that a change only counts when the system behavior changes in the expected direction.",
        lookFor:[
          "NCCL selecting the intended IB path instead of TCP",
          "A log story that now matches the fabric design",
          "Clear evidence that the prior fallback condition no longer applies"
        ],
        meaning:"If NCCL now selects the intended transport, the diagnosis and targeted fix were correct. The communication stack has moved back onto the expected path.",
        commonMistake:"Stopping at the config change itself instead of proving that the software actually changed paths.",
        operatorTakeaway:"Operators trust behavior change, not just edited settings. The logs need to tell the new story now.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the throughput-comparison snapshot as the final proof that the restored fast path matters to users. The important thing is seeing recovered bandwidth, not just cleaner logs.",
        screenshots:[
          {
            title:"Recovered bandwidth after transport fix",
            caption:"This screenshot closes the loop from symptom to fix to user-visible outcome. It proves the transport correction materially improved the workload path.",
            lines:[
              "before fix : 8.1 GB/s",
              "after fix  : 181.9 GB/s",
              "communication path restored to expected baseline"
            ]
          }
        ],
        whatsHappening:"You are measuring whether the restored fast path actually brings throughput back toward the healthy baseline users expect.",
        deeperContext:"This final step closes the loop from symptom to fix to user-visible impact. Aegis should teach that the real success condition is restored throughput, not just prettier logs.",
        lookFor:[
          "Bandwidth moving back toward the healthy expected range",
          "A result that confirms the faster communication path matters to the actual workload",
          "A coherent before-and-after story that ties logs to performance"
        ],
        meaning:"Recovered bandwidth proves the issue was real, the diagnosis was grounded, and the remediation materially restored cluster efficiency.",
        commonMistake:"Calling the incident resolved because logs look cleaner even if the workload throughput is still poor.",
        operatorTakeaway:"Operators close the loop with user-visible performance, because that is what the platform is supposed to deliver.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the GPU-utilization snapshot as the symptom view, not the root cause. The key clue is the sawtooth pattern, because it tells you the GPUs are starving for input from somewhere upstream.",
        screenshots:[
          {
            title:"Sawtooth GPU utilization pattern",
            caption:"This screenshot is the visible symptom that starts the storage drill. It shows the accelerator repeatedly waiting instead of staying steadily busy.",
            lines:[
              "# gpu    sm",
              "0        92",
              "0        11",
              "0        89",
              "0        14"
            ]
          }
        ],
        whatsHappening:"You are looking at GPU utilization to see whether the accelerators are working steadily or repeatedly waiting for more data.",
        deeperContext:"This drill starts where beginners usually start: the GPU. The teaching goal is to show that the most visible symptom is not always the root cause.",
        lookFor:[
          "Sawtooth or bursty GPU utilization instead of a stable high plateau",
          "Idle gaps between compute bursts",
          "A pattern suggesting the accelerator is waiting for something else"
        ],
        meaning:"The GPUs are not being fed smoothly. This is a symptom of starvation, not proof that the GPUs themselves are faulty.",
        commonMistake:"Calling this a GPU problem immediately. The utilization shape only tells you the accelerator is waiting; it does not yet tell you which upstream stage is responsible.",
        operatorTakeaway:"Operators use the GPU view as the first clue, then trace the starvation upstream instead of stopping at the most obvious screen.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the I/O snapshot to see whether storage pressure matches the GPU starvation pattern. The important thing is the timing match between saturated storage and bursty GPUs.",
        screenshots:[
          {
            title:"Storage path is saturated",
            caption:"This screenshot is the first strong cross-component clue in the drill. It shows the data path struggling at the same time the GPUs are waiting.",
            lines:[
              "Device            r/s   rkB/s  await  %util",
              "nvme0n1         1820  941824   34.1  100.0",
              "nvme1n1         1774  915332   32.8   99.7"
            ]
          }
        ],
        whatsHappening:"You are checking whether the storage system shows pressure at the same time the GPUs look starved.",
        deeperContext:"This step teaches cross-component reasoning. You are testing whether the waiting pattern you saw on the GPU side has a matching story on the storage side.",
        lookFor:[
          "High storage utilization or long wait patterns",
          "An I/O path that looks saturated while GPUs are bursty",
          "Evidence that the bottleneck is outside the accelerator itself"
        ],
        meaning:"If the storage side is saturated while GPU utilization is sawtoothing, the system now has a plausible storage-backed explanation for the training slowdown.",
        commonMistake:"Keeping the investigation stuck on the GPU side after the storage path is already showing the same problem story.",
        operatorTakeaway:"Operators compare components side by side because good diagnosis comes from matching symptoms across the whole platform, not from staring at one metric.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the stripe snapshot to move from vague storage pressure into a mechanical explanation. The key clue is a stripe count that is too narrow for the workload's read pattern.",
        screenshots:[
          {
            title:"Dataset is under-striped",
            caption:"This screenshot turns 'storage is busy' into an actionable layout problem. It shows the dataset is not spread widely enough across the storage system.",
            lines:[
              "stripe_count: 1",
              "stripe_size: 1048576",
              "obdidx: 12"
            ]
          }
        ],
        whatsHappening:"You are checking whether the dataset is spread widely enough across the storage system to feed the workload in parallel.",
        deeperContext:"This step teaches that storage layout is part of performance reasoning. A dataset can sit on healthy hardware but still be laid out badly for the workload.",
        lookFor:[
          "A stripe count that is too narrow for the workload",
          "Dataset placement that would concentrate reads onto too few targets",
          "A concrete mechanical reason for why the I/O path is not scaling"
        ],
        meaning:"Poor striping can create an avoidable storage bottleneck by limiting parallelism in the data path. The problem is no longer just 'storage is busy'; it becomes 'storage is laid out suboptimally.'",
        commonMistake:"Blaming the whole storage platform when the real issue may be how this dataset is laid out on otherwise healthy hardware.",
        operatorTakeaway:"Operators look for mechanical causes they can fix directly. Bad layout is often more actionable than vague 'storage is slow' complaints.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Treat the stripe-fix snapshot as one controlled intervention. The important thing is that it directly addresses the layout issue you just identified rather than changing the whole pipeline at once.",
        screenshots:[
          {
            title:"Stripe count widened deliberately",
            caption:"This screenshot is the storage-side remediation step. It is narrow enough that you can still reason about what changed and why.",
            lines:[
              "Applied stripe_count: 8",
              "Applied stripe_size: 1048576",
              "Dataset now spread across 8 OSTs"
            ]
          }
        ],
        whatsHappening:"You are widening the storage layout so reads can be served from more targets in parallel.",
        deeperContext:"Now the workflow turns from diagnosis to targeted storage remediation. The beginner lesson is that fixes should correspond directly to the identified bottleneck mechanism.",
        lookFor:[
          "A striping change that increases expected data-path parallelism",
          "A fix that directly addresses the layout issue you just identified",
          "The setup needed for a meaningful before/after comparison"
        ],
        meaning:"You are increasing storage-side parallelism so reads can spread more effectively across targets. This should reduce one major source of starvation if striping was the limiting factor.",
        commonMistake:"Making the change and assuming the whole pipeline is fixed without checking whether another upstream stage is still underfeeding the GPUs.",
        operatorTakeaway:"Operators make narrow, evidence-based changes so they can tell which intervention actually improved the workload.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the loader snapshot to separate feeder throughput from storage throughput. The key clue is that the input pipeline can still underfeed the GPUs even after storage layout improves.",
        screenshots:[
          {
            title:"DataLoader parallelism increased",
            caption:"This screenshot is about the next upstream bottleneck. It shows the input feeder being tuned to take advantage of the improved storage path.",
            lines:[
              "DataLoader(num_workers=16, prefetch_factor=4)",
              "worker startup complete",
              "input queue depth stable above threshold"
            ]
          }
        ],
        whatsHappening:"You are tuning the input pipeline so it can take advantage of the improved storage path and keep batches flowing to the GPUs.",
        deeperContext:"This step teaches that the input pipeline is part of the same story. Even after storage layout improves, the DataLoader can remain the bottleneck if it cannot parallelize enough work to keep the GPUs fed.",
        lookFor:[
          "Whether the data feeder itself is still underutilizing the improved storage path",
          "A loader configuration that could limit batch delivery",
          "The distinction between storage bandwidth and input-pipeline throughput"
        ],
        meaning:"The bottleneck may be partly in the data loader layer, not just in the storage layout. This step teaches that end-to-end feeding requires both a healthy path and a capable feeder.",
        commonMistake:"Thinking storage and feeder logic are the same bottleneck. In reality, one can improve while the other still limits the job.",
        operatorTakeaway:"Operators separate storage-path fixes from loader-path fixes so the team can understand where the remaining starvation actually lives.",
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
        explainerMode:"beginner_story",
        screenshotReference:"Use the verification snapshot to prove the user-visible symptom improved. The important thing is that utilization now looks smoother and higher, not just that storage settings changed.",
        screenshots:[
          {
            title:"GPU utilization smooths out after fixes",
            caption:"This screenshot closes the storage drill by showing the accelerator is being fed more steadily after the layout and loader fixes.",
            lines:[
              "# gpu    sm",
              "0        93",
              "0        95",
              "0        94",
              "0        96"
            ]
          }
        ],
        whatsHappening:"You are going back to the GPU view to see whether the earlier storage and loader fixes actually smoothed out the workload.",
        deeperContext:"Verification closes the loop. The final proof is not that settings changed, but that the GPU now receives data smoothly enough to stay busy.",
        lookFor:[
          "Higher and smoother GPU utilization than the original sawtooth baseline",
          "Reduced idle gaps between work bursts",
          "A visible before/after improvement that matches the storage and loader changes"
        ],
        meaning:"Smoother GPU utilization means the pipeline is feeding the accelerator more effectively. This proves the diagnosis and remediation addressed the true limiting path.",
        commonMistake:"Declaring success based only on changed settings rather than on whether the user-visible symptom actually improved.",
        operatorTakeaway:"Operators close the loop by proving that the visible workload behavior changed for the reason they expected, not just because configuration drift happened.",
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
