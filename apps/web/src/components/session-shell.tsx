'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {getProfile,serverProfile,subscribe,refresh,logout,roleHome} from '@/lib/session';
export function SessionNav(){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),router=useRouter();
  const [error,setError]=useState('');
  return <><nav aria-label="Điều hướng chính"><Link href="/" className="nav-item secondary">Trạng thái dịch vụ</Link>{user?<><Link className="nav-item" href={roleHome(user.role)}>Không gian làm việc</Link><Link className="nav-item secondary" href="/notifications">Thông báo</Link><Link className="nav-item secondary" href="/profile">{user.displayName} · {user.role}</Link><button className="nav-item secondary" onClick={()=>{void logout().then(()=>router.push('/login')).catch(e=>setError(e.message));}}>Đăng xuất</button></>:<Link href="/login" className="nav-item">Đăng nhập</Link>}</nav>{error?<p role="alert">{error}</p>:null}</>;
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

