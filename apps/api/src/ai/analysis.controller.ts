import {Body,Controller,Get,HttpCode,Param,Post,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiOperation,ApiResponse,ApiTags} from '@nestjs/swagger';
import type {ApiBodyOptions} from '@nestjs/swagger';
import type {Response} from 'express';
import {z} from 'zod';
import {versionSchema,aiJobResponseSchema,aiExplanationSchema,recommendationResponseSchema} from '@mobiflow/contracts';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {RequestStateMachineService} from '../requests/request-state-machine.service.js';
import {WorkflowGuard} from '../requests/workflow.guard.js';
import {parse,uuid} from '../requests/validation.js';
import {AnalysisQueryService} from './analysis-query.service.js';
const schema=(s:z.ZodType)=>z.toJSONSchema(s,{io:'input'}) as NonNullable<Extract<ApiBodyOptions,{schema:unknown}>['schema']>;
@ApiTags('AI intake') @ApiBearerAuth()
@ApiResponse({status:400,description:'Invalid command or ID'}) @ApiResponse({status:401,description:'Authentication required'})
@ApiResponse({status:403,description:'Wrong role or origin'}) @ApiResponse({status:404,description:'Unknown or out-of-scope resource'})
@ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload before retry'})
@ApiResponse({status:429,description:'At most 5 AI triggers per minute per actor'})
@UseGuards(AccessGuard,RolesGuard,WorkflowGuard)
@Controller()
export class AnalysisController {
  constructor(private readonly machine:RequestStateMachineService,private readonly queries:AnalysisQueryService){}
  @Post('requests/:id/ai/analyze') @Roles('USER','MANAGER') @HttpCode(202)
  @ApiOperation({summary:'Queue intake in NEW',description:'Owner or MANAGER. Requires expectedVersion. Existing active run returns the same job if version matches. SYSTEM alone processes NEW → AI_ANALYZING → TRIAGED or NEW. 202 is not AI success; offline/timeout/invalid output is a safe FAILED job. No assignment, approved category/priority or SLA changes.'})
  @ApiBody({schema:schema(versionSchema)}) @ApiResponse({status:202,schema:schema(aiJobResponseSchema)})
  async analyze(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){
    const run=await this.machine.scheduleAnalysis(uuid(id),req.auth!,parse(versionSchema,body).expectedVersion,false,res.locals.requestId);
    return {data:await this.queries.run(run.id,req.auth!),requestId:res.locals.requestId};
  }
  @Post('requests/:id/ai/retry') @Roles('USER','MANAGER') @HttpCode(202)
  @ApiOperation({summary:'Explicit retry in NEW with failed intake',description:'Preserves failed run history. Same auth/version/publication bounds as analyze; no unbounded automatic retries. Failure is reported through the job, not a synthetic result.'})
  @ApiBody({schema:schema(versionSchema)}) @ApiResponse({status:202,schema:schema(aiJobResponseSchema)})
  async retry(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){
    const run=await this.machine.scheduleAnalysis(uuid(id),req.auth!,parse(versionSchema,body).expectedVersion,true,res.locals.requestId);
    return {data:await this.queries.run(run.id,req.auth!),requestId:res.locals.requestId};
  }
  @Get('requests/:id/ai/explanation') @ApiResponse({status:200,schema:schema(aiExplanationSchema)})
  @ApiOperation({summary:'Role-projected intake explanation',description:'Owner: progress/missing facts. Current STAFF: extracted facts. MANAGER: advisory analysis and uncalibrated confidence. No raw prompts, reasoning traces or private provider origin.'})
  async explanation(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.queries.explanation(uuid(id),req.auth!),requestId:res.locals.requestId};}
  @Get('ai/runs/:id') @Roles('USER','MANAGER') @ApiResponse({status:200,schema:schema(z.union([aiJobResponseSchema,recommendationResponseSchema]))})
  @ApiOperation({summary:'Poll ANALYSIS or manager-only RECOMMENDATION run',description:'Reauthorizes current owner/manager every poll. Owner cannot inspect recommendation metadata. Terminal FAILED/CANCELED carries a safe code.'})
  async run(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.queries.run(uuid(id),req.auth!),requestId:res.locals.requestId};}
}
