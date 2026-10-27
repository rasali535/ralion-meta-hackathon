const $ = (id) => document.getElementById(id);
let proposal;
async function request(path, payload) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function render() {
  $('output').style.display = 'block';
  $('state').textContent = `Status: ${proposal.status} | Provider: ${proposal.provider}`;
  $('details').replaceChildren();
  const fields = [['Insight',proposal.strategy.insight],['Proposed action',proposal.strategy.action],['Reason',proposal.strategy.reason],['Success metric',proposal.strategy.successMetric],['Evidence source',proposal.evidence.metricsSource]];
  for (const [label, value] of fields) {
    const dt = document.createElement('dt'); dt.textContent = label;
    const dd = document.createElement('dd'); dd.textContent = value;
    $('details').append(dt, dd);
  }
  $('approval').hidden = proposal.status !== 'PENDING_APPROVAL';
  $('execute').disabled = proposal.status !== 'APPROVED';
  $('receipt').textContent = proposal.actionReceipt?.explanation || '';
}
$('business').addEventListener('submit', async (e) => {
  e.preventDefault(); $('error').textContent = '';
  try {
    const business = Object.fromEntries(['name','industry','objective','audience'].map(k => [k,$(k).value]));
    const metrics = { visits: $('visits').value === '' ? null : Number($('visits').value), leads: $('leads').value === '' ? null : Number($('leads').value) };
    proposal = await request('/api/analyze',{ business, metrics, mode: $('mode').value }); render();
  } catch (err) { $('error').textContent = err.message; }
});
$('approve').addEventListener('click', async () => { try { proposal = await request(`/api/proposals/${proposal.id}/approve`, { actor: $('actor').value }); render(); } catch (e) { $('error').textContent=e.message; } });
$('execute').addEventListener('click', async () => { try { proposal = await request(`/api/proposals/${proposal.id}/execute`, {}); render(); } catch (e) { $('error').textContent=e.message; } });
