# Olinda widget

The widget is plain browser JavaScript with a Shadow DOM boundary. It needs no
React, Angular, Vue, CSS framework, npm install, or build step on the college site.
Copy the **whole `frontend/chatbot` directory** to an HTTPS static host, preserving
the `modules` directory and `widget.css`. The site owner adds this once to the HTML
document (React: `public/index.html` or app shell; Angular: `src/index.html`):

```html
<script defer
  src="https://YOUR-WIDGET-HOST/chatbot/widget.js"
  data-backend="https://YOUR-CHATBOT-API"
  data-college="Hobart College"
  data-name="Olinda">
</script>
```

Replace the two host placeholders with deployed URLs. The existing `/widget.js`
URL is preserved by the Vercel rewrites. Browser ES modules require JavaScript MIME
types and CORS on the static host; the included Vercel configuration supplies CORS.
For a site with a Content Security Policy, allow the widget host in `script-src`
and `style-src`, and the API host in `connect-src`. Serve through HTTP(S), not a
`file://` page. Supported targets are current browsers with ES modules and Shadow DOM.

## Backend setup (once per college)

1. Deploy `backend/chatbot_server` with its `requirements.txt` and run
   `uvicorn main:app --host 0.0.0.0 --port 8000` (use the hosting service's port).
2. Configure model credentials and the knowledge database as before. Add each
   exact college website origin to the comma-separated `FRONTEND_ORIGINS` variable.
   Framework independence does not bypass browser CORS or a site's CSP.
3. For another college, provision its own knowledge database/deployment, and set
   `COLLEGE_NAME`, `ASSISTANT_NAME`, and `STUDENT_SERVICES_CONTACT`. Match the widget
   display attributes. Changing `data-college` alone does not change its knowledge.
4. On Supabase, apply `backend/migrations/001_message_feedback.sql` with an
   administrative database connection before deploying. Keep the service-role key
   on the server. SQLite creates the feedback table at service startup.

After this one-time setup, colleges only need the script tag. No production site or
database is automatically changed by this repository update.

## Controls

The widget starts as a compact launcher. Add `data-auto-open="true"` to open it on
load. On the `olinda:ready` window event, `window.OlindaWidget` exposes `open()`,
`close()`, `reset()` and `destroy()` for host integrations. Load once in an SPA's
app shell; `destroy()` supports intentional teardown and remounting.

Reset clears this widget's local conversation and summary, cancels its pending
request, and rotates its session ID. It does not erase historical server logs.
Like/dislike is saved per answer and can be changed. A failed save remains retryable.
Feedback requires both the answer ID and its unguessable session ID.

## Source layout

- `frontend/chatbot/widget.js`: small public loader.
- `frontend/chatbot/widget.css`: responsive, isolated design.
- `frontend/chatbot/modules`: UI, controller, API, session storage and Markdown.
- `backend/chatbot_server`: routes, orchestration, models, persistence, retrieval,
  provider clients, memory, guardrails and configuration.
- `frontend/dashboard`: HTML, CSS, and scripts split by staff, analytics and knowledge.
- `backend/dashboard_server`: application composition, domain routes, staff,
  authentication, passwords, database and models. `service.py` remains a legacy facade.

## Local checks

```sh
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -p "test_*.py"
python tests/dashboard_smoke.py
python -m http.server 5500 --directory frontend
```

Run the chatbot on port 8000 and open
`http://localhost:5500/dashboard/test_website.html`. This now loads the local widget.
Backend tests use temporary SQLite databases and mock model calls; they do not
send prompts to live providers or modify the college database.

Browser regressions: install Playwright (`npm install --no-save playwright` and
`npx playwright install chromium`), then run `node tests/widget.cjs`. The test starts
its own local fixture server and uses mock chat responses. Set `BROWSER_CHANNEL`
to `msedge` or `chrome` to use an installed browser instead of bundled Chromium.
