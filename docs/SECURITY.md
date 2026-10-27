# Prototype security boundary

- Runs on loopback only, no user authentication, and stores proposals in memory; **not production-ready or safe for internet exposure**.
- Never use real customer-sensitive data in the demo.
- `meta` mode uses a configured HTTPS chat-completions endpoint and Bearer key; compatibility must be verified against the actual Meta account before claiming integration success.
- `demo` mode is deterministic and is clearly labeled as non-AI.
- The only executable action is `LOCAL_DRAFT_ONLY`; no social publishing, ad spending, customer messaging or external writes.
- Public deployment requires auth, per-tenant isolation, durable encrypted persistence, rate limiting, CSRF protection, audit retention and network egress controls.
