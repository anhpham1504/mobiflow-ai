import {z} from 'zod';
// Backend authorization metadata is never model context or public evidence.
const authorizationSchema=z.object({initiatingSessionId:z.uuid()}).strict();
export function recommendationSnapshot(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return {evidence:value,authorization:null};
  const {_authorization,...evidence}=value as Record<string,unknown>;
  const auth=authorizationSchema.safeParse(_authorization);
  return {evidence,authorization:auth.success?auth.data:null};
}
