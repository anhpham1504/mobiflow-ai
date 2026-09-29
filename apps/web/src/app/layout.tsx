import type { Metadata } from 'next';
import Link from 'next/link';
import {SessionNav} from '@/components/session-shell';
import './globals.css';
export const metadata: Metadata = { title: 'MobiFlow AI — Xử lý yêu cầu', description: 'Tiếp nhận, phân công và theo dõi xử lý yêu cầu.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><a className="skip-link" href="#main">Đi tới nội dung</a><div className="app-shell"><aside className="sidebar"><Link href="/" className="brand" aria-label="MobiFlow AI — Trang chủ"><span className="brand-mark" aria-hidden="true">m.</span><span>MobiFlow<span className="brand-ai">AI</span></span></Link><div className="workspace-label">KHÔNG GIAN CỤC BỘ</div><SessionNav/><div className="sidebar-bottom"><span className="local-dot"/>Dữ liệu demo cục bộ</div></aside><div className="main-shell"><header className="topbar"><span>MobiFlow / Xử lý yêu cầu</span><span>Con người kiểm soát</span></header><main id="main" tabIndex={-1}>{children}</main><footer className="app-footer"><span>MOBIFLOW AI</span><span>Dữ liệu cục bộ. Con người kiểm soát.</span></footer></div></div></body></html>;
}
