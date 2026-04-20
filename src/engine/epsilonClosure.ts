import type { Automaton } from '../types';

/**
 * Compute the ε-closure of a set of states using iterative DFS.
 * No recursion to prevent stack overflow on large automata.
 */
export function epsilonClosure(
  automaton: Automaton,
  stateIds: Set<string>,
): Set<string> {
  const closure = new Set<string>(stateIds);
  const stack   = Array.from(stateIds);

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const t of automaton.transitions) {
      if (t.from === current && t.symbols.includes('ε')) {
        if (!closure.has(t.to)) {
          closure.add(t.to);
          stack.push(t.to);
        }
      }
    }
  }

  return closure;
}
