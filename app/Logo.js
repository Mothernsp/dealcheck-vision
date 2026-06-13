// DealCheck Vision brand mark: an eye (vision) cradling a checkmark (the deal
// check). Rendered in brand colors on a plain white tile, no border. The
// standalone vector lives at /public/logo.svg.

export default function Logo({ className = 'h-7 w-7 rounded-md', iconClassName = 'h-6 w-6' }) {
  return (
    <span
      className={`bg-white flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* viewBox is cropped to the mark's bounds (not 0 0 24 24) so the eye
          fills the tile without its tips clipping past the SVG edges. */}
      <svg className={iconClassName} viewBox="1.5 4.5 21 15" fill="none">
        <path
          d="M2.6 12C5.6 7.2 8.6 6 12 6s6.4 1.2 9.4 6c-3 4.8-6 6-9.4 6S5.6 16.8 2.6 12Z"
          stroke="#0f172a"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M9.4 12.1l1.9 1.9 3.5-4.1"
          stroke="#1d4ed8"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
