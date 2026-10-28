import test from 'node:test';
import assert from 'node:assert/strict';
import {hashMissionPlan,verifyApprovalRecord,recordHumanApproval} from '../lib/approval.js';
import {planMission} from '../lib/mission.js';

const SECRET='creative-approval-test-secret-32ch!';
const base={name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits'};
function missionWithAssets(){
  const mission=planMission(base);
  return {...mission,creative:{brief:'Morning cups',assets:[{assetId:'img_0123456789abcdef',prompt:'A shop',mimeType:'image/png',bytes:10,sha256:'abc',reviewStatus:'PENDING_REVIEW'}],generated:true}};
}
function mint(mission){return recordHumanApproval(mission,{actorId:'u-1',role:'owner',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET});}

test('binds approvals to creative assets and social copy',()=>{
  const mission=missionWithAssets();
  assert.equal(verifyApprovalRecord(mint(mission),mission,{hmacSecret:SECRET}),true);
  const tamperedPrompt={...mission,creative:{...mission.creative,assets:[{...mission.creative.assets[0],prompt:'Different'}]}};
  assert.equal(verifyApprovalRecord(mint(mission),tamperedPrompt,{hmacSecret:SECRET}),false);
  const tamperedStatus={...mission,creative:{...mission.creative,assets:[{...mission.creative.assets[0],reviewStatus:'APPROVED'}]}};
  assert.equal(verifyApprovalRecord(mint(mission),tamperedStatus,{hmacSecret:SECRET}),false);
  const tamperedCaption={...mission,social:[{...mission.social[0],caption:'Hacked'},mission.social[1]]};
  assert.equal(verifyApprovalRecord(mint(mission),tamperedCaption,{hmacSecret:SECRET}),false);
});
test('tolerates missions without creative sections',()=>{
  const legacy={missionId:'m-legacy',business:{name:'B',industry:'I'},growth:{opportunity:'O'},social:[{channel:'Facebook',copy:'C'}]};
  assert.match(hashMissionPlan(legacy),/^[0-9a-f]{64}$/);
  const record=recordHumanApproval(legacy,{actorId:'u-1',role:'owner',organizationId:'org-1',workspaceId:'ws-1',hmacSecret:SECRET});
  assert.equal(verifyApprovalRecord(record,legacy,{hmacSecret:SECRET}),true);
});
