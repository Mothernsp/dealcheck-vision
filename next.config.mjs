/** @type {import('next').NextConfig} */

// Two tiers of security headers:
//
// 1. ENFORCED — directives that harden the app with zero risk of breaking
//    Clerk auth or Supabase calls: clickjacking protection, MIME-sniffing
//    protection, HTTPS enforcement, referrer/permissions hygiene, plus the
//    safe CSP directives (no plugins, locked base-uri, forced HTTPS).
//
// 2. REPORT-ONLY — a strict Content-Security-Policy that would block inline
//    scripts and any off-origin script/connect source. A wrong CSP takes the
//    login page down, so this ships in *report-only* mode: the browser only
//    logs violations (it does not block). Watch the console on the sign-in
//    page and your dashboard, add any Clerk/Supabase origins it flags to the
//    `script-src` / `connect-src` / `frame-src` lists below, then promote it
//    to enforcement by renaming the header key to 'Content-Security-Policy'.
const reportOnlyCsp = [
  "default-src 'self'",
  // Clerk + Next need inline bootstrap; tighten with a nonce later if desired.
  "script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');

const enforcedHeaders = [
  // Clickjacking: refuse to be framed by any site.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests" },
  // Stop MIME-type sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Force HTTPS for two years (Vercel serves HTTPS; safe to enable).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Don't leak full URLs (which can contain ids) to other origins.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deny powerful browser features the app doesn't use.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
];

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...enforcedHeaders,
          { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp },
        ],
      },
    ];
  },
};

export default nextConfig;
