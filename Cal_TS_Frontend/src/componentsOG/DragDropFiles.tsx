import { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type DetectedFormat = 'claude_native' | 'clean' | 'unknown';

interface JobStats {
  conversations_created?: number;
  conversations_updated?: number;
  notes_created?: number;
  media_created?: number;
  errors?: Array<{ conversation_uuid?: string; conversation_id?: string; error: string }>;
}

interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  result_stats?: JobStats;
  error?: string;
  updated_at: string;
}

interface QueuedResponse {
  job_id: string;
  status: string;
  total_items: number;
  message: string;
}

interface DragDropFilesProps {
  selectedAccount?: string | null;
}

const POLL_INTERVAL_MS = 2000;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

// ── Format detection ──────────────────────────────────────────────────────────
function detectFormat(items: unknown[]): DetectedFormat {
  if (!Array.isArray(items) || items.length === 0) return 'unknown';
  const first = items[0] as Record<string, unknown> | null;
  if (!first || typeof first !== 'object') return 'unknown';

  if ('chat_messages' in first && 'uuid' in first) return 'claude_native';
  if ('messages' in first && ('title' in first || 'id' in first)) return 'clean';

  return 'unknown';
}

function endpointFor(fmt: DetectedFormat, account: string | null | undefined): string | null {
  const accountParam = account ? `?account=${encodeURIComponent(account)}` : '';

  if (fmt === 'claude_native') return `${API_BASE}/api/v1/ArjunJson/extension/ingest${accountParam}`;
  if (fmt === 'clean')         return `${API_BASE}/api/v1/ArjunJson/json${accountParam}`;
  return null;
}

function formatLabel(fmt: DetectedFormat): string {
  if (fmt === 'claude_native') return 'Claude native export (uuid/name/chat_messages)';
  if (fmt === 'clean')         return 'Clean schema (id/title/messages)';
  return 'unknown';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DragDropFiles({ selectedAccount }: DragDropFilesProps) {
  const [isDragging,  setIsDragging]  = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [detected,    setDetected]    = useState<DetectedFormat | null>(null);
  const [jobStatus,   setJobStatus]   = useState<JobStatus | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/ArjunJson/import/status/${jobId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed') stopPolling();
      } catch { /* transient — keep polling */ }
    }, POLL_INTERVAL_MS);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true);  };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
  };

  const reset = () => {
    stopPolling();
    setDetected(null);
    setJobStatus(null);
    setError(null);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Only JSON files are accepted');
      return;
    }
    reset();
    setIsUploading(true);

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(await file.text());
    } catch {
      setError('Invalid JSON file format');
      setIsUploading(false);
      return;
    }

    if (!Array.isArray(jsonData)) {
      setError('JSON must be an array of conversations');
      setIsUploading(false);
      return;
    }

    const fmt = detectFormat(jsonData);
    setDetected(fmt);

    if (fmt === 'unknown') {
      setError(
        'Could not recognise the conversation shape. ' +
        'Expected either Claude native (uuid/name/chat_messages) or the clean schema (id/title/messages).'
      );
      setIsUploading(false);
      return;
    }

    const url = endpointFor(fmt, selectedAccount);
    if (!url) { setIsUploading(false); return; }

    try {
      const res = await fetch(url, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(jsonData),
      });

      if (res.status === 401) {
        setError('Session expired. Please log in again.');
        setIsUploading(false);
        return;
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = (body as { detail?: string }).detail ?? `Server ${res.status}`;
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        setIsUploading(false);
        return;
      }

      const queued = body as QueuedResponse;
      if (queued.job_id) {
        setJobStatus({
          job_id:          queued.job_id,
          status:          'pending',
          total_items:     queued.total_items ?? jsonData.length,
          processed_items: 0,
          updated_at:      new Date().toISOString(),
        });
        startPolling(queued.job_id);
      } else {
        setJobStatus({
          job_id:          'sync',
          status:          'completed',
          total_items:     jsonData.length,
          processed_items: jsonData.length,
          result_stats:    (body as { statistics?: JobStats }).statistics ?? body as JobStats,
          updated_at:      new Date().toISOString(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  const isDone = jobStatus?.status === 'completed' || jobStatus?.status === 'failed';
  const progressPct =
    jobStatus && jobStatus.total_items > 0
      ? Math.round((jobStatus.processed_items / jobStatus.total_items) * 100)
      : 0;

  return (
    <div className="p-6">
      {/* Drop zone */}
      {!jobStatus && !error && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
            transition-all duration-300 ease-out
            ${isDragging
              ? 'border-blue-400 bg-blue-50 scale-[1.02] shadow-2xl shadow-blue-200'
              : 'border-slate-300 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100'
            }
            ${isUploading ? 'pointer-events-none opacity-75' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-6">
            {isUploading ? (
              <>
                <Loader className="w-16 h-16 text-blue-500 animate-spin" />
                <div className="space-y-2">
                  <p className="text-xl font-medium text-slate-800">Processing…</p>
                  <p className="text-slate-500">
                    {detected ? `Detected: ${formatLabel(detected)}` : 'Reading file'}
                  </p>
                  {selectedAccount && (
                    <p className="text-xs text-blue-600">Account: {selectedAccount}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={`p-6 rounded-full transition-all duration-300
                  ${isDragging
                    ? 'bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-300'
                    : 'bg-gradient-to-br from-blue-100 to-blue-200'
                  }`}
                >
                  <Upload className={`w-12 h-12 transition-colors duration-300 ${isDragging ? 'text-white' : 'text-blue-600'}`} />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-medium text-slate-800">
                    {isDragging ? 'Drop your JSON file' : 'Drop a Claude conversations.json'}
                  </p>
                  <p className="text-slate-500">or click to browse</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Accepts the native Claude export (uuid / chat_messages) or the clean schema (id / messages).
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Job status / result */}
      {jobStatus && (
        <div className={`rounded-2xl p-8 border ${
          jobStatus.status === 'failed'    ? 'border-red-200 bg-red-50/30'   :
          jobStatus.status === 'completed' ? 'border-green-200 bg-green-50/30' : 'border-slate-200'
        }`}>
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 rounded-full shadow-lg ${
              jobStatus.status === 'failed'    ? 'bg-red-500 shadow-red-200'   :
              jobStatus.status === 'completed' ? 'bg-green-500 shadow-green-200' :
                                                 'bg-slate-400 shadow-slate-200'
            }`}>
              {jobStatus.status === 'completed' && <CheckCircle className="w-7 h-7 text-white" />}
              {jobStatus.status === 'failed'    && <XCircle    className="w-7 h-7 text-white" />}
              {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && (
                <Loader className="w-7 h-7 text-white animate-spin" />
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-800 mb-1">
                {jobStatus.status === 'pending'    && 'Queued…'}
                {jobStatus.status === 'processing' && 'Processing…'}
                {jobStatus.status === 'completed'  && 'Import complete'}
                {jobStatus.status === 'failed'     && 'Import failed'}
              </h2>
              <p className="text-sm text-slate-500">
                Detected: <span className="font-mono">{formatLabel(detected ?? 'unknown')}</span>
              </p>
              {selectedAccount && (
                <p className="text-xs text-blue-600 mt-0.5">Account: {selectedAccount}</p>
              )}
              {jobStatus.job_id !== 'sync' && (
                <p className="text-xs text-slate-400 mt-1">Job ID: {jobStatus.job_id}</p>
              )}
            </div>
          </div>

          {!isDone && jobStatus.total_items > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <span>{jobStatus.processed_items} / {jobStatus.total_items}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                     style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}

          {jobStatus.status === 'completed' && jobStatus.result_stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
              {jobStatus.result_stats.conversations_created != null && (
                <StatCard label="Conversations new" value={jobStatus.result_stats.conversations_created} />
              )}
              {jobStatus.result_stats.conversations_updated != null && (
                <StatCard label="Conversations updated" value={jobStatus.result_stats.conversations_updated} />
              )}
              {jobStatus.result_stats.notes_created != null && (
                <StatCard label="Messages imported" value={jobStatus.result_stats.notes_created} />
              )}
              {jobStatus.result_stats.media_created != null && (
                <StatCard label="Images uploaded" value={jobStatus.result_stats.media_created} />
              )}
            </div>
          )}

          {jobStatus.status === 'completed' && jobStatus.result_stats?.errors && jobStatus.result_stats.errors.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                {jobStatus.result_stats.errors.length} conversation(s) failed
              </p>
              <ul className="text-xs text-amber-800 list-disc list-inside max-h-32 overflow-y-auto">
                {jobStatus.result_stats.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">
                      {(e.conversation_uuid || e.conversation_id || '?').slice(0, 8)}…
                    </span>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {jobStatus.status === 'failed' && jobStatus.error && (
            <div className="mt-2 p-3 bg-red-100 rounded-lg text-sm text-red-800">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              {jobStatus.error}
            </div>
          )}

          {isDone && (
            <button
              onClick={reset}
              className="w-full mt-6 py-3 px-6 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium shadow-lg"
            >
              Upload Another File
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && !jobStatus && (
        <div className="rounded-2xl p-8 border border-red-200">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-500 rounded-full shadow-lg shadow-red-200">
              <XCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-800 mb-2">Upload Failed</h2>
              <p className="text-slate-600">{error}</p>
              {detected && (
                <p className="text-xs text-slate-400 mt-2">
                  Detected format: <span className="font-mono">{formatLabel(detected)}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={reset}
            className="w-full mt-4 py-3 px-6 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium shadow-lg"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-100 rounded-lg p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800">{value.toLocaleString()}</p>
    </div>
  );
}