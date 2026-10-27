import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateBusiness, makeEvidence, createProposal, approve, executeDraft } from './engine.js';
import { generateStrategy } from './model.js';

const root = dirname(fileURLToPath(import.meta.url));
const proposals = new Map();
const MAX_BODY_BYTES = 16_384;
const MAX_PROPOSALS = 200;
function send(res, status, data) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function body(req) {
  let text = '';
  for await (const chunk of req) { text += chunk; if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Request too large'); }
  return JSON.parse(text || '{}');
}
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff' });
      res.end(await readFile(join(root, 'ui', 'index.html'))); return;
    }
    if (req.method === 'GET' && path === '/app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'x-content-type-options': 'nosniff' });
      res.end(await readFile(join(root, 'ui', 'app.js'))); return;
    }
    if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true, metaConfigured: Boolean(process.env.META_MODEL_API_URL && process.env.META_MODEL_API_KEY && process.env.META_MODEL_ID), executionMode: 'LOCAL_DRAFT_ONLY' });
    if (req.method === 'POST' && path === '/api/analyze') {
      const input = await body(req);
      const business = validateBusiness(input.business);
      const evidence = makeEvidence(business, input.metrics);
      const { strategy, provider } = await generateStrategy(evidence, input.mode);
      const proposal = createProposal(evidence, strategy, provider);
      if (proposals.size >= MAX_PROPOSALS) proposals.delete(proposals.keys().next().value);
      proposals.set(proposal.id, proposal);
      return send(res, 201, proposal);
    }
    const match = path.match(/^\/api\/proposals\/([0-9a-f-]{36})\/(approve|execute)$/);
    if (req.method === 'POST' && match) {
      const proposal = proposals.get(match[1]);
      if (!proposal) return send(res, 404, { error: 'Proposal not found (in-memory sessions reset on restart)' });
      if (match[2] === 'approve') approve(proposal, (await body(req)).actor);
      else executeDraft(proposal);
      return send(res, 200, proposal);
    }
    return send(res, 404, { error: 'Not found' });
  } catch (err) {
    const client = /required|Invalid|Only pending|Approval required|Unknown model mode|Request too large|Unexpected token|not configured|endpoint must/i.test(err.message);
    return send(res, client ? 400 : 502, { error: err.message === 'fetch failed' ? 'Model network request failed' : String(err.message).slice(0, 200) });
  }
});
const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'test') server.listen(port, '127.0.0.1', () => console.log(`MARI Growth Autopilot listening on http://127.0.0.1:${port}`));
export { server };
