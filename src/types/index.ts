export interface State {
  id: string;
  label: string;
  isStart: boolean;
  isAccept: boolean;
  position: { x: number; y: number };
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  symbols: string[];
}

export interface Automaton {
  id: string;
  name: string;
  type: 'DFA' | 'NFA';
  states: State[];
  alphabet: string[];
  transitions: Transition[];
  minimizedDfaId: string | null;
}

export interface SimulationResult {
  accepted: boolean;
  stateHistory: string[][];
  inputSymbols: string[];
}

export type WorkerInMessage =
  | { type: 'NFA_TO_DFA'; payload: Automaton }
  | { type: 'NFA_TO_MIN_DFA'; payload: Automaton }
  | { type: 'MINIMIZE';   payload: Automaton }
  | { type: 'THOMPSON';   payload: { regex: string } }
  | { type: 'THOMPSON_TO_MIN_DFA'; payload: { regex: string; extraAlphabet?: string[] } };

export type WorkerErrorCode =
  | 'MAX_STATE_LIMIT_EXCEEDED'
  | 'INVALID_REGEX'
  | 'UNKNOWN';

export type WorkerOutMessage =
  | { type: 'RESULT'; payload: Automaton }
  | { type: 'ERROR';  code: WorkerErrorCode; message?: string };

export interface EquivalenceResult {
  equivalent: boolean;
  hash1: string;
  hash2: string;
}

export interface FirestoreProject {
  ownerId: string;
  private: boolean;
  name: string;
  type: 'DFA' | 'NFA';
  automatonJson: string;
  minimizedDfaId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreMinimizedDfa {
  ownerId: string;
  private: boolean;
  automatonJson: string;
  canonicalString: string;
  aiSummary?: string;
}
