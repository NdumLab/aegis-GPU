# Aegis-GPU

**A browser-based GPU infrastructure training simulator.** Aegis-GPU teaches the
operational skills behind NVIDIA's NCA-AIIO certification (AI Infrastructure and
Operations) through hands-on labs: learners run realistic diagnostic commands
against simulated cluster state, read authentic-looking telemetry, and
troubleshoot injected faults — ECC errors, NVLink degradation, NCCL fallbacks,
scheduler stalls — without needing a single physical GPU.

> Aegis-GPU is an independent training tool. It is **not affiliated with,
> sponsored by, or endorsed by NVIDIA Corporation.** NVIDIA, NCA-AIIO, DGX, and
> related marks are trademarks of NVIDIA Corporation. Labs are simulations;
> completing them does not guarantee any exam result.

## What's inside

- **22 guided labs** across hardware foundations (NVLink, MIG, ECC), networking
  (InfiniBand, RoCE, NCCL), platform delivery (CUDA stack, containers, Slurm,
  Kubernetes), storage (Lustre, GPUDirect), operations (DCGM monitoring), and
  AI fundamentals — each with terminal command validation, and most with
  injected-fault troubleshooting scenarios.
- **Learning guides** with a plain-language glossary: every technical term a lab
  uses is defined in that lab, nothing assumed (enforced by
  `frontend/tests/test_glossary_coverage.py`).
- **Exam alignment**: a machine-readable traceability matrix maps every official
  NCA-AIIO blueprint objective to labs, steps, and quiz items
  ([docs/nvidia-exam-coverage.md](docs/nvidia-exam-coverage.md)), enforced by
  `frontend/tests/test_exam_coverage.py`.
- **Live mode**: a FastAPI backend exposes diagnose/remediate flows, JWT auth,
  and Prometheus metrics for running against real infrastructure.

## Layout

- `frontend/` — static UI served by nginx (labs, learning guides, quiz, cluster simulator)
- `backend/` — FastAPI service (`aegis_api.py`) and its test suite
- `deploy/` — nginx, systemd, and environment examples for production rollout (see `deploy/OPERATIONS.md`)
- `docs/` — exam coverage audit, historical build logs
- `.github/workflows/` — CI: frontend and backend smoke suites on every push/PR

## Architecture notes

The frontend is **deliberately build-free**: plain JavaScript loaded via script
tags, state on `window`, no bundler or framework. This keeps deployment to a
plain nginx root, makes every file directly debuggable in production, and lets
tests evaluate the data files in Node without a toolchain. The conventions that
make this safe:

- Lab/learning data live in `labs-part-*.js` / `learning-part-*.js` chunks,
  aggregated by `labs.js` / `learning.js`; structure is enforced by
  `test_lab_data_structure.py`.
- Any changed JS file must get a `?v=` cache-bust bump in `index.html`
  (`index.html` itself is served no-store).

## Validation

- Frontend deterministic suite:
  `python3 -m unittest frontend/tests/test_auth_session_reset.py frontend/tests/test_cluster_sim_state.py frontend/tests/test_cluster_terminal_state.py frontend/tests/test_frontend_smoke.py frontend/tests/test_lab_data_structure.py frontend/tests/test_exam_coverage.py frontend/tests/test_glossary_coverage.py`
- Frontend browser proof (headless Firefox; use Mozilla's deb build, the snap hangs headless):
  `AEGIS_BROWSER_PROOF_SCENARIOS=study_progress_empty,cluster_fleet_layout,lab_terminal_nvlink,ecc_bad python3 -m unittest frontend/tests/test_frontend_browser_proof.py -v`
- Backend syntax: `python3 -m py_compile backend/aegis_api.py backend/node_scraper.py backend/tests/test_api.py backend/tests/test_api_unittest.py`
- Backend unittest smoke: `python3 -m unittest discover -s backend/tests -p "test_*unittest.py"`

CI runs on every push and pull request: the deterministic suites
(`frontend-smoke`, `backend-smoke`) plus a `browser-tests` job that installs
Firefox on the runner and executes the headless browser smoke scenarios, the
end-to-end registration/password-reset flow against a real spawned backend,
and a proof-scenario subset.

## Security & configuration

- Live secrets are intentionally excluded. Start from `deploy/env/aegis.env.example`.
- Backend logins fail closed: if no `ADMIN_HASH`/`AEGIS_ADMIN_PASSWORD` (or
  analyst equivalents) are configured, authentication is rejected.

## License

Proprietary — see [LICENSE](LICENSE). For licensing, partnership, or
educational-use inquiries, contact the repository owner.
