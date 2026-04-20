import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getStraightPath, type EdgeProps } from "reactflow";
import type { Transition } from "../../types";

export interface TransitionEdgeData {
  transition: Transition;
  transitionIds?: string[];
  hasBidirectional?: boolean;
  isActive?: boolean;
  isEditing?: boolean;
  editValue?: string;
  onEditChange?: (val: string) => void;
  onEditCommit?: () => void;
  onEditCancel?: () => void;
}

const SELF_LOOP_HEIGHT = 52;
const BIDIRECTIONAL_OFFSET = 26;
const STATE_RADIUS = 30;

const labelStyle: React.CSSProperties = {
  position: "absolute",
  pointerEvents: "all",
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  color: "var(--text-secondary)",
  userSelect: "none",
};

function TransitionEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  selected,
}: EdgeProps<TransitionEdgeData>) {
  const label = data?.transition.symbols.join(", ") ?? "";
  const isSelfLoop = source === target;
  const isActive = !!data?.isActive;
  const isSelected = !!selected;

  const edgeColor =
    isActive && isSelected
      ? "var(--orange)"
      : isActive
        ? "var(--yellow)"
        : isSelected
          ? "var(--accent)"
          : "var(--text-muted)";
  const edgeStyle = {
    ...(style ?? {}),
    stroke: edgeColor,
    strokeWidth: isActive || isSelected ? 3 : 2,
  } as React.CSSProperties;

  const markerId = `arrowhead-${id}`;
  const marker = `url(#${markerId})`;

  const markerSvg = (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <marker
          id={markerId}
          markerWidth="12"
          markerHeight="12"
          refX="10"
          refY="6"
          markerUnits="userSpaceOnUse"
          orient="auto"
        >
          <path d="M0,0 L0,12 L12,6 z" fill={edgeColor} />
        </marker>
      </defs>
    </svg>
  );

  if (isSelfLoop) {
    const cx = sourceX;
    const cy = sourceY - 26;
    const r = SELF_LOOP_HEIGHT / 2;

    const d = `M ${cx - 2},${cy} A ${r},${r * 1.05} 0 1 1 ${cx + 2},${cy}`;

    const midX = cx;
    const midY = cy - SELF_LOOP_HEIGHT;

    return (
      <>
        {markerSvg}
        <path id={id} d={d} fill="none" markerEnd={marker} style={edgeStyle} />
        <EdgeLabelRenderer>
          <div
            style={{
              ...labelStyle,
              border: `1px solid ${isActive || isSelected ? edgeColor : "var(--border-light)"}`,
              color: isActive || isSelected ? edgeColor : labelStyle.color,
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

  let edgePath = "";
  let labelX = 0;
  let labelY = 0;

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy);
  const clippedTargetX = len > 0 ? targetX - (dx / len) * STATE_RADIUS : targetX;
  const clippedTargetY = len > 0 ? targetY - (dy / len) * STATE_RADIUS : targetY;

  if (data?.hasBidirectional) {
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

    labelX = 0.25 * sourceX + 0.5 * cx + 0.25 * clippedTargetX;
    labelY = 0.25 * sourceY + 0.5 * cy + 0.25 * clippedTargetY;
  } else {
    const [path, lx, ly] = getStraightPath({
      sourceX,
      sourceY,
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
      {markerSvg}
      <BaseEdge id={id} path={edgePath} markerEnd={marker} style={edgeStyle} />
      <EdgeLabelRenderer>
        <div
          style={{
            ...labelStyle,
            border: `1px solid ${isActive || isSelected || data?.isEditing ? edgeColor : "var(--border)"}`,
            color: isActive || isSelected ? edgeColor : labelStyle.color,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            padding: data?.isEditing ? 0 : labelStyle.padding,
            overflow: "visible",
          }}
          className="nodrag nopan"
        >
          {data?.isEditing ? (
            <input
              autoFocus
              className="input"
              style={{
                padding: "2px 6px",
                fontSize: 12,
                minHeight: 0,
                height: 24,
                textAlign: "center",
                width: Math.max(48, ((data.editValue?.length ?? 1) + 1) * 8),
                background: "var(--bg-surface)",
                border: "none",
                outline: "none",
                borderRadius: 4,
              }}
              value={data.editValue ?? ""}
              onChange={(e) => data.onEditChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  data.onEditCommit?.();
                }
                if (e.key === "Escape") data.onEditCancel?.();
              }}
              onBlur={() => data.onEditCommit?.()}
            />
          ) : (
            label
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(TransitionEdge);
