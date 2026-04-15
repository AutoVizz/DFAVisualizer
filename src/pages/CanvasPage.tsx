import React, { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';
import Canvas from '../components/Canvas';
import Sidebar from '../components/Sidebar';
import { useStore } from '../store/useStore';
import { loadAnyDocument, saveDocument } from '../lib/firestore';
import { debounce } from '../lib/utils';

const CanvasPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeProject, setActiveProject, user } = useStore();
  const isLocalMode = id === 'local';
  const hasLoadedRef = useRef(false);

  // Load project from Firestore
  useEffect(() => {
    if (isLocalMode || hasLoadedRef.current) return;

    const load = async () => {
      if (!id) return;
      try {
        const automaton = await loadAnyDocument(id);
        if (automaton) {
          setActiveProject(automaton);
          hasLoadedRef.current = true;
        } else {
          // Project not found, create empty one
          setActiveProject({
            id,
            name: 'Untitled',
            type: 'DFA',
            states: [],
            alphabet: [],
            transitions: [],
            minimizedDfaId: null,
          });
          hasLoadedRef.current = true;
        }
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    };

    load();
  }, [id, isLocalMode, setActiveProject]);

  // Ensure we have a project for local mode
  useEffect(() => {
    if (isLocalMode && !activeProject) {
      setActiveProject({
        id: crypto.randomUUID(),
        name: 'Untitled',
        type: 'DFA',
        states: [],
        alphabet: [],
        transitions: [],
        minimizedDfaId: null,
      });
    }
  }, [isLocalMode, activeProject, setActiveProject]);

  // Auto-save (debounced 1s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(
    debounce((userId: string, project: typeof activeProject) => {
      if (project && !isLocalMode) {
        saveDocument('DFA', userId, project).catch((err: any) =>
          console.error('Auto-save failed:', err)
        );
      }
    }, 1000),
    [isLocalMode]
  );

  useEffect(() => {
    if (user && activeProject && !isLocalMode) {
      debouncedSave(user.uid, activeProject);
    }
  }, [user, activeProject, isLocalMode, debouncedSave]);

  if (!activeProject) {
    return (
      <div className="h-full flex items-center justify-center bg-bg">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface/50 backdrop-blur-sm shrink-0 h-12">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-icon text-sm"
          >
            ← Back
          </button>
          <div className="h-5 w-px bg-border" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {activeProject.name}
          </span>
          <span className={activeProject.type === 'DFA' ? 'badge-dfa' : 'badge-nfa'}>
            {activeProject.type}
          </span>
          {isLocalMode && (
            <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Local
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          {!isLocalMode && user && (
            <span className="opacity-60">Auto-saving enabled</span>
          )}
        </div>
      </header>

      {/* Canvas + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <ReactFlowProvider>
          <div className="flex-1">
            <Canvas />
          </div>
        </ReactFlowProvider>
        <Sidebar />
      </div>
    </div>
  );
};

export default CanvasPage;
