(function (global) {
  const DEFAULT_CLUSTER_CONFIG = {
    clusterName: 'Aegis Simulator Cluster',
    rackId: 'SIM-RACK-01',
    nodeCount: 8,
    gpusPerNode: 72,
    gpuModel: 'NVIDIA GB200 NVL72',
    gpuMemoryGiB: 192,
    fabric: {
      nvlinkGeneration: 'NVLink 5',
      nvlinkPerGpuGbps: 1800,
      infiniband: 'InfiniBand NDR 400Gb/s',
    },
  };

  const DEFAULT_WORKLOAD_PROFILES = {
    llm_train: {
      label: 'LLM Training',
      rampSeconds: 90,
      targetUtil: 94,
      targetMemFraction: 0.82,
      targetPowerFraction: 0.91,
      targetTempC: 79,
      targetNvlinkGbps: 1420,
      targetIbGbps: 318,
    },
    cv_train: {
      label: 'Computer Vision',
      rampSeconds: 60,
      targetUtil: 88,
      targetMemFraction: 0.68,
      targetPowerFraction: 0.79,
      targetTempC: 74,
      targetNvlinkGbps: 980,
      targetIbGbps: 190,
    },
    hpc_sim: {
      label: 'HPC Simulation',
      rampSeconds: 25,
      targetUtil: 91,
      targetMemFraction: 0.58,
      targetPowerFraction: 0.87,
      targetTempC: 76,
      targetNvlinkGbps: 760,
      targetIbGbps: 276,
    },
    inference: {
      label: 'Inference Serving',
      rampSeconds: 45,
      targetUtil: 63,
      targetMemFraction: 0.49,
      targetPowerFraction: 0.56,
      targetTempC: 65,
      targetNvlinkGbps: 420,
      targetIbGbps: 88,
    },
  };

  const DEFAULT_JOB_PRESETS = {
    llm_train: {
      id: 'llm_train',
      label: 'LLM Train',
      scriptFile: 'llm_train.sh',
      type: 'llm_train',
      requestedNodes: 2,
      requestedGpusPerNode: 72,
      walltimeSeconds: 24 * 60 * 60,
      partition: 'gpu-nvl72',
      namePrefix: 'gpt-train',
      commandPreview: 'srun torchrun --nnodes=2 --nproc_per_node=72 train_gpt.py --model-size 70b',
    },
    cv_train: {
      id: 'cv_train',
      label: 'CV Train',
      scriptFile: 'cv_train.sh',
      type: 'cv_train',
      requestedNodes: 1,
      requestedGpusPerNode: 72,
      walltimeSeconds: 8 * 60 * 60,
      partition: 'gpu-nvl72',
      namePrefix: 'vit-finetune',
      commandPreview: 'srun torchrun --nnodes=1 --nproc_per_node=72 finetune_vit.py --dataset imagenet-22k',
    },
    hpc_sim: {
      id: 'hpc_sim',
      label: 'HPC Sim',
      scriptFile: 'hpc_sim.sh',
      type: 'hpc_sim',
      requestedNodes: 1,
      requestedGpusPerNode: 72,
      walltimeSeconds: 12 * 60 * 60,
      partition: 'gpu-nvl72',
      namePrefix: 'fluid-sim',
      commandPreview: 'srun mpirun -np 72 ./fluid_solver --mesh global_ocean_4km.h5',
    },
    inference: {
      id: 'inference',
      label: 'Inference',
      scriptFile: 'serve.sh',
      type: 'inference',
      requestedNodes: 1,
      requestedGpusPerNode: 36,
      walltimeSeconds: null,
      partition: 'gpu-nvl72',
      namePrefix: 'llm-serve',
      commandPreview: 'srun python -m vllm.entrypoints.openai.api_server --tensor-parallel-size 36',
    },
    benchmark: {
      id: 'benchmark',
      label: 'Benchmark',
      scriptFile: 'benchmark.sh',
      type: 'hpc_sim',
      requestedNodes: 2,
      requestedGpusPerNode: 72,
      walltimeSeconds: 60 * 60,
      partition: 'gpu-nvl72',
      namePrefix: 'nccl-bench',
      commandPreview: 'srun /opt/nccl-tests/build/all_reduce_perf -b 8 -e 8G -f 2 -g 1',
      profileOverrides: {
        targetUtil: 98,
        targetMemFraction: 0.60,
        targetPowerFraction: 0.99,
        targetTempC: 81,
        targetNvlinkGbps: 1650,
        targetIbGbps: 350,
      },
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits) {
    const factor = Math.pow(10, digits || 0);
    return Math.round(value * factor) / factor;
  }

  function utilizationColor(util) {
    if (util >= 90) return 'critical';
    if (util >= 75) return 'busy';
    if (util >= 35) return 'active';
    return 'idle';
  }

  function createGpu(nodeIndex, gpuIndex, config) {
    return {
      id: gpuIndex,
      name: `${config.gpuModel} GPU ${gpuIndex}`,
      busId: `0000:${String(64 + nodeIndex).padStart(2, '0')}:${String(Math.floor(gpuIndex / 8)).padStart(2, '0')}.${gpuIndex % 2}`,
      uuid: `GPU-sim-${String(nodeIndex).padStart(2, '0')}-${String(gpuIndex).padStart(2, '0')}`,
      memoryTotalGiB: config.gpuMemoryGiB,
      memoryUsedGiB: 12,
      utilizationPct: 8,
      powerWatts: 142,
      temperatureC: 32,
      nvlinkState: 'up',
      ecc: { sbe: 0, dbe: 0 },
      xid: null,
      allocationState: 'idle',
      topologyGroup: gpuIndex < config.gpusPerNode / 2 ? 'tray-a' : 'tray-b',
    };
  }

  function createNode(nodeIndex, config) {
    const nodeId = `gb200-node-${String(nodeIndex).padStart(2, '0')}`;
    const gpus = Array.from({ length: config.gpusPerNode }, (_, gpuIndex) => createGpu(nodeIndex, gpuIndex, config));
    return {
      id: nodeId,
      name: nodeId,
      rackId: config.rackId,
      group: nodeIndex < config.nodeCount / 2 ? 'row-a' : 'row-b',
      healthState: 'healthy',
      allocationState: 'idle',
      notes: [],
      telemetry: {
        avgUtilPct: 8,
        memoryUsedGiB: round(config.gpusPerNode * 12, 1),
        memoryTotalGiB: config.gpusPerNode * config.gpuMemoryGiB,
        powerKw: round((config.gpusPerNode * 142) / 1000, 2),
        avgTempC: 32,
      },
      fabric: {
        nvlinkHealth: 'healthy',
        nvlinkGbps: 0,
        ibHealth: 'healthy',
        ibRxGbps: 0,
        ibTxGbps: 0,
      },
      alerts: [],
      gpus,
    };
  }

  function createDefaultJobs() {
    return [
      {
        id: 41021,
        name: 'llama4-pretrain',
        type: 'llm_train',
        state: 'running',
        partition: 'gpu-nvl72',
        requestedNodes: 4,
        requestedGpusPerNode: 72,
        assignedNodes: ['gb200-node-00', 'gb200-node-01', 'gb200-node-02', 'gb200-node-03'],
        elapsedSeconds: 26 * 60,
        walltimeSeconds: 4 * 60 * 60,
        submittedAt: Date.now() - (31 * 60 * 1000),
        rampProfile: 'warmup-train',
      },
      {
        id: 41022,
        name: 'nemo-diffusion',
        type: 'cv_train',
        state: 'running',
        partition: 'gpu-nvl72',
        requestedNodes: 2,
        requestedGpusPerNode: 72,
        assignedNodes: ['gb200-node-04', 'gb200-node-05'],
        elapsedSeconds: 12 * 60,
        walltimeSeconds: 95 * 60,
        submittedAt: Date.now() - (16 * 60 * 1000),
        rampProfile: 'vision-train',
      },
      {
        id: 41023,
        name: 'llm-serve-prod',
        type: 'inference',
        state: 'running',
        partition: 'gpu-nvl72',
        requestedNodes: 1,
        requestedGpusPerNode: 72,
        assignedNodes: ['gb200-node-06'],
        elapsedSeconds: 41 * 60,
        walltimeSeconds: null,
        submittedAt: Date.now() - (45 * 60 * 1000),
        rampProfile: 'steady-serve',
      },
      {
        id: 41024,
        name: 'climate-sim-v3',
        type: 'hpc_sim',
        state: 'pending',
        partition: 'gpu-nvl72',
        requestedNodes: 2,
        requestedGpusPerNode: 72,
        assignedNodes: [],
        elapsedSeconds: 0,
        walltimeSeconds: 3 * 60 * 60,
        submittedAt: Date.now() - (5 * 60 * 1000),
        rampProfile: 'hpc-burst',
        user: 'sim',
      },
    ];
  }

  function createDefaultAlerts() {
    return [
      {
        id: 'sim-alert-001',
        severity: 'warn',
        category: 'capacity',
        nodeId: null,
        gpuId: null,
        jobId: 41024,
        message: 'Pending workload is waiting for two free nodes in gpu-nvl72.',
        remediationHint: 'Drain or complete one running training workload to free capacity.',
        timestamp: Date.now() - 2 * 60 * 1000,
      },
      {
        id: 'sim-alert-002',
        severity: 'info',
        category: 'throughput',
        nodeId: 'gb200-node-06',
        gpuId: null,
        jobId: 41023,
        message: 'Inference serving profile has entered steady-state response mode.',
        remediationHint: 'Use later loops to compare serving utilization against training saturation.',
        timestamp: Date.now() - 40 * 1000,
      },
    ];
  }

  function createInitialState(options) {
    const config = Object.assign({}, DEFAULT_CLUSTER_CONFIG, options || {});
    const nodes = Array.from({ length: config.nodeCount }, (_, nodeIndex) => createNode(nodeIndex, config));
    const jobs = createDefaultJobs();
    const alerts = createDefaultAlerts();
    return {
      config,
      partitions: [
        {
          id: 'gpu-nvl72',
          label: 'gpu-nvl72',
          totalNodes: config.nodeCount,
          scheduler: 'slurm',
        },
      ],
      topology: {
        rackId: config.rackId,
        clusterName: config.clusterName,
        fabric: Object.assign({}, config.fabric),
      },
      jobPresets: Object.values(DEFAULT_JOB_PRESETS).map((preset) => Object.assign({}, preset)),
      nodes,
      jobs,
      alerts,
      nextJobId: 41025,
      lastTickMs: Date.now(),
      simClockSeconds: 0,
      version: 'v3.2-foundation',
    };
  }

  function getJobProfile(job) {
    return DEFAULT_WORKLOAD_PROFILES[job.type] || DEFAULT_WORKLOAD_PROFILES.llm_train;
  }

  function getEffectiveJobProfile(job) {
    const base = getJobProfile(job);
    return Object.assign({}, base, job.profileOverrides || {});
  }

  function getJobRampFactor(job, profile) {
    const rampSeconds = Math.max(profile.rampSeconds || 30, 1);
    const elapsed = Math.max(job.elapsedSeconds || 0, 0);
    if (job.state !== 'running') return 0;
    if (elapsed < rampSeconds) return clamp(elapsed / rampSeconds, 0.15, 1);
    if (job.walltimeSeconds && elapsed > job.walltimeSeconds * 0.9) {
      const remaining = Math.max(job.walltimeSeconds - elapsed, 0);
      return clamp(remaining / Math.max(job.walltimeSeconds * 0.1, 1), 0.35, 1);
    }
    return 1;
  }

  function applyIdleNodeState(node) {
    node.healthState = 'healthy';
    node.allocationState = 'idle';
    node.notes = [];
    node.fabric.nvlinkHealth = 'healthy';
    node.fabric.ibHealth = 'healthy';
    node.fabric.nvlinkGbps = 0;
    node.fabric.ibRxGbps = 0;
    node.fabric.ibTxGbps = 0;
    node.gpus.forEach((gpu, index) => {
      gpu.utilizationPct = 6 + (index % 3);
      gpu.memoryUsedGiB = 11 + (index % 5);
      gpu.powerWatts = 138 + (index % 7);
      gpu.temperatureC = 31 + (index % 4);
      gpu.nvlinkState = 'up';
      gpu.ecc.sbe = 0;
      gpu.ecc.dbe = 0;
      gpu.xid = null;
      gpu.allocationState = 'idle';
    });
  }

  function applyJobToNode(node, job) {
    const profile = getEffectiveJobProfile(job);
    const rampFactor = getJobRampFactor(job, profile);
    node.healthState = 'healthy';
    node.allocationState = 'allocated';
    node.notes = [`${profile.label} workload active`, `Job ${job.id} ${job.name}`];
    node.fabric.nvlinkHealth = 'healthy';
    node.fabric.ibHealth = 'healthy';
    node.fabric.nvlinkGbps = round(profile.targetNvlinkGbps * rampFactor, 1);
    node.fabric.ibRxGbps = round(profile.targetIbGbps * rampFactor, 1);
    node.fabric.ibTxGbps = round(profile.targetIbGbps * rampFactor * 0.94, 1);

    node.gpus.forEach((gpu, index) => {
      const wobble = ((job.id + index) % 5) - 2;
      gpu.utilizationPct = clamp(round(profile.targetUtil * rampFactor + wobble, 0), 7, 100);
      gpu.memoryUsedGiB = clamp(round(gpu.memoryTotalGiB * profile.targetMemFraction * rampFactor + 6 + (index % 3), 1), 10, gpu.memoryTotalGiB);
      gpu.powerWatts = clamp(round(160 + (700 * profile.targetPowerFraction * rampFactor) + wobble * 6, 0), 130, 1000);
      gpu.temperatureC = clamp(round(34 + ((profile.targetTempC - 34) * rampFactor) + (index % 3), 0), 30, 92);
      gpu.nvlinkState = 'up';
      gpu.ecc.sbe = 0;
      gpu.ecc.dbe = 0;
      gpu.xid = null;
      gpu.allocationState = utilizationColor(gpu.utilizationPct);
    });
  }

  function getUsedNodeIds(state) {
    return new Set(
      state.jobs
        .filter((job) => job.state === 'running')
        .flatMap((job) => job.assignedNodes)
    );
  }

  function findFreeNodeIds(state, requestedNodes) {
    const used = getUsedNodeIds(state);
    return state.nodes.filter((node) => !used.has(node.id)).slice(0, requestedNodes).map((node) => node.id);
  }

  function placePendingJobs(state) {
    state.jobs
      .filter((job) => job.state === 'pending')
      .forEach((job) => {
        const freeNodeIds = findFreeNodeIds(state, job.requestedNodes);
        if (freeNodeIds.length >= job.requestedNodes) {
          job.state = 'running';
          job.assignedNodes = freeNodeIds;
          job.elapsedSeconds = 0;
          state.alerts.unshift({
            id: `sim-alert-${job.id}-running`,
            severity: 'info',
            category: 'scheduler',
            nodeId: freeNodeIds[0] || null,
            gpuId: null,
            jobId: job.id,
            message: `Pending workload ${job.name} is now running on ${freeNodeIds.length} node(s).`,
            remediationHint: 'Use the fleet dashboard to observe utilization ramp-up.',
            timestamp: Date.now(),
          });
        }
      });
  }

  function trimAlerts(state) {
    state.alerts = state.alerts
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 16);
  }

  function buildSubmittedJob(state, presetId, overrides) {
    const preset = DEFAULT_JOB_PRESETS[presetId];
    if (!preset) return null;
    const custom = overrides || {};
    const name = custom.name || `${preset.namePrefix}-${state.nextJobId}`;
    const job = {
      id: state.nextJobId++,
      name,
      user: 'sim',
      type: preset.type,
      state: 'pending',
      partition: custom.partition || preset.partition,
      requestedNodes: custom.requestedNodes || preset.requestedNodes,
      requestedGpusPerNode: custom.requestedGpusPerNode || preset.requestedGpusPerNode,
      assignedNodes: [],
      elapsedSeconds: 0,
      walltimeSeconds: preset.walltimeSeconds,
      submittedAt: Date.now(),
      rampProfile: preset.id,
      scriptFile: preset.scriptFile,
      commandPreview: preset.commandPreview,
      profileOverrides: preset.profileOverrides ? Object.assign({}, preset.profileOverrides) : null,
    };
    return job;
  }

  function recomputeNodeTelemetry(node) {
    const gpuCount = Math.max(node.gpus.length, 1);
    const utilTotal = node.gpus.reduce((sum, gpu) => sum + gpu.utilizationPct, 0);
    const memUsedTotal = node.gpus.reduce((sum, gpu) => sum + gpu.memoryUsedGiB, 0);
    const memTotal = node.gpus.reduce((sum, gpu) => sum + gpu.memoryTotalGiB, 0);
    const powerTotalWatts = node.gpus.reduce((sum, gpu) => sum + gpu.powerWatts, 0);
    const tempTotal = node.gpus.reduce((sum, gpu) => sum + gpu.temperatureC, 0);
    node.telemetry.avgUtilPct = round(utilTotal / gpuCount, 1);
    node.telemetry.memoryUsedGiB = round(memUsedTotal, 1);
    node.telemetry.memoryTotalGiB = memTotal;
    node.telemetry.powerKw = round(powerTotalWatts / 1000, 2);
    node.telemetry.avgTempC = round(tempTotal / gpuCount, 1);
  }

  function reconcileState(state) {
    const jobMap = new Map();
    state.jobs.filter((job) => job.state === 'running').forEach((job) => {
      job.assignedNodes.forEach((nodeId) => jobMap.set(nodeId, job));
    });

    state.nodes.forEach((node) => {
      applyIdleNodeState(node);
      const runningJob = jobMap.get(node.id);
      if (runningJob) applyJobToNode(node, runningJob);
      recomputeNodeTelemetry(node);
    });
    trimAlerts(state);
  }

  function tickState(state, deltaSeconds) {
    const seconds = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 3;
    state.simClockSeconds += seconds;
    state.lastTickMs = Date.now();
    state.jobs.forEach((job) => {
      if (job.state === 'running') {
        job.elapsedSeconds += seconds;
        if (job.walltimeSeconds && job.elapsedSeconds >= job.walltimeSeconds) {
          job.state = 'completed';
          job.assignedNodes = [];
          state.alerts.unshift({
            id: `sim-alert-${job.id}-complete`,
            severity: 'info',
            category: 'scheduler',
            nodeId: null,
            gpuId: null,
            jobId: job.id,
            message: `Workload ${job.name} completed and released ${job.requestedNodes} node(s).`,
            remediationHint: 'Pending jobs can now be placed automatically on the next scheduler tick.',
            timestamp: Date.now(),
          });
        }
      }
    });
    placePendingJobs(state);
    reconcileState(state);
    return state;
  }

  function getFleetSummary(state) {
    const totalNodes = state.nodes.length;
    const totalGpus = state.nodes.reduce((sum, node) => sum + node.gpus.length, 0);
    const allocatedNodes = state.nodes.filter((node) => node.allocationState === 'allocated').length;
    const healthyNodes = state.nodes.filter((node) => node.healthState === 'healthy').length;
    const degradedNodes = state.nodes.filter((node) => node.healthState === 'degraded').length;
    const criticalNodes = state.nodes.filter((node) => node.healthState === 'critical').length;
    const totalUtil = state.nodes.reduce((sum, node) => sum + node.telemetry.avgUtilPct, 0);
    const totalMemoryUsed = state.nodes.reduce((sum, node) => sum + node.telemetry.memoryUsedGiB, 0);
    const totalMemory = state.nodes.reduce((sum, node) => sum + node.telemetry.memoryTotalGiB, 0);
    const totalPowerKw = state.nodes.reduce((sum, node) => sum + node.telemetry.powerKw, 0);
    const runningJobs = state.jobs.filter((job) => job.state === 'running').length;
    const pendingJobs = state.jobs.filter((job) => job.state === 'pending').length;
    return {
      clusterName: state.topology.clusterName,
      rackId: state.topology.rackId,
      totalNodes,
      totalGpus,
      allocatedNodes,
      healthyNodes,
      degradedNodes,
      criticalNodes,
      runningJobs,
      pendingJobs,
      activeAlerts: state.alerts.length,
      avgUtilPct: round(totalUtil / Math.max(totalNodes, 1), 1),
      memoryUsedTiB: round(totalMemoryUsed / 1024, 2),
      memoryTotalTiB: round(totalMemory / 1024, 2),
      totalPowerKw: round(totalPowerKw, 2),
    };
  }

  function createStore(options) {
    const state = createInitialState(options);
    reconcileState(state);
    return {
      state,
      tick(deltaSeconds) {
        return tickState(state, deltaSeconds);
      },
      submitPreset(presetId, overrides) {
        const job = buildSubmittedJob(state, presetId, overrides);
        if (!job) return null;
        state.jobs.push(job);
        state.alerts.unshift({
          id: `sim-alert-${job.id}-submitted`,
          severity: 'info',
          category: 'scheduler',
          nodeId: null,
          gpuId: null,
          jobId: job.id,
          message: `Submitted ${job.name} requesting ${job.requestedNodes} node(s) and ${job.requestedGpusPerNode} GPUs per node.`,
          remediationHint: 'Watch the queue and fleet dashboard to see whether placement happens immediately or remains pending.',
          timestamp: Date.now(),
        });
        placePendingJobs(state);
        reconcileState(state);
        return job;
      },
      cancelJob(jobId) {
        const job = state.jobs.find((item) => item.id === jobId);
        if (!job || (job.state !== 'running' && job.state !== 'pending')) return null;
        job.state = 'cancelled';
        job.assignedNodes = [];
        state.alerts.unshift({
          id: `sim-alert-${job.id}-cancelled`,
          severity: 'warn',
          category: 'scheduler',
          nodeId: null,
          gpuId: null,
          jobId: job.id,
          message: `Cancelled workload ${job.name}. Reserved cluster capacity has been released.`,
          remediationHint: 'Use the queue to confirm pending jobs can advance after cancellation.',
          timestamp: Date.now(),
        });
        placePendingJobs(state);
        reconcileState(state);
        return job;
      },
      reset(nextOptions) {
        const nextState = createInitialState(nextOptions || options);
        reconcileState(nextState);
        Object.keys(state).forEach((key) => delete state[key]);
        Object.assign(state, nextState);
        return state;
      },
      getSummary() {
        return getFleetSummary(state);
      },
      getNode(nodeId) {
        return state.nodes.find((node) => node.id === nodeId) || null;
      },
      getJob(jobId) {
        return state.jobs.find((job) => job.id === jobId) || null;
      },
    };
  }

  global.AEGIS_CLUSTER_SIM = {
    DEFAULT_CLUSTER_CONFIG,
    DEFAULT_WORKLOAD_PROFILES,
    DEFAULT_JOB_PRESETS,
    createInitialState,
    createStore,
    tickState,
    getFleetSummary,
  };
}(window));
