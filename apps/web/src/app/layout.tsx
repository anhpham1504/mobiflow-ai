import type { Metadata } from 'next';
import {AppFrame} from '@/components/session-shell';
import './globals.css';
export const metadata: Metadata = { title: 'MobiFlow AI — Xử lý yêu cầu', description: 'Tiếp nhận, phân công và theo dõi xử lý yêu cầu.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body><AppFrame>{children}</AppFrame></body></html>;
}
