// Shared fail/warn/pass icon language for the compliance-dossier UI. One source
// for both deal checks (deal view) and admin rule priorities, so the iconography
// is identical everywhere. Pure presentational SVGs — safe in server or client
// components.

export function PassIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} text-emerald-600`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function WarnIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} text-amber-500`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

export function FailIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} text-rose-600`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Neutral "informational" icon for soft_check rules — an eye, signalling "watch
// for this" without implying pass or fail.
export function SoftIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={`${className} text-slate-400`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// Map a deal-check status to its icon (deal view).
export const CHECK_ICONS = {
  pass: <PassIcon />,
  warn: <WarnIcon />,
  fail: <FailIcon />,
};

// Map a rule priority to its icon (admin Rules screen).
export const PRIORITY_ICONS = {
  hard_fail: FailIcon,
  cautious: WarnIcon,
  soft_check: SoftIcon,
};
