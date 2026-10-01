# Olinda: simple first-stage setup

Updated 2 October 2026. These are local code changes; nothing has been submitted or deployed, and no live database changes have been made.

## What we are doing now

This stage has four goals:

1. Keep Gemini/Groq API keys private on the backend.
2. Limit chat to **15 questions per minute per IP address**.
3. Limit the whole chatbot to **200 accepted questions per UTC day**.
4. Keep the **unanswered-question queue** so staff can add official answers.

Students do not log in. Database chat logging is retained. No application-level chat encryption, Turnstile, Redis or extra authentication-secret setup is required. The client has accepted deferring application-level chat encryption for this stage, according to your instruction. The original full security/testing checklist remains future work, not completed certification.

## What is done locally

| Item | Current implementation |
| --- | --- |
| Private AI keys | Used only by the backend. Never place them in widget JavaScript, HTML or frontend settings. |
| Minute limit | `CHAT_REQUESTS_PER_MINUTE=15`, applied per IP. |
| Daily limit | `CHAT_DAILY_REQUEST_LIMIT=200`, shared through existing Supabase counters in production. |
| Safe limit failures | Excess requests stop before embedding/answer generation; unavailable counters stop chat before paid AI work. |
| Unanswered queue | Missing/low-confidence knowledge questions are saved for staff, separately from conversations. |
| Basic guardrails | College-answer policy, untrusted content separated from instructions, bounded inputs/outputs, no AI execution tools and basic personal-data redaction. |
| Staff portal | Username/password sign-in and administrator permissions retained to control who can change answers. No separate `AUTH_SECRET` setting. |
| Deployment folders | Each backend is self-contained in its own server folder. |
| Removed features | Chat field encryption, chat JWT/session verification, Turnstile, Redis counter option and the associated cleanup tool. |

Chat questions and replies are saved to the existing messages/session tables, with basic sensitive-pattern redaction and no application encryption. Dashboard message statistics continue to update. Existing historical data is preserved, and the unanswered queue remains separate. No encryption key or logging toggle is required.

The staff portal's session signing is automatic. In production it derives a purpose-specific signing key from the existing private Supabase backend credential. That credential must remain server-only. Rotating it invalidates staff sessions. Development uses a temporary random signing key, so restarting may sign staff out. No additional key needs to be generated or configured.

Public source information does not mean everybody should be able to edit official answers. That is why the staff portal still requires its normal login.

## Your next step: check where your AI keys are stored

Start here. Do not do all deployment steps at once.

- Gemini/Groq keys belong in the appropriate **Render backend Environment** settings.
- A privileged Supabase key also belongs only in backend Environment settings.
- None of those keys should appear in frontend JavaScript, HTML, a public repository or this document.
- If a key was exposed, revoke/replace it in its provider console; removing the visible text is not enough.
- Set an approved monthly provider spending allowance where your account supports it.

The app's daily cap limits calls through Olinda. A stolen key used directly against the provider bypasses that cap.

For Groq, use **Settings → Billing → Limits** where available to a paid-tier organization owner. Groq documents delayed tracking and possible overspend. [Groq spend limits](https://console.groq.com/docs/spend-limits).

For Gemini, use the project's **Spend → Monthly spend cap → Edit spend cap** where available. Google documents account restrictions and delayed enforcement. [Gemini billing and spend caps](https://ai.google.dev/gemini-api/docs/billing).

No spending budget or paid upgrade has been configured by this work.

## Later, when you approve deployment

### 1. Prepare Supabase counters

Your developer must review and test:

`backend/dashboard_server/supabase_security_migration.sql`

It adds the atomic shared quota function/counter table and restricts public database access. Review existing integrations and back up relevant data first. It is not automatically run by the backend. Test in staging after approval; apply to production only after separate approval.

Shared counters are necessary so restarting the server or adding another instance does not reset the production daily allowance. No new database service is needed.

### 2. Configure the two backend folders

| Setting | Chat backend | Dashboard backend |
| --- | --- | --- |
| Root directory | `backend/chatbot_server` | `backend/dashboard_server` |
| Build command | `pip install -r requirements.txt` | Same |
| Render start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Same |
| `APP_ENV` | `production` | `production` |
| `FRONTEND_ORIGINS` | `https://hobartcollege.education.tas.edu.au,https://olinda.rafistacks.dev` | `https://portal-olinda.rafistacks.dev` |
| `SUPABASE_URL` | Your HTTPS project URL | Same project URL |
| `SUPABASE_KEY` | Your private authorized backend credential | Your private authorized backend credential |
| `GEMINI_API_KEY` | Your private Gemini key | Private Gemini key for adding knowledge |
| `GROQ_API_KEY` | Your private Groq key | Not needed |
| `CHAT_REQUESTS_PER_MINUTE` | `15` | Not needed |
| `CHAT_DAILY_REQUEST_LIMIT` | `200` | Not needed |
| `UNANSWERED_LOG_ENABLED` | `true` | Not needed |
| `STAFF_USERS` | Not needed | Existing/private staff account definition |
| `FORWARDED_ALLOW_IPS` | Render supplies `*` automatically | Render supplies `*` automatically |

On Render's native Python services, leave its automatic `FORWARDED_ALLOW_IPS=*` value in place; no proxy IP lookup is required. The code accepts this default when Render's `RENDER=true` marker is present. On other hosts, configure specific verified proxy addresses. Verify HTTPS detection and client-IP handling in staging, including spoofed forwarding headers, before claiming per-IP limits cannot be bypassed. `/health` alone does not prove quota storage works. See [Render's documented defaults](https://render.com/docs/environment-variables#python-3).

The initial staff account format is:

```text
STAFF_USERS=yourusername:YOUR_PRIVATE_PASSWORD:Your Display Name:admin
```

Use your actual private, non-empty password. The 12-character startup check for environment-defined accounts is temporarily disabled at your request. Avoid colons/commas inside values because they are separators. There is no default account/password. Accounts created or passwords changed through the portal still require at least 12 characters. Administrators may edit official knowledge; ordinary staff may read it.

Each folder's `.env.example` is for local development. Do not use its development mode or localhost origins in production. Existing model settings can remain initially; verify account availability in staging and keep embedding model/dimensions consistent across both services.

No `AUTH_SECRET`, `CHAT_AUTH_SECRET`, `LOG_ENCRYPTION_KEY`, `CHAT_LOGGING_ENABLED`, `TURNSTILE_SECRET_KEY` or Redis configuration is used by the simplified code. Remove obsolete entries from hosting settings during an approved deployment; no live settings have been changed here.

### 3. Deploy frontend and test the college page

The prepared `vercel.json` serves the widget and staff portal. Review and deploy only after approval. The college website administrator must allow the widget's assets/backend requests in its website policy.

Basic embed:

```html
<script defer
  src="https://olinda.rafistacks.dev/widget.js"
  data-backend="https://olinda-ai-backend-chatbot.onrender.com"
  data-name="Olinda"
  data-college="Hobart College">
</script>
```

No API key, verification key or student login is included. If an approved privacy page exists, add its HTTPS URL using `data-privacy-url`.

## How to use the unanswered queue

1. A question without adequate knowledge is saved in the queue, with basic sensitive-pattern redaction.
2. Staff sign in at https://portal-olinda.rafistacks.dev and review questions.
3. An administrator enters an approved official answer and resolves the question.
4. The answer becomes searchable knowledge, and the queue item is marked resolved.
5. Test a similar question to check retrieval quality.

Queue questions are not application-encrypted. There is no automatic retention/deletion tool in this simplified stage. Assign a staff owner to review the queue; agree any later cleanup policy before deleting records. Historical records are not deleted by these local changes.

## Limits explained

- **15/minute/IP** means users sharing the college's internet connection can share one allowance. Test normal college traffic before adjusting it.
- **200/day** is the total for all visitors, not 200 per student.
- The daily window resets at **00:00 UTC**, not Hobart midnight.
- Accepted requests that later fail still count. Unknown questions count too.
- Requests beyond limits return **429** with a friendly widget notice.
- Setting the daily limit to **0** pauses new public chat after the hosting change is applied.
- The limits do not stop previously running calls or separate authenticated staff knowledge ingestion.

AI “tokens” are small pieces of text used for billing. You do not need to set up tokens. One question can cause several AI operations, so 200 questions is not 200 provider calls and is not a fixed dollar budget. Monitor provider spending separately.

Anonymous scripts can still call the public API within its limits, and attackers can consume the shared allowance. CORS restricts browser origins but does not prove who a direct caller is. Stronger bot controls can be considered later if needed.

## Verification before going live

Your developer should verify in approved staging:

- Both server folders start independently, and actual Supabase quota operations work.
- Public chat works without login/tokens; approved origins load the widget.
- The minute limit rejects excess traffic using the correct client IP.
- A small staging daily cap rejects excess requests before provider work, including multiple instances.
- Counter storage failure stops paid work safely.
- Missing knowledge enters the queue; admin answers persist and become knowledge.
- Non-admin visitors cannot edit knowledge or trigger uploads.
- Questions/replies and session records are saved without application encryption; no provider keys appear in browser assets/errors.
- The configured models and embeddings work with your real provider accounts.

Offline commands from the repository root, with dependencies installed:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
node tests/frontend-security.mjs
python -m compileall -q backend tests run_servers.py
git diff --check
```

Offline tests use temporary data and mocked providers; they are not live security/performance proof. See `SECURITY-READINESS.md` for the latest recorded results.

## Original client requirements reserved for later stages

| Requirement | This stage / later work |
| --- | --- |
| Scan / penetration testing, SQLi, XSS, CSRF | Basic code controls retained; authorized scan and pen test deferred. |
| Prompt injection / jailbreak / instruction leakage | Basic prompt guardrails retained; actual model adversarial tests deferred. |
| TLS 1.3 / main infrastructure isolation | HTTPS configuration retained; hosting/network evidence and TLS version verification deferred. |
| AES-256 at rest | Application chat encryption removed at your direction; hosted storage/backup evidence remains separate. |
| API authorization | Public anonymous chat accepted for this stage; staff login/roles retained. |
| CORS | Exact college/demo/portal origins configured locally; deployed verification pending. |
| Rate limiting | 15/minute/IP and 200/day implemented; shared live counter/proxy verification pending. |
| DDoS / WAF | Hosting/edge review deferred; application limits do not establish DDoS protection. |
| Load / scalability / latency / TTFT | Testing deferred. Current replies are non-streaming; no TTFT metric or performance guarantee established. |
| PII / privacy / cookies / applicable regulations | Basic redaction and unencrypted application chat logs; approved notices, data regions/provider handling and privacy review remain later work. |

Only perform submissions, deployments, live SQL changes and external testing after your approval. We will proceed step by step.
