/**
 * LABS DATA CHUNK: network_and_storage
 */

window.AEGIS_LABS_PARTS = window.AEGIS_LABS_PARTS || {};
window.AEGIS_LABS_PARTS.network_and_storage = {
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
        terminal:{
          examples:["ibstat","ibstatus"],
          accepted:["ibstat","ibstatus"],
          weak:[
            {
              match:["perfquery","ib_write_bw"],
              feedback:"Those probes matter later, but this checkpoint starts with whether the fabric path is actually up."
            }
          ],
          success:"Port-state probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["perfquery","perfquery -x"],
          accepted:["perfquery","perfquery -x"],
          weak:[
            {
              match:["ibstat","ibstatus"],
              feedback:"Link state is already useful context. This checkpoint asks whether the active path is actually clean under traffic."
            }
          ],
          success:"Counter probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ib_write_bw","ib_write_bw -d mlx5_0"],
          accepted:["ib_write_bw","ib_write_bw -d mlx5_0"],
          weak:[
            {
              match:["perfquery","perfquery -x"],
              feedback:"Counters are only the setup. This checkpoint asks whether the fabric delivers real throughput in practice."
            }
          ],
          success:"Bandwidth probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate port down","unplug ib cable"],
          accepted:["simulate port down","unplug ib cable"],
          weak:[
            {
              match:["reboot","systemctl restart opensm"],
              feedback:"Too broad. This checkpoint is about recognizing a missing fabric path, not jumping to host-wide recovery."
            }
          ],
          success:"Port-fault probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ibdiagnet --pc","ibdiagnet --pc --local"],
          accepted:["ibdiagnet --pc","ibdiagnet --pc --local"],
          weak:[
            {
              match:["ibstat","perfquery"],
              feedback:"The host-local clues are already visible. This checkpoint widens scope to test whether the bad path shows up in broader fabric diagnostics."
            }
          ],
          success:"Fabric-diagnostic probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ibdiagnet --pc --pm","ibdiagnet --topology"],
          accepted:["ibdiagnet --pc --pm","ibdiagnet --topology"],
          weak:[
            {
              match:["ibdiagnet --pc","ibdiagnet --pc --local"],
              feedback:"The local diagnostic already found the suspect path. This checkpoint asks for blast-radius proof across the wider fabric."
            }
          ],
          success:"Fabric-sweep probe accepted. Replaying the authored fabric evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ip link show eth0","ip link show dev eth0"],
          accepted:["ip link show eth0","ip link show dev eth0"],
          weak:[
            {
              match:["ethtool -A eth0","tc qdisc show"],
              feedback:"Those checks matter later, but this checkpoint starts with the basic path-alignment signal from MTU."
            }
          ],
          success:"MTU probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ethtool -A eth0","ethtool --show-pause eth0"],
          accepted:["ethtool -A eth0","ethtool --show-pause eth0"],
          weak:[
            {
              match:["ip link show eth0","ip link show dev eth0"],
              feedback:"MTU already established the baseline. This checkpoint asks whether the host-side lossless policy is actually enabled."
            }
          ],
          success:"PFC probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["tc qdisc show","tc -s qdisc show dev eth0"],
          accepted:["tc qdisc show","tc -s qdisc show dev eth0"],
          weak:[
            {
              match:["ethtool -A eth0","ethtool --show-pause eth0"],
              feedback:"PFC is only part of the path story. This checkpoint asks whether the fabric can signal congestion before collapse."
            }
          ],
          success:"ECN probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ib_write_bw -d rxe0","ib_write_bw --report_gbits -d rxe0"],
          accepted:["ib_write_bw -d rxe0","ib_write_bw --report_gbits -d rxe0"],
          weak:[
            {
              match:["tc qdisc show","tc -s qdisc show dev eth0"],
              feedback:"The congestion settings are only the setup. This checkpoint asks whether the RoCE path performs well in practice."
            }
          ],
          success:"RoCE bandwidth probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ethtool -S eth0","simulate pfc storm"],
          accepted:["ethtool -S eth0","simulate pfc storm"],
          weak:[
            {
              match:["reboot","ifdown eth0"],
              feedback:"Too broad. This checkpoint is about recognizing a soft congestion-control failure while the link still stays up."
            }
          ],
          success:"RoCE fault probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["tune switch buffers","apply ecn threshold 48kb"],
          accepted:["tune switch buffers","apply ecn threshold 48kb"],
          weak:[
            {
              match:["ethtool -S eth0","simulate pfc storm"],
              feedback:"The storm evidence is already visible. This checkpoint is about a narrow congestion-control fix tied to that signal."
            }
          ],
          success:"RoCE remediation probe accepted. Replaying the authored RoCE evidence for this checkpoint."
        },
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
        terminal:{
          examples:["NCCL_DEBUG=INFO torchrun train.py","NCCL_DEBUG=INFO ./all_reduce_perf"],
          accepted:["NCCL_DEBUG=INFO torchrun train.py","NCCL_DEBUG=INFO ./all_reduce_perf"],
          weak:[
            {
              match:["nvidia-smi","nvidia-smi topo -m"],
              feedback:"Useful context, but it does not tell you which transport NCCL actually selected. Start with the NCCL path evidence."
            }
          ],
          success:"NCCL path probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["env | grep NCCL","printenv | grep NCCL"],
          accepted:["env | grep NCCL","printenv | grep NCCL"],
          weak:[
            {
              match:["ibstat"],
              feedback:"InfiniBand state matters, but this step first asks whether configuration alone is forcing the wrong path."
            }
          ],
          success:"Environment probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["ibstat","ibstatus"],
          accepted:["ibstat","ibstatus"],
          weak:[
            {
              match:["env | grep NCCL","printenv | grep NCCL"],
              feedback:"Environment is already part of the story. This checkpoint is narrower: verify whether the fast transport is actually available."
            }
          ],
          success:"InfiniBand availability probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["export NCCL_IB_HCA=mlx5_0","unset NCCL_IB_DISABLE"],
          accepted:["export NCCL_IB_HCA=mlx5_0","unset NCCL_IB_DISABLE"],
          weak:[
            {
              match:["export NCCL_IB_HCA=mlx5_1","export NCCL_SOCKET_IFNAME=eth0"],
              feedback:"That changes transport selection, but not toward the evidence-backed device from the previous step. Keep the fix narrow and specific."
            }
          ],
          success:"Targeted transport fix accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["NCCL_DEBUG=INFO torchrun","NCCL_DEBUG=INFO ./all_reduce_perf"],
          accepted:["NCCL_DEBUG=INFO torchrun","NCCL_DEBUG=INFO ./all_reduce_perf"],
          weak:[
            {
              match:["export NCCL_IB_HCA=mlx5_0","unset NCCL_IB_DISABLE"],
              feedback:"The fix is already the previous step. This checkpoint needs behavior proof that NCCL changed paths."
            }
          ],
          success:"Post-fix verification probe accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["./perf","./all_reduce_perf -g 16"],
          accepted:["./perf","./all_reduce_perf -g 16"],
          weak:[
            {
              match:["NCCL_DEBUG=INFO torchrun","NCCL_DEBUG=INFO ./all_reduce_perf"],
              feedback:"Cleaner logs are useful, but this checkpoint is about user-visible throughput recovery."
            }
          ],
          success:"Bandwidth comparison accepted. Replaying the authored evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvidia-smi dmon -s u","nvidia-smi dmon -s u -d 1"],
          accepted:["nvidia-smi dmon -s u","nvidia-smi dmon -s u -d 1"],
          weak:[
            {
              match:["iostat -x 1","lfs getstripe"],
              feedback:"Those probes matter later, but this checkpoint starts with the visible starvation symptom on the GPU side."
            }
          ],
          success:"GPU-utilization probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
        terminal:{
          examples:["iostat -x 1","iostat -x 1 | head"],
          accepted:["iostat -x 1","iostat -x 1 | head"],
          weak:[
            {
              match:["nvidia-smi dmon -s u","nvidia-smi dmon -s u -d 1"],
              feedback:"The GPU symptom is already visible. This checkpoint asks whether storage pressure matches that starvation pattern."
            }
          ],
          success:"I/O probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
        terminal:{
          examples:["lfs getstripe","lfs getstripe /datasets/train"],
          accepted:["lfs getstripe","lfs getstripe /datasets/train"],
          weak:[
            {
              match:["iostat -x 1","iostat -x 1 | head"],
              feedback:"Storage pressure is already visible. This checkpoint asks whether the data layout itself is narrowing the feed path."
            }
          ],
          success:"Striping probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
        terminal:{
          examples:["lfs setstripe -c 8","lfs setstripe -c 8 /datasets/train"],
          accepted:["lfs setstripe -c 8","lfs setstripe -c 8 /datasets/train"],
          weak:[
            {
              match:["num_workers=16","set dataloader workers 16"],
              feedback:"Loader tuning matters too, but this checkpoint first fixes the narrow data-layout bottleneck you just confirmed."
            }
          ],
          success:"Stripe-fix probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
        terminal:{
          examples:["num_workers=16","set dataloader workers 16"],
          accepted:["num_workers=16","set dataloader workers 16"],
          weak:[
            {
              match:["lfs setstripe -c 8","lfs setstripe -c 8 /datasets/train"],
              feedback:"The layout fix already happened. This checkpoint is about removing feeder-side stalls in the loader path too."
            }
          ],
          success:"DataLoader tuning probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvidia-smi dmon","watch nvidia-smi dmon"],
          accepted:["nvidia-smi dmon","watch nvidia-smi dmon"],
          weak:[
            {
              match:["num_workers=16","set dataloader workers 16"],
              feedback:"The tuning step is already done. This checkpoint is about proving the sawtooth pattern really disappeared."
            }
          ],
          success:"Verification probe accepted. Replaying the authored storage evidence for this checkpoint."
        },
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
};
