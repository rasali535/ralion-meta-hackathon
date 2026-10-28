import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizePromptText,buildImagePrompt,resolveCreativePrompt,IMAGE_PROMPT_MAX_CHARS,IMAGE_BRIEF_MAX_CHARS} from '../lib/image-prompt.js';

test('sanitizes prompt text deterministically',()=>{
  assert.equal(sanitizePromptText('  hello   world  ',100),'hello world');
  assert.equal(sanitizePromptText('a\u0000b\u001Fc',100),'a b c');
  assert.equal(sanitizePromptText('x'.repeat(200),100).length,100);
  assert.equal(sanitizePromptText(null,100),'');
});
test('builds grounded prompts from business and brief',()=>{
  const p=buildImagePrompt({businessName:'Northstar Coffee',businessIndustry:'Hospitality',brief:'Morning commuter cups to go'});
  assert.ok(p.includes('Northstar Coffee'));
  assert.ok(p.includes('Morning commuter cups to go'));
  assert.ok(p.includes('No real people'));
  assert.ok(p.length<=IMAGE_PROMPT_MAX_CHARS);
  const noIndustry=buildImagePrompt({businessName:'Shop',brief:'A storefront'});
  assert.ok(!noIndustry.includes('industry'));
  assert.ok(buildImagePrompt({businessName:'Shop',businessIndustry:'Retail',brief:'A storefront'}).includes('in the Retail industry'));
});
test('requires business and brief for built prompts',()=>{
  assert.throws(()=>buildImagePrompt({businessName:'',brief:'x'}),/IMAGE_BUSINESS_REQUIRED/);
  assert.throws(()=>buildImagePrompt({businessName:'Shop',brief:'  '}),/IMAGE_BRIEF_REQUIRED/);
  const capped=buildImagePrompt({businessName:'S',brief:'b'.repeat(5000)});
  assert.ok(capped.length<=IMAGE_PROMPT_MAX_CHARS);
  assert.ok(IMAGE_BRIEF_MAX_CHARS>=1000);
});
test('prefers edited prompts and falls back to built ones',()=>{
  assert.equal(resolveCreativePrompt({prompt:'  Custom shot  '}),'Custom shot');
  const built=resolveCreativePrompt({prompt:'',fallback:{businessName:'Shop',brief:'A storefront'}});
  assert.ok(built.includes('Shop'));
  assert.throws(()=>resolveCreativePrompt({prompt:'',fallback:{businessName:'',brief:''}}),/IMAGE_BUSINESS_REQUIRED/);
  assert.throws(()=>resolveCreativePrompt({}),/IMAGE_PROMPT_REQUIRED/);
});
