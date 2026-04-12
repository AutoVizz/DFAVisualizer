import dagre from '@dagrejs/dagre';
import type { Automaton } from '../types';

const NODE_WIDTH  = 60;
const NODE_HEIGHT = 60;

/**
 * Apply dagre auto-layout to an automaton.
 * Assigns (x, y) positions to every state node.
 */
export function autoLayout(automaton: Automaton): Automaton {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir:  'LR',
    ranksep:  160,
    nodesep:  100,
    marginx:  60,
    marginy:  60,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const state of automaton.states) {
    g.setNode(state.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const t of automaton.transitions) {
    g.setEdge(t.from, t.to);
  }

  dagre.layout(g);

  const updatedStates = automaton.states.map(state => {
    const node = g.node(state.id);
    return {
      ...state,
      position: {
        x: node ? node.x - NODE_WIDTH / 2 : state.position.x,
        y: node ? node.y - NODE_HEIGHT / 2 : state.position.y,
      },
    };
  });

  return { ...automaton, states: updatedStates };
}
