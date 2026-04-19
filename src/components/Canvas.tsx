import React, { useCallback, useRef, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  applyEdgeChanges,
  BackgroundVariant,
  type ReactFlowInstance,
  type XYPosition,
  type NodePositionChange,
  type NodeRemoveChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import StateNode from './StateNode';
import TransitionEdge from './TransitionEdge';
import ContextMenu from './ContextMenu';
import SymbolPopover from './SymbolPopover';
import type { State, Transition, ContextMenuState } from '../types';
import { generateId, getNextLabel } from '../lib/utils';

const nodeTypes = { stateNode: StateNode };
const edgeTypes = { transitionEdge: TransitionEdge };

interface CanvasProps {
  readOnly?: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ readOnly = false }) => {
  const {
    activeProject,
    viewOnlyProject,
    updateActiveProject,
    simulationResult,
    simulationStep,
    isSimulating,
  } = useStore();

  const project = readOnly ? viewOnlyProject : activeProject;

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [symbolPopover, setSymbolPopover] = useState<{
    x: number;
    y: number;
    sourceId: string;
    targetId: string;
    editingEdgeId?: string;
  } | null>(null);
  const [renameState, setRenameState] = useState<{ id: string; label: string } | null>(null);

  // Get active state IDs for simulation highlighting
  const activeStateIds = useMemo(() => {
    if (!simulationResult || !isSimulating) return new Set<string>();
    const step = simulationResult.stateHistory[simulationStep];
    return new Set(step || []);
  }, [simulationResult, simulationStep, isSimulating]);

  // ─── Double-click node → toggle accept ────────────────────────

  const handleDoubleClickNode = useCallback(
    (stateId: string) => {
      if (readOnly) return;
      updateActiveProject((p) => ({
        ...p,
        states: p.states.map((s) =>
          s.id === stateId ? { ...s, isAccept: !s.isAccept } : s
        ),
      }));
    },
    [readOnly, updateActiveProject]
  );

  // Convert automaton states to React Flow nodes
  const nodes: Node[] = useMemo(() => {
    if (!project) return [];
    return project.states.map((state) => ({
      id: state.id,
      type: 'stateNode',
      position: state.position,
      data: {
        state,
        isActive: activeStateIds.has(state.id),
        onDoubleClick: readOnly ? () => {} : handleDoubleClickNode,
      },
      draggable: !readOnly,
      selectable: !readOnly,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, activeStateIds, readOnly]);

  // Convert automaton transitions to React Flow edges
  const edges: Edge[] = useMemo(() => {
    if (!project) return [];
    return project.transitions.map((transition) => ({
      id: transition.id,
      source: transition.from,
      target: transition.to,
      type: 'transitionEdge',
      data: { symbols: transition.symbols },
      selectable: !readOnly,
    }));
  }, [project, readOnly]);

  // ─── Node interactions ─────────────────────────────────────────

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if (readOnly || !project) return;

      // Check for deletions
      const removeChanges = changes.filter((c): c is NodeRemoveChange => c.type === 'remove');
      if (removeChanges.length > 0) {
        const deletedIds = removeChanges.map(c => c.id);
        updateActiveProject((p) => ({
          ...p,
          states: p.states.filter((s) => !deletedIds.includes(s.id)),
          transitions: p.transitions.filter(
            (t) => !deletedIds.includes(t.from) && !deletedIds.includes(t.to)
          ),
        }));
        return;
      }

      // Update positions directly from event changes
      const positionChanges = changes.filter((c): c is NodePositionChange => c.type === 'position' && c.position !== undefined);
      if (positionChanges.length > 0) {
        updateActiveProject((p) => {
          let hasChanges = false;
          const posMap = new Map();
          positionChanges.forEach(c => posMap.set(c.id, c.position));

          const newStates = p.states.map((s) => {
            const newPos = posMap.get(s.id);
            if (newPos) {
              hasChanges = true;
              return { ...s, position: newPos };
            }
            return s;
          });

          if (!hasChanges) return p;
          return { ...p, states: newStates };
        });
      }
    },
    [readOnly, project, updateActiveProject]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      if (readOnly || !project) return;
      applyEdgeChanges(changes, edges);

      const deletedIds = changes
        .filter((c) => c.type === 'remove')
        .map((c) => c.id);

      if (deletedIds.length > 0) {
        updateActiveProject((p) => ({
          ...p,
          transitions: p.transitions.filter((t) => !deletedIds.includes(t.id)),
        }));
      }
    },
    [readOnly, project, edges, updateActiveProject]
  );

  // ─── Connection (new transition) ──────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !connection.source || !connection.target) return;

      // Show symbol popover
      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      setSymbolPopover({
        x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
        y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
        sourceId: connection.source,
        targetId: connection.target,
      });
    },
    [readOnly]
  );

  const handleSymbolSubmit = useCallback(
    (symbols: string[]) => {
      if (!symbolPopover) return;

      if (symbolPopover.editingEdgeId) {
        // Edit existing transition
        updateActiveProject((p) => ({
          ...p,
          transitions: p.transitions.map((t) =>
            t.id === symbolPopover.editingEdgeId ? { ...t, symbols } : t
          ),
        }));
      } else {
        // Create new transition
        const newTransition: Transition = {
          id: generateId(),
          from: symbolPopover.sourceId,
          to: symbolPopover.targetId,
          symbols,
        };

        updateActiveProject((p) => {
          // Update alphabet with new symbols
          const newAlphabet = new Set(p.alphabet);
          symbols.forEach((s) => {
            if (s !== 'ε') newAlphabet.add(s);
          });

          return {
            ...p,
            transitions: [...p.transitions, newTransition],
            alphabet: Array.from(newAlphabet).sort(),
          };
        });
      }

      setSymbolPopover(null);
    },
    [symbolPopover, updateActiveProject]
  );

  // ─── Double-click canvas → add state ──────────────────────────

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (readOnly || !rfInstance || !project) return;
      event.preventDefault();

      let position: XYPosition;
      if (typeof rfInstance.screenToFlowPosition === 'function') {
        position = rfInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
      } else {
        const bounds = reactFlowWrapper.current?.getBoundingClientRect();
        if (!bounds) return;
        position = rfInstance.project({
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        });
      }

      const existingLabels = project.states.map((s) => s.label);
      const label = getNextLabel(existingLabels);
      const isFirst = project.states.length === 0;

      const newState: State = {
        id: generateId(),
        label,
        isStart: isFirst,
        isAccept: false,
        position,
      };

      updateActiveProject((p) => ({
        ...p,
        states: [...p.states, newState],
      }));
    },
    [readOnly, rfInstance, project, updateActiveProject]
  );

  // ─── Right-click context menus ────────────────────────────────

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'state',
        targetId: node.id,
      });
    },
    [readOnly]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (readOnly) return;
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'edge',
        targetId: edge.id,
      });
    },
    [readOnly]
  );

  // ─── Context menu items ───────────────────────────────────────

  const contextMenuItems = useMemo(() => {
    if (!contextMenu || !project) return [];

    if (contextMenu.type === 'state') {
      const state = project.states.find((s) => s.id === contextMenu.targetId);
      if (!state) return [];

      return [
        {
          label: 'Set as Start State',
          onClick: () => {
            updateActiveProject((p) => ({
              ...p,
              states: p.states.map((s) => ({
                ...s,
                isStart: s.id === contextMenu.targetId,
              })),
            }));
          },
        },
        {
          label: state.isAccept ? 'Remove Accept' : 'Toggle Accept',
          onClick: () => {
            updateActiveProject((p) => ({
              ...p,
              states: p.states.map((s) =>
                s.id === contextMenu.targetId
                  ? { ...s, isAccept: !s.isAccept }
                  : s
              ),
            }));
          },
        },
        {
          label: 'Rename',
          onClick: () => {
            setRenameState({ id: state.id, label: state.label });
          },
        },
        {
          label: 'Delete',
          variant: 'danger' as const,
          onClick: () => {
            updateActiveProject((p) => ({
              ...p,
              states: p.states.filter((s) => s.id !== contextMenu.targetId),
              transitions: p.transitions.filter(
                (t) =>
                  t.from !== contextMenu.targetId &&
                  t.to !== contextMenu.targetId
              ),
            }));
          },
        },
      ];
    }

    // Edge context menu
    return [
      {
        label: 'Edit Symbols',
        onClick: () => {
          const transition = project.transitions.find(
            (t) => t.id === contextMenu.targetId
          );
          if (!transition) return;
          setSymbolPopover({
            x: contextMenu.x,
            y: contextMenu.y,
            sourceId: transition.from,
            targetId: transition.to,
            editingEdgeId: transition.id,
          });
        },
      },
      {
        label: 'Delete',
        variant: 'danger' as const,
        onClick: () => {
          updateActiveProject((p) => ({
            ...p,
            transitions: p.transitions.filter(
              (t) => t.id !== contextMenu.targetId
            ),
          }));
        },
      },
    ];
  }, [contextMenu, project, updateActiveProject]);

  // ─── No Start State Warning ───────────────────────────────────

  const hasStartState = project?.states.some((s) => s.isStart) ?? false;
  const hasStates = (project?.states.length ?? 0) > 0;

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        onPaneClick={onPaneClick}
        onDoubleClick={onPaneDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        deleteKeyCode={readOnly ? null : 'Delete'}
        multiSelectionKeyCode="Shift"
        zoomOnDoubleClick={false}
        snapToGrid
        snapGrid={[10, 10]}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'transitionEdge',
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#333"
        />
        {!readOnly && <Controls />}
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as { isActive?: boolean };
            if (data?.isActive) return '#facc15';
            return '#7c3aed';
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          style={{ background: '#1a1a1a' }}
        />
      </ReactFlow>

      {/* No start state warning */}
      {hasStates && !hasStartState && !readOnly && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 animate-slide-up">
          <div className="bg-amber-900/30 border border-amber-700/50 text-amber-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
            No start state defined. Right-click a state to set it as start.
          </div>
        </div>
      )}

      {/* Empty canvas hint */}
      {!hasStates && !readOnly && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center animate-fade-in">
            <div className="text-text-muted text-lg mb-2">Double-click to add a state</div>
            <div className="text-text-muted/50 text-sm">First state will be the start state</div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Symbol popover */}
      {symbolPopover && (
        <SymbolPopover
          x={symbolPopover.x}
          y={symbolPopover.y}
          onSubmit={handleSymbolSubmit}
          onCancel={() => setSymbolPopover(null)}
          initialSymbols={
            symbolPopover.editingEdgeId
              ? project?.transitions.find((t) => t.id === symbolPopover.editingEdgeId)?.symbols
              : undefined
          }
        />
      )}

      {/* Rename dialog */}
      {renameState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-xl p-6 w-80 animate-scale-in shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Rename State</h3>
            <input
              type="text"
              className="input-field mb-4 font-mono"
              value={renameState.label}
              onChange={(e) =>
                setRenameState({ ...renameState, label: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateActiveProject((p) => ({
                    ...p,
                    states: p.states.map((s) =>
                      s.id === renameState.id
                        ? { ...s, label: renameState.label }
                        : s
                    ),
                  }));
                  setRenameState(null);
                } else if (e.key === 'Escape') {
                  setRenameState(null);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                className="btn-secondary text-sm"
                onClick={() => setRenameState(null)}
              >
                Cancel
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  updateActiveProject((p) => ({
                    ...p,
                    states: p.states.map((s) =>
                      s.id === renameState.id
                        ? { ...s, label: renameState.label }
                        : s
                    ),
                  }));
                  setRenameState(null);
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;
