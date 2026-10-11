import { globalIgnores } from 'eslint/config';
import foundation from './packages/eslint-config/index.mjs';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default [globalIgnores(['**/.playwright-mcp/**']), ...foundation, ...nextVitals.map((entry) => ({ ...entry, files: ['apps/web/**/*.{ts,tsx}'] })), { settings: { next: { rootDir: 'apps/web/' } } }];
