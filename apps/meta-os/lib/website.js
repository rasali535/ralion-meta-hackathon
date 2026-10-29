/**
 * Secure website evidence ingestion.
 * Server-only: never import from client components.
 *
 * Fetches one user-supplied public HTTPS page with layered guards:
 * https-only, no credentials, no non-default ports, hostname/IP blocklists,
 * DNS validation on every hop, manual redirect following with per-hop
 * re-validation, content-type allowlist, and byte/time caps.
 * Inject fetchImpl/lookupImpl for contract tests.
 *
 * Rebinding defense: the default transport pins each connection to a
 * validated lookup result, so a hostile DNS answer change between validation
 * and connect cannot redirect the socket. TLS identity still uses the original
 * hostname. Add an egress allowlist before any production use.
 */
import {lookup as dnsLookup} from 'node:dns/promises';
import {createHash} from 'node:crypto';
import {request as httpsRequest} from 'node:https';

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

export const websiteTelemetry=globalThis.__ralionWebsiteTelemetry||(globalThis.__ralionWebsiteTelemetry={
  fallbackCount:0,
  fallbackSuccessCount:0,
  fallbackFailureCount:0,
  events:[],
  recordFallback({ok,latencyMs,errorCode,targetHost}={}){
    this.fallbackCount++;
    if(ok)this.fallbackSuccessCount++;else this.fallbackFailureCount++;
    this.events.push({
      timestamp:new Date().toISOString(),
      ok:Boolean(ok),
      latencyMs:Number.isFinite(latencyMs)?latencyMs:null,
      errorCode:errorCode?String(errorCode).slice(0,50):null,
      targetHost:targetHost?String(targetHost).slice(0,100):null,
    });
    while(this.events.length>200)this.events.shift();
  },
  reset(){
    this.fallbackCount=0;
    this.fallbackSuccessCount=0;
    this.fallbackFailureCount=0;
    this.events.length=0;
  }
});

async function fetchOnce(href,fetchImpl,timeoutMs,maxBytes,headers={'user-agent':'RalionOS-MetaAI-Edition/0.1 (hackathon evidence fetcher)','accept':'text/html,application/xhtml+xml;q=0.9'}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    return await fetchImpl(href,{method:'GET',redirect:'manual',signal:controller.signal,timeoutMs,maxBytes,headers});
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error('WEBSITE_TIMEOUT');
    if(controller.signal.aborted)throw new Error('WEBSITE_TIMEOUT');
    if(e&&/^WEBSITE_[A-Z0-9_]+$/.test(String(e.message)))throw e;
    throw new Error('WEBSITE_FETCH_FAILED');
  }finally{clearTimeout(timer);}
}
export async function pinnedLookupFor(hostname,lookupImpl=(host,opts)=>dnsLookup(host,opts)){
  const host=stripBrackets(String(hostname||'')).toLowerCase().replace(/\.+$/,'');
  assertPublicHostname(host);
  let records;
  try{records=await lookupImpl(host,{all:true});}catch{throw new Error('WEBSITE_DNS_FAILED');}
  const list=Array.isArray(records)?records:[records];
  if(!list.length)throw new Error('WEBSITE_DNS_FAILED');
  const pinned=[];
  for(const r of list){
    const addr=typeof r==='string'?r:r&&r.address;
    if(!addr||isBlockedIpLiteral(String(addr)))throw new Error('WEBSITE_DNS_BLOCKED');
    pinned.push({address:String(addr),family:Number(r&&r.family)===6||String(addr).includes(':')?6:4});
  }
  const primary=pinned[0];
  const lookup=(name,opts,cb)=>{
    const callback=typeof opts==='function'?opts:cb;
    if(opts&&typeof opts==='object'&&Boolean(opts.all)){
      process.nextTick(()=>callback(null,pinned));
    }else{
      process.nextTick(()=>callback(null,primary.address,primary.family));
    }
  };
  return {lookup,addresses:pinned.map(p=>p.address)};
}
function nodeHttpsFetch(href,{lookup,timeoutMs,maxBytes,headers,signal,requestImpl,binary=false,errors={}}){
  const codes={timeout:'WEBSITE_TIMEOUT',tooLarge:'WEBSITE_RESPONSE_TOO_LARGE',fetch:'WEBSITE_FETCH_FAILED',...errors};
  return new Promise((resolve,reject)=>{
    let done=false;let req=null;
    const timer=setTimeout(()=>finish(codes.timeout),timeoutMs);
    const cleanup=()=>{clearTimeout(timer);if(signal)signal.removeEventListener('abort',onAbort);};
    const finish=(code,result)=>{
      if(done)return;done=true;cleanup();
      if(req){try{req.destroy();}catch{}}
      if(code)reject(new Error(code));else resolve(result);
    };
    const onAbort=()=>finish(codes.timeout);
    const getHeader=(raw,k)=>{const val=raw?raw[String(k).toLowerCase()]:undefined;return Array.isArray(val)?val[0]:(val==null?null:String(val));};
    try{
      req=requestImpl(href,{method:'GET',headers,lookup},(res)=>{
        const status=res.statusCode||0;
        const wrapped={get:(k)=>getHeader(res.headers,k)};
        if(status>=300&&status<400){
          if(res.resume)res.resume();
          finish(null,{status,headers:wrapped,body:null,ok:false,text:async()=>''});
          return;
        }
        const chunks=[];let total=0;
        res.on('data',(c)=>{const n=c?c.length:0;total+=n;if(total>maxBytes){finish(codes.tooLarge);return;}if(n)chunks.push(c);});
        res.on('end',()=>{const payload={status,headers:wrapped,body:null,ok:status>=200&&status<300,text:async()=>Buffer.concat(chunks).toString('utf8')};if(binary)payload.buffer=Buffer.concat(chunks);finish(null,payload);});
        res.on('error',()=>finish(codes.fetch));
      });
    }catch{finish(codes.fetch);return;}
    if(!req||typeof req.on!=='function'||typeof req.end!=='function'){finish(codes.fetch);return;}
    req.on('error',()=>finish(codes.fetch));
    if(signal){if(signal.aborted)finish(codes.timeout);else signal.addEventListener('abort',onAbort,{once:true});}
    try{req.end();}catch{finish(codes.fetch);}
  });
}
export function createSecureFetch({lookupImpl=(host,opts)=>dnsLookup(host,opts),requestImpl=(url,options,cb)=>httpsRequest(url,options,cb)}={}){
  return async function secureFetch(href,init={}){
    let u;
    try{u=new URL(String(href));}catch{throw new Error('WEBSITE_URL_INVALID');}
    if(u.protocol!=='https:')throw new Error('WEBSITE_URL_INVALID');
    const {lookup}=await pinnedLookupFor(u.hostname,lookupImpl);
    const timeoutMs=Number(init.timeoutMs)>0?Math.floor(Number(init.timeoutMs)):WEBSITE_INGEST_LIMITS.timeoutMs;
    const maxBytes=Number(init.maxBytes)>0?Math.floor(Number(init.maxBytes)):WEBSITE_INGEST_LIMITS.maxBytes;
    const headers=init.headers||{'user-agent':'RalionOS-MetaAI-Edition/0.1 (hackathon evidence fetcher)','accept':'text/html,application/xhtml+xml;q=0.9'};
    return nodeHttpsFetch(u.href,{lookup,timeoutMs,maxBytes,headers,signal:init.signal,requestImpl});
  };
}
export const MEDIA_FETCH_LIMITS=Object.freeze({timeoutMs:20000,maxBytes:8*1024*1024,maxRedirects:3});
const MEDIA_ERRORS=Object.freeze({timeout:'MEDIA_TIMEOUT',tooLarge:'MEDIA_RESPONSE_TOO_LARGE',fetch:'MEDIA_FETCH_FAILED'});
export async function fetchPinnedMedia(targetUrl,{lookupImpl=(host,opts)=>dnsLookup(host,opts),requestImpl,timeoutMs=MEDIA_FETCH_LIMITS.timeoutMs,maxBytes=MEDIA_FETCH_LIMITS.maxBytes,maxRedirects=MEDIA_FETCH_LIMITS.maxRedirects,allowedTypes=['image/png','image/jpeg','image/webp','image/gif']}={}){
  const req=requestImpl||((url,options,cb)=>httpsRequest(url,options,cb));
  let current=assertSafeTargetUrl(targetUrl);
  let hops=0;
  for(;;){
    const {lookup}=await pinnedLookupFor(current.hostname,lookupImpl);
    const res=await nodeHttpsFetch(current.href,{lookup,timeoutMs,maxBytes,headers:{'user-agent':'RalionOS-MetaAI-Edition/0.1 (hackathon media fetcher)','accept':'image/*'},requestImpl:req,binary:true,errors:MEDIA_ERRORS});
    if(res.status>=300&&res.status<400){
      if(hops>=maxRedirects)throw new Error('MEDIA_TOO_MANY_REDIRECTS');
      const location=res.headers&&typeof res.headers.get==='function'?res.headers.get('location'):'';
      if(!location)throw new Error('MEDIA_REDIRECT_BLOCKED');
      let next;
      try{next=new URL(location,current.href);}catch{throw new Error('MEDIA_REDIRECT_BLOCKED');}
      try{current=assertSafeTargetUrl(next.href);}catch{throw new Error('MEDIA_REDIRECT_BLOCKED');}
      hops++;
      continue;
    }
    if(!res.ok)throw new Error('MEDIA_REQUEST_FAILED_'+res.status);
    const ct=String(res.headers&&typeof res.headers.get==='function'?(res.headers.get('content-type')||''):'').split(';')[0].trim().toLowerCase();
    if(!allowedTypes.includes(ct))throw new Error('MEDIA_UNSUPPORTED_CONTENT');
    return {contentType:ct,bytes:res.buffer,sourceUrl:current.href,redirectHops:hops};
  }
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

export function extractRenderedEvidence(rawMarkdown,{sourceUrl,finalUrl}={}){
  const input=String(rawMarkdown||'');
  const titleMatch=/^Title:\s*(.+)$/im.exec(input);
  const title=titleMatch?collapse(titleMatch[1]).slice(0,WEBSITE_INGEST_LIMITS.maxTitleChars):'';
  const descMatch=/^Description:\s*(.+)$/im.exec(input);
  const description=descMatch?collapse(descMatch[1]).slice(0,WEBSITE_INGEST_LIMITS.maxDescriptionChars):'';
  const marker='Markdown Content:';
  const markerIdx=input.indexOf(marker);
  const rawBody=markerIdx!==-1?input.slice(markerIdx+marker.length):input;
  const noHead=rawBody.replace(/<head[^>]*>[\s\S]*?<\/head\s*>/i,' ');
  const stripped=noHead
    .replace(/<!--[\s\S]*?-->/g,' ')
    .replace(/<\?[\s\S]*?\?>/g,' ')
    .replace(/<(script|style|noscript|template|svg|canvas)[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
    .replace(/<[^>]+>/g,' ')
    .replace(/[*#_`~>|\-]/g,' ');
  const cleaned=collapse(decodeEntities(stripped));
  const excerpt=cleaned.slice(0,WEBSITE_INGEST_LIMITS.maxExcerptChars);
  if(!excerpt)throw new Error('WEBSITE_EMPTY_CONTENT');
  return {
    schemaVersion:'1.0',
    sourceUrl:String(sourceUrl||'').slice(0,1000),
    finalUrl:String(finalUrl||'').slice(0,1000),
    fetchedAt:new Date().toISOString(),
    title,
    description,
    excerpt,
    textChars:cleaned.length,
    wordCount:cleaned.split(/\s+/).filter(Boolean).length,
    contentHash:'sha256-text:'+createHash('sha256').update(cleaned,'utf8').digest('hex'),
    citations:finalUrl&&finalUrl!==sourceUrl?[String(sourceUrl).slice(0,1000),String(finalUrl).slice(0,1000)]:[String(sourceUrl).slice(0,1000)],
    renderedVia:'reader',
  };
}

export async function fetchRenderedFallback(targetUrl,{
  fetchImpl,
  lookupImpl=(host,opts)=>dnsLookup(host,opts),
  requestImpl,
  timeoutMs=WEBSITE_INGEST_LIMITS.timeoutMs,
  maxBytes=WEBSITE_INGEST_LIMITS.maxBytes,
  apiKey=(typeof process!=='undefined'&&process.env&&process.env.JINA_API_KEY)||undefined,
}={}){
  const safeTarget=assertSafeTargetUrl(targetUrl);
  await assertSafeDns(stripBrackets(safeTarget.hostname),lookupImpl);

  const readerUrl='https://r.jina.ai/'+safeTarget.href;
  const headers={
    'user-agent':'RalionOS-MetaAI-Edition/0.1 (hackathon evidence fetcher)',
    'accept':'text/plain',
  };
  if(apiKey)headers['authorization']=`Bearer ${apiKey}`;

  const t0=Date.now();
  const transport=fetchImpl||createSecureFetch({lookupImpl,requestImpl});
  let response;
  try{
    response=await fetchOnce(readerUrl,transport,timeoutMs,maxBytes,headers);
  }catch(err){
    const code=err instanceof Error?err.message:'WEBSITE_FETCH_FAILED';
    websiteTelemetry.recordFallback({ok:false,latencyMs:Date.now()-t0,errorCode:code,targetHost:safeTarget.hostname});
    throw err;
  }

  if(!response||!response.ok){
    const status=response?response.status:'UNKNOWN';
    const code='WEBSITE_REQUEST_FAILED_'+status;
    websiteTelemetry.recordFallback({ok:false,latencyMs:Date.now()-t0,errorCode:code,targetHost:safeTarget.hostname});
    throw new Error(code);
  }

  const text=await readCappedText(response,maxBytes);
  try{
    const evidence=extractRenderedEvidence(text,{sourceUrl:safeTarget.href,finalUrl:safeTarget.href});
    websiteTelemetry.recordFallback({ok:true,latencyMs:Date.now()-t0,targetHost:safeTarget.hostname});
    return evidence;
  }catch(err){
    const code=err instanceof Error?err.message:'WEBSITE_EMPTY_CONTENT';
    websiteTelemetry.recordFallback({ok:false,latencyMs:Date.now()-t0,errorCode:code,targetHost:safeTarget.hostname});
    throw err;
  }
}

export async function ingestWebsite(targetUrl,{fetchImpl,lookupImpl=(host,opts)=>dnsLookup(host,opts),requestImpl,timeoutMs=WEBSITE_INGEST_LIMITS.timeoutMs,maxBytes=WEBSITE_INGEST_LIMITS.maxBytes,maxRedirects=WEBSITE_INGEST_LIMITS.maxRedirects,apiKey}={}){
  let current=assertSafeTargetUrl(targetUrl);
  const transport=fetchImpl||createSecureFetch({lookupImpl,requestImpl});
  const chain=[current.href];
  let response=null;let hops=0;
  for(;;){
    await assertSafeDns(stripBrackets(current.hostname),lookupImpl);
    response=await fetchOnce(current.href,transport,timeoutMs,maxBytes);
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
  try{
    const evidence=extractEvidence(text,{sourceUrl:chain[0],finalUrl:current.href});
    return {...evidence,redirectHops:hops};
  }catch(extractErr){
    if(extractErr&&extractErr.message==='WEBSITE_EMPTY_CONTENT'){
      try{
        const rendered=await fetchRenderedFallback(current.href,{
          fetchImpl,
          lookupImpl,
          requestImpl,
          timeoutMs,
          maxBytes,
          apiKey,
        });
        return {
          ...rendered,
          sourceUrl:chain[0],
          finalUrl:current.href,
          citations:current.href!==chain[0]?[chain[0],current.href]:[chain[0]],
          redirectHops:hops,
        };
      }catch(fallbackErr){
        if(fallbackErr&&fallbackErr.message==='WEBSITE_RESPONSE_TOO_LARGE'){
          throw fallbackErr;
        }
        throw new Error('WEBSITE_EMPTY_CONTENT');
      }
    }
    throw extractErr;
  }
}
