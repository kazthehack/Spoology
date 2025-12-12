
# Backend (FastAPI)

Same as before, exposes `/health` and `/analyze/spool-image`.

Run locally:

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
