import {SessionGate} from '@/components/session-shell';
import {AnalyticsDashboard} from '@/components/analytics-dashboard';
export default function Page(){return <SessionGate role="MANAGER"><AnalyticsDashboard/></SessionGate>;}
