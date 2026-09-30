import {Body,Controller,Get,HttpCode,Param,Post,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiOperation,ApiParam,ApiQuery,ApiResponse,ApiTags} from '@nestjs/swagger';
import type {ApiBodyOptions} from '@nestjs/swagger';
import type {Response} from 'express';
import {z} from 'zod';
import {versionSchema,recommendationResponseSchema} from '@mobiflow/contracts';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {WorkflowGuard} from '../requests/workflow.guard.js';
import {parse,uuid} from '../requests/validation.js';
import {RecommendationService} from './recommendation.service.js';
const schema=(s:z.ZodType)=>z.toJSONSchema(s) as NonNullable<Extract<ApiBodyOptions,{schema:unknown}>['schema']>;
const errorSchema=schema(z.object({error:z.object({code:z.string(),message:z.string()}).strict(),requestId:z.uuid()}).strict());
const recommendationQuery=z.object({aiRunId:z.uuid().optional()}).strict();
@ApiTags('Recommendations') @ApiBearerAuth() @Roles('MANAGER')
@UseGuards(AccessGuard,RolesGuard,WorkflowGuard)
@Controller('manager/requests')
export class RecommendationController {
  constructor(private readonly service:RecommendationService){}
  @Post(':id/ai/recommend') @HttpCode(202) @ApiBody({schema:schema(versionSchema)})
  @ApiOperation({operationId:'queueManagerRecommendation',summary:'Queue Recommendation V2',description:'Manager-only bounded advisory synthesis for a TRIAGED request with validated analysis. Generation does not apply any business decision. The server selects the schema version; clients cannot choose a legacy execution path.'})
  @ApiParam({name:'id',type:String,format:'uuid'})
  @ApiResponse({status:202,description:'Queued advisory synthesis; no request, assignment or SLA mutation',schema:schema(recommendationResponseSchema)})
  @ApiResponse({status:400,description:'INVALID_INPUT; strict expectedVersion payload and UUID',schema:errorSchema})
  @ApiResponse({status:401,description:'UNAUTHORIZED; inactive, expired or revoked session',schema:errorSchema})
  @ApiResponse({status:403,description:'FORBIDDEN; USER/STAFF cannot generate recommendations',schema:errorSchema})
  @ApiResponse({status:404,description:'NOT_FOUND',schema:errorSchema})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload current request',schema:errorSchema})
  @ApiResponse({status:429,description:'RATE_LIMITED; five expensive AI triggers per actor per minute',schema:errorSchema})
  @ApiResponse({status:500,description:'Sanitized INTERNAL_ERROR',schema:errorSchema})
  async create(@Param('id') id:string,@Body() body:unknown,@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){
    res.setHeader('Cache-Control','no-store');
    parse(z.object({}).strict(),query);
    const requestId=uuid(id);await this.service.schedule(requestId,req.auth!,parse(versionSchema,body).expectedVersion,res.locals.requestId);
    return {data:await this.service.view(requestId,req.auth!),requestId:res.locals.requestId};
  }
  @Get(':id/ai/recommendation')
  @ApiOperation({operationId:'getManagerRecommendation',summary:'Read a recommendation',description:'Latest by default, or an immutable historical run scoped to this request via aiRunId. Validated V1/V2 payload, generation/schema metadata, separate human review provenance and current stale flags. Missing latest recommendation returns data=null; an absent requested run returns404. Never returns provider prompts, reasoning fields or unchecked model output.'})
  @ApiParam({name:'id',type:String,format:'uuid'})
  @ApiQuery({name:'aiRunId',required:false,type:String,format:'uuid',description:'Read a historical recommendation run belonging to this request. Unknown or duplicate filters fail400.'})
  @ApiResponse({status:200,schema:schema(recommendationResponseSchema)})
  @ApiResponse({status:400,description:'INVALID_INPUT; UUID required',schema:errorSchema})
  @ApiResponse({status:401,description:'UNAUTHORIZED',schema:errorSchema})
  @ApiResponse({status:403,description:'FORBIDDEN; MANAGER only',schema:errorSchema})
  @ApiResponse({status:404,description:'NOT_FOUND',schema:errorSchema})
  @ApiResponse({status:429,description:'RATE_LIMITED; authenticated read budget',schema:errorSchema})
  @ApiResponse({status:500,description:'AI_INVALID_STORED_OUTPUT or sanitized INTERNAL_ERROR; invalid stored payload is never returned',schema:errorSchema})
  async view(@Param('id') id:string,@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){res.setHeader('Cache-Control','no-store');return {data:await this.service.view(uuid(id),req.auth!,parse(recommendationQuery,query).aiRunId),requestId:res.locals.requestId};}
}
