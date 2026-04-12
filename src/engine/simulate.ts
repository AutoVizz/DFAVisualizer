import type { Automaton, SimulationResult } from '../types';
import { epsilonClosure } from './epsilonClosure';

/**
 * Move function: given a set of states and a non-ε symbol,
 * return the set of states reachable via that symbol.
 */
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

/**
 * Simulate an automaton on an input string ω.
 *
 * - DFA: deterministic step through δ
 * - NFA: track set of current states + ε-closure after every symbol
 * - ε represented as the string "ε"
 *
 * Returns: { accepted, stateHistory }
 * stateHistory[0] = initial state set (before any symbol processed)
 * stateHistory[i] = state set after processing the i-th symbol (1-indexed)
 */
export function simulate(automaton: Automaton, input: string): SimulationResult {
  // Find the start state
  const startState = automaton.states.find(s => s.isStart);
  if (!startState) {
    return { accepted: false, stateHistory: [[]], inputSymbols: [] };
  }

  // Split input into symbols — treat each character as a symbol
  const symbols = input === '' ? [] : Array.from(input);

  if (automaton.type === 'DFA') {
    let currentId: string | null = startState.id;
    const history: string[][] = [[currentId]];

    for (const sym of symbols) {
      if (currentId === null) {
        history.push([]);
        continue;
      }
      const nextId = (() => {
        for (const t of automaton.transitions) {
          if (t.from === currentId && t.symbols.includes(sym)) return t.to;
        }
        return null;
      })();
      currentId = nextId;
      history.push(currentId ? [currentId] : []);
    }

    const finalState = currentId
      ? automaton.states.find(s => s.id === currentId)
      : null;
    return {
      accepted: finalState?.isAccept ?? false,
      stateHistory: history,
      inputSymbols: symbols,
    };
  } else {
    // NFA simulation via subset construction on-the-fly
    let current = epsilonClosure(automaton, new Set([startState.id]));
    const history: string[][] = [Array.from(current)];

    for (const sym of symbols) {
      const moved = move(automaton, current, sym);
      current = epsilonClosure(automaton, moved);
      history.push(Array.from(current));
    }

    const accepted = Array.from(current).some(id => {
      const st = automaton.states.find(s => s.id === id);
      return st?.isAccept ?? false;
    });

    return { accepted, stateHistory: history, inputSymbols: symbols };
  }
}
