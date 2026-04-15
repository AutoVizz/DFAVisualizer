import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const AlphabetEditor: React.FC = () => {
  const { activeProject, updateActiveProject } = useStore();
  const [newSymbol, setNewSymbol] = useState('');
  const [error, setError] = useState('');

  if (!activeProject) return null;

  const handleAdd = () => {
    const sym = newSymbol.trim();
    if (!sym) return;

    if (sym === 'ε' || sym === '#') {
      setError('ε is implicit and cannot be added manually');
      return;
    }

    if (sym.length !== 1) {
      setError('Symbols must be a single character');
      return;
    }

    if (activeProject.alphabet.includes(sym)) {
      setError('Symbol already exists');
      return;
    }

    updateActiveProject((p) => ({
      ...p,
      alphabet: [...p.alphabet, sym].sort(),
    }));

    setNewSymbol('');
    setError('');
  };

  const handleRemove = (sym: string) => {
    updateActiveProject((p) => ({
      ...p,
      alphabet: p.alphabet.filter((s) => s !== sym),
      // Also remove transitions using this symbol
      transitions: p.transitions.map((t) => ({
        ...t,
        symbols: t.symbols.filter((s) => s !== sym),
      })).filter((t) => t.symbols.length > 0),
    }));
  };

  return (
    <div className="sidebar-section">
      <h3 className="section-title">Alphabet (Σ)</h3>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {activeProject.alphabet.length === 0 ? (
          <span className="text-text-muted text-xs italic">No symbols defined</span>
        ) : (
          activeProject.alphabet.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-1 px-2 py-1 bg-surface-light border border-border rounded-md text-sm font-mono group"
            >
              {sym}
              <button
                onClick={() => handleRemove(sym)}
                className="text-text-muted hover:text-reject-red transition-colors ml-0.5 opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newSymbol}
          onChange={(e) => {
            setNewSymbol(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="a"
          maxLength={1}
          className="input-field text-sm font-mono flex-1"
        />
        <button
          onClick={handleAdd}
          className="btn-primary text-sm px-3"
          disabled={!newSymbol.trim()}
        >
          Add
        </button>
      </div>

      {error && (
        <p className="text-reject-red text-xs mt-1.5">{error}</p>
      )}
    </div>
  );
};

export default AlphabetEditor;
