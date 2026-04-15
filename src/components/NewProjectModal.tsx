import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { autoLayout } from '../engine/autoLayout';

interface NewProjectModalProps {
  onClose: () => void;
  onCreated: (id: string) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreated }) => {
  const { dispatchToWorker } = useStore();
  const [regexInput, setRegexInput] = useState('');
  const [regexError, setRegexError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateId = () => crypto.randomUUID();

  const createEmpty = (type: 'DFA' | 'NFA') => {
    const id = generateId();
    const project = {
      id,
      name: `New ${type}`,
      type,
      states: [],
      alphabet: [],
      transitions: [],
      sourceCollection: type,
      isPrivate: true,
    };
    useStore.getState().setActiveProject(project);
    onCreated(id);
  };

  const createFromRegex = async () => {
    if (!regexInput.trim()) {
      setRegexError('Please enter a regular expression');
      return;
    }

    setIsLoading(true);
    setRegexError('');

    try {
      const result = await dispatchToWorker({
        type: 'THOMPSON',
        payload: { regex: regexInput.trim() },
      });
      const laid = autoLayout(result);
      useStore.getState().setActiveProject(laid);
      onCreated(laid.id);
    } catch {
      setRegexError('Invalid regex. Supported: literals, | (union), * (star), () (grouping)');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-[460px] shadow-2xl shadow-black/50 animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">New Project</h2>
            <button
              onClick={onClose}
              className="btn-icon text-text-muted hover:text-text-primary"
            >
              ✕
            </button>
          </div>
          <p className="text-text-muted text-sm mt-1">
            Choose how to create your automaton
          </p>
        </div>

        {/* Options */}
        <div className="p-6 space-y-3">
          <button
            onClick={() => createEmpty('DFA')}
            className="w-full group card hover:border-accent/50 text-left flex items-center gap-4 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-lg group-hover:bg-accent/20 transition-colors">
              ◉
            </div>
            <div>
              <div className="font-medium text-text-primary">Empty DFA</div>
              <div className="text-xs text-text-muted">Start with a blank deterministic automaton</div>
            </div>
          </button>

          <button
            onClick={() => createEmpty('NFA')}
            className="w-full group card hover:border-amber-500/50 text-left flex items-center gap-4 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg group-hover:bg-amber-500/20 transition-colors">
              ◎
            </div>
            <div>
              <div className="font-medium text-text-primary">Empty NFA</div>
              <div className="text-xs text-text-muted">Start with a blank nondeterministic automaton</div>
            </div>
          </button>

          <div className="w-full card text-left">
            <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                λ
              </div>
              <div>
                <div className="font-medium text-text-primary">Regex → NFA</div>
                <div className="text-xs text-text-muted">Build NFA from a regular expression</div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={regexInput}
                onChange={(e) => {
                  setRegexInput(e.target.value);
                  setRegexError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && createFromRegex()}
                placeholder="e.g. (a|b)*abb"
                className="input-field text-sm font-mono flex-1"
                maxLength={100}
              />
              <button
                onClick={createFromRegex}
                className="btn-primary text-sm px-4"
                disabled={isLoading}
              >
                {isLoading ? '...' : 'Build'}
              </button>
            </div>

            {regexError && (
              <p className="text-reject-red text-xs mt-2">{regexError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProjectModal;
