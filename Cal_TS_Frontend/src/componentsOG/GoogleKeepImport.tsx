import React, { useState } from 'react';
import { Upload, CheckCircle, XCircle, Loader } from 'lucide-react';

interface ImportStats {
  notes_created: number;
  notes_skipped: number;
  labels_created: number;
  labels_linked: number;
  media_created: number;
  checklist_items_created: number;
  errors: string[];
}

export const GoogleKeepImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStats(null);
      setError(null);
    }
  };

//   const handleImport = async () => {
//     if (!file) return;

//     setImporting(true);
//     setError(null);

//     try {
//       // Read file content
//       const content = await file.text();
//       const notes = JSON.parse(content);

//       // Call API
//       const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ArjunJson/google-keep`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ notes }),
//         credentials: 'include',
//       });

//       if (!response.ok) {
//         throw new Error('Import failed');
//       }

//       const result = await response.json();
//       setStats(result);
      
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'Import failed');
//     } finally {
//       setImporting(false);
//     }
//   };

const handleImport = async () => {
  if (!file) return;

  setImporting(true);
  setError(null);

  try {
    // Read file content
    const content = await file.text();
    let data = JSON.parse(content);

    // ✅ Handle three possible formats:
    // 1. Already wrapped: { notes: [...] }
    // 2. Array of notes: [...]
    // 3. Single note: {...}
    let requestBody;
    
    if (data.notes && Array.isArray(data.notes)) {
      // Already in correct format
      requestBody = data;
    } else if (Array.isArray(data)) {
      // Array of notes - wrap it
      requestBody = { notes: data };
    } else {
      // Single note object - wrap in array
      requestBody = { notes: [data] };
    }

    console.log('Sending request:', requestBody);

    // Call API
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ArjunJson/google-keep`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      credentials: 'include'

    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      throw new Error(errorData.detail || 'Import failed');
    }

    const result = await response.json();
    setStats(result);
    
  } catch (err) {
    console.error('Import error:', err);
    setError(err instanceof Error ? err.message : 'Import failed');
  } finally {
    setImporting(false);
  }
};

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Import from Google Keep</h2>

      {/* File Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        
        <input
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-blue-600 hover:text-blue-700"
        >
          {file ? file.name : 'Choose JSON file'}
        </label>
      </div>

      {/* Import Button */}
      {file && !stats && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? (
            <span className="flex items-center justify-center">
              <Loader className="animate-spin mr-2" />
              Importing...
            </span>
          ) : (
            'Import Notes'
          )}
        </button>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded flex items-start">
          <XCircle className="text-red-500 mr-2 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Success Stats */}
      {stats && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center mb-4">
            <CheckCircle className="text-green-500 mr-2" />
            <h3 className="font-semibold text-green-900">Import Successful!</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Notes Created:</p>
              <p className="font-semibold">{stats.notes_created}</p>
            </div>
            <div>
              <p className="text-gray-600">Labels Created:</p>
              <p className="font-semibold">{stats.labels_created}</p>
            </div>
            <div>
              <p className="text-gray-600">Media Files:</p>
              <p className="font-semibold">{stats.media_created}</p>
            </div>
            <div>
              <p className="text-gray-600">Checklist Items:</p>
              <p className="font-semibold">{stats.checklist_items_created}</p>
            </div>
          </div>

          {stats.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-green-200">
              <p className="text-sm text-red-600 font-semibold">Errors:</p>
              <ul className="text-sm text-red-600 list-disc list-inside">
                {stats.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};