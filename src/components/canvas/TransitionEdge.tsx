import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from 'reactflow';
import type { Transition } from '../../types';

export interface TransitionEdgeData {
  transition: Transition;
  transitionIds?: string[]; // original IDs when merged
  hasBidirectional?: boolean; // true when a reverse edge also exists
  isActive?: boolean;
}

const SELF_LOOP_HEIGHT = 52;
const BIDIRECTIONAL_OFFSET = 26;
const STATE_RADIUS = 30;

const labelStyle: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'all',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-secondary)',
  userSelect: 'none',
};

function TransitionEdge({
  id,
  source,
  target,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<TransitionEdgeData>) {
  const label = data?.transition.symbols.join(', ') ?? '';
  const isSelfLoop = source === target;
  const isActive = !!data?.isActive;
  const edgeColor = isActive ? 'var(--yellow)' : 'var(--border-light)';
  const edgeStyle = {
    ...(style ?? {}),
    stroke: edgeColor,
    strokeWidth: isActive ? 3 : 2,
  } as React.CSSProperties;
  const marker = typeof markerEnd === 'string'
    ? markerEnd
    : markerEnd
    ? {
      ...markerEnd,
      color: edgeColor,
    }
    : markerEnd;

  if (isSelfLoop) {
    const cx = sourceX;
    const cy = sourceY - 26; // top of node
    const r  = SELF_LOOP_HEIGHT / 2;

    // Arc loop above the node (non-cubic path)
    const d = `M ${cx - 2},${cy} A ${r},${r * 1.05} 0 1 1 ${cx + 2},${cy}`;

    const midX = cx;
    const midY = cy - SELF_LOOP_HEIGHT;

    return (
      <>
        <path
          id={id}
          d={d}
          fill="none"
          markerEnd={marker}
          style={edgeStyle}
        />
        <EdgeLabelRenderer>
          <div
            style={{
              ...labelStyle,
              border: `1px solid ${isActive ? 'var(--yellow)' : 'var(--border)'}`,
              color: isActive ? 'var(--yellow)' : labelStyle.color,
              transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  // Clip the edge endpoint so arrows touch the destination circle boundary,
  // while keeping the origin at the source center.
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy);
  const clippedTargetX = len > 0 ? targetX - (dx / len) * STATE_RADIUS : targetX;
  const clippedTargetY = len > 0 ? targetY - (dy / len) * STATE_RADIUS : targetY;

  if (data?.hasBidirectional) {
    // For A->B and B->A, draw mirrored quadratic arcs (one above, one below).
    // Use a stable pair orientation so reverse edges get opposite control points.
    const canonicalForward = source < target;
    const ax = canonicalForward ? sourceX : targetX;
    const ay = canonicalForward ? sourceY : targetY;
    const bx = canonicalForward ? targetX : sourceX;
    const by = canonicalForward ? targetY : sourceY;

    const pairDx = bx - ax;
    const pairDy = by - ay;
    const pairLen = Math.hypot(pairDx, pairDy) || 1;
    const nx = -pairDy / pairLen;
    const ny = pairDx / pairLen;

    const direction = source < target ? 1 : -1;
    const offset = BIDIRECTIONAL_OFFSET * direction;

    const cx = (sourceX + targetX) / 2 + nx * offset;
    const cy = (sourceY + targetY) / 2 + ny * offset;

    edgePath = `M ${sourceX},${sourceY} Q ${cx},${cy} ${clippedTargetX},${clippedTargetY}`;

    // Quadratic midpoint at t = 0.5
    labelX = 0.25 * sourceX + 0.5 * cx + 0.25 * clippedTargetX;
    labelY = 0.25 * sourceY + 0.5 * cy + 0.25 * clippedTargetY;
  } else {
    // Single-direction transitions are straight arrows.
    const [path, lx, ly] = getStraightPath({
      sourceX, sourceY,
      targetX: clippedTargetX,
      targetY: clippedTargetY,
      sourcePosition,
      targetPosition,
    });
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={marker} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            ...labelStyle,
            border: `1px solid ${isActive ? 'var(--yellow)' : 'var(--border)'}`,
            color: isActive ? 'var(--yellow)' : labelStyle.color,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          className="nodrag nopan"
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(TransitionEdge);
