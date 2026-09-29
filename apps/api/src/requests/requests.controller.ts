import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ApiBodyOptions } from '@nestjs/swagger';
import { z } from 'zod';
import * as contracts from '@mobiflow/contracts';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessGuard, Roles, RolesGuard } from '../auth/auth.guards.js';
import { RequestStateMachineService, type Command } from './request-state-machine.service.js';
import { RequestQueryService } from './request-query.service.js';
import { WorkflowGuard } from './workflow.guard.js';
import { parse, uuid } from './validation.js';
const schema=(s:z.ZodType)=>z.toJSONSchema(s,{io:'input'}) as NonNullable<Extract<ApiBodyOptions,{schema:unknown}>['schema']>;
const mutationDescription='Authenticated role and current ownership required. expectedVersion must match the current request. 409 STALE_VERSION/INVALID_STATE makes no business changes.';
@ApiTags('Request workflow')
@ApiBearerAuth()
@UseGuards(AccessGuard,RolesGuard,WorkflowGuard)
@Controller()
export class RequestsController {
  constructor(private readonly machine:RequestStateMachineService,private readonly queries:RequestQueryService) {}
  @Post('requests') @Roles('USER') @HttpCode(201)
  @ApiBody({schema:schema(contracts.createRequestSchema)}) @ApiResponse({status:201,schema:schema(contracts.requestResponseSchema)})
  async create(@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const id=await this.machine.create(req.auth!,parse(contracts.createRequestSchema,body),res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Get('requests/mine') @Roles('USER') @ApiResponse({status:200,schema:schema(contracts.requestListSchema)})
  @ApiQuery({name:'limit',required:false,type:Number}) @ApiQuery({name:'cursor',required:false,type:String})
  @ApiQuery({name:'status',required:false,enum:contracts.statuses}) @ApiQuery({name:'priority',required:false,enum:contracts.priorities})
  @ApiQuery({name:'category',required:false,enum:contracts.categories})
  async mine(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.list(req.auth!,query,'mine'),requestId:res.locals.requestId};
  }

  @Get('staff/work-queue') @Roles('STAFF') @ApiResponse({status:200,schema:schema(contracts.requestListSchema)})
  @ApiQuery({name:'limit',required:false,type:Number}) @ApiQuery({name:'cursor',required:false,type:String})
  @ApiQuery({name:'status',required:false,enum:contracts.statuses}) @ApiQuery({name:'priority',required:false,enum:contracts.priorities})
  @ApiQuery({name:'category',required:false,enum:contracts.categories})
  async queue(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.list(req.auth!,query,'queue'),requestId:res.locals.requestId};
  }

  @Get('manager/requests') @Roles('MANAGER') @ApiResponse({status:200,schema:schema(contracts.requestListSchema)})
  @ApiQuery({name:'limit',required:false,type:Number}) @ApiQuery({name:'cursor',required:false,type:String})
  @ApiQuery({name:'status',required:false,enum:contracts.statuses}) @ApiQuery({name:'priority',required:false,enum:contracts.priorities})
  @ApiQuery({name:'category',required:false,enum:contracts.categories})
  async list(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.list(req.auth!,query,'manager'),requestId:res.locals.requestId};
  }

  @Get('manager/approvals') @Roles('MANAGER') @ApiResponse({status:200,schema:schema(contracts.requestListSchema)})
  @ApiQuery({name:'limit',required:false,type:Number}) @ApiQuery({name:'cursor',required:false,type:String})
  @ApiQuery({name:'status',required:false,enum:contracts.statuses}) @ApiQuery({name:'priority',required:false,enum:contracts.priorities})
  @ApiQuery({name:'category',required:false,enum:contracts.categories})
  async approvals(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.list(req.auth!,query,'approvals'),requestId:res.locals.requestId};
  }

  @Get('requests/:id') @ApiParam({name:'id',format:'uuid'}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  async detail(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {data:await this.queries.detail(uuid(id),req.auth!),requestId:res.locals.requestId};
  }
  @Get('manager/approvals/:id') @Roles('MANAGER') @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  async review(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return this.detail(id,req,res);
  }
  @Get('requests/:id/history') @ApiResponse({status:200,schema:schema(contracts.historyResponseSchema)})
  async history(@Param('id') id:string,@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.history(uuid(id),req.auth!,query),requestId:res.locals.requestId};
  }

  @Post('requests/:id/messages')  @HttpCode(201)
  @ApiOperation({summary:'MESSAGE',description:mutationDescription})
  @ApiBody({schema:schema(contracts.messageSchema)}) @ApiResponse({status:201,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async message(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.messageSchema,body)};
    const result=await this.machine.transition(uuid(id),'MESSAGE',req.auth!,command,res.locals.requestId);
    return {data:{...await this.queries.detail(id,req.auth!),message:result.message},requestId:res.locals.requestId};
  }

  @Post('requests/:id/provide-info') @Roles('USER') @HttpCode(200)
  @ApiOperation({summary:'USER_PROVIDE_INFO',description:mutationDescription})
  @ApiBody({schema:schema(contracts.messageSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async provideInfo(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.messageSchema,body)};
    await this.machine.transition(uuid(id),'USER_PROVIDE_INFO',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/confirm') @Roles('USER') @HttpCode(200)
  @ApiOperation({summary:'USER_CONFIRM',description:mutationDescription})
  @ApiBody({schema:schema(contracts.versionSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async confirm(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.versionSchema,body)};
    await this.machine.transition(uuid(id),'USER_CONFIRM',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }
  @Post('requests/:id/feedback') @Roles('USER') @HttpCode(201)
  @ApiOperation({summary:'FEEDBACK',description:'Owner-only immutable feedback after CLOSED; expectedVersion required.'})
  @ApiBody({schema:schema(contracts.feedbackSchema)}) @ApiResponse({status:201,schema:schema(contracts.requestResponseSchema)})
  async feedback(@Param('id')id:string,@Body()body:unknown,@Req()req:AuthenticatedRequest,@Res({passthrough:true})res:Response){const command:Command={...parse(contracts.feedbackSchema,body)};await this.machine.transition(uuid(id),'FEEDBACK',req.auth!,command,res.locals.requestId);return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};}

  @Post('requests/:id/reopen') @Roles('USER') @HttpCode(200)
  @ApiOperation({summary:'USER_REOPEN',description:mutationDescription})
  @ApiBody({schema:schema(contracts.reasonSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async reopen(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.reasonSchema,body)};
    await this.machine.transition(uuid(id),'USER_REOPEN',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/cancel') @Roles('USER','MANAGER') @HttpCode(200)
  @ApiOperation({summary:'CANCEL',description:mutationDescription})
  @ApiBody({schema:schema(contracts.reasonSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async cancel(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.reasonSchema,body)};
    await this.machine.transition(uuid(id),'CANCEL',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/start') @Roles('STAFF') @HttpCode(200)
  @ApiOperation({summary:'START_WORK',description:mutationDescription})
  @ApiBody({schema:schema(contracts.versionSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async start(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.versionSchema,body)};
    await this.machine.transition(uuid(id),'START_WORK',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/request-info') @Roles('STAFF') @HttpCode(200)
  @ApiOperation({summary:'REQUEST_USER_INFO',description:mutationDescription})
  @ApiBody({schema:schema(contracts.messageSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async requestInfo(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.messageSchema,body)};
    await this.machine.transition(uuid(id),'REQUEST_USER_INFO',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/resolve') @Roles('STAFF') @HttpCode(200)
  @ApiOperation({summary:'RESOLVE',description:mutationDescription})
  @ApiBody({schema:schema(contracts.resolveSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async resolve(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.resolveSchema,body)};
    await this.machine.transition(uuid(id),'RESOLVE',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/requests/:id/triage') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'MANUAL_TRIAGE',description:mutationDescription})
  @ApiBody({schema:schema(contracts.triageSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async triage(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.triageSchema,body)};
    await this.machine.transition(uuid(id),'MANUAL_TRIAGE',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/requests/:id/submit-approval') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'SUBMIT_FOR_APPROVAL',description:mutationDescription})
  @ApiBody({schema:schema(contracts.submitSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async submit(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.submitSchema,body)};
    await this.machine.transition(uuid(id),'SUBMIT_FOR_APPROVAL',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/approvals/:id/accept') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'APPROVE_AND_ASSIGN',description:mutationDescription})
  @ApiBody({schema:schema(contracts.acceptSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async accept(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.acceptSchema,body)};
    await this.machine.transition(uuid(id),'APPROVE_AND_ASSIGN',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/approvals/:id/modify') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'APPROVE_AND_ASSIGN',description:mutationDescription})
  @ApiBody({schema:schema(contracts.modifySchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async modify(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.modifySchema,body)};
    await this.machine.transition(uuid(id),'APPROVE_AND_ASSIGN',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/approvals/:id/reject') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'REJECT_APPROVAL',description:mutationDescription})
  @ApiBody({schema:schema(contracts.rejectSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async reject(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.rejectSchema,body)};
    await this.machine.transition(uuid(id),'REJECT_APPROVAL',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/requests/:id/reassign') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'REASSIGN',description:mutationDescription})
  @ApiBody({schema:schema(contracts.reassignSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async reassign(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.reassignSchema,body)};
    await this.machine.transition(uuid(id),'REASSIGN',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('manager/requests/:id/priority') @Roles('MANAGER') @HttpCode(200)
  @ApiOperation({summary:'PRIORITY',description:mutationDescription})
  @ApiBody({schema:schema(contracts.prioritySchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async priority(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.prioritySchema,body)};
    await this.machine.transition(uuid(id),'PRIORITY',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Post('requests/:id/checklist') @Roles('STAFF') @HttpCode(200)
  @ApiOperation({summary:'CHECKLIST_ADD',description:mutationDescription})
  @ApiBody({schema:schema(contracts.checklistSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async checklistAdd(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.checklistSchema,body)};
    await this.machine.transition(uuid(id),'CHECKLIST_ADD',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Patch('requests/:id/checklist/:itemId') @Roles('STAFF') @HttpCode(200)
  @ApiOperation({summary:'CHECKLIST_EDIT',description:mutationDescription})
  @ApiBody({schema:schema(contracts.checklistItemSchema)}) @ApiResponse({status:200,schema:schema(contracts.requestResponseSchema)})
  @ApiResponse({status:409,description:'STALE_VERSION or INVALID_STATE; reload and review.'})
  @ApiResponse({status:403,description:'Wrong role'}) @ApiResponse({status:404,description:'Unknown or out-of-scope request'})
  async checklistEdit(@Param('id') id:string,@Param('itemId') itemId:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    const command:Command={...parse(contracts.checklistItemSchema,body),itemId:uuid(itemId)};
    await this.machine.transition(uuid(id),'CHECKLIST_EDIT',req.auth!,command,res.locals.requestId);
    return {data:await this.queries.detail(id,req.auth!),requestId:res.locals.requestId};
  }

  @Get('notifications') @ApiResponse({status:200,schema:schema(contracts.notificationListSchema)})
  async notifications(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {...await this.queries.notifications(req.auth!,query),requestId:res.locals.requestId};
  }
  @Patch('notifications/:id/read') @ApiBody({schema:schema(contracts.readNotificationSchema)})
  async readNotification(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response) {
    return {data:await this.queries.readNotification(uuid(id),req.auth!,parse(contracts.readNotificationSchema,body).read),requestId:res.locals.requestId};
  }
}

