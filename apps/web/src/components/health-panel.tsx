'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowUpRight, CheckCircle2, RefreshCw } from 'lucide-react';
import type { ReadinessResponse } from '@mobiflow/contracts';
import { Button } from '@/components/ui/button';
import { fetchReadiness } from '@/lib/api-client';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';
const labels = { API: 'Dịch vụ API', DATABASE: 'PostgreSQL', VECTOR_EXTENSION: 'pgvector', OLLAMA_SERVER: 'Ollama trên máy', OLLAMA_LLM_MODEL: 'Mô hình ngôn ngữ', OLLAMA_EMBEDDING_MODEL: 'Mô hình embedding' };
const reasons = { OK: 'Đã kiểm tra kết nối', UNAVAILABLE: 'Không thể kết nối', MODEL_NOT_INSTALLED: 'Model chưa được cài đặt', CAPABILITY_MISMATCH: 'Model không hỗ trợ chức năng này', NOT_CONFIGURED: 'Chưa cấu hình model', EXTENSION_MISSING: 'Chưa bật extension', INVALID_RESPONSE: 'Không xác minh được model' };

export function HealthPanel() {
  const [result, setResult] = useState<ReadinessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    void fetchReadiness(apiBase, AbortSignal.any([current.signal, AbortSignal.timeout(8000)]))
      .then((data) => { if (!current.signal.aborted) setResult(data); })
      .catch(() => { if (!current.signal.aborted) { setError('Không thể lấy trạng thái hệ thống. Kiểm tra API rồi thử lại.'); setResult(null); } })
      .finally(() => { if (!current.signal.aborted) setBusy(false); });
  }, []);
  useEffect(() => { void refresh(); return () => controller.current?.abort(); }, [refresh]);

  const components=result?Object.values(result.data.components):[],ready=components.filter(component=>component.status==='UP').length;
  return <section aria-labelledby="connection-heading" className="health-panel">
    <div className="panel-heading"><div><h2 id="connection-heading">Nền tảng hệ thống</h2><p className="scope-note">Khả năng sẵn sàng theo lần kiểm tra gần nhất.</p></div><Button variant="outline" onClick={() => { setBusy(true); setError(null); void refresh(); }} disabled={busy}><RefreshCw size={15} aria-hidden="true" />{busy ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</Button></div>
    <div aria-live="polite" className={`health-summary ${result&&!result.data.coreReady?'health-summary-warning':''}`}>{busy?<Activity size={20} aria-hidden="true"/>:result?.data.coreReady?<CheckCircle2 size={20} aria-hidden="true"/>:<Activity size={20} aria-hidden="true"/>}<span><strong>{busy ? 'Đang xác minh các dịch vụ…' : error ? 'Chưa thể xác minh trạng thái' : result?.data.coreReady ? 'Hạ tầng cốt lõi đã sẵn sàng.' : 'Hạ tầng cốt lõi cần được kiểm tra.'}</strong>{result?<small>{ready}/{components.length} thành phần sẵn sàng</small>:null}</span></div>
    {error ? <div className="notice" role="alert">API chưa phản hồi. Trang vẫn hoạt động; không có dữ liệu nghiệp vụ nào được tạo.</div> : <ul className="service-list" aria-busy={busy}>{Object.entries(labels).map(([key, label], index) => {
      const component = result?.data.components[key as keyof typeof labels];
      return <li key={key}><span className="service-index">0{index + 1}</span><div className="service-name"><strong>{label}</strong><span>{busy ? 'Đang kiểm tra' : component ? reasons[component.code] : 'Chưa có kết quả'}</span></div><span className={`status-pill ${!busy && component?.status === 'UP' ? 'is-up' : ''}`}>{busy ? '…' : component?.status === 'UP' ? 'Sẵn sàng' : component?.status === 'NOT_CONFIGURED' ? 'Chưa cấu hình' : 'Chưa sẵn sàng'}</span></li>;
    })}</ul>}
    {!busy && result && !result.data.aiReady ? <p className="notice">AI chưa sẵn sàng đầy đủ. Trạng thái này không làm dừng API hoặc giao diện.</p> : null}
    {!busy&&result?.data.rag?<p className="notice">Tra cứu tài liệu: {result.data.rag.status==='READY'?'Sẵn sàng':result.data.rag.status==='DISABLED'?'Đang tắt':result.data.rag.knowledge==='EMPTY'?'Chưa có tài liệu sẵn sàng':'Chưa sẵn sàng'}. {result.data.rag.documents} tài liệu · {result.data.rag.chunks} đoạn. {result.data.rag.checkedAt?'Xác minh lúc '+new Date(result.data.rag.checkedAt).toLocaleTimeString('vi-VN'):'Chưa xác minh embeddings.'}</p>:null}
    <div className="panel-footer"><span>{result ? `Kiểm tra lúc ${new Date(result.data.checkedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Chỉ hiển thị kết quả kiểm tra thực tế'}</span><a href={`${apiBase.replace(/\/api\/v1$/, '')}/api/docs`} target="_blank" rel="noreferrer">Tài liệu API <ArrowUpRight size={14} aria-hidden="true" /></a></div>
  </section>;
}
