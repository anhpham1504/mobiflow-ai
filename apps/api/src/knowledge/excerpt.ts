const word=/[\p{L}\p{N}]/u;
const boilerplate=/^(?:Synthetic demo document - not an actual enterprise SOP|MobiFlow AI\s*\/\s*DEMO_SYNTHETIC_KNOWLEDGE\s*\/\s*\d+|(?:SOP|FAQ|SLA|ADVERSARIAL)-[A-Z0-9-]+)$/iu;
export function boundedExactSpan(value:string,maxChars:number){
  const text=value.trim();if(Array.from(text).length<=maxChars)return text;
  const points=Array.from(text),ceiling=Math.min(maxChars,points.length);let end=0;
  const minimum=Math.max(1,Math.floor(maxChars*.45));
  for(let index=ceiling;index>=minimum;index--){
    const prior=points[index-1]!,next=points[index];
    if(/[.!?;:\n]/u.test(prior)||next!==undefined&&/\s/u.test(next)){end=index;break;}
  }
  // A bounded quote must remain an exact whole-word span. If there is no safe
  // boundary, fail closed instead of producing a convincing partial token.
  if(!end)return '';
  while(end>0&&/\s/u.test(points[end-1]!))end--;
  return points.slice(0,end).join('');
}
const normalized=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function exactEvidenceSpan(excerpt:string,maxChars:number,excluded:string[]=[]){
  const forbidden=excluded.filter((value):value is string=>typeof value==='string').map(normalized).filter(Boolean);
  const lines=excerpt.split(/\r?\n/u);
  for(const raw of lines){
    const line=raw.trim();if(Array.from(line).length<20||line.startsWith('#')||boilerplate.test(line))continue;
    const key=normalized(line);if(forbidden.some(item=>key===item||item.includes(key)))continue;
    const span=boundedExactSpan(line,maxChars);if(Array.from(span).length>=20)return span;
  }
  const fallback=boundedExactSpan(excerpt,maxChars),key=normalized(fallback);
  if(Array.from(fallback).length<20||boilerplate.test(fallback.trim())||forbidden.some(item=>key===item||item.includes(key)))return '';
  return fallback;
}
export function isWholeWordSpan(container:string,span:string){
  const start=container.indexOf(span);if(start<0)return false;const end=start+span.length;
  return !(start>0&&word.test(container[start-1]!)&&word.test(span[0]!))&&!(end<container.length&&word.test(container[end]!)&&word.test(span.at(-1)!));
}
export function isTitleOnlyEvidence(quote:string,source:{title:string;section:string|null;sourceId:string}){
  const key=normalized(quote);if(!key||boilerplate.test(quote.trim()))return true;
  return [source.title,source.section??'',source.sourceId].map(normalized).filter(Boolean).some(label=>key===label||label.includes(key));
}
