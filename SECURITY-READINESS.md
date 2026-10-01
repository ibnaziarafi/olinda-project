# Olinda first-stage readiness — 2 October 2026

See [OLINDA-HANDOVER.md](OLINDA-HANDOVER.md) for the simplified setup guide.

The current scope is private backend AI keys, 15 requests/minute/IP, 200 accepted requests/UTC day, basic prompt/input guardrails and an unanswered queue. Students chat anonymously. Production counters use existing Supabase and stop AI work if storage is unavailable.

Application chat encryption, Turnstile, chat session JWTs, Redis support and the retention tool have been removed. Existing tables/data are preserved. New questions/replies and session records are saved to the database without application encryption. Both chat logs and queue questions use basic sensitive-pattern redaction. No encryption key or logging toggle is required.

Staff username/password login and administrator authorization remain. Session signing derives a purpose-specific key from the existing private backend Supabase credential in production; no separate signing-secret environment setting is required. Credential rotation signs staff out. Development signing keys are generated in memory.

Required before approved deployment: protect/rotate exposed provider keys, configure provider spending controls, review/test the supplied Supabase migration, configure the two independent server folders, verify trusted proxy/client IP handling and test the queue/limits in staging. No extra service purchase is needed for counters or chat access.

The latest simplified suite has 26 passing offline backend/deployment tests, plus frontend security/429 checks, Python compilation and diff whitespace checks. Tests use temporary data and mocked providers/storage. Live database concurrency, actual provider behavior and deployed configuration remain unverified.

No submission, live migration, deployment, penetration scan or load test has been performed. Original high-assurance client requirements are deferred, not certified complete. The daily request limit is not a dollar cap and cannot limit direct provider use of a stolen key. Public callers can consume the allowance; shared college-network IP limits need usability testing.

Render startup fix: both server copies accept the documented `FORWARDED_ALLOW_IPS=*` default when `RENDER=true`. The hosting blueprint no longer asks for a manual proxy value. Non-Render hosts still require specific proxy addresses. Actual forwarded-IP/spoofing behavior remains a staging verification item.

Quota diagnosis: backend error logs now record only exception type and a sanitized Supabase error code. Exception messages, keys, bucket identifiers and question text are excluded. This diagnostic change is local until deployed.

Browser refresh fix: recent chat state now persists in tab-scoped sessionStorage. Frontend regression checks cover restoration, new-conversation reset, malformed saved data and blocked storage. Database logging and request limits are unchanged.
