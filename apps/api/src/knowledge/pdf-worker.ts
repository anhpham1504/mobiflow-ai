import {parentPort,workerData} from 'node:worker_threads';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {normalize,type PageText} from './chunker.js';
async function parsePdf(){
  // PDF.js 6 removed the old eval compiler. Only text extraction is invoked;
  // no viewer, annotation scripting, XFA, rendering or external URL is enabled.
  const task=getDocument({data:new Uint8Array(workerData as Uint8Array),useSystemFonts:false,disableFontFace:true,useWorkerFetch:false,useWasm:false,enableXfa:false,disableAutoFetch:true,disableRange:true,disableStream:true,stopAtErrors:true,verbosity:0});
  // An empty user password may open an encrypted file; reject all encryption too.
  const pdf=await task.promise;
  try{
    const permissions=await pdf.getPermissions();
    if(permissions!==null)throw new Error('ENCRYPTED_PDF');
    if(pdf.numPages>200)throw new Error('TOO_MANY_PAGES');
    const pages:PageText[]=[];let size=0;
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),content=await page.getTextContent();
      const text=normalize(content.items.map(i=>'str' in i?i.str+(i.hasEOL?'\n':' '):'').join(''));
      size+=Array.from(text).length;if(size>2000000)throw new Error('EXTRACTED_TEXT_TOO_LARGE');
      pages.push({pageNumber:n,text});page.cleanup();
    }
    if(!pages.some(p=>p.text))throw new Error('NO_EXTRACTABLE_TEXT');
    return pages;
  }finally{await task.destroy();}
}
try{parentPort!.postMessage({pages:await parsePdf()});}
catch(error){const allowed=['ENCRYPTED_PDF','TOO_MANY_PAGES','EXTRACTED_TEXT_TOO_LARGE','NO_EXTRACTABLE_TEXT'];const code=error instanceof Error?(error.name==='PasswordException'?'ENCRYPTED_PDF':allowed.includes(error.message)?error.message:'INVALID_PDF'):'INVALID_PDF';parentPort!.postMessage({code});}
