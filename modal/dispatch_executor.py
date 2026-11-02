"""Ralion sandbox dispatch executor (Modal).

Runs approved campaign bundles inside Modal's isolated compute and returns
an independent execution attestation. This is the "act" half of the
approve -> act loop: the Next.js app mints a signed dispatch receipt, then
calls this endpoint to have the exact bundle bytes verified and packaged
by third-party infrastructure. The returned executionId lands on the
receipt as an external, dashboard-verifiable execution record.

Trust notes:
- No secrets cross this boundary in either direction. The app sends the
  canonical bundle JSON string plus the claimed SHA-256; Modal returns
  checks and an execution id. HMAC keys never leave the app server.
- Hash verification is exact: Modal hashes the received string bytes, so
  there is no cross-language JSON canonicalization hazard.
- This executor never publishes, schedules, spends, or contacts ad APIs.
  It validates and packages only.

Deploy (maintainer machine with Modal credits):
    pip install modal
    modal setup
    modal deploy modal/dispatch_executor.py
Copy the printed https endpoint URL into MODAL_DISPATCH_URL on the app.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone

import modal

app = modal.App("ralion-dispatch-executor")
image = modal.Image.debian_slim().pip_install("fastapi[standard]")

MAX_BODY_CHARS = 65536


def _iso_now():
    return datetime.now(timezone.utc).isoformat()


@app.function(image=image)
@modal.fastapi_endpoint(method="POST")
def execute(payload: dict) -> dict:
    try:
        if not isinstance(payload, dict):
            return {"ok": False, "error": "BUNDLE_INVALID"}
        bundle_json = payload.get("bundleJson")
        claimed = payload.get("claimedBundleHash")
        if (
            not isinstance(bundle_json, str)
            or not bundle_json
            or len(bundle_json) > MAX_BODY_CHARS
        ):
            return {"ok": False, "error": "BUNDLE_INVALID"}
        if not isinstance(claimed, str) or not claimed:
            return {"ok": False, "error": "HASH_REQUIRED"}
        actual = hashlib.sha256(bundle_json.encode("utf-8")).hexdigest()
        try:
            bundle = json.loads(bundle_json)
        except Exception:
            return {"ok": False, "error": "BUNDLE_UNPARSEABLE"}
        assets = bundle.get("assets") if isinstance(bundle, dict) else None
        channels = bundle.get("channels") if isinstance(bundle, dict) else None
        assets_valid = isinstance(assets, list) and all(
            isinstance(a, dict) and a.get("assetId") for a in assets
        )
        channels_valid = isinstance(channels, list) and all(
            isinstance(c, dict) and c.get("channel") for c in channels
        )
        mission_valid = (
            isinstance(bundle, dict)
            and bool(bundle.get("missionId"))
            and bool(bundle.get("planHash"))
        )
        return {
            "ok": True,
            "executionId": "mexec_" + uuid.uuid4().hex[:16],
            "executor": "modal-sandbox",
            "missionId": bundle.get("missionId") if isinstance(bundle, dict) else None,
            "bundleHashVerified": actual == claimed,
            "checks": {
                "assetCount": len(assets) if isinstance(assets, list) else 0,
                "channelCount": len(channels) if isinstance(channels, list) else 0,
                "assetsValid": assets_valid,
                "channelsValid": channels_valid,
                "missionValid": mission_valid,
            },
            "packagedAt": _iso_now(),
        }
    except Exception:
        return {"ok": False, "error": "EXECUTION_FAILED"}
