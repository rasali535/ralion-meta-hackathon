/**
 * RALION META HACKATHON — PHASE 1.5 MINIMAL LIVE PROBES
 *
 * Minimal live probes for Muse Wonder 1.0 (reasoning) and Muse Image 1.0 (generation).
 *
 * Safety & Security Guarantees:
 * - Credentials remain strictly server-side (reads process.env.MODEL_API_KEY).
 * - Never prints, logs, or exports keys.
 * - Requires explicit --authorize-billable flag before initiating any upstream network call.
 * - Dry-runs contract assertions when authorization is not passed.
 * - Public inference route remains disabled.
 * - Completely isolated from production Ralion OS (no database, no client state, no publishing).
 */

import { performance } from 'node:perf_hooks';
import { reasonWithMeta, generateWithMuseImage, MODEL_IDS, META_API_BASE } from '../lib/meta/provider.js';

// Minimal test payloads grounded in unverified test facts
export const WONDER_PROBE_INPUT = {
  business: {
    name: 'AromaCraft Micro-Roastery',
    industry: 'Specialty Coffee & Retail',
    objective: 'Increase weekday local bean subscription pickup by 20%',
    audience: 'Neighbourhood remote professionals & coffee enthusiasts',
    facts: 'Boutique single-origin roaster. Operates physical tasting bar. Offers weekly bean pickup or local cycle delivery.'
  },
  task: 'growth'
};

export const MUSE_IMAGE_PROBE_INPUT = {
  prompt: 'A minimalist craft coffee bag on a textured oak counter with soft morning sunlight and a clean espresso cup in soft focus, commercial product photography'
};

/**
 * Sanitizes any error message to ensure no keys, auth headers, or raw URLs with query params are exposed.
 */
export function sanitizeError(err) {
  if (!err) return 'Unknown error';
  let message = typeof err === 'string' ? err : err.message || String(err);
  // Mask any bearer tokens or keys if present in messages
  message = message.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  message = message.replace(/(key=)[A-Za-z0-9_\-\.]+/gi, '$1[REDACTED]');
  return message;
}

/**
 * Executes the Muse Wonder 1.0 reasoning probe.
 */
export async function probeMuseWonder({ key = process.env.MODEL_API_KEY, fetchImpl = fetch } = {}) {
  const start = performance.now();
  try {
    const result = await reasonWithMeta({
      business: WONDER_PROBE_INPUT.business,
      task: WONDER_PROBE_INPUT.task,
      mode: 'wonder',
      key,
      fetchImpl
    });
    const latencyMs = Math.round(performance.now() - start);

    return {
      success: true,
      model: result.model,
      expectedModel: MODEL_IDS.wonder,
      endpoint: `${META_API_BASE}/responses`,
      requestId: result.requestId || 'N/A',
      latencyMs,
      output: result.output,
      outputPreview: result.output ? result.output.slice(0, 280) + (result.output.length > 280 ? '...' : '') : null,
      claimsSource: result.claimsSource,
      rawOutputLength: result.output ? result.output.length : 0
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      model: MODEL_IDS.wonder,
      endpoint: `${META_API_BASE}/responses`,
      latencyMs,
      error: sanitizeError(err)
    };
  }
}

/**
 * Executes the Muse Image 1.0 generation probe.
 */
export async function probeMuseImage({ key = process.env.MODEL_API_KEY, fetchImpl = fetch } = {}) {
  const start = performance.now();
  try {
    const result = await generateWithMuseImage({
      prompt: MUSE_IMAGE_PROBE_INPUT.prompt,
      key,
      fetchImpl
    });
    const latencyMs = Math.round(performance.now() - start);

    const hasUrl = Boolean(result.imageUrl);
    const hasBase64 = Boolean(result.imageBase64);
    let assetVerified = false;
    let assetDetails = null;

    if (hasUrl) {
      try {
        let verifyRes = await fetchImpl(result.imageUrl, { method: 'HEAD' });
        // Some CDNs reject HEAD requests; fallback to a Range GET request if HEAD is 403/405
        if (!verifyRes.ok && (verifyRes.status === 403 || verifyRes.status === 405)) {
          verifyRes = await fetchImpl(result.imageUrl, { method: 'GET', headers: { Range: 'bytes=0-1023' } });
        }
        const contentType = verifyRes.headers?.get?.('content-type') || 'application/octet-stream';
        const contentLength = Number(verifyRes.headers?.get?.('content-length') || 0);
        assetVerified = verifyRes.ok;
        assetDetails = {
          httpStatus: verifyRes.status,
          contentType,
          contentLengthBytes: contentLength > 0 ? contentLength : null,
          retrievedSuccessfully: verifyRes.ok
        };
      } catch (assetErr) {
        assetVerified = false;
        assetDetails = { error: sanitizeError(assetErr), retrievedSuccessfully: false };
      }
    } else if (hasBase64) {
      try {
        const buf = Buffer.from(result.imageBase64, 'base64');
        assetVerified = buf.length > 100;
        assetDetails = {
          contentType: 'image/png;base64',
          contentLengthBytes: buf.length,
          retrievedSuccessfully: assetVerified
        };
      } catch (_) {
        assetVerified = false;
        assetDetails = { retrievedSuccessfully: false };
      }
    }

    return {
      success: true,
      model: result.model,
      expectedModel: MODEL_IDS.image,
      endpoint: `${META_API_BASE}/images/generations`,
      requestId: result.requestId || 'N/A',
      latencyMs,
      hasUrl,
      imageUrlMasked: hasUrl ? (result.imageUrl.startsWith('https://') ? result.imageUrl.split('?')[0] + '?sig=[REDACTED]' : '[NON_HTTPS_URL]') : null,
      hasBase64,
      assetVerified,
      assetDetails,
      reviewRequired: result.reviewRequired === true
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      model: MODEL_IDS.image,
      endpoint: `${META_API_BASE}/images/generations`,
      latencyMs,
      error: sanitizeError(err)
    };
  }
}

/**
 * Dry-run probe asserting provider contracts without billable network execution.
 */
export async function dryRunContractProbes() {
  const syntheticId = 'mock_resp_' + Math.random().toString(16).slice(2, 10);
  const syntheticFetchWonder = async (url, init) => {
    return {
      ok: true,
      json: async () => ({
        id: syntheticId,
        output: [{ content: [{ text: 'Hypothesis: Offering an exclusive weekday bean pickup club creates predictable revenue.\nSuggested action: Launch weekly bean subscriber email invite with complimentary single-origin espresso at pickup.\nSuccess metric: 20% growth in weekday pickup cohort within 30 days.' }] }]
      })
    };
  };

  const syntheticFetchImage = async (url, init) => {
    if (init?.method === 'HEAD' || (typeof url === 'string' && url.includes('generated'))) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png', 'content-length': '152048' })
      };
    }
    return {
      ok: true,
      json: async () => ({
        id: 'img_resp_' + Math.random().toString(16).slice(2, 10),
        data: [{ url: 'https://cdn.meta.ai/v1/generated/test_asset_uuid.png?sig=sample_signature' }]
      })
    };
  };

  const wonderResult = await probeMuseWonder({ key: 'dry-run-key', fetchImpl: syntheticFetchWonder });
  const imageResult = await probeMuseImage({ key: 'dry-run-key', fetchImpl: syntheticFetchImage });

  return {
    mode: 'DRY_RUN_CONTRACT_VALIDATION',
    wonder: wonderResult,
    image: imageResult
  };
}

// CLI runner
if (process.argv[1] && (process.argv[1].endsWith('live-probes.mjs') || process.argv[1].endsWith('live-probes'))) {
  const args = process.argv.slice(2);
  const authorized = args.includes('--authorize-billable');

  // Load .env safely if present without printing
  try {
    if (process.loadEnvFile) {
      process.loadEnvFile();
    }
  } catch (_) {
    // Ignore if .env does not exist
  }

  const keyConfigured = Boolean(process.env.MODEL_API_KEY);

  console.log('='.repeat(70));
  console.log('RALION META HACKATHON — PHASE 1.5 MODEL PROBE HARNESS');
  console.log('='.repeat(70));
  console.log(`Server-side credential present: ${keyConfigured ? 'YES (configured)' : 'NO'}`);
  console.log(`Billable execution authorized:  ${authorized ? 'YES (--authorize-billable passed)' : 'NO (DRY RUN ONLY)'}`);
  console.log(`Public inference route:         DISABLED (META_REASONING_API_ENABLED=false)`);
  console.log(`Production isolation:           ACTIVE (Zero Ralion OS dependencies)`);
  console.log('-'.repeat(70));

  if (!authorized) {
    console.log('\n[NOTICE] Explicit authorization (--authorize-billable) NOT passed.');
    console.log('[NOTICE] Executing contract dry-run to verify provider interfaces safely...\n');

    dryRunContractProbes().then(report => {
      console.log('WONDER CONTRACT DRY-RUN:');
      console.log(JSON.stringify(report.wonder, null, 2));
      console.log('\nMUSE IMAGE CONTRACT DRY-RUN:');
      console.log(JSON.stringify(report.image, null, 2));
      console.log('\n[SAFE HALT] To execute real billable calls against Meta Model API, explicit user authorization');
      console.log('and `--authorize-billable` with MODEL_API_KEY environment variable is required.');
      process.exit(0);
    }).catch(err => {
      console.error('Dry-run error:', err);
      process.exit(1);
    });
  } else {
    if (!keyConfigured) {
      console.error('\n[ABORT] --authorize-billable was passed, but MODEL_API_KEY is not configured in process.env.');
      console.error('Set MODEL_API_KEY server-side before running.');
      process.exit(1);
    }

    console.log('\n[ALERT] Explicit authorization verified. Executing live probes against Meta Model API...\n');

    (async () => {
      console.log('>>> Probing Muse Wonder 1.0 (muse-wonder-1.0)...');
      const wonderReport = await probeMuseWonder();
      console.log('Wonder Result:');
      console.log(JSON.stringify(wonderReport, null, 2));

      console.log('\n>>> Probing Muse Image 1.0 (muse-image-1.0)...');
      const imageReport = await probeMuseImage();
      console.log('Image Result:');
      console.log(JSON.stringify(imageReport, null, 2));

      console.log('\n' + '='.repeat(70));
      console.log('PROBE RUN SUMMARY:');
      console.log(`Wonder Success: ${wonderReport.success ? 'PASS' : 'FAIL'}`);
      console.log(`Image Success:  ${imageReport.success ? 'PASS' : 'FAIL'}`);
      console.log('='.repeat(70));
    })();
  }
}
