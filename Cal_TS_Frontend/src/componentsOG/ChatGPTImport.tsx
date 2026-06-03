import React, { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader, FileArchive, X, AlertCircle } from 'lucide-react';

interface ChatGPTJobStats {
  conversations_created: number;
  conversations_updated: number;
  notes_created: number;
  media_created: number;
  errors: Array<{ conversation_id: string; error: string }>;
}

interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  result_stats?: ChatGPTJobStats;
  error?: string;
  updated_at: string;
}

interface PresignResponse {
  s3_key:       string;
  upload_url:   string;
  content_type: string;
  expires_in:   number;
}

interface QueuedResponse {
  job_id: string;
  status: string;
  total_items: number;
  message: string;
}

type Phase = 'idle' | 'presigning' | 'uploading' | 'enqueuing' | 'polling';

const POLL_INTERVAL_MS = 2000;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024;  // 2 GB

export const ChatGPTImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = (jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/ArjunJson/import/status/${jobId}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const data: JobStatus = await res.json();
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          stopPolling();
          setPhase('idle');
        }
      } catch { /* keep polling on transient errors */ }
    }, POLL_INTERVAL_MS);
  };

  const validateAndSet = (f: File | undefined) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      setError('Please upload the .zip file from chatgpt.com → Settings → Data Controls → Export data.');
      return;
    }
    if (f.size > MAX_ZIP_BYTES) {
      setError(`File too large (${(f.size / 1024 / 1024 / 1024).toFixed(2)} GB). Limit is 2 GB.`);
      return;
    }
    setFile(f);
    setError(null);
    setJobStatus(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSet(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSet(e.dataTransfer.files?.[0]);
  };

  const clearAll = () => {
    stopPolling();
    setFile(null);
    setJobStatus(null);
    setError(null);
    setPhase('idle');
    setUploadPct(0);
  };

  // ── upload pipeline ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setJobStatus(null);
    setUploadPct(0);

    try {
      // 1. Presign
      setPhase('presigning');
      const presignRes = await fetch(`${API_BASE}/api/v1/ArjunJson/chatgpt/upload/presign`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.detail ?? `Presign failed (${presignRes.status})`);
      }
      const presign: PresignResponse = await presignRes.json();

      // 2. PUT directly to S3 with progress
      setPhase('uploading');
      await putWithProgress(presign.upload_url, file, presign.content_type, (pct) => {
        setUploadPct(pct);
      });

      // 3. Tell backend the upload finished
      setPhase('enqueuing');
      const processRes = await fetch(`${API_BASE}/api/v1/ArjunJson/chatgpt/upload/process`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3_key: presign.s3_key, file_size: file.size }),
      });
      if (!processRes.ok) {
        const err = await processRes.json().catch(() => ({}));
        throw new Error(err.detail ?? `Enqueue failed (${processRes.status})`);
      }
      const queued: QueuedResponse = await processRes.json();
      setJobStatus({
        job_id:          queued.job_id,
        status:          'pending',
        total_items:     queued.total_items,
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

  // ── helpers ────────────────────────────────────────────────────────────

  const putWithProgress = (
    url: string,
    blob: File,
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
      xhr.addEventListener('abort',  () => reject(new Error('Upload aborted')));
      xhr.send(blob);
    });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const phaseLabel = (): string => {
    switch (phase) {
      case 'presigning':  return 'Requesting upload URL…';
      case 'uploading':   return `Uploading to S3 ${uploadPct}%`;
      case 'enqueuing':   return 'Queueing import…';
      case 'polling':     return 'Importing…';
      default:            return 'Import ChatGPT Export';
    }
  };

  const isBusy = phase !== 'idle';
  const isDone = jobStatus?.status === 'completed' || jobStatus?.status === 'failed';
  const progressPct = jobStatus && jobStatus.total_items > 0
    ? Math.round((jobStatus.processed_items / jobStatus.total_items) * 100)
    : 0;

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Import from ChatGPT</h2>
        <p className="text-sm text-gray-600">
          Upload the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">.zip</code> file
          you downloaded from <span className="font-mono text-xs">chatgpt.com → Settings → Data Controls → Export data</span>.
          Large exports are uploaded directly to S3 — your conversations and embedded images are processed in the background.
        </p>
      </div>

      {!jobStatus && !file && (
        <label
          htmlFor="chatgpt-zip-upload"
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors duration-200
            ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-blue-600 font-medium">
            {isDragging ? 'Drop the ZIP file here' : 'Click to select your ChatGPT export ZIP'}
          </p>
          <p className="text-sm text-gray-500 mt-1">or drag and drop</p>
          <input
            id="chatgpt-zip-upload"
            type="file"
            accept=".zip,application/zip"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isBusy}
          />
        </label>
      )}

      {file && !jobStatus && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            <FileArchive className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
            </div>
          </div>
          {!isBusy && (
            <button onClick={clearAll} className="ml-3 text-gray-400 hover:text-red-600 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {file && !jobStatus && (
        <>
          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isBusy ? (
              <span className="flex items-center justify-center">
                <Loader className="animate-spin mr-2 h-5 w-5" />
                {phaseLabel()}
              </span>
            ) : 'Import ChatGPT Export'}
          </button>

          {phase === 'uploading' && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Uploading to S3</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <XCircle className="text-red-500 mr-3 flex-shrink-0 mt-0.5 h-5 w-5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Import Failed</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {jobStatus && (
        <div className={`mt-4 p-6 rounded-lg border ${
          jobStatus.status === 'failed'    ? 'bg-red-50 border-red-200'
          : jobStatus.status === 'completed' ? 'bg-green-50 border-green-200'
          :                                     'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center mb-4">
            {jobStatus.status === 'completed' && <CheckCircle className="text-green-500 mr-3 h-6 w-6" />}
            {jobStatus.status === 'failed'    && <XCircle    className="text-red-500   mr-3 h-6 w-6" />}
            {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && (
              <Loader className="animate-spin text-blue-500 mr-3 h-6 w-6" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {jobStatus.status === 'pending'    && 'Queued — server is unpacking the ZIP…'}
                {jobStatus.status === 'processing' && 'Processing conversations…'}
                {jobStatus.status === 'completed'  && 'Import complete'}
                {jobStatus.status === 'failed'     && 'Import failed'}
              </p>
              <p className="text-xs text-gray-500">Job ID: {jobStatus.job_id}</p>
            </div>
          </div>

          {!isDone && jobStatus.total_items > 0 && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{jobStatus.processed_items} / {jobStatus.total_items}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {jobStatus.status === 'completed' && jobStatus.result_stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-sm">
              <Stat label="Conversations new"     value={jobStatus.result_stats.conversations_created} />
              <Stat label="Conversations updated" value={jobStatus.result_stats.conversations_updated} />
              <Stat label="Messages imported"     value={jobStatus.result_stats.notes_created} />
              <Stat label="Images uploaded"       value={jobStatus.result_stats.media_created} />
            </div>
          )}

          {jobStatus.status === 'completed' && jobStatus.result_stats?.errors && jobStatus.result_stats.errors.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                <AlertCircle className="inline h-4 w-4 mr-1" />
                {jobStatus.result_stats.errors.length} conversation(s) failed
              </p>
              <ul className="text-xs text-amber-800 list-disc list-inside max-h-32 overflow-y-auto">
                {jobStatus.result_stats.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    <span className="font-mono">{e.conversation_id.slice(0, 8)}…</span>: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {jobStatus.status === 'failed' && jobStatus.error && (
            <div className="mt-2 p-3 bg-red-100 rounded text-sm text-red-800">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              {jobStatus.error}
            </div>
          )}

          {isDone && (
            <button
              onClick={clearAll}
              className="mt-4 w-full py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Import another export
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white p-3 rounded border border-gray-200">
    <p className="text-xs text-gray-600">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);