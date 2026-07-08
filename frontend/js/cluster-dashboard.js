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
        <span class="cluster-gpu-cell tone-${esc(gpu.xid ? 'critical' : utilTone(gpu.utilizationPct))}" title="${esc(gpu.name)} • ${esc(gpu.utilizationPct)}% util • ${esc(gpu.memoryUsedGiB)}/${esc(gpu.memoryTotalGiB)} GiB${gpu.xid ? ` • XID ${gpu.xid}` : ''}${gpu.ecc.sbe ? ` • SBE ${gpu.ecc.sbe}` : ''}"></span>
      `).join('');
      const notes = node.notes.length
        ? `<div class="cluster-node-notes">${node.notes.map((note) => `<span>${esc(note)}</span>`).join('')}</div>`
        : '';
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
            ${notes}
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
        <div class="metric-row"><span class="metric-label">Injected Faults</span><span class="metric-value ${state.activeFaults?.length ? 'warn' : 'ok'}">${esc(state.activeFaults?.length || 0)}</span></div>
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

  function renderWorkloadControls(state, target) {
    if (!target || !state) return;
    const presets = state.jobPresets || [];
    target.innerHTML = `
      <div class="cluster-submit-card">
        <div class="cluster-submit-head">
          <div>
            <div class="cluster-submit-title">Submit Simulated Workload</div>
            <div class="cluster-submit-copy">Loop 3 adds scheduler-backed preset submission. Each preset allocates nodes from the shared simulator state and drives the same fleet cards you are viewing.</div>
          </div>
        </div>
        <div class="cluster-submit-row">
          ${presets.map((preset) => `
            <button class="cluster-submit-btn" type="button" data-cluster-submit="${esc(preset.id)}" title="${esc(preset.commandPreview || '')}">
              <span>${esc(preset.label)}</span>
              <small>${esc(preset.requestedNodes)} node(s) • ${esc(preset.requestedGpusPerNode)} GPU/node</small>
            </button>
          `).join('')}
        </div>
        <div class="cluster-submit-head cluster-submit-head-secondary">
          <div>
            <div class="cluster-submit-title">Inject Simulator Fault</div>
            <div class="cluster-submit-copy">Loop 5 adds bounded degraded-state modeling. These faults mutate the same shared node, fabric, alert, and terminal state already used by the dashboard and scheduler.</div>
          </div>
          <button class="cluster-clear-btn" type="button" data-cluster-clear-faults>Clear All Faults</button>
        </div>
        <div class="cluster-submit-row">
          ${(state.activeFaults || []).length ? state.activeFaults.map((fault) => `
            <button class="cluster-submit-btn tone-warning" type="button" data-cluster-clear-fault="${esc(fault.id)}" title="${esc(fault.message)}">
              <span>Clear ${esc(fault.label)}</span>
              <small>${esc(fault.nodeId)}${fault.gpuId === null || fault.gpuId === undefined ? '' : ` • GPU ${esc(fault.gpuId)}`}</small>
            </button>
          `).join('') : '<div class="cluster-submit-empty">No injected faults active.</div>'}
        </div>
        <div class="cluster-submit-row">
          ${Object.values(global.AEGIS_CLUSTER_SIM?.DEFAULT_FAULT_PRESETS || {}).map((fault) => `
            <button class="cluster-submit-btn tone-critical" type="button" data-cluster-inject-fault="${esc(fault.id)}" title="${esc(fault.message)}">
              <span>${esc(fault.label)}</span>
              <small>${esc(fault.nodeId)}${fault.gpuId === null || fault.gpuId === undefined ? '' : ` • GPU ${esc(fault.gpuId)}`}</small>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderJobTable(state, target) {
    if (!target || !state) return;
    const rows = state.jobs
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((job) => {
        const stateClass = job.state === 'running' ? 'healthy' : job.state === 'pending' ? 'warning' : job.state === 'cancelled' ? 'critical' : 'active';
        const elapsedMinutes = Math.floor((job.elapsedSeconds || 0) / 60);
        const elapsed = `${Math.floor(elapsedMinutes / 60)}h ${String(elapsedMinutes % 60).padStart(2, '0')}m`;
        const assigned = job.assignedNodes.length ? job.assignedNodes.join(', ') : 'waiting for free nodes';
        return `
          <tr>
            <td class="cluster-job-id">${esc(job.id)}</td>
            <td>${esc(job.name)}</td>
            <td>${esc(job.type)}</td>
            <td><span class="cluster-node-state tone-${esc(stateClass)}">${esc(job.state)}</span></td>
            <td>${esc(job.requestedNodes)}</td>
            <td>${esc(job.requestedGpusPerNode)}</td>
            <td>${esc(elapsed)}</td>
            <td class="cluster-job-assigned">${esc(assigned)}</td>
            <td>${job.state === 'running' || job.state === 'pending' ? `<button class="cluster-cancel-btn" type="button" data-cluster-cancel="${esc(job.id)}">scancel</button>` : ''}</td>
          </tr>
        `;
      }).join('');
    target.innerHTML = `
      <div class="cluster-jobs-card">
        <div class="cluster-submit-head">
          <div>
            <div class="cluster-submit-title">Job Queue</div>
            <div class="cluster-submit-copy">Submitted presets become pending or running jobs depending on free node capacity. Completed and cancelled jobs release capacity for the next placement pass.</div>
          </div>
        </div>
        <div class="cluster-jobs-shell">
          <table class="cluster-jobs-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>State</th>
                <th>Nodes</th>
                <th>GPU / Node</th>
                <th>Elapsed</th>
                <th>Assigned Nodes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  global.AEGIS_CLUSTER_DASHBOARD = {
    renderFleetKpis,
    renderFleetGrid,
    renderFleetSidebar,
    renderWorkloadControls,
    renderJobTable,
  };
}(window));
