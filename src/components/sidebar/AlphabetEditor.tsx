import { useState } from 'react';
import { useStore }  from '../../store/useStore';

export default function AlphabetEditor() {
  const { activeProject, updateAlphabet } = useStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  if (!activeProject) return null;

  const addSymbol = () => {
    const sym = input.trim();
    if (!sym) return;
    if (sym.length !== 1) { setError('Must be a single character'); return; }
    if (sym === 'ε') { setError('ε is implicit — do not add it'); return; }
    if (activeProject.alphabet.includes(sym)) { setError('Already in alphabet'); return; }
    updateAlphabet([...activeProject.alphabet, sym]);
    setInput(''); setError('');
  };

  const removeSymbol = (sym: string) => {
    updateAlphabet(activeProject.alphabet.filter(s => s !== sym));
  };

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Alphabet Σ</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {activeProject.alphabet.map(sym => (
          <span key={sym} className="alpha-chip">
            {sym}
            <button onClick={() => removeSymbol(sym)} title="Remove">✕</button>
          </span>
        ))}
        {activeProject.alphabet.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No symbols yet</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          placeholder="+ symbol"
          maxLength={1}
          value={input}
          onChange={e => { setInput(e.target.value); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') addSymbol(); }}
          style={{ flex: 1 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={addSymbol}>Add</button>
      </div>
      {error && <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{error}</p>}
    </div>
  );
}
