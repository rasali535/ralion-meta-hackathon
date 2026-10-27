/**
 * Secure website evidence ingestion.
 * Server-only: never import from client components.
 *
 * Fetches one user-supplied public HTTPS page with layered guards:
 * https-only, no credentials, no non-default ports, hostname/IP blocklists,
 * DNS re-validation on every hop, manual redirect following with per-hop
 * re-validation, content-type allowlist, and byte/time caps.
 * Inject fetchImpl/lookupImpl for contract tests.
 *
 * Residual risk: DNS is validated before fetch, but the HTTP client resolves
 * again at connect time (TOCTOU). Add an egress allowlist or pinned dialer
 * before any production use.
 */
import {lookup as dnsLookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';

export const WEBSITE_INGEST_LIMITS=Object.freeze({timeoutMs:12000,maxBytes:750000,maxRedirects:3,maxExcerptChars:2000,maxTitleChars:200,maxDescriptionChars:500});

function ipv4ToInt(host){
  const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if(!m)return null;
  const p=[Number(m[1]),Number(m[2]),Number(m[3]),Number(m[4])];
  if(p.some(n=>n>255))return null;
  return ((p[0]*256+p[1])*256+p[2])*256+p[3];
}
const v4=(a,b,c,d)=>((a*256+b)*256+c)*256+d;
const IPV4_BLOCKED=[[v4(0,0,0,0),8],[v4(10,0,0,0),8],[v4(100,64,0,0),10],[v4(127,0,0,0),8],[v4(169,254,0,0),16],[v4(172,16,0,0),12],[v4(192,0,0,0),24],[v4(192,0,2,0),24],[v4(192,168,0,0),16],[v4(198,18,0,0),15],[v4(198,51,100,0),24],[v4(203,0,113,0),24],[v4(224,0,0,0),4],[v4(240,0,0,0),4]];
function inCidr(ip,base,bits){
  const mask=(0xFFFFFFFF<<(32-bits))>>>0;
  return ((((ip>>>0)^(base>>>0))&mask)>>>0)===0;
}
function ipv4Blocked(ip){return IPV4_BLOCKED.some(([base,bits])=>inCidr(ip,base,bits));}
function stripBrackets(h){const s=String(h||'');return s.startsWith('[')&&s.endsWith(']')?s.slice(1,-1):s;}

export function isBlockedIpLiteral(host){
  const h=stripBrackets(String(host||'').toLowerCase().replace(/\.+$/,''));
  const asV4=ipv4ToInt(h);
  if(asV4!==null)return ipv4Blocked(asV4);
  if(!h.includes(':'))return false;
  if(h==='::1'||h==='0:0:0:0:0:0:0:1'||h==='::'||h==='0:0:0:0:0:0:0:0')return true;
  const g=h.split(':')[0].padStart(4,'0');
  if(g.startsWith('ff'))return true;
  if(g.startsWith('fe8')||g.startsWith('fe9')||g.startsWith('fea')||g.startsWith('feb'))return true;
  if(g[0]==='f'&&(g[1]==='c'||g[1]==='d'))return true;
  const groups=h.split(':');
  if(groups[0]==='2001'&&(groups[1]||'').padStart(4,'0')==='0db8')return true;
  if(h.startsWith('64:ff9b'))return true;
  if(h.includes('.')){
    const embedded=ipv4ToInt(h.slice(h.lastIndexOf(':')+1));
    if(embedded===null)return true;
    return ipv4Blocked(embedded);
  }
  return false;
}

const BLOCKED_SUFFIXES=['.local','.internal','.lan','.localdomain','.home.arpa','.corp','.home','.invalid','.test'];
const HOST_LABEL=/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
function assertPublicHostname(hostname){
  const host=stripBrackets(String(hostname||'')).toLowerCase().replace(/\.+$/,'');
  if(!host||host.length>253)throw new Error('WEBSITE_URL_INVALID');
  if(isBlockedIpLiteral(host))throw new Error('WEBSITE_HOST_BLOCKED');
  if(host.includes(':'))return host;
  if(host==='localhost')throw new Error('WEBSITE_HOST_BLOCKED');
  if(!host.includes('.'))throw new Error('WEBSITE_HOST_BLOCKED');
  if(BLOCKED_SUFFIXES.some(s=>host.endsWith(s)))throw new Error('WEBSITE_HOST_BLOCKED');
  if(!host.split('.').every(l=>HOST_LABEL.test(l)))throw new Error('WEBSITE_URL_INVALID');
  return host;
}
function assertSafeTargetUrl(raw){
  let u;
  try{u=new URL(String(raw||'').trim());}catch{throw new Error('WEBSITE_URL_INVALID');}
  if(u.protocol!=='https:')throw new Error('WEBSITE_URL_INVALID');
  if(u.username||u.password)throw new Error('WEBSITE_URL_INVALID');
  if(u.port&&u.port!=='443')throw new Error('WEBSITE_URL_INVALID');
  assertPublicHostname(u.hostname);
  return u;
}
async function assertSafeDns(host,lookupImpl){
  let records;
  try{records=await lookupImpl(host,{all:true});}catch{throw new Error('WEBSITE_DNS_FAILED');}
  const list=Array.isArray(records)?records:[records];
  if(!list.length)throw new Error('WEBSITE_DNS_FAILED');
  for(const r of list){
    const addr=typeof r==='string'?r:r&&r.address;
    if(!addr||isBlockedIpLiteral(String(addr)))throw new Error('WEBSITE_DNS_BLOCKED');
  }
}

async function fetchOnce(href,fetchImpl,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetchImpl(href,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'user-agent':'RalionOS-MetaAI-Edition/0.1 (hackathon evidence fetcher)','accept':'text/html,application/xhtml+xml;q=0.9'}});
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error('WEBSITE_TIMEOUT');
    if(controller.signal.aborted)throw new Error('WEBSITE_TIMEOUT');
    throw new Error('WEBSITE_FETCH_FAILED');
  }finally{clearTimeout(timer);}
}
async function discardBody(response){
  const body=response&&response.body;
  if(body&&typeof body.cancel==='function'){try{await body.cancel();}catch{}}
}
async function readCappedText(response,maxBytes){
  const rawLen=response&&response.headers&&typeof response.headers.get==='function'?response.headers.get('content-length'):null;
  const declared=Number(rawLen);
  if(Number.isFinite(declared)&&declared>maxBytes)throw new Error('WEBSITE_RESPONSE_TOO_LARGE');
  const body=response&&response.body;
  if(body&&typeof body.getReader==='function'){
    const reader=body.getReader();
    const chunks=[];let total=0;
    try{
      for(;;){
        const step=await reader.read();
        if(!step||step.done)break;
        const size=step.value&&step.value.byteLength?step.value.byteLength:0;
        total+=size;
        if(total>maxBytes){try{await reader.cancel();}catch{}throw new Error('WEBSITE_RESPONSE_TOO_LARGE');}
        if(size)chunks.push(step.value);
      }
    }finally{if(reader.releaseLock)reader.releaseLock();}
    const merged=new Uint8Array(total);let offset=0;
    for(const c of chunks){merged.set(c,offset);offset+=c.byteLength;}
    return new TextDecoder('utf-8').decode(merged);
  }
  const text=await response.text();
  if(text.length>maxBytes)throw new Error('WEBSITE_RESPONSE_TOO_LARGE');
  return text;
}

const NAMED_ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
function decodeEntities(s){
  return String(s||'')
    .replace(/&#(\d{1,7});/g,(_,n)=>{const c=Number(n);return c>0&&c<1114112?String.fromCodePoint(c):' ';})
    .replace(/&#x([0-9a-f]{1,6});/gi,(_,h)=>{const c=parseInt(h,16);return c>0&&c<1114112?String.fromCodePoint(c):' ';})
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi,(_,n)=>NAMED_ENTITIES[String(n).toLowerCase()]||' ');
}
function collapse(s){return String(s||'').replace(/\s+/g,' ').trim();}
function extractTitle(html){
  const m=/<title[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  return collapse(decodeEntities(m?m[1]:'')).slice(0,WEBSITE_INGEST_LIMITS.maxTitleChars);
}
function extractMetaDescription(html){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    if(!/\bname\s*=\s*["']?description["']?(\s|\/|>)/i.test(tag))continue;
    const m=/\bcontent\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const v=collapse(decodeEntities(m?(m[2]??m[3]??m[4]??''):''));
    if(v)return v.slice(0,WEBSITE_INGEST_LIMITS.maxDescriptionChars);
  }
  return '';
}
function stripToText(html){
  const noHead=String(html||'').replace(/<head[^>]*>[\s\S]*?<\/head\s*>/i,' ');
  return collapse(decodeEntities(noHead
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<\?[\s\S]*?\?>/g,' ')
    .replace(/<(script|style|noscript|template|svg|canvas)[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ')));
}
export function extractEvidence(html,{sourceUrl,finalUrl}){
  const input=String(html||'');
  const cleaned=stripToText(input);
  const excerpt=cleaned.slice(0,WEBSITE_INGEST_LIMITS.maxExcerptChars);
  if(!excerpt)throw new Error('WEBSITE_EMPTY_CONTENT');
  return {
    schemaVersion:'1.0',
    sourceUrl:String(sourceUrl||'').slice(0,1000),
    finalUrl:String(finalUrl||'').slice(0,1000),
    fetchedAt:new Date().toISOString(),
    title:extractTitle(input),
    description:extractMetaDescription(input),
    excerpt,
    textChars:cleaned.length,
    wordCount:cleaned.split(/\s+/).length,
    contentHash:'sha256:'+createHash('sha256').update(input,'utf8').digest('hex'),
    citations:finalUrl&&finalUrl!==sourceUrl?[String(sourceUrl).slice(0,1000),String(finalUrl).slice(0,1000)]:[String(sourceUrl).slice(0,1000)],
  };
}

export async function ingestWebsite(targetUrl,{fetchImpl=fetch,lookupImpl=(host,opts)=>dnsLookup(host,opts),timeoutMs=WEBSITE_INGEST_LIMITS.timeoutMs,maxBytes=WEBSITE_INGEST_LIMITS.maxBytes,maxRedirects=WEBSITE_INGEST_LIMITS.maxRedirects}={}){
  let current=assertSafeTargetUrl(targetUrl);
  const chain=[current.href];
  let response=null;let hops=0;
  for(;;){
    await assertSafeDns(stripBrackets(current.hostname),lookupImpl);
    response=await fetchOnce(current.href,fetchImpl,timeoutMs);
    if(response&&(response.status===0||response.type==='opaqueredirect'))throw new Error('WEBSITE_REDIRECT_MASKED');
    const status=response?response.status:0;
    if(status>=300&&status<400){
      if(hops>=maxRedirects){await discardBody(response);throw new Error('WEBSITE_TOO_MANY_REDIRECTS');}
      const location=response.headers&&typeof response.headers.get==='function'?response.headers.get('location'):'';
      await discardBody(response);
      if(!location)throw new Error('WEBSITE_REDIRECT_BLOCKED');
      let next;
      try{next=new URL(location,current.href);}catch{throw new Error('WEBSITE_REDIRECT_BLOCKED');}
      try{current=assertSafeTargetUrl(next.href);}catch{throw new Error('WEBSITE_REDIRECT_BLOCKED');}
      chain.push(current.href);hops++;
      continue;
    }
    break;
  }
  if(!response||!response.ok)throw new Error('WEBSITE_REQUEST_FAILED_'+(response?response.status:'UNKNOWN'));
  const rawType=response.headers&&typeof response.headers.get==='function'?(response.headers.get('content-type')||''):'';
  const mediaType=rawType.split(';')[0].trim().toLowerCase();
  if(mediaType&&mediaType!=='text/html'&&mediaType!=='application/xhtml+xml')throw new Error('WEBSITE_UNSUPPORTED_CONTENT');
  const text=await readCappedText(response,maxBytes);
  const evidence=extractEvidence(text,{sourceUrl:chain[0],finalUrl:current.href});
  return {...evidence,redirectHops:hops};
}
