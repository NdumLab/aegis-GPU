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
      nodes,
      jobs,
      alerts,
      lastTickMs: Date.now(),
      simClockSeconds: 0,
      version: 'v3.2-foundation',
    };
  }

  function getJobProfile(job) {
    return DEFAULT_WORKLOAD_PROFILES[job.type] || DEFAULT_WORKLOAD_PROFILES.llm_train;
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
    const profile = getJobProfile(job);
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
        }
      }
    });
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
    createInitialState,
    createStore,
    tickState,
    getFleetSummary,
  };
}(window));
