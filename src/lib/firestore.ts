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
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Automaton } from '../types';

export type CollectionType = 'DFA' | 'NFA' | 'MinDFA' | 'Regex';

export interface FirestoreDocument {
  name: string;
  ownerId: string;
  private: boolean;
  json: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function saveDocument(
  targetCollection: CollectionType,
  ownerId: string,
  automaton: Automaton
): Promise<string> {
  if (!db) return automaton.id;
  const docId = automaton.id;
  const docRef = doc(db, targetCollection, docId);

  const docData: FirestoreDocument = {
    name: automaton.name,
    ownerId,
    private: (automaton as any).isPrivate ?? true,
    json: JSON.stringify(automaton),
  };

  try {
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      await updateDoc(docRef, {
        name: docData.name,
        private: docData.private,
        json: docData.json,
        updatedAt: Timestamp.now(),
      });
      return docId;
    }
  } catch {
  }
  await setDoc(docRef, {
    ...docData,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docId;
}

export async function loadDocument(
  targetCollection: CollectionType,
  docId: string
): Promise<Automaton | null> {
  if (!db) return null;
  try {
    const docRef = doc(db, targetCollection, docId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return null;

    const data = snap.data() as FirestoreDocument;
    const automaton = JSON.parse(data.json) as Automaton;

    (automaton as any).sourceCollection = targetCollection;
    (automaton as any).isPrivate = data.private;
    (automaton as any).ownerId = data.ownerId;

    return automaton;
  } catch {
    return null;
  }
}

export async function loadAnyDocument(docId: string): Promise<Automaton | null> {
  const collections: CollectionType[] = ['DFA', 'NFA', 'MinDFA', 'Regex'];
  for (const coll of collections) {
    try {
      if (!db) continue;
      const docRef = doc(db, coll, docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as FirestoreDocument;
        const automaton = JSON.parse(data.json) as Automaton;
        (automaton as any).sourceCollection = coll;
        (automaton as any).isPrivate = data.private;
        (automaton as any).ownerId = data.ownerId;
        return automaton;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function listAllDocuments(
  ownerId: string
): Promise<Array<{ id: string; data: FirestoreDocument; collection: CollectionType }>> {
  if (!db) return [];
  const collections: CollectionType[] = ['DFA', 'NFA', 'MinDFA', 'Regex'];
  const allResults: Array<{ id: string; data: FirestoreDocument; collection: CollectionType }> = [];

  for (const coll of collections) {
    try {
      const ownQ = query(collection(db, coll), where('ownerId', '==', ownerId));
      const ownSnap = await getDocs(ownQ);

      ownSnap.docs.forEach((d) => {
        allResults.push({
          id: d.id,
          collection: coll,
          data: d.data() as FirestoreDocument,
        });
      });

      const pubQ = query(
        collection(db, coll),
        where('private', '==', false)
      );
      const pubSnap = await getDocs(pubQ);

      pubSnap.docs.forEach((d) => {
        if (d.data().ownerId !== ownerId) {
          allResults.push({
            id: d.id,
            collection: coll,
            data: d.data() as FirestoreDocument,
          });
        }
      });
    } catch {
      continue;
    }
  }

  return allResults;
}

export async function deleteDocument(
  targetCollection: CollectionType,
  docId: string
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, targetCollection, docId));
}

export async function renameDocument(
  targetCollection: CollectionType,
  docId: string,
  newName: string
): Promise<void> {
  if (!db) return;
  const docRef = doc(db, targetCollection, docId);
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const data = snap.data() as FirestoreDocument;
    const automaton = JSON.parse(data.json) as Automaton;
    automaton.name = newName;

    await updateDoc(docRef, {
      name: newName,
      json: JSON.stringify(automaton),
      updatedAt: Timestamp.now(),
    });
  } catch {
  }
}

export function cloneAutomaton(automaton: Automaton): Automaton {
  const cloned = structuredClone(automaton);

  const idMap = new Map<string, string>();
  cloned.id = crypto.randomUUID();
  cloned.name = `Copy of ${automaton.name}`;
  (cloned as any).isPrivate = true;

  for (const state of cloned.states) {
    const newId = crypto.randomUUID();
    idMap.set(state.id, newId);
    state.id = newId;
  }

  for (const transition of cloned.transitions) {
    transition.id = crypto.randomUUID();
    transition.from = idMap.get(transition.from) ?? transition.from;
    transition.to = idMap.get(transition.to) ?? transition.to;
  }

  return cloned;
}
