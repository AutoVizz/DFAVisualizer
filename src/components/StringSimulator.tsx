import React, { useState } from 'react';
import { useStore } from '../store/useStore';

const StringSimulator: React.FC = () => {
  const {
    activeProject,
    simulationResult,
    simulationStep,
    isSimulating,
    simulationInput,
    runSimulation,
    stepForward,
    stepBackward,
    resetSimulation,
  } = useStore();

  const [inputValue, setInputValue] = useState('');

  if (!activeProject) return null;

  const hasStates = activeProject.states.length > 0;
  const hasStartState = activeProject.states.some((s) => s.isStart);
  const canRun = hasStates && hasStartState;

  const handleRun = () => {
    runSimulation(inputValue);
  };

  const handleStep = () => {
    if (!simulationResult) {
      // Start new step simulation
      useStore.setState({ simulationInput: inputValue });
      stepForward();
    } else {
      stepForward();
    }
  };

  const handleReset = () => {
    resetSimulation();
    setInputValue('');
  };

  // Current symbol being processed during step mode
  const currentSymbolIdx = simulationStep > 0 ? simulationStep - 1 : -1;
  const activeStates = simulationResult?.stateHistory[simulationStep] || [];
  const isAtEnd = simulationResult
    ? simulationStep >= simulationResult.stateHistory.length - 1
    : false;

  return (
    <div className="sidebar-section">
      <h3 className="section-title">String Simulator</h3>

      {/* Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={isSimulating || simulationResult ? simulationInput : inputValue}
          onChange={(e) => {
            if (!isSimulating && !simulationResult) {
              setInputValue(e.target.value);
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
          placeholder="Enter string ω..."
          className="input-field text-sm font-mono flex-1"
          disabled={isSimulating || !!simulationResult}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mb-3">
        {!simulationResult ? (
          <>
            <button
              onClick={handleRun}
              className="btn-primary text-sm flex-1"
              disabled={!canRun}
            >
              ▶ Run
            </button>
            <button
              onClick={handleStep}
              className="btn-secondary text-sm flex-1"
              disabled={!canRun}
            >
              ⏭ Step
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => stepBackward()}
              className="btn-secondary text-sm"
              disabled={simulationStep <= 0}
            >
              ◀
            </button>
            <button
              onClick={() => stepForward()}
              className="btn-secondary text-sm"
              disabled={isAtEnd}
            >
              ▶
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary text-sm flex-1"
            >
              ✕ Reset
            </button>
          </>
        )}
      </div>

      {/* Simulation state display */}
      {simulationResult && (
        <div className="space-y-2 animate-fade-in">
          {/* Current symbol indicator */}
          {isSimulating && simulationInput.length > 0 && (
            <div className="bg-surface-light rounded-lg p-2.5">
              <div className="text-xs text-text-muted mb-1.5">Processing:</div>
              <div className="flex gap-0.5 font-mono text-sm flex-wrap">
                {simulationInput.split('').map((ch, i) => (
                  <span
                    key={i}
                    className={`
                      w-6 h-6 flex items-center justify-center rounded transition-all duration-200
                      ${i === currentSymbolIdx
                        ? 'bg-accent text-white scale-110 shadow-glow'
                        : i < currentSymbolIdx
                        ? 'bg-surface-lighter text-text-muted'
                        : 'bg-surface text-text-secondary border border-border'
                      }
                    `}
                  >
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Active states */}
          {isSimulating && (
            <div className="bg-surface-light rounded-lg p-2.5">
              <div className="text-xs text-text-muted mb-1.5">Active States:</div>
              <div className="flex gap-1.5 flex-wrap">
                {activeStates.length === 0 ? (
                  <span className="text-text-muted text-xs italic">Dead state (∅)</span>
                ) : (
                  activeStates.map((stateId) => {
                    const state = activeProject.states.find((s) => s.id === stateId);
                    return (
                      <span
                        key={stateId}
                        className="px-2 py-0.5 bg-sim-active/20 text-sim-active border border-sim-active/30 rounded text-xs font-mono"
                      >
                        {state?.label || stateId}
                      </span>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step counter */}
          <div className="text-xs text-text-muted">
            Step {simulationStep} / {simulationResult.stateHistory.length - 1}
          </div>

          {/* Result badge */}
          {(!isSimulating || isAtEnd) && (
            <div className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
              ${simulationResult.accepted
                ? 'bg-accept-green/15 text-accept-green border border-accept-green/30'
                : 'bg-reject-red/15 text-reject-red border border-reject-red/30'
              }
            `}>
              <span className="text-lg">{simulationResult.accepted ? '✓' : '✗'}</span>
              {simulationResult.accepted ? 'ACCEPTED' : 'REJECTED'}
            </div>
          )}
        </div>
      )}

      {/* Hints */}
      {!canRun && hasStates && !hasStartState && (
        <p className="text-amber-400 text-xs mt-2">⚠ No start state defined</p>
      )}
      {!hasStates && (
        <p className="text-text-muted text-xs mt-2">Add states to the canvas first</p>
      )}
    </div>
  );
};

export default StringSimulator;
