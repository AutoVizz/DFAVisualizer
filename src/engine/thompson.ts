import type { Automaton, State, Transition } from '../types';
import { autoLayout } from './autoLayout';
import { epsilonClosure } from './epsilonClosure';

const MAX_REGEX_LENGTH = 100;
const EPSILON = 'ε';

interface Token {
  type: TokenType;
  value?: string;
}

function lex(regex: string): Token[] {
  if (regex.length > MAX_REGEX_LENGTH) {
    throw new Error('INVALID_REGEX: regex exceeds 100 characters');
  }

  const tokens: Token[] = [];
  let depth = 0;

  for (let i = 0; i < regex.length; i++) {
    const ch = regex[i];
    if (ch === '(') {
      tokens.push({ type: 'LPAREN' });
      depth++;
    } else if (ch === ')') {
      if (depth === 0) throw new Error('INVALID_REGEX: unbalanced parentheses');
      if (tokens.length > 0 && tokens[tokens.length - 1]!.type === 'LPAREN') {
        throw new Error('INVALID_REGEX: empty group ()');
      }
      tokens.push({ type: 'RPAREN' });
      depth--;
    } else if (ch === '|') {
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type === 'LPAREN' || prev.type === 'UNION') {
        throw new Error('INVALID_REGEX: consecutive or leading operator |');
      }
      tokens.push({ type: 'UNION' });
    } else if (ch === '*') {
      const prev = tokens[tokens.length - 1];
      if (!prev || prev.type === 'UNION' || prev.type === 'LPAREN' || prev.type === 'STAR') {
        throw new Error('INVALID_REGEX: misplaced *');
      }
      tokens.push({ type: 'STAR' });
    } else {
      const value = ch === '#' ? EPSILON : ch;
      tokens.push({ type: 'CHAR', value });
    }
  }

  if (depth !== 0) throw new Error('INVALID_REGEX: unbalanced parentheses');

  const last = tokens[tokens.length - 1];
  if (last && (last.type === 'UNION')) {
    throw new Error('INVALID_REGEX: trailing operator');
  }

  return tokens;
}

function insertConcat(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i]!;
    result.push(curr);
    if (i < tokens.length - 1) {
      const next = tokens[i + 1]!;
      const currIsVal = curr.type === 'CHAR' || curr.type === 'RPAREN' || curr.type === 'STAR';
      const nextIsVal = next.type === 'CHAR' || next.type === 'LPAREN';
      if (currIsVal && nextIsVal) {
        result.push({ type: 'CONCAT' });
      }
    }
  }
  return result;
}

const PRECEDENCE: Record<string, number> = {
  UNION: 1,
  CONCAT: 2,
  STAR: 3,
};

function shuntingYard(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'CHAR') {
      output.push(token);
    } else if (token.type === 'STAR' || token.type === 'CONCAT' || token.type === 'UNION') {
      while (opStack.length > 0) {
        const top = opStack[opStack.length - 1]!;
        if (top.type === 'LPAREN') break;
        const topPrec = PRECEDENCE[top.type] ?? 0;
        const currPrec = PRECEDENCE[token.type] ?? 0;
        if (topPrec >= currPrec) {
          output.push(opStack.pop()!);
        } else {
          break;
        }
      }
      opStack.push(token);
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1]!.type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      opStack.pop();
    }
  }

  while (opStack.length > 0) {
    output.push(opStack.pop()!);
  }

  return output;
}

interface NfaState {
  id: string;
  transitions: { symbol: string; to: string }[];
}

interface NfaFrag {
  start: string;
  accept: string;
  states: Map<string, NfaState>;
}

function newState(states: Map<string, NfaState>): string {
  const id = crypto.randomUUID();
  states.set(id, { id, transitions: [] });
  return id;
}

function addTransition(states: Map<string, NfaState>, from: string, symbol: string, to: string) {
  states.get(from)!.transitions.push({ symbol, to });
}

function mergeStates(...maps: Map<string, NfaState>[]): Map<string, NfaState> {
  const merged = new Map<string, NfaState>();
  for (const m of maps) m.forEach((v, k) => merged.set(k, v));
  return merged;
}

function buildNfa(rpn: Token[]): NfaFrag {
  const stack: NfaFrag[] = [];

  for (const token of rpn) {
    if (token.type === 'CHAR') {
      const states = new Map<string, NfaState>();
      const s = newState(states);
      const a = newState(states);
      addTransition(states, s, token.value!, a);
      stack.push({ start: s, accept: a, states });

    } else if (token.type === 'STAR') {
      const frag = stack.pop()!;
      const states = new Map(frag.states);
      const s = newState(states);
      const a = newState(states);
      addTransition(states, s, EPSILON, frag.start);
      addTransition(states, s, EPSILON, a);
      addTransition(states, frag.accept, EPSILON, frag.start);
      addTransition(states, frag.accept, EPSILON, a);
      stack.push({ start: s, accept: a, states });

    } else if (token.type === 'CONCAT') {
      const frag2 = stack.pop()!;
      const frag1 = stack.pop()!;
      const states = mergeStates(frag1.states, frag2.states);
      addTransition(states, frag1.accept, EPSILON, frag2.start);
      stack.push({ start: frag1.start, accept: frag2.accept, states });

    } else if (token.type === 'UNION') {
      const frag2 = stack.pop()!;
      const frag1 = stack.pop()!;
      const states = mergeStates(frag1.states, frag2.states);
      const s = newState(states);
      const a = newState(states);
      addTransition(states, s, EPSILON, frag1.start);
      addTransition(states, s, EPSILON, frag2.start);
      addTransition(states, frag1.accept, EPSILON, a);
      addTransition(states, frag2.accept, EPSILON, a);
      stack.push({ start: s, accept: a, states });
    }
  }

  if (stack.length !== 1) {
    throw new Error('INVALID_REGEX: malformed expression');
  }
  return stack[0]!;
}

function fragmentToAutomaton(frag: NfaFrag, name: string): Automaton {
  const order: string[] = [];
  const visited = new Set<string>();
  const queue = [frag.start];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    order.push(curr);
    const st = frag.states.get(curr)!;
    for (const { to } of st.transitions) {
      if (!visited.has(to)) queue.push(to);
    }
  }

  const idMap = new Map<string, string>();
  const labelMap = new Map<string, string>();
  order.forEach((oldId, idx) => {
    idMap.set(oldId, crypto.randomUUID());
    labelMap.set(oldId, `q${idx}`);
  });

  const alphabet = new Set<string>();
  const states: State[] = order.map(oldId => ({
    id: idMap.get(oldId)!,
    label: labelMap.get(oldId)!,
    isStart: oldId === frag.start,
    isAccept: oldId === frag.accept,
    position: { x: 0, y: 0 },
  }));

  const transitions: Transition[] = [];
  for (const oldId of order) {
    const st = frag.states.get(oldId)!;
    const byDest = new Map<string, string[]>();
    for (const { symbol, to } of st.transitions) {
      if (!idMap.has(to)) continue;
      if (symbol !== EPSILON) alphabet.add(symbol);
      const destId = idMap.get(to)!;
      if (!byDest.has(destId)) byDest.set(destId, []);
      byDest.get(destId)!.push(symbol);
    }
    for (const [destId, symbols] of byDest) {
      transitions.push({
        id: crypto.randomUUID(),
        from: idMap.get(oldId)!,
        to: destId,
        symbols: [...new Set(symbols)],
      });
    }
  }

  const automaton: Automaton = {
    id: crypto.randomUUID(),
    name,
    type: 'NFA',
    states,
    alphabet: Array.from(alphabet),
    transitions,
    minimizedDfaId: null,
  };

  return autoLayout(automaton);
}

function eliminateEpsilonTransitions(nfa: Automaton): Automaton {
  const alphabet = nfa.alphabet.filter(s => s !== 'ε');

  const newStates: State[] = nfa.states.map(state => {
    const closure = epsilonClosure(nfa, new Set([state.id]));
    const isAccept = Array.from(closure).some(
      id => nfa.states.find(s => s.id === id)?.isAccept ?? false,
    );
    return { ...state, isAccept };
  });

  const transMap = new Map<string, Set<string>>();

  for (const state of nfa.states) {
    const fromClosure = epsilonClosure(nfa, new Set([state.id]));
    for (const sym of alphabet) {
      const reached = new Set<string>();
      for (const csId of fromClosure) {
        for (const t of nfa.transitions) {
          if (t.from === csId && t.symbols.includes(sym)) {
            epsilonClosure(nfa, new Set([t.to])).forEach(id => reached.add(id));
          }
        }
      }
      for (const targetId of reached) {
        if (!nfa.states.find(s => s.id === targetId)) continue;
        const key = `${state.id}|${targetId}`;
        if (!transMap.has(key)) transMap.set(key, new Set());
        transMap.get(key)!.add(sym);
      }
    }
  }

  const rawTransitions: Transition[] = [];
  for (const [key, symbols] of transMap) {
    const sepIdx = key.indexOf('|');
    const from = key.slice(0, sepIdx);
    const to = key.slice(sepIdx + 1);
    rawTransitions.push({ id: crypto.randomUUID(), from, to, symbols: Array.from(symbols) });
  }

  const startSt = newStates.find(s => s.isStart);
  if (!startSt) return { ...nfa, states: newStates, alphabet, transitions: rawTransitions };

  const reachable = new Set<string>();
  const queue = [startSt.id];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (reachable.has(curr)) continue;
    reachable.add(curr);
    rawTransitions.filter(t => t.from === curr).forEach(t => queue.push(t.to));
  }

  const reachableStates = newStates.filter(s => reachable.has(s.id));
  let counter = 1;
  const relabeled = reachableStates.map(s => ({
    ...s,
    label: s.isStart ? 'q0' : `q${counter++}`,
  }));

  const finalTransitions = rawTransitions.filter(
    t => reachable.has(t.from) && reachable.has(t.to),
  );

  return autoLayout({
    ...nfa,
    states: relabeled,
    alphabet,
    transitions: finalTransitions,
    minimizedDfaId: null,
  });
}

export function thompson(regex: string, name = 'Regex NFA'): Automaton {
  if (!regex.trim()) throw new Error('INVALID_REGEX: empty regex');

  const tokens = lex(regex);
  const withConc = insertConcat(tokens);
  const rpn = shuntingYard(withConc);
  const frag = buildNfa(rpn);
  const raw = fragmentToAutomaton(frag, name);
  return eliminateEpsilonTransitions(raw);
}
