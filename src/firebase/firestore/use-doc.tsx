'use client';
    
import { useState, useEffect, useRef } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  docRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  // Track the latest unsubscribe so cleanup is always synchronous.
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Use the doc path as the dependency, which is a stable string.
  const docPath = docRef?.path;

  useEffect(() => {
    // Eagerly cancel any previous subscription before setting up a new one.
    // This prevents the double-listener race condition during rapid navigation.
    if (unsubscribeRef.current) {
      try { unsubscribeRef.current(); } catch { /* Firebase internal assertion — safe to swallow */ }
      unsubscribeRef.current = null;
    }

    if (!docPath || !docRef) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    // Guard so stale snapshot callbacks from a dying subscription never
    // update state after this effect has been superseded or unmounted.
    let isActive = true;
    setIsLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!isActive) return;
        const newData: StateDataType = snapshot.exists()
          ? { ...(snapshot.data() as T), id: snapshot.id }
          : null;

        setData(prevData => {
          if (JSON.stringify(prevData) === JSON.stringify(newData)) {
            return prevData;
          }
          return newData;
        });
        
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        if (!isActive) return;
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: docPath,
        })

        setError(contextualError)
        setData(null)
        setIsLoading(false)

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      isActive = false;
      try { unsubscribe(); } catch { /* Firebase internal assertion — safe to swallow on cleanup */ }
      unsubscribeRef.current = null;
    };
  }, [docPath]); // Re-run only if the document path string changes.

  return { data, isLoading, error };
}
