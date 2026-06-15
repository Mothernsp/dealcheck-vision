import { SignIn } from '@clerk/nextjs';
import Logo from '../../Logo';

export default function SignInPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-1.5">
          <Logo />
          <span
            className="text-slate-900 font-semibold text-lg"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DealCheck Vision
          </span>
        </div>
        <SignIn
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
