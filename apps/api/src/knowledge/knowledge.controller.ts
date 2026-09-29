import {Body,Controller,Get,HttpCode,Param,Post,Query,Req,Res,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {ApiBearerAuth,ApiBody,ApiConsumes,ApiOperation,ApiResponse,ApiTags} from '@nestjs/swagger';
import type {ApiBodyOptions} from '@nestjs/swagger';
import type {Response} from 'express';
import {z} from 'zod';
import {knowledgeDocumentResponseSchema,knowledgeListSchema,sourceResponseSchema,versionSchema,reasonSchema} from '@mobiflow/contracts';
import {AccessGuard,Roles,RolesGuard} from '../auth/auth.guards.js';
import type {AuthenticatedRequest} from '../auth/auth.types.js';
import {parse,uuid} from '../requests/validation.js';
import {DocumentService} from './document.service.js';
import {SourceService} from './source.service.js';
import {KnowledgeGuard} from './knowledge.guard.js';
import {MAX_FILE_BYTES,type UploadFile} from './parser.js';
const schema=(s:z.ZodType)=>z.toJSONSchema(s,{io:'input'}) as NonNullable<Extract<ApiBodyOptions,{schema:unknown}>['schema']>;
@ApiTags('Knowledge') @ApiBearerAuth() @Roles('MANAGER','STAFF') @UseGuards(AccessGuard,RolesGuard,KnowledgeGuard)
@ApiResponse({status:401,description:'Authentication required'}) @ApiResponse({status:403,description:'Wrong role/origin'}) @ApiResponse({status:404,description:'Unknown or unavailable source'}) @ApiResponse({status:409,description:'Duplicate hash, active job or stale document version'}) @ApiResponse({status:413,description:'File over 10 MiB'}) @ApiResponse({status:429,description:'At most five upload/reindex/disable commands per minute'})
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly documents:DocumentService,private readonly sources:SourceService){}
  @Post('documents') @Roles('MANAGER') @HttpCode(202) @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file',{limits:{fileSize:MAX_FILE_BYTES,files:1,fields:1,fieldSize:1000,parts:2},preservePath:true}))
  @ApiBody({schema:{type:'object',required:['title','file'],additionalProperties:false,properties:{title:{type:'string',minLength:1,maxLength:200},file:{type:'string',format:'binary'}}}}) @ApiResponse({status:202,schema:schema(knowledgeDocumentResponseSchema)})
  @ApiOperation({summary:'Upload synthetic PDF/TXT; durable indexing job, not immediate READY'})
  async upload(@Body() body:unknown,@UploadedFile() file:UploadFile|undefined,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.documents.upload(req.auth!,body,file,res.locals.requestId),requestId:res.locals.requestId};}
  @Get('documents') @ApiResponse({status:200,schema:schema(knowledgeListSchema)})
  async list(@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {...await this.documents.list(req.auth!,query),requestId:res.locals.requestId};}
  @Get('documents/:id') @ApiResponse({status:200,schema:schema(knowledgeDocumentResponseSchema)})
  async detail(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.documents.detail(uuid(id),req.auth!),requestId:res.locals.requestId};}
  @Get('documents/:id/content') @ApiOperation({summary:'Authorized original download; never a client-selected path'})
  async content(@Param('id') id:string,@Req() req:AuthenticatedRequest,@Res() res:Response){const result=await this.documents.content(uuid(id),req.auth!);res.setHeader('Content-Type',result.mimeType);res.setHeader('Content-Disposition',"attachment; filename=\"document\"; filename*=UTF-8''"+encodeURIComponent(result.name));res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");res.send(result.bytes);}
  @Get('sources/:id') @ApiResponse({status:200,schema:schema(sourceResponseSchema)})
  async source(@Param('id') id:string,@Query() query:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){const q=parse(z.object({historical:z.enum(['true','false']).optional()}).strict(),query);return {data:await this.sources.get(id,req.auth!,q.historical==='true'),requestId:res.locals.requestId};}
  @Post('documents/:id/reindex') @Roles('MANAGER') @HttpCode(202) @ApiBody({schema:schema(versionSchema)}) @ApiResponse({status:202,schema:schema(knowledgeDocumentResponseSchema)})
  async reindex(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){return {data:await this.documents.command(uuid(id),req.auth!,parse(versionSchema,body).expectedVersion,'reindex',res.locals.requestId),requestId:res.locals.requestId};}
  @Post('documents/:id/disable') @Roles('MANAGER') @HttpCode(200) @ApiBody({schema:schema(reasonSchema)}) @ApiResponse({status:200,schema:schema(knowledgeDocumentResponseSchema)})
  async disable(@Param('id') id:string,@Body() body:unknown,@Req() req:AuthenticatedRequest,@Res({passthrough:true}) res:Response){const c=parse(reasonSchema,body);return {data:await this.documents.command(uuid(id),req.auth!,c.expectedVersion,'disable',res.locals.requestId,c.reason),requestId:res.locals.requestId};}
}
