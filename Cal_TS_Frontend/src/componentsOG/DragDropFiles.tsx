import { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
type DetectedFormat = 'claude_native' | 'clean' | 'unknown';

interface JobStats {
  conversations_created?: number;
  conversations_updated?: number;
  conversations_skipped?: number;
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
interface PresignResponse {
  s3_key:       string;
  upload_url:   string;
  content_type: string;
  expires_in:   number;
}
interface DragDropFilesProps {
  selectedAccount?: string | null;
}

type Phase =
  | 'idle'
  | 'reading'      // parsing/detecting locally
  | 'submitting'   // direct POST (small files)
  | 'presigning'   // step 1 of large-file path
  | 'uploading'    // step 2 of large-file path (PUT to S3 with progress)
  | 'enqueuing'    // step 3 of large-file path
  | 'polling';     // job-status polling (both paths)

const POLL_INTERVAL_MS  = 2000;
const API_BASE          = import.meta.env.VITE_API_BASE_URL ?? '';

// API Gateway caps request bodies at 10 MB. Stay safely below that for the
// direct POST; everything larger goes through the presigned-S3 path which has
// no such limit (Lambda /tmp + memory cap is the only ceiling).
const DIRECT_POST_LIMIT = 8 * 1024 * 1024;        // 8 MB
const MAX_JSON_BYTES    = 2 * 1024 * 1024 * 1024; // 2 GB

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DragDropFiles({ selectedAccount }: DragDropFilesProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [phase,      setPhase]      = useState<Phase>('idle');
  const [uploadPct,  setUploadPct]  = useState(0);
  const [detected,   setDetected]   = useState<DetectedFormat | null>(null);
  const [fileInfo,   setFileInfo]   = useState<{ name: string; size: number } | null>(null);
  const [jobStatus,  setJobStatus]  = useState<JobStatus | null>(null);
  const [error,      setError]      = useState<string | null>(null);
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
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          setPhase('idle');
        }
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
    e.target.value = '';
  };

  const reset = () => {
    stopPolling();
    setDetected(null);
    setFileInfo(null);
    setJobStatus(null);
    setError(null);
    setPhase('idle');
    setUploadPct(0);
  };

  // ── XHR PUT with progress (used by the large-file path) ────────────────────
  const putWithProgress = (
    url: string,
    blob: Blob,
    contentType: string,
    onProgress: (pct: number) => void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`S3 PUT failed: ${xhr.status} ${xhr.statusText}`));
      });
      xhr.addEventListener('error', () => reject(new Error('Network error during S3 upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
      xhr.send(blob);
    });

  // ── Main pipeline ──────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Only JSON files are accepted on this tab. ChatGPT ZIPs belong on the ChatGPT tab.');
      return;
    }
    if (file.size > MAX_JSON_BYTES) {
      setError(`File too large (${formatSize(file.size)}). Limit is 2 GB.`);
      return;
    }
    reset();
    setFileInfo({ name: file.name, size: file.size });
    setPhase('reading');

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(await file.text());
    } catch {
      setError('Invalid JSON file format');
      setPhase('idle');
      return;
    }
    if (!Array.isArray(jsonData)) {
      setError('JSON must be an array of conversations');
      setPhase('idle');
      return;
    }

    const fmt = detectFormat(jsonData);
    setDetected(fmt);

    if (fmt === 'unknown') {
      setError(
        'Could not recognise the conversation shape. ' +
        'Expected either Claude native (uuid/name/chat_messages) or the clean schema (id/title/messages).'
      );
      setPhase('idle');
      return;
    }

    // Branch: small files → direct POST. Large files → presigned-S3 path.
    if (file.size <= DIRECT_POST_LIMIT) {
      await submitDirect(fmt, jsonData);
    } else if (fmt === 'claude_native') {
      await submitViaPresign(file);
    } else {
      // Clean-schema large uploads not supported yet — /json has no presign sibling.
      setError(
        `This file is ${formatSize(file.size)} but only Claude-native exports support ` +
        `the large-file pathway. Convert to native format or split into smaller files.`
      );
      setPhase('idle');
    }
  };

  // ── Direct POST (≤ 8 MB) ───────────────────────────────────────────────────
  const submitDirect = async (fmt: DetectedFormat, jsonData: unknown[]) => {
    const url = endpointFor(fmt, selectedAccount);
    if (!url) { setPhase('idle'); return; }
    setPhase('submitting');

    try {
      const res = await fetch(url, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(jsonData),
      });

      if (res.status === 401) {
        setError('Session expired. Please log in again.');
        setPhase('idle');
        return;
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = (body as { detail?: string }).detail ?? `Server ${res.status}`;
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        setPhase('idle');
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
        setPhase('polling');
        startPolling(queued.job_id);
      } else {
        setJobStatus({
          job_id:          'sync',
          status:          'completed',
          total_items:     jsonData.length,
          processed_items: jsonData.length,
          result_stats:    (body as { statistics?: JobStats }).statistics ?? (body as JobStats),
          updated_at:      new Date().toISOString(),
        });
        setPhase('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred');
      setPhase('idle');
    }
  };

  // ── Presigned-S3 path (> 8 MB, Claude-native only) ─────────────────────────
  const submitViaPresign = async (file: File) => {
    try {
      // 1. Get presigned PUT URL
      setPhase('presigning');
      const presignRes = await fetch(`${API_BASE}/api/v1/ArjunJson/claude/upload/presign`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Presign failed (${presignRes.status})`);
      }
      const presign = await presignRes.json() as PresignResponse;

      // 2. PUT to S3 with live progress
      setPhase('uploading');
      await putWithProgress(presign.upload_url, file, presign.content_type, setUploadPct);

      // 3. Tell backend the file landed — pass selectedAccount through so the
      //    worker imports under the same account the direct path would.
      setPhase('enqueuing');
      const accountQuery = selectedAccount ? `?account=${encodeURIComponent(selectedAccount)}` : '';
      const procRes = await fetch(
        `${API_BASE}/api/v1/ArjunJson/claude/upload/process${accountQuery}`,
        {
          method:      'POST',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body: JSON.stringify({ s3_key: presign.s3_key, file_size: file.size }),
        },
      );
      if (!procRes.ok) {
        const err = await procRes.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail ?? `Enqueue failed (${procRes.status})`);
      }
      const queued = await procRes.json() as QueuedResponse;

      setJobStatus({
        job_id:          queued.job_id,
        status:          'pending',
        total_items:     queued.total_items ?? 1,
        processed_items: 0,
        updated_at:      new Date().toISOString(),
      });
      setPhase('polling');
      startPolling(queued.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('idle');
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isBusy = phase !== 'idle';
  const isDone = jobStatus?.status === 'completed' || jobStatus?.status === 'failed';
  const progressPct =
    jobStatus && jobStatus.total_items > 0
      ? Math.round((jobStatus.processed_items / jobStatus.total_items) * 100)
      : 0;

  const phaseLabel = (): string => {
    switch (phase) {
      case 'reading':     return 'Reading file…';
      case 'submitting':  return 'Uploading…';
      case 'presigning':  return 'Requesting upload URL…';
      case 'uploading':   return `Uploading to S3 ${uploadPct}%`;
      case 'enqueuing':   return 'Queueing import…';
      case 'polling':     return 'Importing…';
      default:            return 'Processing…';
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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
            ${isBusy ? 'pointer-events-none opacity-90' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-6">
            {isBusy ? (
              <>
                <Loader className="w-16 h-16 text-blue-500 animate-spin" />
                <div className="space-y-2">
                  <p className="text-xl font-medium text-slate-800">{phaseLabel()}</p>
                  <p className="text-slate-500">
                    {detected ? `Detected: ${formatLabel(detected)}` : 'Reading file'}
                  </p>
                  {fileInfo && (
                    <p className="text-xs text-slate-400">
                      {fileInfo.name} · {formatSize(fileInfo.size)}
                      {fileInfo.size > DIRECT_POST_LIMIT && ' · large-file path'}
                    </p>
                  )}
                  {selectedAccount && (
                    <p className="text-xs text-blue-600">Account: {selectedAccount}</p>
                  )}
                </div>

                {phase === 'uploading' && (
                  <div className="w-full max-w-md mt-2">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>Uploading to S3</span><span>{uploadPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                        style={{ width: `${uploadPct}%` }}
                      />
                    </div>
                  </div>
                )}
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
                    Native Claude (uuid/chat_messages) or clean schema (id/messages). Up to 2 GB.
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
                {fileInfo && ` · ${formatSize(fileInfo.size)}`}
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
              {jobStatus.result_stats.conversations_skipped != null && (
                <StatCard label="Conversations skipped" value={jobStatus.result_stats.conversations_skipped} />
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
                  {fileInfo && ` · ${formatSize(fileInfo.size)}`}
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