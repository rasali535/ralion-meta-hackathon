import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {fetchPinnedMedia} from '../lib/website.js';

const PNG=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
function dnsFor(map){
  const seen=[];
  const lookupImpl=async(host,opts)=>{
    seen.push(host);
    assert.deepEqual(opts,{all:true});
    const addrs=map[host];
    if(!addrs){const e=new Error('ENOTFOUND');e.code='ENOTFOUND';throw e;}
    return addrs.map(a=>({address:a,family:a.includes(':')?6:4}));
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
const pngStep={status:200,headers:{'content-type':'image/png'},chunks:[PNG.subarray(0,4),PNG.subarray(4)]};

test('fetches bytes through pinned DNS with type checks',async()=>{
  const dns=dnsFor({'cdn.example':['93.184.216.34']});
  const net=scriptedRequest([pngStep]);
  const r=await fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  assert.equal(r.contentType,'image/png');
  assert.ok(Buffer.from(r.bytes).equals(PNG));
  assert.equal(r.redirectHops,0);
  assert.ok(r.sourceUrl.startsWith('https://cdn.example/'));
  assert.ok(net.calls[0].url.startsWith('https://cdn.example/'));
});
test('follows media redirects with per-hop pinning',async()=>{
  const dns=dnsFor({'cdn.example':['93.184.216.34'],'img.example':['93.184.216.35']});
  const net=scriptedRequest([{status:302,headers:{location:'https://img.example/b.png'},chunks:[]},pngStep]);
  const r=await fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl});
  assert.equal(r.sourceUrl,'https://img.example/b.png');
  assert.equal(r.redirectHops,1);
  assert.ok(dns.seen.includes('img.example'));
});
test('blocks unsafe targets before connecting',async()=>{
  const dns=dnsFor({'cdn.example':['10.9.9.9']});
  const net=scriptedRequest([pngStep]);
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl}),/WEBSITE_DNS_BLOCKED/);
  assert.equal(net.calls.length,0);
  await assert.rejects(()=>fetchPinnedMedia('http://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:net.requestImpl}),/WEBSITE_URL_INVALID/);
  const loop=scriptedRequest([{status:301,headers:{location:'https://cdn.example/l'}},{status:301,headers:{location:'https://cdn.example/l'}}]);
  const dns2=dnsFor({'cdn.example':['93.184.216.34']});
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns2.lookupImpl,requestImpl:loop.requestImpl,maxRedirects:1}),/MEDIA_TOO_MANY_REDIRECTS/);
});
test('enforces media content rules and size caps',async()=>{
  const dns=dnsFor({'cdn.example':['93.184.216.34']});
  const json=scriptedRequest([{status:200,headers:{'content-type':'application/json'},chunks:['{}']}]);
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:json.requestImpl}),/MEDIA_UNSUPPORTED_CONTENT/);
  const missing=scriptedRequest([{status:404,headers:{'content-type':'image/png'},chunks:['x']}]);
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:missing.requestImpl}),/MEDIA_REQUEST_FAILED_404/);
  const big=scriptedRequest([{status:200,headers:{'content-type':'image/png'},chunks:[Buffer.alloc(100)]}]);
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:big.requestImpl,maxBytes:50}),/MEDIA_RESPONSE_TOO_LARGE/);
  assert.equal(big.reqs[0].destroyed,true);
});
test('maps hangs to media timeout',async()=>{
  const dns=dnsFor({'cdn.example':['93.184.216.34']});
  const hanging=scriptedRequest([{hang:true}]);
  await assert.rejects(()=>fetchPinnedMedia('https://cdn.example/a.png',{lookupImpl:dns.lookupImpl,requestImpl:hanging.requestImpl,timeoutMs:20}),/MEDIA_TIMEOUT/);
});
