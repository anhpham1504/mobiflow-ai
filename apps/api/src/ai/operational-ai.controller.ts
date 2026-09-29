import {Body,Controller,Get,HttpCode,Param,Post,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiOperation,ApiResponse,ApiTags} from '@nestjs/swagger';
import type {ApiBodyOptions} from '@nestjs/swagger';
import type {Response} from 'express';
import {z} from 'zod';
import {copilotActionSchema,operationalJobResponseSchema,versionSchema} from '@mobiflow/contracts';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {WorkflowGuard} from '../requests/workflow.guard.js';
import {parse,uuid} from '../requests/validation.js';
import {OperationalAiService} from './operational-ai.service.js';
const schema=(s:z.ZodType)=>z.toJSONSchema(s,{io:'input'}) as NonNullable<Extract<ApiBodyOptions,{schema:unknown}>['schema']>;
const retrySchema=versionSchema.extend({resolutionId:z.uuid()});
@ApiTags('M8 operational AI') @ApiBearerAuth() @UseGuards(AccessGuard,RolesGuard,WorkflowGuard) @Controller()
export class OperationalAiController{
  constructor(private readonly service:OperationalAiService){}
  @Post('requests/:id/ai/copilot/action') @Roles('STAFF') @HttpCode(202)
  @ApiOperation({summary:'Queue one of six request-scoped, read-only Copilot actions'}) @ApiBody({schema:schema(copilotActionSchema)}) @ApiResponse({status:202,schema:schema(operationalJobResponseSchema)})
  async action(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){const run=await this.service.scheduleCopilot(uuid(id),req.auth!,parse(copilotActionSchema,body),res.locals.requestId);return {data:await this.service.view(run.id,req.auth!),requestId:res.locals.requestId};}
  @Get('ai/operational-runs/:id') @Roles('STAFF','MANAGER','USER') @ApiResponse({status:200,schema:schema(operationalJobResponseSchema)})
  async run(@Param('id')id:string,@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){return {data:await this.service.view(uuid(id),req.auth!),requestId:res.locals.requestId};}
  @Post('requests/:id/ai/resolution-summary/retry') @Roles('STAFF','MANAGER') @HttpCode(202)
  @ApiBody({schema:schema(retrySchema)}) @ApiResponse({status:202,schema:schema(operationalJobResponseSchema)})
  async retry(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){const input=parse(retrySchema,body);const run=await this.service.retrySummary(uuid(id),input.resolutionId,input.expectedVersion,req.auth!);return {data:await this.service.view(run.id,req.auth!),requestId:res.locals.requestId};}
}
