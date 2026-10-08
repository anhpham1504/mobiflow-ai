import {SourcePreview} from '@/components/knowledge';
export const metadata = { title: "Nguồn tham chiếu — MobiFlow AI" };
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <SourcePreview id={id}/>;}
