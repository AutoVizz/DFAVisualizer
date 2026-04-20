import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

import { useStore } from "../../store/useStore";
import StateNode, { type StateNodeData } from "./StateNode";
import TransitionEdge, { type TransitionEdgeData } from "./TransitionEdge";
import CanvasContextMenu from "./CanvasContextMenu";
import EdgePopover from "./EdgePopover";
import type { Automaton, State, Transition } from "../../types";
import { nextStateLabel } from "../../lib/utils";
import { emitGlobalAlert } from "../ui/GlobalBanner";

const NODE_TYPES = { stateNode: StateNode };
const EDGE_TYPES = { transitionEdge: TransitionEdge };

function toRFNodes(states: State[], activeIds: string[], readOnly: boolean): Node<StateNodeData>[] {
  return states.map((s) => ({
    id: s.id,
    type: "stateNode",
    position: s.position,
    data: { state: s, activeStateIds: activeIds, readOnly },
    draggable: !readOnly,
    selectable: !readOnly,
  }));
}

function toRFEdges(
  transitions: Transition[],
  activeTransitionIds: Set<string> = new Set(),
): Edge<TransitionEdgeData>[] {
  const groups = new Map<string, Transition[]>();
  for (const t of transitions) {
    const key = `${t.from}\x00${t.to}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const directionKeys = new Set(groups.keys());

  const edges: Edge<TransitionEdgeData>[] = [];
  for (const [_key, group] of groups) {
    const first = group[0]!;
    const allSymbols = [...new Set(group.flatMap((t) => t.symbols))];
    const mergedTransition: Transition = {
      id: `${first.from}__${first.to}`,
      from: first.from,
      to: first.to,
      symbols: allSymbols,
    };

    const reverseKey = `${first.to}\x00${first.from}`;
    const hasBidirectional = first.from !== first.to && directionKeys.has(reverseKey);
    const isActive = group.some((t) => activeTransitionIds.has(t.id));

    edges.push({
      id: mergedTransition.id,
      source: first.from,
      target: first.to,
      type: "transitionEdge",
      data: {
        transition: mergedTransition,
        transitionIds: group.map((t) => t.id),
        hasBidirectional,
        isActive,
      },
    });
  }
  return edges;
}

interface CtxMenu {
  x: number;
  y: number;
  targetId: string;
  targetType: "node" | "edge" | "pane";
}

interface PendingConn {
  connection: Connection;
  x: number;
  y: number;
}

interface FlowCanvasProps {
  readOnly?: boolean;
  projectOverride?: Automaton | null;
}

export default function FlowCanvas({ readOnly = false, projectOverride = null }: FlowCanvasProps) {
  const {
    activeProject,
    simulationResult,
    simulationStep,
    updateStates,
    updateTransitions,
    updateAlphabet,
    updateActiveProject,
  } = useStore();
  const project = projectOverride ?? activeProject;

  const [rfNodes, setRfNodes, onRFNodesChange] = useNodesState<StateNodeData>([]);
  const [rfEdges, setRfEdges, onRFEdgesChange] = useEdgesState<TransitionEdgeData>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [pending, setPending] = useState<PendingConn | null>(null);
  const [transitionFromSource, setTransitionFromSource] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editingEdgeValue, setEditingEdgeValue] = useState("");

  const rfInstance = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastMouse = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const activeStateIds = useMemo(() => {
    if (!simulationResult || !project) return [] as string[];
    return simulationResult.stateHistory[simulationStep] ?? [];
  }, [simulationResult, simulationStep, project]);

  const activeTransitionIds = useMemo(() => {
    if (!project || !simulationResult || simulationStep <= 0) {
      return new Set<string>();
    }

    const symbol = simulationResult.inputSymbols[simulationStep - 1];
    if (!symbol) return new Set<string>();

    const prev = new Set(simulationResult.stateHistory[simulationStep - 1] ?? []);
    const curr = new Set(simulationResult.stateHistory[simulationStep] ?? []);

    return new Set(
      project.transitions
        .filter((t) => prev.has(t.from) && curr.has(t.to) && t.symbols.includes(symbol))
        .map((t) => t.id),
    );
  }, [project, simulationResult, simulationStep]);

  useEffect(() => {
    if (!project) {
      setRfNodes([]);
      setRfEdges([]);
      return;
    }
    setRfNodes(toRFNodes(project.states, activeStateIds, readOnly));
    setRfEdges(toRFEdges(project.transitions, activeTransitionIds));
  }, [project?.id, readOnly]);

  useEffect(() => {
    if (!project) return;
    setRfEdges(toRFEdges(project.transitions, activeTransitionIds));
  }, [project?.transitions, activeTransitionIds]);

  useEffect(() => {
    setRfEdges((edges) =>
      edges.map((e) => {
        const isEditing = e.id === editingEdgeId;
        if (!isEditing && !e.data?.isEditing) return e;
        return {
          ...e,
          data: {
            ...e.data!,
            isEditing,
            editValue: isEditing ? editingEdgeValue : undefined,
            onEditChange: isEditing ? (val: string) => setEditingEdgeValue(val) : undefined,
            onEditCommit: isEditing ? () => commitEdgeEdit(e.id, editingEdgeValue) : undefined,
            onEditCancel: isEditing ? () => setEditingEdgeId(null) : undefined,
          },
        };
      }),
    );
  }, [editingEdgeId, editingEdgeValue]);

  useEffect(() => {
    if (readOnly) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTypingTarget) return;

      if (e.key === "Escape") {
        setTransitionFromSource(null);
        return;
      }

      if (e.key.toLowerCase() !== "t") return;

      const selectedNodes = rfNodes.filter((n) => n.selected);
      if (selectedNodes.length !== 1) return;

      e.preventDefault();
      setCtxMenu(null);
      setTransitionFromSource(selectedNodes[0]!.id);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly, rfNodes]);

  useEffect(() => {
    setRfNodes((nodes) =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, activeStateIds },
      })),
    );
  }, [activeStateIds, setRfNodes]);

  useEffect(() => {
    if (!project) return;
    setRfNodes((nodes) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      return project.states.map((st) => {
        const existing = byId.get(st.id);
        if (existing) {
          return {
            ...existing,
            position: st.position,
            data: { ...existing.data, state: st, activeStateIds, readOnly },
            draggable: !readOnly,
            selectable: !readOnly,
          };
        }
        return {
          id: st.id,
          type: "stateNode",
          position: st.position,
          data: { state: st, activeStateIds, readOnly },
          draggable: !readOnly,
          selectable: !readOnly,
        };
      });
    });
  }, [project?.states, activeStateIds, readOnly]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      onRFNodesChange(changes);

      if (!activeProject) return;

      const positionChanges = changes.filter(
        (c): c is Extract<NodeChange, { type: "position" }> =>
          c.type === "position" && c.position !== undefined,
      );
      if (positionChanges.length > 0) {
        updateActiveProject((p) => {
          const posMap = new Map();
          positionChanges.forEach((c) => posMap.set(c.id, c.position));
          const newStates = p.states.map((s) => {
            const pos = posMap.get(s.id);
            return pos ? { ...s, position: pos } : s;
          });
          return { ...p, states: newStates };
        });
      }

      const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length > 0) {
        updateStates(activeProject.states.filter((s) => !removed.includes(s.id)));
        updateTransitions(
          activeProject.transitions.filter(
            (t) => !removed.includes(t.from) && !removed.includes(t.to),
          ),
        );
      }
    },
    [readOnly, activeProject, onRFNodesChange, updateStates, updateTransitions],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
      if (removed.length > 0 && activeProject) {
        updateTransitions(
          activeProject.transitions.filter((t) => {
            const mergedId = `${t.from}__${t.to}`;
            return !removed.includes(t.id) && !removed.includes(mergedId);
          }),
        );
      } else {
        onRFEdgesChange(changes);
      }
    },
    [readOnly, activeProject, onRFEdgesChange, updateTransitions],
  );

  const onConnectComplete = useCallback(
    (conn: Connection) => {
      if (readOnly || !conn.source || !conn.target) return;
      setPending({ connection: conn, x: lastMouse.current.x, y: lastMouse.current.y });
    },
    [readOnly],
  );

  const confirmTransition = useCallback(
    (symbols: string[]) => {
      if (!pending || !activeProject) {
        setPending(null);
        return;
      }
      const { source, target } = pending.connection;
      if (!source || !target) {
        setPending(null);
        return;
      }

      let nextSymbols = [...new Set(symbols)];

      if (activeProject.type === "DFA") {
        const conflicts = new Set<string>();
        const duplicates = new Set<string>();

        for (const sym of nextSymbols) {
          const existing = activeProject.transitions.find(
            (t) => t.from === source && t.symbols.includes(sym),
          );
          if (!existing) continue;
          if (existing.to === target) duplicates.add(sym);
          else conflicts.add(sym);
        }

        if (conflicts.size > 0) {
          emitGlobalAlert(
            `In a DFA, each state can only have one transition for a given symbol. "${Array.from(
              conflicts,
            ).join(", ")}" is already used elsewhere from this state.`,
          );
        }

        nextSymbols = nextSymbols.filter((sym) => !conflicts.has(sym) && !duplicates.has(sym));

        if (nextSymbols.length === 0) {
          setPending(null);
          return;
        }
      }

      const newAlphaSymbols = nextSymbols.filter(
        (s) => s !== "ε" && !activeProject.alphabet.includes(s),
      );
      if (newAlphaSymbols.length > 0) {
        updateAlphabet([...activeProject.alphabet, ...newAlphaSymbols]);
      }

      const newTransition: Transition = {
        id: crypto.randomUUID(),
        from: source,
        to: target,
        symbols: nextSymbols,
      };
      updateTransitions([...activeProject.transitions, newTransition]);
      setPending(null);
    },
    [pending, activeProject, updateTransitions, updateAlphabet],
  );

  const addStateAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!activeProject) return;
      const bounds = wrapperRef.current?.getBoundingClientRect();
      if (!bounds || !rfInstance.current) return;
      const position = rfInstance.current.project({
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      });
      const id = crypto.randomUUID();
      const label = nextStateLabel(activeProject.states);
      const isFirst = activeProject.states.length === 0;
      const newState: State = { id, label, isStart: isFirst, isAccept: false, position };

      const liveNodePos = new Map(rfNodes.map((n) => [n.id, n.position]));
      const syncedStates = activeProject.states.map((s) => {
        const livePos = liveNodePos.get(s.id);
        return livePos ? { ...s, position: livePos } : s;
      });

      updateStates([...syncedStates, newState]);
    },
    [activeProject, rfNodes, updateStates],
  );

  const syncAndUpdateStates = useCallback(
    (mapper: (states: State[]) => State[]) => {
      if (!activeProject) return;
      const liveNodePos = new Map(rfNodes.map((n) => [n.id, n.position]));
      const withLivePositions = activeProject.states.map((s) => {
        const livePos = liveNodePos.get(s.id);
        return livePos ? { ...s, position: livePos } : s;
      });
      updateStates(mapper(withLivePositions));
    },
    [activeProject, rfNodes, updateStates],
  );

  const handleWrapperDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || !activeProject) return;
      const target = e.target as HTMLElement;
      const isOnInteractive =
        target.closest(".react-flow__node") !== null ||
        target.closest(".react-flow__edge") !== null ||
        target.closest(".react-flow__controls") !== null ||
        target.closest(".react-flow__minimap") !== null ||
        target.closest(".modal-overlay") !== null ||
        target.closest(".ctx-menu") !== null;
      if (isOnInteractive) return;
      addStateAt(e.clientX, e.clientY);
    },
    [readOnly, activeProject, addStateAt],
  );

  const handleNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (readOnly || !activeProject) return;
      syncAndUpdateStates((states) =>
        states.map((s) => (s.id === node.id ? { ...s, isAccept: !s.isAccept } : s)),
      );
    },
    [readOnly, activeProject, syncAndUpdateStates],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (readOnly || !transitionFromSource) return;
      setPending({
        connection: {
          source: transitionFromSource,
          target: node.id,
          sourceHandle: null,
          targetHandle: null,
        },
        x: lastMouse.current.x,
        y: lastMouse.current.y,
      });
      setTransitionFromSource(null);
    },
    [readOnly, transitionFromSource],
  );

  const handleNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (readOnly) return;
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, targetId: node.id, targetType: "node" });
    },
    [readOnly],
  );

  const handleEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      if (readOnly) return;
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, targetId: edge.id, targetType: "edge" });
    },
    [readOnly],
  );

  const nodeMenuItems = useMemo(() => {
    if (!ctxMenu || ctxMenu.targetType !== "node" || !activeProject) return [];
    const st = activeProject.states.find((s) => s.id === ctxMenu.targetId);
    if (!st) return [];
    return [
      {
        label: st.isAccept ? "Remove Accept" : "Set as Accept",
        action: () =>
          syncAndUpdateStates((states) =>
            states.map((s) => (s.id === ctxMenu.targetId ? { ...s, isAccept: !s.isAccept } : s)),
          ),
      },
      {
        label: "Rename",
        action: () => {
          setRenameTarget(ctxMenu.targetId);
          setRenameValue(st.label);
        },
      },
      {
        label: "Add Transition From Here",
        action: () => {
          setTransitionFromSource(ctxMenu.targetId);
        },
      },
      { label: "---", action: () => {} },
      {
        label: "Delete",
        danger: true,
        action: () => {
          if (transitionFromSource === ctxMenu.targetId) {
            setTransitionFromSource(null);
          }
          updateStates(activeProject.states.filter((s) => s.id !== ctxMenu.targetId));
          updateTransitions(
            activeProject.transitions.filter(
              (t) => t.from !== ctxMenu.targetId && t.to !== ctxMenu.targetId,
            ),
          );
        },
      },
    ];
  }, [
    ctxMenu,
    activeProject,
    syncAndUpdateStates,
    updateStates,
    updateTransitions,
    transitionFromSource,
  ]);

  const commitEdgeEdit = useCallback(
    (edgeKey: string, rawValue: string) => {
      setEditingEdgeId(null);
      if (!activeProject) return;
      const [fromId, toId] = edgeKey.split("__");
      let symbols = [
        ...new Set(
          rawValue
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ];
      if (symbols.length === 0) {
        if (activeProject.type === "NFA") {
          symbols = ["ε"];
        } else {
          return;
        }
      }

      if (activeProject.type === "DFA") {
        const conflicts = new Set<string>();
        const duplicates = new Set<string>();
        for (const symbol of symbols) {
          const existing = activeProject.transitions.find(
            (t) =>
              t.from === fromId &&
              t.symbols.includes(symbol) &&
              !(t.from === fromId && t.to === toId),
          );
          if (existing) {
            if (existing.to === toId) duplicates.add(symbol);
            else conflicts.add(symbol);
          }
        }
        if (conflicts.size > 0) {
          emitGlobalAlert(
            `In a DFA, each state can only have one transition for a given symbol. "${Array.from(
              conflicts,
            ).join(", ")}" already has a transition from this state.`,
          );
        }
        symbols = symbols.filter((sym) => !conflicts.has(sym) && !duplicates.has(sym));
        if (symbols.length === 0) return;
      }

      const newAlphaSymbols = symbols.filter(
        (s) => s !== "ε" && !activeProject.alphabet.includes(s),
      );
      if (newAlphaSymbols.length > 0)
        updateAlphabet([...activeProject.alphabet, ...newAlphaSymbols]);

      const newTr: Transition = { id: crypto.randomUUID(), from: fromId!, to: toId!, symbols };
      updateTransitions([
        ...activeProject.transitions.filter((t) => !(t.from === fromId && t.to === toId)),
        newTr,
      ]);
    },
    [activeProject, updateAlphabet, updateTransitions],
  );

  const edgeMenuItems = useMemo(() => {
    if (!ctxMenu || ctxMenu.targetType !== "edge" || !activeProject) return [];
    const [fromId, toId] = ctxMenu.targetId.split("__");
    const groupedTrans = activeProject.transitions.filter(
      (t) => t.from === fromId && t.to === toId,
    );
    const allSymbols = groupedTrans.flatMap((t) => t.symbols).join(", ");
    return [
      {
        label: "Edit Symbols",
        action: () => {
          setEditingEdgeId(ctxMenu.targetId);
          setEditingEdgeValue(allSymbols);
          setCtxMenu(null);
        },
      },
      { label: "---", action: () => {} },
      {
        label: "Delete",
        danger: true,
        action: () =>
          updateTransitions(
            activeProject.transitions.filter((t) => !(t.from === fromId && t.to === toId)),
          ),
      },
    ];
  }, [ctxMenu, activeProject, updateTransitions]);

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, height: "100%", position: "relative" }}
      onDoubleClick={handleWrapperDoubleClick}
      onMouseMove={(e) => {
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnectComplete}
        onInit={(inst) => {
          rfInstance.current = inst;
          requestAnimationFrame(() => inst.fitView({ padding: 0.3 }));
        }}
        onPaneClick={() => {
          setCtxMenu(null);
          setTransitionFromSource(null);
        }}
        onPaneContextMenu={(e: React.MouseEvent) => {
          if (readOnly) return;
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, targetId: "__pane__", targetType: "pane" });
        }}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        deleteKeyCode="Delete"
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--bg-base)" }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} color="var(--border)" gap={24} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeBorderRadius={100}
          nodeColor={(n) => {
            const d = n.data as StateNodeData;
            if (activeStateIds.includes(n.id)) return "#facc15";
            return d?.state?.isAccept ? "#7c3aed" : "#9ca3af";
          }}
          style={{ background: "var(--bg-surface)" }}
        />
      </ReactFlow>

      {transitionFromSource && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-light)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--text-secondary)",
            boxShadow: "var(--shadow)",
          }}
        >
          Select destination state to add transition. Click empty canvas or press Esc to cancel.
        </div>
      )}

      {ctxMenu && (
        <CanvasContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.targetType === "pane"
              ? [{ label: "Add State Here", action: () => addStateAt(ctxMenu.x, ctxMenu.y) }]
              : ctxMenu.targetType === "node"
                ? nodeMenuItems
                : edgeMenuItems
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      {pending && (
        <EdgePopover
          x={pending.x}
          y={pending.y}
          isNFA={activeProject?.type === "NFA"}
          onConfirm={confirmTransition}
          onCancel={() => setPending(null)}
        />
      )}

      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal" style={{ width: 320 }} onClick={(e) => e.stopPropagation()}>
            <p className="modal-title" style={{ fontSize: 15 }}>
              Rename State
            </p>
            <input
              className="input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (renameValue.trim() && activeProject) {
                    syncAndUpdateStates((states) =>
                      states.map((s) =>
                        s.id === renameTarget ? { ...s, label: renameValue.trim() } : s,
                      ),
                    );
                  }
                  setRenameTarget(null);
                }
                if (e.key === "Escape") setRenameTarget(null);
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  if (renameValue.trim() && activeProject) {
                    syncAndUpdateStates((states) =>
                      states.map((s) =>
                        s.id === renameTarget ? { ...s, label: renameValue.trim() } : s,
                      ),
                    );
                  }
                  setRenameTarget(null);
                }}
              >
                Rename
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
