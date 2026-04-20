import type { Automaton } from '../types';
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
