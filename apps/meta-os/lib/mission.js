/** Portable mission planning, deterministic demo adapter only. No external action or generated results. */
export function planMission(input){
 const name=String(input?.name||'').trim().slice(0,100);
 const industry=String(input?.industry||'').trim().slice(0,100);
 const objective=String(input?.objective||'').trim().slice(0,300);
 const audience=String(input?.audience||'Potential customers').trim().slice(0,200);
 const facts=String(input?.facts||'').trim().slice(0,2000);
 const website=String(input?.website||'').trim().slice(0,500);
 if(!name||!industry||!objective)throw Error('Business name, industry and objective are required');
 if(website){let u;try{u=new URL(website)}catch{throw Error('Enter a valid HTTPS business website')}if(u.protocol!=='https:'||u.username||u.password)throw Error('Enter a valid HTTPS business website')}
 const missionId=crypto.randomUUID();
 const base={name,industry,objective,audience,facts,website};
 return {schemaVersion:'1.0',missionId,createdAt:new Date().toISOString(),status:'AWAITING_HUMAN_REVIEW',provider:'DETERMINISTIC_DEMO_NOT_META_AI',business:base,
 evidence:{websiteRetrieved:false,websiteStatus:website?'REFERENCE_ONLY_NOT_CRAWLED':'NOT_PROVIDED',userFacts:facts?'USER_SUPPLIED_UNVERIFIED':'NOT_PROVIDED',campaignMetrics:'NOT_AVAILABLE'},
 growth:{opportunity:'Test a focused campaign for '+audience,reason:'The supplied goal suggests testing customer acquisition; this is a hypothesis, not an observed business diagnosis.',objective,measurement:'Track qualified enquiries or attributed visits after authorized execution',results:null},
 creative:{brief:'Design an on-brand concept for '+name+' directed at '+audience+'. Verify actual brand assets before production.',assets:[],generated:false},
 social:[{channel:'Facebook',copy:'Discover '+name+' — '+objective+'.',status:'DRAFT_ONLY'},{channel:'Instagram',copy:'Meet '+name+'. Explore what makes us different.',status:'DRAFT_ONLY'}],
 approval:{status:'NOT_REQUESTED',actor:null},
 execution:{status:'NOT_CONNECTED',receipt:null},
 feedback:{status:'AWAITING_REAL_DATA',metrics:[]}
 };
}
