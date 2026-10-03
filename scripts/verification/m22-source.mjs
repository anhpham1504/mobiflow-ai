import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function sourceInventory(){
  const paths=execFileSync('git',['ls-files','-c','-o','--exclude-standard'],{encoding:'utf8',windowsHide:true}).split('\n').filter(p=>/^(apps\/|packages\/|scripts\/|playwright\.m22|package(?:-lock)?\.json|eslint\.config)/.test(p));
  const files=[...new Set(paths)].sort().map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
  return {fingerprint:createHash('sha256').update(JSON.stringify(files)).digest('hex'),files};
}
