'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {login,roleHome} from '@/lib/session';
export function LoginForm(){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),router=useRouter();
  return <section className="workflow-card"><p className="eyebrow">KHÔNG GIAN LÀM VIỆC</p><h1>Đăng nhập MobiFlow</h1><p>Sử dụng tài khoản demo được cấp trong tài liệu demo cục bộ.</p><form onSubmit={async e=>{
    e.preventDefault();if(busy)return;const values=new FormData(e.currentTarget);setBusy(true);setError('');
    try{const user=await login(String(values.get('email')),String(values.get('password')));router.push(roleHome(user.role));}
    catch{setError('Đăng nhập không thành công. Kiểm tra email, mật khẩu và kết nối dịch vụ.');}finally{setBusy(false);}
  }}><label>Email<input name="email" type="email" autoComplete="username" required maxLength={254}/></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required minLength={8} maxLength={128}/></label>{error?<p role="alert" className="form-error">{error}</p>:null}<button disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button></form></section>;
}

