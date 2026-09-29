import {writeFileSync,readFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,basename,join} from 'node:path';
import {createHash} from 'node:crypto';
export function writeEvaluationFile(path,content){
  const target=process.env.M6_REGRESSION==='true'&&path.startsWith('docs/verification/evidence/')?path.replace('/M4_','/M6_REGRESSION_M4_').replace('/M5_','/M6_REGRESSION_M5_'):path;
  if(target.startsWith('docs/verification/evidence/')&&existsSync(target)){
    const previous=readFileSync(target),history=join(dirname(target),'iterations');mkdirSync(history,{recursive:true});writeFileSync(join(history,basename(target).replace(/\.json$/,'')+'-'+createHash('sha256').update(previous).digest('hex').slice(0,12)+'.json'),previous);
  }
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,content);
}
