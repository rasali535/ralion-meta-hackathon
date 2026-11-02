import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rmSync,mkdirSync} from 'node:fs';
import {buildMultimediaCampaignPlan,synthesizeCampaignVoiceWav,synthesizeCampaignReelMp4} from '../lib/multimedia.js';
import {generateMultimediaAsset,sniffMediaType} from '../lib/creative.js';
import {loadCreativeAsset} from '../lib/creative-store.js';

const TMP=path.join(import.meta.dirname,'.tmp','multimedia');
function fresh(){rmSync(TMP,{recursive:true,force:true});mkdirSync(TMP,{recursive:true});}
after(()=>rmSync(TMP,{recursive:true,force:true}));

test('builds 3-scene storyboard and voiceover script from mission context',()=>{
  const plan=buildMultimediaCampaignPlan({
    business:{name:'Northstar Coffee',industry:'Specialty Coffee',objective:'Increase morning visits',audience:'Local commuters'},
    growth:{opportunity:'Launch commuter express pickup'}
  });
  assert.equal(plan.durationSec,12);
  assert.equal(plan.aspectRatio,'9:16');
  assert.equal(plan.scenes.length,3);
  assert.ok(plan.scenes[0].headline.includes('Northstar Coffee'));
  assert.ok(plan.voiceover.script.includes('Northstar Coffee'));
  assert.equal(plan.voiceover.status,'READY_FOR_SYNTHESIS');
});

test('synthesizes valid 16-bit PCM WAV voiceover bytes',()=>{
  const wav=synthesizeCampaignVoiceWav('Welcome to Northstar Coffee morning express');
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.toString('ascii',8,12),'WAVE');
  assert.equal(sniffMediaType(wav),'audio/wav');
  assert.ok(wav.length>16000);
});

test('synthesizes valid ISO-BMFF MP4 container bytes with storyboard manifest',()=>{
  const mp4=synthesizeCampaignReelMp4({businessName:'Northstar Coffee',objective:'Increase morning visits'});
  assert.equal(mp4.toString('ascii',4,8),'ftyp');
  assert.equal(sniffMediaType(mp4),'video/mp4');
  assert.ok(mp4.includes(Buffer.from('Northstar Coffee','utf8')));
});

test('stores and round-trips tenant-isolated video and voice assets',async()=>{
  fresh();
  const tenant={organizationId:'demo',workspaceId:'ws_test'};
  const vid=await generateMultimediaAsset({tenant,kind:'video',businessName:'Northstar Coffee',objective:'Increase morning visits',confirm:true,missionId:'m-1',storeRoot:TMP});
  assert.equal(vid.metadata.mimeType,'video/mp4');
  assert.equal(vid.metadata.storyboard.length,3);
  const loadedVid=loadCreativeAsset(TMP,{organizationId:'demo',workspaceId:'ws_test',assetId:vid.metadata.assetId});
  assert.equal(loadedVid.bytes.length,vid.metadata.bytes);

  const aud=await generateMultimediaAsset({tenant,kind:'voice',businessName:'Northstar Coffee',script:'Custom spoken brief for commuters',confirm:true,missionId:'m-1',storeRoot:TMP});
  assert.equal(aud.metadata.mimeType,'audio/wav');
  assert.ok(aud.metadata.prompt.includes('Custom spoken brief'));
  const loadedAud=loadCreativeAsset(TMP,{organizationId:'demo',workspaceId:'ws_test',assetId:aud.metadata.assetId});
  assert.equal(loadedAud.bytes.length,aud.metadata.bytes);
});

