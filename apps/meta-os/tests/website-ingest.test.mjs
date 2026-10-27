import test from 'node:test';
import assert from 'node:assert/strict';
import {TextEncoder} from 'node:util';
import {ingestWebsite,extractEvidence,isBlockedIpLiteral,WEBSITE_INGEST_LIMITS} from '../lib/website.js';

function headers(map){
  const lower={};
  for(const [k,v] of Object.entries(map))lower[String(k).toLowerCase()]=v;
  return {get:(k)=>lower[String(k).toLowerCase()]??null};
}
const mustNotRun=async()=>{throw new Error('MUST_NOT_RUN');};
const publicDns=async()=>[{address:'93.184.216.34',family:4}];
const PAGE='<html><head><title>Northstar Coffee</title><meta name="description" content="Single-origin espresso for commuters."><script src="analytics.js"></script></head><body><h1>Morning coffees</h1><p>Single-origin espresso and fresh pastries every weekday.</p></body></html>';
function page200(html,{url='https://example.org/',type='text/html; charset=utf-8'}={}){
  return async (href,init)=>{
    assert.equal(href,url);
    assert.equal(init&&init.redirect,'manual');
    return {ok:true,status:200,type:'basic',headers:headers({'content-type':type}),async text(){return html;}};
  };
}

test('rejects non-https, credentialed, odd-port, and malformed URLs',async()=>{
  for(const u of ['http://example.org/','ftp://example.org/x','https://user:pass@example.org/','https://example.org:8443/','not a url','',null,undefined,'https://']){
    await assert.rejects(()=>ingestWebsite(u,{fetchImpl:mustNotRun,lookupImpl:mustNotRun}),/WEBSITE_URL_INVALID/,String(u));
  }
});
test('blocks intranet and special-use hosts before any DNS or fetch',async()=>{
  for(const u of ['https://localhost/','https://127.0.0.1/','https://10.0.0.9/','https://172.16.4.4/','https://192.168.1.1/','https://169.254.169.254/','https://0.0.0.0/','https://[::1]/','https://[fe80::1]/','https://intranet/','https://host.local/','https://x.internal/']){
    await assert.rejects(()=>ingestWebsite(u,{fetchImpl:mustNotRun,lookupImpl:mustNotRun}),/WEBSITE_HOST_BLOCKED/,u);
  }
});
test('blocks DNS answers pointing at non-public space',async()=>{
  const bad=async()=>[{address:'10.1.2.3',family:4}];
  const mixed=async()=>[{address:'93.184.216.34',family:4},{address:'169.254.169.254',family:4}];
  const failing=async()=>{throw new Error('ENOTFOUND');};
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:mustNotRun,lookupImpl:bad}),/WEBSITE_DNS_BLOCKED/);
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:mustNotRun,lookupImpl:mixed}),/WEBSITE_DNS_BLOCKED/);
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:mustNotRun,lookupImpl:failing}),/WEBSITE_DNS_FAILED/);
});
test('extracts grounded evidence and stable hashes',async()=>{
  const r=await ingestWebsite('https://example.org/',{fetchImpl:page200(PAGE),lookupImpl:publicDns});
  assert.equal(r.schemaVersion,'1.0');
  assert.equal(r.sourceUrl,'https://example.org/');
  assert.equal(r.finalUrl,'https://example.org/');
  assert.equal(r.title,'Northstar Coffee');
  assert.equal(r.description,'Single-origin espresso for commuters.');
  assert.match(r.excerpt,/Single-origin espresso/);
  assert.ok(!r.excerpt.includes('analytics.js'));
  assert.ok(!r.excerpt.includes('Northstar Coffee'));
  assert.deepEqual(r.citations,['https://example.org/']);
  assert.match(r.contentHash,/^sha256:[0-9a-f]{64}$/);
  assert.ok(r.wordCount>5);
  assert.equal(r.redirectHops,0);
  assert.ok(!Number.isNaN(Date.parse(r.fetchedAt)));
  const again=extractEvidence(PAGE,{sourceUrl:'https://example.org/',finalUrl:'https://example.org/'});
  assert.equal(again.contentHash,r.contentHash);
  const other=extractEvidence(PAGE+'<p>more</p>',{sourceUrl:'https://example.org/',finalUrl:'https://example.org/'});
  assert.notEqual(other.contentHash,r.contentHash);
});
test('follows a safe redirect and records the chain',async()=>{
  const fetchImpl=async(href,init)=>{
    assert.equal(init&&init.redirect,'manual');
    if(href==='https://example.org/')return {ok:false,status:301,type:'basic',headers:headers({location:'https://www.example.org/welcome'}),body:null};
    assert.equal(href,'https://www.example.org/welcome');
    return {ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html'}),async text(){return PAGE;}};
  };
  const r=await ingestWebsite('https://example.org/',{fetchImpl,lookupImpl:publicDns});
  assert.equal(r.finalUrl,'https://www.example.org/welcome');
  assert.equal(r.redirectHops,1);
  assert.deepEqual(r.citations,['https://example.org/','https://www.example.org/welcome']);
  assert.match(r.excerpt,/Single-origin espresso/);
});
test('follows a relative redirect on the same origin',async()=>{
  const fetchImpl=async(href)=>{
    if(href==='https://example.org/')return {ok:false,status:302,type:'basic',headers:headers({location:'/welcome'}),body:null};
    assert.equal(href,'https://example.org/welcome');
    return {ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html'}),async text(){return PAGE;}};
  };
  const r=await ingestWebsite('https://example.org/',{fetchImpl,lookupImpl:publicDns});
  assert.equal(r.finalUrl,'https://example.org/welcome');
  assert.equal(r.redirectHops,1);
});
test('rejects unsafe, missing, masked, and looping redirects',async()=>{
  const to=async()=>({ok:false,status:301,type:'basic',headers:headers({location:'http://169.254.169.254/'}),body:null});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:to,lookupImpl:publicDns}),/WEBSITE_REDIRECT_BLOCKED/);
  const missing=async()=>({ok:false,status:302,type:'basic',headers:headers({}),body:null});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:missing,lookupImpl:publicDns}),/WEBSITE_REDIRECT_BLOCKED/);
  const masked=async()=>({ok:false,status:0,type:'opaqueredirect',headers:headers({}),body:null});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:masked,lookupImpl:publicDns}),/WEBSITE_REDIRECT_MASKED/);
  const loop=async()=>({ok:false,status:301,type:'basic',headers:headers({location:'https://example.org/loop'}),body:null});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:loop,lookupImpl:publicDns,maxRedirects:2}),/WEBSITE_TOO_MANY_REDIRECTS/);
});
test('enforces declared and streamed byte caps',async()=>{
  const declared=async()=>({ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html','content-length':'999999999'}),async text(){throw new Error('MUST_NOT_READ');}});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:declared,lookupImpl:publicDns}),/WEBSITE_RESPONSE_TOO_LARGE/);
  const enc=new TextEncoder();
  const big=enc.encode('<p>'+'x'.repeat(100)+'</p>');
  const streamed=async()=>({ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html'}),body:{getReader(){let i=0;const parts=[big.subarray(0,60),big.subarray(60)];return{async read(){if(i>=parts.length)return{done:true,value:undefined};const value=parts[i++];return{done:false,value};},async cancel(){},releaseLock(){}};}}});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:streamed,lookupImpl:publicDns,maxBytes:50}),/WEBSITE_RESPONSE_TOO_LARGE/);
});
test('streams small bodies through the byte-merge path',async()=>{
  const enc=new TextEncoder();
  const bytes=enc.encode('<html><body><p>hello world from stream</p></body></html>');
  const fetchImpl=async()=>({ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html'}),body:{getReader(){let i=0;const parts=[bytes.subarray(0,10),bytes.subarray(10)];return{async read(){if(i>=parts.length)return{done:true,value:undefined};const value=parts[i++];return{done:false,value};},async cancel(){},releaseLock(){}};}}});
  const r=await ingestWebsite('https://example.org/',{fetchImpl,lookupImpl:publicDns,maxBytes:1000});
  assert.match(r.excerpt,/hello world from stream/);
});
test('rejects non-HTML, empty, and failing origins',async()=>{
  const json=async()=>({ok:true,status:200,type:'basic',headers:headers({'content-type':'application/json'}),async text(){return '{}';}});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:json,lookupImpl:publicDns}),/WEBSITE_UNSUPPORTED_CONTENT/);
  const empty=async()=>({ok:true,status:200,type:'basic',headers:headers({'content-type':'text/html'}),async text(){return '<html><head><script>var a=1;</script></head><body>   </body></html>';}});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:empty,lookupImpl:publicDns}),/WEBSITE_EMPTY_CONTENT/);
  const missing=async()=>({ok:false,status:404,type:'basic',headers:headers({'content-type':'text/html'}),async text(){return 'nope';}});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:missing,lookupImpl:publicDns}),/WEBSITE_REQUEST_FAILED_404/);
  const boom=async()=>{throw new Error('socket hangup');};
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:boom,lookupImpl:publicDns}),/WEBSITE_FETCH_FAILED/);
});
test('times out a hanging origin',async()=>{
  const hanging=(href,init)=>new Promise((_,reject)=>{
    const onAbort=()=>{const e=new Error('aborted');e.name='AbortError';reject(e);};
    if(init&&init.signal){if(init.signal.aborted)onAbort();else init.signal.addEventListener('abort',onAbort,{once:true});}
  });
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:hanging,lookupImpl:publicDns,timeoutMs:20}),/WEBSITE_TIMEOUT/);
});
test('blocks special-use IP literals including v6 and mapped forms',()=>{
  for(const h of ['127.0.0.1','10.0.0.1','172.16.5.4','172.31.255.255','192.168.0.1','169.254.10.20','0.0.0.0','224.0.0.1','240.0.0.1','100.64.0.1','192.0.2.1','198.51.100.7','203.0.113.9','198.18.0.1','::1','::','fe80::1','FE80::A','fc00::1','fd12:3456::1','ff02::1','::ffff:127.0.0.1','2001:db8::1','[::1]'])assert.equal(isBlockedIpLiteral(h),true,h);
  for(const h of ['93.184.216.34','1.1.1.1','8.8.8.8','172.15.255.255','172.32.0.1','192.167.255.255','2606:4700:4700::1111','2001:4860:4860::8888','example.org'])assert.equal(isBlockedIpLiteral(h),false,h);
});
test('exposes documented ingest limits',()=>{
  assert.equal(WEBSITE_INGEST_LIMITS.timeoutMs,12000);
  assert.equal(WEBSITE_INGEST_LIMITS.maxRedirects,3);
  assert.ok(WEBSITE_INGEST_LIMITS.maxBytes>=500000);
});
