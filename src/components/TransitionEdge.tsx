import React from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';

interface TransitionEdgeData {
  symbols: string[];
}

const TransitionEdge: React.FC<EdgeProps<TransitionEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  source,
  target,
}) => {
  const isSelfLoop = source === target;

  if (isSelfLoop) {
    // Self-loop: render a loop above the node
    const loopRadius = 25;
    const path = `M ${sourceX} ${sourceY - 30} 
                  C ${sourceX - loopRadius} ${sourceY - 70}, 
                    ${sourceX + loopRadius} ${sourceY - 70}, 
                    ${sourceX} ${sourceY - 30}`;

    return (
      <>
        <path
          id={id}
          d={path}
          fill="none"
          stroke={selected ? '#7c3aed' : '#666'}
          strokeWidth={selected ? 2.5 : 2}
          className="transition-all duration-200"
          markerEnd={`url(#self-loop-arrow-${id})`}
        />
        <defs>
          <marker
            id={`self-loop-arrow-${id}`}
            markerWidth="12.5"
            markerHeight="12.5"
            viewBox="-10 -10 20 20"
            orient="auto"
            refX="0"
            refY="0"
            markerUnits="strokeWidth"
          >
            <polyline
              strokeLinecap="round"
              strokeLinejoin="round"
              points="-5,-4 0,0 -5,4 -5,-4"
              fill={selected ? '#7c3aed' : '#666'}
              stroke={selected ? '#7c3aed' : '#666'}
              strokeWidth="1"
            />
          </marker>
        </defs>
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${sourceX}px, ${sourceY - 78}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            <div
              className="px-2 py-0.5 rounded text-xs font-mono font-medium transition-all duration-200"
              style={{
                background: selected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(26, 26, 26, 0.95)',
                color: selected ? '#a78bfa' : '#d4d4d4',
                border: `1px solid ${selected ? 'rgba(124, 58, 237, 0.4)' : '#444'}`,
                backdropFilter: 'blur(4px)',
              }}
            >
              {data?.symbols.join(', ') || 'ε'}
            </div>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <defs>
        <marker
          id={`arrow-${id}`}
          markerWidth="12.5"
          markerHeight="12.5"
          viewBox="-10 -10 20 20"
          orient="auto"
          refX="0"
          refY="0"
          markerUnits="strokeWidth"
        >
          <polyline
            strokeLinecap="round"
            strokeLinejoin="round"
            points="-5,-4 0,0 -5,4 -5,-4"
            fill={selected ? '#7c3aed' : '#666'}
            stroke={selected ? '#7c3aed' : '#666'}
            strokeWidth="1"
          />
        </marker>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? '#7c3aed' : '#666'}
        strokeWidth={selected ? 2.5 : 2}
        className="transition-all duration-200"
        markerEnd={`url(#arrow-${id})`}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <div
            className="px-2 py-0.5 rounded text-xs font-mono font-medium transition-all duration-200"
            style={{
              background: selected ? 'rgba(124, 58, 237, 0.2)' : 'rgba(26, 26, 26, 0.95)',
              color: selected ? '#a78bfa' : '#d4d4d4',
              border: `1px solid ${selected ? 'rgba(124, 58, 237, 0.4)' : '#444'}`,
              backdropFilter: 'blur(4px)',
            }}
          >
            {data?.symbols.join(', ') || 'ε'}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default TransitionEdge;
