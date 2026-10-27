/**
 * RALION OS — PER-WORKSPACE INFERENCE BUDGET LEDGER
 *
 * Server-only in-memory budget and quota accounting.
 * Tracks and limits billable model consumption per workspace.
 */

const DEFAULT_DAILY_LIMITS = Object.freeze({
  spark: 100,      // Fast reasoning calls per day
  wonder: 25,      // High-effort reasoning calls per day
  image: 10,       // Generative image calls per day
  default: 50
});

function getDayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function createBudgetLedger({ dailyLimits = DEFAULT_DAILY_LIMITS, clock = () => Date.now() } = {}) {
  // Map<workspaceId, Map<dayKey, { spark: number, wonder: number, image: number, total: number }>>
  const ledger = new Map();

  function getWorkspaceDayUsage(workspaceId, dayKey) {
    let ws = ledger.get(workspaceId);
    if (!ws) {
      ws = new Map();
      ledger.set(workspaceId, ws);
    }
    let usage = ws.get(dayKey);
    if (!usage) {
      usage = { spark: 0, wonder: 0, image: 0, total: 0 };
      ws.set(dayKey, usage);
    }
    return usage;
  }

  return {
    checkBudget(workspaceId, { model = 'spark', costUnits = 1, now = clock() } = {}) {
      const ws = String(workspaceId || '').trim();
      if (!ws) throw new Error('BUDGET_WORKSPACE_REQUIRED');

      const dayKey = getDayKey(now);
      const usage = getWorkspaceDayUsage(ws, dayKey);
      const limit = dailyLimits[model] ?? dailyLimits.default;

      const current = usage[model] ?? 0;
      const willExceed = (current + costUnits) > limit;

      return {
        allowed: !willExceed,
        workspaceId: ws,
        model,
        dayKey,
        currentUsage: current,
        costUnits,
        remainingUnits: Math.max(0, limit - current),
        dailyLimit: limit
      };
    },

    recordUsage(workspaceId, { model = 'spark', costUnits = 1, requestId = null, now = clock() } = {}) {
      const check = this.checkBudget(workspaceId, { model, costUnits, now });
      if (!check.allowed) {
        throw new Error('BUDGET_EXCEEDED');
      }

      const dayKey = getDayKey(now);
      const usage = getWorkspaceDayUsage(workspaceId, dayKey);
      usage[model] = (usage[model] || 0) + costUnits;
      usage.total = (usage.total || 0) + costUnits;

      return {
        workspaceId,
        model,
        dayKey,
        requestId: requestId || null,
        newUsage: usage[model],
        remainingUnits: Math.max(0, check.dailyLimit - usage[model]),
        dailyLimit: check.dailyLimit
      };
    },

    getUsage(workspaceId, { now = clock() } = {}) {
      const dayKey = getDayKey(now);
      const usage = getWorkspaceDayUsage(String(workspaceId || ''), dayKey);
      return {
        workspaceId,
        dayKey,
        usage: { ...usage },
        limits: { ...dailyLimits }
      };
    },

    reset() {
      ledger.clear();
    }
  };
}

export const globalBudgetLedger = createBudgetLedger();
