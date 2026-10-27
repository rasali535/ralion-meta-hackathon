import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ingestWebsite,createSecureFetch} from '../lib/website.js';

const PAGE='<html><head><title>Northstar Coffee</title><meta name="description" content="Single-origin espresso for commuters."></head><body><h1>Morning coffees</h1><p>Single-origin espresso and fresh pastries every weekday.</p></body></html>';
function dnsFor(map){
  const seen=[];
  const lookupImpl=async(host,opts)=>{
    seen.push(host);
    assert.deepEqual(opts,{all:true});
    const addrs=map[host];
    if(!addrs){const e=new Error('ENOTFOUND '+host);e.code='ENOTFOUND';throw e;}
    return addrs.map(a=>typeof a==='string'?{address:a,family:a.includes(':')?6:4}:a);
  };
  return {lookupImpl,seen};
}
function scriptedRequest(steps){
  const calls=[];const reqs=[];
  const requestImpl=(url,options,cb)=>{
    const step=steps[calls.length];
    calls.push({url:String(url),options});
    const req=new EventEmitter();
    req.destroyed=false;
    req.destroy=()=>{req.destroyed=true;};
    reqs.push(req);
    req.end=()=>{
      if(!step||step.hang)return;
      setImmediate(()=>{
        if(req.destroyed)return;
        const res=new EventEmitter();
        res.statusCode=step.status;
        res.headers=step.headers||{};
        res.resume=()=>{};
        cb(res);
        setImmediate(()=>{
          if(req.destroyed)return;
          for(const c of step.chunks||[])res.emit('data',Buffer.from(c));
          res.emit('end');
        });
      });
    };
    return req;
  };
  return {requestImpl,calls,reqs};
}
const pageStep={status:200,headers:{'content-type':'text/html'},chunks:[PAGE.slice(0,40),PAGE.slice(40)]};
function callLookup(lookup,name){
  return new Promise((resolve,reject)=>lookup(name,{},(e,a,f)=>e?reject(e):resolve([a,f])));
}

test('dials only the validated address with the original hostname',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34']});
  const net=scriptedRequest([pageStep]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  const res=await secure('https://example.org/',{});
  assert.equal(res.status,200);
  assert.equal(res.ok,true);
  assert.match(await res.text(),/Single-origin espresso/);
  assert.equal(net.calls.length,1);
  assert.ok(net.calls[0].url.startsWith('https://example.org/'));
  assert.deepEqual(await callLookup(net.calls[0].options.lookup,'example.org'),['93.184.216.34',4]);
  assert.deepEqual(await callLookup(net.calls[0].options.lookup,'other.example'),['93.184.216.34',4]);
  assert.deepEqual(dns.seen,['example.org']);
});
test('refuses to connect when DNS answers are not public',async()=>{
  for(const [label,map,code] of [
    ['private',{'example.org':['10.1.2.3']},/WEBSITE_DNS_BLOCKED/],
    ['mixed',{'example.org':['93.184.216.34','169.254.169.254']},/WEBSITE_DNS_BLOCKED/],
    ['missing',{},/WEBSITE_DNS_FAILED/],
  ]){
    const dns=dnsFor(map);
    const net=scriptedRequest([pageStep]);
    const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
    await assert.rejects(()=>secure('https://example.org/',{}),code,label);
    assert.equal(net.calls.length,0,label);
  }
});
test('re-pins every redirect hop',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34'],'www.example.org':['93.184.216.35']});
  const net=scriptedRequest([
    {status:301,headers:{location:'https://www.example.org/'},chunks:[]},
    pageStep,
  ]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  const r=await ingestWebsite('https://example.org/',{fetchImpl:secure,lookupImpl:dns.lookupImpl});
  assert.equal(r.finalUrl,'https://www.example.org/');
  assert.equal(r.redirectHops,1);
  assert.equal(net.calls.length,2);
  assert.ok(net.calls[1].url.startsWith('https://www.example.org/'));
  assert.ok(dns.seen.includes('example.org'));
  assert.ok(dns.seen.includes('www.example.org'));
  assert.deepEqual(await callLookup(net.calls[1].options.lookup,'www.example.org'),['93.184.216.35',4]);
});
test('survives DNS rebinding between validation and connect',async()=>{
  const clean=dnsFor({'example.org':['93.184.216.34']});
  const rebound=dnsFor({'example.org':['169.254.169.254']});
  const net=scriptedRequest([pageStep]);
  const secure=createSecureFetch({lookupImpl:rebound.lookupImpl,requestImpl:net.requestImpl});
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:secure,lookupImpl:clean.lookupImpl}),/WEBSITE_DNS_BLOCKED/);
  assert.equal(net.calls.length,0);
});
test('enforces byte caps mid-stream and destroys the socket',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34']});
  const net=scriptedRequest([{status:200,headers:{'content-type':'text/html'},chunks:['<p>'+'y'.repeat(100)+'</p>']}]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  await assert.rejects(()=>secure('https://example.org/',{maxBytes:50}),/WEBSITE_RESPONSE_TOO_LARGE/);
  assert.equal(net.reqs[0].destroyed,true);
});
test('maps hangs and aborts to timeout',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34']});
  const hanging=scriptedRequest([{hang:true}]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:hanging.requestImpl});
  await assert.rejects(()=>secure('https://example.org/',{timeoutMs:20}),/WEBSITE_TIMEOUT/);
  const hanging2=scriptedRequest([{hang:true}]);
  const secure2=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:hanging2.requestImpl});
  const controller=new AbortController();
  setTimeout(()=>controller.abort(),5);
  await assert.rejects(()=>secure2('https://example.org/',{signal:controller.signal,timeoutMs:5000}),/WEBSITE_TIMEOUT/);
});
test('rejects non-https targets without DNS or connect',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34']});
  const net=scriptedRequest([pageStep]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  await assert.rejects(()=>secure('http://example.org/',{}),/WEBSITE_URL_INVALID/);
  assert.equal(dns.seen.length,0);
  assert.equal(net.calls.length,0);
});
test('passes status and headers through case-insensitively',async()=>{
  const dns=dnsFor({'example.org':['93.184.216.34']});
  const step404={status:404,headers:{'content-type':'text/html'},chunks:['missing']};
  const net=scriptedRequest([step404,step404]);
  const secure=createSecureFetch({lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  const res=await secure('https://example.org/',{});
  assert.equal(res.status,404);
  assert.equal(res.ok,false);
  assert.equal(res.headers.get('Content-Type'),'text/html');
  await assert.rejects(()=>ingestWebsite('https://example.org/',{fetchImpl:secure,lookupImpl:dns.lookupImpl}),/WEBSITE_REQUEST_FAILED_404/);
});
