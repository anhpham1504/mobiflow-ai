'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {getProfile,serverProfile,subscribe,refresh,logout,roleHome} from '@/lib/session';
export function SessionNav(){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),router=useRouter(),path=usePathname();
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const current=(href:string)=>href==='/'?path===href:path.startsWith(href);
  const navLink=(href:string,label:string,primary=false)=><Link href={href} className={`nav-item${primary?'':' secondary'}`} aria-current={current(href)?'page':undefined}>{label}</Link>;
  return <><nav aria-label="Điều hướng chính">{navLink('/','Trạng thái dịch vụ')}{user?<>{navLink(roleHome(user.role),'Không gian làm việc',true)}{user.role==='MANAGER'?<>{navLink('/manager/knowledge','Kho tài liệu')}{navLink('/manager/analytics','Chất lượng & analytics')}</>:null}{navLink('/notifications','Thông báo')}{navLink('/profile',`${user.displayName} · ${user.role}`)}<button className="nav-item secondary" disabled={busy} onClick={()=>{setBusy(true);setError('');void logout().then(()=>router.push('/login')).catch(e=>{setError(e.message);setBusy(false);});}}>{busy?'Đang đăng xuất…':'Đăng xuất'}</button></>:navLink('/login','Đăng nhập',true)}</nav>{error?<p className="form-error" role="alert">{error}</p>:null}</>;
}
export function SessionGate({role,children}:{role?:string;children:React.ReactNode}){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),router=useRouter(),path=usePathname();
  const [error,setError]=useState('');
  useEffect(()=>{if(!getProfile())void refresh().catch(e=>{setError(e.message);router.replace('/login');});},[router,path]);
  if(!user)return <p role="status">{error||'Đang xác thực phiên đăng nhập…'}</p>;
  if(role&&user.role!==role)return <div role="alert"><h1>403 · Không có quyền truy cập</h1><Link href={roleHome(user.role)}>Về không gian của bạn</Link></div>;
  return <>{children}</>;
}
export function Profile(){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile);
  return <SessionGate><h1>Hồ sơ</h1><p>{user?.displayName}</p><p>{user?.email}</p><p>Vai trò: {user?.role}</p></SessionGate>;
}

