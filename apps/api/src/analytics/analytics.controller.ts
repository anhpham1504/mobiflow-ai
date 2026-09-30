import {Controller,Get,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiQuery,ApiResponse,ApiTags,type SchemaObject} from '@nestjs/swagger';
import {z} from 'zod';
import {analyticsPresets,analyticsQuerySchema,analyticsResponseSchema,categories,priorities,statuses} from '@mobiflow/contracts';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import {AnalyticsService} from './analytics.service.js';
import {WorkflowGuard} from '../requests/workflow.guard.js';
import {parse} from '../requests/validation.js';

@ApiTags('analytics') @ApiBearerAuth() @Controller('analytics') @UseGuards(AccessGuard,RolesGuard,WorkflowGuard) @Roles('MANAGER')
export class AnalyticsController{
  constructor(private readonly analytics:AnalyticsService){}
  @Get() @ApiOperation({operationId:'getManagerAnalytics',summary:'Vietnam calendar activity and completion analytics',description:'MANAGER only. Choose preset (default 30d) or paired calendar from/to dates, inclusive from / exclusive to, 1–365 daily buckets. Filters use current approved request dimensions for all event groups. Explicit reviewed decisions only; completion SLA uses canonical M12 clock, excludes canceled work; zero denominator rates are null. Unknown/duplicate query fields rejected. Legacy windowDays is an exclusive deprecated preset alias. Evaluations are separate synthetic development evidence.'})
  @ApiQuery({name:'preset',required:false,enum:[...analyticsPresets]})
  @ApiQuery({name:'from',required:false,type:String,format:'date',description:'Inclusive Vietnam calendar date; requires to; cannot combine with preset/windowDays'})
  @ApiQuery({name:'to',required:false,type:String,format:'date',description:'Exclusive Vietnam calendar date; requires from; maximum 365 days'})
  @ApiQuery({name:'windowDays',required:false,type:String,deprecated:true,description:'Legacy integer-string 1–365; mutually exclusive with preset/from/to'})
  @ApiQuery({name:'priority',required:false,enum:[...priorities]}) @ApiQuery({name:'status',required:false,enum:[...statuses]})
  @ApiQuery({name:'category',required:false,enum:[...categories]}) @ApiQuery({name:'teamId',required:false,type:String,format:'uuid'})
  @ApiResponse({status:200,schema:z.toJSONSchema(analyticsResponseSchema,{target:'openapi-3.0'}) as SchemaObject})
  @ApiResponse({status:400,description:'INVALID_INPUT: invalid/missing/conflicting range, enum, UUID or unknown query'})
  @ApiResponse({status:401,description:'Active authenticated session required'}) @ApiResponse({status:403,description:'MANAGER required'})
  @ApiResponse({status:429,description:'Authenticated read limit exceeded'}) @ApiResponse({status:500,description:'Sanitized unexpected service failure'})
  async dashboard(@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response,@Query()raw:unknown){
    const query=parse(analyticsQuerySchema,raw);res.setHeader('Cache-Control','no-store');
    return {data:await this.analytics.dashboard(req.auth!,query),requestId:res.locals.requestId};
  }
}
