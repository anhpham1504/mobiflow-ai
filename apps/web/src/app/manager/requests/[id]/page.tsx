import {RequestDetail} from '@/components/request-detail';
export const metadata = { title: "Chi tiết yêu cầu — MobiFlow AI" };
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <RequestDetail id={id} role="MANAGER"/>;}

