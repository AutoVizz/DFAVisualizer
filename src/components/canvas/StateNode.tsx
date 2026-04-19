import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { State } from '../../types';

export interface StateNodeData {
  state:         State;
  activeStateIds: string[];
  readOnly:      boolean;
}

function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const { state, activeStateIds } = data;
  const isActive = activeStateIds.includes(state.id);

  return (
    <div style={{ position: 'relative', width: 60, height: 60 }}>
      {/* Start-state incoming arrow */}
      {state.isStart && (
        <svg
          style={{ position: 'absolute', left: -36, top: 18, overflow: 'visible', pointerEvents: 'none' }}
          width="36" height="24"
        >
          <defs>
            <marker id="arrowhead-start" markerWidth="6" markerHeight="6"
              refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="var(--text-secondary)" />
            </marker>
          </defs>
          <line x1="0" y1="12" x2="28" y2="12"
            stroke="var(--text-secondary)" strokeWidth="2"
            markerEnd="url(#arrowhead-start)" />
        </svg>
      )}

      {/* Outer ring (always) */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        border: `2.5px solid ${isActive ? 'var(--yellow)' : selected ? 'var(--accent)' : 'var(--border-light)'}`,
        background: isActive
          ? 'var(--yellow-light)'
          : selected
          ? 'var(--accent-light)'
          : 'var(--bg-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'none',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}>
        {/* Inner ring for accept state */}
        {state.isAccept && (
          <div style={{
            position: 'absolute',
            inset: 5,
            borderRadius: '50%',
            border: `2px solid ${isActive ? 'var(--yellow)' : selected ? 'var(--accent)' : 'var(--border-light)'}`,
            pointerEvents: 'none',
          }} />
        )}
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: isActive ? 'var(--yellow)' : 'var(--text-primary)',
          fontFamily: "'JetBrains Mono', monospace",
          userSelect: 'none',
          zIndex: 1,
        }}>
          {state.label}
        </span>
      </div>

      {/* Center anchor for both incoming and outgoing transitions */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2,
          height: 2,
          border: 'none',
          background: 'transparent',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <Handle
        type="source"
        position={Position.Top}
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 2,
          height: 2,
          border: 'none',
          background: 'transparent',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export default memo(StateNode);
