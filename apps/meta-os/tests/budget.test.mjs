import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudgetLedger } from '../lib/budget.js';

test('enforces per-workspace daily limits and allows valid usage', () => {
  const ledger = createBudgetLedger({ dailyLimits: { spark: 3, wonder: 1, image: 1, default: 2 } });

  const c1 = ledger.checkBudget('ws-alpha', { model: 'spark' });
  assert.equal(c1.allowed, true);
  assert.equal(c1.remainingUnits, 3);

  const r1 = ledger.recordUsage('ws-alpha', { model: 'spark', requestId: 'req_1' });
  assert.equal(r1.newUsage, 1);
  assert.equal(r1.remainingUnits, 2);

  ledger.recordUsage('ws-alpha', { model: 'spark', requestId: 'req_2' });
  ledger.recordUsage('ws-alpha', { model: 'spark', requestId: 'req_3' });

  // 4th call should fail
  const c4 = ledger.checkBudget('ws-alpha', { model: 'spark' });
  assert.equal(c4.allowed, false);
  assert.equal(c4.remainingUnits, 0);
  assert.throws(() => ledger.recordUsage('ws-alpha', { model: 'spark' }), /BUDGET_EXCEEDED/);
});

test('isolates budgets across different workspaces', () => {
  const ledger = createBudgetLedger({ dailyLimits: { spark: 2, default: 2 } });

  ledger.recordUsage('ws-one', { model: 'spark' });
  ledger.recordUsage('ws-one', { model: 'spark' });
  assert.equal(ledger.checkBudget('ws-one', { model: 'spark' }).allowed, false);

  // ws-two has its own separate budget
  assert.equal(ledger.checkBudget('ws-two', { model: 'spark' }).allowed, true);
  assert.equal(ledger.checkBudget('ws-two', { model: 'spark' }).remainingUnits, 2);
});

test('resets quota when UTC day rolls over', () => {
  let currentTime = new Date('2026-10-27T10:00:00Z').getTime();
  const ledger = createBudgetLedger({ dailyLimits: { wonder: 1 }, clock: () => currentTime });

  ledger.recordUsage('ws-test', { model: 'wonder' });
  assert.equal(ledger.checkBudget('ws-test', { model: 'wonder' }).allowed, false);

  // Advance time to next day
  currentTime = new Date('2026-10-28T00:00:01Z').getTime();
  const nextDay = ledger.checkBudget('ws-test', { model: 'wonder' });
  assert.equal(nextDay.allowed, true);
  assert.equal(nextDay.remainingUnits, 1);
});

test('rejects missing or empty workspace', () => {
  const ledger = createBudgetLedger();
  assert.throws(() => ledger.checkBudget(''), /WORKSPACE_REQUIRED/);
  assert.throws(() => ledger.recordUsage(null), /WORKSPACE_REQUIRED/);
});
