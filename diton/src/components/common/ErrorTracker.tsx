"use client";

import { useEffect, useState } from 'react';

interface ErrorLog {
  id: string;
  message: string;
  timestamp: Date;
  type: 'error' | 'warning' | 'info';
}

export default function ErrorTracker() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const newError: ErrorLog = {
        id: Date.now().toString(),
        message: event.message,
        timestamp: new Date(),
        type: 'error'
      };
      setErrors(prev => [...prev.slice(-9), newError]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const newError: ErrorLog = {
        id: Date.now().toString(),
        message: `Unhandled Promise: ${event.reason}`,
        timestamp: new Date(),
        type: 'warning'
      };
      setErrors(prev => [...prev.slice(-9), newError]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  if (errors.length === 0) return null;

  return (
    <>
      {/* Error Badge */}
      {errors.length > 0 && !showErrors && (
        <button
          onClick={() => setShowErrors(true)}
          className="fixed bottom-4 left-4 bg-red-600 text-white px-3 py-2 rounded-full text-sm shadow-lg hover:bg-red-700 z-50"
        >
          ⚠️ {errors.length} Error{errors.length > 1 ? 's' : ''}
        </button>
      )}

      {/* Error Panel */}
      {showErrors && (
        <div className="fixed bottom-4 left-4 bg-gray-900 text-white p-4 rounded-lg shadow-xl z-50 max-w-md max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold">Error Log</h3>
            <button
              onClick={() => setShowErrors(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-2">
            {errors.map(error => (
              <div
                key={error.id}
                className={`p-2 rounded text-xs ${
                  error.type === 'error' ? 'bg-red-900/50' :
                  error.type === 'warning' ? 'bg-yellow-900/50' :
                  'bg-blue-900/50'
                }`}
              >
                <div className="font-mono">{error.message}</div>
                <div className="text-gray-400 mt-1">
                  {error.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
          
          <button
            onClick={() => setErrors([])}
            className="mt-3 text-xs text-red-400 hover:text-red-300"
          >
            Clear All
          </button>
        </div>
      )}
    </>
  );
}
