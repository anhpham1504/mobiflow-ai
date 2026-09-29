import {Body,Controller,Get,HttpCode,Param,Post,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiBody,ApiResponse,ApiTags} from '@nestjs/swagger';
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
@ApiTags('M6 recommendations') @ApiBearerAuth() @Roles('MANAGER')
@UseGuards(AccessGuard,RolesGuard,WorkflowGuard)
@Controller('manager/requests')
export class RecommendationController {
  constructor(private readonly service:RecommendationService){}
  @Post(':id/ai/recommend') @HttpCode(202) @ApiBody({schema:schema(versionSchema)})
  @ApiResponse({status:202,description:'Queued advisory synthesis; no assignment or approval',schema:schema(recommendationResponseSchema)})
  @ApiResponse({status:409,description:'Stale version or not TRIAGED with validated analysis'})
  @ApiResponse({status:429,description:'Five expensive AI triggers per actor per minute'})
  async create(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){
    const requestId=uuid(id);await this.service.schedule(requestId,req.auth!,parse(versionSchema,body).expectedVersion,res.locals.requestId);
    return {data:await this.service.view(requestId,req.auth!),requestId:res.locals.requestId};
  }
  @Get(':id/ai/recommendation') @ApiResponse({status:200,schema:schema(recommendationResponseSchema)})
  async view(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.service.view(uuid(id),req.auth!),requestId:res.locals.requestId};}
}
