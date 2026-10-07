import Link from 'next/link';
import {PageHeader} from '@/components/ui/patterns';
export default function NotFound() { return <section className="recovery-page"><PageHeader title="404 · Không tìm thấy trang" description="Đường dẫn này không còn khả dụng. Bạn có thể quay về tổng quan nền tảng." actions={<Link className="button button-primary" href="/">Về tổng quan nền tảng</Link>}/></section>; }
