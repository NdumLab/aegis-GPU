# Version 2 Progress Log

This file is the running progress log for the Version 2 beginner-friendly upgrade. New progress entries should be appended here from now on.

## 2026-04-17 06:45 EDT

Status: in progress
Baseline commit: `d48bcf2`
Working tree state when log was created: frontend Version 2 changes in progress and not yet deployed to live web root

Completed this session:
- Added a new curated learning content module at `frontend/js/learning.js`
- Added a persistent `Beginner Mode` toggle and `Learn` entry point in `frontend/index.html`
- Extended `frontend/js/app.js` so lab intros can render annotated jargon, plain-language explanations, safe beginner actions, and deeper lifecycle content when available
- Added teaching-focused styling in `frontend/css/styles.css`
- Added frontend smoke coverage for Beginner Mode and the learning module in `tests/frontend/test_frontend_smoke.py`
- Extended repo smoke coverage in `tests/smoke/smoke_test.sh`

Version 2 scope implemented so far:
- Real jargon is preserved instead of hidden
- Beginner explanations are additive, not replacements
- ECC Error Lifecycle is the deepest current learning module
- Additional labs now have starter teaching cards through the shared learning schema
- Beginner Mode preference is stored in `localStorage` as `gpusim_beginner_mode`

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_browser_smoke.py` returned `OK (skipped=1)` because headless Firefox on this host did not execute the harness JavaScript

Not done yet:
- Live deployment of the Version 2 frontend changes
- Runtime browser validation against the deployed site
- Expansion of the beginner content depth beyond the first pass for all labs
- Integration of beginner explanations into live diagnosis and telemetry views

Next logical steps:
1. Deploy the updated frontend
2. Validate Beginner Mode and the learning overlay in the running site
3. Deepen the highest-value modules after ECC: XID faults, thermal throttling, NVLink degradation, NCCL fallback


## 2026-04-17 06:44 EDT

Status: deployed to live site

Completed this session:
- Fixed `scripts/deploy.sh` so it now installs `frontend/js/learning.js` into `/var/www/html/js/learning.js`
- Re-ran Version 2 frontend smoke and repo smoke after the deployment-path fix
- Deployed the current Version 2 frontend changes to the live site with `sudo bash /home/henry/aegis-gpu/scripts/deploy.sh`
- Validated that the live homepage now serves the Version 2 HTML controls and assets

Live validation results:
- `https://127.0.0.1/` contains `js/learning.js`, `toggle-beginner`, `btn-learn`, and `Beginner Mode`
- `https://127.0.0.1/js/learning.js` returns HTTP 200 and serves the curated learning module
- `https://127.0.0.1/js/app.js?v=20260417c` serves the Beginner Mode logic, including `gpusim_beginner_mode`, `renderLearningGuide`, and the upgraded `showIntro()` path

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- live asset check for `https://127.0.0.1/js/learning.js` returned HTTP 200

Current known gap:
- Browser-automation validation is still limited on this host because the headless Firefox harness does not execute the smoke JavaScript here

Next logical steps:
1. Add richer beginner content to the highest-value non-ECC labs
2. Surface beginner explanations inside live diagnosis and telemetry views, not only lab intros
3. Commit and push the Version 2 work once this slice is complete


## 2026-04-17 06:49 EDT

Status: live-teaching hooks deployed

Completed this session:
- Added a `Live Explain` panel to the metrics sidebar in `frontend/index.html`
- Extended `frontend/js/app.js` so live telemetry now feeds a beginner-aware explainer based on real backend fields such as `telemetry_scope`, `telemetry_sources`, `collection_errors`, `per_gpu`, and `fabric_summary`
- Added compact-vs-detailed behavior so the explainer reacts when `Beginner Mode` is toggled during a live session
- Upgraded the diagnosis overlay so it now explains `diagnosis_source`, `grounding_status`, `grounded_sources`, `unavailable_sources`, and the honesty check in plain language
- Added supporting styles in `frontend/css/styles.css`
- Extended frontend smoke coverage for the new live teaching hooks

Runtime grounding used for this implementation:
- Live `/api/v1/hardware/metrics` currently returns degraded host-fallback telemetry on this machine
- Live `/api/v1/diagnose/48` currently returns `grounding_status: kb_only`, which means the diagnosis is runbook-grounded rather than backed by live node evidence
- The new Version 2 explanations were written against those real payload fields instead of guessed structures

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live homepage HTML now serves `live-explainer-body`
- Live `app.js` now serves `lastLiveTelemetry`, `renderBeginnerTelemetryExplanation`, and `renderDiagnosisExplanation`

Current known gap:
- Full browser-driven interaction validation is still limited on this host because the headless Firefox harness does not execute the smoke JavaScript here

Next logical steps:
1. Deepen the non-ECC lesson content for XID faults, thermal throttling, NVLink degradation, and NCCL fallback
2. Add beginner annotations to more runtime surfaces such as incident history and parser results
3. Commit and push the accumulated Version 2 work once this slice is considered complete


## 2026-04-17 06:53 EDT

Status: parser and incident-history teaching hooks deployed

Completed this session:
- Added `describeIncidentKind()` so incident history can explain what `diagnose` and `remediate` entries mean in plain language
- Added `explainParsedXid()` so the log parser can explain common XID fault codes while keeping the real operator code visible
- Updated the parser flow to add beginner-only explanation lines for XID meaning and PCI/GPU mapping
- Updated incident history rows to include a beginner-only note block describing the type of response record being shown
- Added styling for the new incident-history explanation block
- Extended frontend smoke coverage for the new parser and incident-history teaching hooks

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `app.js` now serves `describeIncidentKind`, `explainParsedXid`, and the new beginner parser lines

Current Version 2 shape:
- Lab intros now teach the concepts before a lab begins
- Live telemetry now explains evidence quality and degraded-mode meaning
- Diagnosis overlays now explain grounding and honesty fields
- Parser and incident history now add beginner-facing explanations without hiding the real jargon

Next logical steps:
1. Deepen the content depth of the most important non-ECC modules
2. Add similar annotated explanations to more runtime surfaces where raw operator terminology still appears
3. Commit and push the accumulated Version 2 work once this implementation wave is complete


## 2026-04-17 07:14 EDT

Status: deeper non-ECC lesson content deployed

Completed this session:
- Extended the lesson renderer in `frontend/js/app.js` so Beginner Mode can now show a `What Not To Do` section when a lesson provides it
- Deepened the highest-value non-ECC lesson modules in `frontend/js/learning.js`, especially:
  - `nvlink_fault`
  - `nvlink`
  - `cuda_stack`
  - `training`
  - `nccl_fallback`
  - `monitoring`
- Added richer lesson elements such as expanded `lifecycle`, `watchFor`, `escalateWhen`, `readMore`, and `whatNotToDo` guidance where those modules were previously shallow
- Preserved the real operator jargon while adding more operationally useful context around terms like `Containment`, `Compatibility matrix`, `Rank`, `NCCL_IB_HCA`, and `Alert rule`

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `learning.js` now serves the deeper non-ECC lesson terms and `whatNotToDo` sections

Current Version 2 shape:
- Beginner content is no longer ECC-heavy only
- The highest-value networking, stack, and training lessons now have more realistic operational depth
- Lessons teach both safe next actions and common beginner mistakes to avoid

Next logical steps:
1. Commit and push the accumulated Version 2 work
2. If Version 2 content expansion continues after that, deepen the remaining secondary modules and add more runtime-specific teaching cues where raw metrics still appear
