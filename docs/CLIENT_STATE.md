# Client & Server State Behavior — Ralion Meta AI Edition

Honest account of what persists, what evaporates, and how the UI reports
each case. The dashboard never claims persistence the backend lacks.

## Client state (browser memory + localStorage)

| State | Storage | Survives refresh? | Expiry / loss behavior |
|---|---|---|---|
| Theme, workspace label | localStorage | Yes | Kept until changed |
| Demo token + session tenant | React memory only | No — must start a new session | 4-hour token TTL; expired tokens get 401 with recovery hint |
| Business form | React memory | No | Resets to starter business |
| Mission, assets, approval | React memory | No | Resets to empty states |
| Current view | URL `?view=` | Yes | Unknown ids fall back to Command |

No mission, approval, token, or asset bytes are written to localStorage,
cookies, or any browser store. Refresh returns the user to empty states
with guidance, never to silently fake data.

## Server state (per-process memory + local files)

| State | Storage | Notes |
|---|---|---|
| Rate-limit buckets, budget ledger, telemetry buffer | Per-process memory | Lost on restart/redeploy; not shared across instances |
| Creative assets (`.data/creative/<org>/<ws>/`) | Local filesystem | Survives restart on persistent disks only |
| Signed preview URLs | HMAC, stateless | 15-minute expiry; UI shows "Preview expired" and offers reload |

## Vercel serverless limitations (documented, not hidden)

- Ephemeral filesystem: assets written during one invocation may vanish
  before the next; the UI treats missing assets as expired previews.
- No shared memory: budgets, buckets, and telemetry reset per instance
  and are never described as distributed quotas.
- Cold starts return empty telemetry and full budgets; the UI reports
  "No calls" rather than inventing history.

## Failure presentations

- Missing mission context → workspace empty states with a create-mission path.
- Expired previews → "Preview expired" chips; bytes re-listed where stored.
- Session expiry → 401 copy directs to Business → Start demo session.
- Server errors → error boxes with the sanitized code; failed model calls
  appear in Activity with recovery guidance.
- Inference disabled → deterministic demo continues; banners say so.
