/**
 * Filesystem-backed creative asset store for the hackathon.
 * Server-only. Layout: <root>/<org>/<workspace>/<assetId>.bin + .json.
 * Tenant segments are strictly validated and asset IDs are server-minted,
 * so crafted values cannot escape the root. Synchronous I/O is acceptable
 * for hackathon scale; a durable store needs separate approval.
 */
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';

const SEGMENT_RE=/^[a-z0-9][a-z0-9-_]{0,63}$/i;
const ASSET_RE=/^img_[0-9a-f]{16}$/;

export function mintAssetId(){return 'img_'+randomBytes(8).toString('hex');}
export function sha256Hex(bytes){return createHash('sha256').update(bytes).digest('hex');}
function assertSegment(v,code){const s=String(v||'');if(!SEGMENT_RE.test(s))throw new Error(code);return s;}
function assertRoot(root){
  const s=String(root||'').trim();
  if(!s)throw new Error('CREATIVE_STORAGE_INVALID');
  const r=resolve(s);
  if(!r||r===sep)throw new Error('CREATIVE_STORAGE_INVALID');
  return r;
}
export function assetPaths(root,organizationId,workspaceId,assetId){
  const base=assertRoot(root);
  const org=assertSegment(organizationId,'CREATIVE_ORG_INVALID');
  const ws=assertSegment(workspaceId,'CREATIVE_WORKSPACE_INVALID');
  const id=String(assetId||'');
  if(!ASSET_RE.test(id))throw new Error('CREATIVE_ASSET_INVALID');
  const dir=join(base,org,ws);
  const bin=resolve(dir,id+'.bin');
  const meta=resolve(dir,id+'.json');
  if(!bin.startsWith(base+sep)||!meta.startsWith(base+sep))throw new Error('CREATIVE_PATH_ESCAPE');
  return {dir,bin,meta};
}
export function saveCreativeAsset(root,{organizationId,workspaceId,metadata,bytes}){
  if(!metadata||typeof metadata!=='object')throw new Error('CREATIVE_METADATA_INVALID');
  const buf=Buffer.from(bytes||[]);
  if(buf.length<1)throw new Error('CREATIVE_BYTES_INVALID');
  const id=String(metadata.assetId||'');
  const {dir,bin,meta}=assetPaths(root,organizationId,workspaceId,id);
  if(String(metadata.organizationId)!==String(organizationId)||String(metadata.workspaceId)!==String(workspaceId))throw new Error('CREATIVE_TENANT_MISMATCH');
  mkdirSync(dir,{recursive:true});
  writeFileSync(bin,buf);
  writeFileSync(meta,JSON.stringify(metadata));
  return {assetId:id,bytes:buf.length};
}
export function loadCreativeAsset(root,{organizationId,workspaceId,assetId}){
  const {bin,meta}=assetPaths(root,organizationId,workspaceId,assetId);
  let metadata;
  try{metadata=JSON.parse(readFileSync(meta,'utf8'));}
  catch{throw new Error('CREATIVE_ASSET_MISSING');}
  let bytes;
  try{bytes=readFileSync(bin);}
  catch{throw new Error('CREATIVE_ASSET_MISSING');}
  if(!metadata||typeof metadata!=='object')throw new Error('CREATIVE_ASSET_MISSING');
  if(String(metadata.organizationId)!==String(organizationId)||String(metadata.workspaceId)!==String(workspaceId)||String(metadata.assetId)!==String(assetId))throw new Error('CREATIVE_TENANT_MISMATCH');
  return {metadata,bytes};
}
export function listCreativeAssets(root,{organizationId,workspaceId}){
  const base=assertRoot(root);
  const org=assertSegment(organizationId,'CREATIVE_ORG_INVALID');
  const ws=assertSegment(workspaceId,'CREATIVE_WORKSPACE_INVALID');
  const dir=join(base,org,ws);
  let names;
  try{names=readdirSync(dir);}catch{return [];}
  const out=[];
  for(const n of names){
    if(!n.endsWith('.json'))continue;
    const id=n.slice(0,-5);
    if(!ASSET_RE.test(id))continue;
    try{
      const m=JSON.parse(readFileSync(join(dir,n),'utf8'));
      if(m&&typeof m==='object'&&String(m.organizationId)===org&&String(m.workspaceId)===ws&&String(m.assetId)===id)out.push(m);
    }catch{}
  }
  out.sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  return out;
}
