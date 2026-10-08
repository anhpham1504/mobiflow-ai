'use client';
import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react';
import type { CursorHistory } from '@/lib/cursor-history';

const Context = createContext<{ history: CursorHistory | null; setHistory: Dispatch<SetStateAction<CursorHistory | null>> } | null>(null);
export function CursorHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<CursorHistory | null>(null);
  return <Context.Provider value={{ history, setHistory }}>{children}</Context.Provider>;
}
export function useCursorHistory() {
  const context = useContext(Context);
  if (!context) throw new Error('Cursor history requires the application provider.');
  return context;
}
