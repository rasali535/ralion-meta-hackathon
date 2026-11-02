import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeBrandKit,sanitizeHashtags,isDefaultBrandKit,brandKitLabel,BRAND_TONES,BRAND_DEFAULT_COLORS} from '../lib/brand.js';
import {buildChannelDrafts} from '../lib/social-copy.js';

const mission={business:{name:'Northstar Coffee',industry:'Hospitality / coffee',objective:'Increase morning customer visits',audience:'Local morning commuters'},growth:{opportunity:'Test a focused campaign for commuters'}};
const branded={...mission,brand:{tagline:'Bold mornings daily',tone:'playful',hashtags:'#morningbrew, coffee',primaryColor:'#123abc',accentColor:'#ff8800',ctaStyle:'Come say hi'}};

test('sanitizes hostile input into the safe baseline kit',()=>{
  assert.deepEqual(sanitizeBrandKit(undefined),{tagline:'',tone:'friendly',hashtags:[],primaryColor:'#1F2937',accentColor:'#0EA5A6',ctaStyle:''});
  assert.deepEqual(sanitizeBrandKit(null),sanitizeBrandKit(undefined));
  assert.deepEqual(sanitizeBrandKit('nope'),sanitizeBrandKit(undefined));
  const weird=sanitizeBrandKit({tone:'LOUD',primaryColor:'red',accentColor:'#12345',tagline:'  x  ',ctaStyle:1});
  assert.equal(weird.tone,'friendly');
  assert.equal(weird.primaryColor,'#1F2937');
  assert.equal(weird.accentColor,'#0EA5A6');
  assert.equal(weird.tagline,'x');
  assert.equal(weird.ctaStyle,'1');
  assert.ok(BRAND_TONES.includes('bold'));
  assert.equal(BRAND_DEFAULT_COLORS.accent,'#0EA5A6');
});

test('normalizes hashtags from strings and arrays with dedupe and cap',()=>{
  assert.deepEqual(sanitizeHashtags('#MorningBrew, coffee #morningbrew'),['#morningbrew','#coffee']);
  assert.deepEqual(sanitizeHashtags(['Espresso!','espresso','a'.repeat(60)]),['#espresso','#'+'a'.repeat(30)]);
  assert.deepEqual(sanitizeHashtags(''),[]);
  assert.deepEqual(sanitizeHashtags(['#a','#b','#c','#d','#e','#f','#g']),['#a','#b','#c','#d','#e']);
  assert.deepEqual(sanitizeHashtags(['!!!','']  ),[]);
});

test('labels baseline versus customized kits',()=>{
  assert.equal(isDefaultBrandKit(undefined),true);
  assert.equal(isDefaultBrandKit({tone:'friendly'}),true);
  assert.equal(isDefaultBrandKit({tone:'bold'}),false);
  assert.equal(brandKitLabel(undefined),'Baseline voice — no brand kit set');
  const label=brandKitLabel(branded.brand);
  assert.ok(label.startsWith('On-brand: playful voice'));
  assert.ok(label.includes('tagline set'));
  assert.ok(label.includes('2 custom hashtag(s)'));
  assert.ok(label.includes('custom CTA'));
  assert.ok(label.includes('custom colors'));
});

test('drafts use brand tone openers while friendly stays byte-identical',()=>{
  const baseline=buildChannelDrafts(mission);
  assert.ok(baseline[0].caption.startsWith('Discover Northstar Coffee — '));
  assert.ok(baseline[1].caption.startsWith('Meet Northstar Coffee. '));
  for(const [tone,fbOpen,igOpen] of [['professional','Introducing ','Introducing '],['playful','Say hello to ','Fresh from '],['bold','Northstar Coffee','Northstar Coffee']]){
    const [fb,ig]=buildChannelDrafts({...mission,brand:{tone}});
    assert.ok(fb.caption.startsWith(fbOpen),tone+' fb');
    assert.ok(ig.caption.startsWith(igOpen),tone+' ig');
    assert.ok(fb.caption.includes('Increase morning customer visits'));
  }
  const [fbTagged]=buildChannelDrafts(branded);
  assert.ok(fbTagged.caption.includes('"Bold mornings daily"'));
});

test('drafts use brand hashtags and CTA style when set',()=>{
  const [fb,ig]=buildChannelDrafts(branded);
  assert.deepEqual(fb.hashtags,['#morningbrew','#coffee']);
  assert.deepEqual(ig.hashtags,['#morningbrew','#coffee']);
  assert.equal(fb.cta,'Come say hi');
  assert.equal(ig.cta,'Come say hi');
  assert.equal(fb.grounding.brand.startsWith('On-brand:'),true);
  const [fbBase]=buildChannelDrafts(mission);
  assert.deepEqual(fbBase.hashtags,[]);
  assert.equal(fbBase.cta,'Learn more about Northstar Coffee');
  assert.equal(fbBase.grounding.brand,'Baseline voice — no brand kit set');
});

test('brand copy never invents metrics on its own',()=>{
  const [fb,ig]=buildChannelDrafts(branded);
  const joined=(fb.caption+fb.cta+ig.caption+ig.cta).toLowerCase();
  for(const invented of ['%','roi','conversion','followers','reach','impressions'])assert.ok(!joined.includes(invented),invented);
});
