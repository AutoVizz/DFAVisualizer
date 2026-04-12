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
} from 'firebase/firestore';
import { db } from './firebase';
import type { Automaton, FirestoreProject, FirestoreMinimizedDfa } from '../types';
import { autoLayout } from '../engine/autoLayout';

function isStackedLayout(automaton: Automaton): boolean {
  if (automaton.states.length <= 1) return false;
  const uniquePositions = new Set(
    automaton.states.map(s => `${Math.round(s.position.x)},${Math.round(s.position.y)}`),
  );
  return uniquePositions.size <= 1;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function fetchUserProjects(userId: string): Promise<(FirestoreProject & { id: string })[]> {
  if (!db) return [];
  const q = query(collection(db, 'projects'), where('userId', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as FirestoreProject) }));
}

export async function fetchProject(projectId: string): Promise<(FirestoreProject & { id: string }) | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'projects', projectId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as FirestoreProject) };
}

export async function saveProject(projectId: string, automaton: Automaton, userId: string): Promise<void> {
  if (!db) return;
  const data: Omit<FirestoreProject, 'createdAt'> & { createdAt?: number; updatedAt: unknown } = {
    userId,
    name:           automaton.name,
    type:           automaton.type,
    automatonJson:  JSON.stringify(automaton),
    minimizedDfaId: automaton.minimizedDfaId,
    updatedAt:      serverTimestamp(),
  };
  const ref = doc(db, 'projects', projectId);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    await updateDoc(ref, data);
  } else {
    await setDoc(ref, { ...data, createdAt: serverTimestamp() });
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'projects', projectId));
}

export async function renameProject(projectId: string, name: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'projects', projectId), { name, updatedAt: serverTimestamp() });
}

// ── Minimized DFAs ────────────────────────────────────────────────────────────

export async function fetchMinimizedDfa(hash: string): Promise<Automaton | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'minimizedDfas', hash));
  if (!snap.exists()) return null;
  const data = snap.data() as FirestoreMinimizedDfa;
  const parsed = JSON.parse(data.automatonJson) as Automaton;
  // Backward compatibility for older cached minimized DFAs saved with stacked positions.
  return isStackedLayout(parsed) ? autoLayout(parsed) : parsed;
}

export async function upsertMinimizedDfa(hash: string, automaton: Automaton, canonicalString: string): Promise<void> {
  if (!db) return;
  const data: FirestoreMinimizedDfa = {
    automatonJson:  JSON.stringify(automaton),
    canonicalString,
  };
  await setDoc(doc(db, 'minimizedDfas', hash), data);
}

export async function updateProjectMinimizedId(projectId: string, hash: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'projects', projectId), {
    minimizedDfaId: hash,
    updatedAt: serverTimestamp(),
  });
}
