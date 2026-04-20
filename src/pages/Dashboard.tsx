import { useState, useEffect, useCallback } from 'react';
import { useNavigate }      from 'react-router-dom';
import { isFirebaseConfigured } from '../lib/firebase';
import { useStore }         from '../store/useStore';
import { signInWithGithub, signOut as libSignOut } from '../lib/auth';
import {
  fetchUserProjects,
  deleteProject,
  renameProject,
  saveProject,
  fetchMinimizedDfa,
  upsertMinimizedDfa,
  updateProjectMinimizedId,
  toggleProjectPrivacy,
} from '../lib/firestoreHelpers';
import { cloneProject, djb2Hash, emptyAutomaton, relativeTime } from '../lib/utils';
import { canonicalize }  from '../engine/equivalence';
import { thompson }     from '../engine/thompson';
import { nfaToDfa } from '../engine/nfaToDfa';
import { minimize } from '../engine/minimize';
import type { Automaton, FirestoreProject } from '../types';
import { emitGlobalAlert } from '../components/ui/GlobalBanner';
import CanvasContextMenu from '../components/canvas/CanvasContextMenu';

type ProjectCard = FirestoreProject & { id: string };

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

function AutomatonThumbnail({ automaton }: { automaton: Automaton }) {
  const W = 280, H = 120;
  const states = automaton.states.slice(0, 12);
  if (states.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empty automaton</span>
      </div>
    );
  }
  const xs = states.map(s => s.position.x);
  const ys = states.map(s => s.position.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const range = { x: maxX - minX || 1, y: maxY - minY || 1 };
  const pad = 20;
  const sx = (x: number) => pad + ((x - minX) / range.x) * (W - pad * 2);
  const sy = (y: number) => pad + ((y - minY) / range.y) * (H - pad * 2);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {automaton.transitions.slice(0, 30).map(t => {
        const from = states.find(s => s.id === t.from);
        const to   = states.find(s => s.id === t.to);
        if (!from || !to) return null;
        return (
          <line key={t.id}
            x1={sx(from.position.x)} y1={sy(from.position.y)}
            x2={sx(to.position.x)}   y2={sy(to.position.y)}
            stroke="var(--border-light)" strokeWidth={1} />
        );
      })}
      {states.map(s => (
        <g key={s.id}>
          <circle cx={sx(s.position.x)} cy={sy(s.position.y)} r={10}
            fill={s.isAccept ? 'rgba(124,58,237,0.3)' : 'var(--bg-elevated)'}
            stroke={s.isStart ? 'var(--accent)' : 'var(--border-light)'} strokeWidth={s.isStart ? 2 : 1} />
          {s.isAccept && (
            <circle cx={sx(s.position.x)} cy={sy(s.position.y)} r={7}
              fill="none" stroke="var(--border-light)" strokeWidth={1} />
          )}
          <text x={sx(s.position.x)} y={sy(s.position.y) + 1}
            dominantBaseline="middle" textAnchor="middle"
            fontSize={7} fill="var(--text-secondary)" style={{ fontFamily: 'monospace' }}>
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

interface NewProjectModalProps {
  onClose:  () => void;
  onCreate: (automaton: Automaton) => Promise<void>;
  onWorker: (regex: string, name: string, extraAlphabet: string[]) => void;
  workerStatus: 'idle' | 'running' | 'error';
}

function NewProjectModal({ onClose, onCreate, onWorker, workerStatus }: NewProjectModalProps) {
  const [tab,        setTab]        = useState<'nfa' | 'dfa' | 'regex'>('nfa');
  const [name,       setName]       = useState('');
  const [regex,      setRegex]      = useState('');
  const [regexName,  setRegexName]  = useState('');
  const [regexAlpha, setRegexAlpha] = useState('');
  const [regexError, setRegexError] = useState('');

  const handleCreate = async () => {
    const n = name.trim() || (tab === 'nfa' ? 'New NFA' : 'New DFA');
    const id = crypto.randomUUID();
    await onCreate(emptyAutomaton(id, n, tab === 'nfa' ? 'NFA' : 'DFA'));
  };

  const handleRegex = () => {
    if (!regex.trim()) { setRegexError('Enter a regex'); return; }
    try {
      thompson(regex);
      setRegexError('');
      const projectName = regexName.trim() || `Minimized DFA for /${regex}/`;
      const extraAlpha  = regexAlpha
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s !== 'ε');
      onWorker(regex, projectName, extraAlpha);
    } catch (e) {
      setRegexError(e instanceof Error ? e.message.replace('INVALID_REGEX: ', '') : 'Invalid');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <p className="modal-title">New Project</p>
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(['nfa', 'dfa', 'regex'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(t)}>
              {t === 'nfa' ? 'Empty NFA' : t === 'dfa' ? 'Empty DFA' : 'Regex → Minimized DFA'}
            </button>
          ))}
        </div>

        {tab !== 'regex' ? (
          <>
            <input className="input" placeholder="Project name (optional)"
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Operators: <code>|</code> union, <code>*</code> Kleene, <code>()</code> grouping.
              Use <code>ε</code> or <code>#</code> for epsilon.
            </p>
            <input className="input" placeholder="Project / language name (optional)"
              value={regexName} onChange={e => setRegexName(e.target.value)}
              style={{ marginBottom: 8 }} />
            <input className="input" placeholder="Alphabet Σ (comma-separated, e.g. a, b, c)"
              value={regexAlpha} onChange={e => setRegexAlpha(e.target.value)}
              style={{ marginBottom: 8, fontFamily: 'monospace' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              Symbols from the regex are auto-included. Add extra symbols here if your language uses more.
            </p>
            <input className="input" placeholder="Regex e.g. (a|b)*abb"
              value={regex} onChange={e => { setRegex(e.target.value); setRegexError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleRegex(); }}
              autoFocus style={{ marginBottom: 4, fontFamily: 'monospace' }} />
            {regexError && <p style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>{regexError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" disabled={workerStatus === 'running'} onClick={handleRegex}>
                {workerStatus === 'running' ? <span className="spinner" /> : null} Build Minimized DFA
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setActiveProject, dispatchToWorker, workerStatus } = useStore();

  const [projects,    setProjects]    = useState<ProjectCard[]>([]);
  const [selected,    setSelected]    = useState<Set<string>>(new Set());
  const [showModal,   setShowModal]   = useState(false);
  const [ctxMenu,     setCtxMenu]     = useState<{ x: number; y: number; id: string } | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingName,   setEditingName]   = useState('');
  const [eqResult,    setEqResult]    = useState<{
    equivalent: boolean;
    ids: string[];
    names: [string, string];
  } | null>(null);

  const getMinimizedDfaForEquivalence = useCallback(async (card: ProjectCard) => {
    if (card.minimizedDfaId) {
      const cached = await fetchMinimizedDfa(card.minimizedDfaId);
      if (cached) {
        const canonical = canonicalize(cached);
        return { automaton: cached, hash: djb2Hash(canonical), canonical };
      }
    }

    const source = JSON.parse(card.automatonJson) as Automaton;
    const asDfa = source.type === 'NFA' ? nfaToDfa(source) : source;
    const minimized = minimize(asDfa);
    const canonical = canonicalize(minimized);
    const hash = djb2Hash(canonical);

    if (user) {
      await upsertMinimizedDfa(hash, minimized, canonical, user.uid);
      await updateProjectMinimizedId(card.id, hash);
      setProjects(prev => prev.map(p => (p.id === card.id ? { ...p, minimizedDfaId: hash } : p)));
    }

    return { automaton: minimized, hash, canonical };
  }, [user]);

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const list = await fetchUserProjects(user.uid);
    setProjects(list.sort((a, b) => b.updatedAt - a.updatedAt));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const signIn = async () => {
    try {
      await signInWithGithub();
    } catch (err: any) {
      console.error(err);
      emitGlobalAlert('OAuth Error: ' + (err?.message || 'Unknown error'));
    }
  };

  const signOutUser = async () => {
    try {
      await libSignOut();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openProject = (card: ProjectCard) => {
    const automaton = JSON.parse(card.automatonJson) as Automaton;
    setActiveProject(automaton);
    navigate(`/canvas/${card.id}`);
  };

  const createProject = async (automaton: Automaton) => {
    setActiveProject(automaton);
    if (user) {
      await saveProject(automaton.id, automaton, user.uid);
    }
    setShowModal(false);
    navigate(`/canvas/${automaton.id}`);
  };

  const buildRegexNfa = (regex: string, name: string, extraAlphabet: string[]) => {
    dispatchToWorker(
      { type: 'THOMPSON_TO_MIN_DFA', payload: { regex, extraAlphabet } },
      async result => {
        const namedResult = { ...result, name };
        setActiveProject(namedResult);
        if (user) await saveProject(namedResult.id, namedResult, user.uid);
        setShowModal(false);
        navigate(`/canvas/${namedResult.id}`);
      },
      () => {},
    );
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects(p => p.filter(c => c.id !== id));
  };

  const handleRenameCommit = async (id: string) => {
    const trimmed = editingName.trim();
    setEditingCardId(null);
    if (!trimmed) return;
    const current = projects.find(p => p.id === id)?.name ?? '';
    if (trimmed === current) return;
    await renameProject(id, trimmed);
    setProjects(p => p.map(c => c.id === id ? { ...c, name: trimmed } : c));
  };

  const startRename = (id: string) => {
    const current = projects.find(p => p.id === id)?.name ?? '';
    setEditingName(current);
    setEditingCardId(id);
    setCtxMenu(null);
  };

  const checkEquivalence = async () => {
    const ids = Array.from(selected);
    if (ids.length !== 2) return;
    const cards = ids.map(id => projects.find(p => p.id === id)!);
    try {
      const [left, right] = await Promise.all([
        getMinimizedDfaForEquivalence(cards[0]!),
        getMinimizedDfaForEquivalence(cards[1]!),
      ]);
      setEqResult({
        equivalent: left.hash === right.hash,
        ids,
        names: [cards[0]!.name, cards[1]!.name],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitGlobalAlert(`Equivalence check failed: ${message}`);
    }
  };

  const cloneCard = async (id: string) => {
    const card = projects.find(p => p.id === id);
    if (!card || !user) return;
    const src  = JSON.parse(card.automatonJson) as Automaton;
    const copy = cloneProject(src);
    await saveProject(copy.id, copy, user.uid);
    await loadProjects();
  };

  const togglePrivacy = async (id: string, isPrivate: boolean) => {
    await toggleProjectPrivacy(id, isPrivate);
    setProjects(p => p.map(c => c.id === id ? { ...c, private: isPrivate } : c));
  };

  const selectedArr = Array.from(selected);
  const canCheckEq  = selectedArr.length === 2;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header className="dashboard-header">
        <span className="logo">⬡ DFAVisualizer</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {canCheckEq && (
            <button className="btn btn-ghost btn-sm" onClick={checkEquivalence}>
              Check Equivalence
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Project
          </button>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {user.photoURL && (
                <img src={user.photoURL} alt="avatar"
                  style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--border-light)' }} />
              )}
              <button className="btn btn-ghost btn-sm" onClick={signOutUser}>Sign out</button>
            </div>
          ) : (
            isFirebaseConfigured && (
              <button className="btn btn-ghost" onClick={signIn} id="github-signin-btn">
                Sign in with GitHub
              </button>
            )
          )}
        </div>
      </header>

      {eqResult && (
        <div style={{
          padding: '10px 32px',
          background: eqResult.equivalent ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          borderBottom: `1px solid ${eqResult.equivalent ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13,
          color: eqResult.equivalent ? 'var(--green)' : 'var(--red)',
        }}>
          <span>
            {eqResult.equivalent
              ? `✓ ${eqResult.names[0]} is equivalent to ${eqResult.names[1]}.`
              : `✗ ${eqResult.names[0]} is not equal to ${eqResult.names[1]}.`}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => setEqResult(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {!user ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
            <div style={{ fontSize: 64, marginBottom: 8 }}>⬡</div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>DFAVisualizer</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
              Create, simulate, and transform finite automata
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                Try without signing in
              </button>
              {isFirebaseConfigured && (
                <button className="btn btn-ghost" onClick={signIn}>Sign in with GitHub</button>
              )}
            </div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          </div>
        ) : projects.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No projects yet</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Create your first project</button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(card => {
              const automaton = JSON.parse(card.automatonJson) as Automaton;
              const isSelected = selected.has(card.id);
              return (
                <div
                  key={card.id}
                  id={`project-card-${card.id}`}
                  className={`project-card${isSelected ? ' selected' : ''}`}
                  onClick={() => openProject(card)}
                  onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, id: card.id }); }}
                >
                  <div className="project-thumbnail">
                    <AutomatonThumbnail automaton={automaton} />
                  </div>
                  <div className="project-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {editingCardId === card.id ? (
                        <input
                          autoFocus
                          className="input"
                          style={{ padding: '2px 6px', fontSize: 13, minHeight: 0, height: 24, flex: 1, marginRight: 8 }}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleRenameCommit(card.id); }
                            if (e.key === 'Escape') setEditingCardId(null);
                          }}
                          onBlur={() => handleRenameCommit(card.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="project-card-name" onDoubleClick={(e) => { e.stopPropagation(); startRename(card.id); }}>
                          {card.name}
                        </span>
                      )}
                      <span className={`badge ${card.type === 'DFA' ? 'badge-dfa' : 'badge-nfa'}`}>{card.type}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="project-card-meta">{relativeTime(card.updatedAt)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: 4, minHeight: 0, height: 'auto', color: 'var(--text-muted)' }}
                          onClick={e => {
                            e.stopPropagation();
                            togglePrivacy(card.id, !card.private);
                          }}
                          title={card.private ? "Make public" : "Make private"}
                        >
                          {!card.private ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </button>
                        <input type="checkbox" checked={isSelected}
                          onChange={e => toggleSelect(card.id, e as unknown as React.MouseEvent)}
                          onClick={e => e.stopPropagation()}
                          title="Select for equivalence check"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ctxMenu && (
        <CanvasContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: 'Open',   action: () => { const c = projects.find(p => p.id === ctxMenu.id); if (c) openProject(c); } },
            { label: 'Clone',  action: () => cloneCard(ctxMenu.id) },
            { label: 'Rename', action: () => startRename(ctxMenu.id) },
            { label: '---',    action: () => {} },
            { label: 'Delete', danger: true, action: () => handleDelete(ctxMenu.id) },
          ]}
        />
      )}

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={createProject}
          onWorker={buildRegexNfa}
          workerStatus={workerStatus}
        />
      )}
    </div>
  );
}
