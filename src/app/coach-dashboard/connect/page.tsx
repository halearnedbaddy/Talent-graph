'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { CoachClubInvitations } from '@/components/coach/club-invitations';
import { ClubInvitationsCard } from '@/components/scout/club-invitations-card';
import { Loader2, Link2, Building2, CheckCircle2 } from 'lucide-react';
import type { ClubMember, UserAccount } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

export default function CoachConnectPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const memberQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active'))
      : null
  ), [firestore, user]);
  const { data: memberships, isLoading: memberLoading } = useCollection<ClubMember>(memberQuery);
  const activeMembership = memberships?.[0];

  const pendingQuery = useMemoFirebase(() => (
    firestore && user
      ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'club_invited'))
      : null
  ), [firestore, user]);
  const { data: pendingInvites } = useCollection<ClubMember>(pendingQuery);

  const userDocRef = useMemoFirebase(() => (
    firestore && user?.uid ? doc(firestore, 'users', user.uid) : null
  ), [firestore, user?.uid]);
  const { data: userAccount } = useDoc<UserAccount>(userDocRef);
  const coachName = userAccount
    ? `${(userAccount as any).firstName || ''} ${(userAccount as any).lastName || ''}`.trim() || user?.displayName || 'Coach'
    : user?.displayName || 'Coach';
  const coachRole = (userAccount as any)?.role || 'coach';

  if (isUserLoading || memberLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  const pendingCount = pendingInvites?.length ?? 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#00C853]/15 flex items-center justify-center shrink-0">
          <Link2 className="h-5 w-5 text-[#00C853]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">Connect</h1>
            {pendingCount > 0 && (
              <Badge className="bg-[#00C853] text-black font-black text-[10px] h-5 px-1.5">
                {pendingCount}
              </Badge>
            )}
          </div>
          <p className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mt-0.5">
            Club invitations & affiliation
          </p>
        </div>
      </div>

      {/* Current club status */}
      {activeMembership ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#00C853]/30 bg-[#00C853]/5">
          <CheckCircle2 className="h-5 w-5 text-[#00C853] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-black text-white">
              Affiliated with <span className="text-[#00C853]">{activeMembership.clubName || 'your club'}</span>
            </p>
            <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide mt-0.5">
              Role: {activeMembership.role} · Status: Active
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#1E293B] bg-[#111827]">
          <Building2 className="h-5 w-5 text-[#94A3B8] shrink-0" />
          <div>
            <p className="text-sm font-black text-white">No club affiliation yet</p>
            <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide mt-0.5">
              Accept an invitation below or browse clubs to send a join request
            </p>
          </div>
        </div>
      )}

      {/* Club invitations from clubs */}
      {user && (
        <CoachClubInvitations
          coachUid={user.uid}
          coachName={coachName}
          coachRole={coachRole}
        />
      )}

      {/* Outbound join requests (scout-style invitations card) */}
      <ClubInvitationsCard />

      {/* Empty state when no invitations */}
      {pendingCount === 0 && (
        <div className="rounded-2xl border border-[#1E293B] bg-[#111827] p-8 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#1C2333] flex items-center justify-center">
            <Link2 className="h-7 w-7 text-[#4B5563]" />
          </div>
          <div>
            <p className="text-white font-black">No pending invitations</p>
            <p className="text-[#94A3B8] text-sm mt-1 max-w-xs">
              When a club sends you a staff invitation, it will appear here for you to accept or decline.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[#1E293B] bg-[#111827] p-5">
        <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-3">How connecting works</p>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Club sends invitation', desc: 'The club admin sends you a staff invitation from their dashboard.' },
            { step: '2', title: 'You accept here', desc: 'Accept the invitation — you officially become a member of the club.' },
            { step: '3', title: 'Full squad access', desc: 'All club squad data is transferred: athletes, match history, training sessions, and analytics.' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                {s.step}
              </div>
              <div>
                <p className="text-sm font-black text-white">{s.title}</p>
                <p className="text-[11px] text-[#94A3B8]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
