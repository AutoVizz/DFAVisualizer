import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { State } from '../types';

interface StateNodeData {
  state: State;
  isActive: boolean;
  onDoubleClick: (id: string) => void;
}

const StateNode: React.FC<NodeProps<StateNodeData>> = ({ data, selected }) => {
  const { state, isActive } = data;

  return (
    <div
      className="state-node-wrapper"
      onDoubleClick={(e) => {
        e.stopPropagation();
        data.onDoubleClick(state.id);
      }}
      style={{ position: 'relative' }}
    >
      {/* Start state arrow */}
      {state.isStart && (
        <svg
          width="32"
          height="24"
          viewBox="0 0 32 24"
          style={{
            position: 'absolute',
            left: '-34px',
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          <defs>
            <marker
              id={`start-arrow-head-${state.id}`}
              markerWidth="12.5"
              markerHeight="12.5"
              viewBox="-10 -10 20 20"
              orient="auto"
              refX="0"
              refY="0"
              markerUnits="strokeWidth"
            >
              <polyline strokeLinecap="round" strokeLinejoin="round" points="-5,-4 0,0 -5,4 -5,-4" fill="#7c3aed" stroke="#7c3aed" strokeWidth="1" />
            </marker>
          </defs>
          <line
            x1="2"
            y1="12"
            x2="28"
            y2="12"
            stroke="#7c3aed"
            strokeWidth="2"
            markerEnd={`url(#start-arrow-head-${state.id})`}
          />
        </svg>
      )}

      {/* Main circle */}
      <div
        className="relative flex items-center justify-center transition-all duration-200"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: isActive
            ? 'rgba(250, 204, 21, 0.15)'
            : selected
            ? 'rgba(124, 58, 237, 0.15)'
            : '#1a1a1a',
          border: `2.5px solid ${
            isActive
              ? '#facc15'
              : selected
              ? '#7c3aed'
              : '#555'
          }`,
          boxShadow: isActive
            ? '0 0 20px rgba(250, 204, 21, 0.4), inset 0 0 10px rgba(250, 204, 21, 0.1)'
            : selected
            ? '0 0 15px rgba(124, 58, 237, 0.4)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          outline: state.isAccept
            ? `2.5px solid ${isActive ? '#facc15' : selected ? '#7c3aed' : '#555'}`
            : 'none',
          outlineOffset: '4px',
          cursor: 'grab',
        }}
      >
        <span
          className="font-mono text-sm font-medium select-none"
          style={{
            color: isActive ? '#facc15' : '#f5f5f5',
            textShadow: isActive ? '0 0 8px rgba(250, 204, 21, 0.5)' : 'none',
          }}
        >
          {state.label}
        </span>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#7c3aed',
          border: '2px solid #1a1a1a',
          width: '8px',
          height: '8px',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#7c3aed',
          border: '2px solid #1a1a1a',
          width: '8px',
          height: '8px',
        }}
      />
    </div>
  );
};

export default memo(StateNode);
