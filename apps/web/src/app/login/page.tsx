import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function LoginPlaceholder() { return <section className="intro"><p className="eyebrow">GIAI ĐOẠN TIẾP THEO</p><h1>Đăng nhập</h1><p>Xác thực tài khoản được triển khai trong M2. Hiện tại chưa có biểu mẫu đăng nhập hoặc tài khoản demo.</p><Button asChild variant="outline"><Link href="/">Về tổng quan nền tảng</Link></Button></section>; }
