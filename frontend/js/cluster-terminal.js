(function (global) {
  const DEFAULT_CONTEXT = {
    host: 'login-01',
    mode: 'login',
    nodeId: null,
  };

  function pad(value, width) {
    const text = String(value);
    return text.length >= width ? text : text + ' '.repeat(width - text.length);
  }

  function leftPad(value, width) {
    const text = String(value);
    return text.length >= width ? text : ' '.repeat(width - text.length) + text;
  }

  function formatElapsed(seconds) {
    const total = Math.max(Math.floor(seconds || 0), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatWalltime(seconds) {
    if (!seconds) return 'UNLIMITED';
    const total = Math.max(Math.floor(seconds), 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return `${hours}:${String(minutes).padStart(2, '0')}:00`;
  }

  function getContext() {
    if (!global.__AEGIS_CLUSTER_TERM_CONTEXT__) {
      global.__AEGIS_CLUSTER_TERM_CONTEXT__ = Object.assign({}, DEFAULT_CONTEXT);
    }
    return global.__AEGIS_CLUSTER_TERM_CONTEXT__;
  }

  function setContext(nextContext) {
    global.__AEGIS_CLUSTER_TERM_CONTEXT__ = Object.assign({}, DEFAULT_CONTEXT, nextContext || {});
    return global.__AEGIS_CLUSTER_TERM_CONTEXT__;
  }

  function getNodeForContext(state, context) {
    if (!state || !context || !context.nodeId) return null;
    return state.nodes.find((node) => node.id === context.nodeId) || null;
  }

  function buildHelp() {
    return [
      '[CLUSTER TERMINAL] Simulator command families:',
      '  squeue               sinfo                sacct',
      '  nvidia-smi           nvidia-smi -L        nvidia-smi topo -m',
      '  nvidia-smi -i <id>   ibstat               free -h',
      '  hostname             uname -a             ssh gb200-node-XX',
      '  scancel <jobid>      exit',
      '# These commands read the same shared simulator state used by the Cluster Fleet dashboard.',
    ];
  }

  function buildSqueue(state) {
    const lines = [
      'JOBID   PARTITION  NAME                 USER  ST  TIME      NODES  GPU/NODE  NODELIST(REASON)',
    ];
    state.jobs
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach((job) => {
        const stateCode = job.state === 'running'
          ? 'R'
          : job.state === 'pending'
            ? 'PD'
            : job.state === 'completed'
              ? 'CD'
              : job.state === 'cancelled'
                ? 'CA'
                : job.state.toUpperCase().slice(0, 2);
        const reason = job.assignedNodes.length
          ? `${job.assignedNodes.join(',')}`
          : '(Resources)';
        lines.push(
          `${leftPad(job.id, 5)}   ${pad(job.partition, 9)}  ${pad(job.name, 20)} ${pad(job.user || 'sim', 4)}  ${pad(stateCode, 2)}  ${pad(formatElapsed(job.elapsedSeconds), 8)}  ${leftPad(job.requestedNodes, 5)}  ${leftPad(job.requestedGpusPerNode, 8)}  ${reason}`
        );
      });
    return lines;
  }

  function buildSinfo(state) {
    const used = new Set(
      state.jobs
        .filter((job) => job.state === 'running')
        .flatMap((job) => job.assignedNodes)
    );
    const idleNodes = state.nodes.filter((node) => !used.has(node.id));
    return [
      'PARTITION  AVAIL  TIMELIMIT   NODES  STATE   NODELIST',
      `gpu-nvl72  up     7-00:00:00  ${leftPad(used.size || 0, 5)}  alloc   ${used.size ? Array.from(used).join(',') : '--'}`,
      `gpu-nvl72  up     7-00:00:00  ${leftPad(idleNodes.length, 5)}  idle    ${idleNodes.length ? idleNodes.map((node) => node.id).join(',') : '--'}`,
      'debug      up     01:00:00        8  idle    gb200-node-[00-07]',
    ];
  }

  function buildSacct(state) {
    const lines = [
      'JobID    JobName              Partition  State      Elapsed   Timelimit  AllocNodes',
    ];
    state.jobs
      .slice()
      .sort((a, b) => b.id - a.id)
      .forEach((job) => {
        lines.push(
          `${leftPad(job.id, 5)}   ${pad(job.name, 20)} ${pad(job.partition, 9)} ${pad(job.state.toUpperCase(), 10)} ${pad(formatElapsed(job.elapsedSeconds), 8)} ${pad(formatWalltime(job.walltimeSeconds), 10)} ${leftPad(job.requestedNodes, 5)}`
        );
      });
    return lines;
  }

  function buildHostname(context) {
    return [context.host];
  }

  function buildUname(context) {
    return [`Linux ${context.host} 6.8.12-aegis-sim #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`];
  }

  function buildFree(state, context) {
    const node = getNodeForContext(state, context);
    const usedGiB = node ? Math.round(node.telemetry.memoryUsedGiB * 0.18) : 128;
    const totalGiB = node ? 2048 : 512;
    const freeGiB = Math.max(totalGiB - usedGiB - 64, 24);
    return [
      '               total        used        free      shared  buff/cache   available',
      `Mem:      ${leftPad(`${totalGiB}Gi`, 8)}  ${leftPad(`${usedGiB}Gi`, 8)}  ${leftPad(`${freeGiB}Gi`, 8)}  ${leftPad('4.0Gi', 8)}  ${leftPad('96Gi', 9)}  ${leftPad(`${freeGiB + 32}Gi`, 9)}`,
      `Swap:     ${leftPad('64Gi', 8)}  ${leftPad('0Gi', 8)}  ${leftPad('64Gi', 8)}`,
    ];
  }

  function buildIbstat(state, context) {
    const node = getNodeForContext(state, context);
    const isCongested = node && node.fabric.ibHealth !== 'healthy';
    const ibRate = node ? `${Math.max(200, Math.round(node.fabric.ibRxGbps))} Gb/sec (4X NDR)` : '400 Gb/sec (4X NDR)';
    const lines = [
      'CA \'mlx5_0\'',
      '        CA type: MT4129',
      '        Number of ports: 1',
      '        Firmware version: 28.39.1002',
      '        Hardware version: 0',
      '        Node GUID: 0x506b4b0300c0ffee',
      '        System image GUID: 0x506b4b0300c0beef',
      '        Port 1:',
      '                State: Active',
      '                Physical state: LinkUp',
      `                Rate: ${ibRate}`,
    ];
    if (isCongested) lines.push(`                Note: fabric state is ${node.fabric.ibHealth}`);
    return lines;
  }

  function buildGpuList(state, context) {
    const node = getNodeForContext(state, context) || state.nodes[0];
    return node.gpus.slice(0, 8).map((gpu) => `GPU ${gpu.id}: NVIDIA GB200 NVL72 (UUID: ${gpu.uuid})`);
  }

  function buildTopo(state, context) {
    const rows = [];
    const node = getNodeForContext(state, context);
    const header = ['\t', ...Array.from({ length: 8 }, (_, index) => `GPU${index}`), 'CPU Affinity', 'NUMA Affinity'].join('\t');
    rows.push(header);
    for (let row = 0; row < 8; row += 1) {
      const cols = [];
      for (let col = 0; col < 8; col += 1) {
        if (row === col) cols.push(' X ');
        else if (Math.floor(row / 4) === Math.floor(col / 4)) cols.push(Math.abs(row - col) === 1 ? 'NV18' : 'NV9');
        else cols.push('SYS');
      }
      rows.push(`GPU${row}\t${cols.join('\t')}\t${row < 4 ? '0-63,128-191' : '64-127,192-255'}\t${row < 4 ? '0' : '1'}`);
    }
    rows.push('');
    rows.push(`# Topology view for ${context.host}. Intra-tray paths stay on NVLink, cross-tray paths drop to SYS.`);
    if (node && node.fabric.nvlinkHealth !== 'healthy') {
      rows.push(`# Warning: NVLink health is ${node.fabric.nvlinkHealth}; replay or degraded bandwidth may force collective slowdown.`);
    }
    return rows;
  }

  function buildNodeNvidiaSmi(state, context, requestedGpuId) {
    const node = getNodeForContext(state, context) || state.nodes[0];
    const activeGpus = node.gpus.filter((gpu) => requestedGpuId === null || gpu.id === requestedGpuId).slice(0, requestedGpuId === null ? 4 : 1);
    const lines = [
      'Thu May 07 22:38:40 2026',
      '+-----------------------------------------------------------------------------------------+',
      '| NVIDIA-SMI 570.86.15             Driver Version: 570.86.15   CUDA Version: 12.4        |',
      '|-------------------------------+----------------------+----------------------+------------|',
      '| GPU  Name                 Pwr |         Memory-Usage | GPU-Util  Temp       | Bus-Id     |',
      '|=========================================================================================|',
    ];
    activeGpus.forEach((gpu) => {
      lines.push(
        `| ${leftPad(gpu.id, 3)}  ${pad('GB200 NVL72', 20)} ${leftPad(`${gpu.powerWatts}W`, 5)} | ${leftPad(`${Math.round(gpu.memoryUsedGiB * 1024)}MiB`, 12)} / ${leftPad(`${gpu.memoryTotalGiB * 1024}MiB`, 12)} | ${leftPad(`${gpu.utilizationPct}%`, 7)}   ${leftPad(`${gpu.temperatureC}C`, 4)}        | ${pad(gpu.busId, 10)} |`
      );
    });
    lines.push('+-----------------------------------------------------------------------------------------+');
    if (requestedGpuId === null) {
      lines.push(`# showing GPUs 0-3 of 72 on ${node.name}; use nvidia-smi -i <id> for a specific accelerator`);
    }
    activeGpus.forEach((gpu) => {
      if (gpu.xid) lines.push(`# GPU ${gpu.id} is reporting XID ${gpu.xid}.`);
      if (gpu.ecc.sbe) lines.push(`# GPU ${gpu.id} corrected ECC count: ${gpu.ecc.sbe}.`);
    });
    node.notes.forEach((note) => lines.push(`# ${note}`));
    return lines;
  }

  function runCommand(state, rawCommand) {
    const command = String(rawCommand || '').trim();
    const normalized = command.toLowerCase().replace(/\s+/g, ' ');
    const context = getContext();

    if (!command) return { handled: true, lines: [] };
    if (normalized === 'help' || normalized === '?') return { handled: true, lines: buildHelp() };
    if (normalized === 'hostname') return { handled: true, lines: buildHostname(context) };
    if (normalized === 'uname -a' || normalized === 'uname') return { handled: true, lines: buildUname(context) };
    if (normalized === 'free -h') return { handled: true, lines: buildFree(state, context) };
    if (normalized === 'squeue') return { handled: true, lines: buildSqueue(state) };
    if (normalized === 'sinfo') return { handled: true, lines: buildSinfo(state) };
    if (normalized === 'sacct' || normalized === 'sacct -u $user' || normalized === 'sacct -u sim') return { handled: true, lines: buildSacct(state) };
    if (normalized === 'ibstat') return { handled: true, lines: buildIbstat(state, context) };
    if (normalized === 'nvidia-smi') return { handled: true, lines: buildNodeNvidiaSmi(state, context, null) };
    if (normalized === 'nvidia-smi -l') return { handled: true, lines: buildGpuList(state, context) };
    if (normalized === 'nvidia-smi topo -m') return { handled: true, lines: buildTopo(state, context) };
    if (/^nvidia-smi -i \d+$/.test(normalized)) {
      const requestedGpuId = Number(normalized.split(' ').pop());
      return { handled: true, lines: buildNodeNvidiaSmi(state, context, requestedGpuId) };
    }
    if (/^scancel \d+$/.test(normalized)) {
      const jobId = Number(normalized.split(' ').pop());
      return { handled: true, action: { type: 'cancel', jobId }, lines: [] };
    }
    if (/^ssh gb200-node-\d{2}$/.test(normalized)) {
      const nodeId = normalized.split(' ').pop();
      setContext({ host: nodeId, mode: 'node', nodeId });
      return { handled: true, lines: [`Connected to ${nodeId}.`, '# Cluster terminal context is now node-local for nvidia-smi, hostname, free -h, and ibstat.'] };
    }
    if (normalized === 'exit' || normalized === 'logout') {
      setContext(DEFAULT_CONTEXT);
      return { handled: true, lines: ['Returned to login-01.', '# Use `ssh gb200-node-XX` to re-enter a node-local simulator context.'] };
    }
    return {
      handled: true,
      lines: [
        '# Cluster simulator command not implemented yet for this command family.',
        '# Supported now: squeue, sinfo, sacct, nvidia-smi, nvidia-smi -L, nvidia-smi topo -m, nvidia-smi -i <id>, ibstat, hostname, uname -a, free -h, ssh gb200-node-XX, scancel <jobid>, exit.',
      ],
    };
  }

  global.AEGIS_CLUSTER_TERMINAL = {
    buildSqueue,
    buildSinfo,
    buildSacct,
    buildNodeNvidiaSmi,
    buildTopo,
    getContext,
    setContext,
    runCommand,
  };
}(window));
