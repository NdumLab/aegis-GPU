.PHONY: clean setup test backend-test frontend-test smoke deploy

clean:
	find . -depth -type d \( -name __pycache__ -o -name .pytest_cache \) -exec rm -rf {} +
	find . -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete

setup:
	bash scripts/bootstrap_setup.sh

backend-test:
	python3 -m py_compile backend/log-analizer.py backend/node_scraper.py
	python3 -m unittest -v tests/backend/test_api_unittest.py

frontend-test:
	python3 -m unittest discover -v -s tests/frontend -p 'test_*.py'

smoke:
	bash tests/smoke/smoke_test.sh

test: backend-test frontend-test

deploy:
	sudo bash scripts/deploy.sh
