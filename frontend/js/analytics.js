function loadReasoningProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem('gpusim_reasoning_progress') || '{}');
    return {
      steps: parsed.steps || {},
      quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
      completion: parsed.completion || {},
      lastExportTs: parsed.lastExportTs || 0,
    };
  } catch (e) {
    localStorage.removeItem('gpusim_reasoning_progress');
    return { steps: {}, quizzes: [], completion: {}, lastExportTs: 0 };
  }
}

function getReasoningDomain(labId, step) {
  if (['ecc', 'nvlink_fault'].includes(labId) || ['xid48', 'xid48_confirm', 'xid79', 'xid74', 'ecc_xid'].includes(step?.type)) return 'fault_isolation';
  if (['nvlink', 'allreduce', 'nccl_fallback', 'ib_fabric', 'roce'].includes(labId)) return 'fabric_path';
  if (['cuda_stack', 'container', 'training', 'k8s', 'slurm'].includes(labId)) return 'runtime_delivery';
  if (['storage', 'gds', 'monitoring'].includes(labId)) return 'platform_efficiency';
  return 'general_diagnosis';
}

function getReasoningScorecardContext(labId, step) {
  const guide = labId ? getLearningGuide(labId) : null;
  const output = step ? getStepOutput(step) : [];
  const hasCounters = output.some(line => /dcgm|ecc|dbe|sbe|crc/i.test(line?.v || ''));
  const hasLogs = output.some(line => /xid|nvrm|dmesg|socket|fallback/i.test(line?.v || ''));
  const hasScheduler = output.some(line => /pending|fairshare|drain|nvidia\.com\/gpu|pod/i.test(line?.v || ''));
  const hasScreenshots = !!(step?.screenshots && step.screenshots.length);
  const safeActionPresent = !!(step?.takeAction?.length || guide?.safeActions?.length);

  const categories = [
    {
      key: 'layer',
      label: 'Layer call',
      status: step?.fault ? 'strong' : 'good',
      text: step?.fault
        ? 'This step clearly belongs to a fault family, so the user should identify the owning layer before touching remediation.'
        : 'This step should let the user name the owning layer before jumping to commands or tuning.',
    },
    {
      key: 'evidence',
      label: 'Evidence quality',
      status: hasCounters || hasLogs || hasScheduler ? 'strong' : hasScreenshots ? 'good' : 'watch',
      text: hasCounters || hasLogs || hasScheduler
        ? 'The current view provides explicit evidence, so the diagnosis should be grounded in what changed on screen.'
        : hasScreenshots
          ? 'The screenshot is useful, but the user should still tie it back to the step goal before concluding.'
          : 'This step is lighter on explicit evidence, so conclusions should stay narrow.',
    },
    {
      key: 'safety',
      label: 'Action safety',
      status: safeActionPresent ? 'good' : 'watch',
      text: safeActionPresent
        ? 'A safe next action is available here. Good reasoning means choosing the narrowest justified move.'
        : 'No strong action cue is present here, so the user should stay in observation mode.',
    },
  ];

  const score = categories.reduce((total, item) => total + (item.status === 'strong' ? 2 : item.status === 'good' ? 1 : 0), 0);
  return {
    domain: getReasoningDomain(labId, step),
    score,
    maxScore: categories.length * 2,
    categories,
  };
}

function renderReasoningScorecard(scorecard, options = {}) {
  if (!scorecard) return '';
  const title = options.title || 'Reasoning Scorecard';
  const subtitle = options.subtitle || 'How Aegis is grading the quality of the diagnosis, not just task completion.';
  return `
    <section class="reasoning-scorecard">
      <div class="reasoning-scorecard-top">
        <div>
          <div class="reasoning-scorecard-title">${escHtml(title)}</div>
          <div class="reasoning-scorecard-subtitle">${escHtml(subtitle)}</div>
        </div>
        <div class="reasoning-scorecard-total">
          <span>${scorecard.score}/${scorecard.maxScore}</span>
          <small>${escHtml(scorecard.domain.replace(/_/g, ' '))}</small>
        </div>
      </div>
      <div class="reasoning-scorecard-grid">
        ${scorecard.categories.map(item => `
          <article class="reasoning-card reasoning-card-${escHtml(item.status)}">
            <div class="reasoning-card-head">
              <span>${escHtml(item.label)}</span>
              <strong>${item.status === 'strong' ? 'Strong' : item.status === 'good' ? 'Good' : 'Watch'}</strong>
            </div>
            <p>${escHtml(tightenDisplayCopy(item.text))}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function getReasoningStatusValue(status) {
  return status === 'strong' ? 2 : status === 'good' ? 1 : 0;
}

function persistReasoningProgress() {
  localStorage.setItem('gpusim_reasoning_progress', JSON.stringify(reasoningProgress));
}

function getReasoningProgressSummary() {
  const stepEntries = Object.values(reasoningProgress.steps || {});
  const categoryTotals = {};
  let totalScore = 0;
  let totalMax = 0;
  let cleanLabs = 0;
  let compromisedLabs = 0;

  stepEntries.forEach(entry => {
    totalScore += entry.score || 0;
    totalMax += entry.maxScore || 0;
    (entry.categories || []).forEach(category => {
      if (!categoryTotals[category.key]) categoryTotals[category.key] = { total: 0, max: 0, count: 0, label: category.label };
      categoryTotals[category.key].total += category.value;
      categoryTotals[category.key].max += 2;
      categoryTotals[category.key].count += 1;
    });
  });

  const categoryAverages = Object.entries(categoryTotals).map(([key, value]) => ({
    key,
    label: value.label,
    pct: value.max ? Math.round((value.total / value.max) * 100) : 0,
  })).sort((a, b) => a.pct - b.pct);
  const completionEntries = Object.values(reasoningProgress.completion || {});
  completionEntries.forEach(entry => {
    if (entry.clean) cleanLabs += 1;
    else compromisedLabs += 1;
  });
  const quizAttempts = reasoningProgress.quizzes || [];
  const lastQuiz = quizAttempts.length ? quizAttempts[quizAttempts.length - 1] : null;
  const avgQuiz = quizAttempts.length
    ? Math.round(quizAttempts.reduce((sum, item) => sum + item.pct, 0) / quizAttempts.length)
    : null;

  return {
    judgmentPct: totalMax ? Math.round((totalScore / totalMax) * 100) : null,
    completedSteps: stepEntries.length,
    categoryAverages,
    weakestCategory: categoryAverages[0] || null,
    lastQuizPct: lastQuiz ? lastQuiz.pct : null,
    avgQuizPct: avgQuiz,
    quizAttempts: quizAttempts.length,
    cleanLabs,
    compromisedLabs,
  };
}

function formatReportTimestamp(ts) {
  if (!ts) return 'not yet exported';
  try {
    return new Date(ts).toLocaleString();
  } catch (e) {
    return 'not yet exported';
  }
}

function getReasoningProgressReport() {
  const summary = getReasoningProgressSummary();
  const recentRisk = getRecentRiskPattern();
  const recoverySignal = getRecoveryProgressSignal(recentRisk?.domain || null);
  const recentOutcomes = Object.entries(reasoningProgress.completion || {})
    .map(([labId, entry]) => ({
      labId,
      labName: LABS[labId]?.name || labId,
      clean: !!entry.clean,
      warnCount: entry.warnCount || 0,
      badCount: entry.badCount || 0,
      bestCount: entry.bestCount || 0,
      dominantDomain: entry.dominantDomain || null,
      ts: entry.ts || null,
      route: Array.isArray(entry.route) ? entry.route : [],
    }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))
    .slice(0, 5);
  const recentQuizzes = (reasoningProgress.quizzes || []).slice(-5).map(item => ({
    pct: item.pct,
    score: item.score,
    maxScore: item.maxScore,
    ts: item.ts || null,
  }));
  const stepBreakdown = Object.entries(reasoningProgress.steps || {})
    .map(([stepKey, entry]) => ({
      stepKey,
      score: entry.score || 0,
      maxScore: entry.maxScore || 0,
      penalty: entry.penalty || 0,
      categories: Array.isArray(entry.categories) ? entry.categories : [],
    }))
    .slice(-20);

  return {
    reportType: 'aegis_reasoning_progress',
    generatedAt: new Date().toISOString(),
    summary,
    recentRisk,
    recoverySignal,
    recentOutcomes,
    recentQuizzes,
    stepBreakdown,
  };
}

function downloadReasoningProgressReport() {
  const report = getReasoningProgressReport();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = report.generatedAt.replace(/[:.]/g, '-');
  a.href = url;
  a.download = `aegis-reasoning-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  reasoningProgress.lastExportTs = Date.now();
  persistReasoningProgress();
  logTerm([{ t: 'ok', v: `[analytics] Reasoning report exported: ${a.download}` }]);
  const studyContent = document.getElementById('study-content');
  if (studyContent) {
    openStudyGuide(studyContent.dataset.examId || 'nca_aiio');
  }
}

function getReasoningFocusRecommendation(summary) {
  const weakest = summary?.weakestCategory;
  if (!weakest) return null;
  const recommendations = {
    layer: {
      title: 'Layer ownership needs work',
      action: 'Drill CUDA stack, Kubernetes, or Slurm until the owning layer is explicit before any fix is attempted.',
      labs: ['cuda_stack', 'k8s', 'slurm'],
    },
    evidence: {
      title: 'Evidence control needs work',
      action: 'Re-run ECC, NVLink, or storage labs and justify the diagnosis from on-screen signals before touching remediation.',
      labs: ['ecc', 'nvlink', 'storage'],
    },
    safety: {
      title: 'Action safety needs work',
      action: 'Use incident mode and aim for clean finishes: contain first, keep the change set narrow, and avoid broad resets.',
      labs: ['ecc', 'nccl_fallback', 'storage'],
    },
  };
  return recommendations[weakest.key] || {
    title: `${weakest.label} needs work`,
    action: 'Repeat the incident path and focus on the weakest reasoning category before optimizing for speed.',
    labs: [],
  };
}

function getRecommendedLabsForDomain(domain, fallbackLabs = []) {
  const domainLabs = {
    fault_isolation: ['ecc', 'nvlink_fault', 'mig'],
    fabric_path: ['nvlink', 'nccl_fallback', 'ib_fabric'],
    runtime_delivery: ['cuda_stack', 'k8s', 'slurm'],
    platform_efficiency: ['storage', 'allreduce', 'training'],
  };
  return domainLabs[domain] || fallbackLabs;
}

function getUniqueLabs(list = []) {
  const seen = new Set();
  return list.filter(labId => {
    if (!labId || seen.has(labId)) return false;
    seen.add(labId);
    return true;
  });
}

function getRecentRiskPattern() {
  const entries = Object.entries(reasoningProgress.completion || {})
    .map(([labId, entry]) => ({ labId, entry }))
    .filter(({ entry }) => !entry.clean)
    .sort((a, b) => ((b.entry.badCount || 0) + (b.entry.warnCount || 0)) - ((a.entry.badCount || 0) + (a.entry.warnCount || 0)) || ((b.entry.ts || 0) - (a.entry.ts || 0)));
  if (!entries.length) return null;
  const top = entries[0];
  const domainLabels = {
    fault_isolation: 'fault isolation',
    fabric_path: 'fabric path',
    runtime_delivery: 'runtime delivery',
    platform_efficiency: 'platform efficiency',
  };
  return {
    labId: top.labId,
    labName: LABS[top.labId]?.name || top.labId,
    detail: `${top.entry.warnCount || 0} weak and ${top.entry.badCount || 0} bad calls were recorded before the lab finished.`,
    domain: top.entry.dominantDomain || null,
    domainLabel: domainLabels[top.entry.dominantDomain] || null,
  };
}

function getRecoveryProgressSignal(domain) {
  if (!domain) return null;
  const matching = Object.entries(reasoningProgress.completion || {})
    .map(([labId, entry]) => ({ labId, entry }))
    .filter(({ entry }) => entry.dominantDomain === domain);
  const cleanMatches = matching
    .filter(({ entry }) => entry.clean)
    .sort((a, b) => (b.entry.ts || 0) - (a.entry.ts || 0));
  if (!cleanMatches.length) return null;
  return {
    domain,
    cleanCount: cleanMatches.length,
    latestCleanLabId: cleanMatches[0].labId,
    latestCleanLabName: LABS[cleanMatches[0].labId]?.name || cleanMatches[0].labId,
  };
}

function updateReasoningProgressUI() {
  const summary = getReasoningProgressSummary();
  const el = document.getElementById('h-judgment');
  if (el) el.textContent = summary.judgmentPct === null ? '—' : `${summary.judgmentPct}%`;
}

function recordLabReasoningProgress(labId, stepIdx, scorecard) {
  if (!labId || typeof stepIdx !== 'number' || !scorecard) return;
  const branchContext = getBranchConsequenceContext(labId, stepIdx);
  const penalty = Math.min(branchContext.badCount * 2 + branchContext.warnCount, scorecard.maxScore - 1);
  const adjustedScore = Math.max(scorecard.score - penalty, 0);
  reasoningProgress.steps[`${labId}:${stepIdx}`] = {
    score: adjustedScore,
    maxScore: scorecard.maxScore,
    penalty,
    categories: scorecard.categories.map(category => ({
      key: category.key,
      label: category.label,
      value: Math.max(getReasoningStatusValue(category.status) - (category.key === 'safety' ? Math.min(branchContext.badCount + branchContext.warnCount, 2) : 0), 0),
    })),
  };
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function recordLabCompletionOutcome(labId, clean) {
  if (!reasoningProgress.completion) reasoningProgress.completion = {};
  const context = getBranchConsequenceContext(labId, Number.POSITIVE_INFINITY);
  reasoningProgress.completion[labId] = {
    clean: !!clean,
    badCount: context.badCount,
    warnCount: context.warnCount,
    bestCount: context.bestCount,
    dominantDomain: context.dominantDomain || null,
    route: context.priorChoices.map(item => ({
      stepIdx: item.stepIdx,
      label: item.choice.label,
      effect: item.choice.effect,
      domain: item.domain,
    })),
    ts: Date.now(),
  };
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function isLabCompletionClean(labId) {
  const context = getBranchConsequenceContext(labId, Number.POSITIVE_INFINITY);
  return !context.badCount && !context.warnCount;
}

function recordQuizReasoningProgress(pct, scorecard) {
  reasoningProgress.quizzes.push({
    pct,
    score: scorecard?.score || 0,
    maxScore: scorecard?.maxScore || 0,
    ts: Date.now(),
  });
  reasoningProgress.quizzes = reasoningProgress.quizzes.slice(-20);
  persistReasoningProgress();
  updateReasoningProgressUI();
}

function renderReasoningProgressSummary() {
  const summary = getReasoningProgressSummary();
  const recommendation = getReasoningFocusRecommendation(summary);
  const recentRisk = getRecentRiskPattern();
  const recoverySignal = getRecoveryProgressSignal(recentRisk?.domain || null);
  const lastExportLabel = formatReportTimestamp(reasoningProgress.lastExportTs || 0);
  const hasAnyProgress = summary.completedSteps > 0 || summary.quizAttempts > 0 || summary.cleanLabs > 0 || summary.compromisedLabs > 0;
  const effectiveRecommendation = recommendation ? {
    ...recommendation,
    title: recentRisk?.domainLabel ? `${recommendation.title} in ${recentRisk.domainLabel}` : recommendation.title,
    action: recentRisk?.domainLabel
      ? recoverySignal
        ? `${recommendation.action} You already have clean finishes in ${recentRisk.domainLabel}, so re-test the last miss first and then widen into nearby drills to make that improvement repeatable.`
        : `${recommendation.action} Start with the last compromised lab, then widen into the drills tied to the recent ${recentRisk.domainLabel} misses.`
      : recommendation.action,
    rationale: recentRisk?.labName
      ? recoverySignal
        ? `Picked because your last compromised run was ${recentRisk.labName}${recentRisk.domainLabel ? ` in ${recentRisk.domainLabel}` : ''}, but you already cleaned up ${recoverySignal.latestCleanLabName} in that same domain.`
        : `Picked because your last compromised run was ${recentRisk.labName}${recentRisk.domainLabel ? ` in ${recentRisk.domainLabel}` : ''}.`
      : '',
    labs: getUniqueLabs([
      recentRisk?.labId || null,
      recoverySignal?.latestCleanLabId || null,
      ...(recentRisk?.domain
        ? getRecommendedLabsForDomain(recentRisk.domain, recommendation.labs || [])
        : (recommendation.labs || [])),
    ]),
  } : null;
  const recentOutcomes = Object.entries(reasoningProgress.completion || {})
    .map(([labId, entry]) => ({ labId, entry }))
    .sort((a, b) => (b.entry.ts || 0) - (a.entry.ts || 0))
    .slice(0, 3);
  return `
    <section class="learn-section study-progress">
      <div class="learn-heading-row">
        <h4>Reasoning Progress</h4>
        <span class="learn-mode-tag">v3 analytics</span>
      </div>
      <div class="study-progress-grid">
        <article class="study-progress-card">
          <div class="study-mini-title">Troubleshooting judgment</div>
          <div class="study-progress-value">${summary.judgmentPct === null ? '—' : `${summary.judgmentPct}%`}</div>
          <p>${hasAnyProgress ? `${summary.completedSteps} guided steps have stored reasoning snapshots.` : 'No guided-step reasoning snapshots recorded yet.'}</p>
        </article>
        <article class="study-progress-card">
          <div class="study-mini-title">Quiz accuracy</div>
          <div class="study-progress-value">${summary.lastQuizPct === null ? '—' : `${summary.lastQuizPct}%`}</div>
          <p>${summary.quizAttempts ? `Average across ${summary.quizAttempts} attempts: ${summary.avgQuizPct}%.` : 'No quiz attempt recorded yet.'}</p>
        </article>
        <article class="study-progress-card">
          <div class="study-mini-title">Clean incident finishes</div>
          <div class="study-progress-value">${summary.cleanLabs}</div>
          <p>${summary.compromisedLabs ? `${summary.compromisedLabs} labs reached the end with branch penalties still active.` : 'No compromised completions recorded.'}</p>
        </article>
      </div>
      <div class="study-progress-actions">
        <button class="study-action-btn" type="button" data-study-action="export-report">Export reasoning report</button>
        <span class="study-progress-export-note">Pilot-ready JSON snapshot. Last export: ${escHtml(lastExportLabel)}.</span>
      </div>
      ${!hasAnyProgress ? `
        <div class="study-focus-grid">
          <article class="study-focus-card">
            <div class="study-mini-title">How this fills in</div>
            <strong>Start one lab or quiz</strong>
            <p>Aegis will begin showing judgment, incident outcomes, and targeted drill guidance after your first scored lab step, quiz, or lab completion.</p>
          </article>
        </div>
      ` : ''}
      ${summary.categoryAverages.length ? `
        <div class="study-progress-breakdown">
          ${summary.categoryAverages.map(item => `
            <div class="study-progress-chip">
              <strong>${escHtml(item.label)}</strong>
              <span>${item.pct}%</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
      ${(effectiveRecommendation || recentRisk) ? `
        <div class="study-focus-grid">
          ${effectiveRecommendation ? `
            <article class="study-focus-card">
              <div class="study-mini-title">Next training focus</div>
              <strong>${escHtml(effectiveRecommendation.title)}</strong>
              <p>${escHtml(effectiveRecommendation.action)}</p>
              ${effectiveRecommendation.rationale ? `<div class="study-focus-rationale">${escHtml(effectiveRecommendation.rationale)}</div>` : ''}
              ${effectiveRecommendation.labs?.length ? `
                <div class="study-lab-links">
                  ${effectiveRecommendation.labs.map(labId => `
                    <button class="study-lab-link" type="button" data-study-lab="${escHtml(labId)}">
                      <span>${escHtml(LABS[labId]?.name || labId)}</span>
                      <small>recommended drill</small>
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </article>
          ` : ''}
          ${recentRisk ? `
            <article class="study-focus-card study-focus-card-risk">
              <div class="study-mini-title">Recent risk pattern</div>
              <strong>${escHtml(recentRisk.labName)}</strong>
              <p>${escHtml(recentRisk.detail)}</p>
            </article>
          ` : ''}
        </div>
      ` : ''}
      ${recentOutcomes.length ? `
        <div class="study-progress-recent">
          <div class="study-mini-title">Recent incident outcomes</div>
          <div class="study-progress-outcomes">
            ${recentOutcomes.map(({ labId, entry }) => `
              <article class="study-outcome-card${entry.clean ? '' : ' is-compromised'}">
                <div class="study-outcome-card-top">
                  <strong>${escHtml(LABS[labId]?.name || labId)}</strong>
                  <span>${entry.clean ? 'Clean' : 'Compromised'}</span>
                </div>
                <p>${entry.clean
                  ? escHtml(`${entry.bestCount || 0} strong calls held the incident on the intended route.`)
                  : escHtml(`${entry.warnCount || 0} weak and ${entry.badCount || 0} bad branch calls forced recovery work before the lab ended.`)}</p>
              </article>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `;
}

function getLabOutcomeSummary(labId) {
  if (!labId) return null;
  const lab = LABS[labId];
  if (!lab) return null;
  const context = getBranchConsequenceContext(labId, Number.POSITIVE_INFINITY);
  const stored = reasoningProgress.completion?.[labId] || null;
  const clean = stored ? !!stored.clean : !context.hasPenalty;
  if (!context.priorChoices.length && !stored) return null;

  const headline = clean ? 'Clean incident finish' : 'Compromised incident finish';
  const summary = clean
    ? 'The incident reached the end without active branch penalties. The route stayed controlled enough to count as a clean finish.'
    : 'The lab reached the end, but earlier branch choices forced detours or left reasoning debt active. This counts as a compromised finish.';
  const highlights = [];
  if (context.bestCount) highlights.push(`${context.bestCount} strong branch call${context.bestCount === 1 ? '' : 's'} kept the incident on the intended route.`);
  if (context.warnCount) highlights.push(`${context.warnCount} weak branch call${context.warnCount === 1 ? '' : 's'} triggered recovery work before the next stage.`);
  if (context.badCount) highlights.push(`${context.badCount} bad branch call${context.badCount === 1 ? '' : 's'} changed later lab state and reduced completion quality.`);
  if (!highlights.length) highlights.push('No branch penalties were recorded for this lab.');

  const route = context.priorChoices.slice(-3).map(item => ({
    step: item.stepIdx + 1,
    label: item.choice.label,
    effect: item.choice.effect,
  }));

  return { clean, headline, summary, highlights, route };
}

function renderLabOutcomeSummary(labId) {
  const outcome = getLabOutcomeSummary(labId);
  if (!outcome) return '';
  return `
    <section class="lab-outcome-summary${outcome.clean ? '' : ' is-compromised'}">
      <div class="lab-outcome-summary-top">
        <div class="lab-outcome-summary-title">Incident Outcome</div>
        <span class="lab-outcome-summary-tag">${escHtml(outcome.headline)}</span>
      </div>
      <p>${escHtml(tightenDisplayCopy(outcome.summary))}</p>
      ${renderBulletList(outcome.highlights, 'lab-step-coach-list')}
      ${outcome.route.length ? `
        <div class="lab-outcome-summary-route">
          ${outcome.route.map(item => `
            <span class="lab-outcome-route-chip effect-${escHtml(item.effect)}">Step ${item.step}: ${escHtml(item.label)}</span>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}
