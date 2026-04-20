import type { Automaton } from '../types';
export function cloneProject(source: Automaton, newName?: string): Automaton {
  const stateIdMap = new Map<string, string>();
  source.states.forEach(s => stateIdMap.set(s.id, crypto.randomUUID()));

  const states = source.states.map(s => ({
    ...s,
    id: stateIdMap.get(s.id)!,
  }));

  const transitions = source.transitions.map(t => ({
    ...t,
    id:   crypto.randomUUID(),
    from: stateIdMap.get(t.from) ?? t.from,
    to:   stateIdMap.get(t.to)   ?? t.to,
  }));

  return {
    ...source,
    id:             crypto.randomUUID(),
    name:           newName ?? `Copy of ${source.name}`,
    states,
    transitions,
    minimizedDfaId: null,
  };
}
export function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}
export function emptyAutomaton(id: string, name: string, type: 'DFA' | 'NFA'): Automaton {
  return { id, name, type, states: [], alphabet: [], transitions: [], minimizedDfaId: null };
}
export function nextStateLabel(states: Automaton['states']): string {
  const maxNum = states.reduce((max, s) => {
    const m = s.label.match(/^q(\d+)$/);
    return m ? Math.max(max, parseInt(m[1]!, 10)) : max;
  }, -1);
  return `q${maxNum + 1}`;
}
