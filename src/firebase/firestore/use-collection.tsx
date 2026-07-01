'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/** Extracts a human-readable path string for error messages only — not used as a React dep. */
function getQueryPath(q: Query<DocumentData> | CollectionReference<DocumentData>): string {
  try {
    if (q.type === 'collection') return (q as CollectionReference).path;
    return (q as unknown as InternalQuery)._query.path.canonicalString();
  } catch {
    return 'unknown';
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 *
 * IMPORTANT: Always pass a memoized query (via useMemoFirebase / useMemo).
 * The hook uses the query object reference as its subscription key — a new
 * object reference triggers a fresh onSnapshot subscription. This correctly
 * handles queries with filter conditions (unlike a path-only string key).
 *
 * @template T Optional type for document data. Defaults to any.
 * @param targetRefOrQuery The Firestore CollectionReference or Query. Waits if null/undefined.
 */
export function useCollection<T = any>(
    targetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!targetRefOrQuery) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    // Compute path once for use in error reporting inside this closure.
    const path = getQueryPath(targetRefOrQuery);

    const unsubscribe = onSnapshot(
      targetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id,
        }));

        setData(prevData => {
          if (JSON.stringify(prevData) === JSON.stringify(results)) {
            return prevData;
          }
          return results;
        });

        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
    // Use the query object reference as the dependency.
    // useMemoFirebase (wraps useMemo) returns the same reference when its own
    // deps haven't changed, so this is stable and avoids spurious re-subscriptions.
    // Crucially, when query filters change a new object is returned, which correctly
    // triggers re-subscription — something a path-only string key cannot do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRefOrQuery]);

  return { data, isLoading, error };
}
