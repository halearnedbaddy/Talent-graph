'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy, deleteDoc } from 'firebase/firestore';
import type { AthleteProfile, UserAccount } from '@/lib/types';
import type { ScoutingReportOutput } from '@/ai/flows/scouting-report';
import {
  Loader2, ArrowLeft, Sparkles, ThumbsUp, TrendingUp, Trash2,
  ChevronDown, ChevronUp, CheckCircle2, ShieldAlert, Calendar, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface SavedScoutReport {
  id: string;
  scoutId: string;
  scoutName: string;
  savedAt: string;
  scoutNotes?: string;
  report: ScoutingReportOutput;
}

function getRecommendationStyle(rec: ScoutingReportOutput['recommendation']) {
  switch (rec) {
    case 'Highly Recommended': return { bg: 'bg-green-900/20', border: 'border-green-700', text: 'text-green-400', dot: 'bg-green-500' };
    case 'Recommended': return { bg: 'bg-blue-900/20', border: 'border-blue-700', text: 'text-blue-400', dot: 'bg-blue-500' };
    case 'Monitor': return { bg: 'bg-amber-900/20', border: 'border-amber-700', text: 'text-amber-400', dot: 'bg-amber-500' };
    case 'Not Recommended': return { bg: 'bg-red-900/20', border: 'border-red-700', text: 'text-red-400', dot: 'bg-red-500' };
  }
}

function ReportCard({
  saved,
  canDelete,
  onDelete,
}: {
  saved: SavedScoutReport;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const recStyle = getRecommendationStyle(saved.report.recommendation);

  return (
    <div className="rounded-2xl border border-[#1E293B] bg-[#111827] overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar className="w-9 h-9 rounded-xl shrink-0">
            <AvatarFallback className="rounded-xl bg-[#1C2333] text-[#94A3B8] text-xs font-black">
              {saved.scoutName?.slice(0, 2).toUpperCase() || 'SC'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-black text-white truncate">{saved.scoutName}</p>
              <Badge className="text-[9px] bg-purple-500/15 text-purple-400 border-none font-black uppercase tracking-wider">Scout</Badge>
            </div>
            <p className="text-[10px] text-[#64748B] mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(saved.savedAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-black', recStyle.bg, recStyle.border, recStyle.text)}>
            <div className={cn('w-1.5 h-1.5 rounded-full', recStyle.dot)} />
            {saved.report.recommendation}
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[#64748B] hover:text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[#64748B] hover:text-white"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="px-5 pb-2">
        <p className="text-xs text-[#94A3B8] leading-relaxed line-clamp-2">{saved.report.executiveSummary}</p>
      </div>

      {expanded && (
        <div className="border-t border-[#1E293B] px-5 py-4 space-y-4">
          {saved.scoutNotes && (
            <div className="p-3 bg-[#0F172A] rounded-xl border border-[#1E293B]">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1 flex items-center gap-1.5">
                <User className="w-3 h-3" />Scout Notes
              </p>
              <p className="text-xs text-[#94A3B8] italic">&ldquo;{saved.scoutNotes}&rdquo;</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0F172A] rounded-xl border border-[#1E293B] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1.5">Technical Profile</p>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{saved.report.technicalProfile}</p>
            </div>
            <div className="bg-[#0F172A] rounded-xl border border-[#1E293B] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1.5">Performance Analysis</p>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{saved.report.performanceAnalysis}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0F172A] rounded-xl border border-green-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="w-3 h-3 text-green-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Strengths</p>
              </div>
              <ul className="space-y-1">
                {saved.report.strengthsAndWeaknesses.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#94A3B8]">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-green-500 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0F172A] rounded-xl border border-amber-900/30 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">Development Areas</p>
              </div>
              <ul className="space-y-1">
                {saved.report.strengthsAndWeaknesses.areasForDevelopment.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[#94A3B8]">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0F172A] rounded-xl border border-[#1E293B] p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1.5">Recruitment Verdict</p>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{saved.report.recruitmentVerdict}</p>
            </div>
            <div className="bg-[#0F172A] rounded-xl border border-blue-900/30 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748B] mb-1.5">Projected Potential</p>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{saved.report.projectedPotential}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] text-[#475569]">
              Confidence: <span className="font-bold text-[#64748B]">{saved.report.confidenceLevel}</span>
            </p>
            <p className="text-[10px] text-[#475569]">AI analysis by Talent Graph × Gemini</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClubAthleteReportsPage() {
  const params = useParams();
  const athleteId = params.athleteId as string;
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount } = useDoc<UserAccount>(userDocRef);

  const athleteDocRef = useMemoFirebase(() => (firestore && athleteId ? doc(firestore, 'athletes', athleteId) : null), [firestore, athleteId]);
  const { data: athlete, isLoading: athleteLoading } = useDoc<AthleteProfile>(athleteDocRef);

  const reportsQuery = useMemoFirebase(() =>
    firestore && athleteId
      ? query(collection(firestore, 'athletes', athleteId, 'scout_reports'), orderBy('savedAt', 'desc'))
      : null,
    [firestore, athleteId]
  );
  const { data: savedReports, isLoading: reportsLoading } = useCollection<SavedScoutReport>(reportsQuery);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const allowedRoles = new Set(['club', 'coach', 'assistant_coach', 'analyst', 'gk_coach', 'scout', 'admin']);
  useEffect(() => {
    if (userAccount && !allowedRoles.has(userAccount.role ?? '')) router.push('/dashboard');
  }, [userAccount, router]);

  const handleDelete = async (reportId: string) => {
    if (!firestore) return;
    setDeleting(reportId);
    try {
      await deleteDoc(doc(firestore, 'athletes', athleteId, 'scout_reports', reportId));
      toast({ title: 'Report deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const isLoading = isUserLoading || athleteLoading || reportsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
      </div>
    );
  }

  const fullName = athlete ? `${athlete.firstName} ${athlete.lastName}` : 'Athlete';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-[#94A3B8] hover:text-white">
          <Link href="/club-dashboard/athletes">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1">
          {athlete?.photoUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#1E293B]">
              <Image src={athlete.photoUrl} alt={fullName} width={40} height={40} className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-sm font-black border border-[#1E293B]">
              {athlete?.firstName?.[0]}{athlete?.lastName?.[0]}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black uppercase tracking-tight text-white">{fullName}</h1>
              {athlete?.isVerified ? (
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-[#64748B]" />
              )}
            </div>
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">
              {athlete?.position} · {athlete?.clubName || 'Unattached'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#64748B]">
            {savedReports?.length ?? 0} AI Report{(savedReports?.length ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {!savedReports || savedReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#111827] border border-[#1E293B] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#475569]" />
          </div>
          <p className="text-sm font-bold text-[#64748B] uppercase tracking-widest">No AI reports saved yet</p>
          <p className="text-xs text-[#475569] text-center max-w-xs">
            Scouts can generate and save AI scouting analyses from the athlete&rsquo;s report page.
            They will appear here for your recruitment team to review.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedReports.map(saved => (
            <ReportCard
              key={saved.id}
              saved={saved}
              canDelete={user?.uid === saved.scoutId || userAccount?.role === 'admin' || userAccount?.role === 'club'}
              onDelete={() => deleting !== saved.id && handleDelete(saved.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
