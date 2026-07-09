// UX-6: Browser history integration.
// The simulator is a single-page app; without history entries the first Back
// press leaves the site entirely. After each user interaction we snapshot the
// visible location (workspace mode, active lab, fleet dashboard, topmost
// overlay) and push a history entry when it changed. popstate re-applies the
// recorded snapshot, so Back walks through labs, modes, and overlays.

const APP_HISTORY_OVERLAYS = [
  { name: 'hub', id: 'hub-overlay', kind: 'display' },
  { name: 'recon', id: 'recon-overlay', kind: 'display' },
  { name: 'incidents', id: 'incident-overlay', kind: 'display' },
  { name: 'study', id: 'study-overlay', kind: 'class' },
  { name: 'quiz', id: 'quiz-overlay', kind: 'class' },
  { name: 'intro', id: 'intro-overlay', kind: 'class' },
];

let _appHistoryBooted = false;
let _appHistoryTimer = null;
let _appHistoryApplying = false;

function isAppHistoryOverlayVisible(spec) {
  const el = document.getElementById(spec.id);
  if (!el) return false;
  if (spec.kind === 'class') return el.classList.contains('show');
  return el.style.display !== 'none' && el.style.display !== '';
}

function getAppHistorySnapshot() {
  const overlaySpec = APP_HISTORY_OVERLAYS.find(isAppHistoryOverlayVisible);
  return {
    aegis: 1,
    mode: document.body.dataset.workspaceMode || 'training',
    lab: (typeof currentLab !== 'undefined' && currentLab) ? currentLab : null,
    fleet: typeof isClusterDashboardActive === 'function' && isClusterDashboardActive(),
    overlay: overlaySpec ? overlaySpec.name : null,
  };
}

function appHistoryStatesEqual(a, b) {
  return !!a && !!b && a.mode === b.mode && a.lab === b.lab && a.fleet === b.fleet && a.overlay === b.overlay;
}

function captureAppHistoryEntry() {
  if (_appHistoryApplying) return;
  const login = document.getElementById('login-overlay');
  if (login && login.style.display !== 'none') return;
  const snapshot = getAppHistorySnapshot();
  const current = window.history.state;
  if (current && current.aegis) {
    if (!appHistoryStatesEqual(current, snapshot)) window.history.pushState(snapshot, '');
  } else {
    window.history.replaceState(snapshot, '');
  }
}

function scheduleAppHistoryCapture() {
  if (!_appHistoryBooted || _appHistoryApplying || _appHistoryTimer) return;
  _appHistoryTimer = window.setTimeout(() => {
    _appHistoryTimer = null;
    captureAppHistoryEntry();
  }, 60);
}

// Clears the lab view without touching saved progress (unlike resetAll).
function appHistoryUnloadLab() {
  currentLab = null;
  currentStep = -1;
  activeAlternateStep = null;
  activeMainRedirectStep = null;
  document.body.classList.remove('lab-active');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const title = document.getElementById('scen-title');
  if (title) title.textContent = 'GPU Infrastructure Simulator';
  const desc = document.getElementById('scen-desc');
  if (desc && typeof describeClusterSimIdleView === 'function') desc.textContent = describeClusterSimIdleView();
  const stepBadge = document.getElementById('scen-step');
  if (stepBadge) stepBadge.style.display = 'none';
  const controls = document.getElementById('step-controls');
  if (controls) controls.innerHTML = '';
  if (typeof clearCanvas === 'function') clearCanvas();
  const svg = document.getElementById('diagram-canvas');
  if (svg) {
    if (typeof isProvisioned !== 'undefined' && isProvisioned && typeof drawRackElevation === 'function') {
      drawRackElevation(svg);
    } else if (typeof drawWelcome === 'function') {
      drawWelcome(svg);
    }
  }
  if (typeof renderLabStepCoach === 'function') renderLabStepCoach();
  if (typeof updateTerminalInputHint === 'function') updateTerminalInputHint();
}

function openAppHistoryOverlay(name) {
  if (name === 'hub' && typeof showLandingHub === 'function') { showLandingHub(); return; }
  if (name === 'recon') {
    const el = document.getElementById('recon-overlay');
    if (el) el.style.display = 'flex';
    return;
  }
  if (name === 'incidents' && typeof openIncidentHistory === 'function') { openIncidentHistory(); return; }
  if (name === 'study' && typeof openStudyGuide === 'function') { openStudyGuide(); return; }
  if (name === 'quiz' && typeof openQuiz === 'function') { openQuiz(); return; }
  if (name === 'intro' && typeof currentLab !== 'undefined' && currentLab && typeof showIntro === 'function') {
    showIntro(currentLab);
  }
}

function closeAppHistoryOverlay(spec) {
  if (spec.name === 'incidents' && typeof closeIncidentHistory === 'function') { closeIncidentHistory(); return; }
  if (spec.name === 'study' && typeof closeStudyGuide === 'function') { closeStudyGuide(); return; }
  if (spec.name === 'quiz' && typeof closeQuiz === 'function') { closeQuiz(); return; }
  if (spec.name === 'intro' && typeof closeIntro === 'function') { closeIntro(); return; }
  const el = document.getElementById(spec.id);
  if (!el) return;
  if (spec.kind === 'class') el.classList.remove('show');
  else el.style.display = 'none';
}

function applyAppHistoryState(state) {
  const target = (state && state.aegis)
    ? state
    : { aegis: 1, mode: 'training', lab: null, fleet: false, overlay: null };
  _appHistoryApplying = true;
  try {
    if (typeof closePalette === 'function') closePalette();
    if ((document.body.dataset.workspaceMode || 'training') !== target.mode && typeof setWorkspaceMode === 'function') {
      setWorkspaceMode(target.mode, { openFleet: false });
    }
    const fleetActive = typeof isClusterDashboardActive === 'function' && isClusterDashboardActive();
    if (target.fleet && !fleetActive && typeof openClusterDashboard === 'function') openClusterDashboard();
    if (!target.fleet && fleetActive && typeof closeClusterDashboard === 'function') closeClusterDashboard();
    const wantedLab = (target.lab && typeof LABS !== 'undefined' && LABS[target.lab]) ? target.lab : null;
    const activeLab = (typeof currentLab !== 'undefined' && currentLab) ? currentLab : null;
    if (wantedLab && wantedLab !== activeLab) {
      if (typeof isProvisioned !== 'undefined' && isProvisioned && typeof loadLab === 'function') loadLab(wantedLab);
    } else if (!wantedLab && activeLab && !target.fleet) {
      appHistoryUnloadLab();
    }
    APP_HISTORY_OVERLAYS.forEach(spec => {
      const shouldShow = target.overlay === spec.name;
      const visible = isAppHistoryOverlayVisible(spec);
      if (shouldShow && !visible) openAppHistoryOverlay(spec.name);
      else if (!shouldShow && visible) closeAppHistoryOverlay(spec);
    });
  } finally {
    _appHistoryApplying = false;
  }
}

function initAppHistory() {
  if (_appHistoryBooted) return;
  _appHistoryBooted = true;
  document.addEventListener('click', scheduleAppHistoryCapture, true);
  document.addEventListener('keyup', scheduleAppHistoryCapture, true);
  window.addEventListener('popstate', e => {
    if (_appHistoryTimer) {
      window.clearTimeout(_appHistoryTimer);
      _appHistoryTimer = null;
    }
    applyAppHistoryState(e.state);
  });
  captureAppHistoryEntry();
}
