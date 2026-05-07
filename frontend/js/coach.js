function inferOwningLayer(labId) {
  if (['ecc', 'nvlink_fault', 'mig', 'monitoring'].includes(labId)) return 'hardware and fault isolation';
  if (['nvlink', 'allreduce', 'nccl_fallback', 'ib_fabric', 'roce'].includes(labId)) return 'fabric and collective communication';
  if (['cuda_stack', 'container', 'k8s', 'slurm'].includes(labId)) return 'runtime delivery and workload placement';
  if (['storage', 'gds', 'training'].includes(labId)) return 'data path and platform efficiency';
  return 'the currently visible infrastructure layer';
}

function getCurrentLabStep() {
  const lab = currentLab ? LABS[currentLab] : null;
  if (!lab || currentStep < 0) return null;
  return activeAlternateStep || activeMainRedirectStep || lab.steps[currentStep] || null;
}

function sanitizeAskAegisUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

function getDeterministicAskAegisResponse(intent, labId, step, stepIdx) {
  if (!labId || !step) {
    return 'Ask Aegis becomes available once a lab step is active.';
  }
  const clues = getKeyOutputClues(step);
  const firstClue = clues[0];
  const secondClue = clues[1];
  const layer = inferOwningLayer(labId);
  const nextCheck = (step.takeAction && step.takeAction[0]) || (step.lookFor && step.lookFor[0]) || 'Compare the current output with the step goal before advancing.';
  const branchChoice = getSelectedBranchChoice(labId, stepIdx);

  if (intent === 'what_changed') {
    return firstClue
      ? `The main change on this step is ${firstClue.text}. Aegis reads that as: ${firstClue.meaning}`
      : 'The current step is mainly about comparing the visible output against the expected healthy or degraded state.';
  }

  if (intent === 'owning_layer') {
    return secondClue
      ? `The current evidence points first to ${layer}. The strongest visible clue after the main signal is ${secondClue.text}`
      : `The current evidence points first to ${layer}. Keep the diagnosis in that layer before changing anything broader.`;
  }

  if (intent === 'next_check') {
    return `The next operator check is: ${tightenDisplayCopy(nextCheck)}`;
  }

  if (intent === 'branch_reason') {
    if (!branchChoice) {
      return 'No branch choice is recorded on this step yet. Pick a Decision Drill option first, then Ask Aegis can explain the consequence.';
    }
    const penalty = getBranchPenaltyMessages(labId, stepIdx)[0];
    return branchChoice.effect === 'best'
      ? 'That branch is currently scored as strong because it keeps the incident narrow and evidence-led.'
      : penalty || 'That branch is weak because it adds ambiguity before the owning layer is fully clear.';
  }

  return 'Aegis can currently answer only from the active lab evidence, the current step goal, and any branch choices recorded on this step.';
}

function getAskAegisResponse(intent, labId, step, stepIdx) {
  return getDeterministicAskAegisResponse(intent, labId, step, stepIdx);
}

function getAskAegisSuggestions(labId, step, stepIdx) {
  return [
    {
      id: 'what_changed',
      label: 'What changed?',
      prompt: 'What changed in this step, and why does it matter operationally?',
      fallback: getDeterministicAskAegisResponse('what_changed', labId, step, stepIdx),
    },
    {
      id: 'owning_layer',
      label: 'Which layer owns this?',
      prompt: 'Which infrastructure layer owns this symptom first, based on the current evidence?',
      fallback: getDeterministicAskAegisResponse('owning_layer', labId, step, stepIdx),
    },
    {
      id: 'next_check',
      label: 'What should I check next?',
      prompt: 'What is the next safe check before I change anything broader?',
      fallback: getDeterministicAskAegisResponse('next_check', labId, step, stepIdx),
    },
    {
      id: 'branch_reason',
      label: 'Why is this branch scored this way?',
      prompt: 'Why is this branch scored this way, and what evidence is it protecting?',
      fallback: getDeterministicAskAegisResponse('branch_reason', labId, step, stepIdx),
    },
  ];
}

function getAskAegisContextKey(labId, stepIdx) {
  return `${labId || 'none'}:${Number.isFinite(stepIdx) ? stepIdx : -1}`;
}

function ensureAskAegisState(labId, step, stepIdx) {
  const contextKey = getAskAegisContextKey(labId, stepIdx);
  if (askAegisState.contextKey === contextKey) return;
  askAegisState = {
    contextKey,
    question: '',
    answer: 'Ask Aegis can analyze the current lab evidence, reuse the diagnosis path, and cite the checked-in NVIDIA references.',
    source: JWT_TOKEN ? 'grounded-assistant-ready' : 'deterministic-coach',
    references: [],
    loading: false,
    error: '',
  };
}

function extractAskAegisFaultCode(question, visibleEvidence) {
  const match = String([question, ...(visibleEvidence || [])].join('\n')).match(/\bXid[^0-9]*(\d{1,4})\b/i)
    || String([question, ...(visibleEvidence || [])].join('\n')).match(/\bXID\s*(\d{1,4})\b/i);
  return match ? match[1] : '';
}

function buildAskAegisRequestContext(intent, labId, step, stepIdx) {
  const branchChoice = getSelectedBranchChoice(labId, stepIdx);
  return {
    ask_intent: intent || '',
    inferred_layer: inferOwningLayer(labId),
    next_check_hint: (step?.takeAction && step.takeAction[0]) || (step?.lookFor && step.lookFor[0]) || '',
    branch_effect: branchChoice?.effect || '',
    branch_choice_label: branchChoice?.label || '',
    branch_penalty: getBranchPenaltyMessages(labId, stepIdx)[0] || '',
  };
}

async function requestAskAegisAnswer(labId, step, stepIdx, question, fallbackText = '', options = {}) {
  ensureAskAegisState(labId, step, stepIdx);
  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) return;

  const visibleEvidence = getAskAegisVisibleEvidence(step);
  const requestContext = buildAskAegisRequestContext(options.intent || '', labId, step, stepIdx);
  askAegisState = {
    ...askAegisState,
    question: trimmedQuestion,
    answer: 'Grounding the current evidence and diagnosis path...',
    source: 'loading',
    references: [],
    loading: true,
    error: '',
  };
  renderLabStepCoach();
  renderDetachedPanel('stepCoach');

  if (!JWT_TOKEN) {
    askAegisState = {
      ...askAegisState,
      answer: fallbackText || 'Log in to use the grounded assistant. Local coach guidance is still available for the current step.',
      source: 'deterministic-coach',
      references: [],
      loading: false,
      error: '',
    };
    renderLabStepCoach();
    renderDetachedPanel('stepCoach');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/ask-aegis`, {
      method: 'POST',
      headers: { ...authHdr(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: trimmedQuestion,
        lab_id: labId,
        step_title: step?.label || '',
        visible_evidence: visibleEvidence,
        fault_code: extractAskAegisFaultCode(trimmedQuestion, visibleEvidence),
        ask_intent: requestContext.ask_intent,
        inferred_layer: requestContext.inferred_layer,
        next_check_hint: requestContext.next_check_hint,
        branch_effect: requestContext.branch_effect,
        branch_choice_label: requestContext.branch_choice_label,
        branch_penalty: requestContext.branch_penalty,
        allow_llm: llmDiagnosisEnabled && backendLLMAvailable,
      }),
    });
    if (response.status === 401) {
      handle401();
      return;
    }
    const rawBody = await response.text();
    let data = {};
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch (_) {
      data = {};
    }
    if (!response.ok) {
      const detail = data.detail || rawBody.trim() || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    askAegisState = {
      ...askAegisState,
      answer: data.answer || fallbackText || 'Ask Aegis did not return an answer.',
      source: data.answer_source || 'grounded-assistant',
      references: Array.isArray(data.official_references) ? data.official_references : [],
      loading: false,
      error: '',
    };
  } catch (error) {
    askAegisState = {
      ...askAegisState,
      answer: fallbackText || 'Ask Aegis could not reach the grounded backend, so it fell back to local coach guidance.',
      source: 'deterministic-fallback',
      references: [],
      loading: false,
      error: error.message,
    };
  }
  renderLabStepCoach();
  renderDetachedPanel('stepCoach');
}

function renderAskAegisBlock(labId, step, stepIdx) {
  if (!labId || !step) return '';
  ensureAskAegisState(labId, step, stepIdx);
  const suggestions = getAskAegisSuggestions(labId, step, stepIdx);
  const references = (askAegisState.references || []).map(ref => `
    <li>
      <strong>${escHtml(ref.title || 'NVIDIA reference')}</strong>${sanitizeAskAegisUrl(ref.url) ? ` <a href="${sanitizeAskAegisUrl(ref.url)}" target="_blank" rel="noreferrer">Source</a>` : ''}:
      ${escHtml(ref.excerpt || '')}
    </li>
  `).join('');
  const statusLabel = askAegisState.loading
    ? 'Grounding...'
    : askAegisState.source === 'deterministic-coach'
      ? 'Local coach'
      : askAegisState.source === 'deterministic-fallback'
        ? 'Fallback'
        : 'Grounded';
  return `
    <section class="lab-step-coach-section ask-aegis">
      <div class="ask-aegis-head">
        <div>
          <div class="lab-step-coach-section-title ask-aegis-title">Ask Aegis</div>
          <div class="ask-aegis-subtitle">Grounded in the current lab state, the diagnosis path, and checked-in NVIDIA documentation when authenticated.</div>
        </div>
        <div class="ask-aegis-badge">${escHtml(statusLabel)}</div>
      </div>
      <div class="ask-aegis-actions">
        ${suggestions.map(intent => `
          <button
            type="button"
            class="ask-aegis-btn"
            data-ask-aegis="${escHtml(intent.id)}"
            data-ask-aegis-prompt="${escHtml(intent.prompt)}"
            data-ask-aegis-intent="${escHtml(intent.id)}"
          >${escHtml(intent.label)}</button>
        `).join('')}
      </div>
      <div class="ask-aegis-query">
        <textarea class="ask-aegis-input" data-ask-aegis-input rows="3" placeholder="Ask a grounded question about the current evidence...">${escHtml(askAegisState.question || '')}</textarea>
        <button type="button" class="ask-aegis-submit" data-ask-aegis-submit="1"${askAegisState.loading ? ' disabled' : ''}>Ask</button>
      </div>
      <div class="ask-aegis-answer">${escHtml(askAegisState.answer || 'Ask Aegis can analyze the current lab evidence.')}</div>
      ${askAegisState.error ? `<div class="ask-aegis-subtitle">${escHtml(askAegisState.error)}</div>` : ''}
      ${references ? `<ul class="guided-step-list ask-aegis-sources">${references}</ul>` : ''}
    </section>
  `;
}

function handleLabCoachClick(event) {
  if (event.target.closest('#btn-close-coach') || event.target.closest('.lab-step-coach-close')) {
    event.preventDefault();
    event.stopPropagation();
    setLabCoachOpen(false);
    return;
  }

  const choice = event.target.closest('[data-branch-choice]');
  if (choice) {
    event.preventDefault();
    event.stopPropagation();
    chooseIncidentBranch(choice.dataset.branchLab, Number(choice.dataset.branchStep), choice.dataset.branchChoice);
    return;
  }

  const askBtn = event.target.closest('[data-ask-aegis]');
  if (askBtn) {
    event.preventDefault();
    event.stopPropagation();
    requestAskAegisAnswer(
      currentLab,
      getCurrentLabStep(),
      currentStep,
      askBtn.dataset.askAegisPrompt || '',
      getAskAegisSuggestions(currentLab, getCurrentLabStep(), currentStep).find(item => item.id === askBtn.dataset.askAegis)?.fallback || '',
      { intent: askBtn.dataset.askAegisIntent || '' },
    );
    return;
  }

  const submitBtn = event.target.closest('[data-ask-aegis-submit]');
  if (submitBtn) {
    event.preventDefault();
    event.stopPropagation();
    const container = event.target.closest('.ask-aegis');
    const input = container?.querySelector('[data-ask-aegis-input]');
    requestAskAegisAnswer(
      currentLab,
      getCurrentLabStep(),
      currentStep,
      input?.value || '',
      'Ask Aegis could not use the grounded backend, so no answer was produced for the custom question.',
      {},
    );
  }
}

function renderBulletList(items, cssClass) {
  if (!items || !items.length) return '';
  return `<ul class="${cssClass}">${items.map(item => `<li>${escHtml(tightenDisplayCopy(item))}</li>`).join('')}</ul>`;
}

function renderParagraphs(items) {
  if (!items || !items.length) return '';
  return items.map(item => `<p>${escHtml(tightenDisplayCopy(item))}</p>`).join('');
}

function isDetachedPanelOpen(kind) {
  const win = detachedPanels[kind];
  return !!(win && !win.closed);
}

function syncDetachedPanelButtons() {
  const liveBtn = document.getElementById('btn-popout-live-explainer');
  if (liveBtn) {
    liveBtn.classList.toggle('active', isDetachedPanelOpen('liveExplainer'));
    liveBtn.textContent = isDetachedPanelOpen('liveExplainer') ? 'Detached' : 'Pop out';
  }
  const coachBtn = document.getElementById('btn-popout-coach');
  if (coachBtn) {
    coachBtn.classList.toggle('active', isDetachedPanelOpen('stepCoach'));
    coachBtn.textContent = isDetachedPanelOpen('stepCoach') ? 'Detached' : 'Pop out';
  }
  ['introOverlay', 'studyOverlay', 'quizOverlay'].forEach(kind => {
    const id = kind === 'introOverlay'
      ? 'btn-popout-intro'
      : kind === 'studyOverlay'
        ? 'btn-popout-study'
        : 'btn-popout-quiz';
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('active', isDetachedPanelOpen(kind));
    btn.textContent = isDetachedPanelOpen(kind) ? 'Detached' : 'Pop out';
  });
}

function getDetachedPanelSnapshot(kind) {
  if (kind === 'liveExplainer') {
    return {
      title: 'Live Explain',
      kicker: 'Telemetry Guide',
      shellClass: 'metric-group live-explainer',
      bodyHtml: document.getElementById('live-explainer-body')?.innerHTML || '<p>Live explanation is unavailable.</p>',
    };
  }

  if (kind === 'introOverlay') {
    return {
      title: document.querySelector('#intro-content h2')?.textContent || 'Lab Guide',
      shellClass: 'panel lab-intro detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        ${document.getElementById('intro-content')?.innerHTML || '<p>Lab guide is unavailable.</p>'}
        <div style="display:flex;gap:8px;margin-top:20px">
          <button class="btn-sm" id="btn-detached-intro-skip" type="button">Skip Intro</button>
          <button class="btn-sm primary" id="btn-detached-intro-start" type="button">▶ Start Lab</button>
        </div>
      `,
    };
  }

  if (kind === 'studyOverlay') {
    return {
      title: document.querySelector('#study-panel h2')?.textContent || 'Exam Prep',
      shellClass: 'panel study-panel detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        <div class="study-panel-header">
          <h2>${escHtml(document.querySelector('#study-panel h2')?.textContent || 'NVIDIA Exam Prep')}</h2>
          <p>${escHtml(document.getElementById('study-panel-subtitle')?.textContent || '')}</p>
        </div>
        ${document.getElementById('study-content')?.innerHTML || '<p>Study guide unavailable.</p>'}
      `,
    };
  }

  if (kind === 'quizOverlay') {
    return {
      title: document.querySelector('#quiz-panel h2')?.textContent || 'Practice Quiz',
      shellClass: 'panel quiz-panel detached-overlay-panel',
      bodyHtml: `
        <div class="panel-tools">
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
          <button class="close-btn" id="btn-detached-close" type="button">✕</button>
        </div>
        <div class="quiz-panel-header">
          <h2>${escHtml(document.querySelector('#quiz-panel h2')?.textContent || 'NCA-AIIO Practice Quiz')}</h2>
          <p>${escHtml(document.querySelector('#quiz-panel .quiz-panel-header p')?.textContent || '')}</p>
        </div>
        ${document.getElementById('quiz-content')?.innerHTML || '<p>Quiz unavailable.</p>'}
      `,
    };
  }

  return {
    title: document.querySelector('#lab-step-coach .lab-step-coach-title')?.textContent || 'Lab Guide',
    kicker: document.querySelector('#lab-step-coach .lab-step-coach-kicker')?.textContent || 'Lab Coach',
    shellClass: 'lab-step-coach-shell',
    bodyHtml: document.getElementById('lab-step-coach-content')?.innerHTML || '<p>Lab guide is unavailable.</p>',
  };
}

function renderDetachedPanel(kind) {
  const win = detachedPanels[kind];
  if (!win || win.closed) {
    detachedPanels[kind] = null;
    syncDetachedPanelButtons();
    return;
  }

  const snapshot = getDetachedPanelSnapshot(kind);
  const doc = win.document;

  if (!doc.getElementById('detached-panel-root')) {
    doc.open();
    doc.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aegis ${escHtml(snapshot.title)}</title>
  <link rel="stylesheet" href="css/styles.css?v=20260423c">
</head>
<body class="detached-panel-window">
  <div class="detached-panel-frame" id="detached-panel-root"></div>
</body>
</html>`);
    doc.close();
    win.addEventListener('beforeunload', () => {
      detachedPanels[kind] = null;
      syncDetachedPanelButtons();
    });
  }

  const root = doc.getElementById('detached-panel-root');
  if (!root) return;

  if (kind === 'liveExplainer') {
    root.innerHTML = `
      <section class="${snapshot.shellClass}">
        <div class="metric-group-title metric-group-title-row">
          <span>${escHtml(snapshot.title)}</span>
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
        </div>
        <div class="live-explainer-body">${snapshot.bodyHtml}</div>
      </section>
    `;
  } else if (kind === 'stepCoach') {
    root.innerHTML = `
      <section class="${snapshot.shellClass}">
        <div class="lab-step-coach-topbar">
          <div>
            <div class="lab-step-coach-kicker">${escHtml(snapshot.kicker)}</div>
            <div class="lab-step-coach-title">${escHtml(snapshot.title)}</div>
          </div>
          <button class="panel-popout-btn" id="btn-detached-focus-main" type="button">Focus App</button>
        </div>
        <div class="lab-step-coach-content">${snapshot.bodyHtml}</div>
      </section>
    `;
  } else {
    root.innerHTML = `<section class="${snapshot.shellClass}">${snapshot.bodyHtml}</section>`;
  }

  const focusBtn = doc.getElementById('btn-detached-focus-main');
  if (focusBtn) focusBtn.onclick = () => window.focus();
  const closeBtn = doc.getElementById('btn-detached-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (kind === 'introOverlay') closeIntro();
      if (kind === 'studyOverlay') closeStudyGuide();
      if (kind === 'quizOverlay') closeQuiz();
      win.close();
    };
  }
  if (kind === 'introOverlay') {
    const skipBtn = doc.getElementById('btn-detached-intro-skip');
    if (skipBtn) skipBtn.onclick = () => { closeIntro(); win.close(); };
    const startBtn = doc.getElementById('btn-detached-intro-start');
    if (startBtn) startBtn.onclick = () => { startLab(); win.close(); };
  }
  if (kind === 'studyOverlay') {
    const detachedStudyRoot = doc.querySelector('.detached-overlay-panel');
    if (detachedStudyRoot) detachedStudyRoot.onclick = event => {
      const studyAction = event.target.closest('[data-study-action]');
      if (studyAction?.dataset.studyAction === 'export-report') {
        downloadReasoningProgressReport();
        renderDetachedPanel('studyOverlay');
        return;
      }
      const labLink = event.target.closest('[data-study-lab]');
      if (!labLink) return;
      openStudyLab(labLink.dataset.studyLab);
      win.close();
    };
  }
  if (kind === 'stepCoach') {
    const detachedCoachRoot = doc.querySelector('.lab-step-coach-shell');
    if (detachedCoachRoot) detachedCoachRoot.onclick = event => {
      const askBtn = event.target.closest('[data-ask-aegis]');
      if (askBtn) {
        requestAskAegisAnswer(
          currentLab,
          getCurrentLabStep(),
          currentStep,
          askBtn.dataset.askAegisPrompt || '',
          getAskAegisSuggestions(currentLab, getCurrentLabStep(), currentStep).find(item => item.id === askBtn.dataset.askAegis)?.fallback || '',
          { intent: askBtn.dataset.askAegisIntent || '' },
        );
        return;
      }
      const submitBtn = event.target.closest('[data-ask-aegis-submit]');
      if (!submitBtn) return;
      const input = detachedCoachRoot.querySelector('[data-ask-aegis-input]');
      requestAskAegisAnswer(
        currentLab,
        getCurrentLabStep(),
        currentStep,
        input?.value || '',
        'Ask Aegis could not use the grounded backend, so no answer was produced for the custom question.',
        {},
      );
    };
  }
  if (kind === 'quizOverlay') {
    const detachedQuizRoot = doc.querySelector('.detached-overlay-panel');
    if (detachedQuizRoot) detachedQuizRoot.onclick = event => {
      const option = event.target.closest('.quiz-option[data-quiz-question]');
      if (option) {
        selectAnswer(Number(option.dataset.quizQuestion), Number(option.dataset.quizOption));
        renderDetachedPanel('quizOverlay');
        return;
      }
      const action = event.target.closest('[data-quiz-action]');
      if (!action) return;
      if (action.dataset.quizAction === 'submit') submitQuiz();
      if (action.dataset.quizAction === 'reset') resetQuiz();
      renderDetachedPanel('quizOverlay');
    };
  }
}

function syncDetachedPanels() {
  renderDetachedPanel('liveExplainer');
  renderDetachedPanel('stepCoach');
  renderDetachedPanel('introOverlay');
  renderDetachedPanel('studyOverlay');
  renderDetachedPanel('quizOverlay');
}

function createDetachedPanelShim(kind) {
  const doc = document.implementation.createHTMLDocument(`Aegis ${kind}`);
  doc.body.className = 'detached-panel-window';
  const root = doc.createElement('div');
  root.id = 'detached-panel-root';
  root.className = 'detached-panel-frame';
  doc.body.appendChild(root);
  let beforeUnloadHandler = null;
  return {
    document: doc,
    closed: false,
    focus() {},
    close() {
      this.closed = true;
      if (typeof beforeUnloadHandler === 'function') beforeUnloadHandler();
    },
    addEventListener(type, handler) {
      if (type === 'beforeunload') beforeUnloadHandler = handler;
    },
  };
}

function openDetachedPanel(kind) {
  const existing = detachedPanels[kind];
  if (existing && !existing.closed) {
    existing.focus();
    syncDetachedPanelButtons();
    renderDetachedPanel(kind);
    return;
  }

  const width = kind === 'liveExplainer'
    ? 560
    : kind === 'stepCoach'
      ? 720
      : 980;
  const height = kind === 'liveExplainer' ? 860 : 980;
  const left = window.screenX + 80;
  const top = window.screenY + 60;
  let win = window.open('', `aegis_${kind}`, `popup=yes,resizable=yes,scrollbars=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!win) {
    if (!isBrowserSmokeMode()) return;
    win = createDetachedPanelShim(kind);
  }
  detachedPanels[kind] = win;
  syncDetachedPanelButtons();
  renderDetachedPanel(kind);
  win.focus();
}

function renderLabStepCoach() {
  const el = document.getElementById('lab-step-coach');
  const content = document.getElementById('lab-step-coach-content');
  if (!el || !content) return;

  if (activeTab === 'parser') {
    el.classList.add('is-hidden');
    syncDetachedPanels();
    return;
  }

  el.classList.toggle('is-hidden', !labCoachOpen);

  if (!currentLab) {
    content.innerHTML = `
      <p>Select a lab, read the intro, then start the first step. This panel stays beside the terminal so beginners do not have to remember what they are looking at.</p>
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Work</div>
        <ul class="lab-step-coach-list">
          <li>Use the step buttons to choose the checkpoint, then type the probe in the terminal. You are expected to practice the command shape.</li>
          <li>Read the terminal, metrics sidebar, and event log together.</li>
          <li>Move on only when you can explain what changed and why it matters.</li>
        </ul>
      </div>
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const lab = LABS[currentLab];
  if (!lab) return;

  if (currentStep < 0 || !lab.steps[currentStep]) {
    content.innerHTML = `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">Before You Start</div>
        <p>${beginnerMode ? 'This lab is guided. Start with step 1 and let the simulator show you the evidence in order.' : 'Use the step buttons to replay the scenario in order.'}</p>
      </div>
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Use This Lab</div>
        <ul class="lab-step-coach-list">
          <li>Each step represents one operator question: what am I checking, and what answer do I expect?</li>
          <li>The terminal accepts a limited set of authored probes. Type <code>help</code> to see the accepted commands for the current checkpoint.</li>
          <li>Use the terminal output as the main clue, then confirm the story in the side metrics.</li>
          <li>Fault steps are supposed to look bad. The lesson is learning what that bad output means.</li>
        </ul>
      </div>
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const redirectedMainStep = activeMainRedirectStep || getMainPathRedirectStep(currentLab, currentStep);
  const step = activeAlternateStep || redirectedMainStep || lab.steps[currentStep];
  const outputClues = getKeyOutputClues(step);
  const useTip = step.cmd?.startsWith('#')
    ? 'This step is a simulated transition. You are meant to study the new state it creates, not to memorize a literal shell command.'
    : 'Type the command for this step in the limited terminal. The goal is to build realistic operator recall while learning what the evidence means.';
  const completion = step.fault
    ? (step.justifiedConclusion || step.meaning || 'This fault step is complete once you can explain why the degraded signal is significant.')
    : (step.justifiedConclusion || step.meaning || 'This step is complete once the expected healthy signal is visible and you can explain why it matters.');
  const nextAction = step.takeAction && step.takeAction.length ? step.takeAction[0] : 'Compare this step with the previous one before you move on.';
  const observationList = step.lookFor && step.lookFor.length ? step.lookFor : ['Use the key output clues below to decide what changed and whether the step looks healthy or degraded.'];
  const sidePanels = getMetricsToWatch(currentLab, step);
  const tabNote = activeTab === 'term'
    ? 'You are on the main Terminal tab, which is the primary output for the active step.'
    : activeTab === 'dmesg'
      ? 'You are on dmesg, which is useful for kernel and NVIDIA fault confirmation.'
      : 'You are on dcgm, which is useful for counter and health correlation.';
  const calloutClass = step.fault ? 'lab-step-coach-callout err' : 'lab-step-coach-callout';
  const scorecard = getReasoningScorecardContext(currentLab, step);
  reasoningScoreState.byLab[currentLab] = scorecard;
  const diagnosis = renderDifferentialDiagnosis(currentLab, step);
  const incidentBrief = renderIncidentModeBrief(currentLab, step);
  const consequenceBranch = renderConsequenceBranch(currentLab, step, currentStep);
  const routeStatus = renderBranchRouteStatus(currentLab, currentStep);
  const stepModifier = getBranchStepModifier(currentLab, currentStep);
  const stepPurpose = stepModifier?.purpose || describeStepCommand(step);
  const lookForLead = stepModifier?.lookFor
    ? `<div class="branch-step-context"><div class="branch-step-context-title">Branch Context</div><p>${escHtml(tightenDisplayCopy(stepModifier.lookFor))}</p></div>`
    : '';
  const meaningText = stepModifier?.meaning || tightenDisplayCopy(step.meaning || completion);
  const outcomeSummary = currentStep === lab.steps.length - 1 ? renderLabOutcomeSummary(currentLab) : '';

  if (beginnerMode && step.explainerMode === 'beginner_story') {
    content.innerHTML = renderBeginnerStoryStepCoach(step, lab, outputClues, tabNote);
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  if (incidentMode) {
    content.innerHTML = `
      <div class="${calloutClass}">
        <p><strong>Incident goal:</strong> ${escHtml(describeStepCommand(step))}</p>
        <p>${escHtml(tightenDisplayCopy('Use only the evidence on screen, keep the layer call narrow, and avoid any fix you cannot justify yet.'))}</p>
      </div>
      ${renderAskAegisBlock(currentLab, step, currentStep)}
      ${renderReasoningScorecard(scorecard, {
        subtitle: 'Incident mode scores the diagnosis on evidence control, layer ownership, and safe movement under uncertainty.',
      })}
      ${incidentBrief}
      ${consequenceBranch}
      ${routeStatus}
      ${outcomeSummary}
      ${diagnosis}
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">Command In Focus</div>
        <code class="lab-step-coach-code">${escHtml(step.cmd || '# simulated stage')}</code>
      </div>
      ${renderStepScreenshots(step)}
      ${outputClues.length ? `
        <div class="lab-step-coach-section">
          <div class="lab-step-coach-section-title">Visible Evidence</div>
          ${outputClues.map(clue => `
            <div class="lab-step-coach-clue">
              <div class="lab-step-coach-clue-line">${escHtml(clue.text)}</div>
              <div class="lab-step-coach-clue-meaning">${escHtml(clue.meaning)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
    content.scrollTop = 0;
    syncDetachedPanels();
    return;
  }

  const topKicker = document.querySelector('#lab-step-coach .lab-step-coach-kicker');
  const topTitle = document.querySelector('#lab-step-coach .lab-step-coach-title');
  if (topKicker) topKicker.textContent = activeAlternateStep
    ? `${lab.name} • Recovery Chain ${activeAlternateStep.alternateChainIndex || 1}/${activeAlternateStep.alternateChainLength || 1}`
    : redirectedMainStep
      ? `${lab.name} • Redirected Main Step`
      : `${lab.name} • Step ${currentStep + 1}/${lab.steps.length}`;
  if (topTitle) topTitle.textContent = activeAlternateStep
    ? activeAlternateStep.label
    : redirectedMainStep
      ? redirectedMainStep.label
      : (stepModifier ? `${stepModifier.title} • ${step.label}` : step.label);

  content.innerHTML = `
    <div class="${calloutClass}">
      <p><strong class="lab-step-coach-topic-label lab-step-coach-topic-label-purpose">What this step is for:</strong> ${escHtml(stepPurpose)}</p>
      <p>${escHtml(tightenDisplayCopy(useTip))}</p>
    </div>
    ${renderAskAegisBlock(currentLab, step, currentStep)}
    ${renderReasoningScorecard(scorecard)}
    ${(step.fault || incidentMode) ? consequenceBranch : ''}
    ${routeStatus}
    ${outcomeSummary}
    ${diagnosis}
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Command In Focus</div>
      <code class="lab-step-coach-code">${escHtml(step.cmd || '# simulated stage')}</code>
      <p>${escHtml(tightenDisplayCopy(tabNote))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">What To Look For</div>
      ${lookForLead}
      ${renderBulletList(observationList, 'lab-step-coach-list')}
    </div>
    ${renderStepScreenshots(step)}
    ${step.screenshots && step.screenshots.length ? `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Use This Snapshot</div>
        <p>${escHtml(describeScreenshotUse(step))}</p>
      </div>
    ` : ''}
    ${outputClues.length ? `
      <div class="lab-step-coach-section">
        <div class="lab-step-coach-section-title">How To Read This Output</div>
        ${outputClues.map(clue => `
          <div class="lab-step-coach-clue">
            <div class="lab-step-coach-clue-line">${escHtml(clue.text)}</div>
            <div class="lab-step-coach-clue-meaning">${escHtml(clue.meaning)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">What It Means</div>
      <p>${escHtml(meaningText)}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">How To Tell You Are Done</div>
      <p>${escHtml(tightenDisplayCopy(completion))}</p>
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Watch These Side Panels</div>
      ${renderBulletList(sidePanels, 'lab-step-coach-list')}
    </div>
    <div class="lab-step-coach-section">
      <div class="lab-step-coach-section-title">Next Action</div>
      <p>${escHtml(tightenDisplayCopy(nextAction))}</p>
    </div>
  `;
  content.scrollTop = 0;
  syncDetachedPanels();
}
