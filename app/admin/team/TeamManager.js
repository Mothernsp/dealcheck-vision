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

export default function TeamManager({ initialStores, initialUsers }) {
  const [stores, setStores] = useState(initialStores);
  const [users, setUsers] = useState(initialUsers);
  const [error, setError] = useState(null);

  // Create-store form
  const [storeName, setStoreName] = useState('');
  const [creating, setCreating] = useState(false);

  // Per-store transient UI state, keyed by store id
  const [expanded, setExpanded] = useState({});
  const [inviteEmail, setInviteEmail] = useState({});
  const [pickUser, setPickUser] = useState({});
  const [busyStore, setBusyStore] = useState(null);
  const [busyInvite, setBusyInvite] = useState(null);

  async function refresh() {
    try {
      const { stores: s, users: u } = await api('/api/admin/team');
      setStores(s);
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = storeName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      await api('/api/admin/team/organizations', post({ name }));
      setStoreName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(storeId) {
    const email = (inviteEmail[storeId] || '').trim();
    if (!email) return;
    setBusyStore(storeId);
    setError(null);
    try {
      await api('/api/admin/team/invitations', post({ organizationId: storeId, emailAddress: email }));
      setInviteEmail((prev) => ({ ...prev, [storeId]: '' }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStore(null);
    }
  }

  async function handleAddExisting(storeId) {
    const targetUserId = pickUser[storeId] || '';
    if (!targetUserId) return;
    setBusyStore(storeId);
    setError(null);
    try {
      await api('/api/admin/team/members', post({ organizationId: storeId, userId: targetUserId }));
      setPickUser((prev) => ({ ...prev, [storeId]: '' }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyStore(null);
    }
  }

  async function revoke(storeId, invitationId) {
    setBusyInvite(invitationId);
    setError(null);
    try {
      await api('/api/admin/team/invitations', del({ organizationId: storeId, invitationId }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyInvite(null);
    }
  }

  // Resend = revoke the pending invite, then send a fresh one to the same email.
  async function resend(storeId, invitation) {
    setBusyInvite(invitation.id);
    setError(null);
    try {
      await api('/api/admin/team/invitations', del({ organizationId: storeId, invitationId: invitation.id }));
      await api('/api/admin/team/invitations', post({ organizationId: storeId, emailAddress: invitation.emailAddress }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyInvite(null);
    }
  }

  // Users who already have an account but aren't yet a member of this store.
  function availableUsers(store) {
    const memberIds = new Set(store.members.map((m) => m.userId).filter(Boolean));
    return users.filter((u) => !memberIds.has(u.id));
  }

  return (
    <div className="mt-6 max-w-3xl">
      <div className="mb-4 text-sm text-slate-400 tnum">
        {stores.length} {stores.length === 1 ? 'store' : 'stores'}
      </div>

      {/* New store */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className={SECTION_LABEL}>New store</h2>
        </div>
        <form onSubmit={handleCreate} className="p-5 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[16rem]">
            <span className="block text-sm text-slate-500 mb-1.5">Store name</span>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="e.g. Smith Toyota"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </label>
          <button
            type="submit"
            disabled={creating || !storeName.trim()}
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {creating ? 'Creating…' : 'Create store'}
          </button>
        </form>
      </section>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {/* Store list */}
      <section className="mt-5 rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className={SECTION_LABEL}>Stores</h2>
        </div>

        {stores.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No stores yet</p>
            <p className="mt-1 text-sm text-slate-400">Create one above, then add its staff.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {stores.map((s) => {
              const isOpen = !!expanded[s.id];
              const pending = s.pendingInvitations || [];
              const addable = availableUsers(s);
              return (
                <li key={s.id} className="px-5 py-4">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [s.id]: !p[s.id] }))}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.members.length} {s.members.length === 1 ? 'member' : 'members'}
                        {pending.length > 0 && ` · ${pending.length} pending`}
                      </p>
                    </div>
                    <svg
                      aria-hidden="true"
                      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-4">
                      {/* Invite by email */}
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex-1 min-w-[14rem]">
                          <span className="block text-xs text-slate-500 mb-1">Invite a new person by email</span>
                          <input
                            type="email"
                            value={inviteEmail[s.id] || ''}
                            onChange={(e) => setInviteEmail((p) => ({ ...p, [s.id]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleInvite(s.id);
                              }
                            }}
                            placeholder="staff@store.com"
                            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </label>
                        <button
                          onClick={() => handleInvite(s.id)}
                          disabled={busyStore === s.id || !(inviteEmail[s.id] || '').trim()}
                          className="inline-flex items-center rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                          {busyStore === s.id ? 'Working…' : 'Send invite'}
                        </button>
                      </div>

                      {/* Add an existing user */}
                      {addable.length > 0 && (
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex-1 min-w-[14rem]">
                            <span className="block text-xs text-slate-500 mb-1">Add someone who already has an account</span>
                            <select
                              value={pickUser[s.id] || ''}
                              onChange={(e) => setPickUser((p) => ({ ...p, [s.id]: e.target.value }))}
                              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              <option value="">Select a user…</option>
                              {addable.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.email || u.id}{u.name ? ` (${u.name})` : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            onClick={() => handleAddExisting(s.id)}
                            disabled={busyStore === s.id || !(pickUser[s.id] || '')}
                            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Add to store
                          </button>
                        </div>
                      )}

                      {/* Members */}
                      <div>
                        <h3 className={SECTION_LABEL}>Members</h3>
                        {s.members.length === 0 ? (
                          <p className="mt-1 text-sm text-slate-400">No members yet.</p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {s.members.map((m) => (
                              <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-700 truncate">{m.email || m.userId}</span>
                                <span className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                                  {m.role?.replace('org:', '') || 'member'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Pending invitations */}
                      {pending.length > 0 && (
                        <div>
                          <h3 className={SECTION_LABEL}>Pending invitations</h3>
                          <ul className="mt-2 space-y-1.5">
                            {pending.map((inv) => {
                              const busy = busyInvite === inv.id;
                              return (
                                <li
                                  key={inv.id}
                                  className={`flex flex-wrap items-center justify-between gap-2 text-sm ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                  <span className="text-slate-700 truncate">{inv.emailAddress}</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() => resend(s.id, inv)}
                                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                      Resend
                                    </button>
                                    <button
                                      onClick={() => revoke(s.id, inv.id)}
                                      className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                                    >
                                      Revoke
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
