import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Automaton, FirestoreProject, FirestoreMinimizedDfa } from "../types";
import { autoLayout } from "../engine/autoLayout";

function toMillis(value: unknown): number {
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }

  if (value && typeof value === "object") {
    const v = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof v.toMillis === "function") return v.toMillis();
    if (typeof v.seconds === "number") {
      const nanos = typeof v.nanoseconds === "number" ? v.nanoseconds : 0;
      return v.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }

  return Date.now();
}

function normalizeProject(raw: FirestoreProject): FirestoreProject {
  const updatedAt = toMillis((raw as unknown as { updatedAt?: unknown }).updatedAt);
  const createdAt = toMillis((raw as unknown as { createdAt?: unknown }).createdAt ?? updatedAt);
  return {
    ...raw,
    createdAt,
    updatedAt,
  };
}

function isStackedLayout(automaton: Automaton): boolean {
  if (automaton.states.length <= 1) return false;
  const uniquePositions = new Set(
    automaton.states.map((s) => `${Math.round(s.position.x)},${Math.round(s.position.y)}`),
  );
  return uniquePositions.size <= 1;
}

export async function fetchUserProjects(
  ownerId: string,
): Promise<(FirestoreProject & { id: string })[]> {
  if (!db) return [];
  const q = query(collection(db, "projects"), where("ownerId", "==", ownerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as FirestoreProject;
    return { id: d.id, ...normalizeProject(raw) };
  });
}

export async function fetchProject(
  projectId: string,
): Promise<(FirestoreProject & { id: string }) | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "projects", projectId));
    if (!snap.exists()) return null;
    const raw = snap.data() as FirestoreProject;
    return { id: snap.id, ...normalizeProject(raw) };
  } catch {
    return null;
  }
}

export async function saveProject(
  projectId: string,
  automaton: Automaton,
  ownerId: string,
): Promise<void> {
  if (!db) return;
  const ref = doc(db, "projects", projectId);
  const data: Omit<FirestoreProject, "createdAt" | "updatedAt"> & {
    createdAt?: unknown;
    updatedAt: unknown;
  } = {
    ownerId,
    private: true,
    name: automaton.name,
    type: automaton.type,
    automatonJson: JSON.stringify(automaton),
    minimizedDfaId: automaton.minimizedDfaId,
    updatedAt: serverTimestamp(),
  };
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const { private: _omit, ...updateData } = data as typeof data & { private?: boolean };
      await updateDoc(ref, updateData);
      return;
    }
  } catch (err) {
    console.warn("saveProject: getDoc/updateDoc failed:", err);
    return;
  }

  try {
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  } catch (err) {
    console.warn("saveProject: setDoc failed:", err);
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!db) return;
  try {
    await deleteDoc(doc(db, "projects", projectId));
  } catch (err) {
    console.warn("deleteProject failed:", err);
  }
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, "projects", projectId), { name, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn("renameProject failed:", err);
  }
}

export async function toggleProjectPrivacy(projectId: string, isPrivate: boolean): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, "projects", projectId), {
      private: isPrivate,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("toggleProjectPrivacy failed:", err);
  }
}

export async function fetchMinimizedDfa(hash: string): Promise<Automaton | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "minimizedDfas", hash));
    if (!snap.exists()) return null;
    const data = snap.data() as FirestoreMinimizedDfa;
    const parsed = JSON.parse(data.automatonJson) as Automaton;
    return isStackedLayout(parsed) ? autoLayout(parsed) : parsed;
  } catch {
    return null;
  }
}

export async function upsertMinimizedDfa(
  hash: string,
  automaton: Automaton,
  canonicalString: string,
  ownerId: string,
): Promise<void> {
  if (!db) return;
  const data: FirestoreMinimizedDfa = {
    ownerId,
    private: false,
    automatonJson: JSON.stringify(automaton),
    canonicalString,
  };
  try {
    await setDoc(doc(db, "minimizedDfas", hash), data);
  } catch (err) {
    console.warn("upsertMinimizedDfa failed:", err);
  }
}

export async function updateProjectMinimizedId(projectId: string, hash: string): Promise<void> {
  if (!db) return;
  try {
    await updateDoc(doc(db, "projects", projectId), {
      minimizedDfaId: hash,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // permission failure — project missing or unowned, safe to ignore
  }
}

export async function fetchAiSummary(hash: string): Promise<string | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "minimizedDfas", hash));
    if (!snap.exists()) return null;
    const data = snap.data() as { aiSummary?: string };
    return data.aiSummary ?? null;
  } catch {
    return null;
  }
}

export async function writeAiSummary(
  hash: string,
  automaton: Automaton,
  canonicalString: string,
  ownerId: string,
  summary: string,
): Promise<void> {
  if (!db || !ownerId) return;
  try {
    await setDoc(
      doc(db, "minimizedDfas", hash),
      {
        ownerId,
        private: false,
        automatonJson: JSON.stringify(automaton),
        canonicalString,
        aiSummary: summary,
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("writeAiSummary failed:", err);
  }
}
