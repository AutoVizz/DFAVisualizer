// ── Core Domain Types ───────────────────────────────────────────────────────

export interface State {
  id: string;
  label: string;       // e.g. "q0"
  isStart: boolean;
  isAccept: boolean;
  position: { x: number; y: number };
}

export interface Transition {
  id: string;
  from: string;        // state id
  to: string;          // state id
  symbols: string[];   // e.g. ["a", "b"] or ["ε"]
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

// ── Simulation ──────────────────────────────────────────────────────────────

export interface SimulationResult {
  accepted: boolean;
  /** stateHistory[i] = set of active state IDs after processing symbol i.
   *  stateHistory[0] = initial states (before any input). */
  stateHistory: string[][];
  /** Input symbols consumed by the simulation. */
  inputSymbols: string[];
}

// ── Worker Messages ─────────────────────────────────────────────────────────

export type WorkerInMessage =
  | { type: 'NFA_TO_DFA'; payload: Automaton }
  | { type: 'MINIMIZE';   payload: Automaton }
  | { type: 'THOMPSON';   payload: { regex: string } };

export type WorkerErrorCode =
  | 'MAX_STATE_LIMIT_EXCEEDED'
  | 'INVALID_REGEX'
  | 'UNKNOWN';

export type WorkerOutMessage =
  | { type: 'RESULT'; payload: Automaton }
  | { type: 'ERROR';  code: WorkerErrorCode; message?: string };

// ── Equivalence ─────────────────────────────────────────────────────────────

export interface EquivalenceResult {
  equivalent: boolean;
  hash1: string;
  hash2: string;
}

// ── Firestore Documents ─────────────────────────────────────────────────────


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
}
