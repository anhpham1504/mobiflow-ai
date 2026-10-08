import {RequestDetail} from '@/components/request-detail';
export const metadata = { title: "Phê duyệt yêu cầu — MobiFlow AI" };
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RequestDetail id={id} role="MANAGER"/>;}

