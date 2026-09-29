import {mkdir,writeFile,readFile,realpath,lstat,unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {KnowledgeFailure} from './embedding-provider.js';
export class PrivateFileStore {
  private readonly root:string;
  constructor(root:string){
    this.root=resolve(root);
    if(this.root.split(/[\\/]/).some(p=>p.toLowerCase()==='public'))throw new KnowledgeFailure('INVALID_STORAGE_ROOT');
  }
  private path(key:string){if(!/^[0-9a-f-]{36}\.(pdf|txt)$/.test(key))throw new KnowledgeFailure('INVALID_STORAGE_KEY');return resolve(this.root,key);}
  async put(key:string,bytes:Uint8Array){await mkdir(this.root,{recursive:true,mode:0o700});await writeFile(this.path(key),bytes,{flag:'wx',mode:0o600});}
  async get(key:string){
    const path=this.path(key),root=await realpath(this.root),actual=await realpath(path),rel=relative(root,actual);
    if((await lstat(path)).isSymbolicLink()||rel.startsWith('..'+sep)||isAbsolute(rel))throw new KnowledgeFailure('INVALID_STORAGE_KEY');
    return readFile(path);
  }
  async discardUnpublished(key:string){await unlink(this.path(key));}
}
