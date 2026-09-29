import {toolSchemas,type ToolName,type ToolOutput} from '@mobiflow/contracts';
export class ToolFailure extends Error {
  constructor(readonly code:string){super(code);}
}
export interface ToolTrace {ordinal:number;toolName:string;toolVersion:string;startedAt:Date;finishedAt:Date;latencyMs:number;status:'SUCCEEDED'|'FAILED';errorCode:string|null;resultCount:number;resultIds:string[]}
export const toolInventory=Object.entries(toolSchemas).map(([name,s])=>({name,version:'v1',sideEffect:'READ_ONLY',timeoutMs:s.timeout,maxResults:s.max,maxBytes:32768}));
export class ToolRegistry {
  private calls=0;
  private readonly counts=new Map<string,number>();
  constructor(private readonly authorize:()=>Promise<void>,private readonly execute:(name:ToolName,input:unknown,signal:AbortSignal)=>Promise<unknown>,private readonly record:(trace:ToolTrace)=>Promise<void>,private readonly signal:AbortSignal){}
  async call<N extends ToolName>(name:N,input:unknown):Promise<ToolOutput<N>> {
    const startedAt=new Date(),start=performance.now(),ordinal=++this.calls;
    let result:unknown,errorCode:string|null=null;
    try{
      if(!Object.hasOwn(toolSchemas,name))throw new ToolFailure('UNKNOWN_TOOL');
      if(ordinal>8)throw new ToolFailure('TOOL_BUDGET_EXCEEDED');
      const count=(this.counts.get(name)??0)+1;this.counts.set(name,count);
      if(count>(name==='getSlaPolicy'?3:1))throw new ToolFailure('DUPLICATE_CALL');
      const definition=toolSchemas[name],parsed=definition.input.safeParse(input);
      if(!parsed.success)throw new ToolFailure('INVALID_INPUT');
      const signal=AbortSignal.any([this.signal,AbortSignal.timeout(definition.timeout)]);
      if(signal.aborted)throw new ToolFailure('TIMEOUT');
      let rejectAbort:()=>void=()=>{};
      const aborted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(new ToolFailure('TIMEOUT'));signal.addEventListener('abort',rejectAbort,{once:true});});
      try{
        result=await Promise.race([(async()=>{await this.authorize();const output=await this.execute(name,parsed.data,signal);await this.authorize();return output;})(),aborted]);
      }finally{signal.removeEventListener('abort',rejectAbort);}
      const output=definition.output.safeParse(result);
      if(!output.success||Buffer.byteLength(JSON.stringify(result))>32768)throw new ToolFailure('INVALID_OUTPUT');
      result=output.data;return result as ToolOutput<N>;
    }catch(error){errorCode=error instanceof ToolFailure?error.code:'UNAVAILABLE';throw new ToolFailure(errorCode);}
    finally{
      const collections=result&&typeof result==='object'?Object.entries(result).flatMap(([key,value])=>Array.isArray(value)?value:key==='policy'&&value?[value]:[]):[];
      const resultIds=errorCode?[]:collections.flatMap((r:Record<string,unknown>)=>{const id=r.sourceId??r.requestId??r.staffId??r.id;return typeof id==='string'?[id]:[];});
      // Persist only registered names or a fixed sentinel; never log malicious input.
      await this.record({ordinal,toolName:Object.hasOwn(toolSchemas,name)?name:'UNKNOWN_TOOL',toolVersion:'v1',startedAt,finishedAt:new Date(),latencyMs:Math.round(performance.now()-start),status:errorCode?'FAILED':'SUCCEEDED',errorCode,resultCount:errorCode?0:collections.length,resultIds});
    }
  }
}
