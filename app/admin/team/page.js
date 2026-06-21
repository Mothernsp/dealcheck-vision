import { auth } from '@clerk/nextjs/server';
import { isAdminUser } from '@/lib/admin';
import { loadTeamData } from '@/lib/team';
import TeamManager from './TeamManager';

// Admin-only Stores tab: create stores and invite/add their staff. Gated by
// admin/layout.js + this check (defense in depth). A "store" is a Clerk org.
export const dynamic = 'force-dynamic';

export default async function StoresPage() {
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
    console.error('[admin/team] page load failed:', err);
    loadError = 'Could not load stores. Is Organizations enabled in Clerk?';
  }

  return (
    <main className="mx-auto max-w-5xl w-full px-6 sm:px-8 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Stores</h1>
      <p className="mt-1 text-sm text-slate-500 max-w-[68ch]">
        Create a store and add its staff. Invite a new person by email (they get a link
        to join), or add someone who already has an account directly. Everyone is scoped
        to the stores they belong to.
      </p>
      {loadError ? (
        <p className="mt-6 text-sm text-rose-600">{loadError}</p>
      ) : (
        <TeamManager initialStores={stores} initialUsers={users} />
      )}
    </main>
  );
}
