import Link from 'next/link';
import {HealthPanel} from '@/components/health-panel';
import {PageHeader} from '@/components/ui/patterns';
export default function HomePage(){return <><PageHeader title="Trạng thái hệ thống" description="Theo dõi khả năng sẵn sàng của các thành phần phục vụ MobiFlow AI." actions={<Link className="button button-primary" href="/login">Vào không gian làm việc</Link>}/><HealthPanel/></>;}
