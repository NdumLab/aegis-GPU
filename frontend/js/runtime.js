let metrics = {
  util:82, vram_used:54, vram_total:80, temp:71, power:420,
  sbe:0, dbe:0, xid:'none',
  ib:'Active', nccl:'IB', ar:'180 GB/s',
  sutil:24, srw:890
};

let appMode = 'simulation';
let thermalMode = false;
let liveInterval = null;
let clusterSimInterval = null;

function isClusterDashboardActive() {
  return clusterDashboardActive === true;
}

function setClusterDashboardVisible(isVisible) {
  clusterDashboardActive = Boolean(isVisible);
  const pane = document.getElementById('cluster-dashboard-pane');
  const svg = document.getElementById('diagram-canvas');
  const legacySidebar = document.getElementById('metrics-sidebar');
  const stepControls = document.getElementById('step-controls');
  if (pane) pane.style.display = isVisible ? 'block' : 'none';
  if (svg) svg.style.display = isVisible ? 'none' : 'block';
  if (legacySidebar) legacySidebar.style.display = isVisible ? 'none' : '';
  if (stepControls) stepControls.style.display = isVisible ? 'none' : '';
}

function renderClusterDashboardView() {
  const summary = typeof getClusterSimSummary === 'function' ? getClusterSimSummary() : null;
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  const api = window.AEGIS_CLUSTER_DASHBOARD || null;
  if (!summary || !store || !api) return;
  const kpiTarget = document.getElementById('cluster-fleet-kpis');
  const gridTarget = document.getElementById('cluster-dashboard-grid');
  const sideTarget = document.getElementById('cluster-fleet-side');
  const controlsTarget = document.getElementById('cluster-workload-controls');
  const jobsTarget = document.getElementById('cluster-jobs-table');
  api.renderFleetKpis(summary, kpiTarget);
  api.renderWorkloadControls(store.state, controlsTarget);
  api.renderFleetGrid(store.state, gridTarget);
  api.renderJobTable(store.state, jobsTarget);
  api.renderFleetSidebar(summary, store.state, sideTarget);
}

function openClusterDashboard() {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store) return;
  currentLab = null;
  currentStep = -1;
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-cluster_fleet')?.classList.add('active');
  document.getElementById('scen-title').textContent = 'Cluster Fleet Simulator';
  document.getElementById('scen-desc').textContent = 'Shared simulator state rendered as a multi-node AI datacenter view. Use this as the fleet baseline before diving into a lab.';
  document.getElementById('scen-step').style.display = 'none';
  clearTerminal();
  logTerm([{ t: 'info', v: `[SIM] Cluster fleet view loaded for ${store.state.topology.clusterName}.` }]);
  logTerm([{ t: 'dim', v: '# Loop 2 dashboard reads the shared simulator state: jobs, nodes, GPUs, and alerts stay aligned.' }]);
  logTerm([{ t: 'dim', v: '# Loop 4 terminal routing is active here: try squeue, sinfo, sacct, nvidia-smi, ibstat, hostname, or ssh gb200-node-00.' }]);
  setClusterDashboardVisible(true);
  renderClusterDashboardView();
  updateTerminalInputHint();
  switchTab('term');
}

function closeClusterDashboard() {
  if (!isClusterDashboardActive()) return;
  setClusterDashboardVisible(false);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('scen-title').textContent = 'GPU Infrastructure Simulator';
  const desc = document.getElementById('scen-desc');
  if (desc && typeof describeClusterSimIdleView === 'function') desc.textContent = describeClusterSimIdleView();
  document.getElementById('scen-step').style.display = 'none';
  updateTerminalInputHint();
}

function submitClusterWorkload(presetId) {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store || typeof store.submitPreset !== 'function') return;
  const job = store.submitPreset(presetId);
  if (!job) return;
  renderClusterDashboardView();
  switchTab('term');
  logTerm([{ t: 'good', v: `Submitted batch job ${job.id}` }]);
  logTerm([{ t: 'dim', v: `# ${job.name} requested ${job.requestedNodes} node(s) and ${job.requestedGpusPerNode} GPU(s) per node on ${job.partition}.` }]);
  logTerm([{ t: 'info', v: `[SIM] ${job.state === 'running' ? 'Scheduler placed the job immediately.' : 'Job is pending until capacity frees up.'}` }]);
}

function cancelClusterWorkload(jobId) {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store || typeof store.cancelJob !== 'function') return;
  const job = store.cancelJob(Number(jobId));
  if (!job) return;
  renderClusterDashboardView();
  switchTab('term');
  logTerm([{ t: 'warn', v: `scancel: job ${job.id} signal sent` }]);
  logTerm([{ t: 'dim', v: `# ${job.name} released its reserved simulator capacity.` }]);
}

function injectClusterFault(faultId) {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store || typeof store.injectFault !== 'function') return;
  const fault = store.injectFault(faultId);
  if (!fault) return;
  renderClusterDashboardView();
  switchTab('term');
  logTerm([{ t: fault.severity === 'critical' ? 'bad' : 'warn', v: `[SIM FAULT] ${fault.label} injected on ${fault.nodeId}${fault.gpuId === null || fault.gpuId === undefined ? '' : ` GPU ${fault.gpuId}`}` }]);
  logTerm([{ t: 'dim', v: `# ${fault.message}` }]);
}

function clearClusterFault(faultId) {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store || typeof store.clearFault !== 'function') return;
  const fault = store.clearFault(faultId);
  if (!fault) return;
  renderClusterDashboardView();
  switchTab('term');
  logTerm([{ t: 'good', v: `[SIM FAULT] Cleared ${fault.label} on ${fault.nodeId}.` }]);
}

function clearAllClusterFaults() {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store || typeof store.clearAllFaults !== 'function') return;
  const cleared = store.clearAllFaults();
  if (!cleared || !cleared.length) return;
  renderClusterDashboardView();
  switchTab('term');
  logTerm([{ t: 'good', v: `[SIM FAULT] Cleared ${cleared.length} injected fault(s).` }]);
}

function updateClusterSimFoundationUI() {
  const summary = typeof getClusterSimSummary === 'function' ? getClusterSimSummary() : null;
  const status = document.getElementById('sys-status');
  if (summary && status) {
    status.innerHTML = `SYSTEM: <span style="color:var(--green)">SIM READY</span> | CLUSTER: <span style="color:var(--green)">${summary.totalNodes}N / ${summary.totalGpus}G</span> | JOBS: <span style="color:var(--green)">${summary.runningJobs}R / ${summary.pendingJobs}P</span>`;
  }
  if (!currentLab) {
    const title = document.getElementById('scen-title');
    const desc = document.getElementById('scen-desc');
    if (!isClusterDashboardActive()) {
      if (title) title.textContent = 'GPU Infrastructure Simulator';
      if (desc && typeof describeClusterSimIdleView === 'function') desc.textContent = describeClusterSimIdleView();
    }
  }
  if (isClusterDashboardActive()) renderClusterDashboardView();
}

function startClusterSimFoundationLoop() {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  if (!store) return;
  if (clusterSimInterval) clearInterval(clusterSimInterval);
  updateClusterSimFoundationUI();
  clusterSimInterval = setInterval(() => {
    if (appMode !== 'simulation') return;
    store.tick(3);
    updateClusterSimFoundationUI();
  }, 3000);
}

// --- RECONSTITUTION LOGIC ---
function runInstantSentinel() {
    const bp = document.getElementById('sel-blueprint').value;
    const fab = document.getElementById('sel-fabric').value;
    const warning = document.getElementById('sentinel-warning');

    if (typeof validateHardwareConfig === 'function') {
        const audit = validateHardwareConfig(bp, fab);
        if (!audit.isMatch) {
            warning.innerHTML = `⚠ INSTANTANEOUS MISMATCH:<br>${audit.reason}`;
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }
}

function applyProvisioning() {
    const selection = document.getElementById('sel-blueprint').value;
    const fabric = document.getElementById('sel-fabric').value;

    if (typeof HARDWARE_LIBRARY !== 'undefined') {
        currentBlueprint = { ...HARDWARE_LIBRARY[selection], fabric };
    }

    isProvisioned = true;
    localStorage.setItem('gpusim_blueprint', selection);
    localStorage.setItem('gpusim_fabric', fabric);
    document.getElementById('recon-overlay').style.display = 'none';
    document.getElementById('sys-status').innerHTML = `SYSTEM: <span style="color:var(--green)">ONLINE</span> | RACK: <span style="color:var(--green)">${currentBlueprint ? currentBlueprint.name : selection}</span>`;

    const svg = document.getElementById('diagram-canvas');
    clearCanvas();
    if (typeof drawRackElevation === 'function') {
        drawRackElevation(svg);
    } else {
        drawWelcome(svg);
    }
}

// --- ENGINE LOGIC ---
function loadLab(id) {
  if (!isProvisioned) return;
  setClusterDashboardVisible(false);
  clusterDashboardActive = false;
  clearCanvas();
  clearTerminal();
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  currentLab = id;
  currentStep = -1;
  document.body.classList.add('lab-active');

  const lab = LABS[id];
  document.getElementById('scen-title').textContent = lab.name;
  document.getElementById('scen-desc').textContent  = lab.objective;
  document.getElementById('scen-step').style.display = 'none';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-'+id)?.classList.add('active');

  const sc = document.getElementById('step-controls');
  sc.innerHTML = '';
  lab.steps.forEach((s,i) => {
    const btn = document.createElement('button');
    btn.className = 'step-btn' + (s.fault ? ' fault' : '');
    btn.textContent = (i+1) + '. ' + s.label;
    btn.onclick = () => selectStep(id, i);
    sc.appendChild(btn);
  });

  termLines.dmesg = typeof DMESG_CLEAN !== 'undefined' ? DMESG_CLEAN : [];
  termLines.dcgm  = typeof DCGM_CLEAN !== 'undefined' ? DCGM_CLEAN : [];
  if(activeTab==='dmesg') renderTab('dmesg');
  if(activeTab==='dcgm')  renderTab('dcgm');
  renderLabStepCoach();
  updateTerminalInputHint();

  showIntro(id);

  const svg = document.getElementById('diagram-canvas');
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  if(lab.draw) lab.draw(svg, -1);
}

function getStepExecutionContext(labId, stepIdx) {
  if(currentLab !== labId) return;
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  const lab = LABS[labId];
  const redirectedMainStep = getMainPathRedirectStep(labId, stepIdx);
  const step = redirectedMainStep || lab.steps[stepIdx];
  const stepModifier = getBranchStepModifier(labId, stepIdx);
  return { lab, redirectedMainStep, step, stepModifier };
}

function stageSelectedStep(labId, stepIdx, options = {}) {
  const context = getStepExecutionContext(labId, stepIdx);
  if (!context) return null;
  const { lab, redirectedMainStep, step, stepModifier } = context;
  currentStep = stepIdx;
  activeMainRedirectStep = redirectedMainStep;

  document.querySelectorAll('.step-btn').forEach((btn,i) => {
    btn.classList.toggle('active', i===stepIdx);
  });

  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Step ${stepIdx+1}/${lab.steps.length}`;
  document.getElementById('scen-desc').textContent = redirectedMainStep
    ? `${step.label} • Redirected recovery-aware main path`
    : (stepModifier ? `${stepModifier.title} • ${step.label}` : step.label);
  const cmdInput = document.getElementById('cmd-input');
  if (cmdInput && !options.preserveInput) cmdInput.value = '';
  updateTerminalInputHint();

  const svg = document.getElementById('diagram-canvas');
  clearCanvas();
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  setTimeout(()=> { if(lab.draw) lab.draw(svg, stepIdx); }, 100);

  updateMetrics(labId, stepIdx, step);
  renderLabStepCoach();
  recordLabReasoningProgress(labId, stepIdx, getReasoningScorecardContext(labId, step));
  if (options.focusInput && cmdInput) cmdInput.focus();
  return context;
}

function logStepTypingHint(step) {
  const hint = terminalModeEnabled
    ? (step?.terminal
      ? '# Type Probes mode: type the accepted probe for this checkpoint, or type help.'
      : '# Type Probes mode: type the command shown in the guide to replay this checkpoint.')
    : '# Guided Replay mode: press Run Step to replay the authored evidence automatically.';
  logTerm([{ t: 'dim', v: hint }]);
}

function selectStep(labId, stepIdx) {
  const context = stageSelectedStep(labId, stepIdx, { focusInput: true });
  if (!context) return;
  switchTab('term');
  clearTerminal();
  logStepTypingHint(context.step);
  scrollTerminal();
}

function runStep(labId, stepIdx, options = {}) {
  const invokedCommand = options.invokedCommand || '';
  const context = stageSelectedStep(labId, stepIdx, { preserveInput: true });
  if (!context) return;
  const { lab, redirectedMainStep, step } = context;

  switchTab('term');
  clearTerminal();
  logTerm([{t:'prompt',v:`[gpu-node-01] `},{t:'cmd',v:invokedCommand || step.cmd}]);

  const out = (typeof TERMINAL_OUTPUT !== 'undefined' && TERMINAL_OUTPUT[step.type]) ? [...TERMINAL_OUTPUT[step.type]] : [{t:'dim',v:'# (output executed)'}];
  getBranchPenaltyMessages(labId, stepIdx).forEach(message => {
    out.push({ t: 'warn', v: message });
  });
  let delay = 300;
  out.forEach((line,i) => {
    setTimeout(()=>{
      logTerm([line]);
      scrollTerminal();
    }, delay + i*60);
  });

  addXIDLog(labId, stepIdx, step);
  if (redirectedMainStep) markMainPathRedirectDone(labId, stepIdx);

  const aiFaultTargets = {
    ecc_xid: { xid: '48', node: 2 },
    xid48: { xid: '48', node: 2 },
    xid79: { xid: '79', node: 3 },
    xid74: { xid: '74', node: 0 }
  };
  const aiFault = aiFaultTargets[step.type];
  if (step.fault && aiFault) {
    const aiBtn = document.createElement('button');
    aiBtn.className = 'btn';
    aiBtn.style.cssText = 'background:var(--copper);color:#000;font-weight:700;width:100%;margin-top:12px;padding:9px 0;font-size:12px;letter-spacing:0.05em;';
    aiBtn.textContent = '🤖 Engage AIOps Engine — XID ' + aiFault.xid;
    aiBtn.onclick = () => requestAI_Remediation(aiFault.xid, aiFault.node);
    document.getElementById('step-controls').appendChild(aiBtn);
  }

  if(stepIdx === lab.steps.length-1) {
    const cleanFinish = isLabCompletionClean(labId);
    completedLabs.add(labId);
    localStorage.setItem('gpusim_completed', JSON.stringify([...completedLabs]));
    recordLabCompletionOutcome(labId, cleanFinish);
    document.getElementById('b-'+labId).textContent = cleanFinish ? '✓' : '!';
    document.getElementById('nav-'+labId).classList.add('done');
    if (!cleanFinish) document.getElementById('nav-'+labId).classList.add('fault');
    document.getElementById('h-done').textContent = completedLabs.size;
    setTimeout(() => logTerm([{
      t: cleanFinish ? 'good' : 'warn',
      v: cleanFinish
        ? `\n✓ Lab complete: ${lab.name}`
        : `\n! Lab reached the end, but the incident path stayed compromised: ${lab.name}`
    }]), out.length*60+500);
  }
}

function runCurrentStep() {
  if(!currentLab) return;
  if (currentStep < 0) {
    selectStep(currentLab, 0);
    return;
  }
  const context = getStepExecutionContext(currentLab, currentStep);
  if (!context) return;
  const cmdInput = document.getElementById('cmd-input');
  if (terminalModeEnabled && (context.step?.terminal || (context.step?.cmd && !String(context.step.cmd).trim().startsWith('#')))) {
    switchTab('term');
    if (cmdInput) cmdInput.focus();
    logTerm([{ t: 'dim', v: '# Type Probes mode is on. Type the checkpoint probe and press Enter, or type help.' }]);
    scrollTerminal();
    return;
  }
  if (currentStep >= 0 && isBranchDetourPending(currentLab, currentStep)) {
    if (runBranchDetour(currentLab, currentStep)) return;
  }
  if (currentStep >= 0 && isAlternateBranchStepPending(currentLab, currentStep)) {
    if (runAlternateBranchStep(currentLab, currentStep)) return;
  }
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  const lab = LABS[currentLab];
  const next = currentStep+1;
  if (currentStep >= 0 && next < lab.steps.length) {
    const choice = getSelectedBranchChoice(currentLab, currentStep);
    if (choice && choice.effect !== 'best' && ALTERNATE_MAIN_PATH_STEPS[currentLab] && branchingState[getBranchMetaKey(currentLab, next, 'main_redirect_done')] !== true) {
      scheduleMainPathRedirect(currentLab, next);
    }
  }
  if(next < lab.steps.length) runStep(currentLab, next);
}

function updateMetrics(labId, step, stepDef) {
  const branchContext = getBranchConsequenceContext(labId, step);
  const fault = stepDef.fault;
  let util=82, vram=54, temp=71, power=420;
  let sbe=0, dbe=0, xid='none';
  let ib='Active', nccl='IB', ar='180 GB/s';
  let sutil=24, srw=890;

  if(labId==='ecc') {
    sbe = [0,0,0,3,16,58,58][Math.min(step,6)];
    dbe = [0,0,0,0,0,1,2][Math.min(step,6)];
    xid = dbe>0?'48':sbe>20?'—':'none';
  }
  if(labId==='nvlink_fault' && step>=2) { ar='3 GB/s'; }
  if(labId==='allreduce' && step===4) { nccl='TCP'; ar='8 GB/s'; }
  if(labId==='nccl_fallback' && step<3) { nccl='TCP'; ar='8 GB/s'; }
  if(labId==='storage' && step>=1 && step<5) { util=40; sutil=100; srw=446; }
  if(labId==='storage' && step>=5) { util=93; sutil=28; srw=3200; }
  if(labId==='ib_fabric' && step>=3) { ib='Down (node-06)'; }
  if(labId==='nvlink_fault' && step===0) { dbe=2; xid='48'; }
  if(labId==='nvlink_fault' && step===2) { xid='79'; util=0; }
  if(labId==='nvlink_fault' && step===4) { xid='74'; }
  if(fault) temp = Math.min(temp+12, 86);
  if(labId==='training' && step>=1 && step<=4) { util=94; }

  if (branchContext.hasPenalty) {
    if (branchContext.dominantDomain === 'fault_isolation') {
      temp = Math.min(temp + (branchContext.badCount ? 4 : 2), 91);
      util = Math.max(util - (branchContext.badCount ? 26 : 12), 0);
      if (step >= 1 && xid === 'none') xid = 'risk';
    } else if (branchContext.dominantDomain === 'fabric_path') {
      nccl = 'TCP';
      ar = branchContext.badCount ? '5 GB/s' : '8 GB/s';
      ib = branchContext.badCount && labId === 'ib_fabric' ? 'Flapping' : ib;
    } else if (branchContext.dominantDomain === 'runtime_delivery') {
      util = Math.max(util - (branchContext.badCount ? 18 : 10), 0);
      power = Math.max(power - (branchContext.badCount ? 80 : 40), 240);
    } else if (branchContext.dominantDomain === 'platform_efficiency') {
      util = Math.max(util - (branchContext.badCount ? 24 : 12), 0);
      sutil = Math.min(sutil + (branchContext.badCount ? 25 : 12), 100);
      srw = Math.max(srw - (branchContext.badCount ? 350 : 180), 120);
    }
  }

  setMetric('m-util', util+'%', util<20?'err':util>85?'ok':'warn');
  setMetric('m-vram', `${vram}/80GB`, 'ok');
  setMetric('m-temp', temp+'°C', temp>83?'err':temp>78?'warn':'ok');
  setMetric('m-power', power+'W', power>680?'warn':'ok');
  setMetric('m-sbe', sbe.toString(), sbe>0?'warn':'ok');
  setMetric('m-dbe', dbe.toString(), dbe>0?'err':'ok');
  setMetric('m-xid', xid, xid!=='none'?'err':'dim');
  setMetric('m-ib',  ib, ib==='Active'?'ok':'err');
  setMetric('m-nccl',nccl, nccl==='IB'?'ok':'warn');
  setMetric('m-ar',  ar, ar==='180 GB/s'||ar.includes('182')||ar.includes('187')?'ok':'warn');
  setMetric('m-sutil',sutil+'%', sutil>90?'err':sutil>60?'warn':'ok');
  setMetric('m-srw', srw.toString(), 'ok');

  setBar('mb-util',  util, util<30?'var(--red)':util>80?'var(--green)':'var(--yellow)');
  setBar('mb-vram',  (vram/80)*100, 'var(--blue)');
  setBar('mb-temp',  (temp/100)*100, temp>83?'var(--red)':temp>78?'var(--yellow)':'var(--yellow)');
  setBar('mb-power', (power/700)*100, 'var(--copper)');
  setBar('mb-sutil', sutil, sutil>90?'var(--red)':sutil>60?'var(--yellow)':'var(--cyan)');
}

function setMetric(id, val, cls) {
  const el = document.getElementById(id);
  if(el){ el.textContent=val; el.className='metric-value '+cls; }
}

function setBar(id, pct, color) {
  const el = document.getElementById(id);
  if(el){ el.style.width=Math.min(pct,100)+'%'; el.style.background=color; }
}

function addXIDLog(labId, step, stepDef) {
  const branchContext = getBranchConsequenceContext(labId, step);
  const log = document.getElementById('xid-log-entries');
  const time = new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const entry = document.createElement('div');
  entry.className = 'xid-entry';
  let msg = `[${time}] ${LABS[labId].name}: step ${step+1}`;
  if(stepDef.fault) { entry.className = 'xid-entry warn'; msg = `[${time}] ⚠ ${stepDef.label}`; }
  if(labId==='ecc' && step>=3) { entry.className = 'xid-entry crit'; msg = `[${time}] ✗ XID 48 — DBE error`; }
  if(labId==='nvlink_fault' && step===2) { entry.className = 'xid-entry crit'; msg = `[${time}] ✗ XID 79 — GPU hung`; }
  entry.textContent = msg;
  log.prepend(entry);
  if (branchContext.hasPenalty) {
    const branchEntry = document.createElement('div');
    branchEntry.className = `xid-entry ${branchContext.badCount ? 'crit' : 'warn'}`;
    branchEntry.textContent = `[${time}] Branch consequence — ${getBranchPenaltyMessages(labId, step)[0]}`;
    log.prepend(branchEntry);
  }
  while(log.children.length > 8) log.removeChild(log.lastChild);
}

function logTerm(lines) {
  const out = document.getElementById('terminal-output');
  lines.forEach(({t,v}) => {
    const span = document.createElement('div');
    span.className = 't-'+t;
    span.textContent = v;
    out.appendChild(span);
    termLines.term.push({t, v});
    if(termLines.term.length > 500) termLines.term.shift();
  });
}

function clearTerminal() {
  document.getElementById('terminal-output').innerHTML = '';
  termLines.term = [];
}

function logTermIdleHint() {
  const out = document.getElementById('terminal-output');
  if (out && !out.childElementCount) {
    logTerm([
      { t: 'dim', v: '# No lab selected yet.' },
      { t: 'dim', v: '# Pick a lab in the left sidebar to begin — the commands you run will appear here.' },
    ]);
  }
}

function scrollTerminal() {
  const out = document.getElementById('terminal-output');
  out.scrollTop = out.scrollHeight;
}

function switchTab(tab) {
  activeTab = tab;

  ['term','dmesg','dcgm','parser'].forEach(t => {
    const el = document.getElementById('tab-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });

  const out = document.getElementById('terminal-output');
  const parserUi = document.getElementById('parser-ui');
  const inputRow = document.getElementById('terminal-input-row');

  if (tab === 'parser') {
      if(out) out.style.display = 'none';
      if(inputRow) inputRow.style.display = 'none';
      if(parserUi) parserUi.style.display = 'flex';
  } else {
      if(out) out.style.display = 'block';
      if(inputRow) inputRow.style.display = 'flex';
      if(parserUi) parserUi.style.display = 'none';

      out.innerHTML = '';
      if (tab === 'term') {
        termLines.term.forEach(({t,v}) => {
          const div = document.createElement('div');
          div.className = 't-' + t;
          div.textContent = v;
          out.appendChild(div);
        });
      } else {
        const data = (tab==='dmesg') ? (typeof DMESG_CLEAN!=='undefined'?DMESG_CLEAN:[]) : (typeof DCGM_CLEAN!=='undefined'?DCGM_CLEAN:[]);
        data.forEach(({t,v}) => {
          const div = document.createElement('div');
          div.className = 't-' + t;
          div.textContent = v;
          out.appendChild(div);
        });
      }
  }
  renderLabStepCoach();
}

function renderTab(tab) {
  const out = document.getElementById('terminal-output');
  out.innerHTML='';
  const data = (tab==='dmesg') ? (typeof DMESG_CLEAN !== 'undefined' ? DMESG_CLEAN : []) : (typeof DCGM_CLEAN !== 'undefined' ? DCGM_CLEAN : []);
  data.forEach(({t,v})=>{
    const div = document.createElement('div');
    div.className='t-'+t; div.textContent=v;
    out.appendChild(div);
  });
}

function normalizeLabTerminalCommand(cmd) {
  return String(cmd || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesLabTerminalPattern(pattern, normalized) {
  if (!pattern) return false;
  if (pattern instanceof RegExp) return pattern.test(normalized);
  return normalized === normalizeLabTerminalCommand(pattern);
}

function getLabTerminalConfig(step) {
  return step && step.terminal ? step.terminal : null;
}

function setTerminalModeEnabled(enabled) {
  terminalModeEnabled = !!enabled;
  localStorage.setItem('gpusim_terminal_mode', terminalModeEnabled ? 'true' : 'false');
  updateTerminalModeUI();
  updateTerminalInputHint();
  if (currentLab) renderLabStepCoach();
}

function updateTerminalModeUI() {
  const toggleBtn = document.getElementById('btn-terminal-mode');
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', terminalModeEnabled);
    toggleBtn.textContent = terminalModeEnabled ? '⌨ Type Probes' : '▶ Guided Replay';
    toggleBtn.title = terminalModeEnabled
      ? 'Type Probes mode is on. You must type accepted probes for the current checkpoint.'
      : 'Guided Replay mode is on. Use Run Step to replay authored checkpoint evidence.';
  }
  const runBtn = document.getElementById('run-btn');
  if (runBtn) {
    runBtn.textContent = terminalModeEnabled ? '⌨ Focus Input' : '▶ Run Step';
    runBtn.title = terminalModeEnabled
      ? 'Focus the terminal input. The checkpoint advances only after you type an accepted probe.'
      : 'Replay the authored checkpoint evidence and advance to the next step.';
  }
  const inputRow = document.getElementById('terminal-input-row');
  if (inputRow) {
    inputRow.style.display = terminalModeEnabled ? 'flex' : 'none';
  }
  updateTerminalModeStatus();
}

function updateTerminalModeStatus() {
  const status = document.getElementById('terminal-mode-status');
  if (!status) return;
  if (terminalModeEnabled) {
    status.innerHTML = '<strong class="mode-terminal">Type Probes:</strong> type an accepted checkpoint command and press Enter. Use <strong>help</strong> to list valid probes. The <strong>Focus Input</strong> button only places the cursor in the terminal.';
  } else {
    status.innerHTML = '<strong class="mode-guided">Guided Replay:</strong> press <strong>Run Step</strong> to replay the authored evidence automatically. Turn on <strong>Type Probes</strong> when you want to practice commands.';
  }
}

function getLabTerminalCandidateSteps() {
  if (!currentLab || !LABS[currentLab]) return [];
  const lab = LABS[currentLab];
  const indices = currentStep < 0 ? [0] : [currentStep, currentStep + 1];
  return [...new Set(indices)]
    .filter(stepIdx => stepIdx >= 0 && stepIdx < lab.steps.length)
    .map(stepIdx => ({ stepIdx, step: lab.steps[stepIdx], config: getLabTerminalConfig(lab.steps[stepIdx]) }))
    .filter(item => item.step && item.config);
}

function getLabTerminalHelpLines() {
  const candidates = getLabTerminalCandidateSteps();
  if (!candidates.length) {
    return [{ t: 'dim', v: '# No limited lab terminal is active yet. Start a supported lab step first.' }];
  }
  const lines = [{ t: 'info', v: '[LAB TERMINAL] Accepted probes for the current checkpoint(s):' }];
  candidates.forEach(({ stepIdx, step, config }) => {
    const examples = Array.isArray(config.examples) ? config.examples : [];
    if (!examples.length) return;
    lines.push({ t: 'dim', v: `# Step ${stepIdx + 1}: ${step.label}` });
    examples.slice(0, 3).forEach(example => lines.push({ t: 'good', v: `  ${example}` }));
  });
  lines.push({ t: 'dim', v: '# The terminal is intentionally limited. It accepts authored probes, not arbitrary shell execution.' });
  return lines;
}

function resolveLabTerminalCommand(cmd) {
  const normalized = normalizeLabTerminalCommand(cmd);
  if (!normalized) return { kind: 'empty' };
  if (normalized === 'help' || normalized === '?') return { kind: 'help' };

  const candidates = getLabTerminalCandidateSteps();
  for (const candidate of candidates) {
    const accepted = Array.isArray(candidate.config.accepted) ? candidate.config.accepted : [];
    if (accepted.some(pattern => matchesLabTerminalPattern(pattern, normalized))) {
      return { kind: 'accepted', ...candidate };
    }

    const weakMatches = Array.isArray(candidate.config.weak) ? candidate.config.weak : [];
    for (const weak of weakMatches) {
      const patterns = Array.isArray(weak.match) ? weak.match : [weak.match];
      if (patterns.some(pattern => matchesLabTerminalPattern(pattern, normalized))) {
        return { kind: 'weak', ...candidate, feedback: weak.feedback || 'That command is related, but it does not answer the current checkpoint cleanly.' };
      }
    }
  }

  return { kind: 'miss' };
}

function updateTerminalInputHint() {
  const cmdInput = document.getElementById('cmd-input');
  if (!cmdInput) return;
  if (!terminalModeEnabled) {
    if (isClusterDashboardActive()) {
      cmdInput.placeholder = 'Cluster Fleet terminal: try squeue, sinfo, nvidia-smi, ibstat, hostname, or ssh gb200-node-00...';
      return;
    }
    cmdInput.placeholder = 'Guided Replay is on. Turn on Type Probes to type checkpoint commands...';
    return;
  }
  if (!currentLab) {
    if (isClusterDashboardActive()) {
      cmdInput.placeholder = 'Cluster Fleet terminal: try squeue, sinfo, nvidia-smi, ibstat, hostname, or ssh gb200-node-00...';
      return;
    }
    cmdInput.placeholder = 'Select a checkpoint, then type an accepted probe...';
    return;
  }
  const candidates = getLabTerminalCandidateSteps();
  if (!candidates.length) {
    cmdInput.placeholder = 'Type the current checkpoint probe, or type help for accepted probes...';
    return;
  }
  const firstExample = candidates[0].config?.examples?.[0];
  cmdInput.placeholder = firstExample
    ? `Try: ${firstExample}  |  type help for accepted probes`
    : 'Type the current checkpoint probe, or type help for accepted probes...';
}

function runClusterTerminalCommand(cmd) {
  const store = typeof ensureClusterSimStore === 'function' ? ensureClusterSimStore() : null;
  const api = window.AEGIS_CLUSTER_TERMINAL || null;
  if (!store || !api || typeof api.runCommand !== 'function') return false;
  const result = api.runCommand(store.state, cmd);
  if (!result || result.handled !== true) return false;
  logTerm([{ t: 'cmd', v: '$ ' + cmd }]);
  if (result.action && result.action.type === 'cancel') {
    cancelClusterWorkload(result.action.jobId);
    if (!result.lines || !result.lines.length) return true;
  }
  (result.lines || []).forEach((line) => {
    const level = line.startsWith('#') ? 'dim' : 'info';
    logTerm([{ t: level, v: line }]);
  });
  return true;
}

function handleCustomCommand(cmd) {
  if (isClusterDashboardActive() && runClusterTerminalCommand(cmd)) {
    return;
  }
  const c = cmd.toLowerCase();
  if(c.includes('nvidia-smi') && !c.includes('dmon') && !c.includes('topo') && !c.includes('nvlink')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.smi_check?.forEach(l=>logTerm([l]));
  } else if(c.includes('ibstat')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.ib_stat?.forEach(l=>logTerm([l]));
  } else if(c.includes('dmesg')) {
    if(typeof DMESG_CLEAN !== 'undefined') DMESG_CLEAN.slice(-5).forEach(l=>logTerm([l]));
  } else if(c.includes('kubectl get pods')) {
    if(typeof TERMINAL_OUTPUT !== 'undefined') TERMINAL_OUTPUT.k8s_operator?.forEach(l=>logTerm([l]));
  } else {
    logTerm([{t:'dim',v:'# Tip: use the step buttons above for guided lab output and read the Lab Coach panel on the right for what to look for.'}]);
  }
}

function executeLabTerminalCommand(cmd) {
  if (!getLabTerminalCandidateSteps().length) {
    logTerm([{t:'cmd',v:'$ '+cmd}]);
    handleCustomCommand(cmd);
    return;
  }
  const resolved = resolveLabTerminalCommand(cmd);
  if (resolved.kind === 'help') {
    logTerm([{t:'cmd',v:'$ '+cmd}]);
    getLabTerminalHelpLines().forEach(line => logTerm([line]));
    return;
  }
  if (resolved.kind === 'accepted') {
    runStep(currentLab, resolved.stepIdx, {
      invokedCommand: cmd
    });
    return;
  }
  if (resolved.kind === 'weak') {
    logTerm([{t:'cmd',v:'$ '+cmd}]);
    logTerm([{ t: 'warn', v: `[LAB TERMINAL] ${resolved.feedback}` }]);
    const example = resolved.config?.examples?.[0];
    if (example) logTerm([{ t: 'dim', v: `# Try instead: ${example}` }]);
    return;
  }
  logTerm([{t:'cmd',v:'$ '+cmd}]);
  logTerm([{ t: 'dim', v: '# This terminal is intentionally limited for the lab. Type help to see the accepted probes for the current checkpoint.' }]);
  getLabTerminalHelpLines().slice(0, 5).forEach(line => logTerm([line]));
}

function showIntro(id) {
  const lab = LABS[id];
  const guide = getLearningGuide(id);
  const el = document.getElementById('intro-content');
  if (!lab || !el) return;

  const guideMarkup = renderLearningGuide(id);
  const modeNote = incidentMode
    ? '<div class="learn-banner learn-banner-compact"><div class="learn-banner-title">Incident Mode is on</div><p>This lab is now using reduced scaffolding. Focus on what is known, what is still unproven, and the next safe move.</p></div>'
    : guide?.hideModeNote ? '' : (beginnerMode
    ? '<div class="learn-banner"><div class="learn-banner-title">Beginner Mode is on</div><p>Real operator jargon stays visible, but each term is explained in plain language so you build vocabulary while you learn.</p></div>'
    : '<div class="learn-banner learn-banner-compact"><div class="learn-banner-title">Compact lab brief</div><p>Turn on Beginner Mode for deeper explanations, lifecycle context, and slower reading material.</p></div>');
  const objectiveTitle = guide?.objectiveTitle || 'Objective';
  const objectiveText = guide?.objectiveText || lab.objective;

  el.innerHTML = `
    <h2>${lab.icon} ${lab.name}</h2>
    <div class="intro-action-row intro-action-row-top">
      <button class="btn-sm" type="button" data-intro-action="skip">Skip Intro</button>
      <button class="btn-sm primary" type="button" data-intro-action="start">▶ Start Lab</button>
    </div>
    ${modeNote}
    <div class="objective">
      <h4>${escHtml(objectiveTitle)}</h4>
      <p>${escHtml(tightenDisplayCopy(objectiveText))}</p>
    </div>
    ${guide ? guideMarkup : ''}
    <section class="learn-section">
      <div class="learn-heading-row">
        <h4>Lab Steps</h4>
        <span class="learn-mode-tag">Guided flow</span>
      </div>
      ${renderGuidedFlowSteps(lab)}
    </section>
  `;
  document.getElementById('intro-overlay').classList.add('show');
  renderDetachedPanel('introOverlay');
}

function closeIntro() {
  document.getElementById('intro-overlay').classList.remove('show');
}

function startLab() {
  closeIntro();
  if(currentLab) selectStep(currentLab, 0);
}

function renderRunbookButton(xid) {
  const stepControls = document.getElementById('step-controls');
  if (!stepControls) return;

  stepControls.replaceChildren();
  const button = document.createElement('button');
  button.className = 'btn';
  button.style.cssText = 'background:var(--copper); color:#000; font-weight:bold; width:100%; margin-top:10px;';
  button.textContent = '▶ EXECUTE AUTONOMOUS RUNBOOK';
  button.addEventListener('click', () => executeRunbook(xid));
  stepControls.appendChild(button);
}

function setIncidentBodyMessage(body, message, color = 'var(--dim)') {
  body.replaceChildren();
  const notice = document.createElement('div');
  notice.style.cssText = `color:${color};font-size:11px;padding:10px`;
  notice.textContent = message;
  body.appendChild(notice);
}

function renderIncidentHistory(body, rows) {
  body.replaceChildren();
  const fmt = ts => new Date(ts * 1000).toISOString().replace('T',' ').slice(0,19);
  const kindColor = kind => kind === 'diagnose' ? 'var(--blue)' : 'var(--copper)';

  rows.forEach(row => {
    const item = document.createElement('div');
    item.style.cssText = 'border-bottom:1px solid var(--border);padding:8px 0;font-size:11px;font-family:var(--font-mono)';

    const kind = document.createElement('span');
    kind.style.cssText = `color:${kindColor(row.kind)};text-transform:uppercase;font-weight:700`;
    kind.textContent = String(row.kind || 'unknown');
    item.appendChild(kind);

    const fault = document.createElement('span');
    fault.style.cssText = 'color:var(--text);margin:0 8px';
    fault.textContent = `XID ${row.fault ?? 'unknown'}`;
    item.appendChild(fault);

    const timestamp = document.createElement('span');
    timestamp.style.cssText = 'color:var(--dim)';
    timestamp.textContent = fmt(row.ts);
    item.appendChild(timestamp);

    const user = document.createElement('span');
    user.style.cssText = 'color:var(--dim);margin-left:8px';
    user.textContent = `by ${row.user || 'unknown'}`;
    item.appendChild(user);

    if (row.status) {
      const status = document.createElement('span');
      status.style.cssText = 'color:var(--green);margin-left:8px';
      status.textContent = `[${row.status}]`;
      item.appendChild(status);
    }

    if (row.source) {
      const source = document.createElement('span');
      source.style.cssText = 'color:var(--dim);margin-left:8px';
      source.textContent = `src:${row.source}`;
      item.appendChild(source);
    }

    if (row.summary) {
      const summary = document.createElement('div');
      summary.style.cssText = 'color:var(--dim);margin-top:4px;white-space:pre-wrap;word-break:break-word';
      const truncated = row.summary.length > 200 ? `${row.summary.slice(0, 200)}…` : row.summary;
      summary.textContent = truncated;
      item.appendChild(summary);
    }

    if (beginnerMode) {
      const explain = document.createElement('div');
      explain.className = 'incident-explain';
      explain.textContent = describeIncidentKind(row.kind || 'unknown');
      item.appendChild(explain);
    }

    body.appendChild(item);
  });
}

function resetAll() {
  completedLabs.clear();
  document.getElementById('h-done').textContent='0';
  document.getElementById('h-score').textContent='—';
  document.getElementById('h-judgment').textContent='—';
  localStorage.removeItem('gpusim_completed');
  localStorage.removeItem('gpusim_score');
  localStorage.removeItem('gpusim_reasoning_progress');
  localStorage.removeItem('gpusim_branching_state');
  reasoningProgress = { steps: {}, quizzes: [], completion: {} };
  branchingState = {};
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active','done'));
  clearCanvas();
  clearTerminal();
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  currentLab=null; currentStep=-1;
  document.body.classList.remove('lab-active');
  logTermIdleHint();
  setClusterDashboardVisible(false);
  clusterDashboardActive = false;
  document.getElementById('scen-title').textContent='GPU Infrastructure Simulator';
  document.getElementById('scen-step').style.display='none';
  document.getElementById('step-controls').innerHTML='';

  const svg=document.getElementById('diagram-canvas');
  if (typeof drawRackElevation === 'function' && isProvisioned) {
      drawRackElevation(svg);
  } else if (typeof drawWelcome === 'function') {
      drawWelcome(svg);
  }
  if (typeof ensureClusterSimStore === 'function') {
    const store = ensureClusterSimStore();
    if (store && typeof store.reset === 'function') store.reset();
  }
  updateClusterSimFoundationUI();
}

function showLandingHub() {
  const hub = document.getElementById('hub-overlay');
  if (hub) hub.style.display = 'flex';
}

function maybeShowLandingHub() {
  if (isBrowserSmokeMode()) return false;
  if (localStorage.getItem('gpusim_hub_seen')) return false;
  showLandingHub();
  return true;
}

function dismissLandingHub(choice) {
  localStorage.setItem('gpusim_hub_seen', 'true');
  const hub = document.getElementById('hub-overlay');
  if (hub) hub.style.display = 'none';
  if (choice === 'blueprint') {
    const recon = document.getElementById('recon-overlay');
    if (recon) recon.style.display = 'flex';
    return;
  }
  if (!isProvisioned) applyProvisioning();
  if (choice === 'incident') {
    setWorkspaceMode('incident');
  } else if (choice === 'fleet') {
    setWorkspaceMode('fleet');
  } else {
    setWorkspaceMode('training', { openFleet: false });
    const firstLab = typeof LABS !== 'undefined' ? Object.keys(LABS)[0] : null;
    if (!currentLab && firstLab) loadLab(firstLab);
  }
}

function setWorkspaceMode(mode, options = {}) {
  const allowedModes = new Set(['training', 'incident', 'fleet']);
  const nextMode = allowedModes.has(mode) ? mode : 'training';
  document.body.dataset.workspaceMode = nextMode;
  localStorage.setItem('gpusim_workspace_mode', nextMode);
  document.querySelectorAll('[data-workspace-mode]').forEach(button => {
    button.classList.toggle('active', button.getAttribute('data-workspace-mode') === nextMode);
  });
  if (nextMode === 'fleet' && options.openFleet !== false) {
    openClusterDashboard();
  }
  if (nextMode === 'incident' && !incidentMode) {
    setIncidentMode(true);
  } else if (nextMode !== 'incident' && incidentMode) {
    setIncidentMode(false);
  }
}

function bindUIHandlers() {
  if (_uiHandlersBound) return;
  _uiHandlersBound = true;
  const on = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

  on('btn-login',  'click', aegisLogin);
  const passEl = document.getElementById('login-pass');
  if (passEl) passEl.addEventListener('keydown', e => { if(e.key==='Enter') aegisLogin(); });

  on('hub-card-learn', 'click', () => dismissLandingHub('learn'));
  on('hub-card-incident', 'click', () => dismissLandingHub('incident'));
  on('hub-card-fleet', 'click', () => dismissLandingHub('fleet'));
  on('hub-card-blueprint', 'click', () => dismissLandingHub('blueprint'));
  on('brand-home', 'click', showLandingHub);
  on('brand-home', 'keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showLandingHub(); } });

  on('btn-learn-hub', 'click', () => switchLearnTab('study'));
  document.querySelectorAll('[data-learn-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchLearnTab(btn.getAttribute('data-learn-tab')));
  });
  on('btn-blueprint', 'click', () => { document.getElementById('recon-overlay').style.display = 'flex'; });
  on('btn-open-fleet', 'click', () => openClusterDashboard());
  on('btn-logout',  'click', aegisLogout);
  on('btn-reset',   'click', resetAll);
  on('toggle-beginner', 'change', e => setBeginnerMode(e.target.checked));
  on('toggle-incident-mode', 'change', e => setIncidentMode(e.target.checked));
  on('toggle-llm-diagnosis', 'change', e => setLLMDiagnosisEnabled(e.target.checked));
  on('sel-explain-level', 'change', e => setExplanationLevel(e.target.value));
  on('sel-explain-role', 'change', e => setExplanationRole(e.target.value));
  on('btn-toggle-coach', 'click', toggleLabCoach);
  on('btn-close-coach', 'click', () => setLabCoachOpen(false));
  on('btn-popout-coach', 'click', () => openDetachedPanel('stepCoach'));
  on('btn-popout-live-explainer', 'click', () => openDetachedPanel('liveExplainer'));
  on('btn-popout-intro', 'click', () => openDetachedPanel('introOverlay'));
  on('btn-popout-study', 'click', () => openDetachedPanel('studyOverlay'));
  on('btn-popout-quiz', 'click', () => openDetachedPanel('quizOverlay'));
  const coachEl = document.getElementById('lab-step-coach');
  if (coachEl) coachEl.addEventListener('click', handleLabCoachClick);


  on('sel-blueprint', 'change', runInstantSentinel);
  on('sel-fabric',    'change', runInstantSentinel);
  on('btn-apply',     'click',  applyProvisioning);

  ['toggle-live','sidebar-toggle-live','quiz-toggle-live'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleAppMode(el.checked));
  });
  ['toggle-thermal','sidebar-toggle-thermal','quiz-toggle-thermal'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleThermalView(el.checked));
  });

  on('btn-clear-term', 'click', clearTerminal);
  on('toggle-ai-btn',  'click', toggleAIDoc);
  on('run-btn',        'click', runCurrentStep);
  on('btn-terminal-mode', 'click', () => setTerminalModeEnabled(!terminalModeEnabled));
  on('btn-analyze',    'click', analyzeLog);

  ['term','dmesg','dcgm','parser'].forEach(tab => {
    on('tab-'+tab, 'click', () => switchTab(tab));
  });

  on('btn-intro-close', 'click', closeIntro);
  on('btn-intro-skip',  'click', closeIntro);
  on('btn-intro-start', 'click', startLab);
  const introContent = document.getElementById('intro-content');
  if (introContent) introContent.addEventListener('click', e => {
    const action = e.target.closest('[data-intro-action]');
    if (!action) return;
    if (action.dataset.introAction === 'skip') {
      closeIntro();
      return;
    }
    if (action.dataset.introAction === 'start') {
      startLab();
    }
  });

  on('btn-quiz-close', 'click', closeQuiz);
  on('btn-study-close', 'click', closeStudyGuide);
  const studyContent = document.getElementById('study-content');
  if (studyContent) studyContent.addEventListener('click', e => {
    const studyAction = e.target.closest('[data-study-action]');
    if (studyAction?.dataset.studyAction === 'export-report') {
      downloadReasoningProgressReport();
      return;
    }
    const labLink = e.target.closest('[data-study-lab]');
    if (labLink) openStudyLab(labLink.dataset.studyLab);
  });

  const quizContent = document.getElementById('quiz-content');
  if (quizContent) quizContent.addEventListener('click', e => {
    const option = e.target.closest('.quiz-option[data-quiz-question]');
    if (option) {
      selectAnswer(Number(option.dataset.quizQuestion), Number(option.dataset.quizOption));
      return;
    }

    const action = e.target.closest('[data-quiz-action]');
    if (!action) return;
    if (action.dataset.quizAction === 'submit') submitQuiz();
    if (action.dataset.quizAction === 'reset') resetQuiz();
  });

  on('btn-dismiss-remediation', 'click', dismissRemediationPanel);

  on('btn-incidents', 'click', openIncidentHistory);
  on('btn-incidents-close', 'click', closeIncidentHistory);
  on('btn-cluster-dashboard-close', 'click', closeClusterDashboard);
  document.querySelectorAll('[data-workspace-mode]').forEach(button => {
    button.addEventListener('click', () => setWorkspaceMode(button.getAttribute('data-workspace-mode')));
  });

  const navList = document.querySelector('.sidebar-scroll');
  if(navList) navList.addEventListener('click', e => {
    const item = e.target.closest('[id^="nav-"]');
    if(item) {
      const target = item.id.replace('nav-', '');
      if (target === 'cluster_fleet') {
        setWorkspaceMode('fleet', { openFleet: false });
        openClusterDashboard();
        return;
      }
      setWorkspaceMode('training', { openFleet: false });
      loadLab(target);
    }
  });

  const clusterPane = document.getElementById('cluster-dashboard-pane');
  if (clusterPane) clusterPane.addEventListener('click', e => {
    if (e.target === clusterPane) {
      closeClusterDashboard();
      return;
    }
    const submitBtn = e.target.closest('[data-cluster-submit]');
    if (submitBtn) {
      submitClusterWorkload(submitBtn.getAttribute('data-cluster-submit'));
      return;
    }
    const cancelBtn = e.target.closest('[data-cluster-cancel]');
    if (cancelBtn) {
      cancelClusterWorkload(cancelBtn.getAttribute('data-cluster-cancel'));
      return;
    }
    const injectFaultBtn = e.target.closest('[data-cluster-inject-fault]');
    if (injectFaultBtn) {
      injectClusterFault(injectFaultBtn.getAttribute('data-cluster-inject-fault'));
      return;
    }
    const clearFaultBtn = e.target.closest('[data-cluster-clear-fault]');
    if (clearFaultBtn) {
      clearClusterFault(clearFaultBtn.getAttribute('data-cluster-clear-fault'));
      return;
    }
    const clearAllFaultsBtn = e.target.closest('[data-cluster-clear-faults]');
    if (clearAllFaultsBtn) {
      clearAllClusterFaults();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape' && isClusterDashboardActive()) {
      closeClusterDashboard();
      return;
    }
    if (e.key === 'ArrowRight' && currentLab) runCurrentStep();
    if (e.key === 'ArrowLeft' && currentLab && currentStep > 0) runStep(currentLab, currentStep - 1);
  });
}

function initApp() {
  bindUIHandlers();
  if (typeof ensureClusterSimStore === 'function') ensureClusterSimStore();
  setWorkspaceMode(localStorage.getItem('gpusim_workspace_mode') || 'training', { openFleet: false });
  syncBeginnerModeUI();
  const savedBp  = localStorage.getItem('gpusim_blueprint');
  const savedFab = localStorage.getItem('gpusim_fabric');
  const bpSelect  = document.getElementById('sel-blueprint');
  const fabSelect = document.getElementById('sel-fabric');
  const defaultBlueprint = (savedBp && typeof HARDWARE_LIBRARY !== 'undefined' && HARDWARE_LIBRARY[savedBp])
    ? savedBp
    : 'H100_HGX';

  if (bpSelect) {
    bpSelect.value = defaultBlueprint;
  }
  if (fabSelect) {
    const fallbackFabric = (typeof HARDWARE_LIBRARY !== 'undefined' && bpSelect && HARDWARE_LIBRARY[bpSelect.value])
      ? HARDWARE_LIBRARY[bpSelect.value].fabricDefault
      : 'IB_NDR';
    fabSelect.value = savedFab || fallbackFabric;
  }

  isProvisioned = false;
  currentBlueprint = null;
  updateClusterSimFoundationUI();
  runInstantSentinel();
  if (!maybeShowLandingHub()) {
    const reconOverlay = document.getElementById('recon-overlay');
    if (reconOverlay) reconOverlay.style.display = 'flex';
  }
  document.body.classList.toggle('lab-active', !!currentLab);
  logTermIdleHint();
  const initialSvg = document.getElementById('diagram-canvas');
  if (initialSvg && typeof drawWelcome === 'function') drawWelcome(initialSvg);

  const _savedCompleted = localStorage.getItem('gpusim_completed');
  if (_savedCompleted) {
    try {
      completedLabs = new Set(JSON.parse(_savedCompleted));
      completedLabs.forEach(id => {
        const badge = document.getElementById('b-' + id);
        const nav   = document.getElementById('nav-' + id);
        if (badge) badge.textContent = '✓';
        if (nav)   nav.classList.add('done');
      });
      document.getElementById('h-done').textContent = completedLabs.size;
    } catch(e) { localStorage.removeItem('gpusim_completed'); }
  }
  const _savedScore = localStorage.getItem('gpusim_score');
  if (_savedScore) document.getElementById('h-score').textContent = _savedScore + '%';
  updateReasoningProgressUI();

  if (!_appInitialized) {
    _appInitialized = true;
    const cmdInput = document.getElementById('cmd-input');
    if(cmdInput) {
        cmdInput.addEventListener('keydown', e => {
          if(e.key==='Enter') {
            const cmd = e.target.value.trim();
            if(!cmd) return;
            e.target.value='';
            switchTab('term');
            if (currentLab) {
              executeLabTerminalCommand(cmd);
            } else {
              logTerm([{t:'cmd',v:'$ '+cmd}]);
              handleCustomCommand(cmd);
            }
            scrollTerminal();
          }
        });
    }
  }

  const svg = document.getElementById('diagram-canvas');
  setTimeout(()=>{
    if(svg && !isProvisioned) {
        const w=svg.clientWidth, h=svg.clientHeight;
        svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
        if(typeof drawWelcome === 'function') drawWelcome(svg);
    }
  }, 100);
  updateTerminalModeUI();
  updateTerminalInputHint();
  startClusterSimFoundationLoop();
  renderClusterDashboardView();
}

window.addEventListener('load', async ()=>{
  bindUIHandlers();
  if (isBrowserSmokeMode()) {
    hideLoginOverlay();
    initApp();
    browserSmokeWait(120).then(runBrowserSmokeScenario);
    return;
  }
  refreshLoginVersion();
  if (JWT_TOKEN) {
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { headers: authHdr() });
      if (r.ok) { hideLoginOverlay(); initApp(); return; }
    } catch(e) {
    }
  }
  showLoginOverlay();
});

window.addEventListener('resize', ()=>{
  if(currentLab) {
    const svg=document.getElementById('diagram-canvas');
    clearCanvas();
    const w=svg.clientWidth, h=svg.clientHeight;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(typeof LABS[currentLab].draw === 'function') LABS[currentLab].draw(svg, currentStep);
  }
});

function analyzeLog() {
    const rawLog = document.getElementById('log-input').value;
    switchTab('term');
    clearTerminal();

    if (!rawLog || rawLog.trim() === '') {
        logTerm([{t:'err', v:'ERROR: No log data provided. Please paste a dmesg or syslog excerpt.'}]);
        return;
    }

    logTerm([{t:'info', v:'[SYSTEM] Initiating Reverse Engineering Log Parser...'}]);

    setTimeout(() => {
        const xidMatch = rawLog.match(/Xid(?:.*?\))?:\s*(\d+)/i);
        const pcieMatch = rawLog.match(/PCI:0000:([0-9a-fA-F]{2}):/i);
        const gpuMatch = rawLog.match(/GPU\s*(\d+)/i);

        let xid = xidMatch ? xidMatch[1] : null;
        let pci = pcieMatch ? pcieMatch[1] : null;
        let gpuNum = gpuMatch ? gpuMatch[1] : null;

        if (xid) {
            logTerm([{t:'warn', v:`[PARSER] Identified XID Fault Code: ${xid}`}]);

            if (xid === '48') logTerm([{t:'err', v:`[DECODE] XID 48 = Double-Bit ECC (Uncorrectable Memory Hardware Failure).`}]);
            else if (xid === '79') logTerm([{t:'err', v:`[DECODE] XID 79 = GPU Fallen off the bus (Completely Hung).`}]);
            else if (xid === '74') logTerm([{t:'err', v:`[DECODE] XID 74 = NVLink CRC Flit Error (Cable or Switch failure).`}]);
            else logTerm([{t:'err', v:`[DECODE] Unrecognized hardware fault.`}]);

            if (beginnerMode) {
                logTerm([{t:'info', v:`[BEGINNER] ${explainParsedXid(xid)}`}]);
                logTerm([{t:'dim', v:'[BEGINNER] XID is the NVIDIA driver fault code. The parser keeps the real code visible so you learn the operator vocabulary while reading the explanation.'}]);
            }

            let failingNodeIndex = 0;
            if (gpuNum) {
                failingNodeIndex = parseInt(gpuNum);
            } else if (pci) {
                const pcieTopologyMap = {};
                for (let _n = 0; _n < 18; _n++) {
                  const bus = _n.toString(16) + '3';
                  pcieTopologyMap[bus] = _n;
                  pcieTopologyMap[bus.toUpperCase()] = _n;
                }
                if (pcieTopologyMap[pci] !== undefined) {
                    failingNodeIndex = pcieTopologyMap[pci];
                } else {
                    logTerm([{t:'warn', v:`[WARN] Unrecognized PCIe bus ${pci}. Cannot confidently map to physical node.`}]);
                }
            }

            logTerm([{t:'info', v:`[MAPPING] PCIe Address maps to physical node index: 0${failingNodeIndex + 1}`}]);
            if (beginnerMode) {
                logTerm([{t:'dim', v:'[BEGINNER] Mapping means the parser is translating a low-level bus or GPU identifier into the physical machine you would inspect or drain.'}]);
            }
            logTerm([{t:'warn', v:`[ACTION] Pushing CRITICAL fault telemetry to Rack Digital Twin...`}]);

            const svg = document.getElementById('diagram-canvas');
            clearCanvas();
            drawRackElevation(svg, { node: failingNodeIndex, xid: xid });

        } else {
            logTerm([{t:'good', v:'[PARSER] No XID hardware faults detected in the provided log block.'}]);
        }
    }, 800);
}

async function toggleAppMode(forcedState) {
    const isLive = forcedState !== undefined ? forcedState : document.getElementById('toggle-live').checked;
    ['toggle-live', 'sidebar-toggle-live', 'quiz-toggle-live'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = isLive;
    });
    appMode = isLive ? 'live' : 'simulation';

    if (isLive) {
        switchTab('term');
        logTerm([{t:'warn', v:'[SYSTEM] Switching to Live Telemetry Mode. Attempting to connect to the secured Aegis-GPU API...'}]);

        document.querySelectorAll('.nav-item').forEach(el => el.style.opacity = '0.3');
        document.getElementById('scen-title').textContent = 'LIVE DATACENTER VIEW';
        document.getElementById('scen-desc').textContent = 'Establishing secure API connection...';
        document.getElementById('step-controls').innerHTML = '';
        if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }

        try {
            const response = await fetch(`${API_BASE}/status`, { headers: authHdr() });
            if (response.status === 401) { handle401(); return; }
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();

            if(data.status === 'online') {
                setBackendLLMCapability(data.active_llm, data.llm_available);
                logTerm([{t:'good', v:`[NETWORK] SUCCESS! Handshake complete.`}]);
                logTerm([{t:'info', v:`[DAEMON] Aegis-GPU daemon active.`}]);
                logTerm([{t:'dim', v:data.llm_available ? `[DIAGNOSIS MODE] ${data.active_llm} available. Users may opt in to LLM-backed diagnosis.` : '[DIAGNOSIS MODE] Deterministic runbooks only. LLM diagnosis is currently unavailable.'}]);
                document.getElementById('scen-desc').textContent = 'Connected. Waiting for live telemetry...';

                liveInterval = setInterval(fetchLiveMetrics, 3000);
                fetchLiveMetrics();
            }
        } catch (err) {
            logTerm([{t:'err', v:`[NETWORK] Connection refused: Make sure the Aegis-GPU API is running. Error: ${err.message}`}]);
        }

    } else {
        logTerm([{t:'info', v:'[SYSTEM] Connection severed. Reverting to Student Simulation Mode.'}]);
        document.querySelectorAll('.nav-item').forEach(el => el.style.opacity = '1');
        setLiveExplainerIdle('Live Telemetry is off. Turn it on to see beginner explanations of evidence quality, telemetry scope, and diagnosis trust level.');
        resetAll();
        if(liveInterval) clearInterval(liveInterval);
    }
}

function toggleThermalView(forcedState) {
    const isThermal = forcedState !== undefined ? forcedState : document.getElementById('toggle-thermal').checked;
    thermalMode = isThermal;
    ['toggle-thermal', 'sidebar-toggle-thermal', 'quiz-toggle-thermal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = isThermal;
    });
    const svg = document.getElementById('diagram-canvas');
    if (!svg) return;
    clearCanvas();
    const w = svg.clientWidth, h = svg.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    if (currentLab && LABS[currentLab] && typeof LABS[currentLab].draw === 'function') {
        LABS[currentLab].draw(svg, currentStep);
    } else if (isProvisioned && typeof drawRackElevation === 'function') {
        drawRackElevation(svg, null, thermalMode);
    }
}

async function fetchLiveMetrics() {
    try {
        const res = await fetch(`${API_BASE}/hardware/metrics`, { headers: authHdr() });
        if (res.status === 401) { handle401(); return; }
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        const liveData = await res.json();
        lastLiveTelemetry = liveData;
        const source = liveData.source || 'unknown-source';
        const modeMsg = liveData.degraded
            ? `Connected in degraded mode (${source}). Displaying best-effort host telemetry.`
            : `Connected. Streaming live hardware telemetry from ${source}.`;
        document.getElementById('scen-desc').textContent = modeMsg;

        logTerm([{t:'dim', v:`[POLL] ${source} -> Temp: ${liveData.temp}°C | Pwr: ${liveData.power}W | Util: ${liveData.util}% | VRAM: ${liveData.vram_used}/${liveData.vram_total}GB`}]);
        scrollTerminal();

        setMetric('m-util', liveData.util + '%', liveData.degraded ? 'warn' : 'ok');
        setMetric('m-vram', liveData.vram_total ? `${liveData.vram_used}/${liveData.vram_total}GB` : 'n/a', liveData.vram_total ? 'ok' : 'warn');
        setMetric('m-temp', liveData.temp + '°C', liveData.temp > 80 ? 'warn' : 'ok');
        setMetric('m-power', liveData.power + 'W', liveData.power > 0 ? 'ok' : 'warn');
        setMetric('m-xid', (liveData.active_faults && liveData.active_faults.length) ? 'active' : 'none', (liveData.active_faults && liveData.active_faults.length) ? 'err' : 'dim');

        setBar('mb-util', liveData.util, liveData.degraded ? 'var(--yellow)' : 'var(--green)');
        setBar('mb-vram', liveData.vram_total ? (liveData.vram_used / liveData.vram_total) * 100 : 0, 'var(--blue)');
        setBar('mb-temp', (liveData.temp / 100) * 100, liveData.temp > 80 ? 'var(--yellow)' : 'var(--blue)');
        setBar('mb-power', liveData.power > 0 ? (liveData.power / 700) * 100 : 0, 'var(--copper)');
        renderBeginnerTelemetryExplanation(liveData);

    } catch (e) {
        setLiveExplainerIdle('Live telemetry polling failed, so the beginner explainer cannot interpret the current hardware state.');
        logTerm([{t:'err', v:`[POLLING ERROR] ${e.message}`}]);
        scrollTerminal();
    }
}

async function requestAI_Remediation(xid, nodeIndex = 6) {
    if (appMode !== 'live') {
        logTerm([{t:'err', v:'[SYSTEM] Please switch to Live Telemetry Mode to use the AIOps Engine.'}]);
        return;
    }
    currentFaultNode = nodeIndex;

    const svg = document.getElementById('diagram-canvas');
    if (svg) {
        clearCanvas();
        drawRackElevation(svg, {node: nodeIndex, xid: xid}, thermalMode);
    }

    logTerm([{t:'warn', v:`[AIOps] Intercepted fault XID ${xid} on Node 0${nodeIndex + 1}. Consulting Knowledge Base...`}]);
    scrollTerminal();

    try {
        const res = await fetch(`${API_BASE}/diagnose/${xid}`, {
            method: 'POST',
            headers: { ...authHdr(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ allow_llm: llmDiagnosisEnabled && backendLLMAvailable })
        });
        if (res.status === 401) { handle401(); return; }
        const data = await res.json();

        if (data.error) {
          logTerm([{t:"err", v:`[AIOps REJECTED] ${data.error}`}]);
          scrollTerminal();
        } else if (data.remediation_plan) {
            logTerm([{t:'info', v:`[DIAGNOSIS] Source: ${data.diagnosis_source}`}]);
            logTerm([{t:'good', v:`[REMEDIATION PLAN] ${data.remediation_plan}`}]);
            logTerm([{t:'dim',  v:`[AUDIT] ${data.hallucination_check}`}]);
            scrollTerminal();

            captureStaticDiagnosis(data);
            renderRunbookButton(xid);
        }
    } catch(e) {
        logTerm([{t:'err', v:`[AIOps ERROR] Backend unreachable: ${e.message}`}]);
    }
}

async function executeRunbook(xid) {
    logTerm([{t:"warn", v:`[EXECUTION] Calling Backend Remediation Engine for XID ${xid}...`}]);
    try {
        const res = await fetch(`${API_BASE}/remediate/${xid}`, {
            method: "POST",
            headers: { ...authHdr(), "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: currentFaultNode })
        });
        if (res.status === 401) { handle401(); return; }
        const data = await res.json();
        if (!res.ok) {
            logTerm([{t:"err", v:`[FAILURE] ${data.detail || data.message || `HTTP ${res.status}`}`}]);
            return;
        }

        if(data.status === "success") {
            logTerm([{t:"good", v:`[SUCCESS] ${data.message}`}]);
            logTerm([{t:"dim", v:`[LOG] ${data.log}`}]);
            document.getElementById("step-controls").innerHTML = "";
            const svg = document.getElementById("diagram-canvas");
            if (svg) { clearCanvas(); drawRackElevation(svg, null, thermalMode); }
            showRemediationPanel(data.message, data.log, "success");
        } else if (data.status === "manual_required") {
            logTerm([{t:"warn", v:`[MANUAL] ${data.message}`}]);
            logTerm([{t:"dim", v:`[RUNBOOK] ${data.log}`}]);
            showRemediationPanel(data.message, data.log, "manual_required");
        } else {
            logTerm([{t:"err", v:`[FAILURE] ${data.message || 'Unknown remediation failure.'}`}]);
        }
    } catch (err) {
        logTerm([{t:"err", v:`[FAILURE] ${err.message}`}]);
    }
}

function showRemediationPanel(message, log, status = "success") {
    const panel = document.getElementById("remediation-status-panel");
    if (!panel) return;
    const titleEl = document.getElementById("remediation-status-title");
    const configs = {
        success: { icon: "✓", label: "AUTONOMOUS RUNBOOK — SUCCESS", color: "#00e676", border: "3px solid #00e676", bg: "#071f0f" },
        manual_required: { icon: "⚠", label: "MANUAL ACTION REQUIRED", color: "#f4a261", border: "3px solid #f4a261", bg: "#1a1000" },
        error: { icon: "✗", label: "REMEDIATION FAILED", color: "#ff5252", border: "3px solid #ff5252", bg: "#1a0000" },
    };
    const cfg = configs[status] || configs.success;
    if (titleEl) {
        titleEl.textContent = cfg.icon + " " + cfg.label;
        titleEl.style.color = cfg.color;
    }
    panel.style.borderTop = cfg.border;
    panel.style.background = cfg.bg;
    document.getElementById("remediation-msg").textContent = message || "";
    document.getElementById("remediation-log").textContent = log || "";
    panel.style.display = "flex";
}

function dismissRemediationPanel() {
    const panel = document.getElementById("remediation-status-panel");
    if (panel) panel.style.display = "none";
}

function toggleAIDoc() {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || !btn) return;

    if (overlay.style.display === "none" || overlay.style.display === "") {
        overlay.style.display = "block";
        btn.innerHTML = "\u274c CLOSE DIAGNOSIS";
        btn.style.background = "#ff4c4c";
        btn.style.color = "#fff";
    } else {
        overlay.style.display = "none";
        btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
        btn.style.background = "#f4a261";
        btn.style.color = "#000";
    }
}

function captureStaticDiagnosis(data) {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || !btn) return;

    if (data.remediation_plan) {
        const beginnerExplain = renderDiagnosisExplanation(data);
        overlay.innerHTML = `
          <div class="diag-block">
            <div class="diag-title">Fault</div>
            <p>${escHtml(data.fault || 'Unknown fault')}</p>
          </div>
          <div class="diag-block">
            <div class="diag-title">Diagnosis Source</div>
            <p>${escHtml(data.diagnosis_source || 'unknown')}</p>
          </div>
          ${beginnerExplain}
          <div class="diag-block">
            <div class="diag-title">Remediation Plan</div>
            ${data.remediation_plan.split('\n').filter(Boolean).map(line => `<p>${escHtml(line)}</p>`).join('')}
          </div>
          <div class="diag-block">
            <div class="diag-title">Honesty Check</div>
            <p>${escHtml(data.hallucination_check || 'No explanation provided.')}</p>
          </div>
        `;

        overlay.style.display = "none";
        btn.style.display = "inline-block";
        btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
        btn.style.background = "#f4a261";
        btn.style.color = "#000";

        logTerm([{t:"good", v:"[AIOps] Full diagnosis captured. Click the button above to read the remediation plan."}]);
        scrollTerminal();
    }
}

async function openIncidentHistory() {
  const overlay = document.getElementById('incident-overlay');
  const body    = document.getElementById('incident-body');
  if (!overlay || !body) return;
  setIncidentBodyMessage(body, 'Loading…');
  overlay.style.display = 'flex';
  try {
    const r = await fetch(`${API_BASE}/incidents?limit=50`, { headers: authHdr() });
    if (r.status === 401) { handle401(); return; }
    if (!r.ok) { setIncidentBodyMessage(body, 'Failed to load incidents.', 'var(--red)'); return; }
    const rows = await r.json();
    if (!rows.length) {
      setIncidentBodyMessage(body, 'No incidents recorded yet.');
      return;
    }
    renderIncidentHistory(body, rows);
  } catch(e) {
    setIncidentBodyMessage(body, `Error: ${e.message}`, 'var(--red)');
  }
}

function closeIncidentHistory() {
  const overlay = document.getElementById('incident-overlay');
  if (overlay) overlay.style.display = 'none';
}

document.addEventListener("click", function(e) {
    const overlay = document.getElementById("ai-static-overlay");
    const btn = document.getElementById("toggle-ai-btn");
    if (!overlay || overlay.style.display === "none") return;
    if (!overlay.contains(e.target) && e.target !== btn) {
        overlay.style.display = "none";
        if (btn) {
            btn.innerHTML = "\ud83d\udcc2 VIEW FULL AI DIAGNOSIS";
            btn.style.background = "#f4a261";
            btn.style.color = "#000";
        }
    }
});
