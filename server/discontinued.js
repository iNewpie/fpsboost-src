/* fpsboost.ir — discontinued (2026-10-03). This replaces worker.js: every URL answers 410 Gone with a one-line notice,
   the app API answers 410 JSON so installed apps show an error instead of hanging. The Store Durable Object class is
   kept as an empty stub so the account / payment records stay in Cloudflare storage (removing the class from the
   migrations would delete them). Deploy with:  npx wrangler@4 deploy -c wrangler.down.toml   (from server/) */
import { DurableObject } from 'cloudflare:workers';

export class Store extends DurableObject {}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>FPS Boost</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f17;color:#e6e9ef;font:16px/1.6 system-ui,Segoe UI,Vazirmatn,sans-serif}main{max-width:36rem;padding:2rem;text-align:center}h1{font-size:1.4rem;margin:0 0 .6rem}p{margin:.4rem 0;color:#9aa3b2}</style></head>
<body><main><h1>FPS Boost has been discontinued.</h1><p>The website and the app's online services are closed.</p><p dir="rtl" lang="fa">FPS Boost متوقف شده است. وب‌سایت و سرویس‌های آنلاین برنامه بسته شده‌اند.</p></main></body></html>`;

export default {
  async fetch(request) {
    const p = new URL(request.url).pathname;
    if (p.startsWith('/api/')) {
      return Response.json({ error: 'FPS Boost has been discontinued' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response(PAGE, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  },
};
