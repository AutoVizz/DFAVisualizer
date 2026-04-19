import type { Automaton, State, Transition } from '../types';
import { autoLayout } from './autoLayout';

export function minimize(dfa: Automaton): Automaton {
  if (dfa.type !== 'DFA') {
    throw new Error('minimize() requires a DFA, not an NFA');
  }
  if (dfa.states.length === 0) {
    return { ...dfa, id: crypto.randomUUID(), minimizedDfaId: null };
  }

  const startState = dfa.states.find(s => s.isStart);
  if (!startState) {
    throw new Error('DFA has no start state');
  }

  const reachable = new Set<string>();
  const queue     = [startState.id];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (reachable.has(curr)) continue;
    reachable.add(curr);
    for (const t of dfa.transitions) {
      if (t.from === curr && !reachable.has(t.to)) {
        queue.push(t.to);
      }
    }
  }

  const reachableStates      = dfa.states.filter(s => reachable.has(s.id));
  const reachableTransitions = dfa.transitions.filter(
    t => reachable.has(t.from) && reachable.has(t.to),
  );

  const alphabet = dfa.alphabet.filter(sym => sym !== 'ε');

  const delta = new Map<string, string>();
  for (const t of reachableTransitions) {
    for (const sym of t.symbols) {
      delta.set(`${t.from}:${sym}`, t.to);
    }
  }

  const acceptIds    = new Set(reachableStates.filter(s => s.isAccept).map(s => s.id));
  const nonAcceptIds = new Set(reachableStates.filter(s => !s.isAccept).map(s => s.id));

  let partitions: Set<string>[] = [];
  if (acceptIds.size    > 0) partitions.push(acceptIds);
  if (nonAcceptIds.size > 0) partitions.push(nonAcceptIds);

  const worklist = [...partitions.map(p => new Set(p))];

  function partitionOf(stateId: string): number {
    for (let i = 0; i < partitions.length; i++) {
      if (partitions[i].has(stateId)) return i;
    }
    return -1;
  }

  while (worklist.length > 0) {
    const splitter = worklist.pop()!;

    for (const sym of alphabet) {
      const X = new Set<string>();
      for (const sid of splitter) {
        for (const t of reachableTransitions) {
          if (t.to === sid && t.symbols.includes(sym)) {
            X.add(t.from);
          }
        }
      }
      if (X.size === 0) continue;

      const nextPartitions: Set<string>[] = [];
      for (const partition of partitions) {
        const intersect = new Set([...partition].filter(s => X.has(s)));
        const diff      = new Set([...partition].filter(s => !X.has(s)));

        if (intersect.size === 0 || diff.size === 0) {
          nextPartitions.push(partition);
        } else {
          nextPartitions.push(intersect);
          nextPartitions.push(diff);
          worklist.push(intersect.size <= diff.size ? intersect : diff);
        }
      }
      partitions = nextPartitions;
    }
  }

  const minStates: State[]      = [];
  const minTransitions: Transition[] = [];

  const partitionToId = new Map<number, string>();
  let labelIndex = 0;

  const startPartIdx = partitionOf(startState.id);

  for (let i = 0; i < partitions.length; i++) {
    const partition = partitions[i];
    const repId  = Array.from(partition)[0];
    const repSt  = reachableStates.find(s => s.id === repId)!;

    const isStart  = i === startPartIdx;
    const isAccept = repSt.isAccept;
    const id       = crypto.randomUUID();
    const label    = isStart ? 'q0' : `q${labelIndex + 1}`;

    if (!isStart) labelIndex++;

    partitionToId.set(i, id);
    minStates.push({ id, label, isStart, isAccept, position: { x: 0, y: 0 } });
  }

  let counter = 0;
  for (const st of minStates) {
    if (st.isStart) {
      st.label = 'q0';
    } else {
      counter++;
      st.label = `q${counter}`;
    }
  }

  for (let i = 0; i < partitions.length; i++) {
    const partition = partitions[i];
    const repId     = Array.from(partition)[0];
    const fromId    = partitionToId.get(i)!;

    for (const sym of alphabet) {
      const nextStateId = delta.get(`${repId}:${sym}`);
      if (!nextStateId) continue;
      const toPartIdx = partitionOf(nextStateId);
      if (toPartIdx === -1) continue;
      const toId = partitionToId.get(toPartIdx)!;

      minTransitions.push({
        id:   crypto.randomUUID(),
        from: fromId,
        to:   toId,
        symbols: [sym],
      });
    }
  }

  return autoLayout({
    id:            crypto.randomUUID(),
    name:          `${dfa.name} (Minimized)`,
    type:          'DFA',
    states:        minStates,
    alphabet,
    transitions:   minTransitions,
    minimizedDfaId: null,
  });
}
