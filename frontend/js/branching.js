function getAlternateBranchChain(labId) {
  const first = ALTERNATE_BRANCH_STEPS[labId];
  if (!first) return [];
  const second = ALTERNATE_BRANCH_FOLLOWUPS[labId];
  return second ? [first, second] : [first];
}

function loadBranchingState() {
  try {
    const parsed = JSON.parse(localStorage.getItem('gpusim_branching_state') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    localStorage.removeItem('gpusim_branching_state');
    return {};
  }
}

function persistBranchingState() {
  localStorage.setItem('gpusim_branching_state', JSON.stringify(branchingState));
  if (typeof window.scheduleProgressSync === 'function') window.scheduleProgressSync();
}

function getBranchingFamily(labId, step) {
  return getReasoningDomain(labId, step);
}

function getBranchingKey(labId, stepIdx) {
  return `${labId}:${stepIdx}`;
}

function getBranchMetaKey(labId, stepIdx, suffix) {
  return `${labId}:${stepIdx}:${suffix}`;
}

function getConsequenceBranch(labId, step) {
  return CONSEQUENCE_BRANCHES[getBranchingFamily(labId, step)] || CONSEQUENCE_BRANCHES.general_diagnosis;
}

function getSelectedBranchChoice(labId, stepIdx) {
  if (!labId || typeof stepIdx !== 'number' || stepIdx < 0) return null;
  const step = LABS[labId]?.steps?.[stepIdx];
  const branch = getConsequenceBranch(labId, step);
  const choiceId = branchingState[getBranchingKey(labId, stepIdx)];
  return branch.choices.find(item => item.id === choiceId) || null;
}

function getSelectedBranchChoicesForLab(labId, maxStepIdx = Infinity) {
  const results = [];
  Object.entries(branchingState).forEach(([key, choiceId]) => {
    const [entryLab, rawStep] = key.split(':');
    const stepIdx = Number(rawStep);
    if (entryLab !== labId || Number.isNaN(stepIdx) || stepIdx >= maxStepIdx) return;
    const step = LABS[labId]?.steps?.[stepIdx];
    const branch = getConsequenceBranch(labId, step);
    const choice = branch.choices.find(item => item.id === choiceId);
    if (choice) results.push({ stepIdx, choice, domain: getBranchingFamily(labId, step) });
  });
  return results.sort((a, b) => a.stepIdx - b.stepIdx);
}

function getBranchConsequenceContext(labId, stepIdx) {
  const priorChoices = getSelectedBranchChoicesForLab(labId, stepIdx);
  const badCount = priorChoices.filter(item => item.choice.effect === 'bad').length;
  const warnCount = priorChoices.filter(item => item.choice.effect === 'warn').length;
  const bestCount = priorChoices.filter(item => item.choice.effect === 'best').length;
  const dominantDomain = priorChoices.length ? priorChoices[priorChoices.length - 1].domain : null;
  return {
    priorChoices,
    badCount,
    warnCount,
    bestCount,
    hasPenalty: badCount > 0 || warnCount > 0,
    dominantDomain,
  };
}

function getBranchPenaltyMessages(labId, stepIdx) {
  const context = getBranchConsequenceContext(labId, stepIdx);
  if (!context.hasPenalty) return [];
  const messages = [];
  if (context.dominantDomain === 'fault_isolation') {
    if (context.badCount) messages.push('[branch] Earlier broad changes delayed containment. Fresh jobs kept landing on unstable hardware.');
    else messages.push('[branch] Earlier hesitation left the fault visible longer than necessary. The node stayed exposed to additional workload risk.');
  } else if (context.dominantDomain === 'fabric_path') {
    if (context.badCount) messages.push('[branch] The fast path stayed unresolved. Collective traffic kept using the degraded route and cluster time was lost.');
    else messages.push('[branch] The path issue was not narrowed quickly. Throughput stayed soft while the wrong layer absorbed attention.');
  } else if (context.dominantDomain === 'runtime_delivery') {
    if (context.badCount) messages.push('[branch] Broad stack changes blurred the fault boundary. Recovery is now slower because the original mismatch evidence was disturbed.');
    else messages.push('[branch] The runtime boundary stayed ambiguous, so later steps still carry unresolved contract risk.');
  } else if (context.dominantDomain === 'platform_efficiency') {
    if (context.badCount) messages.push('[branch] Compute settings were changed before the feed path was fixed. GPU efficiency remains degraded and the bottleneck still leaks upstream.');
    else messages.push('[branch] Upstream starvation was not cleared early, so the node continues to waste accelerator time.');
  } else {
    messages.push('[branch] Earlier choices left the incident less controlled, so the current step carries more ambiguity and operational drag.');
  }
  return messages;
}

function isBranchDetourPending(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  if (!choice || choice.effect === 'best') return false;
  return branchingState[getBranchMetaKey(labId, stepIdx, 'detour_done')] !== true;
}

function markBranchDetourDone(labId, stepIdx) {
  branchingState[getBranchMetaKey(labId, stepIdx, 'detour_done')] = true;
  persistBranchingState();
}

function isAlternateBranchStepPending(labId, stepIdx) {
  const chain = getAlternateBranchChain(labId);
  if (!chain.length) return false;
  const choice = getSelectedBranchChoice(labId, stepIdx);
  if (!choice || choice.effect === 'best') return false;
  if (isBranchDetourPending(labId, stepIdx)) return false;
  const progress = branchingState[getBranchMetaKey(labId, stepIdx, 'alt_progress')] || 0;
  return progress < chain.length;
}

function markAlternateBranchStepDone(labId, stepIdx) {
  const progressKey = getBranchMetaKey(labId, stepIdx, 'alt_progress');
  const progress = branchingState[progressKey] || 0;
  branchingState[progressKey] = progress + 1;
  persistBranchingState();
}

function scheduleMainPathRedirect(labId, stepIdx) {
  branchingState[getBranchMetaKey(labId, stepIdx, 'main_redirect_pending')] = true;
  persistBranchingState();
}

function getMainPathRedirectStep(labId, stepIdx) {
  if (!ALTERNATE_MAIN_PATH_STEPS[labId]) return null;
  if (branchingState[getBranchMetaKey(labId, stepIdx, 'main_redirect_pending')] !== true) return null;
  if (branchingState[getBranchMetaKey(labId, stepIdx, 'main_redirect_done')] === true) return null;
  return {
    ...ALTERNATE_MAIN_PATH_STEPS[labId],
    redirectTargetStep: stepIdx,
  };
}

function markMainPathRedirectDone(labId, stepIdx) {
  branchingState[getBranchMetaKey(labId, stepIdx, 'main_redirect_done')] = true;
  branchingState[getBranchMetaKey(labId, stepIdx, 'main_redirect_pending')] = false;
  persistBranchingState();
}

function isBrowserSmokeMode() {
  return window.location.hash.includes('browser-smoke');
}

function getBrowserSmokeScenarioName() {
  const hash = String(window.location.hash || '');
  const match = hash.match(/browser-smoke(?::([a-z0-9_]+))?/i);
  return match?.[1] || 'ecc';
}

function getBrowserSmokeResultPort() {
  try {
    const url = new URL(window.location.href);
    const rawPort = String(url.searchParams.get('smokePort') || '').trim();
    if (/^\d{2,5}$/.test(rawPort)) return rawPort;
  } catch (_) {
    // Fall back to the default callback port if the URL is unavailable.
  }
  return '18080';
}

function setBrowserSmokeResult(status, summary, details = []) {
  let node = document.getElementById('browser-smoke-result');
  if (!node) {
    node = document.createElement('pre');
    node.id = 'browser-smoke-result';
    node.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20000;background:#06111b;color:#d7e3f4;border:1px solid #29405c;padding:10px;max-width:720px;white-space:pre-wrap;font:12px/1.4 monospace;';
    document.body.appendChild(node);
  }
  node.dataset.status = status;
  node.textContent = [`status=${status}`, `summary=${summary}`, ...details.map(item => `detail=${item}`)].join('\n');
  const params = new URLSearchParams({
    status,
    summary,
    details: details.join(' || '),
  });
  const url = `http://127.0.0.1:${getBrowserSmokeResultPort()}/result?${params.toString()}`;
  if (window.fetch) {
    window.fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {});
  }
  const beacon = new Image();
  beacon.src = url;
}

function browserSmokeWait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function browserSmokeWaitFor(predicate, timeout = 2000, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await browserSmokeWait(interval);
  }
  return false;
}

function seedBrowserSmokeReasoningStep(labId, stepIdx, values = {}) {
  reasoningProgress.steps[`${labId}:${stepIdx}`] = {
    score: values.score ?? 2,
    maxScore: values.maxScore ?? 6,
    penalty: values.penalty ?? 0,
    categories: [
      { key: 'layer', label: 'Layer call', value: values.layer ?? 1 },
      { key: 'evidence', label: 'Evidence quality', value: values.evidence ?? 1 },
      { key: 'safety', label: 'Action safety', value: values.safety ?? 0 },
    ],
  };
  persistReasoningProgress();
  updateReasoningProgressUI();
}

async function runBrowserSmokeScenario() {
  const scenario = getBrowserSmokeScenarioName();
  const details = [];
  try {
    resetAll();
    applyProvisioning();
    if (!isProvisioned) throw new Error('provisioning did not complete');
    details.push('provisioned');

    if (scenario === 'workspace_mode_scoping') {
      const groupVisible = scope => {
        const group = document.querySelector(`.hdr-tool-group[data-mode-scope="${scope}"]`);
        return !!group && window.getComputedStyle(group).display !== 'none';
      };
      for (const mode of ['training', 'incident', 'fleet']) {
        setWorkspaceMode(mode, { openFleet: false });
        await browserSmokeWait(80);
        if (document.body.dataset.workspaceMode !== mode) throw new Error(`body mode did not switch to ${mode}`);
        const activeTab = document.querySelector('.mode-tab.active');
        if (activeTab?.getAttribute('data-workspace-mode') !== mode) throw new Error(`active tab did not follow ${mode} mode`);
        for (const scope of ['training', 'incident', 'fleet']) {
          if (groupVisible(scope) !== (scope === mode)) {
            throw new Error(`${scope} tool group ${scope === mode ? 'hidden' : 'visible'} in ${mode} mode`);
          }
        }
        const statusGroup = document.querySelector('.hdr-status-group');
        if (!statusGroup || window.getComputedStyle(statusGroup).display === 'none') throw new Error(`status group hidden in ${mode} mode`);
        details.push(`mode-${mode}-scoped`);
      }
      setWorkspaceMode('training', { openFleet: false });
      details.push('status-always-visible');
      setBrowserSmokeResult('pass', 'workspace mode scoping verified', details);
      return;
    }

    if (scenario === 'command_palette') {
      const paletteShown = () => document.getElementById('palette-overlay')?.style.display !== 'none';
      const pressCtrlK = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
      pressCtrlK();
      await browserSmokeWait(80);
      if (!paletteShown()) throw new Error('Ctrl+K did not open the palette');
      details.push('palette-opens');
      const input = document.getElementById('palette-input');
      input.value = 'fleet mode';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await browserSmokeWait(80);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await browserSmokeWait(120);
      if (paletteShown()) throw new Error('palette did not close after running a command');
      if (document.body.dataset.workspaceMode !== 'fleet') throw new Error('palette command did not switch to fleet mode');
      details.push('palette-runs-mode-command');
      pressCtrlK();
      await browserSmokeWait(80);
      input.value = 'nvlink topology';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await browserSmokeWait(80);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      await browserSmokeWait(120);
      document.getElementById('btn-intro-close')?.click();
      if (currentLab !== 'nvlink') throw new Error('palette lab jump did not load the nvlink lab');
      if (document.body.dataset.workspaceMode !== 'training') throw new Error('palette lab jump did not return to training mode');
      details.push('palette-jumps-to-lab');
      pressCtrlK();
      await browserSmokeWait(80);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      await browserSmokeWait(80);
      if (paletteShown()) throw new Error('Escape did not close the palette');
      details.push('palette-escape-closes');
      setBrowserSmokeResult('pass', 'command palette verified', details);
      return;
    }

    if (scenario === 'history_back') {
      const introShown = () => !!document.getElementById('intro-overlay')?.classList.contains('show');
      const settle = () => browserSmokeWait(200);
      document.getElementById('nav-nvlink')?.click();
      await settle();
      if (currentLab !== 'nvlink') throw new Error('nav click did not load the nvlink lab');
      document.getElementById('btn-intro-close')?.click();
      await settle();
      document.getElementById('nav-mig')?.click();
      await settle();
      document.getElementById('btn-intro-close')?.click();
      await settle();
      if (currentLab !== 'mig') throw new Error('nav click did not load the mig lab');
      details.push('labs-loaded');
      history.back();
      await browserSmokeWaitFor(introShown, 2000);
      if (currentLab !== 'mig' || !introShown()) throw new Error('back did not reopen the mig intro');
      details.push('back-reopens-intro');
      history.back();
      await browserSmokeWaitFor(() => currentLab === 'nvlink', 2000);
      if (currentLab !== 'nvlink') throw new Error('back did not return to the nvlink lab');
      if (introShown()) throw new Error('intro stayed open after backing to nvlink');
      details.push('back-returns-to-previous-lab');
      document.querySelector('[data-workspace-mode="fleet"]')?.click();
      await settle();
      if (document.body.dataset.workspaceMode !== 'fleet') throw new Error('fleet tab did not switch mode');
      history.back();
      await browserSmokeWaitFor(() => document.body.dataset.workspaceMode === 'training', 2000);
      if (document.body.dataset.workspaceMode !== 'training') throw new Error('back did not restore training mode');
      if (currentLab !== 'nvlink') throw new Error('back did not restore the nvlink lab view');
      details.push('back-restores-mode');
      setBrowserSmokeResult('pass', 'history back navigation verified', details);
      return;
    }

    if (scenario === 'progressive_disclosure') {
      const metricsVisible = () => window.getComputedStyle(document.getElementById('metrics-sidebar')).display !== 'none';
      setWorkspaceMode('training', { openFleet: false });
      await browserSmokeWait(80);
      if (metricsVisible()) throw new Error('metrics sidebar visible before any lab is active');
      details.push('metrics-hidden-prelab');
      const termText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!termText.includes('Pick a lab in the left sidebar')) throw new Error('terminal idle hint missing');
      details.push('terminal-idle-hint');
      loadLab('nvlink');
      document.getElementById('btn-intro-close')?.click();
      await browserSmokeWait(80);
      if (!metricsVisible()) throw new Error('metrics sidebar hidden while a lab is active');
      details.push('metrics-visible-in-lab');
      setWorkspaceMode('incident');
      await browserSmokeWait(80);
      if (!metricsVisible()) throw new Error('metrics sidebar hidden in incident mode');
      setWorkspaceMode('training', { openFleet: false });
      details.push('metrics-visible-incident');
      resetAll();
      applyProvisioning();
      await browserSmokeWait(80);
      if (metricsVisible()) throw new Error('metrics sidebar still visible after reset');
      details.push('metrics-hidden-after-reset');
      setBrowserSmokeResult('pass', 'progressive disclosure verified', details);
      return;
    }

    if (scenario === 'landing_hub') {
      const hubVisible = () => document.getElementById('hub-overlay')?.style.display !== 'none';
      localStorage.removeItem('gpusim_hub_seen');
      showLandingHub();
      await browserSmokeWait(80);
      if (!hubVisible()) throw new Error('landing hub did not show');
      details.push('hub-visible');
      document.getElementById('hub-card-learn')?.click();
      await browserSmokeWait(120);
      if (hubVisible()) throw new Error('hub did not dismiss after choosing learn');
      if (!isProvisioned) throw new Error('learn card did not provision the cluster');
      if (document.body.dataset.workspaceMode !== 'training') throw new Error('learn card did not enter training mode');
      if (!currentLab) throw new Error('learn card did not open a first lab');
      if (localStorage.getItem('gpusim_hub_seen') !== 'true') throw new Error('hub seen flag was not set');
      details.push('hub-learn-starts-lab');
      showLandingHub();
      document.getElementById('hub-card-fleet')?.click();
      await browserSmokeWait(120);
      if (document.body.dataset.workspaceMode !== 'fleet') throw new Error('fleet card did not enter fleet mode');
      details.push('hub-fleet-routes');
      showLandingHub();
      document.getElementById('hub-card-blueprint')?.click();
      await browserSmokeWait(80);
      if (document.getElementById('recon-overlay')?.style.display === 'none') throw new Error('blueprint link did not open the recon overlay');
      document.getElementById('btn-apply')?.click();
      details.push('hub-blueprint-path');
      setWorkspaceMode('training', { openFleet: false });
      setBrowserSmokeResult('pass', 'landing hub verified', details);
      return;
    }

    if (scenario === 'learn_hub_merged') {
      const overlayShown = id => !!document.getElementById(id)?.classList.contains('show');
      if (document.getElementById('btn-study') || document.getElementById('btn-quiz') || document.getElementById('sidebar-btn-study')) {
        throw new Error('old learning buttons are still present');
      }
      document.getElementById('btn-learn-hub')?.click();
      await browserSmokeWait(80);
      if (!overlayShown('study-overlay')) throw new Error('Learn button did not open the study guide');
      details.push('learn-hub-study');
      document.querySelector('#study-overlay [data-learn-tab="quiz"]')?.click();
      await browserSmokeWait(80);
      if (!overlayShown('quiz-overlay')) throw new Error('quiz tab did not open the quiz');
      if (overlayShown('study-overlay')) throw new Error('study guide stayed open behind the quiz');
      details.push('learn-hub-quiz');
      document.querySelector('#quiz-overlay [data-learn-tab="study"]')?.click();
      await browserSmokeWait(80);
      if (!overlayShown('study-overlay') || overlayShown('quiz-overlay')) throw new Error('study tab did not switch back from quiz');
      details.push('learn-hub-roundtrip');
      loadLab('nvlink');
      document.getElementById('btn-intro-close')?.click();
      document.getElementById('btn-learn-hub')?.click();
      await browserSmokeWait(80);
      document.querySelector('#study-overlay [data-learn-tab="intro"]')?.click();
      await browserSmokeWait(80);
      if (!overlayShown('intro-overlay')) throw new Error('intro tab did not open the lab intro');
      if (overlayShown('study-overlay')) throw new Error('study guide stayed open behind the lab intro');
      details.push('learn-hub-intro');
      setBrowserSmokeResult('pass', 'merged learn hub verified', details);
      return;
    }

    if (scenario === 'study_progress_empty') {
      openStudyGuide('nca_aiio');
      await browserSmokeWait(80);
      const studyText = String(document.getElementById('study-content')?.textContent || '');
      if (!studyText.includes('Reasoning Progress')) throw new Error('reasoning progress did not render in study guide');
      if (!studyText.includes('Start one lab or quiz')) throw new Error('fresh-user empty state did not render');
      details.push('study-progress-visible');
      details.push('empty-state-visible');
      setBrowserSmokeResult('pass', 'study progress empty state verified', details);
      return;
    }

    if (scenario === 'auth_register_reset') {
      const $ = id => document.getElementById(id);
      const overlayShown = () => $('login-overlay') && $('login-overlay').style.display !== 'none';
      const overlayHidden = () => $('login-overlay') && $('login-overlay').style.display === 'none';
      const revealShown = () => $('login-reveal') && $('login-reveal').style.display !== 'none';
      const codePattern = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
      const uniq = 'smoke_' + Date.now().toString(36);

      showLoginOverlay();
      $('login-toggle').click();
      if ($('login-confirm-row').style.display === 'none') throw new Error('register mode did not reveal confirm field');
      if ($('btn-login').textContent !== 'CREATE ACCOUNT') throw new Error('register mode did not relabel button');
      details.push('register-mode');

      $('login-user').value = uniq;
      $('login-pass').value = 'firstpass1';
      $('login-pass2').value = 'firstpass1';
      $('btn-login').click();
      if (!await browserSmokeWaitFor(revealShown, 10000)) {
        throw new Error('register reveal missing; err=' + String($('login-err')?.textContent || 'none'));
      }
      const code1 = String($('login-reveal-code').textContent || '').trim();
      if (!codePattern.test(code1)) throw new Error('recovery code shape wrong: ' + code1);
      details.push('registered-code-shown');

      $('btn-reveal-continue').click();
      if (!await browserSmokeWaitFor(overlayHidden, 10000)) throw new Error('register did not auto-login');
      details.push('register-auto-login');

      // progress sync roundtrip against the real backend
      localStorage.setItem('gpusim_score', '77');
      markProgressChanged();
      await pushProgressToServer();
      localStorage.removeItem('gpusim_score');
      localStorage.setItem('gpusim_progress_changed_ts', '0');
      await syncProgressOnLogin();
      if (localStorage.getItem('gpusim_score') !== '77') throw new Error('server progress was not restored');
      details.push('progress-sync-roundtrip');

      aegisLogout();
      if (!await browserSmokeWaitFor(overlayShown, 4000)) throw new Error('logout did not show login');
      $('login-forgot').click();
      if ($('login-recovery-row').style.display === 'none') throw new Error('reset mode did not reveal recovery field');
      if ($('btn-login').textContent !== 'RESET PASSWORD') throw new Error('reset mode did not relabel button');
      details.push('reset-mode');

      $('login-user').value = uniq;
      $('login-recovery').value = code1.toLowerCase().replace(/-/g, '');
      $('login-pass').value = 'secondpass2';
      $('login-pass2').value = 'secondpass2';
      $('btn-login').click();
      if (!await browserSmokeWaitFor(revealShown, 10000)) {
        throw new Error('reset reveal missing; err=' + String($('login-err')?.textContent || 'none'));
      }
      const code2 = String($('login-reveal-code').textContent || '').trim();
      if (!codePattern.test(code2)) throw new Error('rotated code shape wrong: ' + code2);
      if (code2 === code1) throw new Error('recovery code did not rotate on reset');
      details.push('reset-code-rotated');

      $('btn-reveal-continue').click();
      if (!await browserSmokeWaitFor(overlayHidden, 10000)) throw new Error('reset did not auto-login');
      details.push('reset-auto-login');

      aegisLogout();
      if (!await browserSmokeWaitFor(overlayShown, 4000)) throw new Error('second logout did not show login');
      $('login-user').value = uniq;
      $('login-pass').value = 'firstpass1';
      $('btn-login').click();
      if (!await browserSmokeWaitFor(() => $('login-err').style.display === 'block', 10000)) {
        throw new Error('old password was not rejected after reset');
      }
      details.push('old-password-rejected');

      $('login-pass').value = 'secondpass2';
      $('btn-login').click();
      if (!await browserSmokeWaitFor(overlayHidden, 10000)) throw new Error('new password login failed');
      details.push('new-password-login');

      setBrowserSmokeResult('pass', 'register + reset flow verified against live backend', details);
      return;
    }

    if (scenario === 'ask_aegis_main') {
      setLabCoachOpen(true);
      loadLab('nvlink');
      runStep('nvlink', 0);
      renderLabStepCoach();
      await browserSmokeWait(80);
      const coach = document.getElementById('lab-step-coach-content');
      if (!String(coach?.textContent || '').includes('Ask Aegis')) throw new Error('Ask Aegis did not render in main coach');
      const askBtn = coach?.querySelector('[data-ask-aegis="owning_layer"]');
      if (!askBtn) throw new Error('owning-layer Ask Aegis button missing');
      askBtn.click();
      await browserSmokeWait(80);
      const coachText = String(coach?.textContent || '');
      if (!coachText.includes('fabric and collective communication')) throw new Error('Ask Aegis main answer did not update');
      details.push('askaegis-main-visible');
      details.push('askaegis-main-updated');
      setBrowserSmokeResult('pass', 'main coach Ask Aegis verified', details);
      return;
    }

    if (scenario === 'ask_aegis_detached') {
      setLabCoachOpen(true);
      loadLab('nvlink');
      runStep('nvlink', 0);
      renderLabStepCoach();
      const popoutBtn = document.getElementById('btn-popout-coach');
      if (!popoutBtn) throw new Error('coach pop-out button missing');
      popoutBtn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
      const detachedReady = await browserSmokeWaitFor(() => {
        const detached = detachedPanels.stepCoach;
        return Boolean(detached && !detached.closed && detached.document?.body?.textContent?.includes('Ask Aegis'));
      }, 3000, 75);
      if (!detachedReady) {
        const detached = detachedPanels.stepCoach;
        const detachedState = !detached
          ? 'missing'
          : detached.closed
            ? 'closed'
            : String(detached.document?.body?.textContent || '').trim().slice(0, 80) || 'blank';
        throw new Error(`detached step coach did not finish rendering (${detachedState})`);
      }
      const detached = detachedPanels.stepCoach;
      if (!detached || detached.closed) throw new Error('detached step coach did not open');
      const detachedDoc = detached.document;
      const detachedText = String(detachedDoc.body?.textContent || '');
      if (!detachedText.includes('Ask Aegis')) throw new Error('Ask Aegis did not render in detached coach');
      const askBtn = detachedDoc.querySelector('[data-ask-aegis="next_check"]');
      if (!askBtn) throw new Error('detached Ask Aegis button missing');
      askBtn.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      }));
      const updated = await browserSmokeWaitFor(() => String(detachedDoc.body?.textContent || '').includes('Notice which GPU pairs should be direct NVLink neighbors.'), 3000, 75);
      if (!updated) throw new Error('detached Ask Aegis answer did not update');
      details.push('askaegis-detached-visible');
      details.push('askaegis-detached-updated');
      detached.close();
      setBrowserSmokeResult('pass', 'detached coach Ask Aegis verified', details);
      return;
    }

    if (scenario === 'analytics_recommendation_transition') {
      seedBrowserSmokeReasoningStep('nvlink', 3, {
        score: 2,
        maxScore: 6,
        layer: 1,
        evidence: 1,
        safety: 0,
      });
      loadLab('nvlink');
      chooseIncidentBranch('nvlink', 3, 'reboot_cluster');
      recordLabCompletionOutcome('nvlink', false);
      openStudyGuide('nca_aiio');
      await browserSmokeWait(100);
      const studyContent = document.getElementById('study-content');
      const initialText = String(studyContent?.textContent || '');
      if (!initialText.includes('Next training focus')) throw new Error('analytics recommendation did not render');
      if (!initialText.includes('Recent risk pattern')) throw new Error('recent risk pattern did not render');
      if (!initialText.includes('Start with the last compromised lab')) throw new Error('initial compromised recommendation wording missing');
      if (!initialText.includes('Picked because your last compromised run was NVLink Topology in fabric path.')) throw new Error('initial recommendation rationale missing');
      if (!initialText.includes('NCCL Fallback Drill')) throw new Error('domain drill recommendation missing');
      details.push('analytics-focus-visible');
      details.push('analytics-risk-visible');
      details.push('analytics-initial-rationale');

      loadLab('nccl_fallback');
      chooseIncidentBranch('nccl_fallback', 0, 'verify_path');
      recordLabCompletionOutcome('nccl_fallback', true);
      openStudyGuide('nca_aiio');
      await browserSmokeWait(100);
      const adaptedText = String(studyContent?.textContent || '');
      if (!adaptedText.includes('You already have clean finishes in fabric path')) throw new Error('same-domain recovery wording missing');
      if (!adaptedText.includes('but you already cleaned up NCCL Fallback Drill in that same domain.')) throw new Error('same-domain rationale missing');
      details.push('analytics-domain-adapted');
      details.push('analytics-recovery-rationale');
      setBrowserSmokeResult('pass', 'analytics recommendation transition verified', details);
      return;
    }

    if (scenario === 'cluster_fleet_layout') {
      openClusterDashboard();
      await browserSmokeWait(120);
      const title = String(document.getElementById('scen-title')?.textContent || '');
      const kpiRail = document.getElementById('cluster-fleet-kpis');
      const sideRail = document.getElementById('cluster-fleet-side');
      const grid = document.getElementById('cluster-dashboard-grid');
      const legacySidebar = document.getElementById('metrics-sidebar');
      const legacySteps = document.getElementById('step-controls');
      if (!title.includes('Cluster Fleet Simulator')) throw new Error('cluster fleet title did not render');
      if (!kpiRail || !sideRail || !grid) throw new Error('cluster fleet layout shell is incomplete');
      if (kpiRail.children.length !== 4) throw new Error(`expected 4 fleet KPI cards, found ${kpiRail.children.length}`);
      if (!String(sideRail.textContent || '').includes('Latest Alerts')) throw new Error('fleet side rail did not render alert content');
      if (grid.children.length !== 8) throw new Error(`expected 8 node cards, found ${grid.children.length}`);
      if (window.getComputedStyle(legacySidebar).display !== 'none') throw new Error('legacy metrics sidebar is still visible during cluster fleet view');
      if (window.getComputedStyle(legacySteps).display !== 'none') throw new Error('legacy step controls are still visible during cluster fleet view');
      const layoutStyle = window.getComputedStyle(document.querySelector('.cluster-fleet-layout'));
      if (!layoutStyle.gridTemplateColumns || layoutStyle.gridTemplateColumns === 'none') throw new Error('fleet layout grid columns did not resolve');
      details.push('fleet-title-visible');
      details.push('fleet-kpi-rail-visible');
      details.push('fleet-side-rail-visible');
      details.push('fleet-grid-visible');
      details.push('legacy-rails-hidden');
      setBrowserSmokeResult('pass', 'cluster fleet layout verified', details);
      return;
    }

    if (scenario === 'quiz_feedback') {
      openQuiz();
      await browserSmokeWait(120);
      const quizContent = document.getElementById('quiz-content');
      if (!quizContent || !String(quizContent.textContent || '').includes('Xid (PCI:0000:83:00): 48')) {
        throw new Error('quiz content did not render');
      }

      document.getElementById('qo-0-0')?.click();
      await browserSmokeWait(80);
      const q1WrongText = String(document.getElementById('qe-0')?.textContent || '');
      if (!q1WrongText.includes('NVLink CRC errors are communication-link problems')) {
        throw new Error('question 1 wrong-answer feedback was not specific');
      }
      if (q1WrongText.includes('missing a specific explanation') || q1WrongText.includes('different failure class')) {
        throw new Error('question 1 wrong-answer feedback fell back to generic text');
      }
      details.push('quiz-q1-wrong-specific');

      document.getElementById('qo-0-1')?.click();
      await browserSmokeWait(80);
      const q1CorrectText = String(document.getElementById('qe-0')?.textContent || '');
      if (!q1CorrectText.includes('XID 48 is the beginner anchor')) {
        throw new Error('question 1 correct-answer teaching feedback missing');
      }
      if (!q1CorrectText.includes('double-bit ECC memory failure')) {
        throw new Error('question 1 correct-answer explanation missing');
      }
      details.push('quiz-q1-correct-teaches');

      document.getElementById('qo-2-1')?.click();
      await browserSmokeWait(80);
      const q3WrongText = String(document.getElementById('qe-2')?.textContent || '');
      if (!q3WrongText.includes('XID 74 is tied to NVLink CRC flit errors')) {
        throw new Error('question 3 XID 74 feedback was not specific');
      }
      if (q3WrongText.includes('missing a specific explanation') || q3WrongText.includes('different failure class')) {
        throw new Error('question 3 XID 74 feedback fell back to generic text');
      }
      details.push('quiz-q3-xid74-specific');

      document.getElementById('qo-2-2')?.click();
      await browserSmokeWait(80);
      const q3CorrectText = String(document.getElementById('qe-2')?.textContent || '');
      if (!q3CorrectText.includes('Fallen off the bus')) {
        throw new Error('question 3 correct-answer teaching feedback missing');
      }
      if (!q3CorrectText.includes('XID 79')) {
        throw new Error('question 3 correct-answer explanation missing XID 79');
      }
      details.push('quiz-q3-correct-teaches');

      setBrowserSmokeResult('pass', 'quiz feedback learning flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_nvlink') {
      loadLab('nvlink');
      selectStep('nvlink', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'nvlink' || currentStep !== 0) throw new Error('failed to enter nvlink terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('terminal help output missing accepted probes');
      if (!helpText.includes('nvidia-smi topo -m')) throw new Error('terminal help output missing topology example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('nvidia-smi -L');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('Useful inventory check')) throw new Error('terminal weak-command guidance missing');
      if (!weakText.includes('Try instead: nvidia-smi topo -m')) throw new Error('terminal weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('nvidia-smi topo -m');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('GPU0     X    NV4')) throw new Error('terminal accepted command did not replay topology evidence');
      if (!acceptedText.includes('NV4 = connected via NVLink (4 links)')) throw new Error('terminal accepted command missing authored topology conclusion');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal nvlink flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_nccl_fallback') {
      loadLab('nccl_fallback');
      selectStep('nccl_fallback', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'nccl_fallback' || currentStep !== 0) throw new Error('failed to enter nccl fallback terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('nccl fallback terminal help missing accepted probes');
      if (!helpText.includes('NCCL_DEBUG=INFO torchrun train.py')) throw new Error('nccl fallback terminal help missing diagnosis example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('nvidia-smi topo -m');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('it does not tell you which transport NCCL actually selected')) throw new Error('nccl fallback weak-command guidance missing');
      if (!weakText.includes('Try instead: NCCL_DEBUG=INFO torchrun train.py')) throw new Error('nccl fallback weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('NCCL_DEBUG=INFO torchrun train.py');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('NCCL WARN Falling back to TCP transport')) throw new Error('nccl fallback accepted command did not replay transport warning');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal nccl fallback flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_k8s') {
      loadLab('k8s');
      selectStep('k8s', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'k8s' || currentStep !== 0) throw new Error('failed to enter k8s terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('k8s terminal help missing accepted probes');
      if (!helpText.includes('kubectl get pods -n gpu-operator')) throw new Error('k8s terminal help missing operator example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('kubectl get nodes');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this lab starts by proving the GPU enablement layer is healthy')) throw new Error('k8s weak-command guidance missing');
      if (!weakText.includes('Try instead: kubectl get pods -n gpu-operator')) throw new Error('k8s weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('kubectl get pods -n gpu-operator');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('nvidia-device-plugin-daemonset   1/1   Running')) throw new Error('k8s accepted command did not replay operator evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal k8s flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_slurm') {
      loadLab('slurm');
      selectStep('slurm', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'slurm' || currentStep !== 0) throw new Error('failed to enter slurm terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('slurm terminal help missing accepted probes');
      if (!helpText.includes('sbatch train.sh')) throw new Error('slurm terminal help missing submission example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('squeue -u $USER');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with handing the job into Slurm control')) throw new Error('slurm weak-command guidance missing');
      if (!weakText.includes('Try instead: sbatch train.sh')) throw new Error('slurm weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('sbatch train.sh');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('Submitted batch job 99234')) throw new Error('slurm accepted command did not replay scheduler submission evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal slurm flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_monitoring') {
      loadLab('monitoring');
      selectStep('monitoring', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'monitoring' || currentStep !== 0) throw new Error('failed to enter monitoring terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('monitoring terminal help missing accepted probes');
      if (!helpText.includes('docker run dcgm-exporter')) throw new Error('monitoring terminal help missing exporter example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('curl localhost:9400/metrics');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts by proving the exporter service itself is up')) throw new Error('monitoring weak-command guidance missing');
      if (!weakText.includes('Try instead: docker run dcgm-exporter')) throw new Error('monitoring weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('docker run dcgm-exporter');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('dcgm-exporter listening on :9400')) throw new Error('monitoring accepted command did not replay exporter evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal monitoring flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_cuda_stack') {
      loadLab('cuda_stack');
      selectStep('cuda_stack', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'cuda_stack' || currentStep !== 0) throw new Error('failed to enter cuda stack terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('cuda stack terminal help missing accepted probes');
      if (!helpText.includes('cat /proc/driver/nvidia/version')) throw new Error('cuda stack terminal help missing driver example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('nvcc --version');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts at the base driver layer of the stack')) throw new Error('cuda stack weak-command guidance missing');
      if (!weakText.includes('Try instead: cat /proc/driver/nvidia/version')) throw new Error('cuda stack weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('cat /proc/driver/nvidia/version');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('NVRM version: NVIDIA UNIX x86_64 Kernel Module  550.54.15')) throw new Error('cuda stack accepted command did not replay driver evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal cuda stack flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_container') {
      loadLab('container');
      selectStep('container', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'container' || currentStep !== 0) throw new Error('failed to enter container terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('container terminal help missing accepted probes');
      if (!helpText.includes('docker pull nvcr.io/nvidia/pytorch')) throw new Error('container terminal help missing image example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('docker run --gpus all');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts by locking the image baseline itself')) throw new Error('container weak-command guidance missing');
      if (!weakText.includes('Try instead: docker pull nvcr.io/nvidia/pytorch')) throw new Error('container weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('docker pull nvcr.io/nvidia/pytorch');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('Status: Image is up to date for nvcr.io/nvidia/pytorch:24.03-py3')) throw new Error('container accepted command did not replay image-baseline evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal container flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_training') {
      loadLab('training');
      selectStep('training', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'training' || currentStep !== 0) throw new Error('failed to enter training terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('training terminal help missing accepted probes');
      if (!helpText.includes('torchrun train.py')) throw new Error('training terminal help missing launch example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('iostat -x 1');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with whether the distributed job can form its rank group at all')) throw new Error('training weak-command guidance missing');
      if (!weakText.includes('Try instead: torchrun train.py')) throw new Error('training weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('torchrun train.py');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('World size 8 established successfully')) throw new Error('training accepted command did not replay DDP launch evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal training flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_allreduce') {
      loadLab('allreduce');
      selectStep('allreduce', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'allreduce' || currentStep !== 0) throw new Error('failed to enter allreduce terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('allreduce terminal help missing accepted probes');
      if (!helpText.includes('NCCL_DEBUG=INFO torchrun train.py')) throw new Error('allreduce terminal help missing path example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('./all_reduce_perf');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with whether NCCL selected the intended collective transport at all')) throw new Error('allreduce weak-command guidance missing');
      if (!weakText.includes('Try instead: NCCL_DEBUG=INFO torchrun train.py')) throw new Error('allreduce weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('NCCL_DEBUG=INFO torchrun train.py');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('NCCL INFO Using network IB')) throw new Error('allreduce accepted command did not replay path evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal allreduce flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_ib_fabric') {
      loadLab('ib_fabric');
      selectStep('ib_fabric', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'ib_fabric' || currentStep !== 0) throw new Error('failed to enter ib fabric terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('ib fabric terminal help missing accepted probes');
      if (!helpText.includes('ibstat')) throw new Error('ib fabric terminal help missing port-state example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('perfquery');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with whether the fabric path is actually up')) throw new Error('ib fabric weak-command guidance missing');
      if (!weakText.includes('Try instead: ibstat')) throw new Error('ib fabric weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('ibstat');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('State: Active')) throw new Error('ib fabric accepted command did not replay active-port evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal ib fabric flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_roce') {
      loadLab('roce');
      selectStep('roce', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'roce' || currentStep !== 0) throw new Error('failed to enter roce terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('roce terminal help missing accepted probes');
      if (!helpText.includes('ip link show eth0')) throw new Error('roce terminal help missing mtu example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('ethtool -A eth0');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with the basic path-alignment signal from MTU')) throw new Error('roce weak-command guidance missing');
      if (!weakText.includes('Try instead: ip link show eth0')) throw new Error('roce weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('ip link show eth0');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('mtu 9000')) throw new Error('roce accepted command did not replay mtu evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal roce flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_storage') {
      loadLab('storage');
      selectStep('storage', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'storage' || currentStep !== 0) throw new Error('failed to enter storage terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('storage terminal help missing accepted probes');
      if (!helpText.includes('nvidia-smi dmon -s u')) throw new Error('storage terminal help missing gpu-util example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('iostat -x 1');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts with the visible starvation symptom on the GPU side')) throw new Error('storage weak-command guidance missing');
      if (!weakText.includes('Try instead: nvidia-smi dmon -s u')) throw new Error('storage weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('nvidia-smi dmon -s u');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('Sawtooth GPU utilization: accelerators are waiting for input')) throw new Error('storage accepted command did not replay sawtooth evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal storage flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_gds') {
      loadLab('gds');
      selectStep('gds', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'gds' || currentStep !== 0) throw new Error('failed to enter gds terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('gds terminal help missing accepted probes');
      if (!helpText.includes('cat /opt/aegis/gds-path.txt')) throw new Error('gds terminal help missing baseline-path example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('python3 -c "import cufile"');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('this checkpoint starts by reading the longer baseline path')) throw new Error('gds weak-command guidance missing');
      if (!weakText.includes('Try instead: cat /opt/aegis/gds-path.txt')) throw new Error('gds weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('cat /opt/aegis/gds-path.txt');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('NVMe read -> page cache / CPU memory')) throw new Error('gds accepted command did not replay traditional-path evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal gds flow verified', details);
      return;
    }

    if (scenario === 'lab_terminal_mig') {
      loadLab('mig');
      selectStep('mig', 0);
      await browserSmokeWait(80);
      if (currentLab !== 'mig' || currentStep !== 0) throw new Error('failed to enter mig terminal step');

      executeLabTerminalCommand('help');
      await browserSmokeWait(80);
      const helpText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!helpText.includes('Accepted probes for the current checkpoint')) throw new Error('mig terminal help missing accepted probes');
      if (!helpText.includes('sudo nvidia-smi -i 0 -mig 1')) throw new Error('mig terminal help missing enablement example');
      details.push('terminal-help-visible');

      executeLabTerminalCommand('nvidia-smi mig -lgi');
      await browserSmokeWait(80);
      const weakText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!weakText.includes('device-level mode change that makes partitioning possible at all')) throw new Error('mig weak-command guidance missing');
      if (!weakText.includes('Try instead: sudo nvidia-smi -i 0 -mig 1')) throw new Error('mig weak-command suggestion missing');
      details.push('terminal-weak-feedback');

      executeLabTerminalCommand('sudo nvidia-smi -i 0 -mig 1');
      await browserSmokeWait(900);
      const acceptedText = String(document.getElementById('terminal-output')?.textContent || '');
      if (!acceptedText.includes('Enabled MIG Mode for GPU 00000000:17:00.0')) throw new Error('mig accepted command did not replay enablement evidence');
      details.push('terminal-accepted-output');

      setBrowserSmokeResult('pass', 'limited terminal mig flow verified', details);
      return;
    }

    const scenarios = {
      ecc_best: { labId: 'ecc', stepIdx: 3, choiceId: 'contain', expectedEffect: 'best', expectDetour: false },
      ecc_warn: { labId: 'ecc', stepIdx: 3, choiceId: 'retry', expectedRedirect: 'ECC Containment Decision', expectedChainLength: 2, expectedEffect: 'warn', expectDetour: true },
      ecc_bad: { labId: 'ecc', stepIdx: 3, choiceId: 'broad_fix', expectedRedirect: 'ECC Containment Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      nvlink_best: { labId: 'nvlink', stepIdx: 3, choiceId: 'verify_path', expectedEffect: 'best', expectDetour: false },
      nvlink_warn: { labId: 'nvlink', stepIdx: 3, choiceId: 'tune_model', expectedRedirect: 'Fabric Rejoin Decision', expectedChainLength: 2, expectedEffect: 'warn', expectDetour: true },
      nvlink_bad: { labId: 'nvlink', stepIdx: 3, choiceId: 'reboot_cluster', expectedRedirect: 'Fabric Rejoin Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      nccl_fallback_best: { labId: 'nccl_fallback', stepIdx: 0, choiceId: 'verify_path', expectedEffect: 'best', expectDetour: false },
      nccl_fallback: { labId: 'nccl_fallback', stepIdx: 0, choiceId: 'reboot_cluster', expectedRedirect: 'Transport Rejoin Decision', expectedChainLength: 1, expectedEffect: 'bad', expectDetour: true },
      storage_best: { labId: 'storage', stepIdx: 0, choiceId: 'trace_upstream', expectedEffect: 'best', expectDetour: false },
      storage_warn: { labId: 'storage', stepIdx: 0, choiceId: 'lower_expectations', expectedRedirect: 'Feed Path Rejoin Decision', expectedChainLength: 1, expectedEffect: 'warn', expectDetour: true },
      storage_bad: { labId: 'storage', stepIdx: 0, choiceId: 'swap_gpu_settings', expectedRedirect: 'Feed Path Rejoin Decision', expectedChainLength: 1, expectedEffect: 'bad', expectDetour: true },
      cuda_stack_best: { labId: 'cuda_stack', stepIdx: 3, choiceId: 'own_boundary', expectedEffect: 'best', expectDetour: false },
      cuda_stack_bad: { labId: 'cuda_stack', stepIdx: 3, choiceId: 'rebuild_everything', expectedRedirect: 'Stack Contract Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      k8s_best: { labId: 'k8s', stepIdx: 2, choiceId: 'own_boundary', expectedEffect: 'best', expectDetour: false },
      k8s_bad: { labId: 'k8s', stepIdx: 2, choiceId: 'rebuild_everything', expectedRedirect: 'GPU Placement Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      slurm_best: { labId: 'slurm', stepIdx: 2, choiceId: 'own_boundary', expectedEffect: 'best', expectDetour: false },
      slurm_bad: { labId: 'slurm', stepIdx: 2, choiceId: 'rebuild_everything', expectedRedirect: 'Scheduler Ownership Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      allreduce_bad: { labId: 'allreduce', stepIdx: 3, choiceId: 'reboot_cluster', expectedRedirect: 'Collective Rejoin Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
      ib_fabric_bad: { labId: 'ib_fabric', stepIdx: 3, choiceId: 'reboot_cluster', expectedRedirect: 'Fabric Availability Decision', expectedChainLength: 2, expectedEffect: 'bad', expectDetour: true },
    };
    const config = scenarios[scenario];
    if (!config) throw new Error(`unknown browser smoke scenario: ${scenario}`);

    loadLab(config.labId);
    runStep(config.labId, config.stepIdx);
    if (currentLab !== config.labId || currentStep !== config.stepIdx) throw new Error(`failed to enter scenario step for ${config.labId}`);
    details.push(`entered-${config.labId}-step-${config.stepIdx + 1}`);

    chooseIncidentBranch(config.labId, config.stepIdx, config.choiceId);
    const selectedChoice = getSelectedBranchChoice(config.labId, config.stepIdx);
    if (selectedChoice?.id !== config.choiceId) throw new Error('failed to persist branch choice');
    if (selectedChoice?.effect !== config.expectedEffect) throw new Error(`branch effect mismatch: expected ${config.expectedEffect}, got ${selectedChoice?.effect || 'none'}`);
    details.push(`selected-${config.choiceId}`);
    details.push(`effect-${selectedChoice.effect}`);

    const branchContext = getBranchConsequenceContext(config.labId, config.stepIdx + 1);
    if (config.expectedEffect === 'warn' && branchContext.warnCount < 1) throw new Error('warn branch context was not recorded');
    if (config.expectedEffect === 'bad' && branchContext.badCount < 1) throw new Error('bad branch context was not recorded');
    details.push(`context-warn-${branchContext.warnCount}`);
    details.push(`context-bad-${branchContext.badCount}`);

    runCurrentStep();
    await browserSmokeWait(80);
    if (!config.expectDetour) {
      if (currentStep !== config.stepIdx + 1) throw new Error(`best-path step did not advance normally, currentStep=${currentStep}`);
      if (activeMainRedirectStep) throw new Error('best-path unexpectedly created redirected main step');
      if (String(document.getElementById('scen-step')?.textContent || '').includes('Recovery detour')) {
        throw new Error('best-path unexpectedly rendered recovery detour');
      }
      details.push('normal-advance');
      details.push('no-detour');
      setBrowserSmokeResult('pass', `${scenario} best-path stayed on normal route`, details);
      return;
    }

    if (!String(document.getElementById('scen-step')?.textContent || '').includes('Recovery detour')) throw new Error('detour step did not render');
    details.push('detour-rendered');

    for (let idx = 1; idx <= config.expectedChainLength; idx += 1) {
      runCurrentStep();
      await browserSmokeWait(50);
      if (!String(document.getElementById('scen-step')?.textContent || '').includes(`Recovery chain step ${idx}/${config.expectedChainLength}`)) {
        throw new Error(`recovery-chain step ${idx}/${config.expectedChainLength} did not render`);
      }
      details.push(`chain-step-${idx}`);
    }

    runCurrentStep();
    await browserSmokeWait(700);
    if (currentStep !== config.stepIdx + 1) throw new Error(`redirected main step did not advance to step ${config.stepIdx + 2}, currentStep=${currentStep}`);
    if (!activeMainRedirectStep || activeMainRedirectStep.label !== config.expectedRedirect) throw new Error('redirected main step state is missing');
    if (!String(document.getElementById('scen-desc')?.textContent || '').includes('Redirected recovery-aware main path')) throw new Error('redirected main step description missing');
    details.push('redirected-main-step');

    setBrowserSmokeResult('pass', `${scenario} branch chain and redirected main step verified`, details);
  } catch (err) {
    details.push(`error=${err.message}`);
    setBrowserSmokeResult('fail', err.message, details);
  }
}

function getBranchDetourMessage(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  const domain = getBranchConsequenceContext(labId, stepIdx).dominantDomain;
  if (!choice) return null;
  if (domain === 'fault_isolation') {
    return choice.effect === 'bad'
      ? 'Recovery detour: re-establish containment, stop new workload placement, and rebuild the evidence trail before advancing.'
      : 'Recovery detour: confirm containment now so the next step starts from a controlled incident state.';
  }
  if (domain === 'fabric_path') {
    return choice.effect === 'bad'
      ? 'Recovery detour: verify the transport path and clear the wrong-layer tuning loop before the lab proceeds.'
      : 'Recovery detour: confirm the communication route so the next stage is grounded in path evidence instead of guesswork.';
  }
  if (domain === 'runtime_delivery') {
    return choice.effect === 'bad'
      ? 'Recovery detour: re-narrow the broken boundary before any more stack changes accumulate.'
      : 'Recovery detour: validate the software contract edge so the next step is not built on a vague layer call.';
  }
  if (domain === 'platform_efficiency') {
    return choice.effect === 'bad'
      ? 'Recovery detour: trace the feed path first and stop treating compute settings as the primary fix.'
      : 'Recovery detour: re-check the upstream bottleneck so the next stage is not measured on a distorted baseline.';
  }
  return choice.effect === 'bad'
    ? 'Recovery detour: collect a stronger clue and unwind the earlier over-broad move before continuing.'
    : 'Recovery detour: resolve the ambiguity before the lab advances.';
}

function getBranchDetourPlaybook(labId, stepIdx) {
  if (BRANCH_DETOUR_PLAYBOOKS[labId]) return BRANCH_DETOUR_PLAYBOOKS[labId];
  const domain = getBranchConsequenceContext(labId, stepIdx).dominantDomain || 'general_diagnosis';
  return BRANCH_DETOUR_PLAYBOOKS[domain] || BRANCH_DETOUR_PLAYBOOKS.general_diagnosis;
}

function getBranchStepModifier(labId, stepIdx) {
  if (!labId || typeof stepIdx !== 'number' || stepIdx <= 0) return null;
  const context = getBranchConsequenceContext(labId, stepIdx);
  if (!context.hasPenalty) return null;
  return BRANCH_STEP_MODIFIERS[labId] || null;
}

function renderBranchRouteStatus(labId, stepIdx) {
  const choice = getSelectedBranchChoice(labId, stepIdx);
  if (!choice) return '';
  const pending = isBranchDetourPending(labId, stepIdx);
  const playbook = getBranchDetourPlaybook(labId, stepIdx);
  return `
    <section class="branch-route-status">
      <div class="branch-route-status-title">${pending ? 'Route Change Pending' : 'Route Change Recorded'}</div>
      <p><strong>${escHtml(playbook.title)}</strong></p>
      <p>${escHtml(getBranchDetourMessage(labId, stepIdx) || '')}</p>
      <p>${escHtml(pending ? 'The next Run will go through a recovery detour before the lab advances.' : 'A recovery detour was required before this lab could continue normally.')}</p>
    </section>
  `;
}

function chooseIncidentBranch(labId, stepIdx, choiceId) {
  if (!labId || typeof stepIdx !== 'number' || !choiceId) return;
  branchingState[getBranchingKey(labId, stepIdx)] = choiceId;
  persistBranchingState();
  renderLabStepCoach();
}

function renderConsequenceBranch(labId, step, stepIdx, options = {}) {
  if (!labId || typeof stepIdx !== 'number' || !step) return '';
  const branch = getConsequenceBranch(labId, step);
  const selectedId = branchingState[getBranchingKey(labId, stepIdx)];
  const selectedChoice = branch.choices.find(item => item.id === selectedId) || null;
  const title = options.title || 'Decision Drill';
  const subtitle = options.subtitle || 'Choose the next move. Aegis will show what that operator choice does to the incident, not just whether it sounds plausible.';
  return `
    <section class="consequence-branch">
      <div class="consequence-branch-title">${escHtml(title)}</div>
      <div class="consequence-branch-subtitle">${escHtml(subtitle)}</div>
      <div class="consequence-branch-prompt">${escHtml(branch.prompt)}</div>
      <div class="consequence-branch-grid">
        ${branch.choices.map(choice => `
          <button
            type="button"
            class="consequence-choice${selectedId === choice.id ? ' is-selected' : ''}"
            data-branch-choice="${escHtml(choice.id)}"
            data-branch-lab="${escHtml(labId)}"
            data-branch-step="${stepIdx}"
          >
            <span>${escHtml(choice.label)}</span>
          </button>
        `).join('')}
      </div>
      ${selectedChoice ? `
        <div class="consequence-outcome consequence-outcome-${escHtml(selectedChoice.effect)}">
          <div class="consequence-outcome-title">${selectedChoice.effect === 'best' ? 'Operational Result' : selectedChoice.effect === 'warn' ? 'Operational Risk' : 'Operational Consequence'}</div>
          <p>${escHtml(tightenDisplayCopy(selectedChoice.outcome))}</p>
        </div>
      ` : `
        <div class="consequence-outcome consequence-outcome-idle">
          <div class="consequence-outcome-title">Make the call</div>
          <p>Pick one path to see the downstream operational consequence.</p>
        </div>
      `}
    </section>
  `;
}

function runBranchDetour(labId, stepIdx) {
  const lab = LABS[labId];
  const choice = getSelectedBranchChoice(labId, stepIdx);
  const playbook = getBranchDetourPlaybook(labId, stepIdx);
  if (!lab || !choice) return false;

  switchTab('term');
  clearTerminal();
  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Recovery detour after Step ${stepIdx + 1}/${lab.steps.length}`;
  document.getElementById('scen-desc').textContent = playbook.desc;
  logTerm([{ t: 'warn', v: `# ${playbook.title}` }]);
  playbook.commands.forEach(cmd => logTerm([{ t: 'cmd', v: cmd }]));
  logTerm([{ t: 'warn', v: getBranchDetourMessage(labId, stepIdx) || 'Recovery detour in progress.' }]);
  playbook.terminal.forEach(line => logTerm([{ t: 'dim', v: line }]));
  scrollTerminal();

  const log = document.getElementById('xid-log-entries');
  if (log) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = `xid-entry ${choice.effect === 'bad' ? 'crit' : 'warn'}`;
    entry.textContent = `[${time}] ${playbook.title} inserted before the next stage`;
    log.prepend(entry);
    while (log.children.length > 8) log.removeChild(log.lastChild);
  }

  markBranchDetourDone(labId, stepIdx);
  renderLabStepCoach();
  return true;
}

function runAlternateBranchStep(labId, stepIdx) {
  const chain = getAlternateBranchChain(labId);
  const progress = branchingState[getBranchMetaKey(labId, stepIdx, 'alt_progress')] || 0;
  const template = chain[progress];
  if (!template) return false;
  activeAlternateStep = {
    ...template,
    branchSourceStep: stepIdx,
    alternateChainIndex: progress + 1,
    alternateChainLength: chain.length,
  };
  switchTab('term');
  clearTerminal();
  document.getElementById('scen-step').style.display = '';
  document.getElementById('scen-step').textContent = `Recovery chain step ${progress + 1}/${chain.length} after Step ${stepIdx + 1}`;
  document.getElementById('scen-desc').textContent = `${template.label} (${progress + 1}/${chain.length})`;
  logTerm([{ t: 'warn', v: `# ${template.label}` }, { t: 'cmd', v: template.cmd }]);
  getStepOutput(activeAlternateStep).forEach(line => logTerm([line]));
  scrollTerminal();
  markAlternateBranchStepDone(labId, stepIdx);
  renderLabStepCoach();
  return true;
}
