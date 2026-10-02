'use client';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Activity,Bell,BookOpen,BriefcaseBusiness,ChevronRight,ClipboardCheck,LayoutDashboard,LogOut,Menu,UsersRound,X,BarChart3} from 'lucide-react';
import {getProfile,serverProfile,subscribe,refresh,logout,roleHome} from '@/lib/session';

type Role='USER'|'STAFF'|'MANAGER';
type NavItem={href:string;label:string;icon:typeof Activity};
const roleNames:Record<Role,string>={USER:'Người yêu cầu',STAFF:'Nhân viên xử lý',MANAGER:'Quản lý'};
function navFor(role:Role|null){
  const overview:NavItem[]=[{href:role?roleHome(role):'/',label:role?'Tổng quan':'Trạng thái hệ thống',icon:LayoutDashboard}];
  if(!role)return [{label:'Hệ thống',items:[{href:'/',label:'Trạng thái hệ thống',icon:Activity}]}];
  const work:NavItem[]=role==='USER'?
    [{href:'/user/requests',label:'Yêu cầu của tôi',icon:BriefcaseBusiness},{href:'/notifications',label:'Thông báo',icon:Bell}]:role==='STAFF'?
    [{href:'/staff/work-queue',label:'Công việc của tôi',icon:ClipboardCheck},{href:'/notifications',label:'Thông báo',icon:Bell}]:
    [{href:'/manager/requests',label:'Yêu cầu',icon:BriefcaseBusiness},{href:'/manager/approvals',label:'Chờ phê duyệt',icon:UsersRound},{href:'/manager/templates',label:'Mẫu phản hồi & checklist',icon:ClipboardCheck},{href:'/notifications',label:'Thông báo',icon:Bell}];
  return [{label:'Tổng quan',items:overview},{label:'Công việc',items:work},...(role==='MANAGER'?[{label:'AI & tri thức',items:[{href:'/manager/knowledge',label:'Kho tri thức',icon:BookOpen}]},{label:'Quản trị',items:[{href:'/manager/analytics',label:'Chất lượng & analytics',icon:BarChart3},{href:'/',label:'Trạng thái hệ thống',icon:Activity}]}]:[])];
}
function Brand(){return <Link href="/" className="brand" aria-label="MobiFlow AI — Trang chủ"><span className="brand-mark" aria-hidden="true">m</span><span>MobiFlow <b>AI</b></span></Link>;}
function Navigation({onNavigate}:{onNavigate?:()=>void}){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),path=usePathname();
  return <nav aria-label="Điều hướng chính" className="primary-nav">{navFor((user?.role??null) as Role|null).map(group=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item=>{const Icon=item.icon;const exact=item.href==='/'?path==='/':path===item.href||path.startsWith(item.href+'/');return <Link key={item.href} href={item.href} onClick={onNavigate} className="nav-item" aria-current={exact?'page':undefined}><Icon size={18} aria-hidden="true"/><span>{item.label}</span></Link>;})}</div>)}</nav>;
}
function AccountBlock(){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!user)return null;
  return <div className="account-block"><Link href="/profile" className="account-summary"><span className="avatar" aria-hidden="true">{user.displayName.slice(0,1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{roleNames[user.role]}</small></span><ChevronRight size={16} aria-hidden="true"/></Link><button className="button button-ghost button-full" disabled={busy} onClick={()=>{setBusy(true);setError('');void logout().then(()=>router.push('/login')).catch(e=>{setError(e.message);setBusy(false);});}}><LogOut size={17} aria-hidden="true"/>{busy?'Đang đăng xuất…':'Đăng xuất'}</button>{error?<p className="form-error compact" role="alert">{error}</p>:null}</div>;
}
function PageContext(){const path=usePathname();const user=useSyncExternalStore(subscribe,getProfile,serverProfile);const parts=path.split('/').filter(Boolean);const labels:Record<string,string>={user:'Cá nhân',staff:'Vận hành',manager:'Quản lý',dashboard:'Tổng quan',requests:'Yêu cầu','work-queue':'Công việc',approvals:'Phê duyệt',analytics:'Analytics',knowledge:'Kho tri thức',notifications:'Thông báo',profile:'Hồ sơ'};return <span className="topbar-context"><span>MobiFlow</span><ChevronRight size={14} aria-hidden="true"/><strong>{labels[parts.at(-1)??'']??(user?'Không gian làm việc':'Trạng thái hệ thống')}</strong></span>;}
export function AppFrame({children}:{children:React.ReactNode}){
  const path=usePathname(),user=useSyncExternalStore(subscribe,getProfile,serverProfile),[open,setOpen]=useState(false);const trigger=useRef<HTMLButtonElement>(null),drawer=useRef<HTMLElement>(null);const isLogin=path==='/login';
  useEffect(()=>{if(!open)return;const prior=document.activeElement as HTMLElement|null,triggerElement=trigger.current;document.body.classList.add('nav-open');const focusable=drawer.current?.querySelectorAll<HTMLElement>('a,button:not([disabled])');focusable?.[0]?.focus();const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);return;}if(event.key==='Tab'&&focusable?.length){const first=focusable[0]!,last=focusable[focusable.length-1]!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',key);return()=>{document.body.classList.remove('nav-open');document.removeEventListener('keydown',key);(prior??triggerElement)?.focus();};},[open]);
  if(isLogin)return <><a className="skip-link" href="#main">Đi tới nội dung</a>{children}</>;
  return <><a className="skip-link" href="#main">Đi tới nội dung</a><div className="app-shell"><aside className="sidebar"><Brand/><Navigation/><div className="sidebar-bottom"><AccountBlock/><p><span className="local-dot"/>Môi trường demo cục bộ</p></div></aside><div className="main-shell"><header className="topbar"><button ref={trigger} className="icon-button mobile-menu" aria-label="Mở menu" aria-expanded={open} aria-controls="mobile-navigation" onClick={()=>setOpen(true)}><Menu size={21}/></button><PageContext/><div className="topbar-actions"><span className="environment-status"><span className="local-dot"/>Demo cục bộ</span>{user?<Link href="/notifications" className="icon-button" aria-label="Mở thông báo"><Bell size={19}/></Link>:<Link className="button button-primary button-sm" href="/login">Đăng nhập</Link>}</div></header><main id="main" tabIndex={-1}><div className="page-container">{children}</div></main></div></div>{open?<div className="drawer-layer"><button className="drawer-backdrop" aria-label="Đóng menu" onClick={()=>setOpen(false)}/><aside ref={drawer} id="mobile-navigation" className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Menu điều hướng"><div className="drawer-header"><Brand/><button className="icon-button" aria-label="Đóng menu" onClick={()=>setOpen(false)}><X size={21}/></button></div><Navigation onNavigate={()=>setOpen(false)}/><div className="sidebar-bottom"><AccountBlock/></div></aside></div>:null}</>;
}
export function SessionGate({role,children}:{role?:string;children:React.ReactNode}){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),router=useRouter(),path=usePathname();const [error,setError]=useState('');
  useEffect(()=>{if(!getProfile())void refresh().catch(e=>{setError(e.message);router.replace('/login');});},[router,path]);
  if(!user)return <div className="state-panel" role="status"><span className="spinner"/><h2>Đang xác thực phiên đăng nhập</h2><p>{error||'Vui lòng chờ trong giây lát.'}</p></div>;
  if(role&&user.role!==role)return <div className="state-panel" role="alert"><h1>403 · Không có quyền truy cập</h1><p>Trang này không thuộc phạm vi vai trò của bạn.</p><Link className="button button-primary" href={roleHome(user.role)}>Về tổng quan</Link></div>;
  return <>{children}</>;
}
export function Profile(){const user=useSyncExternalStore(subscribe,getProfile,serverProfile);return <SessionGate><div className="page-header"><div><h1>Hồ sơ cá nhân</h1><p>Thông tin định danh được dùng trong môi trường MobiFlow AI.</p></div></div><section className="workflow-card profile-card"><span className="avatar avatar-lg" aria-hidden="true">{user?.displayName.slice(0,1).toUpperCase()}</span><div><h2>{user?.displayName}</h2><p>{user?.email}</p><span className="badge badge-info">{user?roleNames[user.role]:''}</span></div></section></SessionGate>}
