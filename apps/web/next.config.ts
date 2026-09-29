import type { NextConfig } from 'next';

const securityHeaders=[
  {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:3001 http://127.0.0.1:3001"},
  {key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
];
const config: NextConfig = { output: 'standalone', poweredByHeader: false, agentRules: false, transpilePackages: ['@mobiflow/contracts'],async headers(){return [{source:'/:path*',headers:securityHeaders}];} };
export default config;
