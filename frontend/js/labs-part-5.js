/**
 * LABS DATA CHUNK: exam_coverage_extension
 *
 * These labs close NCA-AIIO blueprint gaps that the operations-first labs did
 * not exercise: Domain 1 (Essential AI Knowledge) conceptual objectives and the
 * Domain 2 (AI Infrastructure) planning objectives (power, cooling, facility,
 * scaling, cloud vs on-prem, DPU) plus the Domain 3 virtualization objective.
 *
 * Each lab keeps the same "explain + execute + troubleshoot" contract as the
 * operations labs: every step has accepted terminal probes (execute), authored
 * evidence (observe), and at least one fault/decision step (troubleshoot).
 *
 * Hardware honesty: the commands are real NVIDIA/Linux commands but the evidence
 * is authored, because the underlying objectives require NVIDIA GPUs, BlueField
 * DPUs, licensed vGPU/AI Enterprise software, or a full data center that cannot
 * be reproduced in a browser sandbox. See docs/nvidia-exam-coverage.md.
 */

window.AEGIS_LABS_PARTS = window.AEGIS_LABS_PARTS || {};
window.AEGIS_LABS_PARTS.exam_coverage_extension = {
  ai_concepts: {
    name: "AI, ML & DL Foundations",
    icon: "🧩",
    color: "#7c5cff",
    objective: "Differentiate AI/ML/DL and see why GPUs beat CPUs for deep learning.",
    steps: [
      {
        label:"Classify AI vs ML vs DL",
        cmd:"cat /opt/aegis/ai-taxonomy.txt",
        type:"aic_taxonomy",
        terminal:{
          examples:["cat /opt/aegis/ai-taxonomy.txt","less /opt/aegis/ai-taxonomy.txt"],
          accepted:["cat /opt/aegis/ai-taxonomy.txt","less /opt/aegis/ai-taxonomy.txt"],
          weak:[{match:["nvidia-smi"],feedback:"That shows the GPU, but this checkpoint is about the concept hierarchy first. Read the taxonomy before you touch hardware."}],
          success:"Taxonomy accepted. Replaying the authored concept map for this checkpoint."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the nesting like a set of rings: AI is the outer ring, machine learning sits inside it, and deep learning sits inside machine learning. If your mental model treats them as three separate things, fix that before moving on.",
        screenshots:[{
          title:"The AI / ML / DL concept map",
          caption:"Deep learning is a subset of machine learning, which is a subset of AI. The exam wants you to place a technique in the right ring, not to define them as rivals.",
          lines:[
            "AI  ── any system that mimics human-like reasoning or decisions",
            " └─ ML  ── systems that learn patterns from data instead of fixed rules",
            "     └─ DL ── multi-layer neural networks that learn features automatically",
            "GenAI / LLMs are deep learning models specialized for generation",
            "Rule engine = AI but NOT ML | Linear regression = ML but NOT DL"
          ]
        }],
        whatsHappening:"You are placing the three most confused exam terms into their correct nested relationship instead of treating them as competing labels.",
        deeperContext:"Many Domain 1 questions hinge on whether you can classify a described technique. If you know deep learning is a specialization of machine learning, which is a specialization of AI, most of those questions resolve quickly.",
        lookFor:[
          "AI as the broad outer category of intelligent behavior",
          "ML as the data-driven learning subset of AI",
          "DL as the neural-network subset of ML that powers modern GenAI"
        ],
        meaning:"AI, ML, and DL are nested, not separate. Generative AI and large language models are deep learning, so they inherit the GPU-heavy training profile of DL.",
        commonMistake:"Describing them as three parallel technologies. They are concentric: every DL system is ML and AI, but not every AI system learns from data.",
        operatorTakeaway:"When a scenario describes learning from data with many-layer networks, you are in the deep-learning ring, and that is exactly where accelerated compute matters most.",
        takeAction:[
          "Practice slotting a described technique into AI, ML, or DL.",
          "Tie deep learning to neural networks and large matrix math.",
          "Remember GenAI and LLMs are deep learning, not a fourth category."
        ],
        avoid:[
          "Do not treat AI, ML, and DL as mutually exclusive.",
          "Do not assume every AI system needs a GPU; only the DL-heavy ones usually do."
        ]
      },
      {
        label:"Benchmark on CPU",
        cmd:"python3 matmul_bench.py --device cpu",
        type:"aic_cpu",
        terminal:{
          examples:["python3 matmul_bench.py --device cpu","python3 matmul_bench.py --device cpu --size 8192"],
          accepted:["python3 matmul_bench.py --device cpu","python3 matmul_bench.py --device cpu --size 8192"],
          weak:[{match:["python3 matmul_bench.py --device gpu"],feedback:"Establish the CPU baseline first. You cannot describe a speedup without a starting number."}],
          success:"CPU baseline accepted. Replaying the authored serial-execution evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Anchor on the wall-clock time and the low core-parallelism. This is the slow baseline you will compare the GPU against.",
        screenshots:[{
          title:"CPU matrix-multiply baseline",
          caption:"A CPU has a few powerful cores tuned for latency and branching. A large dense matrix multiply barely uses that design well, so it is slow.",
          lines:[
            "$ python3 matmul_bench.py --device cpu --size 8192",
            "device: CPU (32 cores, AVX-512)",
            "8192x8192 fp32 matmul ......  9.84 s",
            "sustained throughput ........  ~0.11 TFLOP/s effective",
            "note: cores are latency-optimized, not throughput-optimized"
          ]
        }],
        whatsHappening:"You are running a large dense matrix multiply on the CPU to capture how the latency-optimized architecture handles a throughput-heavy AI workload.",
        deeperContext:"Deep learning is dominated by dense linear algebra. A CPU spends its transistor budget on large caches, branch prediction, and a few fast cores, which is the wrong shape for thousands of identical multiply-add operations.",
        lookFor:[
          "A relatively long wall-clock time for the matmul",
          "Few cores doing latency-optimized serial-ish work",
          "A low effective throughput number for this workload"
        ],
        meaning:"The CPU is not broken; it is simply architected for latency and general-purpose branching, so a massively parallel matmul is a poor fit.",
        commonMistake:"Concluding the CPU is defective because it is slow here. It is optimized for a different class of work.",
        operatorTakeaway:"Baselines matter. Without the CPU number, the GPU result is just a big number with no meaning.",
        takeAction:[
          "Record the CPU wall-clock time as the baseline.",
          "Note that few, powerful cores favor latency, not throughput.",
          "Keep this number ready to compute the GPU speedup next."
        ],
        avoid:[
          "Do not call the CPU broken for losing a throughput contest.",
          "Do not skip the baseline and jump straight to the GPU."
        ]
      },
      {
        label:"Benchmark on GPU",
        cmd:"python3 matmul_bench.py --device gpu",
        type:"aic_gpu",
        terminal:{
          examples:["python3 matmul_bench.py --device gpu","python3 matmul_bench.py --device gpu --size 8192"],
          accepted:["python3 matmul_bench.py --device gpu","python3 matmul_bench.py --device gpu --size 8192"],
          weak:[{match:["nvidia-smi"],feedback:"Visibility is not the point here; run the same benchmark on the GPU so you can compare against the CPU baseline."}],
          success:"GPU benchmark accepted. Replaying the authored parallel-execution evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Compare the GPU time and throughput directly against the CPU screenshot. The speedup factor is the whole lesson.",
        screenshots:[{
          title:"GPU matrix-multiply result",
          caption:"An H100 has thousands of throughput-optimized cores plus Tensor Cores. The same matmul finishes far faster because the work maps onto that parallel design.",
          lines:[
            "$ python3 matmul_bench.py --device gpu --size 8192",
            "device: NVIDIA H100 80GB HBM3 (132 SMs, Tensor Cores)",
            "8192x8192 fp32 matmul ......  0.061 s   (~161x faster than CPU)",
            "sustained throughput ........  ~18 TFLOP/s effective (fp32)",
            "note: SIMT execution keeps thousands of ALUs busy in parallel"
          ]
        }],
        whatsHappening:"You are running the identical workload on the GPU to see how a throughput-optimized, massively parallel architecture handles the same dense math.",
        deeperContext:"The GPU spends its transistor budget on many simple cores executing the same instruction across lots of data (SIMT), plus Tensor Cores for matrix math. That is exactly the shape of deep-learning workloads.",
        lookFor:[
          "A dramatically shorter wall-clock time than the CPU",
          "A large speedup factor versus the CPU baseline",
          "High parallel throughput from many cores plus Tensor Cores"
        ],
        meaning:"The GPU wins because the workload is embarrassingly parallel and maps onto thousands of cores, not because the CPU is bad hardware.",
        commonMistake:"Believing the GPU is universally faster. It is faster for parallel throughput work; a single-threaded branchy task can still favor the CPU.",
        operatorTakeaway:"The right accelerator depends on the workload shape. Deep learning is throughput-bound matrix math, which is the GPU's home turf.",
        takeAction:[
          "Compute the speedup factor from the two runs.",
          "Attribute the win to parallelism and Tensor Cores, not magic.",
          "Explain when CPU vs GPU is the right tool for a given task."
        ],
        avoid:[
          "Do not generalize that GPUs are always faster than CPUs.",
          "Do not ignore that data movement can erase the compute win if I/O is slow."
        ]
      },
      {
        label:"Explain the Architecture Gap",
        cmd:"nvidia-smi -q | grep -A6 'Product Architecture'",
        type:"aic_arch",
        fault:true,
        terminal:{
          examples:["nvidia-smi -q | grep -A6 'Product Architecture'","nvidia-smi -q -d SUPPORTED_CLOCKS"],
          accepted:["nvidia-smi -q | grep -A6 'Product Architecture'","nvidia-smi -q -d SUPPORTED_CLOCKS"],
          weak:[{match:["reboot","systemctl restart"],feedback:"Nothing is broken to reset. This step is about explaining why the two architectures differ, not recovering hardware."}],
          success:"Architecture query accepted. Replaying the authored comparison."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read this as a design-choice comparison, not a defect report. The CPU and GPU each optimized for a different goal.",
        screenshots:[{
          title:"Why the two architectures diverge",
          caption:"This is the reasoning trap: slow CPU matmul is a design trade-off, not a fault. Latency-optimized vs throughput-optimized is the exam's core GPU-vs-CPU idea.",
          lines:[
            "CPU  : few cores, big caches, branch prediction  -> latency-optimized",
            "GPU  : thousands of ALUs, SIMT, Tensor Cores      -> throughput-optimized",
            "H100 : 132 SMs, HBM3 ~3.35 TB/s memory bandwidth",
            "Trap : 'the CPU is defective' -> WRONG, it is a different tool",
            "Right: match workload shape (serial vs parallel) to the processor"
          ]
        }],
        whatsHappening:"You are turning the benchmark numbers into a defensible explanation of why GPUs and CPUs are built differently and when to choose each.",
        deeperContext:"The exam frequently offers a wrong answer that blames hardware. The safe operator reasoning is that architecture is a trade-off: latency vs throughput, few strong cores vs many simple cores, big caches vs high memory bandwidth.",
        lookFor:[
          "Latency-optimized CPU design versus throughput-optimized GPU design",
          "High GPU memory bandwidth feeding many parallel cores",
          "A workload-to-architecture matching decision instead of a blame decision"
        ],
        meaning:"Choosing an accelerator is about matching workload shape to architecture. Deep learning's parallel matrix math is why GPUs dominate AI training and inference.",
        commonMistake:"Concluding the CPU is faulty because it lost the matmul race. That is the classic wrong answer; it is an architecture trade-off.",
        operatorTakeaway:"When a scenario tempts you to call slow CPU compute a hardware failure, reframe it as a workload-architecture mismatch instead.",
        takeAction:[
          "State the CPU/GPU trade-off in one sentence each.",
          "Reject answer choices that treat a design trade-off as a defect.",
          "Recommend the processor that matches the workload shape."
        ],
        avoid:[
          "Do not equate 'slower here' with 'broken'.",
          "Do not forget memory bandwidth is part of why GPUs sustain throughput."
        ]
      }
    ]
  },
  inference: {
    name: "Training vs Inference Serving",
    icon: "⚡",
    color: "#22c3a6",
    objective: "Contrast training and inference architecture and serve a model with Triton.",
    steps: [
      {
        label:"Profile a Training Job",
        cmd:"nvidia-smi dmon -s um -c 5",
        type:"inf_train_profile",
        terminal:{
          examples:["nvidia-smi dmon -s um -c 5","nvidia-smi dmon -s um"],
          accepted:["nvidia-smi dmon -s um -c 5","nvidia-smi dmon -s um"],
          weak:[{match:["nvidia-smi"],feedback:"A single snapshot hides the pattern. Sample over time so you can see the sustained training profile."}],
          success:"Training profile accepted. Replaying the authored training-shape evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the profile as sustained and memory-hungry. Training keeps the GPU pinned high because backprop and large batches keep it fed.",
        screenshots:[{
          title:"Training resource profile",
          caption:"Training runs the forward and backward pass with large batches, optimizer states, and gradients. Utilization and memory both sit high for long stretches.",
          lines:[
            "$ nvidia-smi dmon -s um -c 5",
            "# gpu   sm%   mem%   fb_used(MiB)",
            "    0    97     88        71680   <- large batch + optimizer states",
            "    0    96     88        71680",
            "    0    98     89        72704   sustained high utilization = training"
          ]
        }],
        whatsHappening:"You are capturing the resource fingerprint of a training job: high sustained SM utilization and heavy framebuffer use.",
        deeperContext:"Training needs memory for weights, activations, gradients, and optimizer states, and it runs backpropagation. That is why it is throughput-oriented, batched, and often multi-GPU with AllReduce.",
        lookFor:[
          "Sustained high SM utilization across samples",
          "High framebuffer memory from optimizer states and activations",
          "A throughput-first pattern rather than short latency-sensitive bursts"
        ],
        meaning:"Training is a throughput problem: fill big batches, keep GPUs busy, and synchronize gradients. Memory pressure is high because of the extra training state.",
        commonMistake:"Assuming training and inference stress hardware the same way. Training holds far more state and runs the backward pass.",
        operatorTakeaway:"A sustained, memory-heavy, high-utilization profile is the signature of training, which drives your capacity and interconnect planning.",
        takeAction:[
          "Note the sustained utilization and high memory use.",
          "Tie the memory to gradients and optimizer states.",
          "Remember training usually needs the fast collective path."
        ],
        avoid:[
          "Do not size a cluster for training using inference assumptions.",
          "Do not ignore that training memory is dominated by non-weight state."
        ]
      },
      {
        label:"Deploy an Inference Server",
        cmd:"tritonserver --model-repository=/models",
        type:"inf_serve_deploy",
        terminal:{
          examples:["tritonserver --model-repository=/models","curl -s localhost:8000/v2/health/ready"],
          accepted:["tritonserver --model-repository=/models","curl -s localhost:8000/v2/health/ready"],
          weak:[{match:["python3 train.py","torchrun train.py"],feedback:"That launches training. This checkpoint is about standing up a serving endpoint for inference."}],
          success:"Inference server accepted. Replaying the authored deployment evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Confirm the server loaded the model and reports ready. Inference is a service you deploy, not a batch job you finish.",
        screenshots:[{
          title:"Triton Inference Server ready",
          caption:"Triton (part of NVIDIA AI Enterprise) serves models behind a stable API. NIM packages this pattern as a ready-to-run microservice.",
          lines:[
            "$ tritonserver --model-repository=/models",
            "I0709 model_repository_manager: loaded 'resnet50_trt' version 1",
            "I0709 server: HTTP service listening on 0.0.0.0:8000",
            "$ curl -s localhost:8000/v2/health/ready  -> HTTP 200 (READY)",
            "backend: TensorRT | dynamic_batching: enabled"
          ]
        }],
        whatsHappening:"You are deploying a model as a long-running inference service and confirming it is ready to accept requests.",
        deeperContext:"Inference is the deployment stage of the AI lifecycle. NVIDIA serves it with Triton Inference Server and NIM microservices, usually after optimizing the model with TensorRT. It is latency-sensitive and request-driven, not batch-and-finish.",
        lookFor:[
          "The model repository loading a specific model version",
          "A health endpoint reporting ready",
          "A serving backend such as TensorRT with dynamic batching"
        ],
        meaning:"Inference is a service. You deploy it, keep it healthy, and measure request latency and throughput, unlike a training job that runs to completion.",
        commonMistake:"Treating inference like a training run. Inference is a persistent endpoint measured by latency and throughput under load.",
        operatorTakeaway:"Serving stacks like Triton and NIM turn an optimized model into a scalable, monitored endpoint, which is the deploy step of the lifecycle.",
        takeAction:[
          "Confirm the model loaded and the server is ready.",
          "Note the serving backend and that batching is enabled.",
          "Frame inference as a deployed service, not a finished job."
        ],
        avoid:[
          "Do not confuse a serving endpoint with a training launcher.",
          "Do not ignore the health check before sending production traffic."
        ]
      },
      {
        label:"Balance Latency vs Throughput",
        cmd:"perf_analyzer -m resnet50_trt --concurrency-range 1:16",
        type:"inf_latency",
        terminal:{
          examples:["perf_analyzer -m resnet50_trt --concurrency-range 1:16","perf_analyzer -m resnet50_trt"],
          accepted:["perf_analyzer -m resnet50_trt --concurrency-range 1:16","perf_analyzer -m resnet50_trt"],
          weak:[{match:["nvidia-smi dmon"],feedback:"Utilization alone will not tell you if you meet the latency SLA. Measure request latency versus throughput directly."}],
          success:"Latency sweep accepted. Replaying the authored latency-vs-throughput evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Watch how throughput climbs with batching while p99 latency also climbs. The SLA line is where the trade-off stops being free.",
        screenshots:[{
          title:"Latency vs throughput under batching",
          caption:"Dynamic batching raises throughput by grouping requests, but each request waits longer. The right batch size is the largest one that still meets the latency SLA.",
          lines:[
            "$ perf_analyzer -m resnet50_trt --concurrency-range 1:16",
            "concurrency  throughput(inf/s)   p99 latency(ms)",
            "   1              1420               6.9   ok",
            "   8              9100              14.2   ok  (SLA = 15ms)",
            "  16             12800              28.6   SLA VIOLATED"
          ]
        }],
        whatsHappening:"You are sweeping request concurrency to see the inference trade-off: batching raises throughput but also raises per-request latency.",
        deeperContext:"Inference architecture is a latency-versus-throughput balance. Dynamic batching and larger batch sizes improve GPU efficiency but can breach a latency SLA. This is the opposite pressure from training, which just wants maximum throughput.",
        lookFor:[
          "Throughput rising as concurrency/batch grows",
          "p99 latency also rising with batch size",
          "The concurrency point where latency crosses the SLA"
        ],
        meaning:"For inference you pick the largest batch that still meets the latency target. Beyond that point, more batching buys throughput you cannot use because it violates the SLA.",
        commonMistake:"Maximizing throughput blindly. For inference, an SLA-violating configuration is a failure even if throughput looks great.",
        operatorTakeaway:"Inference success is defined by meeting latency under load, so tune batch size to the SLA rather than to raw throughput.",
        takeAction:[
          "Identify the SLA and the concurrency where it breaks.",
          "Choose the batch size just under the SLA limit.",
          "Report both throughput and p99 latency, never just one."
        ],
        avoid:[
          "Do not tune inference the way you tune training.",
          "Do not accept a throughput win that violates the latency SLA."
        ]
      },
      {
        label:"Optimize with TensorRT",
        cmd:"trtexec --onnx=model.onnx --fp16 --saveEngine=model.plan",
        type:"inf_optimize",
        fault:true,
        terminal:{
          examples:["trtexec --onnx=model.onnx --fp16 --saveEngine=model.plan","trtexec --onnx=model.onnx --int8"],
          accepted:["trtexec --onnx=model.onnx --fp16 --saveEngine=model.plan","trtexec --onnx=model.onnx --int8"],
          weak:[{match:["tritonserver"],feedback:"Serve after you optimize. This checkpoint is about building the optimized engine that the server will load."}],
          success:"Optimization accepted. Replaying the authored TensorRT evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Compare the optimized latency and precision against the baseline. Lower precision plus kernel fusion is how inference gets cheaper.",
        screenshots:[{
          title:"TensorRT optimization result",
          caption:"TensorRT fuses layers and lowers precision (FP16/FP8/INT8) so the same model serves more requests at lower latency. Accuracy must be validated after quantization.",
          lines:[
            "$ trtexec --onnx=model.onnx --fp16 --saveEngine=model.plan",
            "baseline fp32 : 6.9 ms/req",
            "optimized fp16: 2.4 ms/req  (2.9x faster, layers fused)",
            "trap: over-aggressive INT8 without calibration -> accuracy drop",
            "action: validate accuracy after quantization, not just speed"
          ]
        }],
        whatsHappening:"You are optimizing the model for serving with TensorRT, trading numerical precision for latency and throughput, and noting the accuracy risk.",
        deeperContext:"Optimization sits between training and deployment in the AI lifecycle. TensorRT applies kernel fusion and reduced precision. The trade-off is that aggressive quantization without calibration can hurt accuracy, so you validate quality, not just speed.",
        lookFor:[
          "A latency drop from FP32 to FP16 or lower precision",
          "Kernel fusion reducing per-request work",
          "An accuracy-validation step after quantization"
        ],
        meaning:"Optimization makes inference cheaper per request, but reduced precision must be validated so you do not ship a fast but wrong model.",
        commonMistake:"Assuming lower precision is always free. INT8 without calibration can degrade accuracy noticeably.",
        operatorTakeaway:"Optimize for latency and cost, then prove the optimized model still meets the accuracy bar before deploying it.",
        takeAction:[
          "Record the latency improvement from reduced precision.",
          "Validate accuracy after quantization before serving.",
          "Feed the optimized engine into the serving stack."
        ],
        avoid:[
          "Do not deploy a quantized model without checking accuracy.",
          "Do not confuse optimization speedups with training speedups."
        ]
      }
    ]
  },
  nvidia_stack: {
    name: "NVIDIA AI Software Stack",
    icon: "🧱",
    color: "#76b900",
    objective: "Inventory the CUDA-X stack and map NVIDIA solutions to the AI lifecycle.",
    steps: [
      {
        label:"Inventory the Stack Layers",
        cmd:"nvidia-smi && cat /opt/aegis/stack-manifest.txt",
        type:"ns_inventory",
        terminal:{
          examples:["nvidia-smi && cat /opt/aegis/stack-manifest.txt","cat /opt/aegis/stack-manifest.txt"],
          accepted:["nvidia-smi && cat /opt/aegis/stack-manifest.txt","cat /opt/aegis/stack-manifest.txt"],
          weak:[{match:["docker ps"],feedback:"Containers are one layer. First list the whole stack from driver up so you know what each layer owns."}],
          success:"Stack inventory accepted. Replaying the authored layer manifest."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the stack bottom-up: driver, CUDA, CUDA-X libraries, frameworks, then platform solutions. Each layer depends on the one below it.",
        screenshots:[{
          title:"NVIDIA AI software stack manifest",
          caption:"The stack is layered: hardware, driver, CUDA, CUDA-X libraries, frameworks, then higher-level NVIDIA solutions. Knowing what each layer owns is a Domain 1 objective.",
          lines:[
            "hardware   : NVIDIA H100 GPU",
            "driver     : NVIDIA 550.x kernel module",
            "CUDA       : CUDA 12.4 toolkit + runtime",
            "CUDA-X     : cuDNN, cuBLAS, NCCL, cuFFT, TensorRT, RAPIDS",
            "frameworks : PyTorch / TensorFlow / NeMo (from NGC)"
          ]
        }],
        whatsHappening:"You are listing the NVIDIA software stack from the driver up so you can reason about which layer provides which capability.",
        deeperContext:"Domain 1 asks you to describe the NVIDIA software stack used in an AI environment. It is layered: the driver exposes the GPU, CUDA provides the programming model, CUDA-X libraries accelerate common math, and frameworks and solutions sit on top.",
        lookFor:[
          "Driver and CUDA as the foundation layers",
          "CUDA-X libraries such as cuDNN, NCCL, and TensorRT",
          "Frameworks and solutions consuming those libraries"
        ],
        meaning:"The stack is a dependency chain. Higher layers only work if the lower ones are present and compatible, which is why NVIDIA ships validated bundles.",
        commonMistake:"Thinking CUDA is a single thing. CUDA is the platform, and CUDA-X is the family of accelerated libraries built on it.",
        operatorTakeaway:"Being able to name the layer that owns a capability is what lets you place a problem or a product correctly.",
        takeAction:[
          "Name each layer from driver to framework.",
          "List at least three CUDA-X libraries and their roles.",
          "Connect frameworks back to the CUDA-X libraries they use."
        ],
        avoid:[
          "Do not collapse the whole stack into just 'CUDA'.",
          "Do not forget that NGC ships these layers pre-validated."
        ]
      },
      {
        label:"Validate CUDA-X Libraries",
        cmd:"ldconfig -p | grep -E 'cudnn|nccl|cublas'",
        type:"ns_cudax",
        terminal:{
          examples:["ldconfig -p | grep -E 'cudnn|nccl|cublas'","ldconfig -p | grep cudnn"],
          accepted:["ldconfig -p | grep -E 'cudnn|nccl|cublas'","ldconfig -p | grep cudnn"],
          weak:[{match:["nvidia-smi"],feedback:"That checks the driver, not the acceleration libraries. Confirm the CUDA-X libraries are actually installed."}],
          success:"Library check accepted. Replaying the authored CUDA-X evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Confirm each acceleration library is present and versioned. A framework that cannot find cuDNN or NCCL will fall back to slow paths or fail.",
        screenshots:[{
          title:"CUDA-X libraries present",
          caption:"cuDNN accelerates neural-net primitives, cuBLAS accelerates dense linear algebra, and NCCL accelerates multi-GPU collectives. These are the engines under the frameworks.",
          lines:[
            "$ ldconfig -p | grep -E 'cudnn|nccl|cublas'",
            "libcudnn.so.9   -> deep-learning primitives (conv, attention)",
            "libcublas.so.12 -> dense linear algebra (matmul, GEMM)",
            "libnccl.so.2    -> multi-GPU/multi-node collectives (AllReduce)",
            "all present and version-matched to CUDA 12.4"
          ]
        }],
        whatsHappening:"You are verifying that the CUDA-X acceleration libraries the frameworks depend on are installed and version-matched.",
        deeperContext:"cuDNN, cuBLAS, and NCCL are why PyTorch and TensorFlow run fast on NVIDIA GPUs. TensorRT and RAPIDS extend the family to inference and data science. A missing or mismatched library is a common hidden performance or failure cause.",
        lookFor:[
          "cuDNN for neural-network primitives",
          "cuBLAS for dense linear algebra",
          "NCCL for multi-GPU collective communication"
        ],
        meaning:"CUDA-X libraries are the acceleration engines. Frameworks call them, so their presence and version alignment directly affect performance and correctness.",
        commonMistake:"Assuming a working driver means the acceleration libraries are present. They are a separate layer.",
        operatorTakeaway:"When a framework is unexpectedly slow, a missing or mismatched CUDA-X library is a prime suspect before you blame the GPU.",
        takeAction:[
          "Confirm cuDNN, cuBLAS, and NCCL are installed.",
          "Match library versions to the CUDA runtime.",
          "Map each library to the workload capability it accelerates."
        ],
        avoid:[
          "Do not ignore CUDA-X versions when debugging slow frameworks.",
          "Do not assume the driver check covers the library layer."
        ]
      },
      {
        label:"Map NVIDIA Solutions",
        cmd:"cat /opt/aegis/nvidia-solutions.txt",
        type:"ns_solutions",
        terminal:{
          examples:["cat /opt/aegis/nvidia-solutions.txt","less /opt/aegis/nvidia-solutions.txt"],
          accepted:["cat /opt/aegis/nvidia-solutions.txt","less /opt/aegis/nvidia-solutions.txt"],
          weak:[{match:["nvidia-smi"],feedback:"This step is about the product portfolio, not the local GPU. Read how each solution maps to a use case."}],
          success:"Solutions map accepted. Replaying the authored portfolio reference."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Match each solution to the problem it solves. The exam tests whether you can pick the right NVIDIA product for a described use case.",
        screenshots:[{
          title:"NVIDIA solution portfolio by use case",
          caption:"Each solution owns a job: NeMo builds LLMs, NIM serves them, RAPIDS accelerates data science, Triton serves any model, Base Command manages clusters, AI Enterprise supports it all.",
          lines:[
            "NeMo         -> build/customize LLMs and generative models",
            "NIM          -> deploy models as inference microservices",
            "Triton       -> serve any framework's models at scale",
            "RAPIDS       -> GPU-accelerated data science (cuDF/cuML)",
            "Base Command / AI Enterprise -> manage & support the platform"
          ]
        }],
        whatsHappening:"You are mapping NVIDIA's higher-level solutions to the use cases they serve so you can pick the right one for a scenario.",
        deeperContext:"Domain 1 asks you to explain the purpose and use case of various NVIDIA solutions. NeMo is for building generative models, NIM and Triton for serving, RAPIDS for data pipelines, DGX for hardware, and Base Command and AI Enterprise for management and support.",
        lookFor:[
          "A build tool (NeMo) versus a serving tool (NIM/Triton)",
          "A data-science accelerator (RAPIDS)",
          "Management and support layers (Base Command, AI Enterprise)"
        ],
        meaning:"The portfolio is organized by job. If you can name the job, you can name the product, which is exactly what the exam checks.",
        commonMistake:"Blurring NeMo, NIM, and Triton together. NeMo builds models; NIM and Triton serve them.",
        operatorTakeaway:"Match the described need (build, serve, process data, manage) to the NVIDIA solution that owns that need.",
        takeAction:[
          "Pair each solution with a one-line use case.",
          "Separate build tools from serving tools.",
          "Note which layer provides management and enterprise support."
        ],
        avoid:[
          "Do not treat every NVIDIA product as interchangeable.",
          "Do not confuse the model-building tool with the serving tools."
        ]
      },
      {
        label:"Trace the AI Lifecycle",
        cmd:"cat /opt/aegis/ai-lifecycle.txt",
        type:"ns_lifecycle",
        fault:true,
        terminal:{
          examples:["cat /opt/aegis/ai-lifecycle.txt","less /opt/aegis/ai-lifecycle.txt"],
          accepted:["cat /opt/aegis/ai-lifecycle.txt","less /opt/aegis/ai-lifecycle.txt"],
          weak:[{match:["tritonserver"],feedback:"Serving is only one stage. Trace the full lifecycle so you can place a described task in the right stage."}],
          success:"Lifecycle map accepted. Replaying the authored lifecycle reference."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Walk the lifecycle left to right and note which NVIDIA tool owns each stage. The trap is skipping optimization or monitoring.",
        screenshots:[{
          title:"AI development & deployment lifecycle",
          caption:"Data prep, training, optimization, deployment, and monitoring each have NVIDIA tooling. Skipping optimization or monitoring is the common exam trap.",
          lines:[
            "data prep  -> RAPIDS / DALI          (clean & load data fast)",
            "train      -> NeMo / PyTorch on NGC  (learn the model)",
            "optimize   -> TensorRT               (quantize & fuse)",
            "deploy     -> Triton / NIM           (serve requests)",
            "monitor    -> DCGM / Prometheus      (watch health & drift)"
          ]
        }],
        whatsHappening:"You are laying out the end-to-end AI lifecycle and the NVIDIA software component that owns each stage.",
        deeperContext:"Domain 1 asks you to describe the software components across the AI development and deployment lifecycle. A complete answer includes data preparation and post-deployment monitoring, not just training and serving.",
        lookFor:[
          "Data preparation before training (RAPIDS/DALI)",
          "Optimization between training and deployment (TensorRT)",
          "Monitoring after deployment (DCGM/Prometheus)"
        ],
        meaning:"The lifecycle is a pipeline. Each stage has tooling, and a gap in any stage (often optimization or monitoring) is where real deployments and exam scenarios go wrong.",
        commonMistake:"Reducing the lifecycle to 'train then deploy'. Data prep, optimization, and monitoring are first-class stages.",
        operatorTakeaway:"Given a described task, place it in the correct lifecycle stage and name the NVIDIA tool that owns that stage.",
        takeAction:[
          "List all five lifecycle stages in order.",
          "Attach the owning NVIDIA tool to each stage.",
          "Watch for scenarios that omit optimization or monitoring."
        ],
        avoid:[
          "Do not skip data prep and monitoring when describing the lifecycle.",
          "Do not assume deployment is the final stage; monitoring continues."
        ]
      }
    ]
  },
  infra_planning: {
    name: "AI Infrastructure Planning",
    icon: "🏗️",
    color: "#f59e0b",
    objective: "Size compute, power, cooling, and scaling units for an AI cluster.",
    steps: [
      {
        label:"Size Hardware for the Job",
        cmd:"cat /opt/aegis/training-sizing.txt",
        type:"ip_sizing",
        terminal:{
          examples:["cat /opt/aegis/training-sizing.txt","less /opt/aegis/training-sizing.txt"],
          accepted:["cat /opt/aegis/training-sizing.txt","less /opt/aegis/training-sizing.txt"],
          weak:[{match:["nvidia-smi"],feedback:"One GPU's status will not size a training run. Work from the model and dataset requirements down to GPU count."}],
          success:"Sizing worksheet accepted. Replaying the authored sizing evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the sizing from workload down to hardware: model size and memory set the per-GPU need, then GPU count follows from throughput targets.",
        screenshots:[{
          title:"Training hardware sizing worksheet",
          caption:"Hardware requirements start from the workload: parameter count and memory footprint pick the GPU, and throughput targets pick the GPU count and interconnect.",
          lines:[
            "workload   : 70B-param LLM fine-tune, bf16",
            "memory est : weights+optimizer+activations ~ 1.1 TB",
            "per-GPU    : H100 80GB -> needs multi-GPU sharding (FSDP)",
            "GPU count  : 16x H100 across 2 DGX nodes for target throughput",
            "interconnect: NVLink intra-node + InfiniBand inter-node"
          ]
        }],
        whatsHappening:"You are translating a training workload into concrete hardware requirements: GPU type, GPU count, and interconnect.",
        deeperContext:"Domain 2 asks you to identify hardware requirements for specific training tasks. Memory footprint decides whether one GPU suffices or you must shard across many, and throughput targets decide GPU count and the interconnect tier.",
        lookFor:[
          "Model memory footprint versus per-GPU memory",
          "Whether sharding across GPUs is required",
          "The interconnect implied by multi-GPU and multi-node needs"
        ],
        meaning:"Right-sizing starts from the workload, not the catalog. Memory sets the minimum GPU count, and throughput sets the practical one.",
        commonMistake:"Picking a GPU count first. The workload's memory and throughput needs should drive the hardware, not the other way around.",
        operatorTakeaway:"Size from workload to hardware so the cluster is neither starved nor wastefully overbuilt.",
        takeAction:[
          "Estimate the memory footprint before choosing GPUs.",
          "Decide if the model must be sharded across GPUs.",
          "Match the interconnect to intra- and inter-node needs."
        ],
        avoid:[
          "Do not size hardware before understanding the workload.",
          "Do not ignore optimizer and activation memory in the estimate."
        ]
      },
      {
        label:"Measure Power Draw",
        cmd:"nvidia-smi -q -d POWER | grep -E 'Power Draw|Power Limit'",
        type:"ip_power",
        terminal:{
          examples:["nvidia-smi -q -d POWER | grep -E 'Power Draw|Power Limit'","nvidia-smi -q -d POWER"],
          accepted:["nvidia-smi -q -d POWER | grep -E 'Power Draw|Power Limit'","nvidia-smi -q -d POWER"],
          weak:[{match:["nvidia-smi dmon"],feedback:"dmon is fine for utilization, but here you need per-GPU power figures to build a rack power budget."}],
          success:"Power query accepted. Replaying the authored power-budget evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Scale the single-GPU power figure up to the node and rack. Power budgeting is arithmetic that decides how many nodes a rack can hold.",
        screenshots:[{
          title:"Per-GPU power to rack budget",
          caption:"An H100 SXM can draw up to ~700W. Eight per node plus CPUs and NICs pushes a DGX node past 10kW, which drives how many nodes fit in a power-limited rack.",
          lines:[
            "$ nvidia-smi -q -d POWER | grep -E 'Power Draw|Power Limit'",
            "    Power Draw   : 698.4 W    Power Limit : 700.0 W",
            "node estimate : 8 x 700W + CPU/NIC/fans ~ 10.2 kW per DGX H100",
            "rack budget   : 40 kW feed -> ~3-4 GPU nodes before you cap out",
            "planning rule : power, not floor space, usually limits GPU density"
          ]
        }],
        whatsHappening:"You are measuring per-GPU power and scaling it to node and rack budgets to plan how many GPU nodes a power feed can support.",
        deeperContext:"Domain 2 asks about power and cooling specifications. GPU racks are power-dense; the rack power feed often limits density before physical space does, so power budgeting is a core planning skill.",
        lookFor:[
          "Per-GPU power draw near its limit under load",
          "Node-level power once you add CPUs, NICs, and fans",
          "The rack power feed as the density ceiling"
        ],
        meaning:"Power is a hard constraint. A 40kW rack feed only supports a few 10kW GPU nodes, so power budgeting decides real density.",
        commonMistake:"Planning density by rack units instead of kilowatts. GPU nodes usually run out of power before they run out of space.",
        operatorTakeaway:"Budget the rack in kilowatts first; the number of GPU nodes follows from the power and cooling envelope.",
        takeAction:[
          "Scale per-GPU watts to node and rack totals.",
          "Compare the rack total against the available power feed.",
          "Plan node count from the power ceiling, not just floor space."
        ],
        avoid:[
          "Do not assume a rack can be filled to its physical capacity.",
          "Do not forget CPU, NIC, and fan power in the node estimate."
        ]
      },
      {
        label:"Check the Cooling Envelope",
        cmd:"nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv",
        type:"ip_cooling",
        terminal:{
          examples:["nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv","nvidia-smi -q -d TEMPERATURE"],
          accepted:["nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv","nvidia-smi -q -d TEMPERATURE"],
          weak:[{match:["nvidia-smi -q -d POWER"],feedback:"Power was the previous step. Here you are confirming the heat that power turns into can actually be removed."}],
          success:"Thermal query accepted. Replaying the authored cooling-envelope evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Tie temperature back to power: nearly all that wattage becomes heat the facility must remove. Air cooling has a ceiling that liquid cooling raises.",
        screenshots:[{
          title:"Thermal envelope and cooling choice",
          caption:"Watts in become heat out. High-density GPU nodes often exceed what air cooling can handle, which is why liquid cooling and rear-door heat exchangers appear in AI data centers.",
          lines:[
            "$ nvidia-smi --query-gpu=temperature.gpu,power.draw --format=csv",
            "temperature.gpu, power.draw",
            "71 C, 698.4 W   x8 GPUs -> ~5.6 kW of heat per node just from GPUs",
            "air cooling  : practical up to ~30-40 kW/rack",
            "liquid cooling (DLC/RDHx): enables 40-130+ kW/rack GPU density"
          ]
        }],
        whatsHappening:"You are confirming the thermal load and reasoning about whether air or liquid cooling is required for the planned density.",
        deeperContext:"Cooling is the twin of power. Nearly all electrical power becomes heat, so a power-dense rack is also a heat-dense rack. Air cooling caps out and high-density GPU racks increasingly need direct liquid cooling or rear-door heat exchangers.",
        lookFor:[
          "GPU temperature staying within the healthy range under load",
          "Total heat output tracking total power draw",
          "The cooling method matching the rack's power density"
        ],
        meaning:"You cannot deploy power you cannot cool. The cooling method must match the rack's kilowatt density, which is why liquid cooling is common in AI facilities.",
        commonMistake:"Planning power without planning heat removal. Every watt drawn is a watt of heat the facility must reject.",
        operatorTakeaway:"Match the cooling design to the power density; air cooling limits density, and liquid cooling unlocks the densest GPU racks.",
        takeAction:[
          "Convert node power into a heat load to remove.",
          "Decide air versus liquid cooling from rack density.",
          "Confirm temperatures stay safe under sustained load."
        ],
        avoid:[
          "Do not assume air cooling scales to any GPU density.",
          "Do not separate cooling planning from power planning."
        ]
      },
      {
        label:"Plan the Scaling Unit",
        cmd:"cat /opt/aegis/superpod-scaling.txt",
        type:"ip_scale",
        fault:true,
        terminal:{
          examples:["cat /opt/aegis/superpod-scaling.txt","less /opt/aegis/superpod-scaling.txt"],
          accepted:["cat /opt/aegis/superpod-scaling.txt","less /opt/aegis/superpod-scaling.txt"],
          weak:[{match:["sinfo","kubectl get nodes"],feedback:"Those inspect a live cluster. This step is about the repeatable scaling-unit design used to grow one."}],
          success:"Scaling plan accepted. Replaying the authored scaling-unit evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read scaling as repeatable units, not ad-hoc nodes. A SuperPOD grows in fixed scalable units so power, cooling, and fabric stay balanced.",
        screenshots:[{
          title:"Scaling in repeatable units",
          caption:"DGX SuperPOD scales by scalable units (SU) so networking, power, and cooling stay in a validated ratio. The trap is bolting on nodes without matching the fabric and facility.",
          lines:[
            "unit        : 1 DGX H100 node = 8 GPUs",
            "scalable SU : 32 DGX nodes = 256 GPUs + InfiniBand spine",
            "cluster     : N x SU with non-blocking fat-tree fabric",
            "trap        : add nodes but keep old fabric/power -> imbalance",
            "rule        : scale compute, network, power, cooling together"
          ]
        }],
        whatsHappening:"You are planning cluster growth as repeatable scalable units so compute, network, power, and cooling scale in balance.",
        deeperContext:"Domain 2 asks you to scale GPU infrastructure for different use cases. Reference architectures like DGX SuperPOD grow in fixed scalable units so the interconnect and facility stay proportioned to the compute, avoiding bottlenecks.",
        lookFor:[
          "A repeatable node-to-SU-to-cluster hierarchy",
          "The interconnect scaling alongside the compute",
          "Power and cooling scaling with each added unit"
        ],
        meaning:"Balanced scaling means adding compute, fabric, power, and cooling together in validated units, not bolting GPUs onto an unchanged facility.",
        commonMistake:"Scaling only the GPU count. Adding nodes without matching fabric, power, and cooling creates bottlenecks and thermal or power faults.",
        operatorTakeaway:"Grow in scalable units so the cluster stays balanced; the interconnect and facility must scale with the GPUs.",
        takeAction:[
          "Define the node and scalable-unit building blocks.",
          "Scale the fabric and facility with each unit.",
          "Reject growth plans that scale compute alone."
        ],
        avoid:[
          "Do not add GPUs without scaling the interconnect.",
          "Do not treat power and cooling as fixed while compute grows."
        ]
      }
    ]
  },
  dpu_cloud: {
    name: "DPU Offload & Cloud vs On-Prem",
    icon: "🛰️",
    color: "#38bdf8",
    objective: "Offload infrastructure work to a BlueField DPU and decide cloud vs on-prem.",
    steps: [
      {
        label:"Spot Host CPU Saturation",
        cmd:"mpstat -P ALL 1 1",
        type:"dpu_host_load",
        fault:true,
        terminal:{
          examples:["mpstat -P ALL 1 1","top -b -n1 | head"],
          accepted:["mpstat -P ALL 1 1","top -b -n1 | head"],
          weak:[{match:["nvidia-smi"],feedback:"The GPUs are idle-waiting; the bottleneck is the host CPU doing infrastructure work. Look at CPU, not GPU, here."}],
          success:"Host load capture accepted. Replaying the authored CPU-saturation evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Notice the CPU is pinned on system and soft-interrupt time from networking and storage, while GPUs wait. That wasted CPU is the case for a DPU.",
        screenshots:[{
          title:"Host CPU consumed by infrastructure work",
          caption:"Network virtual switching, encryption, and storage traffic eat host CPU cycles that could serve the application, and the GPUs stall waiting for data.",
          lines:[
            "$ mpstat -P ALL 1 1",
            "CPU   %usr  %sys  %soft  %idle",
            "all    18    41     29      12   <- 70% lost to sys+softirq",
            "cause : OVS vSwitch + TLS + NVMe-oF handled on host cores",
            "effect: GPUs idle-wait for data while CPU drowns in overhead"
          ]
        }],
        whatsHappening:"You are diagnosing that host CPU cores are saturated by networking, security, and storage overhead rather than application work.",
        deeperContext:"Modern AI nodes spend real CPU on virtual switching, encryption, and storage protocols. When those infrastructure tasks saturate the CPU, expensive GPUs stall, which is the problem a DPU is designed to solve.",
        lookFor:[
          "High system and soft-interrupt CPU time",
          "Infrastructure services (vSwitch, TLS, NVMe-oF) as the cause",
          "GPUs waiting while the CPU is the bottleneck"
        ],
        meaning:"The bottleneck is infrastructure overhead on host cores, not the GPU. Freeing those cores is what a DPU offload accomplishes.",
        commonMistake:"Blaming the GPU or adding more GPUs when the real limit is CPU spent on networking and storage.",
        operatorTakeaway:"When host CPU is drowning in infrastructure work while GPUs wait, the fix is to offload that work, not to add accelerators.",
        takeAction:[
          "Identify the infrastructure services eating CPU.",
          "Confirm GPUs are waiting rather than compute-bound.",
          "Frame the problem as offloadable infrastructure overhead."
        ],
        avoid:[
          "Do not add GPUs to fix a CPU-bound infrastructure problem.",
          "Do not read GPU idle time as a GPU fault here."
        ]
      },
      {
        label:"Identify the BlueField DPU",
        cmd:"lspci | grep -i bluefield && dpu-mode -q",
        type:"dpu_identify",
        terminal:{
          examples:["lspci | grep -i bluefield && dpu-mode -q","lspci | grep -i mellanox"],
          accepted:["lspci | grep -i bluefield && dpu-mode -q","lspci | grep -i mellanox"],
          weak:[{match:["ibstat"],feedback:"ibstat checks the fabric link. Here you are confirming the DPU device itself and which mode it runs in."}],
          success:"DPU identification accepted. Replaying the authored device evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Confirm the BlueField device and that it runs in DPU mode with its own Arm cores and DOCA stack. It is a small computer on the NIC.",
        screenshots:[{
          title:"BlueField DPU present in DPU mode",
          caption:"A BlueField DPU has its own Arm cores, memory, and OS. In DPU mode it runs infrastructure services independently of the host, programmed via the DOCA SDK.",
          lines:[
            "$ lspci | grep -i bluefield",
            "c1:00.0 NVIDIA BlueField-3 DPU (ConnectX-7 integrated)",
            "$ dpu-mode -q",
            "mode: DPU (embedded) | Arm cores: 16 | DOCA services: enabled",
            "role: infrastructure processor separate from host x86 CPU"
          ]
        }],
        whatsHappening:"You are confirming the node has a BlueField DPU and that it is running as an independent infrastructure processor.",
        deeperContext:"A DPU (data processing unit) is a third pillar beside CPU and GPU. BlueField integrates a ConnectX NIC with Arm cores and runs the DOCA software framework, so it can execute networking, storage, and security services separately from the host.",
        lookFor:[
          "A BlueField device on the PCI bus",
          "DPU mode with its own Arm cores",
          "DOCA services available on the DPU"
        ],
        meaning:"The DPU is a self-contained infrastructure computer on the NIC, which is why it can take over work that would otherwise burn host CPU.",
        commonMistake:"Treating a DPU as just a faster network card. It is a programmable processor with its own OS and cores.",
        operatorTakeaway:"Recognize the DPU as an infrastructure processor that offloads and isolates infrastructure services from the host.",
        takeAction:[
          "Confirm the DPU device and mode.",
          "Note its independent Arm cores and DOCA stack.",
          "Frame it as CPU/GPU/DPU, three processor types."
        ],
        avoid:[
          "Do not equate a DPU with an ordinary NIC.",
          "Do not assume the host CPU must run infrastructure services."
        ]
      },
      {
        label:"Offload Work to the DPU",
        cmd:"doca-offload --enable ovs,storage,security",
        type:"dpu_offload",
        terminal:{
          examples:["doca-offload --enable ovs,storage,security","doca-offload --status"],
          accepted:["doca-offload --enable ovs,storage,security","doca-offload --status"],
          weak:[{match:["mpstat -P ALL 1 1"],feedback:"Measuring again is good later, but first enable the offload so there is a change to measure."}],
          success:"Offload accepted. Replaying the authored offload-result evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Compare host CPU before and after offload. The DPU now runs the vSwitch, storage, and security path, and host cores return to the application.",
        screenshots:[{
          title:"Infrastructure services moved to the DPU",
          caption:"With offload enabled, the DPU runs virtual switching, storage, and security. Host CPU utilization drops and the freed cores serve the AI application and feed the GPUs.",
          lines:[
            "$ doca-offload --enable ovs,storage,security",
            "offloaded: OVS vSwitch, NVMe-oF initiator, TLS/IPsec, packet filtering",
            "host CPU sys+softirq : 70% -> 12%   (freed ~24 cores)",
            "GPU feed : data path no longer waits on host CPU",
            "bonus    : DPU isolates the infra domain from a compromised host"
          ]
        }],
        whatsHappening:"You are moving networking, storage, and security services onto the DPU and observing host CPU cores return to application work.",
        deeperContext:"The purpose and benefit of a DPU is to offload, accelerate, and isolate infrastructure services. That frees host CPU for the application, improves the GPU data-feed path, and creates a security boundary independent of the host OS.",
        lookFor:[
          "vSwitch, storage, and security running on the DPU",
          "Host CPU overhead dropping sharply",
          "Freed cores available to feed the GPUs"
        ],
        meaning:"Offloading infrastructure to the DPU recovers host CPU, improves the data path to the GPUs, and adds an isolated security domain.",
        commonMistake:"Believing a DPU only speeds up networking. Its bigger value is freeing host CPU and isolating the infrastructure domain.",
        operatorTakeaway:"DPU offload turns wasted host cycles into usable application capacity while hardening the infrastructure boundary.",
        takeAction:[
          "Enable the offload for the saturating services.",
          "Re-measure host CPU to confirm the recovery.",
          "Note the security-isolation benefit, not just performance."
        ],
        avoid:[
          "Do not describe DPU value as networking speed alone.",
          "Do not leave infrastructure services on the host when a DPU exists."
        ]
      },
      {
        label:"Decide Cloud vs On-Prem",
        cmd:"cat /opt/aegis/cloud-vs-onprem.txt",
        type:"dpu_cloud_decision",
        terminal:{
          examples:["cat /opt/aegis/cloud-vs-onprem.txt","less /opt/aegis/cloud-vs-onprem.txt"],
          accepted:["cat /opt/aegis/cloud-vs-onprem.txt","less /opt/aegis/cloud-vs-onprem.txt"],
          weak:[{match:["doca-offload --status"],feedback:"That is the DPU topic. This checkpoint is the deployment-model decision: cloud versus on-premises."}],
          success:"Decision matrix accepted. Replaying the authored trade-off evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the decision as a utilization and control trade-off, not a winner. Sustained high use favors on-prem; bursty or uncertain demand favors cloud.",
        screenshots:[{
          title:"Cloud vs on-prem decision factors",
          caption:"On-prem wins on sustained utilization, data gravity, and control; cloud wins on burst capacity, low upfront cost, and speed to start. Utilization is usually the deciding factor.",
          lines:[
            "on-prem : best for high sustained utilization, data gravity, control",
            "cloud   : best for bursty/variable demand, low CapEx, fast start",
            "hybrid  : steady base on-prem + burst to cloud for peaks",
            "driver  : sustained utilization -> on-prem TCO wins over time",
            "driver  : uncertain/short-term demand -> cloud OpEx wins"
          ]
        }],
        whatsHappening:"You are weighing cloud versus on-premises deployment using utilization, cost model, data gravity, and control.",
        deeperContext:"Domain 2 asks you to articulate the advantages, challenges, and considerations of on-premises versus cloud infrastructure. The core lever is utilization: consistently busy GPUs favor owned infrastructure, while variable demand favors rented capacity.",
        lookFor:[
          "Sustained utilization pushing toward on-prem",
          "Bursty or uncertain demand pushing toward cloud",
          "Data gravity, control, and time-to-start as tie-breakers"
        ],
        meaning:"There is no universal winner. High steady utilization favors on-prem TCO; variable or short-term demand favors cloud flexibility, and many shops go hybrid.",
        commonMistake:"Declaring cloud or on-prem always cheaper. The answer depends on utilization, data location, and control needs.",
        operatorTakeaway:"Frame the choice as a utilization and control trade-off, and recognize hybrid as a legitimate answer.",
        takeAction:[
          "Estimate sustained versus bursty utilization.",
          "Factor in data gravity, control, and upfront cost.",
          "Consider hybrid when demand has a steady base plus peaks."
        ],
        avoid:[
          "Do not claim one model is universally cheaper.",
          "Do not ignore data gravity and compliance in the decision."
        ]
      }
    ]
  },
  vgpu: {
    name: "GPU Virtualization",
    icon: "🧬",
    color: "#e879f9",
    objective: "Compare vGPU, MIG, and time-slicing for sharing accelerated infrastructure.",
    steps: [
      {
        label:"List vGPU Profiles",
        cmd:"nvidia-smi vgpu -s",
        type:"vgpu_profiles",
        terminal:{
          examples:["nvidia-smi vgpu -s","nvidia-smi vgpu --supported"],
          accepted:["nvidia-smi vgpu -s","nvidia-smi vgpu --supported"],
          weak:[{match:["nvidia-smi mig -lgi"],feedback:"That lists MIG instances. This step is about vGPU mediated profiles, a different virtualization model."}],
          success:"vGPU profile listing accepted. Replaying the authored profile evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the profiles as fixed framebuffer slices offered to VMs. vGPU needs a licensed manager and mediated devices, unlike bare MIG.",
        screenshots:[{
          title:"Supported vGPU profiles",
          caption:"NVIDIA vGPU (part of AI Enterprise) exposes mediated device profiles to virtual machines. Each profile fixes a framebuffer size and requires a vGPU license.",
          lines:[
            "$ nvidia-smi vgpu -s",
            "GPU 0: NVIDIA H100 80GB",
            "  H100-8C   : 8 GB fb  | compute vGPU profile",
            "  H100-16C  : 16 GB fb | compute vGPU profile",
            "  requires : NVIDIA vGPU manager + licensed guest driver"
          ]
        }],
        whatsHappening:"You are listing the vGPU profiles a GPU can present to virtual machines through mediated device virtualization.",
        deeperContext:"Domain 3 asks about virtualizing accelerated infrastructure. vGPU uses mediated devices to give VMs a slice of a GPU with a fixed framebuffer, managed by a licensed NVIDIA vGPU manager, which suits VDI and multi-tenant virtualized clusters.",
        lookFor:[
          "Named vGPU profiles with fixed framebuffer sizes",
          "The requirement for a vGPU manager and licensed guest driver",
          "A VM-facing sharing model rather than a bare-metal one"
        ],
        meaning:"vGPU virtualizes a GPU for virtual machines with fixed profiles and a licensing requirement, which is distinct from bare-metal MIG.",
        commonMistake:"Assuming any GPU sharing is free and license-less. Production vGPU requires NVIDIA vGPU/AI Enterprise licensing.",
        operatorTakeaway:"vGPU is the VM-oriented virtualization path, gated by licensing and fixed profiles.",
        takeAction:[
          "List the available vGPU profiles and their framebuffer sizes.",
          "Note the vGPU manager and licensing requirement.",
          "Distinguish vGPU (for VMs) from MIG (bare-metal partitions)."
        ],
        avoid:[
          "Do not confuse vGPU profiles with MIG instances.",
          "Do not forget vGPU requires licensing in production."
        ]
      },
      {
        label:"Create a Shared Instance",
        cmd:"mdevctl start -u $(uuidgen) -p 0000:17:00.0 --type nvidia-H100-8C",
        type:"vgpu_create",
        terminal:{
          examples:["mdevctl start -u $(uuidgen) -p 0000:17:00.0 --type nvidia-H100-8C","mdevctl list"],
          accepted:["mdevctl start -u $(uuidgen) -p 0000:17:00.0 --type nvidia-H100-8C","mdevctl list"],
          weak:[{match:["nvidia-smi -i 0 -mig 1"],feedback:"That enables MIG. Here you are creating a mediated vGPU device to attach to a VM."}],
          success:"vGPU creation accepted. Replaying the authored mediated-device evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Confirm the mediated device is created and ready to attach to a VM. This is the vGPU equivalent of carving a slice.",
        screenshots:[{
          title:"Mediated vGPU device created",
          caption:"mdevctl creates a mediated device from a vGPU profile. A hypervisor then attaches it to a VM, which sees a licensed slice of the physical GPU.",
          lines:[
            "$ mdevctl start -u 7f3a... -p 0000:17:00.0 --type nvidia-H100-8C",
            "created mdev 7f3a... type nvidia-H100-8C (8 GB fb)",
            "$ mdevctl list",
            "7f3a...  0000:17:00.0  nvidia-H100-8C   (ready to attach to VM)",
            "attach  : hypervisor binds this mdev to a guest VM"
          ]
        }],
        whatsHappening:"You are creating a mediated vGPU device from a profile so a hypervisor can attach it to a virtual machine.",
        deeperContext:"vGPU works through mediated devices: you instantiate a profile as an mdev and the hypervisor binds it to a VM. This is temporal sharing with scheduling, giving each VM a fixed framebuffer but a time-shared compute engine.",
        lookFor:[
          "A mediated device created from a chosen profile",
          "A fixed framebuffer allocation for the guest",
          "The hypervisor as the attach point to a VM"
        ],
        meaning:"A vGPU slice is a mediated device bound to a VM, with dedicated framebuffer but time-shared compute, which is why isolation differs from MIG.",
        commonMistake:"Expecting vGPU to give hardware-isolated compute like MIG. vGPU time-shares the compute engine across guests.",
        operatorTakeaway:"vGPU delivers per-VM framebuffer with scheduled, time-shared compute, appropriate for virtualized multi-tenant hosts.",
        takeAction:[
          "Create the mediated device from a profile.",
          "Note the dedicated framebuffer but shared compute.",
          "Plan the hypervisor attach to the target VM."
        ],
        avoid:[
          "Do not assume vGPU compute is spatially isolated like MIG.",
          "Do not skip the hypervisor binding step in the mental model."
        ]
      },
      {
        label:"Compare the Sharing Models",
        cmd:"cat /opt/aegis/virtualization-modes.txt",
        type:"vgpu_compare",
        terminal:{
          examples:["cat /opt/aegis/virtualization-modes.txt","less /opt/aegis/virtualization-modes.txt"],
          accepted:["cat /opt/aegis/virtualization-modes.txt","less /opt/aegis/virtualization-modes.txt"],
          weak:[{match:["nvidia-smi"],feedback:"This step is a comparison of sharing models, not a device status check."}],
          success:"Comparison accepted. Replaying the authored virtualization-modes matrix."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the matrix by isolation strength: MIG is hardware-partitioned, vGPU is VM-oriented time-sharing, and plain time-slicing has no isolation.",
        screenshots:[{
          title:"MIG vs vGPU vs time-slicing",
          caption:"MIG gives spatial hardware isolation, vGPU virtualizes GPUs for VMs with fixed framebuffer, and time-slicing simply interleaves work with no isolation. Match the model to the tenancy need.",
          lines:[
            "MIG          : spatial HW partitions | strong isolation | bare metal",
            "vGPU         : VM slices | fixed fb, time-shared compute | licensed",
            "time-slicing : interleave contexts | NO isolation | oversubscribe",
            "choose MIG   : hard multi-tenant isolation on bare metal",
            "choose vGPU  : virtualized/VDI multi-tenant; time-slice: dev/test"
          ]
        }],
        whatsHappening:"You are comparing MIG, vGPU, and time-slicing on isolation, tenancy model, and licensing to pick the right one.",
        deeperContext:"Virtualizing accelerated infrastructure has several models. MIG partitions the hardware spatially, vGPU virtualizes GPUs for VMs, and time-slicing merely interleaves contexts with no isolation. The right choice depends on isolation needs and whether you run VMs or bare metal.",
        lookFor:[
          "MIG as spatial, hardware-isolated partitioning",
          "vGPU as VM-oriented, licensed, time-shared compute",
          "Time-slicing as no-isolation oversubscription"
        ],
        meaning:"Isolation strength and tenancy model separate the three. Strong bare-metal isolation is MIG, virtualized tenants are vGPU, and best-effort sharing is time-slicing.",
        commonMistake:"Treating all sharing as equivalent. Isolation guarantees differ sharply and drive the correct choice.",
        operatorTakeaway:"Pick the virtualization model from the isolation requirement and whether the environment is VMs or bare metal.",
        takeAction:[
          "Rank the three models by isolation strength.",
          "Match each to a tenancy and environment.",
          "Note that only MIG gives spatial hardware isolation."
        ],
        avoid:[
          "Do not use time-slicing where isolation is required.",
          "Do not assume vGPU and MIG provide the same isolation."
        ]
      },
      {
        label:"Troubleshoot Oversubscription",
        cmd:"nvidia-smi vgpu -q | grep -A3 'Utilization'",
        type:"vgpu_oversub",
        fault:true,
        terminal:{
          examples:["nvidia-smi vgpu -q | grep -A3 'Utilization'","nvidia-smi vgpu -q"],
          accepted:["nvidia-smi vgpu -q | grep -A3 'Utilization'","nvidia-smi vgpu -q"],
          weak:[{match:["nvidia-smi --gpu-reset"],feedback:"Nothing is faulted at the hardware level. This is a contention problem from oversubscribing shared time-sliced compute."}],
          success:"Contention capture accepted. Replaying the authored oversubscription evidence."
        },
        explainerMode:"beginner_story",
        screenshotReference:"Read the symptom as contention, not hardware failure: too many time-shared guests on one engine means each one slows down under load.",
        screenshots:[{
          title:"Noisy-neighbor contention on shared compute",
          caption:"Time-shared vGPU and time-slicing have no compute isolation. When too many guests are busy at once, each one's effective throughput drops even though the GPU is healthy.",
          lines:[
            "$ nvidia-smi vgpu -q | grep -A3 'Utilization'",
            "vGPU 1 (H100-8C) : sched wait high, effective SM ~ 22%",
            "vGPU 2 (H100-8C) : sched wait high, effective SM ~ 21%",
            "cause : 6 active time-shared guests contend for one engine",
            "fix   : reduce oversubscription, or use MIG for isolation"
          ]
        }],
        whatsHappening:"You are diagnosing that shared, time-sliced guests are slow because of scheduling contention, not because the GPU is faulty.",
        deeperContext:"Oversubscription is the classic virtualization risk. With time-shared compute, adding guests raises scheduler wait time so each guest slows under concurrent load. The GPU is healthy; the sharing ratio is the problem, and MIG would provide isolation if it is required.",
        lookFor:[
          "High scheduler wait and low effective utilization per guest",
          "Many active guests contending for one engine",
          "Healthy hardware counters despite the slowdown"
        ],
        meaning:"The slowdown is contention from oversubscribing time-shared compute. Reduce the sharing ratio or switch to MIG for hard isolation.",
        commonMistake:"Reading noisy-neighbor contention as a hardware fault and resetting the GPU. The hardware is fine; the sharing ratio is wrong.",
        operatorTakeaway:"When shared guests slow down together with healthy hardware, treat it as oversubscription and fix the sharing model, not the GPU.",
        takeAction:[
          "Confirm hardware counters are clean before blaming the GPU.",
          "Reduce the number of concurrent time-shared guests.",
          "Move to MIG when tenants need guaranteed isolation."
        ],
        avoid:[
          "Do not reset healthy hardware to fix a contention problem.",
          "Do not oversubscribe time-shared compute for isolation-sensitive tenants."
        ]
      }
    ]
  }
};
