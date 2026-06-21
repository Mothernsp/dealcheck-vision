'use client';

import { useState } from 'react';

const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-400';

async function api(url, options) {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

const post = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const del = (body) => ({
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export default function UsersManager({ initialStores, initialUsers }) {
  const [stores, setStores] = useState(initialStores);
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(null);
  const [pickStore, setPickStore] = useState({}); // userId -> storeId
  const [busyUser, setBusyUser] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // `${userId}:${storeId}`

  async function refresh() {
    try {
      const { stores: s, users: u } = await api('/api/admin/team');
      setStores(s);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addToStore(targetUserId) {
    const storeId = pickStore[targetUserId] || '';
    if (!storeId) return;
    setBusyUser(targetUserId);
    setError(null);
    try {
      await api('/api/admin/team/members', post({ organizationId: storeId, userId: targetUserId }));
      setPickStore((prev) => ({ ...prev, [targetUserId]: '' }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyUser(null);
    }
  }

  async function removeFromStore(targetUserId, storeId) {
    setBusyUser(targetUserId);
    setError(null);
    try {
      await api('/api/admin/team/members', del({ organizationId: storeId, userId: targetUserId }));
      setConfirmRemove(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyUser(null);
    }
  }

  // Stores this user is / isn't a member of.
  function storesFor(userId) {
    const inStores = [];
    const outStores = [];
    for (const s of stores) {
      const isMember = s.members.some((m) => m.userId === userId);
      (isMember ? inStores : outStores).push(s);
    }
    return { inStores, outStores };
  }

  return (
    <div className="mt-6 max-w-3xl">
      <div className="mb-4 text-sm text-slate-400 tnum">
        {users.length} {users.length === 1 ? 'user' : 'users'}
      </div>

      {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className={SECTION_LABEL}>Users</h2>
        </div>

        {users.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No users yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Users appear here once they accept an invitation.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => {
              const { inStores, outStores } = storesFor(u.id);
              const busy = busyUser === u.id;
              return (
                <li key={u.id} className={`px-5 py-4 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{u.email || u.id}</p>
                      {u.name && <p className="text-xs text-slate-400 mt-0.5">{u.name}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {inStores.length === 0 ? (
                          <span className="text-xs text-slate-400">No stores</span>
                        ) : (
                          inStores.map((s) => {
                            const confirming = confirmRemove === `${u.id}:${s.id}`;
                            return confirming ? (
                              <span
                                key={s.id}
                                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-rose-50 text-rose-700"
                              >
                                Remove from {s.name}?
                                <button
                                  onClick={() => removeFromStore(u.id, s.id)}
                                  className="font-semibold underline hover:no-underline"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmRemove(null)}
                                  className="text-slate-500 hover:text-slate-700"
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <span
                                key={s.id}
                                className="group inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600"
                              >
                                {s.name}
                                <button
                                  onClick={() => setConfirmRemove(`${u.id}:${s.id}`)}
                                  aria-label={`Remove from ${s.name}`}
                                  className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {outStores.length > 0 && (
                      <div className="flex items-end gap-2 shrink-0">
                        <select
                          value={pickStore[u.id] || ''}
                          onChange={(e) => setPickStore((p) => ({ ...p, [u.id]: e.target.value }))}
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          aria-label="Add to store"
                        >
                          <option value="">Add to store…</option>
                          {outStores.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => addToStore(u.id)}
                          disabled={!(pickStore[u.id] || '')}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
