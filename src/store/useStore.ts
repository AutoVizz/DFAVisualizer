import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';
import type {
  Automaton,
  SimulationResult,
  WorkerOutMessage,
} from '../types';
import { simulate } from '../engine/simulate';
import AutomatonWorker from '../workers/automaton.worker?worker';

// ── Worker singleton ──────────────────────────────────────────────────────────
let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new AutomatonWorker();
  }
  return worker;
}

// ── Store shape ───────────────────────────────────────────────────────────────
interface StoreState {
  // Projects
  activeProject:    Automaton | null;
  viewOnlyProject:  Automaton | null;

  // Simulation
  simulationResult: SimulationResult | null;
  simulationStep:   number;
  isSimulating:     boolean;

  // Worker
  workerStatus: 'idle' | 'running' | 'error';
  workerError:  string | null;

  // Auth
  user: FirebaseUser | null;
}

interface StoreActions {
  // Project mutations
  setActiveProject:    (project: Automaton | null) => void;
  updateStates:        (states: Automaton['states']) => void;
  updateTransitions:   (transitions: Automaton['transitions']) => void;
  updateAlphabet:      (alphabet: string[]) => void;
  setViewOnlyProject:  (project: Automaton | null) => void;
  patchActiveProject:  (patch: Partial<Automaton>) => void;
  updateActiveProject: (updater: (project: Automaton) => Automaton) => void;

  // Simulation
  runSimulation:       (input: string) => void;
  runSimulationFull:   (input: string) => void;
  stepForward:         () => void;
  stepBackward:        () => void;
  resetSimulation:     () => void;

  // Worker
  dispatchToWorker: (
    msg: import('../types').WorkerInMessage,
    onResult: (result: Automaton) => void,
    onError:  (code: string, msg?: string) => void,
  ) => void;

  // Auth
  setUser: (user: FirebaseUser | null) => void;
}

type Store = StoreState & StoreActions;

// ── Store implementation ──────────────────────────────────────────────────────
export const useStore = create<Store>((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  activeProject:    null,
  viewOnlyProject:  null,
  simulationResult: null,
  simulationStep:   0,
  isSimulating:     false,
  workerStatus:     'idle',
  workerError:      null,
  user:             null,

  // ── Project actions ────────────────────────────────────────────────────────
  setActiveProject: (project) =>
    set({ activeProject: project, simulationResult: null, simulationStep: 0, isSimulating: false }),

  updateStates: (states) =>
    set(s => s.activeProject
      ? { activeProject: { ...s.activeProject, states, minimizedDfaId: null } }
      : {}),

  updateTransitions: (transitions) =>
    set(s => s.activeProject
      ? { activeProject: { ...s.activeProject, transitions, minimizedDfaId: null } }
      : {}),

  updateAlphabet: (alphabet) =>
    set(s => s.activeProject
      ? { activeProject: { ...s.activeProject, alphabet, minimizedDfaId: null } }
      : {}),

  setViewOnlyProject: (project) =>
    set({ viewOnlyProject: project }),

  patchActiveProject: (patch) =>
    set(s => s.activeProject
      ? { activeProject: { ...s.activeProject, ...patch } }
      : {}),

  updateActiveProject: (updater) =>
    set(s => s.activeProject
      ? { activeProject: updater(s.activeProject) }
      : {}),

  // ── Simulation actions ─────────────────────────────────────────────────────
  runSimulation: (input) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const result = simulate(activeProject, input);
    set({
      simulationResult: result,
      simulationStep:   0,
      isSimulating:     true,
    });
  },

  runSimulationFull: (input) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const result = simulate(activeProject, input);
    set({
      simulationResult: result,
      simulationStep:   Math.max(result.stateHistory.length - 1, 0),
      isSimulating:     true,
    });
  },

  stepForward: () =>
    set(s => {
      if (!s.simulationResult) return {};
      const max = s.simulationResult.stateHistory.length - 1;
      return { simulationStep: Math.min(s.simulationStep + 1, max) };
    }),

  stepBackward: () =>
    set(s => ({ simulationStep: Math.max(s.simulationStep - 1, 0) })),

  resetSimulation: () =>
    set({ simulationResult: null, simulationStep: 0, isSimulating: false }),

  // ── Worker dispatch ────────────────────────────────────────────────────────
  dispatchToWorker: (msg, onResult, onError) => {
    set({ workerStatus: 'running', workerError: null });

    const w = getWorker();

    // Remove old listener
    w.onmessage = null;
    w.onerror  = null;

    w.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const data = e.data;
      if (data.type === 'RESULT') {
        set({ workerStatus: 'idle', workerError: null });
        onResult(data.payload);
      } else {
        const errMsg = data.message ?? data.code;
        set({ workerStatus: 'error', workerError: errMsg });
        onError(data.code, data.message);
      }
    };

    w.onerror = (e) => {
      const errMsg = e.message ?? 'Worker crashed';
      set({ workerStatus: 'error', workerError: errMsg });
      onError('UNKNOWN', errMsg);
    };

    w.postMessage(msg);
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  setUser: (user) => set({ user }),
}));
