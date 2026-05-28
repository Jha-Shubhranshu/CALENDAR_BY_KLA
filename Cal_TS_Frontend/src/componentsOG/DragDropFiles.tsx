import { useState, useRef } from 'react';
import { Upload, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useUserContext } from '../context/AuthContext';

interface UploadResponse {
  success: boolean;
  filename?: string;
  message: string;
  statistics?: {
    conversations_created: number;
    notes_created: number;
    messages_created?: number;
  };
}


export default function DragDropFiles() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [response, setResponse] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { logout } = useUserContext();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {

    // Validate file type
    if (!file.name.endsWith('.json')) {
      setError('Only JSON files are accepted');
      setResponse(null);
      return;
    }

    setIsUploading(true);
    setError(null);
    setResponse(null);

    // const formData = new FormData();
    // formData.append('file', file);

    try {
          const fileContent = await file.text();
          let jsonData;
    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      setError('Invalid JSON file format');
      setIsUploading(false);
      return;
    }

    // ✅ Step 3: Ensure it's an array (as backend expects List[Dict])
    if (!Array.isArray(jsonData)) {
      setError('JSON must be an array of conversation objects');
      setIsUploading(false);
      return;
    }

    // ✅ Step 4: Send as JSON, not FormData
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/ArjunJson/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonData),  // Send the parsed JSON data
      credentials: 'include',
    });

    const data = await res.json();

    if (res.ok) {
      setResponse(data);
    } else {
      // Handle authentication errors
      if (res.status === 401) {
        setError('Session exxxpired. Please log in again.');
      } else {
        setError(data.detail || 'Upload failed');
      }
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Network error occurred');
  } finally {
    setIsUploading(false);
  }
};

  const handleClick = () => {
    fileInputRef.current?.click();
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Logout Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={logout}
            className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm"
          >
            Logout
          </button>
        </div>

        {/* Drop Zone */}
        {!response && !error && (
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer
              transition-all duration-300 ease-out
              ${isDragging 
                ? 'border-blue-400 bg-blue-50 scale-105 shadow-2xl shadow-blue-200' 
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
                  <Loader className="w-20 h-20 text-blue-500 animate-spin" />
                  <div className="space-y-2">
                    <p className="text-2xl font-medium text-slate-800">
                      Processing...
                    </p>
                    <p className="text-slate-500">
                      Importing your conversations
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={`
                    p-6 rounded-full transition-all duration-300
                    ${isDragging ? 'bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-300' : 'bg-gradient-to-br from-blue-100 to-blue-200'}
                  `}>
                    <Upload className={`
                      w-16 h-16 transition-colors duration-300
                      ${isDragging ? 'text-white' : 'text-blue-600'}
                    `} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-medium text-slate-800">
                      {isDragging ? 'Drop your JSON file' : 'Drop JSON file here'}
                    </p>
                    <p className="text-slate-500">
                      or click to browse
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Success Response */}
        {response && (
          <div className="bg-white rounded-2xl p-10 shadow-xl border border-slate-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full shadow-lg shadow-blue-200">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Import Successful
                </h2>
                <p className="text-slate-600">{response.message}</p>
              </div>
            </div>

            <div className="space-y-4">
              {response.filename && (
                <div className="flex justify-between py-3 border-b border-slate-200">
                  <span className="text-slate-600">File</span>
                  <span className="font-medium text-slate-800">{response.filename}</span>
                </div>
              )}
              
              {response.statistics && (
                <>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Conversations Created</span>
                    <span className="font-medium text-slate-800">
                      {response.statistics.conversations_created}
                    </span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-200">
                    <span className="text-slate-600">Notes Created</span>
                    <span className="font-medium text-slate-800">
                      {response.statistics.notes_created}
                    </span>
                  </div>
                  {response.statistics.messages_created !== undefined && (
                    <div className="flex justify-between py-3 border-b border-slate-200">
                      <span className="text-slate-600">Messages Created</span>
                      <span className="font-medium text-slate-800">
                        {response.statistics.messages_created}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setResponse(null)}
              className="w-full mt-8 py-3 px-6 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium shadow-lg"
            >
              Upload Another File
            </button>
          </div>
        )}

        {/* Error Response */}
        {error && (
          <div className="bg-white rounded-2xl p-10 shadow-xl border border-red-200">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-red-500 rounded-full shadow-lg shadow-red-200">
                <XCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                  Upload Failed
                </h2>
                <p className="text-slate-600">{error}</p>
              </div>
            </div>

            <button
              onClick={() => setError(null)}
              className="w-full mt-8 py-3 px-6 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-medium shadow-lg"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}