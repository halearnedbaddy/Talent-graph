'use client';

import { use, useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Zap, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Invitation {
  id: string;
  scoutName: string;
  playerName: string;
  teamName: string;
  position: string;
  message?: string;
  status: string;
  createdAt: string;
}

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const firestore = useFirestore();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<'accept' | 'decline' | null>(null);
  const [responded, setResponded] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (!firestore || !id) return;
    getDoc(doc(firestore, 'invitations', id))
      .then(snap => {
        if (snap.exists()) setInvitation({ id: snap.id, ...snap.data() } as Invitation);
      })
      .finally(() => setLoading(false));
  }, [firestore, id]);

  const handleRespond = async (action: 'accept' | 'decline') => {
    if (!firestore || !invitation) return;
    setResponding(action);
    try {
      await updateDoc(doc(firestore, 'invitations', id), {
        status: action === 'accept' ? 'accepted' : 'declined',
        updatedAt: new Date().toISOString(),
      });
      setResponded(action === 'accept' ? 'accepted' : 'declined');
    } catch (err) {
      console.error('Failed to respond:', err);
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center justify-center">
          <XCircle className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-xl font-black text-white">Invitation Not Found</h1>
        <p className="text-[#94A3B8] text-sm">This invitation link may have expired or is invalid.</p>
        <Link href="/" className="text-[#00C853] font-bold text-sm hover:underline">Go to Talent Graph →</Link>
      </div>
    );
  }

  if (responded) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${responded === 'accepted' ? 'bg-[#00C853]/10 border border-[#00C853]/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          {responded === 'accepted'
            ? <CheckCircle2 className="w-7 h-7 text-[#00C853]" />
            : <XCircle className="w-7 h-7 text-red-400" />}
        </div>
        <h1 className="text-xl font-black text-white">
          {responded === 'accepted' ? 'Invitation Accepted!' : 'Invitation Declined'}
        </h1>
        <p className="text-[#94A3B8] text-sm">
          {responded === 'accepted'
            ? `Welcome to ${invitation.teamName}! ${invitation.scoutName} will be in touch.`
            : `You have declined the invitation from ${invitation.scoutName}.`}
        </p>
        {responded === 'accepted' && (
          <Link href="/signup" className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#00C853] rounded-xl text-black font-black text-sm uppercase tracking-wide hover:bg-[#00C853]/90 transition-colors">
            <Zap className="w-4 h-4" />
            Join Talent Graph
          </Link>
        )}
      </div>
    );
  }

  const alreadyResponded = invitation.status === 'accepted' || invitation.status === 'declined';

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00C853] flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" />
          </div>
          <span className="text-sm font-black text-white uppercase tracking-widest">Talent Graph</span>
        </div>

        {/* Card */}
        <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden">
          <div className="bg-[#00C853]/10 border-b border-[#00C853]/20 px-6 py-5 text-center">
            <p className="text-[10px] font-black text-[#00C853] uppercase tracking-widest mb-1">You&apos;re Invited</p>
            <h1 className="text-2xl font-black text-white">{invitation.playerName}</h1>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
                <span className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Team</span>
                <span className="text-sm font-black text-white">{invitation.teamName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[#1E293B] pb-3">
                <span className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">Position</span>
                <span className="text-sm font-black text-white">{invitation.position}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-[#94A3B8] uppercase tracking-wider">From</span>
                <span className="text-sm font-black text-white">{invitation.scoutName}</span>
              </div>
            </div>

            {invitation.message && (
              <div className="bg-[#0A0E1A] border border-[#1E293B] rounded-xl p-3">
                <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wider mb-1.5">Message</p>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{invitation.message}</p>
              </div>
            )}

            {alreadyResponded ? (
              <div className={`p-3 rounded-xl border text-center ${invitation.status === 'accepted' ? 'bg-[#00C853]/10 border-[#00C853]/30' : 'bg-red-500/10 border-red-500/30'}`}>
                <p className={`text-sm font-black ${invitation.status === 'accepted' ? 'text-[#00C853]' : 'text-red-400'}`}>
                  You have already {invitation.status} this invitation.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => handleRespond('decline')}
                  disabled={!!responding}
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent font-black uppercase tracking-wide text-xs"
                >
                  {responding === 'decline' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><XCircle className="w-3.5 h-3.5 mr-1" /> Decline</>}
                </Button>
                <Button
                  onClick={() => handleRespond('accept')}
                  disabled={!!responding}
                  className="bg-[#00C853] hover:bg-[#00C853]/90 text-black font-black uppercase tracking-wide text-xs"
                >
                  {responding === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept</>}
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[10px] text-[#94A3B8] font-bold uppercase tracking-wider">
          Powered by{' '}
          <Link href="/" className="text-[#00C853] hover:underline">Talent Graph Kenya</Link>
        </p>
      </div>
    </div>
  );
}
