'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {CheckCircle2,Eye,EyeOff} from 'lucide-react';
import {login,roleHome} from '@/lib/session';

export function LoginForm(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[show,setShow]=useState(false),router=useRouter();
  return <main className="login-page" id="main" tabIndex={-1}>
    <section className="login-brand-panel" aria-label="Giới thiệu MobiFlow AI">
      <Link href="/" className="brand" aria-label="MobiFlow AI — Trang chủ"><span className="brand-mark" aria-hidden="true">m</span><span>MobiFlow <b>AI</b></span></Link>
      <div className="login-brand-copy"><h1>Điều phối yêu cầu.<br/>Quyết định có kiểm soát.</h1><div className="login-benefits"><p><CheckCircle2 size={18}/>Theo dõi công việc và SLA tập trung</p><p><CheckCircle2 size={18}/>AI hỗ trợ, con người xác nhận quyết định</p><p><CheckCircle2 size={18}/>Dữ liệu demo được lưu cục bộ</p></div></div>
      <p className="login-note">MobiFlow AI · Môi trường trình diễn nội bộ</p>
    </section>
    <section className="login-main"><div className="login-card"><h1>Đăng nhập MobiFlow AI</h1><p>Nền tảng điều phối yêu cầu và hỗ trợ xử lý bằng AI trong môi trường nội bộ.</p>
      <form onSubmit={async e=>{e.preventDefault();if(busy)return;const values=new FormData(e.currentTarget);setBusy(true);setError('');try{const user=await login(String(values.get('email')),String(values.get('password')));router.push(roleHome(user.role));}catch{setError('Đăng nhập không thành công. Kiểm tra email, mật khẩu và kết nối dịch vụ.');}finally{setBusy(false);}}}>
        <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
        <label>Mật khẩu<span className="password-field"><input name="password" type={show?'text':'password'} autoComplete="current-password" required minLength={8} maxLength={128}/><button type="button" className="icon-button" aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-pressed={show} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label>
        {error?<p role="alert" className="form-error">{error}</p>:null}<button className="button button-primary button-full" disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button>
      </form><p className="login-status"><span className="local-dot"/>Hệ thống demo cục bộ</p>
    </div></section>
  </main>;
}
