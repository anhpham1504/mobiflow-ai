import { HealthPanel } from '@/components/health-panel';

export default function HomePage() {
  return <><div className="intro"><p className="eyebrow">01 / NỀN TẢNG</p><h1>Một nền tảng vững chắc.<br /><span>Cho quy trình thông minh.</span></h1><p>Kiểm tra kết nối và trạng thái các dịch vụ đang chạy trên máy của bạn.</p></div><HealthPanel /><div className="scope-note"><span className="scope-number">M1</span><div><h2>Hạ tầng đã có. Nghiệp vụ sẽ đến sau.</h2><p>Giai đoạn này thiết lập ứng dụng và các kết nối cục bộ. Đăng nhập, xử lý yêu cầu và AI nghiệp vụ chưa được triển khai.</p></div></div></>;
}
