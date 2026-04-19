import React from 'react';
import { useStore } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { autoLayout } from '../engine/autoLayout';
import { saveDocument } from '../lib/firestore';
import { TransformIcon, CompressIcon, AutoLayoutIcon, LockIcon, PublicIcon, SaveIcon } from './Icons';

const ActionButtons: React.FC = () => {
  const {
    activeProject,
    updateActiveProject,
    setViewOnlyProject,
    dispatchToWorker,
    workerStatus,
    user,
  } = useStore();

  const navigate = useNavigate();

  if (!activeProject) return null;

  const hasStates = activeProject.states.length > 0;
  const isDFA = activeProject.type === 'DFA';
  const isNFA = activeProject.type === 'NFA';
  const isWorkerBusy = workerStatus === 'running';

  const handleConvertNfaToDfa = async () => {
    if (!isNFA || isWorkerBusy) return;
    try {
      const result = await dispatchToWorker({
        type: 'NFA_TO_DFA',
        payload: activeProject,
      });
      const laid = autoLayout(result);
      setViewOnlyProject(laid);
      navigate('/view');
    } catch {
      // Error is already set in the store by dispatchToWorker
    }
  };

  const handleMinimize = async () => {
    if (!isDFA || isWorkerBusy) return;
    try {
      const result = await dispatchToWorker({
        type: 'MINIMIZE',
        payload: activeProject,
      });
      const laid = autoLayout(result);
      setViewOnlyProject(laid);
      navigate('/view');
    } catch {
      // Error handled by store
    }
  };

  const handleAutoLayout = () => {
    if (!hasStates) return;
    const laid = autoLayout(activeProject);
    updateActiveProject(() => laid);
  };

  const handleTogglePrivate = () => {
    updateActiveProject((p) => ({ ...p, isPrivate: !p.isPrivate }));
  };

  const handleSave = async () => {
    if (!user || !activeProject) return;
    try {
      await saveDocument(activeProject.sourceCollection, user.uid, activeProject);
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  };

  return (
    <div className="sidebar-section">
      <h3 className="section-title">Actions</h3>

      <div className="space-y-2">
        <button
          onClick={handleConvertNfaToDfa}
          className="btn-secondary w-full text-sm text-left flex items-center gap-2"
          disabled={isDFA || !hasStates || isWorkerBusy}
        >
          <TransformIcon className="text-accent-light" size={16} />
          Convert NFA → DFA
          {isWorkerBusy && <Spinner />}
        </button>

        <button
          onClick={handleMinimize}
          className="btn-secondary w-full text-sm text-left flex items-center gap-2"
          disabled={isNFA || !hasStates || isWorkerBusy}
        >
          <CompressIcon className="text-accent-light" size={16} />
          Minimize DFA
          {isWorkerBusy && <Spinner />}
        </button>

        <button
          onClick={handleAutoLayout}
          className="btn-secondary w-full text-sm text-left flex items-center gap-2"
          disabled={!hasStates}
        >
          <AutoLayoutIcon className="text-accent-light" size={16} />
          Auto Layout
        </button>

        <div className="border-t border-border my-2" />

        <button
          onClick={handleTogglePrivate}
          className="btn-secondary w-full text-sm text-left flex items-center gap-2"
          disabled={!activeProject}
        >
          <span className="text-accent-light flex items-center">
            {activeProject.isPrivate ? <LockIcon size={16} /> : <PublicIcon size={16} />}
          </span>
          {activeProject.isPrivate ? 'Make Public' : 'Make Private'}
        </button>

        <button
          onClick={handleSave}
          className="btn-primary w-full text-sm flex items-center justify-center gap-2"
          disabled={!user || !!(activeProject.ownerId && activeProject.ownerId !== user.uid)}
        >
          <SaveIcon size={16} /> Save to {activeProject.sourceCollection}
        </button>

        {!user && (
          <p className="text-text-muted text-xs text-center">
            Sign in to save projects
          </p>
        )}
      </div>
    </div>
  );
};

const Spinner: React.FC = () => (
  <svg
    className="animate-spin h-3.5 w-3.5 text-accent-light ml-auto"
    viewBox="0 0 24 24"
    fill="none"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default ActionButtons;
