'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '../Logo';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const addFiles = useCallback((incoming) => {
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...Array.from(incoming).filter((f) => !existing.has(f.name))];
    });
  }, []);

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) return;
    setError(null);
    setStatus('uploading');

    const form = new FormData();
    for (const f of files) form.append('files', f);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      router.push(`/deals/${json.dealId}`);
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  const isUploading = status === 'uploading';

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo />
            <span className="font-semibold tracking-tight text-slate-900 group-hover:text-slate-600 transition-colors">
              DealCheck <span className="text-slate-400 font-normal">Vision</span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All deals
          </Link>
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-6 sm:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New deal</h1>
          <p className="text-sm text-slate-500 mt-1">Upload the deal jacket to run a compliance check.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div
            onClick={() => !isUploading && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed px-8 py-14 text-center transition-colors ${
              isUploading
                ? 'cursor-default border-slate-100 bg-slate-50'
                : dragging
                ? 'border-blue-400 bg-blue-50 cursor-copy'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50 cursor-pointer'
            }`}
          >
            <div className="mx-auto mb-4 h-11 w-11 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-700">
              {dragging ? 'Drop to add files' : 'Drop files here or click to browse'}
            </p>
            <p className="text-xs text-slate-400 mt-1">PDF, PNG, JPG, TIFF. Scanned documents.</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/tiff"
              onChange={(e) => addFiles(e.target.files || [])}
              disabled={isUploading}
              className="sr-only"
            />
          </div>

          {files.length > 0 && (
            <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {files.map((f) => (
                <li key={f.name} className="flex items-center gap-3 px-4 py-3">
                  <svg className="h-4 w-4 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span className="flex-1 text-sm text-slate-700 truncate font-mono">{f.name}</span>
                  <span className="text-xs text-slate-400 shrink-0 tnum">{formatSize(f.size)}</span>
                  {!isUploading && (
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      aria-label="Remove file"
                      className="text-slate-300 hover:text-rose-600 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isUploading || files.length === 0}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isUploading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading…
                </>
              ) : files.length > 0 ? (
                `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
              ) : (
                'Upload files'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
