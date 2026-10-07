import type { Metadata } from 'next';
import {AppFrame} from '@/components/session-shell';
import {CursorHistoryProvider} from '@/components/cursor-history-provider';
import './globals.css';
export const metadata: Metadata = { title: 'MobiFlow AI — Xử lý yêu cầu', description: 'Tiếp nhận, phân công và theo dõi xử lý yêu cầu.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><CursorHistoryProvider><AppFrame>{children}</AppFrame></CursorHistoryProvider></body></html>;
}
