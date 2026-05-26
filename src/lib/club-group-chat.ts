import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, Firestore,
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

export async function ensureClubGroupChat(
  firestore: Firestore,
  clubId: string,
  clubName: string,
  clubLogoUrl?: string,
) {
  const convId = clubGroupConvId(clubId);
  const convRef = doc(firestore, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) {
    await setDoc(convRef, {
      type: 'group',
      name: `${clubName} — Team Chat`,
      clubId,
      participants: [],
      participantInfo: {},
      participantRoles: {},
      lastMessage: null,
      lastMessageAt: null,
      lastSenderId: null,
      lastReadAt: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return convId;
}

export async function addMemberToClubGroupChat(
  firestore: Firestore,
  clubId: string,
  member: MemberInfo,
) {
  const convId = clubGroupConvId(clubId);
  const convRef = doc(firestore, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;

  const updates: Record<string, any> = {
    participants: arrayUnion(member.userId),
    [`participantInfo.${member.userId}`]: {
      name: member.displayName || 'Member',
      role: member.role || 'member',
      photoUrl: member.photoUrl || null,
    },
    [`participantRoles.${member.userId}`]: member.role || 'member',
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(convRef, updates);
}
