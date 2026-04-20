import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";
import type { Automaton, SimulationResult, WorkerOutMessage } from "../types";
import { simulate } from "../engine/simulate";
import AutomatonWorker from "../workers/automaton.worker?worker";

let worker: Worker | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new AutomatonWorker();
  }
  return worker;
}

interface StoreState {
  activeProject: Automaton | null;
  viewOnlyProject: Automaton | null;

  simulationResult: SimulationResult | null;
  simulationStep: number;
  isSimulating: boolean;

  workerStatus: "idle" | "running" | "error";
  workerError: string | null;

  user: FirebaseUser | null;
}

interface StoreActions {
  setActiveProject: (project: Automaton | null) => void;
  updateStates: (states: Automaton["states"]) => void;
  updateTransitions: (transitions: Automaton["transitions"]) => void;
  updateAlphabet: (alphabet: string[]) => void;
  setViewOnlyProject: (project: Automaton | null) => void;
  patchActiveProject: (patch: Partial<Automaton>) => void;
  updateActiveProject: (updater: (project: Automaton) => Automaton) => void;

  runSimulation: (input: string) => void;
  runSimulationFull: (input: string) => void;
  stepForward: () => void;
  stepBackward: () => void;
  resetSimulation: () => void;

  dispatchToWorker: (
    msg: import("../types").WorkerInMessage,
    onResult: (result: Automaton) => void,
    onError: (code: string, msg?: string) => void,
  ) => void;

  setUser: (user: FirebaseUser | null) => void;
}

type Store = StoreState & StoreActions;

export const useStore = create<Store>((set, get) => ({
  activeProject: null,
  viewOnlyProject: null,
  simulationResult: null,
  simulationStep: 0,
  isSimulating: false,
  workerStatus: "idle",
  workerError: null,
  user: null,

  setActiveProject: (project) =>
    set({ activeProject: project, simulationResult: null, simulationStep: 0, isSimulating: false }),

  updateStates: (states) =>
    set((s) =>
      s.activeProject
        ? { activeProject: { ...s.activeProject, states, minimizedDfaId: null } }
        : {},
    ),

  updateTransitions: (transitions) =>
    set((s) =>
      s.activeProject
        ? { activeProject: { ...s.activeProject, transitions, minimizedDfaId: null } }
        : {},
    ),

  updateAlphabet: (alphabet) =>
    set((s) =>
      s.activeProject
        ? { activeProject: { ...s.activeProject, alphabet, minimizedDfaId: null } }
        : {},
    ),

  setViewOnlyProject: (project) => set({ viewOnlyProject: project }),

  patchActiveProject: (patch) =>
    set((s) => (s.activeProject ? { activeProject: { ...s.activeProject, ...patch } } : {})),

  updateActiveProject: (updater) =>
    set((s) => (s.activeProject ? { activeProject: updater(s.activeProject) } : {})),

  runSimulation: (input) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const result = simulate(activeProject, input);
    set({
      simulationResult: result,
      simulationStep: 0,
      isSimulating: true,
    });
  },

  runSimulationFull: (input) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const result = simulate(activeProject, input);
    set({
      simulationResult: result,
      simulationStep: Math.max(result.stateHistory.length - 1, 0),
      isSimulating: true,
    });
  },

  stepForward: () =>
    set((s) => {
      if (!s.simulationResult) return {};
      const max = s.simulationResult.stateHistory.length - 1;
      return { simulationStep: Math.min(s.simulationStep + 1, max) };
    }),

  stepBackward: () => set((s) => ({ simulationStep: Math.max(s.simulationStep - 1, 0) })),

  resetSimulation: () => set({ simulationResult: null, simulationStep: 0, isSimulating: false }),

  dispatchToWorker: (msg, onResult, onError) => {
    set({ workerStatus: "running", workerError: null });

    const w = getWorker();

    w.onmessage = null;
    w.onerror = null;

    w.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const data = e.data;
      if (data.type === "RESULT") {
        set({ workerStatus: "idle", workerError: null });
        onResult(data.payload);
      } else {
        const errMsg = data.message ?? data.code;
        set({ workerStatus: "error", workerError: errMsg });
        onError(data.code, data.message);
      }
    };

    w.onerror = (e) => {
      const errMsg = e.message ?? "Worker crashed";
      set({ workerStatus: "error", workerError: errMsg });
      onError("UNKNOWN", errMsg);
    };

    w.postMessage(msg);
  },

  setUser: (user) => set({ user }),
}));
