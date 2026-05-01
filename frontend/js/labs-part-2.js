/**
 * LABS DATA CHUNK: runtime_and_training
 */

window.AEGIS_LABS_PARTS = window.AEGIS_LABS_PARTS || {};
window.AEGIS_LABS_PARTS.runtime_and_training = {
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
        terminal:{
          examples:["cat /proc/driver/nvidia/version","modinfo nvidia | head"],
          accepted:["cat /proc/driver/nvidia/version","modinfo nvidia | head"],
          weak:[
            {
              match:["nvcc --version","python3 -c \"import torch\""],
              feedback:"Those checks matter later, but this checkpoint starts at the base driver layer of the stack."
            }
          ],
          success:"Driver-layer probe accepted. Replaying the authored stack evidence for this checkpoint."
        },
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
        terminal:{
          examples:["nvcc --version","nvidia-smi | grep CUDA"],
          accepted:["nvcc --version","nvidia-smi | grep CUDA"],
          weak:[
            {
              match:["cat /proc/driver/nvidia/version","modinfo nvidia | head"],
              feedback:"The driver anchor is already useful. This checkpoint asks for the CUDA layer sitting on top of it."
            }
          ],
          success:"CUDA-layer probe accepted. Replaying the authored stack evidence for this checkpoint."
        },
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
        terminal:{
          examples:["python3 -c \"import torch\"","python3 -c \"import torch; print(torch.cuda.is_available())\""],
          accepted:["python3 -c \"import torch\"","python3 -c \"import torch; print(torch.cuda.is_available())\""],
          weak:[
            {
              match:["nvcc --version","nvidia-smi | grep CUDA"],
              feedback:"CUDA version is only the lower-layer context. This checkpoint asks whether the user-facing framework can actually use it."
            }
          ],
          success:"Framework probe accepted. Replaying the authored stack evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate cuda mismatch","trigger framework mismatch"],
          accepted:["simulate cuda mismatch","trigger framework mismatch"],
          weak:[
            {
              match:["reboot","dnf update -y"],
              feedback:"Too broad. This checkpoint is about recognizing a software-contract break before changing layers blindly."
            }
          ],
          success:"Mismatch simulation accepted. Replaying the authored stack failure evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker pull nvcr.io/nvidia/pytorch","docker pull nvcr.io/nvidia/pytorch:24.03-py3"],
          accepted:["docker pull nvcr.io/nvidia/pytorch","docker pull nvcr.io/nvidia/pytorch:24.03-py3"],
          weak:[
            {
              match:["pip install torch","dnf install cuda-toolkit"],
              feedback:"Those are broader stack edits. This checkpoint is about collapsing the search space onto a validated image baseline."
            }
          ],
          success:"Validated-image probe accepted. Replaying the authored stack recovery evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker pull nvcr.io/nvidia/pytorch","docker pull nvcr.io/nvidia/pytorch:24.03-py3"],
          accepted:["docker pull nvcr.io/nvidia/pytorch","docker pull nvcr.io/nvidia/pytorch:24.03-py3"],
          weak:[
            {
              match:["docker run --gpus all","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L"],
              feedback:"Runtime wiring matters later, but this checkpoint starts by locking the image baseline itself."
            }
          ],
          success:"Image-baseline probe accepted. Replaying the authored container evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker run --gpus all","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L"],
          accepted:["docker run --gpus all","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L"],
          weak:[
            {
              match:["docker pull nvcr.io/nvidia/pytorch","docker pull nvcr.io/nvidia/pytorch:24.03-py3"],
              feedback:"The image baseline is already set. This checkpoint asks whether the runtime is actually exposing GPUs inside the container."
            }
          ],
          success:"Runtime probe accepted. Replaying the authored container evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker run --gpus all python3 -c \"import torch\"","docker run --gpus all python3 -c \"import torch; print(torch.cuda.device_count())\""],
          accepted:["docker run --gpus all python3 -c \"import torch\"","docker run --gpus all python3 -c \"import torch; print(torch.cuda.device_count())\""],
          weak:[
            {
              match:["docker run --gpus all","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 nvidia-smi -L"],
              feedback:"Runtime exposure is only the bridge. This checkpoint asks whether the framework inside the image can really use CUDA."
            }
          ],
          success:"In-container framework probe accepted. Replaying the authored container evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker run --gpus all python3 train.py","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 python3 train.py"],
          accepted:["docker run --gpus all python3 train.py","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 python3 train.py"],
          weak:[
            {
              match:["docker run --gpus all python3 -c \"import torch\"","docker run --gpus all python3 -c \"import torch; print(torch.cuda.device_count())\""],
              feedback:"Smoke checks already proved basic visibility. This checkpoint is about end-to-end workload progress."
            }
          ],
          success:"Training probe accepted. Replaying the authored container evidence for this checkpoint."
        },
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
        terminal:{
          examples:["docker exec nvidia-smi dmon","docker exec trainer nvidia-smi dmon"],
          accepted:["docker exec nvidia-smi dmon","docker exec trainer nvidia-smi dmon"],
          weak:[
            {
              match:["docker run --gpus all python3 train.py","docker run --rm --gpus all nvcr.io/nvidia/pytorch:24.03-py3 python3 train.py"],
              feedback:"The workload launch is already the previous step. This checkpoint asks whether live GPU activity matches the training story."
            }
          ],
          success:"Live-monitoring probe accepted. Replaying the authored container evidence for this checkpoint."
        },
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
        terminal:{
          examples:["torchrun train.py","torchrun --nproc_per_node=8 train.py"],
          accepted:["torchrun train.py","torchrun --nproc_per_node=8 train.py"],
          weak:[
            {
              match:["iostat -x 1","NCCL_DEBUG=INFO torchrun train.py"],
              feedback:"Those probes matter later, but this checkpoint starts with whether the distributed job can form its rank group at all."
            }
          ],
          success:"DDP launch probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate forward pass","step forward ranks"],
          accepted:["simulate forward pass","step forward ranks"],
          weak:[
            {
              match:["torchrun train.py","torchrun --nproc_per_node=8 train.py"],
              feedback:"Launch already proved the rank group formed. This checkpoint is about the local compute phase on each rank."
            }
          ],
          success:"Forward-pass probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate backward pass","compute local grads"],
          accepted:["simulate backward pass","compute local grads"],
          weak:[
            {
              match:["simulate forward pass","step forward ranks"],
              feedback:"Local compute already happened. This checkpoint is about preparing gradients before the shared collective."
            }
          ],
          success:"Backward-pass probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
        terminal:{
          examples:["simulate allreduce","average gradients"],
          accepted:["simulate allreduce","average gradients"],
          weak:[
            {
              match:["compute local grads","simulate backward pass"],
              feedback:"Local gradients are only the handoff. This checkpoint is where the shared communication path becomes visible."
            }
          ],
          success:"AllReduce probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
        terminal:{
          examples:["optimizer.step()","apply synchronized update"],
          accepted:["optimizer.step()","apply synchronized update"],
          weak:[
            {
              match:["simulate allreduce","average gradients"],
              feedback:"Collective sync is already the previous step. This checkpoint is about the coordinated model update that follows it."
            }
          ],
          success:"Update probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
        terminal:{
          examples:["iostat -x 1","iostat -x 1 | head"],
          accepted:["iostat -x 1","iostat -x 1 | head"],
          weak:[
            {
              match:["optimizer.step()","apply synchronized update"],
              feedback:"The training loop looked healthy earlier. This checkpoint is about proving the slowdown now lives in the input path instead."
            }
          ],
          success:"Storage probe accepted. Replaying the authored training evidence for this checkpoint."
        },
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
};
