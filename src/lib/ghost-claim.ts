/**
 * Ghost-player auto-claim
 *
 * Called once, immediately after an athlete creates their profile.
 * Finds any unclaimed ghost_players records whose phone or email
 * matches the new user and transfers the stored match stats onto
 * the athlete document, then marks the ghost as claimed.
 *
 * All operations are client-side Firestore (no firebase-admin).
 */

import type { Firestore } from 'firebase/firestore';
import {
  collection, query, where, getDocs,
  doc, updateDoc, arrayUnion,
} from 'firebase/firestore';
import type { GhostMatchStat } from './types';

/** Normalise a Kenyan phone number to +254XXXXXXXXX */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+254')) return digits;
  if (digits.startsWith('254'))  return `+${digits}`;
  if (digits.startsWith('0'))    return `+254${digits.slice(1)}`;
  return digits;
}

export interface ClaimResult {
  claimed: number;
  stats: GhostMatchStat[];
}

/**
 * Searches ghost_players for unclaimed records matching `phone` or `email`,
 * merges their match stats onto the athlete doc, and marks them as claimed.
 *
 * Returns the total number of ghost docs claimed and a flat list of stats merged.
 */
export async function claimGhostStats(
  firestore: Firestore,
  athleteUid: string,
  phone: string | undefined | null,
  email: string | undefined | null,
): Promise<ClaimResult> {
  const ghostCol = collection(firestore, 'ghost_players');
  const now = new Date().toISOString();

  const seen = new Set<string>();
  const ghosts: { id: string; stats: GhostMatchStat[] }[] = [];

  // ── query by phone ───────────────────────────────────────────────────────
  if (phone?.trim()) {
    const normalised = normalisePhone(phone.trim());
    const snap = await getDocs(
      query(ghostCol, where('phone', '==', normalised), where('claimed', '==', false))
    );
    snap.forEach(d => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        ghosts.push({ id: d.id, stats: (d.data().matchStats ?? []) as GhostMatchStat[] });
      }
    });
  }

  // ── query by email ───────────────────────────────────────────────────────
  if (email?.trim()) {
    const snap = await getDocs(
      query(ghostCol, where('email', '==', email.trim().toLowerCase()), where('claimed', '==', false))
    );
    snap.forEach(d => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        ghosts.push({ id: d.id, stats: (d.data().matchStats ?? []) as GhostMatchStat[] });
      }
    });
  }

  if (ghosts.length === 0) return { claimed: 0, stats: [] };

  const allStats: GhostMatchStat[] = ghosts.flatMap(g => g.stats);
  const athleteRef = doc(firestore, 'athletes', athleteUid);

  await Promise.all([
    // Merge stats onto the athlete profile
    updateDoc(athleteRef, {
      ghostStats: arrayUnion(...allStats),
      updatedAt: now,
    }),
    // Mark every matched ghost as claimed
    ...ghosts.map(g =>
      updateDoc(doc(firestore, 'ghost_players', g.id), {
        claimed: true,
        claimedBy: athleteUid,
        claimedAt: now,
        updatedAt: now,
      })
    ),
  ]);

  return { claimed: ghosts.length, stats: allStats };
}
