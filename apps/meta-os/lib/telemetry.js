/**
 * Structured, tenant-scoped model usage telemetry for the hackathon.
 * Server-only. Records only verified facts about a model call: model and
 * provider ids, provider request id when available, tenant, operation,
 * success/failure, measured latency, provider-reported token usage when
 * available, and budget reservation/settlement outcomes. Never fabricates
 * token counts, costs, or request ids; unknown values stay null.
 * Prompts, business content, credentials, and tokens are never recorded.
 * Storage is a bounded per-process buffer, not durable or distributed.
 */
import {randomUUID} from 'node:crypto';

export const TELEMETRY_VERSION='1.0';
export const TELEMETRY_CAPACITY=200;
export const TELEMETRY_OPERATIONS=Object.freeze(['reason','mari-diagnosis','image-generation']);

const SEGMENT_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;

function clean(value,max){
  return String(value||'').trim().slice(0,max);
}
function assertSegment(value,code){
  const s=String(value||'').trim();
  if(!SEGMENT_RE.test(s))throw new Error(code);
  return s;
}
function numOrNull(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>=0?n:null;
}
function intOrNull(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>=0&&Math.floor(n)===n?n:null;
}
function cleanUsage(usage){
  if(!usage||typeof usage!=='object')return null;
  const input=intOrNull(usage.inputTokens);
  const output=intOrNull(usage.outputTokens);
  if(input===null&&output===null)return null;
  return {inputTokens:input,outputTokens:output};
}
function cleanBudget(budget){
  if(!budget||typeof budget!=='object')return null;
  const outcome=String(budget.outcome||'');
  if(!['confirmed','released'].includes(outcome))return null;
  return {outcome,remainingUnits:intOrNull(budget.remainingUnits)};
}
export function createTelemetryBuffer({capacity=TELEMETRY_CAPACITY}={}){
  const cap=Number.isFinite(Number(capacity))&&Number(capacity)>0?Math.floor(Number(capacity)):TELEMETRY_CAPACITY;
  const records=[];
  return {
    record({model,provider,requestId=null,organizationId,workspaceId,operation,ok,latencyMs=null,usage=null,budget=null,errorCode=null,now=Date.now()}={}){
      const m=clean(model,80);
      const p=clean(provider,80);
      const op=clean(operation,40);
      if(!m)throw new Error('TELEMETRY_MODEL_REQUIRED');
      if(!p)throw new Error('TELEMETRY_PROVIDER_REQUIRED');
      if(!TELEMETRY_OPERATIONS.includes(op))throw new Error('TELEMETRY_OPERATION_INVALID');
      if(typeof ok!=='boolean')throw new Error('TELEMETRY_OUTCOME_REQUIRED');
      const org=assertSegment(organizationId,'TELEMETRY_TENANT_REQUIRED');
      const ws=assertSegment(workspaceId,'TELEMETRY_TENANT_REQUIRED');
      const rec={
        schemaVersion:TELEMETRY_VERSION,
        id:'tmu_'+randomUUID().replace(/-/g,'').slice(0,16),
        timestamp:new Date(Number(now)).toISOString(),
        model:m,
        provider:p,
        requestId:requestId===null||requestId===undefined?null:clean(requestId,120)||null,
        organizationId:org,
        workspaceId:ws,
        operation:op,
        ok,
        latencyMs:latencyMs===null||latencyMs===undefined?null:numOrNull(latencyMs),
        usage:cleanUsage(usage),
        budget:cleanBudget(budget),
        errorCode:errorCode===null||errorCode===undefined?null:clean(errorCode,80)||null,
      };
      records.push(rec);
      while(records.length>cap)records.shift();
      return rec;
    },
    list({organizationId,workspaceId,limit=50}={}){
      const org=assertSegment(organizationId,'TELEMETRY_TENANT_REQUIRED');
      const ws=assertSegment(workspaceId,'TELEMETRY_TENANT_REQUIRED');
      const n=Number.isFinite(Number(limit))?Math.max(1,Math.min(100,Math.floor(Number(limit)))):50;
      return records.filter(r=>r.organizationId===org&&r.workspaceId===ws).slice(-n).reverse();
    },
    size(){return records.length;},
    reset(){records.length=0;},
  };
}
export const modelTelemetry=globalThis.__ralionModelTelemetry||(globalThis.__ralionModelTelemetry=createTelemetryBuffer());
export function recordModelUsage(entry={},buffer=modelTelemetry){
  return buffer.record(entry);
}
