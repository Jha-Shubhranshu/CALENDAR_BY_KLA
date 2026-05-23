import React, { useState, useEffect, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Loader, FileText, X, AlertCircle } from 'lucide-react';

interface FileWithStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  result_stats?: {
    notes_created: number;
    notes_skipped: number;
    labels_created: number;
    labels_linked: number;
    media_created: number;
    checklist_items_created: number;
    errors: string[];
  };
  error?: string;
  updated_at: string;
}

interface QueuedResponse {
  job_id: string;
  status: string;
  total_items: number;
  message: string;
  poll_url: string;
}

const POLL_INTERVAL_MS = 2000;
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export const GoogleKeepBulkImport: React.FC = () => {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

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
        }
      } catch {
        // Transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const jsonFiles = selected.filter(f => f.name.endsWith('.json'));

    if (jsonFiles.length !== selected.length) {
      alert('Only .json files are accepted. Non-JSON files were filtered out.');
    }

    setFiles(prev => [...prev, ...jsonFiles.map(f => ({ file: f, status: 'pending' as const }))]);
    setJobStatus(null);
    setError(null);
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const clearAll = () => {
    stopPolling();
    setFiles([]);
    setJobStatus(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (files.length === 0) return;
    setSubmitting(true);
    setError(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      files.forEach(({ file }) => formData.append('files', file));

      const res = await fetch(`${API_BASE}/api/v1/ArjunJson/google-keep/bulk`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? 'Import request failed');
      }

      const queued: QueuedResponse = await res.json();

      // Seed initial status so the UI renders immediately
      setJobStatus({
        job_id: queued.job_id,
        status: 'pending',
        total_items: queued.total_items,
        processed_items: 0,
        updated_at: new Date().toISOString(),
      });

      startPolling(queued.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct =
    jobStatus && jobStatus.total_items > 0
      ? Math.round((jobStatus.processed_items / jobStatus.total_items) * 100)
      : 0;

  const isDone = jobStatus?.status === 'completed' || jobStatus?.status === 'failed';

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Bulk Import from Google Keep</h2>

      {/* Drop zone */}
      {!jobStatus && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <input
            type="file"
            accept=".json"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="bulk-file-upload"
            disabled={submitting}
          />
          <label
            htmlFor="bulk-file-upload"
            className={`cursor-pointer text-blue-600 hover:text-blue-700 ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Select Multiple JSON Files
          </label>
          <p className="text-sm text-gray-500 mt-2">
            Upload multiple Google Keep export files at once
          </p>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && !jobStatus && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">Selected Files ({files.length})</h3>
            <button onClick={clearAll} className="text-sm text-red-600 hover:text-red-700" disabled={submitting}>
              Clear All
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{f.file.name}</p>
                    <p className="text-xs text-gray-500">{formatSize(f.file.size)}</p>
                  </div>
                </div>
                {!submitting && (
                  <button onClick={() => removeFile(i)} className="ml-3 text-gray-400 hover:text-red-600">
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || files.length === 0}
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <Loader className="animate-spin mr-2 h-5 w-5" />
                Queuing import...
              </span>
            ) : (
              `Import ${files.length} File${files.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <XCircle className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Import Failed</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Progress / result */}
      {jobStatus && (
        <div className={`p-6 rounded-lg border ${
          jobStatus.status === 'failed'
            ? 'bg-red-50 border-red-200'
            : jobStatus.status === 'completed'
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          {/* Header */}
          <div className="flex items-center mb-4">
            {jobStatus.status === 'completed' && <CheckCircle className="text-green-500 mr-3 h-6 w-6" />}
            {jobStatus.status === 'failed' && <XCircle className="text-red-500 mr-3 h-6 w-6" />}
            {(jobStatus.status === 'pending' || jobStatus.status === 'processing') && (
              <Loader className="animate-spin text-blue-500 mr-3 h-6 w-6" />
            )}
            <div>
              <p className="font-semibold text-gray-900">
                {jobStatus.status === 'pending' && 'Import queued…'}
                {jobStatus.status === 'processing' && 'Processing…'}
                {jobStatus.status === 'completed' && 'Import complete'}
                {jobStatus.status === 'failed' && 'Import failed'}
              </p>
              <p className="text-xs text-gray-500">Job ID: {jobStatus.job_id}</p>
            </div>
          </div>

          {/* Progress bar */}
          {!isDone && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{jobStatus.processed_items} / {jobStatus.total_items} notes</span>
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

          {/* Stats (completed) */}
          {jobStatus.status === 'completed' && jobStatus.result_stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 text-sm">
              <Stat label="Notes created" value={jobStatus.result_stats.notes_created} />
              <Stat label="Notes skipped" value={jobStatus.result_stats.notes_skipped} />
              <Stat label="Labels created" value={jobStatus.result_stats.labels_created} />
              <Stat label="Labels linked" value={jobStatus.result_stats.labels_linked} />
              <Stat label="Media files" value={jobStatus.result_stats.media_created} />
              <Stat label="Checklist items" value={jobStatus.result_stats.checklist_items_created} />
            </div>
          )}

          {/* Error detail */}
          {jobStatus.status === 'failed' && jobStatus.error && (
            <div className="mt-2 p-3 bg-red-100 rounded text-sm text-red-800">
              <AlertCircle className="inline h-4 w-4 mr-1" />
              {jobStatus.error}
            </div>
          )}

          {/* Actions */}
          {isDone && (
            <button
              onClick={clearAll}
              className="mt-4 w-full py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              Import More Files
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
