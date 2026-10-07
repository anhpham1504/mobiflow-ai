'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function PageTitle({ title }: { title: string }) {
  const path = usePathname();
  useEffect(() => {
    const expected = title + ' — MobiFlow AI';
    const update = () => { if (document.title !== expected) document.title = expected; };
    update();
    // Next can finish streaming route metadata after the client data has arrived.
    const observer = new MutationObserver(update);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title, path]);
  return null;
}
