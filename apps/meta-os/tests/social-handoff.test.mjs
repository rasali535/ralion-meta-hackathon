import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSocialHandoff,bindSocialHandoffApproval,verifySocialHandoffBinding,attachSocialHandoffs,normalizeChannel,defaultCampaignLabel,SOCIAL_HANDOFF_CHANNELS} from '../lib/social-handoff.js';
import {hashMissionPlan} from '../lib/approval.js';
import {planMission} from '../lib/mission.js';

const TENANT={organizationId:'org-1',workspaceId:'ws-1'};
const DRAFT={channel:'Facebook',caption:'Discover Northstar Coffee.',cta:'Learn more',audience:'Local commuters',hashtags:['#coffee']};
const ASSET={assetId:'img_0123456789abcdef',organizationId:'org-1',workspaceId:'ws-1'};
const RECORD={approvalId:'appr_1',missionId:'m-1',organizationId:'org-1',workspaceId:'ws-1',decision:'APPROVED',scope:'LOCAL_DRAFT_ONLY',actor:{id:'Alice',role:'owner'},planHash:'abc123',approvedAt:'2026-10-28T10:00:00.000Z'};

test('builds a canonical facebook handoff with tenant, asset, and campaign',()=>{
  const h=buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',campaign:'Northstar launch',asset:ASSET});
  assert.equal(h.schemaVersion,'1.0');
  assert.equal(h.channel,'facebook');
  assert.equal(h.organizationId,'org-1');
  assert.equal(h.workspaceId,'ws-1');
  assert.equal(h.missionId,'m-1');
  assert.equal(h.assetId,ASSET.assetId);
  assert.equal(h.mediaType,'image');
  assert.deepEqual(h.previewRef,{kind:'signed-asset-delivery',assetId:ASSET.assetId});
  assert.equal(h.caption,DRAFT.caption);
  assert.equal(h.cta,'Learn more');
  assert.equal(h.campaign,'Northstar launch');
  assert.equal(h.status,'DRAFT_ONLY');
  assert.equal(h.publishStatus,'NOT_CONNECTED');
  assert.equal(h.approval,null);
});

test('normalizes instagram channel and caps collections',()=>{
  const h=buildSocialHandoff({draft:{...DRAFT,channel:'Instagram',hashtags:['#a','#b','#c','#d','#e','#f','#g']},tenant:TENANT,missionId:'m-1'});
  assert.equal(h.channel,'instagram');
  assert.equal(h.assetId,null);
  assert.equal(h.previewRef,null);
  assert.deepEqual(h.hashtags,['#a','#b','#c','#d','#e']);
});

test('preview references never contain URLs',()=>{
  const h=buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',asset:ASSET});
  assert.ok(!JSON.stringify(h).includes('http'));
  assert.ok(!('url' in h.previewRef));
});

test('rejects invalid channel, tenant, mission, and caption',()=>{
  assert.throws(()=>normalizeChannel('tiktok'),/CHANNEL_INVALID/);
  assert.throws(()=>buildSocialHandoff({draft:{...DRAFT,channel:'X'},tenant:TENANT,missionId:'m-1'}),/CHANNEL_INVALID/);
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:{},missionId:'m-1'}),/TENANT_REQUIRED/);
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:{organizationId:'org-1',workspaceId:'../escape'},missionId:'m-1'}),/TENANT_REQUIRED/);
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:''}),/MISSION_REQUIRED/);
  assert.throws(()=>buildSocialHandoff({draft:{channel:'facebook'},tenant:TENANT,missionId:'m-1'}),/CAPTION_REQUIRED/);
  assert.throws(()=>buildSocialHandoff({tenant:TENANT,missionId:'m-1'}),/DRAFT_REQUIRED/);
});

test('rejects cross-tenant and malformed assets',()=>{
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',asset:{...ASSET,workspaceId:'ws-2'}}),/TENANT_MISMATCH/);
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',asset:{...ASSET,assetId:'evil'}}),/ASSET_INVALID/);
  assert.throws(()=>buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',asset:'img_0123456789abcdef'}),/ASSET_INVALID/);
});

test('binds approval snapshots and enforces tenant, mission, and scope',()=>{
  const h=buildSocialHandoff({draft:DRAFT,tenant:TENANT,missionId:'m-1',asset:ASSET});
  const bound=bindSocialHandoffApproval(h,RECORD);
  assert.equal(bound.approval.planHash,'abc123');
  assert.equal(bound.approval.approvedBy,'Alice');
  assert.ok(verifySocialHandoffBinding(bound,'abc123'));
  assert.equal(verifySocialHandoffBinding(bound,'other'),false);
  assert.equal(verifySocialHandoffBinding(h,'abc123'),false);
  assert.throws(()=>bindSocialHandoffApproval(h,{...RECORD,workspaceId:'ws-9'}),/TENANT_MISMATCH/);
  assert.throws(()=>bindSocialHandoffApproval(h,{...RECORD,missionId:'m-2'}),/MISSION_MISMATCH/);
  assert.throws(()=>bindSocialHandoffApproval(h,{...RECORD,scope:'EXTERNAL_PUBLISH'}),/SCOPE_UNAUTHORIZED/);
});

test('attaches handoffs per channel and stays hash-neutral',()=>{
  const mission=planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits',audience:'Local commuters'});
  const before=hashMissionPlan(mission);
  const withHandoffs=attachSocialHandoffs(mission,{tenant:TENANT,assets:[ASSET],approval:{...RECORD,missionId:mission.missionId}});
  assert.equal(withHandoffs.social.length,2);
  assert.ok(withHandoffs.social.every(s=>s.socialContract&&SOCIAL_HANDOFF_CHANNELS.includes(s.socialContract.channel)));
  assert.ok(withHandoffs.social.every(s=>s.socialContract.assetId===ASSET.assetId));
  assert.ok(withHandoffs.social.every(s=>verifySocialHandoffBinding(s.socialContract,'abc123')));
  assert.equal(hashMissionPlan(withHandoffs),before);
});

test('attach degrades malformed drafts without losing tenant enforcement',()=>{
  const mission=planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits'});
  mission.social.push({channel:'Myspace'});
  const out=attachSocialHandoffs(mission,{tenant:TENANT,assets:[]});
  assert.equal(out.social[2].socialContract,null);
  assert.ok(out.social[0].socialContract);
  assert.throws(()=>attachSocialHandoffs(mission,{tenant:{}}),/TENANT_REQUIRED/);
  assert.throws(()=>attachSocialHandoffs(null,{tenant:TENANT}),/MISSION_INVALID/);
});

test('derives a default campaign label from mission content',()=>{
  const mission=planMission({name:'Northstar Coffee',industry:'Hospitality',objective:'Increase morning visits'});
  const label=defaultCampaignLabel(mission);
  assert.ok(label.startsWith('Northstar Coffee'));
  assert.equal(defaultCampaignLabel(null),'');
});
