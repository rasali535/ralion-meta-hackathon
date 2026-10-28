/**
 * Deterministic image-prompt builder for Creative Studio.
 * Pure and dependency-free: imported by both the browser form (editable
 * prefill) and the server (validation and fallback), so both sides share
 * one prompt-construction contract. No model calls happen here.
 */
import {resolveCreativeFormat,formatPromptPhrase} from './creative-format.js';
export const IMAGE_PROMPT_MAX_CHARS=1000;
export const IMAGE_BRIEF_MAX_CHARS=1200;

export function sanitizePromptText(value,max){
  return String(value||'')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,max);
}
export function buildImagePrompt({businessName,businessIndustry,brief,format}={}){
  const name=sanitizePromptText(businessName,100);
  const industry=sanitizePromptText(businessIndustry,100);
  const briefText=sanitizePromptText(brief,IMAGE_BRIEF_MAX_CHARS);
  if(!name)throw new Error('IMAGE_BUSINESS_REQUIRED');
  if(!briefText)throw new Error('IMAGE_BRIEF_REQUIRED');
  const parts=[
    'Commercial campaign photograph for a fictional business called '+name,
    industry?'in the '+industry+' industry':'',
    'based on this creative direction: '+briefText,
    format===undefined||format===null?'':formatPromptPhrase(resolveCreativeFormat(format)),
    'No real people, no real logos, no readable text in the image.',
  ].filter(Boolean);
  return sanitizePromptText(parts.join('. '),IMAGE_PROMPT_MAX_CHARS);
}
export function resolveCreativePrompt({prompt,fallback}={}){
  const edited=sanitizePromptText(prompt,IMAGE_PROMPT_MAX_CHARS);
  if(edited)return edited;
  const built=fallback&&typeof fallback==='object'?buildImagePrompt(fallback):'';
  if(!built)throw new Error('IMAGE_PROMPT_REQUIRED');
  return built;
}
