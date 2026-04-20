import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore }  from '../store/useStore';
import { fetchProject, saveProject } from '../lib/firestoreHelpers';
import { emptyAutomaton }  from '../lib/utils';
import FlowCanvas    from '../components/canvas/FlowCanvas';
import Sidebar       from '../components/sidebar/Sidebar';
import type { Automaton } from '../types';

export default function Canvas() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    activeProject, user, setActiveProject, patchActiveProject,
  } = useStore();
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!id) return;

    const alreadyLoaded = activeProject?.id === id;
    if (alreadyLoaded) return;

    const load = async () => {
      if (user) {
        const card = await fetchProject(id);
        if (card) {
          setActiveProject(JSON.parse(card.automatonJson) as Automaton);
          return;
        }
      }
      setActiveProject(emptyAutomaton(id, 'Untitled', 'NFA'));
    };

    load();
  }, [id, user, activeProject?.id, setActiveProject]);

  useEffect(() => {
    if (!activeProject || !user || !id) return;
    const serialized = JSON.stringify(activeProject);
    if (serialized === lastSavedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveProject(id, activeProject, user.uid);
      lastSavedRef.current = JSON.stringify(activeProject);
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [activeProject, user, id]);

  const startRenameProject = () => {
    if (!activeProject) return;
    setProjectNameInput(activeProject.name);
    setIsRenamingProject(true);
  };

  const commitRenameProject = () => {
    if (!activeProject) return;
    const trimmed = projectNameInput.trim();
    if (!trimmed) {
      setProjectNameInput(activeProject.name);
      setIsRenamingProject(false);
      return;
    }
    patchActiveProject({ name: trimmed });
    setIsRenamingProject(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 48, zIndex: 10,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Dashboard</button>
        {activeProject && (
          <>
            {isRenamingProject ? (
              <>
                <input
                  className="input"
                  value={projectNameInput}
                  onChange={e => setProjectNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRenameProject();
                    if (e.key === 'Escape') setIsRenamingProject(false);
                  }}
                  autoFocus
                  style={{ width: 240, maxWidth: '40vw', height: 30, padding: '4px 10px' }}
                />
                <button className="btn btn-primary btn-sm" onClick={commitRenameProject}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setIsRenamingProject(false)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{activeProject.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={startRenameProject}>Rename</button>
              </>
            )}
            <span className={`badge ${activeProject.type === 'DFA' ? 'badge-dfa' : 'badge-nfa'}`}>
              {activeProject.type}
            </span>
          </>
        )}
        {!user && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            Not signed in — changes won't be saved to cloud
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, marginTop: 48, overflow: 'hidden' }}>
        <FlowCanvas readOnly={false} />
        <Sidebar projectId={id} />
      </div>
    </div>
  );
}
