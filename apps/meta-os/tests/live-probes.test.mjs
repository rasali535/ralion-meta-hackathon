import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRunContractProbes, sanitizeError, WONDER_PROBE_INPUT, MUSE_IMAGE_PROBE_INPUT } from '../scripts/live-probes.mjs';

test('live-probe harness dry-run succeeds against provider contract', async () => {
  const report = await dryRunContractProbes();
  assert.equal(report.mode, 'DRY_RUN_CONTRACT_VALIDATION');
  assert.equal(report.wonder.success, true);
  assert.equal(report.wonder.model, 'muse-wonder-1.0');
  assert.ok(report.wonder.outputPreview.includes('Hypothesis'));
  assert.equal(report.wonder.claimsSource, 'USER_SUPPLIED_UNVERIFIED');

  assert.equal(report.image.success, true);
  assert.equal(report.image.model, 'muse-image-1.0');
  assert.equal(report.image.hasUrl, true);
  assert.equal(report.image.assetVerified, true);
  assert.equal(report.image.reviewRequired, true);
});

test('sanitizeError scrubs Bearer credentials and secrets', () => {
  const raw = 'Failed with 401: Bearer secret_live_token_123456789 from key=top_secret_key_abcdef';
  const scrubbed = sanitizeError(raw);
  assert.ok(!scrubbed.includes('secret_live_token_123456789'));
  assert.ok(!scrubbed.includes('top_secret_key_abcdef'));
  assert.ok(scrubbed.includes('Bearer [REDACTED]'));
  assert.ok(scrubbed.includes('key=[REDACTED]'));
});

test('probe inputs adhere to grounded fact boundaries', () => {
  assert.ok(WONDER_PROBE_INPUT.business.name.length > 0);
  assert.ok(WONDER_PROBE_INPUT.business.objective.length > 0);
  assert.ok(MUSE_IMAGE_PROBE_INPUT.prompt.length > 0 && MUSE_IMAGE_PROBE_INPUT.prompt.length < 2500);
});
