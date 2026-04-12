import { useEffect, useRef } from 'react';
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
    activeProject, user, setActiveProject,
  } = useStore();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  // Load project on mount
  useEffect(() => {
    if (!id) return;

    const alreadyLoaded = activeProject?.id === id;
    if (alreadyLoaded) return;

    const load = async () => {
      // Try Firestore first
      if (user) {
        const card = await fetchProject(id);
        if (card) {
          setActiveProject(JSON.parse(card.automatonJson) as Automaton);
          return;
        }
      }
      // Fall back to blank canvas for the /canvas/new-* case
      setActiveProject(emptyAutomaton(id, 'Untitled', 'NFA'));
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Auto-save debounced 1s
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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Header bar */}
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
            <span style={{ fontSize: 14, fontWeight: 600 }}>{activeProject.name}</span>
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

      {/* Canvas + sidebar */}
      <div style={{ display: 'flex', flex: 1, marginTop: 48, overflow: 'hidden' }}>
        <FlowCanvas readOnly={false} />
        <Sidebar projectId={id} />
      </div>
    </div>
  );
}
