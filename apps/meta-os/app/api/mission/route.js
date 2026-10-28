import {NextResponse} from 'next/server';
import {missionInput,planMission,attachApproval} from '../../../lib/mission';
import {ingestWebsite} from '../../../lib/website';
import {missionLiveConfig,resolveMariMode,diagnoseWithMari,sanitizeMariErrorCode} from '../../../lib/mari';
import {checkInferenceAccess,reserveInferenceUsage,settleInferenceUsage} from '../../../lib/inference-access';
import {recordModelUsage} from '../../../lib/telemetry';
import {MODEL_IDS} from '../../../lib/meta/provider';
import {verifyAccessToken,tenantContext} from '../../../lib/auth';
import {extractTokenFromRequest,getFallbackDemoSecret} from '../../../lib/session';
// Public demo route: website ingestion is SSRF/pinned-DNS/size/time-capped
// with a kill switch. Live MARI needs explicit flags plus a presented demo
// token; every live failure falls back to the deterministic demo.
function telem(entry){try{recordModelUsage(entry);}catch{}}
export async function POST(request){
  try{
    const raw=await request.text();
    if(raw.length>8000)return NextResponse.json({error:'Request too large'},{status:413});
    const input=JSON.parse(raw);
    const fields=missionInput(input);
    let evidence=null,ingestError=null;
    if(fields.website&&process.env.WEBSITE_INGEST_ENABLED!=='false'){
      try{evidence=await ingestWebsite(fields.website,{timeoutMs:8000});}
      catch(e){ingestError=e instanceof Error?e.message:'WEBSITE_FETCH_FAILED';}
    }
    let mission={...planMission(input,{evidence,ingestError}),mode:'DETERMINISTIC_DEMO',mariReasoning:null,liveError:null};
    const presented=extractTokenFromRequest(request);
    if(input&&input.live===true){
      const cfg=missionLiveConfig();
      if(!cfg.liveRequested||!cfg.masterEnabled||!cfg.keyConfigured){
        mission.liveError='MARI_LIVE_DISABLED';
      }else{
        let mariMode=null;
        try{mariMode=resolveMariMode(input.mariMode);}
        catch{mission.liveError='MARI_MODE_INVALID';}
        if(mariMode){
          try{
            const access=checkInferenceAccess({presentedToken:presented,mode:mariMode});
            const receipt=reserveInferenceUsage({organizationId:access.organizationId,workspaceId:access.workspaceId,mode:mariMode});
            const t0=Date.now();
            let diagnosis;
            try{
              diagnosis=await diagnoseWithMari(fields,{mode:mariMode});
            }catch(e){
              let released=null;
              try{released=settleInferenceUsage(receipt,{ok:false});}catch{}
              telem({model:MODEL_IDS[mariMode],provider:'META_MODEL_API',organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'mari-diagnosis',ok:false,latencyMs:Date.now()-t0,errorCode:sanitizeMariErrorCode(e),budget:released?{outcome:'released',remainingUnits:released.remainingUnits}:null});
              throw e;
            }
            const usage=settleInferenceUsage(receipt,{requestId:diagnosis.requestId,ok:true});
            telem({model:diagnosis.model||MODEL_IDS[mariMode],provider:'META_MODEL_API',requestId:diagnosis.requestId||null,organizationId:access.organizationId,workspaceId:access.workspaceId,operation:'mari-diagnosis',ok:true,latencyMs:Date.now()-t0,usage:null,budget:{outcome:'confirmed',remainingUnits:usage.remainingUnits}});
            mission.mode='LIVE_MARI';
            mission.mariReasoning={...diagnosis,organizationId:access.organizationId,workspaceId:access.workspaceId,remainingBudget:usage.remainingUnits};
          }catch(e){
            if(e&&typeof e.httpStatus==='number'){
              mission.liveError=e.httpStatus===401?'MARI_UNAUTHORIZED':e.httpStatus===429?'MARI_QUOTA_EXCEEDED':e.httpStatus===403?'MARI_LIVE_DISABLED':'MARI_ACCESS_DENIED';
            }else{
              mission.liveError=sanitizeMariErrorCode(e);
            }
          }
        }
      }
    }
    if(input&&input.approval!==undefined&&input.approval!==null){
      if(!presented)return NextResponse.json({error:'Approval requires authentication'},{status:401});
      let approver;
      const secret=process.env.META_DEMO_TOKEN_SECRET||(String(presented).startsWith('v2.org_demo.')?getFallbackDemoSecret():undefined);
      try{
        approver=tenantContext(verifyAccessToken(presented,{staticToken:process.env.META_REASONING_ACCESS_TOKEN,hmacSecret:secret}));
      }catch{return NextResponse.json({error:'Unauthorized'},{status:401});}
      try{
        mission=attachApproval(mission,{record:input.approval,expectedOrganizationId:approver.organizationId,expectedWorkspaceId:approver.workspaceId,hmacSecret:process.env.APPROVAL_HMAC_SECRET});
      }catch(e){
        return NextResponse.json({error:String(e&&e.message||'Invalid approval').slice(0,120)},{status:400});
      }
    }
    return NextResponse.json(mission,{headers:{'cache-control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof SyntaxError?'Invalid JSON':String(e.message).slice(0,180)},{status:400})}
}
export async function GET(){return NextResponse.json({error:'Method not allowed'},{status:405})}
