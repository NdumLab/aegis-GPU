/**
 * LABS DATA CHUNK: fabric_and_partitioning
 */

window.AEGIS_LABS_PARTS = window.AEGIS_LABS_PARTS || {};
window.AEGIS_LABS_PARTS.fabric_and_partitioning = {
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
        terminal:{
          examples:["nvidia-smi topo -m","nvidia-smi topo --matrix"],
          accepted:["nvidia-smi topo -m","nvidia-smi topo --matrix"],
          weak:[
            {
              match:["nvidia-smi","nvidia-smi -L"],
              feedback:"Useful inventory check, but it does not prove the GPU-to-GPU path shape. Start with the topology matrix."
            }
          ],
          success:"Topology probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvidia-smi nvlink -e","nvidia-smi nvlink --error-counters"],
          accepted:["nvidia-smi nvlink -e","nvidia-smi nvlink --error-counters"],
          weak:[
            {
              match:["nvidia-smi topo -m"],
              feedback:"Topology is already useful, but this step is narrower: you need the per-link error counters before trusting the path."
            }
          ],
          success:"NVLink counter probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
          "Any link with increasing error counters relative to its peers may indicate a degraded path.",
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
        terminal:{
          examples:["./nccl-tests/build/all_reduce_perf -b 1G -e 4G -f 2 -g 8","./nccl-tests/all_reduce_perf -g 8"],
          accepted:["./nccl-tests/build/all_reduce_perf -b 1G -e 4G -f 2 -g 8","./nccl-tests/all_reduce_perf -g 8"],
          weak:[
            {
              match:["nvidia-smi dmon","nvidia-smi"],
              feedback:"Useful GPU visibility check, but this step is about proving collective bandwidth on the fast path."
            }
          ],
          success:"Collective benchmark accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["inject nvlink fault","simulate phb fallback"],
          accepted:["inject nvlink fault","simulate phb fallback"],
          weak:[
            {
              match:["reboot","systemctl restart"],
              feedback:"Too broad. This fault step is about observing the degraded path, not trying a host-level reset first."
            }
          ],
          success:"Fault injection accepted. Replaying the authored degraded evidence for this checkpoint."
        },
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
        terminal:{
          examples:["NCCL_DEBUG=INFO torchrun train.py","NCCL_DEBUG=INFO ./all_reduce_perf"],
          accepted:["NCCL_DEBUG=INFO torchrun train.py","NCCL_DEBUG=INFO ./all_reduce_perf"],
          weak:[
            {
              match:["nvidia-smi topo -m","nvidia-smi nvlink -e"],
              feedback:"Those probes were right earlier, but this step is asking for the software-layer confirmation of the fallback path."
            }
          ],
          success:"NCCL fallback probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["sudo nvidia-smi -i 0 -mig 1","nvidia-smi -i 0 -q | grep MIG"],
          accepted:["sudo nvidia-smi -i 0 -mig 1","nvidia-smi -i 0 -q | grep MIG"],
          weak:[
            {
              match:["nvidia-smi mig -lgi","nvidia-smi -L"],
              feedback:"Inventory comes later. This checkpoint starts with the device-level mode change that makes partitioning possible at all."
            }
          ],
          success:"MIG mode probe accepted. Replaying the authored enablement evidence for this checkpoint."
        },
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
        terminal:{
          examples:["sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C","sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 --create-gpu-instances"],
          accepted:["sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C","sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 --create-gpu-instances"],
          weak:[
            {
              match:["nvidia-smi mig -lgi","nvidia-smi -L"],
              feedback:"Verification is next. This checkpoint is where you actually carve the seven 1g.10gb slices into the GPU."
            }
          ],
          success:"MIG instance-creation probe accepted. Replaying the authored partition evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvidia-smi mig -lgi","nvidia-smi mig --list-gpu-instance"],
          accepted:["nvidia-smi mig -lgi","nvidia-smi mig --list-gpu-instance"],
          weak:[
            {
              match:["sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C"],
              feedback:"Creation intent is already useful, but this checkpoint is about verifying the resulting hardware state."
            }
          ],
          success:"MIG listing probe accepted. Replaying the authored verification evidence for this checkpoint."
        },
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
        terminal:{
          examples:["cat /opt/aegis/mig-assignments.txt","less /opt/aegis/mig-assignments.txt"],
          accepted:["cat /opt/aegis/mig-assignments.txt","less /opt/aegis/mig-assignments.txt"],
          weak:[
            {
              match:["nvidia-smi mig -lgi","nvidia-smi -L"],
              feedback:"Slice inventory is already verified. This checkpoint is about showing how teams map onto those slices in practice."
            }
          ],
          success:"MIG assignment probe accepted. Replaying the authored tenant-mapping evidence for this checkpoint."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Treat the assignment snapshot as an operating model, not a shell transcript. The value is seeing which teams consume which slices so you can reason about isolation and oversubscription at a glance.",
        screenshots:[
          {
            title:"Example tenant-to-slice assignment",
            caption:"This is a policy screenshot rather than a low-level device output. Its job is to make the sharing model visible enough that a beginner can reason about blast radius and fairness.",
            lines:[
              "Team A -> GI 1, GI 2",
              "  CUDA_VISIBLE_DEVICES=MIG-GPU-0:1:0,MIG-GPU-0:2:0",
              "Team B -> GI 3, GI 4",
              "  CUDA_VISIBLE_DEVICES=MIG-GPU-0:3:0,MIG-GPU-0:4:0",
              "Team C -> GI 5, GI 6, GI 7",
              "  CUDA_VISIBLE_DEVICES=MIG-GPU-0:5:0,MIG-GPU-0:6:0,MIG-GPU-0:7:0",
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
        terminal:{
          examples:["sudo nvidia-smi -i 0 -mig 0","nvidia-smi -i 0 -q | grep MIG"],
          accepted:["sudo nvidia-smi -i 0 -mig 0","nvidia-smi -i 0 -q | grep MIG"],
          weak:[
            {
              match:["cat /opt/aegis/mig-assignments.txt","nvidia-smi mig -lgi"],
              feedback:"That still describes the partitioned state. This checkpoint is about proving the GPU returned to full-device mode."
            }
          ],
          success:"MIG cleanup probe accepted. Replaying the authored full-GPU restore evidence for this checkpoint."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Use the cleanup snapshot to verify that the hardware contract really changed back to full-device mode. If the screenshot still suggests MIG is enabled, do not assume cleanup happened just because you expected it to.",
        screenshots:[
          {
            title:"MIG disabled and full GPU restored",
            caption:"This screenshot matters because cleanup is a hardware state change too. The operator should confirm that the device really returned to full-GPU mode before declaring the reset complete.",
            lines:[
              "Destroyed GPU instance ID 1 on GPU 0",
              "Destroyed GPU instance ID 2 on GPU 0",
              "Destroyed GPU instance ID 3 on GPU 0",
              "Destroyed GPU instance ID 4 on GPU 0",
              "Destroyed GPU instance ID 5 on GPU 0",
              "Destroyed GPU instance ID 6 on GPU 0",
              "Destroyed GPU instance ID 7 on GPU 0",
              "Disabled MIG Mode for GPU 00000000:17:00.0",
              "All done.",
              "",
              "GPU  GI  CI  MIG",
              "  0   -   -  Disabled",
              "Full GPU restored: H100 SXM5 80GB available as one device"
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
        terminal:{
          examples:["dcgmi dmon -e 156,157 -c 5","dcgmi dmon -e 156,157"],
          accepted:["dcgmi dmon -e 156,157 -c 5","dcgmi dmon -e 156,157"],
          weak:[
            {
              match:["nvidia-smi","dmesg | grep -i xid"],
              feedback:"Useful later, but this baseline step is about clean ECC counters before any fault appears."
            }
          ],
          success:"ECC baseline probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate ecc degradation","inject sbe trend"],
          accepted:["simulate ecc degradation","inject sbe trend"],
          weak:[
            {
              match:["dcgmi dmon -e 156,157 -c 5"],
              feedback:"That was the clean baseline. This step is about observing the warning-phase rise in corrected errors."
            }
          ],
          success:"ECC warning phase injected. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["dcgmi dmon -e 156,157 -c 10","dcgmi dmon -e 156,157 -c 8"],
          accepted:["dcgmi dmon -e 156,157 -c 10","dcgmi dmon -e 156,157 -c 8"],
          weak:[
            {
              match:["dmesg | grep -i xid","dcgmi dmon -e 157 -c 3"],
              feedback:"Those are later escalation checks. This step is still about proving the corrected-error trend persists over time."
            }
          ],
          success:"ECC trend poll accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["dmesg | grep -i xid","journalctl -k | grep -i xid"],
          accepted:["dmesg | grep -i xid","journalctl -k | grep -i xid"],
          weak:[
            {
              match:["dcgmi dmon -e 156,157 -c 10","dcgmi dmon -e 156,157"],
              feedback:"The counter trend set the context, but this step needs the hard fault event from the kernel log."
            }
          ],
          success:"XID fault probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["kubectl drain gpu-node-03","kubectl cordon gpu-node-03"],
          accepted:["kubectl drain gpu-node-03","kubectl cordon gpu-node-03"],
          weak:[
            {
              match:["dmesg | grep -i xid","dcgmi dmon -e 157 -c 3"],
              feedback:"Those probes confirm the incident. This step is about containment so new work stops landing on the bad node."
            }
          ],
          success:"Containment command accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["dmesg | tail -20 | grep xid","journalctl -k | tail -20 | grep xid"],
          accepted:["dmesg | tail -20 | grep xid","journalctl -k | tail -20 | grep xid"],
          weak:[
            {
              match:["dcgmi dmon -e 157 -c 3","nvidia-smi nvlink -e"],
              feedback:"Those belong to later branches. Start by identifying the fault family from the alert itself."
            }
          ],
          success:"XID 48 alert probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["dcgmi dmon -e 157 -c 3","dcgmi dmon -e 157"],
          accepted:["dcgmi dmon -e 157 -c 3","dcgmi dmon -e 157"],
          weak:[
            {
              match:["dmesg | tail -20 | grep xid","sudo nvidia-smi --gpu-reset -i 3"],
              feedback:"The alert already pointed you here. This step is about confirming the uncorrectable ECC side with DBE evidence."
            }
          ],
          success:"DBE confirmation probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate gpu hang","inject xid 79"],
          accepted:["simulate gpu hang","inject xid 79"],
          weak:[
            {
              match:["dcgmi dmon -e 157 -c 3","dmesg | tail -20 | grep xid"],
              feedback:"Those belong to the earlier ECC branch. This step is about switching into the bus-reachability fault family."
            }
          ],
          success:"XID 79 fault injected. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["sudo nvidia-smi --gpu-reset -i 3","nvidia-smi --gpu-reset -i 3"],
          accepted:["sudo nvidia-smi --gpu-reset -i 3","nvidia-smi --gpu-reset -i 3"],
          weak:[
            {
              match:["reboot","systemctl reboot"],
              feedback:"Too broad for the first recovery move. This step tests whether the incident can stay GPU-scoped before escalating to a node reboot."
            }
          ],
          success:"GPU reset attempt accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvidia-smi nvlink -e","nvidia-smi nvlink --error-counters"],
          accepted:["nvidia-smi nvlink -e","nvidia-smi nvlink --error-counters"],
          weak:[
            {
              match:["sudo nvidia-smi --gpu-reset -i 3","dmesg | tail -20 | grep xid"],
              feedback:"Those match different fault families. This step needs link-quality evidence for the NVLink branch."
            }
          ],
          success:"NVLink fault probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
};
