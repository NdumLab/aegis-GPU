/**
 * EXPLANATION ENGINE
 * Shared rendering primitives for guided labs, runtime explanations, and learner profile adaptation.
 */

window.AEGIS_EXPLAINER = (() => {
  const LEVELS = {
    beginner: {
      label: 'Beginner',
      note: 'Uses plain language, slows down the reasoning, and explicitly calls out common bad conclusions.',
      showGlossary: true,
      showCounterfactuals: true,
      showMisreads: true,
      showSelfCheck: true,
    },
    intermediate: {
      label: 'Intermediate',
      note: 'Assumes you know the basic jargon and focuses more on evidence comparison and operator tradeoffs.',
      showGlossary: true,
      showCounterfactuals: true,
      showMisreads: true,
      showSelfCheck: true,
    },
    operator: {
      label: 'Operator',
      note: 'Keeps the explanation tighter and emphasizes decision quality, containment thresholds, and validation discipline.',
      showGlossary: false,
      showCounterfactuals: true,
      showMisreads: true,
      showSelfCheck: false,
    },
  };

  const ROLES = {
    cluster_operator: {
      label: 'Cluster Operator',
      lens: 'Prioritize containment, blast-radius control, and whether the node is safe to keep in service.',
    },
    sre: {
      label: 'SRE',
      lens: 'Focus on reliability signals, safe remediation sequencing, and whether the evidence justifies escalation.',
    },
    ml_engineer: {
      label: 'ML Engineer',
      lens: 'Focus on workload impact, why throughput changed, and which signals point to infrastructure versus application causes.',
    },
  };

  const CONCEPT_GRAPH = {
    ECC: ['SBE', 'DBE', 'XID 48', 'Page retirement'],
    SBE: ['ECC', 'DBE', 'Trend'],
    DBE: ['ECC', 'XID 48', 'Containment'],
    'XID 48': ['DBE', 'Containment', 'RMA'],
    'XID 74': ['NVLink', 'CRC error', 'Topology'],
    'XID 79': ['GPU reset', 'Reboot', 'Bus reachability'],
    NVLink: ['Topology', 'PHB', 'AllReduce'],
    Topology: ['NVLink', 'PHB', 'Collective throughput'],
    PHB: ['Topology', 'PCIe', 'Fallback path'],
    'CRC error': ['NVLink', 'Signal integrity', 'Link health'],
    NCCL: ['AllReduce', 'TCP fallback', 'InfiniBand'],
    'TCP fallback': ['NCCL', 'InfiniBand', 'Bandwidth baseline'],
    InfiniBand: ['HCA', 'NCCL_IB_HCA', 'Collective throughput'],
    'Bandwidth baseline': ['AllReduce', 'TCP fallback', 'NVLink'],
    DataLoader: ['I/O bottleneck', 'Stripe count', 'Sawtooth utilization'],
    'I/O bottleneck': ['DataLoader', 'Sawtooth utilization', 'Stripe count'],
    'Sawtooth utilization': ['I/O bottleneck', 'Storage bottleneck', 'GPU Util'],
    Containment: ['Drain', 'Blast radius', 'Validation'],
    'GPU reset': ['XID 79', 'Validation', 'Escalation'],
  };

  const STEP_PATTERNS = {
    ecc_healthy: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'baseline',
      commonMisread: 'A clean first reading proves the GPU will stay healthy. It only proves the current starting point.',
      counterfactuals: ['If the GPU were already degraded, you would expect non-zero ECC counters or instability even before the fault phase begins.'],
      selfCheck: 'Why does a clean baseline matter more than memorizing one good number?',
    },
    ecc_sbe: {
      confidence: 'medium',
      actionRisk: 'medium',
      decisionStage: 'observe',
      commonMisread: 'Corrected means harmless. In practice, repeated corrected errors can be the warning phase before an uncorrectable event.',
      counterfactuals: ['If this were already a hard failure, you would expect DBE evidence or a stronger XID signal instead of SBE-only growth.'],
      selfCheck: 'What makes repeated SBE growth different from one isolated corrected error?',
    },
    ecc_trend: {
      confidence: 'high',
      actionRisk: 'medium',
      decisionStage: 'prepare',
      commonMisread: 'Trend data is just more of the same. Actually, persistence changes the quality of the conclusion.',
      counterfactuals: ['If the earlier SBE rise had been a one-off anomaly, the longer poll would flatten instead of continuing upward.'],
      selfCheck: 'What changed in your confidence once the degradation signal persisted across a longer poll window?',
    },
    ecc_xid: {
      confidence: 'high',
      actionRisk: 'high',
      decisionStage: 'contain',
      commonMisread: 'XID 48 is just a noisier warning. It is a much stronger signal that the fault crossed into uncorrectable territory.',
      counterfactuals: ['If this were only a soft warning, you would not expect the lifecycle to cross from corrected trending into an uncorrectable hardware-fault story.'],
      selfCheck: 'What new conclusion becomes justified once XID 48 aligns with the ECC story?',
    },
    ecc_drain: {
      confidence: 'high',
      actionRisk: 'medium',
      decisionStage: 'contain',
      commonMisread: 'Draining fixes the card. Draining only protects workloads while the hardware issue is handled separately.',
      counterfactuals: ['If the goal were repair rather than containment, the action would target hardware remediation instead of scheduler state.'],
      selfCheck: 'Why is draining a containment action rather than a repair action?',
    },
    topo: {
      confidence: 'medium',
      actionRisk: 'low',
      decisionStage: 'baseline',
      commonMisread: 'A visible topology map is enough to prove the interconnect is healthy. It only proves the designed path layout.',
      counterfactuals: ['If the topology were already degraded, you would expect weaker paths like PHB where direct NVLink should exist.'],
      selfCheck: 'Why is topology a baseline step rather than a final health verdict?',
    },
    nvlink_err: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'investigate',
      commonMisread: 'Correct topology means healthy links. A link can exist and still be unhealthy under CRC or flit errors.',
      counterfactuals: ['If the fabric were electrically unhealthy, counters would begin telling that story even before throughput fully collapses.'],
      selfCheck: 'What new question are you answering once you move from topology to link counters?',
    },
    benchmark: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'validate',
      commonMisread: 'Topology and clean counters are enough. The workload-level benchmark is what proves the design is operationally healthy.',
      counterfactuals: ['If the interconnect were still degraded somewhere, the benchmark would expose a throughput mismatch even after the earlier checks looked healthy.'],
      selfCheck: 'Why is a benchmark a stronger operational proof than static inspection alone?',
    },
    nvlink_fault: {
      confidence: 'high',
      actionRisk: 'high',
      decisionStage: 'investigate',
      commonMisread: 'If the job still runs, the topology problem is minor. In distributed GPU systems, soft degradation can still be a major production failure.',
      counterfactuals: ['If this were only a software tuning issue, the hardware path would not have shifted from NVLink to PHB.'],
      selfCheck: 'What changed about the communication physics once the path degraded to PHB?',
    },
    nccl_diag: {
      confidence: 'high',
      actionRisk: 'medium',
      decisionStage: 'diagnose',
      commonMisread: 'NCCL logs are the whole root cause. They are strongest when they confirm the hardware story rather than replace it.',
      counterfactuals: ['If the hardware path were healthy, the software layer would be less likely to show the same degraded-communication story.'],
      selfCheck: 'Why does a cross-layer explanation beat a single-surface explanation here?',
    },
    xid48: {
      confidence: 'medium',
      actionRisk: 'high',
      decisionStage: 'investigate',
      commonMisread: 'Every XID deserves the same reaction. Different XIDs indicate different fault families and response paths.',
      counterfactuals: ['If this were a bus or link fault instead of memory integrity, the confirmation step would not focus on DBE evidence.'],
      selfCheck: 'Why is confirmation still necessary even when the XID looks severe?',
    },
    xid48_confirm: {
      confidence: 'high',
      actionRisk: 'high',
      decisionStage: 'contain',
      commonMisread: 'The alert alone was enough. Confirmation upgrades the decision from plausible to grounded.',
      counterfactuals: ['If DBE evidence had stayed absent, you would need to reconsider whether the XID story was being interpreted too narrowly.'],
      selfCheck: 'What changed in decision quality once DBE evidence matched the XID alert?',
    },
    xid79: {
      confidence: 'high',
      actionRisk: 'high',
      decisionStage: 'recover',
      commonMisread: 'All severe XIDs are memory problems. XID 79 points toward a different recovery family centered on reachability and reset.',
      counterfactuals: ['If this were only an ECC trend issue, reset would not be the most justified next move.'],
      selfCheck: 'What fault-family clue tells you to consider reset instead of containment-only action?',
    },
    xid79_reset: {
      confidence: 'medium',
      actionRisk: 'high',
      decisionStage: 'recover',
      commonMisread: 'Issuing a reset equals recovery. The outcome of the reset determines whether escalation is still necessary.',
      counterfactuals: ['If the reset fails or the GPU remains unreachable, the fault is beyond the least-disruptive recovery tier.'],
      selfCheck: 'What result would force you to escalate from GPU-scoped recovery to node-scoped recovery?',
    },
    xid74: {
      confidence: 'high',
      actionRisk: 'medium',
      decisionStage: 'investigate',
      commonMisread: 'XID 74 is just another generic GPU failure. It points toward fabric-path trouble, which changes what evidence matters most.',
      counterfactuals: ['If the problem were compute-only, link-level counters would be weaker evidence than they are in an NVLink fault.'],
      selfCheck: 'Why does XID 74 push you toward fabric reasoning rather than reset-only reasoning?',
    },
    fb_diag: {
      confidence: 'medium',
      actionRisk: 'medium',
      decisionStage: 'investigate',
      commonMisread: 'Because the job launches, the communication layer is fine. Slow success can still mean severe operational degradation.',
      counterfactuals: ['If the expected fast path were active, NCCL logs would not point toward Socket or TCP behavior.'],
      selfCheck: 'What makes slow success a serious problem in distributed training?',
    },
    fb_env: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'diagnose',
      commonMisread: 'The fabric must be broken. Environment overrides can cause the same symptom with a much simpler explanation.',
      counterfactuals: ['If the environment were clean, the investigation would lean more heavily toward transport availability or selection mismatch.'],
      selfCheck: 'Why should environment inspection come before deeper transport debugging?',
    },
    fb_ib: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'diagnose',
      commonMisread: 'Healthy IB ports automatically mean NCCL will choose them correctly. Availability and selection are related, but not identical.',
      counterfactuals: ['If IB were genuinely unavailable, the issue would no longer look like a pure path-selection or naming problem.'],
      selfCheck: 'What is the difference between transport availability and transport selection?',
    },
    fb_fix: {
      confidence: 'medium',
      actionRisk: 'medium',
      decisionStage: 'remediate',
      commonMisread: 'A config change is proof the issue is solved. A fix is only real when the system behavior changes as predicted.',
      counterfactuals: ['If the root cause were actually a dead fabric, changing the HCA selection would not restore the intended path.'],
      selfCheck: 'What evidence do you still need after applying a targeted config fix?',
    },
    fb_verify: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'validate',
      commonMisread: 'Cleaner logs are enough. They matter most when they predict and align with real performance recovery.',
      counterfactuals: ['If the logs improve but throughput does not, the explanation is still incomplete.'],
      selfCheck: 'Why is software-path verification necessary but not sufficient?',
    },
    fb_bench: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'validate',
      commonMisread: 'Transport-name recovery is the same as workload recovery. Users actually experience the bandwidth and runtime impact.',
      counterfactuals: ['If the path correction were only cosmetic, the throughput baseline would not materially recover.'],
      selfCheck: 'Why does throughput close the loop better than configuration state alone?',
    },
    stor_gpu: {
      confidence: 'medium',
      actionRisk: 'low',
      decisionStage: 'investigate',
      commonMisread: 'Low or bursty GPU utilization proves the GPU is the failing component. Often it means the GPU is starving on upstream data.',
      counterfactuals: ['If the GPU itself were the main fault, you would expect a different signal pattern than input starvation sawtoothing.'],
      selfCheck: 'Why is GPU utilization shape a clue rather than a full diagnosis?',
    },
    stor_io: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'diagnose',
      commonMisread: 'The most visible symptom tells the whole story. In pipeline issues, the GPU symptom often points to an upstream bottleneck.',
      counterfactuals: ['If storage were not involved, the I/O path would not line up so clearly with the GPU starvation pattern.'],
      selfCheck: 'What changed once the I/O path started telling the same story as GPU utilization?',
    },
    stor_lustre: {
      confidence: 'high',
      actionRisk: 'medium',
      decisionStage: 'diagnose',
      commonMisread: 'Busy storage means the whole storage system is bad. Layout mistakes can create the same effect on otherwise healthy hardware.',
      counterfactuals: ['If the dataset layout were healthy, you would expect wider storage parallelism for the same workload.'],
      selfCheck: 'How does a stripe-layout problem differ from a generic storage-capacity problem?',
    },
    stor_fix: {
      confidence: 'medium',
      actionRisk: 'medium',
      decisionStage: 'remediate',
      commonMisread: 'One storage-side fix must solve the whole pipeline. The feeder can still remain the next bottleneck.',
      counterfactuals: ['If striping had not been part of the bottleneck, widening it would have little reason to improve downstream feeding.'],
      selfCheck: 'Why should you verify the effect of striping before mixing in more changes?',
    },
    stor_dl: {
      confidence: 'medium',
      actionRisk: 'medium',
      decisionStage: 'remediate',
      commonMisread: 'Storage and DataLoader are the same issue. They are different stages that can bottleneck each other.',
      counterfactuals: ['If the loader were already sufficient, increasing workers would not be the next justified hypothesis after the stripe fix.'],
      selfCheck: 'What makes loader tuning a separate hypothesis from storage tuning?',
    },
    stor_verify: {
      confidence: 'high',
      actionRisk: 'low',
      decisionStage: 'validate',
      commonMisread: 'Changed settings are enough to declare success. The proof is whether the GPU-side symptom actually improves.',
      counterfactuals: ['If the wrong bottleneck had been fixed, the original sawtooth pattern would remain mostly unchanged.'],
      selfCheck: 'What makes the final GPU utilization pattern the most convincing proof step?',
    },
  };

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getLevel(level) {
    return LEVELS[level] || LEVELS.beginner;
  }

  function getRole(role) {
    return ROLES[role] || ROLES.cluster_operator;
  }

  function toneForValue(label, value) {
    const key = `${label}:${value}`.toLowerCase();
    if (key.includes('high') || key.includes('contain') || key.includes('recover')) return 'warn';
    if (key.includes('medium') || key.includes('prepare') || key.includes('remediate') || key.includes('investigate')) return 'mid';
    return 'good';
  }

  function renderPill(label, value) {
    if (!value) return '';
    const tone = toneForValue(label, value);
    return `<span class="explain-pill explain-pill-${tone}"><strong>${esc(label)}</strong> ${esc(value)}</span>`;
  }

  function renderPillRow(meta) {
    const pills = [
      renderPill('Confidence', meta.confidence),
      renderPill('Action Risk', meta.actionRisk),
      renderPill('Decision Stage', meta.decisionStage),
    ].filter(Boolean);
    if (!pills.length) return '';
    return `<div class="explain-pill-row">${pills.join('')}</div>`;
  }

  function renderBlock(title, body, extraClass='') {
    if (!body) return '';
    return `<div class="explain-card ${extraClass}"><div class="explain-card-title">${esc(title)}</div>${body}</div>`;
  }

  function renderList(items, className='explain-list') {
    if (!items || !items.length) return '';
    return `<ul class="${className}">${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }

  function mergeStepSignals(step) {
    const pattern = STEP_PATTERNS[step?.type] || {};
    return {
      confidence: step?.confidence || pattern.confidence || 'medium',
      actionRisk: step?.actionRisk || pattern.actionRisk || (step?.fault ? 'high' : 'low'),
      decisionStage: step?.decisionStage || pattern.decisionStage || 'diagnose',
      commonMisread: step?.commonMisread || pattern.commonMisread || '',
      counterfactuals: step?.counterfactuals || pattern.counterfactuals || [],
      selfCheck: step?.selfCheck || pattern.selfCheck || '',
      uncertainty: step?.uncertainty || '',
      tradeoff: step?.tradeoff || '',
      actionWhy: step?.actionWhy || '',
    };
  }

  function renderProfileBanner(options) {
    const level = getLevel(options.level);
    const role = getRole(options.role);
    const body = `
      <p><strong>${esc(level.label)}</strong> depth for the <strong>${esc(role.label)}</strong> lens.</p>
      <p>${esc(level.note)}</p>
      <p><strong>Role focus:</strong> ${esc(role.lens)}</p>
    `;
    return renderBlock('Explanation Profile', body, 'explain-card-profile');
  }

  function renderGlossaryNetwork(coreTerms, options) {
    if (!options.beginnerMode) return '';
    const level = getLevel(options.level);
    if (!level.showGlossary || !coreTerms || !coreTerms.length) return '';

    const seedTerms = coreTerms.slice(0, 4).map(item => item.term);
    const related = [];
    seedTerms.forEach(term => {
      (CONCEPT_GRAPH[term] || []).forEach(rel => {
        if (!seedTerms.includes(rel) && !related.includes(rel)) related.push(rel);
      });
    });
    if (!related.length) return '';

    const chips = related.slice(0, 8).map(term => `<span class="explain-chip">${esc(term)}</span>`).join('');
    return renderBlock(
      'Glossary Network',
      `<p>These related terms are likely to appear next as you move through the explanation and runtime evidence.</p><div class="explain-chip-row">${chips}</div>`,
      'explain-card-network'
    );
  }

  function renderStepCoach(step, prevStep, options) {
    const merged = mergeStepSignals(step);
    const level = getLevel(options.level);
    const role = getRole(options.role);
    const cards = [];

    cards.push(renderPillRow(merged));
    cards.push(renderBlock('Role Lens', `<p>${esc(role.lens)}</p>`, 'explain-card-role'));

    if (options.beginnerMode && level.showMisreads && merged.commonMisread) {
      cards.push(renderBlock('Common Misread', `<p>${esc(merged.commonMisread)}</p>`, 'explain-card-misread'));
    }
    if (options.beginnerMode && merged.actionWhy) {
      cards.push(renderBlock('Why This Action Fits', `<p>${esc(merged.actionWhy)}</p>`, 'explain-card-actionwhy'));
    }
    if (options.beginnerMode && merged.tradeoff) {
      cards.push(renderBlock('Operator Tradeoff', `<p>${esc(merged.tradeoff)}</p>`, 'explain-card-tradeoff'));
    }
    if (options.beginnerMode && level.showCounterfactuals && merged.counterfactuals.length) {
      cards.push(renderBlock('Counterfactual Check', renderList(merged.counterfactuals), 'explain-card-counterfactual'));
    }
    if (options.beginnerMode && merged.uncertainty) {
      cards.push(renderBlock('Uncertainty Note', `<p>${esc(merged.uncertainty)}</p>`, 'explain-card-uncertainty'));
    }
    if (options.beginnerMode && level.showSelfCheck && merged.selfCheck) {
      const compareNote = prevStep ? `<p class="explain-selfcheck-context">Tie your answer back to what changed from <strong>${esc(prevStep.label)}</strong>.</p>` : '';
      cards.push(renderBlock('Self-Check', `<p>${esc(merged.selfCheck)}</p>${compareNote}`, 'explain-card-selfcheck'));
    }

    return cards.filter(Boolean).join('');
  }

  function telemetryMeta(data) {
    const degraded = !!data?.degraded;
    const missing = (data?.collection_errors || []).length;
    return {
      confidence: degraded ? 'medium' : 'high',
      actionRisk: degraded ? 'medium' : 'low',
      decisionStage: degraded ? 'investigate' : 'validate',
      commonMisread: degraded ? 'Host-fallback telemetry is not fake, but it is also not strong proof that the GPUs themselves are healthy.' : 'Direct telemetry is stronger evidence, but it still describes the current state rather than every future failure mode.',
      counterfactuals: degraded
        ? ['If direct GPU telemetry were available, you would expect per-GPU counters and stronger hardware-specific evidence instead of host-only fallback signals.']
        : ['If the preferred evidence path were missing, you would expect degraded mode and collection errors to be present.'],
      uncertainty: degraded ? 'Important hardware evidence is missing, so the safest conclusions are narrower than they would be under direct GPU telemetry.' : '',
      tradeoff: degraded ? 'You can still reason about host health, but you should avoid over-claiming GPU health from missing per-GPU evidence.' : '',
      selfCheck: degraded ? 'Which conclusions are justified from host fallback alone, and which ones still require direct GPU evidence?' : 'What makes this a strong evidence path rather than just a larger pile of metrics?',
    };
  }

  function diagnosisMeta(data) {
    const status = data?.grounding_status || 'unknown';
    const statusMap = {
      grounded: { confidence: 'high', actionRisk: 'medium', decisionStage: 'remediate' },
      partial: { confidence: 'medium', actionRisk: 'medium', decisionStage: 'investigate' },
      kb_only: { confidence: 'low', actionRisk: 'high', decisionStage: 'investigate' },
    };
    const base = statusMap[status] || { confidence: 'medium', actionRisk: 'medium', decisionStage: 'diagnose' };
    return {
      ...base,
      commonMisread: status === 'kb_only'
        ? 'A plausible diagnosis is not the same as a live-evidence-grounded diagnosis.'
        : 'Some grounded evidence exists, but that does not mean every missing source stopped mattering.',
      counterfactuals: status === 'kb_only'
        ? ['If live grounding were available, you would expect grounded_sources to contain node evidence rather than an explanation leaning mostly on runbooks.']
        : ['If grounding were stronger, fewer key sources would appear in unavailable_sources and the diagnosis would rely less on fallback logic.'],
      uncertainty: status !== 'grounded'
        ? 'Because the grounding is incomplete, the safest interpretation is narrower than the text of the diagnosis alone might suggest.'
        : 'This diagnosis still benefits from validation, but it is backed by the strongest evidence path currently available.',
      tradeoff: status === 'kb_only'
        ? 'A runbook-only answer can still guide safe next checks, but it should not be treated as proof that the node-specific story is fully known.'
        : 'Partial grounding often justifies containment and more evidence collection before irreversible action.',
      selfCheck: 'What part of this diagnosis is grounded in live evidence, and what part is still inference or runbook guidance?',
    };
  }

  function renderRuntimeCoach(kind, data, options) {
    const level = getLevel(options.level);
    const meta = kind === 'telemetry' ? telemetryMeta(data) : diagnosisMeta(data);
    const cards = [renderPillRow(meta)];

    if (options.beginnerMode && level.showMisreads && meta.commonMisread) {
      cards.push(renderBlock('Common Misread', `<p>${esc(meta.commonMisread)}</p>`, 'explain-card-misread'));
    }
    if (options.beginnerMode && meta.tradeoff) {
      cards.push(renderBlock('Operator Tradeoff', `<p>${esc(meta.tradeoff)}</p>`, 'explain-card-tradeoff'));
    }
    if (options.beginnerMode && level.showCounterfactuals && meta.counterfactuals.length) {
      cards.push(renderBlock('Counterfactual Check', renderList(meta.counterfactuals), 'explain-card-counterfactual'));
    }
    if (options.beginnerMode && meta.uncertainty) {
      cards.push(renderBlock('Uncertainty Note', `<p>${esc(meta.uncertainty)}</p>`, 'explain-card-uncertainty'));
    }
    if (options.beginnerMode && level.showSelfCheck && meta.selfCheck) {
      cards.push(renderBlock('Self-Check', `<p>${esc(meta.selfCheck)}</p>`, 'explain-card-selfcheck'));
    }

    return cards.filter(Boolean).join('');
  }

  return {
    renderProfileBanner,
    renderGlossaryNetwork,
    renderStepCoach,
    renderRuntimeCoach,
    getLevel,
    getRole,
  };
})();
