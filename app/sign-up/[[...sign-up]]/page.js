import { SignUp } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Logo from '../../Logo';

// Registration is invitation-only (Clerk Restrictions -> Sign-up mode:
// Restricted). Self-serve visitors who land here are bounced to /sign-in.
//
// The ONE exception is a Clerk invitation link: those arrive at this route with
// a `__clerk_ticket` query param and MUST still render <SignUp> so the invited
// dealership user can set their credentials and finish joining. Redirecting
// unconditionally would break invitation acceptance.
export default async function SignUpPage({ searchParams }) {
  const params = await searchParams;
  const hasInvitation = Boolean(params?.__clerk_ticket);

  if (!hasInvitation) {
    redirect('/sign-in');
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-8 bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        <Logo />
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
