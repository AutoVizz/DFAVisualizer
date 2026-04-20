import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore }  from '../store/useStore';
import { fetchProject, saveProject, toggleProjectPrivacy } from '../lib/firestoreHelpers';
import { emptyAutomaton }  from '../lib/utils';

const VisibilityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
);

const VisibilityOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
  </svg>
);
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
  const [isProjectReadyForSave, setIsProjectReadyForSave] = useState(false);
  const [isPrivate, setIsPrivate] = useState<boolean>(true);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      console.log("[Canvas load] start for id:", id, "user:", user ? user.uid : 'none');
      setIsProjectReadyForSave(false);

      if (id.startsWith('new-')) {
        console.log("[Canvas load] creating new project");
        setActiveProject(emptyAutomaton(id, 'Untitled', 'NFA'));
        if (user) setIsProjectReadyForSave(true);
        return;
      }

      console.log("[Canvas load] fetching project from DB");
      const card = await fetchProject(id);
      if (cancelled) return;

      if (card) {
        console.log("[Canvas load] fetched card, private:", card.private);
        console.log("[Canvas load] parsing and setting project");
        const parsed = JSON.parse(card.automatonJson) as Automaton;
        setActiveProject(parsed);
        setIsPrivate(card.private);
        if (user) setIsProjectReadyForSave(true);
        return;
      } else {
        console.log("[Canvas load] card not found or permission denied by rules");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    if (!activeProject || !user || !id || !isProjectReadyForSave) return;
    if (activeProject.id !== id) return;
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
  }, [activeProject, user, id, isProjectReadyForSave]);

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

  const handleTogglePrivacy = async () => {
    if (!id || !user || id.startsWith('new-')) return;
    const newPrivate = !isPrivate;
    setIsPrivate(newPrivate);
    await toggleProjectPrivacy(id, newPrivate);
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
            {user && !id.startsWith('new-') && (
              <button
                className="btn btn-ghost"
                style={{ padding: 4, minHeight: 0, height: 'auto', color: 'var(--text-muted)' }}
                onClick={handleTogglePrivacy}
                title={isPrivate ? "Make public" : "Make private"}
              >
                {!isPrivate ? <VisibilityIcon /> : <VisibilityOffIcon />}
              </button>
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
