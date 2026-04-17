/**
 * APP MODULE: Main Controller
 * Handles State, Modals, Lab Lifecycles, and Incident Parser.
 */

// --- GLOBAL STATE ---
let currentLab = null;
let currentStep = 0;
let completedLabs = new Set();
let activeTab = 'term';
let termLines = { term:[], dmesg:[], dcgm:[] };

let isProvisioned = false;
let currentBlueprint = null;
const API_BASE = window.__AEGIS_API_BASE__ || `${window.location.origin}/api/v1`;
// Sprint 16: JWT-based authentication — token fetched at login, never hard-coded.
let JWT_TOKEN = sessionStorage.getItem('aegis_jwt') || '';
let _appInitialized = false;
let USER_ROLE  = sessionStorage.getItem('aegis_role') || '';
let currentFaultNode = 0;
let _uiHandlersBound = false;
let lastLiveTelemetry = null;
let beginnerMode = localStorage.getItem('gpusim_beginner_mode');
beginnerMode = beginnerMode === null ? true : beginnerMode === 'true';

function authHdr() {
  return JWT_TOKEN ? { 'Authorization': 'Bearer ' + JWT_TOKEN } : {};
}

function showLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'flex';
}
function hideLoginOverlay() {
  const el = document.getElementById('login-overlay');
  if (el) el.style.display = 'none';
}

async function aegisLogin() {
  const u = (document.getElementById('login-user') || {}).value?.trim() || '';
  const p = (document.getElementById('login-pass') || {}).value || '';
  const errEl = document.getElementById('login-err');
  if (errEl) errEl.style.display = 'none';
  try {
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await r.json();
    if (!r.ok) {
      if (errEl) { errEl.textContent = data.detail || 'Login failed.'; errEl.style.display = 'block'; }
      return;
    }
    JWT_TOKEN = data.token;
    USER_ROLE  = data.role;
    sessionStorage.setItem('aegis_jwt', JWT_TOKEN);
    sessionStorage.setItem('aegis_role', USER_ROLE);
    hideLoginOverlay();
    initApp();
  } catch(e) {
    if (errEl) { errEl.textContent = 'Connection error. Is the backend reachable?'; errEl.style.display = 'block'; }
  }
}

function aegisLogout() {
  JWT_TOKEN = '';
  USER_ROLE  = '';
  sessionStorage.removeItem('aegis_jwt');
  sessionStorage.removeItem('aegis_role');
  if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
  appMode = 'simulation';
  ['toggle-live','sidebar-toggle-live','quiz-toggle-live'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  showLoginOverlay();
}

function handle401() {
  logTerm([{t:'err', v:'[AUTH] Session expired or unauthorised. Please log in again.'}]);
  setTimeout(aegisLogout, 1500);
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getLearningGuide(id) {
  const guides = window.AEGIS_LEARNING || {};
  return guides[id] || null;
}

function syncBeginnerModeUI() {
  const toggle = document.getElementById('toggle-beginner');
  if (toggle) toggle.checked = beginnerMode;
  const learnBtn = document.getElementById('btn-learn');
  if (learnBtn) learnBtn.textContent = beginnerMode ? '📘 Learning Guide' : '📘 Lab Brief';
}

function setBeginnerMode(enabled) {
  beginnerMode = !!enabled;
  localStorage.setItem('gpusim_beginner_mode', beginnerMode ? 'true' : 'false');
  syncBeginnerModeUI();
  if (currentLab && document.getElementById('intro-overlay')?.classList.contains('show')) showIntro(currentLab);
  if (appMode === 'live') renderBeginnerTelemetryExplanation(lastLiveTelemetry);
}

function renderBulletList(items, cssClass) {
  if (!items || !items.length) return '';
  return `<ul class="${cssClass}">${items.map(item => `<li>${escHtml(item)}</li>`).join('')}</ul>`;
}

function renderGuidedStepDetails(step, prevStep) {
  if (!step) return '';

  const deeperContext = beginnerMode && step.deeperContext
    ? `<div class="guided-step-block guided-step-context"><div class="guided-step-title">Why This Stage Matters</div><p>${escHtml(step.deeperContext)}</p></div>`
    : '';
  const comparisonItems = [];
  if (beginnerMode && step.changedFromPrevious) {
    const prevLabel = prevStep ? ` compared with ${prevStep.label}` : '';
    comparisonItems.push(`<li><strong>What changed${escHtml(prevLabel)}</strong>: ${escHtml(step.changedFromPrevious)}</li>`);
  }
  if (beginnerMode && step.justifiedConclusion) {
    comparisonItems.push(`<li><strong>Conclusion you can justify now</strong>: ${escHtml(step.justifiedConclusion)}</li>`);
  }
  if (beginnerMode && step.stillPremature) {
    comparisonItems.push(`<li><strong>What is still too early to conclude</strong>: ${escHtml(step.stillPremature)}</li>`);
  }
  if (beginnerMode && step.thresholdCrossed) {
    comparisonItems.push(`<li><strong>Threshold crossed</strong>: ${escHtml(step.thresholdCrossed)}</li>`);
  }
  const comparativeReasoning = comparisonItems.length
    ? `<div class="guided-step-block guided-step-compare"><div class="guided-step-title">Reasoning Check</div><ul class="guided-step-list">${comparisonItems.join('')}</ul></div>`
    : '';
  const lookFor = step.lookFor && step.lookFor.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Look For</div>${renderBulletList(step.lookFor, 'guided-step-list')}</div>`
    : '';
  const meaning = step.meaning
    ? `<div class="guided-step-block"><div class="guided-step-title">What It Means</div><p>${escHtml(step.meaning)}</p></div>`
    : '';
  const action = step.takeAction && step.takeAction.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Do This</div>${renderBulletList(step.takeAction, 'guided-step-list')}</div>`
    : '';
  const avoid = step.avoid && step.avoid.length
    ? `<div class="guided-step-block"><div class="guided-step-title">Avoid This</div>${renderBulletList(step.avoid, 'guided-step-list')}</div>`
    : '';

  return [deeperContext, comparativeReasoning, lookFor, meaning, action, avoid].filter(Boolean).join('');
}

function renderGuidedFlowSteps(lab) {
  return `
    <div class="guided-steps">
      ${lab.steps.map((s, i) => {
        const prevStep = i > 0 ? lab.steps[i - 1] : null;
        return `
        <article class="guided-step-card${s.fault ? ' guided-step-card-fault' : ''}">
          <div class="guided-step-top">
            <div class="step-num">${i + 1}</div>
            <div class="guided-step-header">
              <div class="guided-step-label">${escHtml(s.label)}</div>
              <div class="step-hint">${escHtml(s.cmd).slice(0, 100)}</div>
            </div>
          </div>
          ${renderGuidedStepDetails(s, prevStep)}
        </article>
      `;
      }).join('')}
    </div>
  `;
}

function renderLearningGuide(id) {
  const guide = getLearningGuide(id);
  if (!guide) return '';

  const sections = [];
  sections.push(`
    <section class="learn-section learn-callout">
      <h4>Quick Answer</h4>
      <p>${escHtml(guide.quickAnswer || '')}</p>
    </section>
  `);

  if (beginnerMode && guide.whyItMatters) {
    sections.push(`
      <section class="learn-section">
        <h4>Why This Matters</h4>
        <p>${escHtml(guide.whyItMatters)}</p>
      </section>
    `);
  }

  if (guide.coreTerms && guide.coreTerms.length) {
    sections.push(`
      <section class="learn-section">
        <div class="learn-heading-row">
          <h4>Key Terms</h4>
          <span class="learn-mode-tag">${beginnerMode ? 'Annotated jargon' : 'Core vocabulary'}</span>
        </div>
        <div class="term-grid">
          ${guide.coreTerms.map(term => `
            <article class="term-card">
              <div class="term-name">${escHtml(term.term)}</div>
              <p>${escHtml(term.plain)}</p>
              ${beginnerMode && term.why ? `<div class="term-why">Why it matters: ${escHtml(term.why)}</div>` : ''}
            </article>
          `).join('')}
        </div>
      </section>
    `);
  }

  if (beginnerMode && guide.lifecycle && guide.lifecycle.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Lifecycle</h4>
        <ol class="learn-timeline">
          ${guide.lifecycle.map(step => `
            <li>
              <div class="timeline-title">${escHtml(step.title)}</div>
              <div class="timeline-body">${escHtml(step.detail)}</div>
            </li>
          `).join('')}
        </ol>
      </section>
    `);
  }

  if (beginnerMode && guide.watchFor && guide.watchFor.length) {
    sections.push(`
      <section class="learn-section">
        <h4>What To Watch</h4>
        ${renderBulletList(guide.watchFor, 'learn-list')}
      </section>
    `);
  }

  if (guide.safeActions && guide.safeActions.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Safe Beginner Actions</h4>
        ${renderBulletList(guide.safeActions, 'learn-list')}
      </section>
    `);
  }

  if (beginnerMode && guide.whatNotToDo && guide.whatNotToDo.length) {
    sections.push(`
      <section class="learn-section">
        <h4>What Not To Do</h4>
        ${renderBulletList(guide.whatNotToDo, 'learn-list')}
      </section>
    `);
  }

  if (beginnerMode && guide.escalateWhen && guide.escalateWhen.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Escalate When</h4>
        ${renderBulletList(guide.escalateWhen, 'learn-list')}
      </section>
    `);
  }

  if (beginnerMode && guide.readMore && guide.readMore.length) {
    sections.push(`
      <section class="learn-section">
        <h4>Read This Slowly</h4>
        ${guide.readMore.map(item => `<p>${escHtml(item)}</p>`).join('')}
      </section>
    `);
  }

  return sections.join('');
}

function describeCollectionError(code) {
  const messages = {
    dcgm_unavailable: 'DCGM is unavailable, so advanced GPU health counters and deeper fleet metrics are missing.',
    nvidia_smi_unavailable: 'nvidia-smi is unavailable or returned unusable data, so direct GPU telemetry could not be collected.',
    nvlink_status_unavailable: 'NVLink status could not be collected, so link-health conclusions are limited.',
  };
  return messages[code] || `${code} means one expected evidence source could not be collected.`;
}

function describeGroundingStatus(status) {
  const messages = {
    grounded: 'Grounded means the diagnosis is strongly backed by live evidence collected from the node.',
    partial: 'Partial grounding means some evidence was collected, but important sources were still missing.',
    kb_only: 'Knowledge-base only means the system is explaining the fault from trusted runbooks and fault references, not from live node evidence.',
  };
  return messages[status] || 'Grounding status explains how much of the diagnosis is backed by live machine evidence.';
}

function renderBeginnerTelemetryExplanation(liveData) {
  const body = document.getElementById('live-explainer-body');
  if (!body) return;

  if (!liveData) {
    body.innerHTML = '<p>Turn on Live Telemetry to see a beginner-friendly explanation of the current hardware state and evidence quality.</p>';
    return;
  }

  if (!beginnerMode) {
    const source = escHtml(liveData.source || 'unknown-source');
    const quality = liveData.degraded ? 'best-effort' : 'direct';
    body.innerHTML = `<p><strong>Compact view:</strong> this telemetry is coming from <strong>${source}</strong> using a <strong>${quality}</strong> evidence path. Turn on Beginner Mode for deeper explanations of telemetry scope, missing evidence, and diagnosis trust.</p>`;
    return;
  }

  const scopeText = liveData.telemetry_scope === 'host'
    ? 'Telemetry scope is <strong>host</strong>, which means the backend is reading machine-level fallback data instead of direct GPU counters.'
    : `Telemetry scope is <strong>${escHtml(liveData.telemetry_scope || 'unknown')}</strong>, which means the backend has more direct hardware visibility.`;

  const sourceText = (liveData.telemetry_sources && liveData.telemetry_sources.length)
    ? `Sources in use: ${liveData.telemetry_sources.map(escHtml).join(', ')}.`
    : 'No telemetry source list was provided.';

  const degradedText = liveData.degraded
    ? `<p><strong>Degraded mode</strong> means the system is still showing you useful signals, but the best hardware evidence was not available. ${escHtml(liveData.degraded_reason || '')}</p>`
    : '<p><strong>Healthy evidence path</strong> means the backend is collecting its preferred hardware telemetry sources.</p>';

  const collectionErrors = (liveData.collection_errors || []).map(code => `<li><strong>${escHtml(code)}</strong>: ${escHtml(describeCollectionError(code))}</li>`).join('');
  const fabricSummary = liveData.fabric_summary
    ? `<li><strong>fabric_summary</strong>: NVLink is ${escHtml(liveData.fabric_summary.nvlink || 'unknown')}, DCGM is ${escHtml(liveData.fabric_summary.dcgm || 'unknown')}.</li>`
    : '';
  const perGpu = Array.isArray(liveData.per_gpu) && liveData.per_gpu.length
    ? `<li><strong>per_gpu</strong>: ${liveData.per_gpu.length} GPU-specific snapshots are available.</li>`
    : '<li><strong>per_gpu</strong>: no per-GPU snapshots were collected.</li>';

  body.innerHTML = `
    <p>${scopeText}</p>
    ${degradedText}
    <p><strong>telemetry_sources</strong> is the system's way of telling you where the numbers came from. ${sourceText}</p>
    <ul class="live-explainer-list">
      ${fabricSummary}
      ${perGpu}
    </ul>
    ${collectionErrors ? `<div class="live-explainer-block"><div class="live-explainer-title">Missing evidence sources</div><ul class="live-explainer-list">${collectionErrors}</ul></div>` : ''}
  `;
}

function renderDiagnosisExplanation(data) {
  if (!beginnerMode) return '';

  const grounding = describeGroundingStatus(data.grounding_status);
  const grounded = (data.grounded_sources || []).length
    ? `<li><strong>grounded_sources</strong>: ${data.grounded_sources.map(escHtml).join(', ')}</li>`
    : '<li><strong>grounded_sources</strong>: none were collected for this diagnosis.</li>';
  const unavailable = (data.unavailable_sources || []).length
    ? `<li><strong>unavailable_sources</strong>: ${data.unavailable_sources.map(escHtml).join(', ')}</li>`
    : '<li><strong>unavailable_sources</strong>: none were reported.</li>';

  return `
    <div class="diag-block">
      <div class="diag-title">Beginner Explanation</div>
      <p><strong>diagnosis_source</strong> tells you where the explanation came from. Here it is <strong>${escHtml(data.diagnosis_source || 'unknown')}</strong>.</p>
      <p><strong>grounding_status</strong> is <strong>${escHtml(data.grounding_status || 'unknown')}</strong>. ${escHtml(grounding)}</p>
      <ul class="diag-list">
        ${grounded}
        ${unavailable}
      </ul>
      <p><strong>hallucination_check</strong> is the system's honesty note about whether the diagnosis had live evidence or relied on runbooks.</p>
    </div>
  `;
}

function setLiveExplainerIdle(message) {
  const body = document.getElementById('live-explainer-body');
  if (!body) return;
  body.innerHTML = `<p>${escHtml(message)}</p>`;
}

function describeIncidentKind(kind) {
  const messages = {
    diagnose: 'A diagnose entry means the system analyzed a fault and produced a remediation recommendation.',
    remediate: 'A remediate entry means the system tried to act on a runbook or recovery workflow.',
  };
  return messages[kind] || 'This incident entry records one step in the fault response workflow.';
}

function explainParsedXid(xid) {
  const messages = {
    '48': 'XID 48 usually points to an uncorrectable ECC memory event, which is a hardware-integrity problem rather than just a performance warning.',
    '74': 'XID 74 usually points to NVLink link trouble such as CRC errors, which means GPU-to-GPU communication may be degraded.',
    '79': 'XID 79 usually means the GPU became unreachable on the bus, which is a severe stability failure and often requires reset or reboot.',
  };
  return messages[xid] || 'The parser found a known NVIDIA fault code, but this code does not yet have a beginner-specific explanation in the UI.';
}


let metrics = {
  util:82, vram_used:54, vram_total:80, temp:71, power:420,
  sbe:0, dbe:0, xid:'none',
  ib:'Active', nccl:'IB', ar:'180 GB/s',
  sutil:24, srw:890
};

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
    // Sprint 13: Persist blueprint choice so page refresh restores provisioning
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
  clearCanvas();
  clearTerminal();
  currentLab = id;
  currentStep = -1;

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
    btn.onclick = () => runStep(id, i);
    sc.appendChild(btn);
  });

  termLines.dmesg = typeof DMESG_CLEAN !== 'undefined' ? DMESG_CLEAN : [];
  termLines.dcgm  = typeof DCGM_CLEAN !== 'undefined' ? DCGM_CLEAN : [];
  if(activeTab==='dmesg') renderTab('dmesg');
  if(activeTab==='dcgm')  renderTab('dcgm');

  showIntro(id);

  const svg = document.getElementById('diagram-canvas');
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  if(lab.draw) lab.draw(svg, -1);
}

function runStep(labId, stepIdx) {
  if(currentLab !== labId) return;
  currentStep = stepIdx;
  const lab = LABS[labId];
  const step = lab.steps[stepIdx];

  document.querySelectorAll('.step-btn').forEach((btn,i) => {
    btn.classList.toggle('active', i===stepIdx);
  });

  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Step ${stepIdx+1}/${lab.steps.length}`;
  document.getElementById('scen-desc').textContent = step.label;

  switchTab('term');
  clearTerminal();
  logTerm([{t:'prompt',v:`[gpu-node-01] `},{t:'cmd',v:step.cmd}]);

  const out = (typeof TERMINAL_OUTPUT !== 'undefined' && TERMINAL_OUTPUT[step.type]) ? TERMINAL_OUTPUT[step.type] : [{t:'dim',v:'# (output executed)'}];
  let delay = 300;
  out.forEach((line,i) => {
    setTimeout(()=>{
      logTerm([line]);
      scrollTerminal();
    }, delay + i*60);
  });

  const svg = document.getElementById('diagram-canvas');
  clearCanvas();
  const w = svg.clientWidth, h = svg.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  setTimeout(()=> { if(lab.draw) lab.draw(svg, stepIdx); }, 100);

  updateMetrics(labId, stepIdx, step);
  addXIDLog(labId, stepIdx, step);

  // Sprint 18: Surface AIOps Engine for fault steps
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
    completedLabs.add(labId);
    localStorage.setItem('gpusim_completed', JSON.stringify([...completedLabs]));
    document.getElementById('b-'+labId).textContent = '✓';
    document.getElementById('nav-'+labId).classList.add('done');
    document.getElementById('h-done').textContent = completedLabs.size;
    setTimeout(()=>logTerm([{t:'good',v:`\n✓ Lab complete: ${lab.name}`}]), out.length*60+500);
  }
}

function runCurrentStep() {
  if(!currentLab) return;
  const lab = LABS[currentLab];
  const next = currentStep+1;
  if(next < lab.steps.length) runStep(currentLab, next);
}

function updateMetrics(labId, step, stepDef) {
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

function scrollTerminal() {
  const out = document.getElementById('terminal-output');
  out.scrollTop = out.scrollHeight;
}

function switchTab(tab) {
  activeTab = tab;
  
  // 1. Highlight the active tab
  ['term','dmesg','dcgm','parser'].forEach(t => {
    const el = document.getElementById('tab-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });
  
  const out = document.getElementById('terminal-output');
  const parserUi = document.getElementById('parser-ui');
  const inputRow = document.getElementById('terminal-input-row');
  
  // 2. Toggle UI Visibility
  if (tab === 'parser') {
      if(out) out.style.display = 'none';
      if(inputRow) inputRow.style.display = 'none';
      if(parserUi) parserUi.style.display = 'flex';
  } else {
      if(out) out.style.display = 'block';
      if(inputRow) inputRow.style.display = 'flex';
      if(parserUi) parserUi.style.display = 'none';
      
      // 3. Render standard logs if not the parser
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

function handleCustomCommand(cmd) {
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
    logTerm([{t:'dim',v:'# Tip: use the step buttons above for guided lab output'}]);
  }
}

function showIntro(id) {
  const lab = LABS[id];
  const guide = getLearningGuide(id);
  const el = document.getElementById('intro-content');
  if (!lab || !el) return;

  const guideMarkup = renderLearningGuide(id);
  const modeNote = beginnerMode
    ? '<div class="learn-banner"><div class="learn-banner-title">Beginner Mode is on</div><p>Real operator jargon stays visible, but each term is explained in plain language so you build vocabulary while you learn.</p></div>'
    : '<div class="learn-banner learn-banner-compact"><div class="learn-banner-title">Compact lab brief</div><p>Turn on Beginner Mode for deeper explanations, lifecycle context, and slower reading material.</p></div>';

  el.innerHTML = `
    <h2>${lab.icon} ${lab.name}</h2>
    ${modeNote}
    <div class="objective">
      <h4>Objective</h4>
      <p>${escHtml(lab.objective)}</p>
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
}

function closeIntro() {
  document.getElementById('intro-overlay').classList.remove('show');
}

function startLab() {
  closeIntro();
  if(currentLab) runStep(currentLab, 0);
}

// --- QUIZ DATA (Sprint 13: expanded to 20 questions, mapped to NCA-AIIO objectives) ---
const QUIZ = [
  // XID & ECC — NCA-AIIO: Hardware Fault Response
  {q:"dmesg shows 'NVRM: Xid (PCI:0000:83:00): 48'. What does XID 48 indicate and what is the first action?",
   opts:["NVLink CRC error — swap the NVLink cable","Double-Bit ECC uncorrectable error — drain the node and open an RMA","GPU fallen off the bus — reset the driver","Thermal throttle — reduce workload"],
   ans:1,exp:"XID 48 = Double-Bit ECC (DBE). A DBE is a hardware memory failure that cannot be corrected. The node must be drained immediately and an RMA opened with NVIDIA."},

  {q:"dcgmi dmon -e 157 shows value 1 on GPU 3 after 3 consecutive polls. What is your immediate action?",
   opts:["Wait for more polls to confirm","Drain the node, notify job owner, open NVIDIA RMA","Restart the NVIDIA driver","Reduce GPU power limit"],
   ans:1,exp:"Field 157 = DCGM_FI_DEV_ECC_DBE_VOL_TOTAL. Any non-zero volatile DBE count means an uncorrectable hardware error. Drain and RMA immediately."},

  {q:"dmesg reports 'GPU Board RmUninitializeClient: GPU-0000:43:00 has fallen off the bus'. Which XID code corresponds to this event?",
   opts:["XID 48","XID 74","XID 79","XID 13"],
   ans:2,exp:"XID 79 = GPU fallen off the bus (completely hung). First recovery step is 'nvidia-smi --gpu-reset -i <id>'. If that fails, a hard node reboot is required."},

  {q:"You run 'nvidia-smi --gpu-reset -i 3' after an XID 79 event and it fails with 'GPU is still in use'. What is the correct next step?",
   opts:["Kill all processes using the GPU, then retry the reset","Reboot the node — a failed reset after XID 79 requires a hard restart","Reduce the GPU power limit","Update the NVIDIA driver"],
   ans:1,exp:"If nvidia-smi --gpu-reset fails because processes are still attached, the node must be hard rebooted. A GPU that has fallen off the bus cannot be safely recovered without a full reboot."},

  {q:"nvidia-smi nvlink -e shows 'CRC Flit Error Count: 8472' on Link 2. Which XID and root cause does this represent?",
   opts:["XID 48 — memory hardware failure","XID 79 — GPU hang","XID 74 — NVLink CRC Flit error (cable or NVSwitch port fault)","XID 13 — graphics engine exception"],
   ans:2,exp:"XID 74 = NVLink CRC Flit Error. Indicates a signal integrity problem on the NVLink connection — faulty cable, connector, or NVSwitch port. Isolate the link and inspect physically."},

  // Thermal Throttling — NCA-AIIO: Thermal Management
  {q:"'nvidia-smi dmon -s p' shows GPU temp at 87C and SM utilization dropping from 94% to 40% intermittently. What is the most likely cause?",
   opts:["Insufficient VRAM causing page faults","GPU thermal throttling exceeding temperature threshold","NCCL TCP fallback reducing throughput","Lustre storage bottleneck"],
   ans:1,exp:"H100 GPUs begin thermal throttling around 83-87C, reducing clock speeds. The sawtooth SM utilization pattern is the classic signature. Check cooling, airflow, and power delivery."},

  {q:"A GPU consistently hits 88C. dcgmi shows no ECC errors. nvidia-smi -q -d PERFORMANCE shows 'HW Thermal SlowDown'. What is the correct escalation path?",
   opts:["Open an RMA immediately","Drain the node, inspect airflow and heatsink contact, then lower power cap with nvidia-smi -pl","Reinstall the NVIDIA driver","Increase batch size to reduce per-sample overhead"],
   ans:1,exp:"Thermal throttling is a cooling/infrastructure problem, not a software one. Drain to protect jobs, physically inspect airflow, and set a power cap ('nvidia-smi -pl <watts>') as a temporary mitigation."},

  {q:"Which DCGM field ID should you monitor to detect Single-Bit ECC errors (SBE) before they escalate to uncorrectable DBEs?",
   opts:["Field 100 (GPU utilization)","Field 156 (DCGM_FI_DEV_ECC_SBE_VOL_TOTAL)","Field 157 (DCGM_FI_DEV_ECC_DBE_VOL_TOTAL)","Field 203 (SM clock)"],
   ans:1,exp:"Field 156 = SBE volatile total. A rising SBE trend is a leading indicator of memory degradation. Alert on SBE trend (e.g. >50 SBEs) and schedule proactive maintenance before a DBE occurs."},

  // NCCL & Networking — NCA-AIIO: Distributed Training Networking
  {q:"NCCL_DEBUG=INFO shows 'Using network Socket'. Training is at 8 GB/s instead of 180 GB/s. What is the most targeted first check?",
   opts:["Reinstall NCCL","Run env | grep NCCL — check for NCCL_IB_DISABLE=1","Reboot all training nodes","Increase batch size"],
   ans:1,exp:"NCCL_IB_DISABLE=1 is the most common cause of TCP fallback. It overrides all IB detection. Always check env variables first before any hardware or software investigation."},

  {q:"After unsetting NCCL_IB_DISABLE, NCCL still falls back to TCP. ibstat shows all ports Active. What is the next most likely cause?",
   opts:["The NVIDIA driver needs updating","NCCL_IB_HCA is set to a non-existent HCA name — verify with ibstat and correct it","The NVLink topology is broken","A Kubernetes NetworkPolicy is blocking the rendezvous port"],
   ans:1,exp:"If IB hardware is active but NCCL still uses TCP, a misconfigured NCCL_IB_HCA pointing to a wrong HCA name is the next most common cause. Verify the exact HCA name from ibstat and set NCCL_IB_HCA accordingly."},

  {q:"A RoCEv2 cluster shows 'rx_pfc_frames' counter rising rapidly on the storage switch. Training throughput has degraded 40%. What condition does this indicate?",
   opts:["InfiniBand fabric failure","PFC storm — a feedback loop of pause frames causing fabric-wide head-of-line blocking","NCCL TCP fallback","GPU ECC errors corrupting gradient sync"],
   ans:1,exp:"A PFC storm occurs when pause frames propagate in a loop causing head-of-line blocking. Fix: lower ECN marking thresholds to reduce congestion before it triggers PFC, and verify no circular dependencies in the switch topology."},

  // NVLink & MIG — NCA-AIIO: Hardware Topology
  {q:"nvidia-smi topo -m shows 'PHB' between GPU0 and GPU1 instead of 'NV4'. AllReduce drops from 187 GB/s to 3 GB/s. What is the root cause?",
   opts:["NCCL TCP fallback due to NCCL_IB_DISABLE=1","The NVLink connection between those GPUs is broken, forcing PCIe traversal","ECC errors degrading VRAM bandwidth","GPU thermal throttling"],
   ans:1,exp:"PHB = PCIe Host Bridge traversal — NVLink is not active between those GPUs. AllReduce is forced over PCIe (~32 GB/s theoretical vs 900 GB/s for NVLink 4.0). Physical inspection or RMA may be required."},

  {q:"You need to partition one H100 into 7 isolated GPU slices with independent fault domains. What is the correct command sequence?",
   opts:["nvidia-smi -i 0 --multi-instance-gpu 7","sudo nvidia-smi -i 0 -mig 1 && sudo nvidia-smi mig -cgi 9,9,9,9,9,9,9 -C","sudo nvidia-smi partition --count 7","kubectl apply -f mig-7x.yaml"],
   ans:1,exp:"Profile '9' = 1g.10gb (1/7th of an H100). First enable MIG mode with '-mig 1', then create 7 compute instances. Each instance has independent ECC error domains."},

  // Storage — NCA-AIIO: I/O Optimization
  {q:"nvidia-smi dmon shows GPU utilization oscillating between 94% and 4% (sawtooth pattern). iostat shows NFS at 100% utilization. What is the correct diagnosis?",
   opts:["GPU thermal throttling","ECC memory errors causing retry storms","Storage I/O bottleneck — the DataLoader is starving the GPU","NCCL AllReduce stall"],
   ans:2,exp:"The sawtooth GPU utilization pattern is the definitive signature of a storage I/O bottleneck. The GPU finishes batches faster than the DataLoader can supply them. Fix: increase Lustre stripe count, increase DataLoader num_workers."},

  {q:"A Lustre filesystem shows 'stripe_count: 1' for a 2TB training dataset directory spread across 16 OSTs. What is the correct fix?",
   opts:["Increase PyTorch DataLoader num_workers only","Run 'lfs setstripe -c 8 /mnt/lustre/dataset' to stripe across 8 OSTs","Migrate to GPUDirect Storage immediately","Add more CPU cores to storage nodes"],
   ans:1,exp:"stripe_count:1 means all reads hit a single OST. Setting stripe_count to 8+ distributes reads across multiple OSTs, multiplying effective read bandwidth. Often the single highest-impact fix for storage-bound training."},

  // Monitoring & Operations — NCA-AIIO: Observability
  {q:"You need to scrape GPU metrics into Prometheus. On which port does DCGM Exporter expose its /metrics endpoint by default?",
   opts:[":9090 (same as Prometheus)",":9400",":8080",":2049"],
   ans:1,exp:"The DCGM Exporter exposes metrics on port 9400 by default. Grafana dashboard ID 12239 is the standard NVIDIA-provided dashboard for visualizing these metrics."},

  {q:"A Kubernetes training pod is stuck in Pending. 'kubectl describe pod' shows 'Insufficient nvidia.com/gpu'. All nodes show 'nvidia.com/gpu: 8' in describe node. What is the most likely cause?",
   opts:["The NVIDIA GPU Operator is not installed","All 8 GPU slots on every available node are currently allocated to other running pods","The pod spec requests nvidia.com/gpu: 0","The kubelet has not restarted since driver install"],
   ans:1,exp:"nvidia.com/gpu is an extended resource with integer semantics. If all slots are allocated, the pod must wait. Check for zombie or runaway GPU-holding pods that should be terminated."},

  {q:"A Slurm job shows Reason='Priority' in squeue. 'sshare -u alice' shows FairShare: 0.034. What does this mean?",
   opts:["Alice has consumed far more than her fair share — the scheduler deprioritizes her new jobs until usage decays","Alice has used very little and will be scheduled next","The Slurm controller has lost contact with Alice's node","The job needs more GPUs than are available"],
   ans:0,exp:"FairShare < 1.0 means a user has consumed more than their allocated share. The scheduler penalizes heavy users by reducing their priority. The share decays over time via PriorityDecayHalfLife. No admin action needed unless the policy itself is wrong."},

  // Kubernetes & Containers — NCA-AIIO: Orchestration
  {q:"A distributed training job requires all 16 pods across 2 nodes to start simultaneously or NCCL will hang. What Kubernetes feature enforces this all-or-nothing guarantee?",
   opts:["Pod Affinity with requiredDuringScheduling","Gang Scheduling via a PodGroup resource (Volcano or Coscheduler)","DaemonSet with a node selector","ResourceQuota at the namespace level"],
   ans:1,exp:"Gang scheduling (PodGroup via Volcano or Kubernetes Coscheduler) holds all pods in a group until the entire group can be scheduled simultaneously. Without it, partial scheduling causes NCCL init to hang waiting for all ranks."},

  {q:"A Kubernetes pod fails with 'CUDA error: no kernel image is available for execution on the device'. Container was built with CUDA 11.8. Cluster nodes have Driver 12.3. What is the correct fix?",
   opts:["Run 'nvidia-smi --gpu-reset' on the node","Rebuild the container using an NGC base image (nvcr.io/nvidia/pytorch:24.01-py3) that includes CUDA 12.x","Downgrade the node driver to match the container","Set CUDA_VISIBLE_DEVICES='' in the pod spec"],
   ans:1,exp:"CUDA 11.8 does not include sm_90 kernels required by H100 GPUs (compute capability 9.0 was introduced in CUDA 11.8 but full support arrived in CUDA 12.x). Rebuilding with an NGC image based on CUDA 12.x ensures the correct sm_90 PTX/SASS kernels are present. Note: newer drivers ARE backwards-compatible with older CUDA runtimes — the issue here is missing GPU architecture support, not driver version mismatch."}
];

let quizState = {};

function openQuiz() {
  quizState = { answers:{}, submitted:false };
  const el = document.getElementById('quiz-content');
  if (!el) return;

  el.replaceChildren();
  QUIZ.forEach((q, i) => {
    const question = document.createElement('div');
    question.className = 'quiz-q';
    question.id = `qq-${i}`;

    const text = document.createElement('div');
    text.className = 'q-text';
    text.textContent = `${i + 1}. ${q.q}`;
    question.appendChild(text);

    q.opts.forEach((opt, j) => {
      const option = document.createElement('div');
      option.className = 'quiz-option';
      option.id = `qo-${i}-${j}`;
      option.dataset.quizQuestion = String(i);
      option.dataset.quizOption = String(j);

      const key = document.createElement('span');
      key.className = 'opt-key';
      key.textContent = String.fromCharCode(65 + j);
      option.appendChild(key);
      option.appendChild(document.createTextNode(opt));
      question.appendChild(option);
    });

    const explain = document.createElement('div');
    explain.className = 'quiz-explain';
    explain.id = `qe-${i}`;
    explain.textContent = q.exp;
    question.appendChild(explain);

    el.appendChild(question);
  });

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;margin-top:16px;align-items:center';

  const submitBtn = document.createElement('button');
  submitBtn.className = 'btn-sm primary';
  submitBtn.dataset.quizAction = 'submit';
  submitBtn.textContent = 'Submit Answers';
  actions.appendChild(submitBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-sm';
  resetBtn.dataset.quizAction = 'reset';
  resetBtn.textContent = 'Reset';
  actions.appendChild(resetBtn);

  const progress = document.createElement('div');
  progress.id = 'quiz-progress';
  progress.style.cssText = 'margin-left:auto;font-family:var(--font-mono);font-size:11px;color:var(--dim)';
  progress.textContent = `0/${QUIZ.length} answered`;
  actions.appendChild(progress);

  const result = document.createElement('div');
  result.id = 'quiz-result';

  el.appendChild(actions);
  el.appendChild(result);
  document.getElementById('quiz-overlay').classList.add('show');
}

function selectAnswer(qi, optIdx) {
  if(quizState.submitted) return;
  quizState.answers[qi] = optIdx;
  document.querySelectorAll(`[id^="qo-${qi}-"]`).forEach(el=>el.classList.remove('selected'));
  document.getElementById(`qo-${qi}-${optIdx}`).classList.add('selected');
  document.getElementById('quiz-progress').textContent = `${Object.keys(quizState.answers).length}/${QUIZ.length} answered`;
}

function submitQuiz() {
  quizState.submitted = true;
  let correct=0;
  QUIZ.forEach((q,i)=>{
    const chosen = quizState.answers[i];
    if(chosen === undefined) return;
    if(chosen === q.ans) correct++;
    document.getElementById(`qo-${i}-${q.ans}`).classList.add('correct');
    if(chosen !== q.ans) document.getElementById(`qo-${i}-${chosen}`)?.classList.add('wrong');
    document.getElementById(`qe-${i}`).classList.add('show');
  });
  const pct = Math.round((correct/QUIZ.length)*100);
  document.getElementById('quiz-result').innerHTML = `<div class="quiz-score"><span class="score-num">${pct}%</span></div>`;
  document.getElementById('h-score').textContent = pct+'%';
  localStorage.setItem('gpusim_score', pct);
}

function resetQuiz() { quizState = {}; openQuiz(); }
function closeQuiz() { document.getElementById('quiz-overlay').classList.remove('show'); }

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
  localStorage.removeItem('gpusim_completed');
  localStorage.removeItem('gpusim_score');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active','done'));
  clearCanvas();
  clearTerminal();
  currentLab=null; currentStep=-1;
  document.getElementById('scen-title').textContent='GPU Infrastructure Simulator';
  document.getElementById('scen-step').style.display='none';
  document.getElementById('step-controls').innerHTML='';

  const svg=document.getElementById('diagram-canvas');
  if (typeof drawRackElevation === 'function' && isProvisioned) {
      drawRackElevation(svg);
  } else if (typeof drawWelcome === 'function') {
      drawWelcome(svg);
  }
}


// ── Sprint 21: bindUIHandlers — replaces all inline HTML event handlers ──
function bindUIHandlers() {
  if (_uiHandlersBound) return;
  _uiHandlersBound = true;
  const on = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };

  // Login overlay
  on('btn-login',  'click', aegisLogin);
  const passEl = document.getElementById('login-pass');
  if (passEl) passEl.addEventListener('keydown', e => { if(e.key==='Enter') aegisLogin(); });

  // Header
  on('btn-quiz',    'click', openQuiz);
  on('btn-blueprint', 'click', () => { document.getElementById('recon-overlay').style.display = 'flex'; });
  on('btn-learn',   'click', () => { if (currentLab) showIntro(currentLab); });
  on('btn-logout',  'click', aegisLogout);
  on('btn-reset',   'click', resetAll);
  on('toggle-beginner', 'change', e => setBeginnerMode(e.target.checked));

  // Sidebar
  on('sidebar-btn-quiz', 'click', openQuiz);

  // Provisioning
  on('sel-blueprint', 'change', runInstantSentinel);
  on('sel-fabric',    'change', runInstantSentinel);
  on('btn-apply',     'click',  applyProvisioning);

  // Live/thermal toggles (3 instances each)
  ['toggle-live','sidebar-toggle-live','quiz-toggle-live'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleAppMode(el.checked));
  });
  ['toggle-thermal','sidebar-toggle-thermal','quiz-toggle-thermal'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', () => toggleThermalView(el.checked));
  });

  // Terminal controls
  on('btn-clear-term', 'click', clearTerminal);
  on('toggle-ai-btn',  'click', toggleAIDoc);
  on('run-btn',        'click', runCurrentStep);
  on('btn-analyze',    'click', analyzeLog);

  // Terminal tabs
  ['term','dmesg','dcgm','parser'].forEach(tab => {
    on('tab-'+tab, 'click', () => switchTab(tab));
  });

  // Intro modal
  on('btn-intro-close', 'click', closeIntro);
  on('btn-intro-skip',  'click', closeIntro);
  on('btn-intro-start', 'click', startLab);

  // Quiz modal
  on('btn-quiz-close', 'click', closeQuiz);
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

  // Remediation panel
  on('btn-dismiss-remediation', 'click', dismissRemediationPanel);

  // Incident history
  on('btn-incidents', 'click', openIncidentHistory);
  on('btn-incidents-close', 'click', closeIncidentHistory);

  // Lab navigation — event delegation
  const navList = document.querySelector('.sidebar-scroll');
  if(navList) navList.addEventListener('click', e => {
    const item = e.target.closest('[id^="nav-"]');
    if(item) loadLab(item.id.replace('nav-', ''));
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && currentLab) runCurrentStep();
    if (e.key === 'ArrowLeft' && currentLab && currentStep > 0) runStep(currentLab, currentStep - 1);
  });
}

// --- INIT BOOTSTRAP ---
function initApp() {
  bindUIHandlers();
  syncBeginnerModeUI();
  // Always show the cluster chooser after login instead of auto-entering a saved rack.
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
  runInstantSentinel();
  const reconOverlay = document.getElementById('recon-overlay');
  if (reconOverlay) reconOverlay.style.display = 'flex';
  const initialSvg = document.getElementById('diagram-canvas');
  if (initialSvg && typeof drawWelcome === 'function') drawWelcome(initialSvg);

  // Restore completed labs and quiz score from previous session
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

  // Attach Terminal listener once per session bootstrap
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
            logTerm([{t:'cmd',v:'$ '+cmd}]);
            handleCustomCommand(cmd);
            scrollTerminal();
          }
        });
    }
  }

  // Draw Initial State
  const svg = document.getElementById('diagram-canvas');
  setTimeout(()=>{
    if(svg && !isProvisioned) {
        const w=svg.clientWidth, h=svg.clientHeight;
        svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
        if(typeof drawWelcome === 'function') drawWelcome(svg);
    }
  }, 100);
}

window.addEventListener('load', async ()=>{
  bindUIHandlers();
  // Sprint 16: Verify existing JWT or show login overlay
  if (JWT_TOKEN) {
    try {
      const r = await fetch(`${API_BASE}/auth/me`, { headers: authHdr() });
      if (r.ok) { hideLoginOverlay(); initApp(); return; }
    } catch(e) { /* fall through to login */ }
  }
  showLoginOverlay();
});

window.addEventListener('resize', ()=>{
  if(currentLab) {
    const svg=document.getElementById('diagram-canvas');
    const w=svg.clientWidth, h=svg.clientHeight;
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(typeof LABS[currentLab].draw === 'function') LABS[currentLab].draw(svg, currentStep);
  }
});

// ════════════════════════════════════════════════════════════════════
// SPRINT 3: INCIDENT PARSER (LOG REVERSE ENGINEERING)
// ════════════════════════════════════════════════════════════════════
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
        // THE FIX: Bulletproof Regex that ignores colons inside the (PCI:...) brackets
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
                // Build topology-aware PCIe map covering 4/8/18-node blueprints
                const pcieTopologyMap = {};
                for (let _n = 0; _n < 18; _n++) {
                  const bus = _n.toString(16) + '3';  // e.g. 0→'03', 4→'43', 10→'a3'
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

// ════════════════════════════════════════════════════════════════════
// SPRINT 4: DUAL-MODE STATE MANAGEMENT & THERMAL LOGIC
// ════════════════════════════════════════════════════════════════════

let appMode = 'simulation'; 
let thermalMode = false;

let liveInterval = null;

async function toggleAppMode(forcedState) {
    const isLive = forcedState !== undefined ? forcedState : document.getElementById('toggle-live').checked;
    // Sync all three checkbox instances (header, sidebar, quiz panel)
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
                logTerm([{t:'good', v:`[NETWORK] SUCCESS! Handshake complete.`}]);
                logTerm([{t:'info', v:`[DAEMON] Aegis-GPU daemon active.`}]);
                document.getElementById('scen-desc').textContent = 'Connected. Waiting for live telemetry...';

                // --- START LIVE POLLING ---
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

// Sprint 13: toggleThermalView — was called from HTML but never defined.
// Syncs all three checkbox instances and redraws the active canvas.
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

// Function to grab the data and update the UI sidebar
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

// ════════════════════════════════════════════════════════════════════
// SPRINT 10: AUTONOMOUS REMEDIATION UI (AIOps)
// ════════════════════════════════════════════════════════════════════

async function requestAI_Remediation(xid, nodeIndex = 6) {
    if (appMode !== 'live') {
        logTerm([{t:'err', v:'[SYSTEM] Please switch to Live Telemetry Mode to use the AIOps Engine.'}]);
        return;
    }
    currentFaultNode = nodeIndex;

    // 1. Visually trigger the fault on the Digital Twin
    const svg = document.getElementById('diagram-canvas');
    if (svg) {
        clearCanvas();
        drawRackElevation(svg, {node: nodeIndex, xid: xid}, thermalMode);
    }

    logTerm([{t:'warn', v:`[AIOps] Intercepted fault XID ${xid} on Node 0${nodeIndex + 1}. Consulting Knowledge Base...`}]);
    scrollTerminal();
    
    try {
        // 2. Query the Python RAG Backend
        const res = await fetch(`${API_BASE}/diagnose/${xid}`, {
            method: 'POST',
            headers: { ...authHdr(), 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (res.status === 401) { handle401(); return; }
        const data = await res.json();
        
        if (data.error) { logTerm([{t:"err", v:`[AIOps REJECTED] ${data.error}`}]); scrollTerminal(); } else if (data.remediation_plan) {
            logTerm([{t:'info', v:`[DIAGNOSIS] Source: ${data.diagnosis_source}`}]);
            logTerm([{t:'good', v:`[REMEDIATION PLAN] ${data.remediation_plan}`}]);
            logTerm([{t:'dim',  v:`[AUDIT] ${data.hallucination_check}`}]);
            scrollTerminal();
            
            // 3. Capture into static overlay and show toggle button
            captureStaticDiagnosis(data);

            // 4. Spawn the Self-Healing Runbook Button
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
// SPRINT 11: STATIC DIAGNOSTIC TOGGLE
// ══════════════════════════════════════════════════════════════════════

/**
 * toggleAIDoc - shows/hides the static AI diagnosis overlay panel.
 * Called by the #toggle-ai-btn button in the terminal toolbar.
 */
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

/**
 * captureStaticDiagnosis - writes AI remediation data into the static
 * overlay div and makes the toggle button visible.
 * Called from requestAI_Remediation on a successful API response.
 */
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

// ════════════════════════════════════════════════════════════════════
// INCIDENT HISTORY
// ════════════════════════════════════════════════════════════════════
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

// Click-outside handler: close ai-static-overlay when clicking outside it
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
