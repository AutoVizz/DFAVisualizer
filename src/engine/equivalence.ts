import type { Automaton, EquivalenceResult } from '../types';
import { minimize } from './minimize';

// ── djb2 hash ─────────────────────────────────────────────────────────────────
function djb2(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(16);
}

// ── BFS state renaming for canonicalization ───────────────────────────────────
function canonicalize(dfa: Automaton): string {
  const startState = dfa.states.find(s => s.isStart);
  if (!startState) return '';

  const sortedAlphabet = [...dfa.alphabet].sort();

  // BFS renaming
  const nameMap = new Map<string, string>(); // old id → canonical label
  const queue   = [startState.id];
  let counter   = 0;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (nameMap.has(curr)) continue;
    nameMap.set(curr, `q${counter++}`);

    // Follow transitions in alphabet order for deterministic BFS
    for (const sym of sortedAlphabet) {
      const t = dfa.transitions.find(
        tr => tr.from === curr && tr.symbols.includes(sym),
      );
      if (t && !nameMap.has(t.to)) {
        queue.push(t.to);
      }
    }
  }

  // Serialize accept states
  const acceptLabels = dfa.states
    .filter(s => s.isAccept && nameMap.has(s.id))
    .map(s => nameMap.get(s.id)!)
    .sort()
    .join(',');

  // Serialize transitions
  const transitionLines: string[] = [];
  for (const t of dfa.transitions) {
    const fromLabel = nameMap.get(t.from);
    const toLabel   = nameMap.get(t.to);
    if (!fromLabel || !toLabel) continue;
    for (const sym of t.symbols.sort()) {
      transitionLines.push(`${fromLabel}:${sym}->${toLabel}`);
    }
  }
  transitionLines.sort();

  return [
    `alpha:${sortedAlphabet.join(',')}`,
    `accept:${acceptLabels}`,
    ...transitionLines,
  ].join('|');
}

/**
 * Check whether two DFAs are equivalent.
 * Both automata must be DFAs; minimizes them first if needed.
 * Returns { equivalent, hash1, hash2 }
 */
export function equivalence(dfa1: Automaton, dfa2: Automaton): EquivalenceResult {
  if (dfa1.type !== 'DFA' || dfa2.type !== 'DFA') {
    throw new Error('Equivalence check requires both automata to be DFAs');
  }

  const min1 = minimize(dfa1);
  const min2 = minimize(dfa2);

  const canonical1 = canonicalize(min1);
  const canonical2 = canonicalize(min2);

  const hash1 = djb2(canonical1);
  const hash2 = djb2(canonical2);

  return {
    equivalent: hash1 === hash2,
    hash1,
    hash2,
  };
}

export { djb2, canonicalize };
