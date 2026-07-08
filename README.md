# Aegis-GPU

Monorepo for the Aegis-GPU production deployment.

## Layout
- `frontend/`: static UI served by nginx
- `backend/`: FastAPI service and smoke tests
- `deploy/`: nginx, systemd, and environment examples for production rollout

## Notes
- Live secrets are intentionally excluded. Use `deploy/env/aegis.env.example` as the starting point for deployment.
- The backend exposes diagnose/remediate flows used by the frontend live mode.

## Validation
- Frontend deterministic smoke: `python3 -m unittest frontend/tests/test_auth_session_reset.py frontend/tests/test_cluster_sim_state.py frontend/tests/test_cluster_terminal_state.py frontend/tests/test_frontend_smoke.py frontend/tests/test_lab_data_structure.py`
- Frontend browser proof: `AEGIS_BROWSER_PROOF_SCENARIOS=study_progress_empty,cluster_fleet_layout,lab_terminal_nvlink,ecc_bad python3 -m unittest frontend/tests/test_frontend_browser_proof.py -v`
- Backend syntax: `python3 -m py_compile backend/log-analizer.py backend/node_scraper.py backend/tests/test_api.py backend/tests/test_api_unittest.py`
- Backend unittest smoke: `python3 -m unittest discover -s backend/tests -p "test_*unittest.py"`

## CI Templates
- GitHub Actions templates are staged in `ci/github-actions/`.
- Move them into `.github/workflows/` after using a token with GitHub `workflow` scope or a repo admin session.
