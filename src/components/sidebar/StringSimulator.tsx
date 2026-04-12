import { useState } from 'react';
import { useStore }  from '../../store/useStore';

export default function StringSimulator() {
  const {
    activeProject, simulationResult, simulationStep, isSimulating,
    runSimulation, runSimulationFull, stepForward, stepBackward, resetSimulation,
  } = useStore();

  const [input, setInput] = useState('');

  if (!activeProject) return null;
  const disabled = activeProject.states.length === 0;

  const symbols = simulationResult?.inputSymbols ?? (input === '' ? [] : Array.from(input));
  const history = simulationResult?.stateHistory ?? [];
  const currentSymbol = simulationStep > 0 ? symbols[simulationStep - 1] : null;
  const activeIds = history[simulationStep] ?? [];
  const activeLabels = activeIds.map(
    id => activeProject.states.find(s => s.id === id)?.label ?? id,
  );

  const atEnd   = isSimulating && simulationStep === history.length - 1;
  const atStart = simulationStep === 0;

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Simulate</p>

      <input
        className="input"
        placeholder="Input string ω"
        value={input}
        onChange={e => { setInput(e.target.value); if (isSimulating) resetSimulation(); }}
        style={{ marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}
        disabled={disabled}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button
          className="btn btn-primary btn-sm" style={{ flex: 1 }}
          disabled={disabled}
          onClick={() => runSimulationFull(input)}
        >
          ▶ Run
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!isSimulating || atStart}
          onClick={stepBackward}
          title="Step back"
        >
          ←
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() => {
            if (!isSimulating) runSimulation(input);
            else stepForward();
          }}
          title="Step forward"
        >
          →
        </button>
        {isSimulating && (
          <button className="btn btn-ghost btn-sm" onClick={resetSimulation} title="Reset">✕</button>
        )}
      </div>

      {/* Step mode info */}
      {isSimulating && (
        <div style={{ marginBottom: 10 }}>
          <div className="step-indicator" style={{ marginBottom: 6 }}>
            <span>Step {simulationStep}/{history.length - 1}</span>
            {currentSymbol !== null && (
              <>
                <span>→ reading</span>
                <span className="step-symbol">{currentSymbol}</span>
              </>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Active: {activeLabels.length > 0 ? activeLabels.join(', ') : '∅ (dead)'}
          </div>

          {/* Result badge — show when at end */}
          {atEnd && simulationResult && (
            <div style={{ marginTop: 8 }}>
              <span className={`badge ${simulationResult.accepted ? 'badge-accept' : 'badge-reject'}`}>
                {simulationResult.accepted ? '✓ ACCEPT' : '✗ REJECT'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
