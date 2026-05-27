import {
  Firestore, writeBatch, doc, collection, getDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';

export type RelationshipType =
  | 'club_athlete' | 'club_coach' | 'club_scout' | 'club_analyst'
  | 'scout_athlete' | 'coach_athlete' | 'athlete_athlete';

export interface RelationshipUserInfo {
  uid: string;
  name: string;
  role: string;
  avatar?: string;
}

/**
 * Returns a deterministic relationship ID for any two users.
 */
export function relationshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('__');
}

/**
 * Returns a deterministic DM conversation ID for any two users.
 */
export function dmConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_dm_');
}

/**
 * Writes a relationship document and pre-creates the DM conversation in a batch.
 * Safe to call multiple times — uses set with merge so it won't overwrite if already exists.
 */
export async function writeRelationshipAndDM(
  firestore: Firestore,
  userA: RelationshipUserInfo,
  userB: RelationshipUserInfo,
  type: RelationshipType,
  initiatedBy: string,
): Promise<string> {
  const relId = relationshipId(userA.uid, userB.uid);
  const convId = dmConversationId(userA.uid, userB.uid);
  const now = new Date().toISOString();

  const batch = writeBatch(firestore);

  batch.set(doc(firestore, 'relationships', relId), {
    id: relId,
    users: {
      [userA.uid]: { name: userA.name, role: userA.role, avatar: userA.avatar || '' },
      [userB.uid]: { name: userB.name, role: userB.role, avatar: userB.avatar || '' },
    },
    type,
    status: 'active',
    initiatedBy,
    createdAt: now,
    connectedAt: now,
  }, { merge: true });

  batch.set(doc(firestore, 'conversations', convId), {
    type: 'direct',
    participants: [userA.uid, userB.uid],
    participantInfo: {
      [userA.uid]: { name: userA.name, role: userA.role, photoUrl: userA.avatar || '' },
      [userB.uid]: { name: userB.name, role: userB.role, photoUrl: userB.avatar || '' },
    },
    lastMessage: null,
    lastMessageAt: now,
    updatedAt: now,
    createdAt: now,
  }, { merge: true });

  await batch.commit();
  return convId;
}

/**
 * Sends an in-app notification to a user.
 */
export async function sendInAppNotification(
  firestore: Firestore,
  toUid: string,
  notification: {
    type: string;
    actorName: string;
    actorRole?: string;
    message: string;
    url?: string;
    actionRequired?: boolean;
    conversationId?: string;
  },
): Promise<void> {
  await addDoc(collection(firestore, 'notifications', toUid, 'items'), {
    ...notification,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}
