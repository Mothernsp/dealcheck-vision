// DealCheck Vision brand mark: an eye (vision) cradling a checkmark (the deal
// check). Rendered white-on-slate inside a rounded tile to match the app's
// monochrome chrome. The standalone vector lives at /public/logo.svg.

export default function Logo({ className = 'h-6 w-6 rounded-md', iconClassName = 'h-4 w-4' }) {
  return (
    <span
      className={`bg-slate-900 flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      <svg className={iconClassName} viewBox="0 0 24 24" fill="none">
        <path
          d="M2.6 12C5.6 7.2 8.6 6 12 6s6.4 1.2 9.4 6c-3 4.8-6 6-9.4 6S5.6 16.8 2.6 12Z"
          stroke="#ffffff"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M9.4 12.1l1.9 1.9 3.5-4.1"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
