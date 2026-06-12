import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm"
            aria-hidden="true"
          >
            D
          </div>
          <span
            className="text-slate-900 font-semibold text-lg"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DealCheck Vision
          </span>
        </div>
        <SignUp
          appearance={{
            variables: {
              colorPrimary: '#1d4ed8',
              fontFamily: 'var(--font-source-sans)',
              borderRadius: '0.5rem',
            },
            elements: {
              card: 'border border-slate-200 shadow-sm',
              headerTitle: 'tracking-tight',
            },
          }}
        />
      </div>
    </div>
  );
}
