import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('pre-demo touch targets are scoped to navigation, notification, source and history links', async () => {
  const [css, knowledge, recommendation] = await Promise.all([
    read('src/app/globals.css'),
    read('src/components/knowledge.tsx'),
    read('src/components/recommendation-panel.tsx'),
  ]);
  assert.match(css, /\.nav-item\{[^}]*min-height:44px/);
  assert.match(css, /\.notification-list p>a,\.source-link,\.history-link\{[^}]*min-height:44px/);
  assert.match(knowledge, /className="source-link"/);
  assert.equal((recommendation.match(/className="history-link"/g) ?? []).length, 2);
  assert.doesNotMatch(css, /(^|[},])\s*a\s*\{[^}]*min-height:44px/m);
});

test('analytics muted label token has at least 4.5:1 contrast on the supported light surface', () => {
  const luminance = hex => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert.ok(ratio(luminance('5d6c80'), luminance('ffffff')) >= 4.5);
});
