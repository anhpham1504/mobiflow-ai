import {Inject,Injectable,type CanActivate,type ExecutionContext} from '@nestjs/common';
import type {ApiEnvironment} from '@mobiflow/config';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {API_ENV} from '../tokens.js';
import {ApiError} from '../http.js';
@Injectable()
export class KnowledgeGuard implements CanActivate {
  private windows=new Map<string,{count:number;until:number}>();
  constructor(@Inject(API_ENV)private readonly env:ApiEnvironment){}
  canActivate(context:ExecutionContext){
    const req=context.switchToHttp().getRequest<AuthenticatedRequest>(),write=req.method==='POST',upload=write&&req.path==='/api/v1/knowledge/documents';
    if(write&&req.header('origin')&&req.header('origin')!==this.env.WEB_ORIGIN)throw new ApiError(403,'CSRF_REJECTED','Invalid origin.');
    if(write&&!req.is(upload?'multipart/form-data':'application/json'))throw new ApiError(415,'UNSUPPORTED_MEDIA','Invalid content type.');
    const now=Date.now(),key=req.auth!.id+':'+(write?'write':'read'),limit=write?5:120;
    if(this.windows.size>1000)for(const [key,value]of this.windows)if(value.until<=now)this.windows.delete(key);
    const w=this.windows.get(key);if(!w||w.until<=now)this.windows.set(key,{count:1,until:now+60000});else{if(w.count>=limit)throw new ApiError(429,'RATE_LIMITED','Too many knowledge requests.',Math.ceil((w.until-now)/1000));w.count++;}return true;
  }
}
