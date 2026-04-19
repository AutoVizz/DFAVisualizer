import type { Automaton, SimulationResult } from '../types';
import { epsilonClosure } from './epsilonClosure';

function validateDfaCompleteness(automaton: Automaton): void {
  if (automaton.type !== 'DFA') return;

  for (const state of automaton.states) {
    for (const symbol of automaton.alphabet) {
      const hasOutgoing = automaton.transitions.some(
        t => t.from === state.id && t.symbols.includes(symbol),
      );

      if (!hasOutgoing) {
        throw new Error(
          `INVALID_DFA: missing transition from ${state.label} on symbol '${symbol}'`,
        );
      }
    }
  }
}

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

export function simulate(automaton: Automaton, input: string): SimulationResult {
  validateDfaCompleteness(automaton);

  const startState = automaton.states.find(s => s.isStart);
  if (!startState) {
    return { accepted: false, stateHistory: [[]], inputSymbols: [] };
  }

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
