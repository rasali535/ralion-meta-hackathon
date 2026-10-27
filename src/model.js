import { demoStrategy } from './engine.js';

export async function generateStrategy(evidence, mode = 'demo') {
  if (mode === 'demo') return { strategy: demoStrategy(evidence), provider: 'DEMO_RULES_NOT_META_AI' };
  if (mode !== 'meta') throw new Error('Unknown model mode');
  const url = process.env.META_MODEL_API_URL;
  const token = process.env.META_MODEL_API_KEY;
  const model = process.env.META_MODEL_ID;
  if (!url || !token || !model) throw new Error('Meta model is not configured: set META_MODEL_API_URL, META_MODEL_API_KEY, META_MODEL_ID');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname === 'localhost' || parsed.hostname.endsWith('.local')) throw new Error('Model endpoint must use an external HTTPS URL');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, temperature: 0.3, messages: [
        { role: 'system', content: 'You are MARI, a growth strategy assistant. Use ONLY provided facts. Do not invent outcomes or promise results. Respond ONLY as JSON with four string fields: insight, action, reason, successMetric. Suggest a safe marketing draft that requires human approval. No automated spending or publishing.' },
        { role: 'user', content: JSON.stringify(evidence) }
      ] }), signal: controller.signal });
    if (!response.ok) throw new Error(`Meta model HTTP ${response.status}`);
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('Model response missing text content');
    const strategy = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    return { strategy, provider: `META_MODEL:${model}` };
  } finally { clearTimeout(timeout); }
}
