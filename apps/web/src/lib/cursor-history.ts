export type CursorHistory = { scope: string; cursors: (string | null)[] };

// Only cursors observed in this browser and this list scope are navigable.
export function cursorPosition(history: CursorHistory | null, scope: string, cursor: string | null) {
  const cursors = history?.scope === scope ? history.cursors : [cursor];
  const index = cursors.indexOf(cursor);
  return { page: index >= 0 ? index + 1 : null, startsAtFirst: cursors[0] === null,
    canPrevious: index > 0, previous: index > 0 ? cursors[index - 1]! : null };
}

export function advanceCursor(history: CursorHistory | null, scope: string, cursor: string | null, next: string): CursorHistory {
  const cursors = history?.scope === scope ? history.cursors : [cursor];
  if (next === cursor) return { scope, cursors };
  const index = cursors.indexOf(cursor);
  if (index < 0) return { scope, cursors: [cursor, next] };
  if (cursors[index + 1] === next) return { scope, cursors };
  return { scope, cursors: [...cursors.slice(0, index + 1), next] };
}
