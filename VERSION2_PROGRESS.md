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


## 2026-04-17 07:16 EDT

Status: Version 2 committed and pushed

Published commits:
- `d96953a` `Build beginner-friendly Version 2 learning mode`

Push result:
- `master` -> `origin/master` succeeded

Release summary:
- Added the Beginner Mode learning system and curated lesson data module
- Added live telemetry and diagnosis teaching overlays that explain evidence quality and grounding
- Added beginner annotations to parser and incident history
- Deepened the highest-value non-ECC lesson modules so Version 2 is no longer ECC-heavy only

Repository state at time of logging:
- local `master` matched `origin/master` before this log entry was appended

## 2026-04-17 07:26 EDT

Status: secondary lesson modules deepened and deployed

Completed this session:
- Deepened the remaining thinner Version 2 lesson modules in `frontend/js/learning.js`, specifically:
  - `allreduce`
  - `ib_fabric`
  - `roce`
  - `storage`
  - `gds`
  - `slurm`
  - `k8s`
- Expanded those modules with stronger beginner-teaching structure, including richer `coreTerms`, `lifecycle`, `watchFor`, `safeActions`, `whatNotToDo`, `escalateWhen`, and `readMore` content
- Preserved the real operator vocabulary while adding clearer beginner context around terms like `Bandwidth baseline`, `Fabric sweep`, `PFC storm`, `I/O bottleneck`, `Data path`, and `Pending reason`
- Deployed the updated lesson content to the live site

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 7/7
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `learning.js` now serves the deeper secondary-module content and `whatNotToDo` sections

Current Version 2 shape:
- Beginner Mode now has meaningful teaching depth across primary and secondary lesson modules
- The learning system keeps real GPU-ops jargon visible while explaining it in plain language
- Common beginner mistakes are now called out more consistently across lessons

## 2026-04-17 07:51 EDT

Status: guided flow upgraded with richer step-by-step teaching

Completed this session:
- Reworked the lab intro guided-flow renderer in `frontend/js/app.js` so each step can now show structured teaching blocks instead of only a label and command snippet
- Added richer guided-step support for:
  - `Why This Stage Matters`
  - `Look For`
  - `What It Means`
  - `Do This`
  - `Avoid This`
- Deepened the `ECC Error Lifecycle` steps in `frontend/js/labs.js` so the guided flow now teaches the full progression from healthy baseline to SBE trend, XID 48, and containment
- Added new guided-step card styling in `frontend/css/styles.css`
- Bumped frontend asset versions in `frontend/index.html` so the live site picks up the new guided-flow content immediately
- Extended frontend smoke coverage for the richer guided-flow structure and ECC step content
- Deployed the updated frontend live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 8/8
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `labs.js?v=20260417d`, `learning.js?v=20260417d`, and `app.js?v=20260417d`
- Live `labs.js` now serves the richer ECC guided-step fields and explanations

Current Version 2 shape:
- Guided flows can now teach each step instead of only sequencing it
- The ECC lab now explains what to watch, how to interpret the signals, what action follows, and what mistakes to avoid
- Beginner Mode is becoming more like an annotated operations tutor than a simple lab launcher

## 2026-04-17 08:18 EDT

Status: comparative guided explanations deployed

Completed this session:
- Extended the guided-flow renderer in `frontend/js/app.js` so step teaching is now comparative and stateful instead of only descriptive
- Added a new `Reasoning Check` block that can explain:
  - what changed from the previous step
  - what conclusion is justified now
  - what is still too early to conclude
  - what threshold was crossed
- Deepened the `ECC Error Lifecycle` step data in `frontend/js/labs.js` with the new comparative reasoning fields so the lab now teaches operator judgment thresholds, not only observations and actions
- Added visual treatment for the new comparative reasoning block in `frontend/css/styles.css`
- Extended frontend smoke coverage for the comparative explanation structure
- Bumped frontend asset versions in `frontend/index.html` and redeployed live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 8/8
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `labs.js?v=20260417e`, `learning.js?v=20260417e`, and `app.js?v=20260417e`
- Live `app.js` now serves `Reasoning Check`, `Conclusion you can justify now`, and `Threshold crossed`
- Live `labs.js` now serves the new comparative ECC reasoning fields

Current Version 2 shape:
- Guided explanations now teach progression and judgment, not just terminology and actions
- The ECC flow now explicitly shows when the operator should observe, when they should prepare, and when they must contain
- Aegis is moving closer to a tutor that explains decision quality, not just decision order

## 2026-04-17 08:32 EDT

Status: comparative explanations expanded beyond ECC

Completed this session:
- Deepened the comparative guided-explanation model in `frontend/js/labs.js` across additional high-value labs:
  - `nvlink`
  - `nvlink_fault`
  - `nccl_fallback`
  - `storage`
- Added richer step-by-step reasoning in those labs for:
  - what changed from the previous step
  - what conclusion is justified now
  - what is still too early to conclude
  - what threshold was crossed
- Extended the teaching depth so the guided flows now cover topology degradation, XID fault-family differentiation, TCP fallback diagnosis, and storage-starvation reasoning with the same comparative structure used in ECC
- Expanded frontend smoke coverage to look for the new broader comparative-reasoning strings
- Bumped frontend asset versions in `frontend/index.html` and redeployed live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 8/8
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `labs.js?v=20260417f`, `learning.js?v=20260417f`, and `app.js?v=20260417f`
- Live `labs.js` now serves comparative reasoning for NVLink topology degradation, XID drill reset/escalation, NCCL config-vs-fabric diagnosis, and storage bottleneck progression

Current Version 2 shape:
- Comparative reasoning is no longer ECC-only
- Guided explanations now teach fault-family differences and cross-layer reasoning across multiple major workflows
- Aegis is moving from a strong single exemplar toward a system-wide explanation model



## 2026-04-17 08:44 EDT

Status: shared explanation engine deployed

Completed this session:
- Added a new shared explanation engine at `frontend/js/explain.js` so Version 2 can reuse the same teaching primitives across guided labs, learning cards, live telemetry, and diagnosis overlays
- Added persistent explanation controls in `frontend/index.html` for both depth and role, including:
  - `Explanation Depth`: `Beginner`, `Intermediate`, `Operator`
  - `Role Lens`: `Cluster Operator`, `SRE`, `ML Engineer`
- Extended `frontend/js/app.js` so Beginner Mode now uses the shared engine to render:
  - profile-aware banners
  - glossary-network links between related terms
  - guided-step coaching with confidence, action-risk, decision-stage, misconception, counterfactual, and self-check blocks
  - runtime coaching for live telemetry and diagnosis payloads
- Added the shared explanation styling in `frontend/css/styles.css`
- Fixed `scripts/deploy.sh` so the new `frontend/js/explain.js` asset is installed into `/var/www/html/js/explain.js` during live deployment
- Extended frontend smoke coverage so the explanation engine asset, learner-profile state, core explanation primitives, and deploy-path regression are part of the regression path
- Deployed the updated frontend live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 8/8
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `js/explain.js?v=20260417g`, `js/app.js?v=20260417g`, `sel-explain-level`, and `sel-explain-role`
- Live `/var/www/html/js/explain.js` now serves `window.AEGIS_EXPLAINER` after the deploy-path fix
- Live `app.js` now serves `getExplanationOptions`, `renderStepCoach`, and `renderRuntimeCoach`

Current Version 2 shape:
- Explanations are no longer only lab-authored text blocks; there is now a reusable explanation layer with shared reasoning patterns
- The UI can explain the same signal differently for a beginner, intermediate learner, or operator without hiding the real GPU-ops terminology
- Guided flows, live telemetry, and diagnosis overlays are now moving toward one explanation system instead of separate one-off explanations


## 2026-04-17 10:19 EDT

Status: in-lab beginner coaching deployed

Completed this session:
- Added a persistent `Lab Coach` panel beside the terminal in `frontend/index.html` so beginners keep getting guidance after the intro overlay closes
- Extended `frontend/js/app.js` so each active lab step now explains:
  - what the command is for
  - how to use the step
  - what to look for in the output
  - how to read the most important output lines
  - what the result means
  - how to tell the step is done
  - which side metrics and event signals matter
  - what action to take next
- Prefilled the terminal input with the current step command so the active command stays visible while the learner works through the lab
- Added line-level output explanations for common beginner pain points such as `NV4`, `PHB`, `XID 48`, `XID 79`, `Using network Socket`, `100% util`, and `stripe_count: 1`
- Added responsive styling for the new in-lab coaching panel in `frontend/css/styles.css`
- Extended frontend smoke coverage so the new lab-coach surface and its core teaching strings are part of the regression path
- Deployed the updated frontend live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 9/9
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `app.js?v=20260417i` and the `lab-step-coach` panel shell
- Live `/var/www/html/js/app.js` now serves `renderLabStepCoach`, `How To Read This Output`, and `How To Tell You Are Done`

Current Version 2 shape:
- The lab intro no longer carries all the teaching burden by itself
- Beginners now get runtime help while they are looking at terminal output, not just before the lab starts
- The terminal, metrics sidebar, and event log are now explained as one guided reading surface instead of three disconnected UI areas


## 2026-04-17 10:27 EDT

Status: frontend presentation cleanup deployed

Completed this session:
- Audited the live frontend for presentation regressions after the lab-coach rollout
- Found and fixed malformed HTML structure in `frontend/index.html`, specifically:
  - the sidebar quiz action wrapper
  - the quiz overlay panel header/content wrapper
- Replaced the broken inline-flex wrappers with proper structural containers: `sidebar-action-row`, `quiz-panel`, and `quiz-panel-header`
- Added supporting presentation rules in `frontend/css/styles.css` so the repaired markup renders cleanly instead of depending on brittle inline styles
- Extended frontend smoke coverage so this exact markup regression is now caught automatically
- Redeployed the corrected frontend live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 9/9
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `sidebar-action-row`, `quiz-panel`, and `quiz-panel-header`
- The old malformed inline-flex wrapper is no longer present in the served frontend

Current Version 2 shape:
- The beginner-focused lab UX is still live
- The surrounding presentation shell is cleaner and structurally safer
- The frontend now has regression coverage for this repaired overlay/sidebar markup path


## 2026-04-17 10:39 EDT

Status: lab guide made toggleable and better spaced

Completed this session:
- Reworked the in-lab `Lab Coach` into a hideable floating panel instead of a permanently visible side column
- Added a `📘 Guide` toggle button in the terminal toolbar and a close button inside the guide panel
- Added persisted UI state with `gpusim_lab_coach_open` so the guide can stay hidden unless the learner wants it
- Reorganized the guide layout into a top bar plus scrollable content area so it fits the terminal space better
- Improved section spacing, list spacing, paragraph rhythm, and card grouping in `frontend/css/styles.css` so the explanation text is easier to scan
- Kept the guide content intact while making it much less intrusive in the terminal workflow
- Redeployed the updated frontend live

Verification completed:
- `python3 -m unittest -v /home/henry/aegis-gpu/tests/frontend/test_frontend_smoke.py` passed: 9/9
- `bash /home/henry/aegis-gpu/tests/smoke/smoke_test.sh` passed: 19/19
- Live `index.html` now serves `btn-toggle-coach`, `btn-close-coach`, `lab-step-coach-shell`, and `lab-step-coach-content`
- Live `app.js` now serves `toggleLabCoach` and persisted `gpusim_lab_coach_open` state

Current Version 2 shape:
- Lab explanations no longer consume fixed terminal width by default
- The learner can open the guide only when needed and scroll it independently
- The explanation layout is more organized and readable under the actual terminal-space constraints

## 2026-04-17 10:58 EDT
- fixed floating Lab Guide clipping and close-control reliability after runtime feedback
- changed the guide shell to a full-height flex column so the content region can scroll instead of being clipped by the terminal pane
- raised the close control above the content layer and added delegated click handling as a fallback path
- redeployed live and verified the served markup/CSS includes the repaired guide container, close button, and scrollable content region
- verification: `python3 -m unittest -v tests/frontend/test_frontend_smoke.py` passed; `bash tests/smoke/smoke_test.sh` passed
