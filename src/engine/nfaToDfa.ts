import type { Automaton, State, Transition } from "../types";
import { epsilonClosure } from "./epsilonClosure";
import { autoLayout } from "./autoLayout";

const MAX_STATES = 100;

function move(automaton: Automaton, states: Set<string>, symbol: string): Set<string> {
  const result = new Set<string>();
  for (const stateId of states) {
    for (const t of automaton.transitions) {
      if (t.from === stateId && t.symbols.includes(symbol)) {
        result.add(t.to);
      }
    }
  }
  return result;
}

function setKey(s: Set<string>): string {
  return Array.from(s).sort().join(",");
}

export function nfaToDfa(nfa: Automaton): Automaton {
  const startState = nfa.states.find((s) => s.isStart);
  if (!startState) {
    throw new Error("NFA has no start state");
  }

  const alphabet = [...new Set(nfa.alphabet.filter((sym) => sym !== "ε"))];

  const dfaStateMap = new Map<string, string>();
  const dfaStates: State[] = [];
  const dfaTransitions: Transition[] = [];

  let labelIndex = 0;

  function getOrCreate(subsetKey: string, subset: Set<string>): string {
    if (dfaStateMap.has(subsetKey)) return dfaStateMap.get(subsetKey)!;

    if (dfaStates.length >= MAX_STATES) {
      throw new Error("MAX_STATE_LIMIT_EXCEEDED");
    }

    const id = crypto.randomUUID();
    const label = `q${labelIndex++}`;
    const isStart = dfaStates.length === 0;
    const isAccept = Array.from(subset).some(
      (sid) => nfa.states.find((s) => s.id === sid)?.isAccept ?? false,
    );

    dfaStates.push({ id, label, isStart, isAccept, position: { x: 0, y: 0 } });
    dfaStateMap.set(subsetKey, id);
    return id;
  }

  const startSubset = epsilonClosure(nfa, new Set([startState.id]));
  const startKey = setKey(startSubset);
  getOrCreate(startKey, startSubset);

  const worklist: string[] = [startKey];
  const processed = new Set<string>();

  while (worklist.length > 0) {
    const currentKey = worklist.pop()!;
    if (processed.has(currentKey)) continue;
    processed.add(currentKey);

    const currentSubset = new Set(currentKey ? currentKey.split(",") : []);
    const fromId = dfaStateMap.get(currentKey)!;

    for (const sym of alphabet) {
      const moved = move(nfa, currentSubset, sym);
      const closed = epsilonClosure(nfa, moved);

      const toKey = setKey(closed);
      getOrCreate(toKey, closed);
      const toId = dfaStateMap.get(toKey)!;

      dfaTransitions.push({
        id: crypto.randomUUID(),
        from: fromId,
        to: toId,
        symbols: [sym],
      });

      if (!processed.has(toKey)) {
        worklist.push(toKey);
      }
    }
  }

  return autoLayout({
    id: crypto.randomUUID(),
    name: `${nfa.name} (DFA)`,
    type: "DFA",
    states: dfaStates,
    alphabet,
    transitions: dfaTransitions,
    minimizedDfaId: null,
  });
}
