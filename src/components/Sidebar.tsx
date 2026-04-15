import React from 'react';
import { useStore } from '../store/useStore';
import AlphabetEditor from './AlphabetEditor';
import StringSimulator from './StringSimulator';
import ActionButtons from './ActionButtons';
import ErrorBanner from './ErrorBanner';

const Sidebar: React.FC = () => {
  const { activeProject } = useStore();

  return (
    <div className="w-[320px] h-full bg-surface border-l border-border flex flex-col overflow-hidden shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text-primary truncate">
              {activeProject?.name || 'Untitled'}
            </h2>
            {activeProject && (
              <span className={activeProject.type === 'DFA' ? 'badge-dfa mt-1' : 'badge-nfa mt-1'}>
                {activeProject.type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <ErrorBanner />
        <AlphabetEditor />
        <StringSimulator />
        <ActionButtons />
      </div>

      {/* Footer info */}
      {activeProject && (
        <div className="p-3 border-t border-border text-xs text-text-muted">
          <div className="flex justify-between">
            <span>{activeProject.states.length} states</span>
            <span>{activeProject.transitions.length} transitions</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
