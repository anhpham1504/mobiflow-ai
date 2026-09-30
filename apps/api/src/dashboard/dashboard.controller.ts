import {Controller,Get,Query,Req,Res,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiResponse,ApiTags,type SchemaObject} from '@nestjs/swagger';
import type {Response} from 'express';
import {z} from 'zod';
import {userDashboardResponseSchema,staffDashboardResponseSchema,managerDashboardResponseSchema} from '@mobiflow/contracts';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {WorkflowGuard} from '../requests/workflow.guard.js';
import {parse} from '../requests/validation.js';
import {DashboardService} from './dashboard.service.js';

const schema=(input:z.ZodType)=>z.toJSONSchema(input,{target:'openapi-3.0'}) as SchemaObject;
@ApiTags('dashboard') @ApiBearerAuth()
@ApiResponse({status:400,description:'Unknown query fields are rejected; no role, scope or pagination override.'})
@ApiResponse({status:401,description:'Authentication required'}) @ApiResponse({status:403,description:'Wrong role'})
@ApiResponse({status:429,description:'Authenticated read limit exceeded'})
@Controller('dashboard') @UseGuards(AccessGuard,RolesGuard,WorkflowGuard)
export class DashboardController{
  constructor(private readonly dashboards:DashboardService){}
  private async read(query:unknown,req:AuthenticatedRequest,res:Response){
    parse(z.object({}).strict(),query);
    res.setHeader('Cache-Control','no-store');
    return {data:await this.dashboards.snapshot(req.auth!),requestId:res.locals.requestId};
  }
  @Get('user') @Roles('USER') @ApiOperation({operationId:'getUserDashboard',summary:'All owned request aggregates, independent of list pagination'})
  @ApiResponse({status:200,schema:schema(userDashboardResponseSchema)})
  user(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return this.read(query,req,res);}
  @Get('staff') @Roles('STAFF') @ApiOperation({operationId:'getStaffDashboard',summary:'Current assignment aggregates only'})
  @ApiResponse({status:200,schema:schema(staffDashboardResponseSchema)})
  staff(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return this.read(query,req,res);}
  @Get('manager') @Roles('MANAGER') @ApiOperation({operationId:'getManagerDashboard',summary:'Single organization operational aggregates'})
  @ApiResponse({status:200,schema:schema(managerDashboardResponseSchema)})
  manager(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return this.read(query,req,res);}
}
