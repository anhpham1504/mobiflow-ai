export function chronologicalEvents<T>(oldestFirst:T[]){
  return oldestFirst.slice();
}

export function appendOlderEvents<T>(currentOldestFirst:T[],olderOldestFirst:T[]){
  return [...olderOldestFirst,...currentOldestFirst];
}

const technicalActions=new Set(['AI_ANALYSIS_QUEUED','AI_RETRY_QUEUED','KNOWLEDGE_RETRIEVED','RECOMMENDATION_QUEUED','COPILOT_ACTION_QUEUED','RESOLUTION_SUMMARY_QUEUED']);

export function splitAuditEvents<T extends {action:string}>(events:T[]){
  return events.reduce<{business:T[];technical:T[]}>((result,event)=>{
    result[technicalActions.has(event.action)?'technical':'business'].push(event);
    return result;
  },{business:[],technical:[]});
}
