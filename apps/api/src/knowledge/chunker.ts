import {createHash} from 'node:crypto';
import {KnowledgeFailure} from './embedding-provider.js';
export const chunkerVersion='word-boundary-window.v2';
export const parserVersion='pdfjs-6.3.289-txt-utf8.v1';
export const chunkSize=1200,chunkOverlap=200;
export const hash=(text:string|Uint8Array)=>createHash('sha256').update(text).digest('hex');
export const normalize=(text:string)=>text.replace(/\r\n?/g,'\n').normalize('NFC').trim();
export interface PageText {pageNumber:number|null;text:string}
export interface Chunk {chunkIndex:number;content:string;contentHash:string;pageNumber:number|null;section:string|null;startOffset:number;endOffset:number}
export function chunkPages(pages:PageText[]):Chunk[]{
  const chunks:Chunk[]=[];let total=0;
  for(const page of pages){
    const text=normalize(page.text),points=Array.from(text);total+=points.length;
    if(total>2000000)throw new KnowledgeFailure('EXTRACTED_TEXT_TOO_LARGE');
    const headings:{offset:number;title:string}[]=[];
    if(page.pageNumber===null){let offset=0;for(const line of text.split('\n')){const m=/^#{1,6} (.+)$/.exec(line);if(m)headings.push({offset,title:Array.from(m[1]!).slice(0,255).join('')});offset+=Array.from(line).length+1;}}
    for(let start=0;start<points.length;){
      let left=start;while(left<points.length&&/\s/u.test(points[left]!))left++;
      const hardEnd=Math.min(left+chunkSize,points.length);let right=hardEnd;
      if(hardEnd<points.length){
        const minimum=Math.min(hardEnd-1,left+Math.floor(chunkSize*.65));
        for(let candidate=hardEnd;candidate>minimum;candidate--){
          if(/[\s.!?;:,)]/u.test(points[candidate-1]!)){right=candidate;break;}
        }
      }
      while(right>left&&/\s/u.test(points[right-1]!))right--;
      if(left<right){const content=points.slice(left,right).join('');chunks.push({chunkIndex:chunks.length,content,contentHash:hash(content),pageNumber:page.pageNumber,section:headings.findLast(h=>h.offset<=left)?.title??null,startOffset:left,endOffset:right});}
      if(hardEnd===points.length)break;
      let next=Math.max(left+1,right-chunkOverlap);
      const fallback=next,minimumNext=Math.max(left+1,next-80);
      while(next>minimumNext&&!/\s/u.test(points[next-1]!))next--;
      start=next>minimumNext?next:fallback;
    }
  }
  if(!chunks.length)throw new KnowledgeFailure('NO_EXTRACTABLE_TEXT');
  return chunks;
}
