import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader, FileText, X, Download, AlertCircle } from 'lucide-react';

interface FileWithStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface BulkImportStats {
  total_files: number;
  successful_files: number;
  failed_files: number;
  total_notes_created: number;
  total_notes_skipped: number;
  total_labels_created: number;
  total_labels_linked: number;
  total_media_created: number;
  total_checklist_items_created: number;
  failure_report_available: boolean;
  failure_report_filename?: string;
  processing_duration_seconds: number;
}

interface BulkImportResponse {
  success: boolean;
  message: string;
  statistics: BulkImportStats;
  failure_report_url?: string;
}

export const GoogleKeepBulkImport: React.FC = () => {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Filter only JSON files
    const jsonFiles = selectedFiles.filter(f => f.name.endsWith('.json'));
    
    if (jsonFiles.length !== selectedFiles.length) {
      alert('Only .json files are accepted. Non-JSON files were filtered out.');
    }
    
    // Add new files to the list
    const newFiles: FileWithStatus[] = jsonFiles.map(file => ({
      file,
      status: 'pending' as const
    }));
    
    setFiles(prev => [...prev, ...newFiles]);
    setResult(null);
    setError(null);
    
    // Reset the input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setResult(null);
    setError(null);
  };

  const handleBulkImport = async () => {
    if (files.length === 0) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Create FormData with multiple files
      const formData = new FormData();
      files.forEach(({ file }) => {
        formData.append('files', file);
      });

      console.log(`Uploading ${files.length} files...`);

      // Call bulk import API
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ArjunJson/google-keep/bulk`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.detail || 'Bulk import failed');
      }

      const importResult: BulkImportResponse = await response.json();
      console.log('Import result:', importResult);
      
      setResult(importResult);

    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadFailureReport = () => {
    if (result?.failure_report_url) {
      const fullUrl = `${import.meta.env.VITE_API_BASE_URL}${result.failure_report_url}`;
      window.open(fullUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /*
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'processing': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };
  */

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Bulk Import from Google Keep</h2>

      {/* File Upload Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        
        <input
          type="file"
          accept=".json"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="bulk-file-upload"
          disabled={importing}
        />
        
        <label
          htmlFor="bulk-file-upload"
          className={`cursor-pointer text-blue-600 hover:text-blue-700 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Select Multiple JSON Files
        </label>
        
        <p className="text-sm text-gray-500 mt-2">
          Upload multiple Google Keep export files at once
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && !result && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">
              Selected Files ({files.length})
            </h3>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700"
              disabled={importing}
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((fileObj, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
              >
                <div className="flex items-center flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileObj.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileObj.file.size)}
                    </p>
                  </div>
                </div>
                
                {!importing && (
                  <button
                    onClick={() => removeFile(index)}
                    className="ml-3 text-gray-400 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Import Button */}
          <button
            onClick={handleBulkImport}
            disabled={importing || files.length === 0}
            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? (
              <span className="flex items-center justify-center">
                <Loader className="animate-spin mr-2 h-5 w-5" />
                Importing {files.length} files...
              </span>
            ) : (
              `Import ${files.length} File${files.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <XCircle className="text-red-500 mr-3 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Import Failed</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Success Results */}
      {result && (
        <div className={`p-6 rounded-lg border ${
          result.statistics.failed_files === 0 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          {/* Header */}
          <div className="flex items-center mb-4">
            {result.statistics.failed_files === 0 ? (
              <CheckCircle className="text-green-500 mr-3 h-6 w-6" />
            ) : (
              <AlertCircle className="text-yellow-500 mr-3 h-6 w-6" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${
                result.statistics.failed_files === 0 ? 'text-green-900' : 'text-yellow-900'
              }`}>
                {result.message}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Completed in {result.statistics.processing_duration_seconds.toFixed(1)} seconds
              </p>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600">Files Processed</p>
              <p className="text-2xl font-bold text-gray-900">{result.statistics.total_files}</p>
            </div>
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-xs text-gray-600">Successful</p>
              <p className="text-2xl font-bold text-green-600">{result.statistics.successful_files}</p>
            </div>
            {result.statistics.failed_files > 0 && (
              <div className="bg-white p-3 rounded border border-red-200">
                <p className="text-xs text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{result.statistics.failed_files}</p>
              </div>
            )}
            <div className="bg-white p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-600">Notes Created</p>
              <p className="text-2xl font-bold text-blue-600">{result.statistics.total_notes_created}</p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bg-white p-4 rounded border border-gray-200 mb-4">
            <h4 className="font-semibold text-gray-700 mb-3 text-sm">Import Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Labels Created</p>
                <p className="font-semibold">{result.statistics.total_labels_created}</p>
              </div>
              <div>
                <p className="text-gray-600">Labels Linked</p>
                <p className="font-semibold">{result.statistics.total_labels_linked}</p>
              </div>
              <div>
                <p className="text-gray-600">Media Files</p>
                <p className="font-semibold">{result.statistics.total_media_created}</p>
              </div>
              <div>
                <p className="text-gray-600">Checklist Items</p>
                <p className="font-semibold">{result.statistics.total_checklist_items_created}</p>
              </div>
              <div>
                <p className="text-gray-600">Notes Skipped</p>
                <p className="font-semibold">{result.statistics.total_notes_skipped}</p>
              </div>
            </div>
          </div>

          {/* Failure Report Download */}
          {result.statistics.failure_report_available && result.failure_report_url && (
            <div className="bg-white p-4 rounded border border-red-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertCircle className="text-red-500 mr-2 h-5 w-5" />
                  <div>
                    <p className="font-semibold text-gray-900">Failure Report Available</p>
                    <p className="text-sm text-gray-600">
                      {result.statistics.failed_files} file{result.statistics.failed_files !== 1 ? 's' : ''} failed to import
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadFailureReport}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Report
                </button>
              </div>
            </div>
          )}

          {/* Start New Import */}
          <button
            onClick={() => {
              setFiles([]);
              setResult(null);
              setError(null);
            }}
            className="mt-4 w-full py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          >
            Import More Files
          </button>
        </div>
      )}
    </div>
  );
};