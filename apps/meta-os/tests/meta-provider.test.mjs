import test from 'node:test';
import assert from 'node:assert/strict';
import {MODEL_IDS,META_API_BASE,metaRequest,reasonWithMeta,responseText,generateWithMuseImage} from '../lib/meta/provider.js';
test('fixed, documented model ids',()=>{assert.equal(MODEL_IDS.spark,'muse-spark-1.3');assert.equal(MODEL_IDS.wonder,'muse-wonder-1.0');assert.equal(MODEL_IDS.segment,'sam-3.1')});
test('never permits arbitrary endpoints',async()=>{await assert.rejects(()=>metaRequest('http://internal',{},{key:'test'}),/NOT_ALLOWED/)});
test('reasoning uses fixed Meta endpoint and credential only on server',async()=>{
 let captured;
 const fetchImpl=async(url,init)=>{captured={url,init};return {ok:true,json:async()=>({id:'resp_1',output:[{content:[{text:'Test a measurable offer'}]}]})}};
 const r=await reasonWithMeta({business:{name:'Fictional Shop',objective:'Acquire customers'},fetchImpl,key:'fake-server-key'});
 assert.equal(captured.url,META_API_BASE+'/responses');assert.equal(captured.init.headers.authorization,'Bearer fake-server-key');assert.equal(r.model,MODEL_IDS.spark);assert.equal(r.output,'Test a measurable offer');assert.equal(JSON.stringify(r).includes('fake-server-key'),false)
});
test('image uses Muse Image generation only and does not invent assets',async()=>{
 const fetchImpl=async(url,init)=>({ok:true,json:async()=>({data:[{url:'https://cdn.example.org/signed-image'}]})});
 const r=await generateWithMuseImage({prompt:'A branded product shot',fetchImpl,key:'fake-server-key'});assert.equal(r.model,MODEL_IDS.image);assert.equal(r.reviewRequired,true)
});
test('empty Meta response fails',async()=>{await assert.rejects(()=>reasonWithMeta({business:{name:'A',objective:'B'},key:'fake',fetchImpl:async()=>({ok:true,json:async()=>({output:[]})})}),/EMPTY/)});
