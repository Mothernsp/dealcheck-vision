'use client';

import { useState } from 'react';
import { PRIORITIES } from '@/lib/compliance-settings.mjs';
import { priorityMeta } from '@/lib/status';
import { PRIORITY_ICONS } from '@/app/StatusIcons';

// Priority options for the selects, derived from the single source of truth
// (PRIORITIES) + shared presentation meta — no second list to drift.
const PRIORITY_OPTIONS = PRIORITIES.map((value) => ({ value, ...priorityMeta(value) }));

const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-slate-400';

export default function OptimizationManager({ initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [instruction, setInstruction] = useState('');
  const [priority, setPriority] = useState('cautious');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const activeCount = items.filter((i) => i.enabled).length;

  async function api(url, options) {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  async function handleAdd(e) {
    e.preventDefault();
    const text = instruction.trim();
    if (!text) return;
    setAdding(true);
    setError(null);
    try {
      const { item } = await api('/api/admin/optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text, priority }),
      });
      setItems((prev) => [...prev, item]);
      setInstruction('');
      setPriority('cautious');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function patchItem(id, patch) {
    setBusyId(id);
    setError(null);
    try {
      const { item } = await api(`/api/admin/optimization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setItems((prev) => prev.map((it) => (it.id === id ? item : it)));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(id) {
    setBusyId(id);
    setError(null);
    try {
      await api(`/api/admin/optimization/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditText(item.instruction);
  }

  async function saveEdit(id) {
    const text = editText.trim();
    if (!text) return;
    const ok = await patchItem(id, { instruction: text });
    if (ok) setEditingId(null);
  }

  return (
    <div className="mt-6 max-w-3xl">
      <div className="mb-4 text-sm text-slate-400 tnum">
        {items.length} {items.length === 1 ? 'rule' : 'rules'}
        {items.length > 0 && ` · ${activeCount} active`}
      </div>

      {/* New rule */}
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className={SECTION_LABEL}>New rule</h2>
        </div>
        <form onSubmit={handleAdd} className="p-5">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Fail the deal if the odometer reading is missing on the Bill of Sale."
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="text-slate-500">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} — {p.hint}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={adding || !instruction.trim()}
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {adding ? 'Adding…' : 'Add rule'}
            </button>
          </div>
        </form>
      </section>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {/* Rules list */}
      <section className="mt-5 rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className={SECTION_LABEL}>Rules</h2>
        </div>

        {items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">No rules yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Add one above and it takes effect on the next deal.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const meta = priorityMeta(item.priority);
              const Icon = PRIORITY_ICONS[item.priority] || PRIORITY_ICONS.cautious;
              const busy = busyId === item.id;
              const editing = editingId === item.id;
              const confirming = confirmingId === item.id;
              return (
                <li
                  key={item.id}
                  className={`px-5 py-4 border-l-2 ${meta.rail} ${item.enabled ? '' : 'opacity-60'} ${busy ? 'pointer-events-none' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">{item.instruction}</p>
                      )}

                      {/* Meta row: badge (left) + actions (right), wraps on narrow screens */}
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${meta.chip}`}>
                            {meta.label}
                          </span>
                          {!item.enabled && <span className="text-xs text-slate-400">Disabled</span>}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {editing ? (
                            <>
                              <button
                                onClick={() => saveEdit(item.id)}
                                disabled={!editText.trim()}
                                className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-40 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : confirming ? (
                            <>
                              <span className="text-xs text-slate-500">Delete this rule?</span>
                              <button
                                onClick={() => setConfirmingId(null)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => deleteItem(item.id)}
                                className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700 active:translate-y-px transition-all"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <>
                              <select
                                value={item.priority}
                                onChange={(e) => patchItem(item.id, { priority: e.target.value })}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                aria-label="Priority"
                              >
                                {PRIORITY_OPTIONS.map((p) => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => patchItem(item.id, { enabled: !item.enabled })}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                {item.enabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => startEdit(item)}
                                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setConfirmingId(item.id)}
                                aria-label="Delete rule"
                                className="rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
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
