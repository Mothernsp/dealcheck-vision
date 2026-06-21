import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { loadTeamData } from '@/lib/team';
import UsersManager from './UsersManager';

// Admin-only Users tab: every person with an account, the stores they belong to,
// and a way to add them to another store. Gated by admin/layout.js + this check.
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { userId } = await auth();
  if (!isAdminUser(userId)) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Forbidden</h1>
        <p className="mt-2 text-sm text-slate-500">Admin access required.</p>
      </main>
    );
  }

  let stores = [];
  let users = [];
  let loadError = null;
  try {
    ({ stores, users } = await loadTeamData());
  } catch (err) {
    console.error('[admin/users] page load failed:', err);
    loadError = 'Could not load users. Is Organizations enabled in Clerk?';
  }

  return (
    <main className="mx-auto max-w-5xl w-full px-6 sm:px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Users</h1>
      <p className="mt-1 text-sm text-slate-500 max-w-[68ch]">
        Everyone with an account, and the stores they belong to. Add a person to another
        store to give them access to its deals.
      </p>
      {loadError ? (
        <p className="mt-6 text-sm text-rose-600">{loadError}</p>
      ) : (
        <UsersManager initialStores={stores} initialUsers={users} />
      )}
    </main>
  );
}
