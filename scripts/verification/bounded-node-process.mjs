import {spawnSync} from 'node:child_process';

export class BoundedNodeProcessError extends Error{
  constructor(message,details){super(message);this.name='BoundedNodeProcessError';this.details=details;}
}

export function runBoundedNode(args,{cwd=process.cwd(),env=process.env,timeoutMs,label='node subprocess',stdio='inherit',log=console.log}={}){
  if(!Array.isArray(args)||args.some(value=>typeof value!=='string'))throw new TypeError('Bounded node process arguments must be strings.');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<100)throw new RangeError('Bounded node process timeout must be at least 100 ms.');
  const startedAt=new Date(),started=Date.now();
  log(JSON.stringify({event:'verification.subprocess.start',label,args,timeoutMs,startedAt:startedAt.toISOString()}));
  const child=spawnSync(process.execPath,args,{cwd,env,stdio,windowsHide:true,timeout:timeoutMs,killSignal:'SIGTERM'});
  const details={label,args,timeoutMs,startedAt:startedAt.toISOString(),finishedAt:new Date().toISOString(),durationMs:Date.now()-started,exitCode:child.status,signal:child.signal,errorCode:child.error?.code??null};
  const timedOut=child.error?.code==='ETIMEDOUT';
  log(JSON.stringify({event:'verification.subprocess.finish',result:timedOut?'TIMEOUT':child.status===0&&!child.error?'PASS':'FAIL',...details}));
  if(timedOut)throw new BoundedNodeProcessError(`${label} timed out after ${timeoutMs} ms.`,details);
  if(child.error)throw new BoundedNodeProcessError(`${label} failed to start or terminate: ${child.error.code??child.error.message}`,details);
  if(child.status!==0)throw new BoundedNodeProcessError(`${label} failed with exit code ${child.status}${child.signal?` and signal ${child.signal}`:''}.`,details);
  return details;
}
