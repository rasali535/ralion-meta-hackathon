import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMockPost,normalizeMockPlatform,MOCK_PLATFORMS} from '../lib/mock-preview.js';

const draft={channel:'Instagram',caption:'Meet Northstar Coffee. Increase morning customer visits.',cta:'Explore Northstar Coffee',hashtags:['#morningbrew','#coffee']};
const brand={tagline:'Bold mornings daily',tone:'playful',hashtags:['#morningbrew'],primaryColor:'#123ABC',accentColor:'#FF8800',ctaStyle:'Come say hi'};

test('builds platform mock models with simulated guards',()=>{
  const ig=buildMockPost({draft,platform:'instagram',businessName:'Northstar Coffee',brand,assetId:'img_0123456789abcdef'});
  assert.equal(ig.platform,'instagram');
  assert.equal(ig.simulated,true);
  assert.equal(ig.published,false);
  assert.equal(ig.engagement,null);
  assert.deepEqual([...ig.badges],['SIMULATED PREVIEW','NOT PUBLISHED']);
  assert.equal(ig.pageName,'Northstar Coffee');
  assert.equal(ig.handle,'@northstarcoffee');
  assert.equal(ig.accentColor,'#FF8800');
  assert.equal(ig.brandTone,'playful');
  assert.equal(ig.assetId,'img_0123456789abcdef');
  const fb=buildMockPost({draft:{...draft,channel:'Facebook'},platform:'Facebook',businessName:'Northstar Coffee'});
  assert.equal(fb.platform,'facebook');
  assert.equal(fb.accentColor,'#0EA5A6');
  assert.equal(fb.assetId,null);
  assert.deepEqual(MOCK_PLATFORMS,['facebook','instagram']);
});

test('mock models never carry engagement metrics',()=>{
  const ig=buildMockPost({draft,platform:'instagram',businessName:'Northstar Coffee',brand});
  const flat=JSON.stringify(ig).toLowerCase();
  for(const word of ['"likes"','"followers"','"views"','"reach"','"impressions"','"conversions"','"revenue"','"clicks"','"shares"','"comments"']){
    assert.ok(!flat.includes(word),'must not carry '+word);
  }
  assert.ok(!('likeCount' in ig));
});

test('derives handles deterministically and tolerates sparse input',()=>{
  assert.equal(buildMockPost({draft,platform:'instagram',businessName:'Northstar Coffee & Roasters!'}).handle,'@northstarcoffeeroasters');
  assert.equal(buildMockPost({draft,platform:'instagram',businessName:''}).handle,'@business');
  assert.equal(buildMockPost({draft:{caption:'Hi'},platform:'facebook',businessName:'Shop'}).ctaLabel,'');
  assert.deepEqual(buildMockPost({draft:{caption:'Hi'},platform:'facebook',businessName:'Shop'}).hashtags,[]);
  assert.equal(normalizeMockPlatform('Instagram'),'instagram');
  assert.throws(()=>normalizeMockPlatform('tiktok'),/MOCK_PLATFORM_INVALID/);
  assert.throws(()=>buildMockPost({platform:'instagram'}),/MOCK_DRAFT_REQUIRED/);
  assert.throws(()=>buildMockPost(null),/MOCK_DRAFT_REQUIRED/);
});
