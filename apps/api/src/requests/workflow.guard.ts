import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { ApiEnvironment } from '@mobiflow/config';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { API_ENV } from '../tokens.js';
import { ApiError } from '../http.js';
@Injectable()
export class WorkflowGuard implements CanActivate {
  private readonly windows=new Map<string,{count:number;until:number}>();
  constructor(@Inject(API_ENV) private readonly env:ApiEnvironment) {}
  canActivate(context:ExecutionContext) {
    const req=context.switchToHttp().getRequest<AuthenticatedRequest>(),write=!['GET','HEAD','OPTIONS'].includes(req.method);
    if(write && req.header('origin') && req.header('origin')!==this.env.WEB_ORIGIN) throw new ApiError(403,'CSRF_REJECTED','The request origin is invalid.');
    if(write && !req.is('application/json')) throw new ApiError(415,'UNSUPPORTED_MEDIA','JSON is required.');
    const now=Date.now(),key=req.auth!.id+':'+(write?'write':'read'),limit=write?60:120;
    if(this.windows.size>1000) for(const [k,v] of this.windows) if(v.until<=now) this.windows.delete(k);
    const window=this.windows.get(key);
    if(!window||window.until<=now) this.windows.set(key,{count:1,until:now+60000});
    else {if(window.count>=limit) throw new ApiError(429,'RATE_LIMITED','Too many requests.',Math.ceil((window.until-now)/1000));window.count++;}
    return true;
  }
}

