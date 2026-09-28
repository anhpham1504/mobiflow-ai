import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = { title: 'MobiFlow AI — Nền tảng cục bộ', description: 'MobiFlow AI: trạng thái hạ tầng cục bộ M1.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><a className="skip-link" href="#main">Đi tới nội dung</a><div className="app-shell"><aside className="sidebar"><Link href="/" className="brand" aria-label="MobiFlow AI — Trang chủ"><span className="brand-mark" aria-hidden="true">m.</span><span>MobiFlow<span className="brand-ai">AI</span></span></Link><div className="workspace-label">KHÔNG GIAN CỤC BỘ</div><nav aria-label="Điều hướng chính"><Link href="/" className="nav-item">Tổng quan nền tảng <span>01</span></Link><Link href="/login" className="nav-item secondary">Đăng nhập <span>M2</span></Link></nav><div className="sidebar-bottom"><span className="local-dot" />Local-first<span>Milestone 01 / 10</span></div></aside><div className="main-shell"><header className="topbar"><span>MobiFlow / Nền tảng</span><span className="milestone-badge">M1 · FOUNDATION</span></header><main id="main">{children}</main><footer className="app-footer"><span>MOBIFLOW AI</span><span>Dữ liệu cục bộ. Con người kiểm soát.</span></footer></div></div></body></html>;
}
