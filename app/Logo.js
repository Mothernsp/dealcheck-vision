// DealCheck Vision lockup: the eye+check mark beside the wordmark, in locked
// brand proportions (mark : wordmark ≈ 2:1, matching the canonical export) so
// every placement renders identically. Pass `wordmarkClassName` only for
// context cosmetics (hover color, responsive hiding) — never size/weight/font.
// The standalone mark vector lives at /public/logo.svg.

export default function Logo({ className = '', wordmarkClassName = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg className="h-9 w-9 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2.6 12C5.6 7.2 8.6 6 12 6s6.4 1.2 9.4 6c-3 4.8-6 6-9.4 6S5.6 16.8 2.6 12Z"
          stroke="#0f172a"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.4 12.1l1.9 1.9 3.5-4.1"
          stroke="#1d4ed8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`text-lg font-semibold tracking-tight text-slate-900 ${wordmarkClassName}`}
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        DealCheck <span className="text-slate-400 font-normal">Vision</span>
      </span>
    </span>
  );
}
