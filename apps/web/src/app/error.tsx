'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <section className="intro" role="alert"><h1>Không thể tải trang</h1><p>Đã xảy ra lỗi khi tải giao diện. Thông tin kỹ thuật không được hiển thị để bảo vệ cấu hình hệ thống.</p><Button onClick={reset}>Thử tải lại</Button></section>; }
