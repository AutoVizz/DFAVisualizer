import React from 'react';
import { useStore } from '../store/useStore';

const ErrorBanner: React.FC = () => {
  const { workerStatus, workerError, clearWorkerError } = useStore();

  if (workerStatus !== 'error' || !workerError) return null;

  return (
    <div className="sidebar-section !border-b-0">
      <div className="bg-reject-red/10 border border-reject-red/30 rounded-lg p-3 animate-slide-up">
        <div className="flex items-start gap-2">
          <span className="text-reject-red text-lg shrink-0 mt-0.5">⚠</span>
          <div className="flex-1">
            <h4 className="text-reject-red text-sm font-semibold mb-1">Error</h4>
            <p className="text-reject-red/80 text-xs leading-relaxed">
              {workerError}
            </p>
          </div>
          <button
            onClick={clearWorkerError}
            className="text-reject-red/60 hover:text-reject-red transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBanner;
