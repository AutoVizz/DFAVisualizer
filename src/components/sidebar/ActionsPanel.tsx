import { useNavigate }   from 'react-router-dom';
import { useStore }       from '../../store/useStore';
import { autoLayout }     from '../../engine/autoLayout';
import { canonicalize }   from '../../engine/equivalence';
import { djb2Hash }       from '../../lib/utils';
import {
  saveProject as fsave,
  upsertMinimizedDfa,
  updateProjectMinimizedId,
} from '../../lib/firestoreHelpers';
import { SaveIcon } from '../ui/Icons';

interface ActionsPanelProps {
  projectId?: string;
}

export default function ActionsPanel({ projectId }: ActionsPanelProps) {
  const navigate = useNavigate();
  const {
    activeProject, user, workerStatus,
    updateStates, setViewOnlyProject, dispatchToWorker, patchActiveProject,
  } = useStore();

  if (!activeProject) return null;

  const isEmpty     = activeProject.states.length === 0;
  const isWorking   = workerStatus === 'running';
  const isDFA       = activeProject.type === 'DFA';
  const isNFA       = activeProject.type === 'NFA';

  const handleConvert = () => {
    if (!isNFA || isEmpty) return;
    dispatchToWorker(
      { type: 'NFA_TO_MIN_DFA', payload: activeProject },
      result => { setViewOnlyProject(result); navigate('/view'); },
      () => {},
    );
  };

  const handleMinimize = async () => {
    if (!isDFA || isEmpty) return;

    dispatchToWorker(
      { type: 'MINIMIZE_DFA', payload: activeProject },
      async result => {
        const canonical = canonicalize(result);
        const hash      = djb2Hash(canonical);
        if (user) {
          await upsertMinimizedDfa(hash, result, canonical, user.uid);
        }
        if (projectId) await updateProjectMinimizedId(projectId, hash);
        patchActiveProject({ minimizedDfaId: hash });
        setViewOnlyProject(result);
        navigate('/view');
      },
      () => {},
    );
  };

  const handleAutoLayout = () => {
    const laid = autoLayout(activeProject);
    updateStates(laid.states);
  };

  const handleSave = async () => {
    if (!user || !projectId) return;
    await fsave(projectId, activeProject, user.uid);
  };

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Actions</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

        <button
          className="btn btn-ghost"
          disabled={!isNFA || isEmpty || isWorking}
          onClick={handleConvert}
          title={isDFA ? 'Already a DFA' : ''}
        >
          {isWorking ? <span className="spinner" /> : null}
          Convert NFA → Minimized DFA
        </button>

        <button
          className="btn btn-ghost"
          disabled={!isDFA || isEmpty || isWorking}
          onClick={handleMinimize}
          title={isNFA ? 'Must be a DFA first' : ''}
        >
          {isWorking ? <span className="spinner" /> : null}
          Minimize DFA
        </button>

        <button
          className="btn btn-ghost"
          disabled={isEmpty}
          onClick={handleAutoLayout}
        >
          Auto Layout
        </button>

        <button
          className="btn btn-primary"
          disabled={!user || !projectId}
          onClick={handleSave}
          title={!user ? 'Sign in to save' : ''}
        >
          <SaveIcon sx={{ fontSize: 16 }} /> Save Project
        </button>

        {!user && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            Sign in to save projects
          </p>
        )}
      </div>
    </div>
  );
}
