(function (global) {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function utilTone(util) {
    if (util >= 90) return 'critical';
    if (util >= 75) return 'warning';
    if (util >= 35) return 'active';
    return 'healthy';
  }

  function healthTone(state) {
    if (state === 'critical') return 'critical';
    if (state === 'degraded') return 'warning';
    return 'healthy';
  }

  function renderFleetKpis(summary, target) {
    if (!target || !summary) return;
    target.innerHTML = `
      <div class="cluster-kpi cluster-kpi-health">
        <div class="cluster-kpi-label">Fleet Health</div>
        <div class="cluster-kpi-value">${esc(summary.healthyNodes)}/${esc(summary.totalNodes)}</div>
        <div class="cluster-kpi-meta">${esc(summary.degradedNodes)} degraded • ${esc(summary.criticalNodes)} critical</div>
      </div>
      <div class="cluster-kpi cluster-kpi-gpus">
        <div class="cluster-kpi-label">GPU Allocation</div>
        <div class="cluster-kpi-value">${esc(summary.allocatedNodes)} nodes</div>
        <div class="cluster-kpi-meta">${esc(summary.totalGpus)} GPUs in simulator</div>
      </div>
      <div class="cluster-kpi cluster-kpi-util">
        <div class="cluster-kpi-label">Average Utilization</div>
        <div class="cluster-kpi-value">${esc(summary.avgUtilPct)}%</div>
        <div class="cluster-kpi-meta">${esc(summary.runningJobs)} running • ${esc(summary.pendingJobs)} pending</div>
      </div>
      <div class="cluster-kpi cluster-kpi-power">
        <div class="cluster-kpi-label">Aggregate Power</div>
        <div class="cluster-kpi-value">${esc(summary.totalPowerKw)} kW</div>
        <div class="cluster-kpi-meta">${esc(summary.memoryUsedTiB)}/${esc(summary.memoryTotalTiB)} TiB HBM active</div>
      </div>
    `;
  }

  function renderFleetGrid(state, target) {
    if (!target || !state) return;
    target.innerHTML = state.nodes.map((node) => {
      const utilClass = utilTone(node.telemetry.avgUtilPct);
      const healthClass = healthTone(node.healthState);
      const activeJob = state.jobs.find((job) => job.state === 'running' && job.assignedNodes.includes(node.id));
      const gpuCells = node.gpus.slice(0, 18).map((gpu) => `
        <span class="cluster-gpu-cell tone-${esc(utilTone(gpu.utilizationPct))}" title="${esc(gpu.name)} • ${esc(gpu.utilizationPct)}% util • ${esc(gpu.memoryUsedGiB)}/${esc(gpu.memoryTotalGiB)} GiB"></span>
      `).join('');
      return `
        <article class="cluster-node-card tone-${esc(healthClass)}">
          <div class="cluster-node-head">
            <div>
              <div class="cluster-node-name">${esc(node.name)}</div>
              <div class="cluster-node-sub">${esc(node.rackId)} • ${esc(node.group)}</div>
            </div>
            <span class="cluster-node-state tone-${esc(healthClass)}">${esc(node.healthState)}</span>
          </div>
          <div class="cluster-node-body">
            <div class="cluster-node-job">${activeJob ? esc(activeJob.name) : 'idle / no active job'}</div>
            <div class="cluster-node-metrics">
              <span>${esc(node.telemetry.avgUtilPct)}% util</span>
              <span>${esc(node.telemetry.memoryUsedGiB)} GiB used</span>
              <span>${esc(node.telemetry.powerKw)} kW</span>
              <span>${esc(node.fabric.ibRxGbps)} Gb/s IB RX</span>
            </div>
            <div class="cluster-gpu-strip">${gpuCells}</div>
            <div class="cluster-node-foot">
              <span>NVLink ${esc(node.fabric.nvlinkHealth)}</span>
              <span>IB ${esc(node.fabric.ibHealth)}</span>
              <span>${activeJob ? `${esc(activeJob.requestedGpusPerNode)} GPUs reserved` : '72 GPUs available'}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderFleetSidebar(summary, state, target) {
    if (!target || !summary || !state) return;
    const alerts = state.alerts.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 6);
    const runningJobs = state.jobs.filter((job) => job.state === 'running').slice(0, 5);
    target.innerHTML = `
      <div class="metric-group cluster-side-card">
        <div class="metric-group-title">Cluster Summary</div>
        <div class="metric-row"><span class="metric-label">Cluster</span><span class="metric-value ok">${esc(summary.clusterName)}</span></div>
        <div class="metric-row"><span class="metric-label">Rack</span><span class="metric-value ok">${esc(summary.rackId)}</span></div>
        <div class="metric-row"><span class="metric-label">Healthy</span><span class="metric-value ok">${esc(summary.healthyNodes)}</span></div>
        <div class="metric-row"><span class="metric-label">Alerts</span><span class="metric-value ${summary.activeAlerts ? 'warn' : 'ok'}">${esc(summary.activeAlerts)}</span></div>
      </div>
      <div class="metric-group cluster-side-card">
        <div class="metric-group-title">Running Jobs</div>
        <div class="cluster-mini-list">
          ${runningJobs.map((job) => `<div class="cluster-mini-item"><strong>${esc(job.name)}</strong><span>${esc(job.assignedNodes.length)} nodes • ${esc(job.type)}</span></div>`).join('') || '<div class="cluster-mini-item"><strong>No active jobs</strong><span>Fleet is idle.</span></div>'}
        </div>
      </div>
      <div class="metric-group cluster-side-card">
        <div class="metric-group-title">Latest Alerts</div>
        <div class="cluster-mini-list">
          ${alerts.map((alert) => `<div class="cluster-mini-item tone-${esc(alert.severity)}"><strong>${esc(alert.message)}</strong><span>${esc(alert.remediationHint)}</span></div>`).join('') || '<div class="cluster-mini-item"><strong>No active alerts</strong><span>Simulator state is clean.</span></div>'}
        </div>
      </div>
    `;
  }

  global.AEGIS_CLUSTER_DASHBOARD = {
    renderFleetKpis,
    renderFleetGrid,
    renderFleetSidebar,
  };
}(window));
