# Aegis-GPU Frontend

Deployed static frontend for the Aegis-GPU training and operations interface.

## Scope
- Static HTML, CSS, JavaScript, and font assets served by nginx from `/var/www/html`.
- Uses the backend API through `/api/v1` on the same origin.

## Smoke Test
Run the frontend smoke test with:

```bash
python3 -m unittest discover -s tests -p 'test_*.py'
```
