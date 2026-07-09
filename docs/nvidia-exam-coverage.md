# NVIDIA Certification Coverage Audit

**Audit date:** 2026-07-09
**Machine-readable source of truth:** [`nvidia-exam-coverage.json`](./nvidia-exam-coverage.json)
**Automated enforcement:** `frontend/tests/test_exam_coverage.py`

> **Integrity note.** Objectives below are transcribed from the current official
> NVIDIA certification blueprint page. No exam dumps, leaked questions, or
> brain-dumps were used. Completing these labs **does not guarantee passing the
> exam** — it builds the observable operator skills the blueprint describes.

---

## 1. Certifications audited

| Exam code | Certification | Blueprint source | Retrieved |
|-----------|---------------|------------------|-----------|
| **NCA-AIIO** | NVIDIA-Certified Associate: AI Infrastructure and Operations | <https://www.nvidia.com/en-us/learn/certification/ai-infrastructure-operations-associate/> | 2026-07-09 |

Exam facts (from the same page): 50 questions, 60 minutes, USD $125, valid 2 years.

### Blueprint domains and weights

| Domain | Name | Weight | Sub-objectives |
|--------|------|--------|----------------|
| D1 | Essential AI Knowledge | 38% | 8 |
| D2 | AI Infrastructure | 40% | 10 |
| D3 | AI Operations | 22% | 4 |

---

## 2. Rating scale

Coverage is scored by **observable learning outcome**, never by keyword mention.

| Rating | Value | Meaning |
|--------|-------|---------|
| **Full** | 1.0 | Explain (learning guide + observe screenshots) **and** execute (terminal step with accepted-command validation) **and** troubleshoot (a discrete injected-fault step, `step.fault === true`). |
| **Partial** | 0.5 | Explain + execute, but no discrete injected-fault troubleshooting step (hardware/facility limited, or a fix-flow without a flagged fault). |
| **Theory-only** | 0.3 | Explanation and reasoning only; no sandbox-executable command. |
| **Missing** | 0.0 | No observable learning outcome in the repository. |

Weighted score per domain = `weight% × (Σ ratings ÷ objective count)`. Total = Σ domain scores. These formulas are re-derived and asserted by `test_exam_coverage.py::test_weighted_scores_match_ratings`.

---

## 3. Weighted coverage — before vs after

| Domain | Weight | Before | After |
|--------|-------:|-------:|------:|
| D1 Essential AI Knowledge | 38% | 4.75% | **31.35%** |
| D2 AI Infrastructure | 40% | 18.00% | **34.00%** |
| D3 AI Operations | 22% | 16.50% | **19.25%** |
| **Total** | **100%** | **39.25%** | **84.60%** |

---

## 4. Traceability matrix

Each objective maps to concrete lab ids, the step types that deliver the outcome,
the reinforcing quiz questions, and the validation mechanism. Lab ids resolve to
`window.AEGIS_LABS_PARTS.<group>.<labId>` (aggregated in `frontend/js/labs.js`);
step types resolve to `TERMINAL_OUTPUT[<type>]` fixtures.

### D1 — Essential AI Knowledge (38%)

| Obj | Objective | Labs | Key step types | Quiz | Before → After |
|-----|-----------|------|----------------|------|----------------|
| 1.1 | AI / ML / DL relationship | `ai_concepts` | `aic_taxonomy` | 20 | Missing → **Full** |
| 1.2 | GPU vs CPU architecture | `ai_concepts` | `aic_cpu`, `aic_gpu`, `aic_arch` | 21 | Missing → **Full** |
| 1.3 | Training vs inference | `inference`, `training` | `inf_train_profile`, `inf_serve_deploy` | 22 | Partial → **Full** |
| 1.4 | Factors driving AI adoption | `ai_concepts` (theory) | — | — | Missing → **Theory-only** |
| 1.5 | Key use cases & industries | `ai_concepts` (theory) | — | — | Missing → **Theory-only** |
| 1.6 | NVIDIA software stack (CUDA-X, NeMo, NIM, Triton, RAPIDS) | `nvidia_stack`, `cuda_stack` | `ns_cudax`, `ns_inventory` | 23, 24, 25 | Partial → **Full** |
| 1.7 | AI development lifecycle | `nvidia_stack`, `inference` | `ns_lifecycle`, `inf_optimize` | 26 | Missing → **Full** |
| 1.8 | NVIDIA AI platforms (DGX, Base Command, AI Enterprise) | `nvidia_stack` | `ns_solutions` | — | Missing → **Full** |

### D2 — AI Infrastructure (40%)

| Obj | Objective | Labs | Key step types | Quiz | Before → After |
|-----|-----------|------|----------------|------|----------------|
| 2.1 | NVLink / NVSwitch interconnect | `nvlink`, `nvlink_fault` | `topo`, `nvlink_fault` | — | Full → **Full** |
| 2.2 | NCCL / all-reduce | `allreduce`, `nccl_fallback` | `ar_bench`, `ar_fault` | 25 | Full → **Full** |
| 2.3 | InfiniBand fabric | `ib_fabric` | `ib_stat`, `ib_fault` | — | Full → **Full** |
| 2.4 | RoCE / Ethernet | `roce` | `roce_pfc`, `roce_fault` | — | Full → **Full** |
| 2.5 | AI storage / GPUDirect Storage | `storage`, `gds` | `stor_lustre`, `gds_new` | — | Partial → **Partial** |
| 2.6 | Cluster compute sizing | `infra_planning` | `ip_sizing` | — | Missing → **Full** |
| 2.7 | Facility power & cooling | `infra_planning` | `ip_power`, `ip_cooling` | 27 | Missing → **Partial** |
| 2.8 | Scaling / SuperPOD units | `infra_planning` | `ip_scale` | 28 | Missing → **Full** |
| 2.9 | DPU / BlueField offload | `dpu_cloud` | `dpu_host_load`, `dpu_identify`, `dpu_offload` | 29 | Missing → **Full** |
| 2.10 | Cloud vs on-prem | `dpu_cloud` | `dpu_cloud_decision` | 30 | Missing → **Partial** |

### D3 — AI Operations (22%)

| Obj | Objective | Labs | Key step types | Quiz | Before → After |
|-----|-----------|------|----------------|------|----------------|
| 3.1 | Monitoring & telemetry (DCGM) | `monitoring` | `mon_prom`, `mon_alert` | — | Full → **Full** |
| 3.2 | Scheduling (Slurm, Kubernetes) | `slurm`, `k8s` | `slurm_submit`, `k8s_gang` | — | Partial → **Partial** |
| 3.3 | Virtualization (MIG, vGPU, time-slicing) | `mig`, `vgpu` | `mig_create`, `vgpu_profiles`, `vgpu_oversub` | 31 | Partial → **Full** |
| 3.4 | Troubleshooting (ECC, NVLink, NCCL) | `ecc`, `nvlink_fault`, `nccl_fallback` | `ecc_xid`, `xid48`, `fb_fix` | — | Full → **Full** |

---

## 5. Objectives that cannot be fully reproduced without NVIDIA hardware / licensed software

These are documented rather than over-claimed. Each provides the safest realistic
simulation the sandbox allows.

| Obj | Constraint | Simulation provided | Rating |
|-----|------------|---------------------|--------|
| 2.7 | Real power draw / rack cooling need physical DGX/HGX + facility instrumentation. | Sizing math, PDU/thermal reasoning against realistic fixtures. | Partial |
| 2.10 | Real TCO / procurement need live vendor pricing + org constraints. | Decision framework against representative figures. | Partial |
| 3.3 | MIG / vGPU need supported GPUs + licensed vGPU / AI Enterprise. | Faithful simulated `nvidia-smi` / `mig` / `vgpu` output + oversubscription fault. | Full (simulated) |
| 2.1 | NVLink/NVSwitch need multi-GPU NVLink hardware. | Simulated `nvidia-smi nvlink` topology + degradation fault. | Full (simulated) |
| 2.3 | InfiniBand needs real switches/HCAs + subnet manager. | Simulated `ibstat` / `ibdiagnet` output. | Full (simulated) |
| 3.2 | Multi-node Slurm/K8s need a real cluster. | Simulated `srun`/`sbatch`/`kubectl` output. | Partial |

---

## 6. Remaining enhancements (documented, not hidden)

1. **Obj 2.5 (storage):** add a discrete injected-fault step (e.g., GDS not engaging → CPU bounce-buffer fallback) to raise Partial → Full. The lab currently teaches a fix-flow but has no `fault:true` step.
2. **Obj 3.2 (scheduling):** add a discrete injected-fault step (e.g., a job stuck `Pending` on an unsatisfiable GRES/gang request) to raise Partial → Full.
3. **Obj 1.4 / 1.5:** remain Theory-only — conceptual objectives (adoption drivers, use cases/industries) with no sandbox-executable command.

---

## 7. Exact files changed in this audit

| File | Change |
|------|--------|
| `frontend/js/labs-part-5.js` | **New.** 6 labs (`ai_concepts`, `inference`, `nvidia_stack`, `infra_planning`, `dpu_cloud`, `vgpu`), each with execute steps and an injected-fault step. |
| `frontend/js/labs.js` | Registered `exam_coverage_extension` group; added 24 `TERMINAL_OUTPUT` fixtures; cache-version bump. |
| `frontend/index.html` | Loaded `labs-part-5.js`; added nav items + badges for the 6 new labs under new "AI Fundamentals" / "Infrastructure Planning" sections. |
| `frontend/js/learning-part-2.js` | 6 learning guides (all 7 required sections) incl. theory for obj 1.4 / 1.5. |
| `frontend/js/study-quiz.js` | Blueprint retrieval note; study-path phases 6 & 7; quiz items 20–31 with wrong-choice + correct-choice feedback. |
| `frontend/tests/test_lab_data_structure.py` | Added `labs-part-5.js`; lab count 16 → 22; new labs in terminal-metadata list. |
| `docs/nvidia-exam-coverage.json` | **New.** Machine-readable traceability matrix (source of truth). |
| `docs/nvidia-exam-coverage.md` | **New.** This document. |
| `frontend/tests/test_exam_coverage.py` | **New.** Asserts every objective maps to a real lab, step types exist, executable objectives have an accepted-command step, Full objectives have a fault step, and the weighted scores re-derive from the ratings. |

---

## 8. Test results

See the summary printed by the audit run and the CI commands in the project
README. All frontend structure, smoke, and coverage tests pass; every JS file
passes `node --check`; backend unittest suite passes.
