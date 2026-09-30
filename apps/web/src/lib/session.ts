'use client';
import {authResponseSchema,type SafeProfile} from '@mobiflow/contracts';
const base=process.env.NEXT_PUBLIC_API_BASE_URL??'http://localhost:3001/api/v1';
let token:string|null=null;
let profile:SafeProfile|null=null;
let refreshPromise:Promise<SafeProfile>|null=null;
const listeners=new Set<()=>void>();
export const subscribe=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export const getProfile=()=>profile;
export const serverProfile=()=>null;
function publish(user:SafeProfile|null,access:string|null){profile=user;token=access;listeners.forEach(fn=>fn());}
export class ApiFailure extends Error {
  constructor(readonly status:number,readonly code:string) {
    super(code==='DUPLICATE_DOCUMENT'?'Tài liệu có cùng nội dung đã tồn tại trong kho.':status===422&&code==='MISSING_ACKNOWLEDGMENT'?'Xác nhận tất cả thông tin còn thiếu trong phần review trước khi tiếp tục.':status===409?'Yêu cầu đã thay đổi hoặc thao tác không còn hợp lệ. Tải lại và xem xét trước khi gửi lại.':status===404?'Không tìm thấy yêu cầu hoặc bạn không có quyền truy cập.':status===403?'Vai trò của bạn không được phép thực hiện thao tác này.':status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':status===422?'Thông tin nghiệp vụ chưa hợp lệ. Kiểm tra nhân sự, chính sách SLA và checklist.':status===429?'Bạn thao tác quá nhanh. Vui lòng thử lại sau.':'Không thể thực hiện yêu cầu. Kiểm tra dữ liệu và thử lại.');
  }
}
async function raw(path:string,init:RequestInit={}) {
  try{return await fetch(base+path,{...init,credentials:'include',cache:'no-store',headers:{...(init.body instanceof FormData?{}:{'Content-Type':'application/json'}),'X-CSRF-Protection':'1',...init.headers},signal:init.signal??AbortSignal.timeout(15000)});}
  catch {throw new Error('Không thể kết nối dịch vụ. Vui lòng thử lại.');}
}
async function failure(response:Response) {
  let code='REQUEST_FAILED';
  try {const b=await response.json();if(typeof b?.error?.code==='string')code=b.error.code;}catch { /* A non-JSON failure still uses the safe HTTP status. */ }
  return new ApiFailure(response.status,code);
}
export async function login(email:string,password:string) {
  const response=await raw('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  if(!response.ok)throw new ApiFailure(response.status,'LOGIN_FAILED');
  const {data}=authResponseSchema.parse(await response.json());publish(data.user,data.accessToken);return data.user;
}
export function refresh() {
  if(!refreshPromise) {
    const run=async()=>{
      const response=await raw('/auth/refresh',{method:'POST'});
      if(!response.ok){publish(null,null);throw await failure(response);}
      const {data}=authResponseSchema.parse(await response.json());publish(data.user,data.accessToken);return data.user;
    };
    refreshPromise=(typeof navigator!=='undefined'&&navigator.locks?navigator.locks.request('mobiflow-refresh',run):run()).finally(()=>{refreshPromise=null;});
  }
  return refreshPromise;
}
export async function logout() {
  const response=await raw('/auth/logout',{method:'POST'});
  if(!response.ok)throw await failure(response);
  publish(null,null);
}
export async function api<T>(path:string,schema:{parse:(data:unknown)=>T},body?:unknown,method=body===undefined?'GET':'POST',signal?:AbortSignal):Promise<T> {
  if(!token)await refresh();
  const usedToken=token;
  const send=()=>raw(path,{method,headers:{Authorization:'Bearer '+token},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal});
  let response=await send();
  if(response.status===401) {
    if(token===usedToken)await refresh();
    response=await send();
  }
  if(!response.ok){if(response.status===401)publish(null,null);throw await failure(response);}
  try{return schema.parse(await response.json());}catch{throw new Error('Dữ liệu dịch vụ không hợp lệ. Vui lòng tải lại.');}
}
export const roleHome=(role:SafeProfile['role'])=>'/'+role.toLowerCase()+'/dashboard';
export const requestLink=(role:SafeProfile['role'],id:string)=>role==='MANAGER'?'/manager/requests/'+id:'/'+role.toLowerCase()+'/requests/'+id;

