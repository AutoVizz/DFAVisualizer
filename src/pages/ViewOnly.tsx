import { useNavigate } from 'react-router-dom';
import { useStore }    from '../store/useStore';
import { cloneProject } from '../lib/utils';
import { saveProject }  from '../lib/firestoreHelpers';
import FlowCanvas       from '../components/canvas/FlowCanvas';
import { VisibilityIcon } from '../components/ui/Icons';

export default function ViewOnly() {
  const navigate = useNavigate();
  const { viewOnlyProject, user, setActiveProject } = useStore();

  if (!viewOnlyProject) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <p style={{ color: 'var(--text-muted)' }}>No result to display.</p>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Go back</button>
      </div>
    );
  }

  const handleImport = async () => {
    const copy = cloneProject(viewOnlyProject);
    setActiveProject(copy);
    if (user) {
      await saveProject(copy.id, copy, user.uid);
    }
    navigate(`/canvas/${copy.id}`);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        height: 48,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
        flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{viewOnlyProject.name}</span>
        <span className={`badge ${viewOnlyProject.type === 'DFA' ? 'badge-dfa' : 'badge-nfa'}`}>
          {viewOnlyProject.type}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {viewOnlyProject.states.length} states · {viewOnlyProject.transitions.length} transitions · {viewOnlyProject.alphabet.join(', ')}
        </span>
        <button
          className="btn btn-primary btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={handleImport}
        >
          Import as New Project
        </button>
      </div>

      {/* View-only canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div className="viewonly-banner">
          <VisibilityIcon sx={{ fontSize: 16 }} /> Read-only view — use "Import" to edit this automaton
        </div>
        <FlowCanvas readOnly={true} projectOverride={viewOnlyProject} />
      </div>
    </div>
  );
}
