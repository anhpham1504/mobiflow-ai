import {SessionGate} from '@/components/session-shell';
import {AnalyticsDashboard} from '@/components/analytics-dashboard';
export const metadata = { title: "Chất lượng & analytics — MobiFlow AI" };
export default function Page(){return <SessionGate role="MANAGER"><AnalyticsDashboard/></SessionGate>;}
