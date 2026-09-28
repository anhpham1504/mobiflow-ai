'use client';
import Link from 'next/link';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {notificationListSchema,notificationResponseSchema,type NotificationView} from '@mobiflow/contracts';
import {api,getProfile,serverProfile,subscribe,requestLink} from '@/lib/session';
import {SessionGate} from './session-shell';
import {formatTime} from './request-list';
export function Notifications(){
  const user=useSyncExternalStore(subscribe,getProfile,serverProfile),[rows,setRows]=useState<NotificationView[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[next,setNext]=useState<string|null>(null),[cursor,setCursor]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!user)return;let active=true;
    void api('/notifications?limit=20'+(cursor?'&cursor='+encodeURIComponent(cursor):''),notificationListSchema).then(r=>{if(active){setRows(r.data);setNext(r.page.nextCursor);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[user,revision,cursor]);
  return <SessionGate><h1>Thông báo</h1>{loading?<p role="status">Đang tải…</p>:null}{error?<p role="alert">{error}</p>:null}<button onClick={()=>{setLoading(true);setRevision(v=>v+1);}}>Tải lại</button>{!loading&&rows.length===0?<p>Chưa có thông báo.</p>:null}<ul className="request-list">{rows.map(n=><li key={n.id}><p>{n.type} · {n.readAt?'Đã đọc':'Chưa đọc'}</p><small>{formatTime(n.createdAt)}</small>{n.requestId&&user?<p><Link href={requestLink(user.role,n.requestId)}>Mở yêu cầu</Link></p>:null}<button disabled={busy} onClick={async()=>{setBusy(true);try{await api('/notifications/'+n.id+'/read',notificationResponseSchema,{read:!n.readAt},'PATCH');setRevision(v=>v+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{n.readAt?'Đánh dấu chưa đọc':'Đánh dấu đã đọc'}</button></li>)}</ul>{next?<button onClick={()=>{setLoading(true);setCursor(next);}}>Trang tiếp theo</button>:null}</SessionGate>;
}

