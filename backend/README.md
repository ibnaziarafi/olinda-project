# Olinda Backend

FastAPI + SQLite backend for the Olinda chatbot, using two free APIs for two
different jobs:
- **Groq**, running **Llama 3.3 70B** (open-source, no vendor lock-in) — the
  model that actually answers students. This is the "custom LLM" — swap
  `GROQ_MODEL` for any other model Groq hosts without touching the code.
- **Gemini's embedding API** — used only to turn text into vectors for
  search (retrieval), not for answering. Kept because it's free and Groq
  doesn't offer embeddings.

Pairs with the existing `index.html` widget (calls this backend instead of
matching keywords locally).

## ⚠️ About the Gemini key you pasted in chat earlier

Treat it as already compromised. Regenerate it at
[aistudio.google.com/apikey](https://aistudio.google.com/apikey), and get a
**new** free key for Groq at
[console.groq.com/keys](https://console.groq.com/keys) — neither goes in any
file that gets committed; both live in a local `.env` that `.gitignore`
excludes.

## Setup

```bash
cd olinda-backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# open .env and paste both keys in there
```

## Add your course content

```bash
python ingest.py path/to/course_guide.pdf --tasc-level 2 --doc-type course_guide
python ingest.py path/to/tasc_standards.pdf --doc-type tasc_standard
```

This creates `olinda.db` (SQLite file) with your content embedded and ready
to search. Re-run `ingest.py` any time a source PDF is updated.

## Run it

```bash
uvicorn main:app --reload
```

Backend is now live at `http://localhost:8000`. Check it's up:

```bash
curl http://localhost:8000/health
```

## Connect the frontend

In `index.html`, `BACKEND_URL` is currently set to `http://localhost:8000`
for local testing. Once you deploy the backend (see below), update that one
line to your live backend URL.

## Deploying — completely free, step by step

**Platform: [Render](https://render.com) free web service.** No credit card,
750 free instance-hours/month (one always-on-ish service comfortably fits).

### 1. Build the database locally, then commit it

Render's free tier wipes the local filesystem on every restart, so instead of
building `olinda.db` on the server, build it once on your own machine and
commit the file itself — it's just text + numbers, no secrets:

```bash
python ingest.py course_guide.pdf --tasc-level 2 --doc-type course_guide
git add olinda.db
git commit -m "Add pre-built knowledge base"
```

Every time Render spins your service back up (or redeploys), it checks out
the repo fresh — `olinda.db` comes right along with it, already populated.
Re-run `ingest.py` and commit again whenever the source PDF changes.

### 2. Push the backend to its own GitHub repo

Keep this separate from your `HoCo` (frontend) repo — cleaner for Render to
build from:

```bash
cd olinda-backend
git init
git add .
git commit -m "Olinda backend"
gh repo create olinda-backend --public --source=. --push
# (or create the repo on github.com and `git remote add origin ...` + push)
```

### 3. Create the Render service

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect the `olinda-backend` repo
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Instance Type:** Free
6. Under **Environment**, add both `GROQ_API_KEY` and `GEMINI_API_KEY`
   (your regenerated keys) — these stay in Render's dashboard, never in
   your repo
7. Deploy. You'll get a URL like `https://olinda-backend.onrender.com`

### 4. Point the frontend at it

In `index.html`, change:

```js
const BACKEND_URL = "http://localhost:8000";
```

to your Render URL, then push to your `HoCo` repo as usual.

### What "free" actually costs you

- **Cold starts:** after 15 min with no traffic, the service sleeps. The
  next message wakes it up — expect ~30–60 seconds before the first reply.
  Totally normal for a free tier; just don't be surprised during a demo.
- **Session logs reset on sleep/restart:** `sessions`, `messages`, and
  `unanswered_log` are wiped along with everything else on the free
  filesystem, since only `olinda.db`'s *course content* is preserved via
  git. Course knowledge always survives; analytics only lasts until the next
  spin-down. Fine for a class project — if the log data matters for your
  report, query it (see below) while the service is still warm, or swap in
  a free hosted Postgres (Supabase) for just those three tables later.

## Tuning

- `CONFIDENCE_THRESHOLD` (default `0.35`) — how relevant a chunk must be
  before Olinda will answer from it instead of deferring to Student
  Services. Lower = answers more often but with more risk of a bad match;
  higher = safer but defers more. Adjust after testing with real questions.
- `GROQ_MODEL` (default `llama-3.3-70b-versatile`) — good quality/speed
  balance. Free tier is capped at 30 requests/min and 1,000/day per model;
  plenty for a college pilot, but if you ever hit it, `llama-3.1-8b-instant`
  has a much higher daily cap and is still solid for straightforward Q&A.

## Seeing what Olinda couldn't answer

```bash
sqlite3 olinda.db "SELECT question, confidence_score FROM unanswered_log ORDER BY occurred_at DESC LIMIT 20;"
```

This is the list worth handing to Simone/Lou — it's the actual gap between
what students ask and what the course guide currently covers.
