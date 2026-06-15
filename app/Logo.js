// DealCheck Vision brand mark: an eye (vision) cradling a checkmark (the deal
// check), drawn in brand colors with no enclosing tile — matches the canonical
// lockup export (bare mark sitting beside the wordmark). The standalone vector
// lives at /public/logo.svg.

export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg
      className={`shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
  );
}
