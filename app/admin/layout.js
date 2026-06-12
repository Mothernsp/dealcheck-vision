import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import AppHeader from '@/app/AppHeader';

// Shared shell for every /admin route: gate on ADMIN_USER_IDS once here, then
// render the unified header (with the Deals / Optimization / Costs tabs). Child
// pages keep their own gate too as defense-in-depth, but non-admins never get
// past this layout.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-slate-500">
          Admin access required. Add your Clerk user id to <code>ADMIN_USER_IDS</code>.
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-full bg-slate-50">
      <AppHeader isAdmin />
      {children}
    </div>
  );
}
