import type { Automaton, SimulationResult } from '../types';
import { epsilonClosure } from './epsilonClosure';


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

  const startState = automaton.states.find(s => s.isStart);
  if (!startState) {
    return { accepted: false, stateHistory: [[]], inputSymbols: [] };
  }

  const symbols = input === '' ? [] : Array.from(input);

  if (automaton.type === 'DFA') {
    const dfaAlphabet = automaton.alphabet.filter(a => a !== 'ε');
    for (const state of automaton.states) {
      for (const sym of dfaAlphabet) {
        let count = 0;
        for (const t of automaton.transitions) {
          if (t.from === state.id && t.symbols.includes(sym)) count++;
        }
        if (count === 0) {
          throw new Error(`Invalid DFA: State '${state.label}' is missing a transition for symbol '${sym}'.`);
        }
        if (count > 1) {
          throw new Error(`Invalid DFA: State '${state.label}' has multiple transitions for symbol '${sym}'.`);
        }
      }
    }

    let currentId: string = startState.id;
    const history: string[][] = [[currentId]];

    for (const sym of symbols) {
      const nextId = (() => {
        for (const t of automaton.transitions) {
          if (t.from === currentId && t.symbols.includes(sym)) return t.to;
        }
        return null;
      })();
      if (!nextId) {
        throw new Error(`Invalid input: Symbol '${sym}' is not in the alphabet.`);
      }
      currentId = nextId;
      history.push([currentId]);
    }

    const finalState = automaton.states.find(s => s.id === currentId);
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
