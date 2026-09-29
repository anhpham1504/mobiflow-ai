import {Controller,Get,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiQuery,ApiTags} from '@nestjs/swagger';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import {ApiError} from '../http.js';
import {AnalyticsService} from './analytics.service.js';

@ApiTags('analytics') @ApiBearerAuth() @Controller('analytics') @UseGuards(AccessGuard,RolesGuard) @Roles('MANAGER')
export class AnalyticsController{
  constructor(private readonly analytics:AnalyticsService){}
  @Get() @ApiOperation({summary:'Bounded manager operational, SLA, AI and evaluation analytics'}) @ApiQuery({name:'windowDays',required:false,example:30})
  async dashboard(@Req()req:AuthenticatedRequest,@Res()res:Response,@Query('windowDays')raw?:string){const windowDays=raw===undefined?30:Number(raw);if(!Number.isInteger(windowDays)||windowDays<1||windowDays>365)throw new ApiError(400,'VALIDATION_ERROR','windowDays must be an integer from 1 to 365.');res.json({data:await this.analytics.dashboard(req.auth!,windowDays),requestId:res.locals.requestId});}
}
