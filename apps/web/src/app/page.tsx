import Link from 'next/link';
import {HealthPanel} from '@/components/health-panel';
export default function HomePage(){return <><div className="intro"><p className="eyebrow">MOBIFLOW</p><h1>Theo dõi yêu cầu.<br/><span>Phối hợp xử lý.</span></h1><p>Tiếp nhận, phân công và cập nhật tiến độ trong một không gian chung.</p><Link className="action-link" href="/login">Vào không gian làm việc</Link></div><HealthPanel/></>;}
