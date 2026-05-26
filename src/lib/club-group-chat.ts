import {
  doc, setDoc, updateDoc, arrayUnion, Firestore,
} from 'firebase/firestore';

export function clubGroupConvId(clubId: string) {
  return `club_${clubId}`;
}

interface MemberInfo {
  userId: string;
  displayName?: string;
  role?: string;
  photoUrl?: string;
}

/**
 * Ensure the club group conversation document exists.
 * Uses setDoc with merge:true so it is safe to call multiple times
 * without overwriting participants or messages already stored.
 * Does NOT call getDoc() — avoids the Firestore permission issue where
 * resource == null on a non-existent doc causes rule evaluation to fail.
 */
export async function ensureClubGroupChat(
  firestore: Firestore,
  clubId: string,
  clubName: string,
  _clubLogoUrl?: string,
) {
  const convId = clubGroupConvId(clubId);
  const convRef = doc(firestore, 'conversations', convId);

  // merge:true means we only write these fields; existing fields (participants,
  // messages, lastMessage, etc.) are NOT overwritten.
  await setDoc(convRef, {
    type: 'group',
    name: `${clubName} — Team Chat`,
    clubId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return convId;
}

/**
 * Add a member to the club group conversation.
 * Uses arrayUnion so it is idempotent (safe to call twice for the same user).
 * Expects ensureClubGroupChat to have been called first so the document exists.
 */
export async function addMemberToClubGroupChat(
  firestore: Firestore,
  clubId: string,
  member: MemberInfo,
) {
  const convId = clubGroupConvId(clubId);
  const convRef = doc(firestore, 'conversations', convId);

  // arrayUnion is safe on a non-existent field — it creates the array.
  // No getDoc() needed here.
  await updateDoc(convRef, {
    participants: arrayUnion(member.userId),
    [`participantInfo.${member.userId}`]: {
      name: member.displayName || 'Member',
      role: member.role || 'member',
      photoUrl: member.photoUrl || null,
    },
    [`participantRoles.${member.userId}`]: member.role || 'member',
    updatedAt: new Date().toISOString(),
  });
}
