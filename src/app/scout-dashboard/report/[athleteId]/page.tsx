'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { AthleteProfile, UserAccount } from '@/lib/types';
import {
  Loader2, Printer, ArrowLeft, CheckCircle2, ShieldAlert, Star,
  Sparkles, AlertCircle, ThumbsUp, TrendingUp, ChevronDown, ChevronUp,
  Save, Trash2, Calendar, CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { ScoutingReportOutput } from '@/ai/flows/scouting-report';
import type { SavedScoutReport } from '@/app/club-dashboard/athletes/[athleteId]/reports/page';
import { useToast } from '@/hooks/use-toast';

function RadarChartSVG({ athlete }: { athlete: AthleteProfile }) {
  const metrics = [
    { label: 'Performance', value: athlete.performanceIndex ?? 50 },
    { label: 'Efficiency', value: athlete.efficiencyIndex ?? 50 },
    { label: 'Consistency', value: athlete.consistencyIndex ?? 50 },
    { label: 'Development', value: athlete.developmentIndex ?? 50 },
    { label: 'Context', value: athlete.contextIndex ?? 50 },
    { label: 'Safety', value: Math.max(0, 100 - (athlete.riskIndex ?? 50)) },
  ];
  const n = metrics.length;
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const OUTER_R = 78;
  const LABEL_R = OUTER_R + 24;
  const angle = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const dataPoints = metrics.map((m, i) => {
    const a = angle(i);
    const r = (Math.min(100, Math.max(0, m.value)) / 100) * OUTER_R;
    return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
  });
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {[25, 50, 75, 100].map(lvl => (
        <polygon
          key={lvl}
          points={Array.from({ length: n }, (_, i) => {
            const a = angle(i);
            const r = (lvl / 100) * OUTER_R;
            return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`;
          }).join(' ')}
          fill="none"
          stroke={lvl === 100 ? '#94a3b8' : '#e2e8f0'}
          strokeWidth={lvl === 100 ? 1.5 : 1}
        />
      ))}
      {metrics.map((_, i) => {
        const a = angle(i);
        return (
          <line key={i} x1={CX} y1={CY} x2={CX + OUTER_R * Math.cos(a)} y2={CY + OUTER_R * Math.sin(a)} stroke="#e2e8f0" strokeWidth={1} />
        );
      })}
      <polygon points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(59,130,246,0.15)" stroke="rgb(59,130,246)" strokeWidth={2.5} />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="rgb(59,130,246)" />)}
      {metrics.map((m, i) => {
        const a = angle(i);
        const x = CX + LABEL_R * Math.cos(a);
        const y = CY + LABEL_R * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) < 0 ? 'end' : 'start';
        return (
          <g key={i}>
            <text x={x} y={y - 5} textAnchor={anchor} fontSize={8} fontFamily="system-ui,sans-serif" fill="#64748b" fontWeight="700">{m.label}</text>
            <text x={x} y={y + 6} textAnchor={anchor} fontSize={9} fontFamily="system-ui,sans-serif" fill="#1e293b" fontWeight="900">{Math.round(m.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function getCSIBand(score: number) {
  if (score >= 75) return { label: 'Elite', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' };
  if (score >= 50) return { label: 'Good', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { label: 'Developing', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' };
}

function getRiskBand(risk?: number) {
  if (!risk && risk !== 0) return { label: 'Unknown', color: 'text-muted-foreground' };
  if (risk <= 33) return { label: 'Low Risk', color: 'text-green-600' };
  if (risk <= 66) return { label: 'Medium Risk', color: 'text-amber-600' };
  return { label: 'High Risk', color: 'text-red-600' };
}

function getConsistencyBand(ci?: number) {
  if (!ci && ci !== 0) return 'Unknown';
  if (ci >= 75) return 'Excellent';
  if (ci >= 50) return 'Good';
  if (ci >= 25) return 'Average';
  return 'Poor';
}

function IndexBar({ value, label }: { value?: number; label: string }) {
  const v = value ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="font-bold text-slate-800">{value !== undefined ? Math.round(v) : '–'}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function getRecommendationStyle(rec: ScoutingReportOutput['recommendation']) {
  switch (rec) {
    case 'Highly Recommended': return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', dot: 'bg-green-500' };
    case 'Recommended': return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', dot: 'bg-blue-500' };
    case 'Monitor': return { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', dot: 'bg-amber-500' };
    case 'Not Recommended': return { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', dot: 'bg-red-500' };
  }
}

function AIAnalysisSection({
  athlete,
  idToken,
  scoutId,
  scoutName,
  firestore,
}: {
  athlete: AthleteProfile;
  idToken: string;
  scoutId: string;
  scoutName: string;
  firestore: ReturnType<typeof useFirestore>;
}) {
  const { toast } = useToast();
  const [report, setReport] = useState<ScoutingReportOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoutNotes, setScoutNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const reportsQuery = useMemoFirebase(
    () => firestore && athlete.uid
      ? query(collection(firestore, 'athletes', athlete.uid, 'scout_reports'), orderBy('savedAt', 'desc'))
      : null,
    [firestore, athlete.uid]
  );
  const { data: savedReports } = useCollection<SavedScoutReport>(reportsQuery);

  const handleSave = async () => {
    if (!report || !firestore) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(firestore, 'athletes', athlete.uid, 'scout_reports'), {
        scoutId,
        scoutName,
        savedAt: new Date().toISOString(),
        scoutNotes: scoutNotes.trim() || null,
        report,
      });
      setSavedId(ref.id);
      toast({ title: 'Report saved', description: 'Visible to the club recruitment team.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!firestore) return;
    setDeleting(reportId);
    try {
      await deleteDoc(doc(firestore, 'athletes', athlete.uid, 'scout_reports', reportId));
      if (reportId === savedId) setSavedId(null);
      toast({ title: 'Report deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/scouting-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          athlete: {
            firstName: athlete.firstName,
            lastName: athlete.lastName,
            position: athlete.position,
            altPositions: athlete.altPositions,
            age: athlete.age,
            nationality: athlete.nationality,
            country: athlete.country,
            heightCm: athlete.heightCm,
            weightKg: athlete.weightKg,
            dominantFoot: athlete.dominantFoot,
            clubName: athlete.clubName,
            bio: athlete.bio,
            compositeScoutingIndex: athlete.compositeScoutingIndex,
            performanceIndex: athlete.performanceIndex,
            efficiencyIndex: athlete.efficiencyIndex,
            consistencyIndex: athlete.consistencyIndex,
            developmentIndex: athlete.developmentIndex,
            contextIndex: athlete.contextIndex,
            riskIndex: athlete.riskIndex,
            talentGraphScore: athlete.talentGraphScore,
            readinessTier: athlete.readinessTier,
            yellowCards: athlete.yellowCards,
            redCards: athlete.redCards,
            minutesPlayed: athlete.minutesPlayed,
            matchHistory: athlete.matchHistory,
            isVerified: athlete.isVerified,
            activelyLooking: athlete.activelyLooking,
            scoutNotes: scoutNotes.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report');
      setReport(data.report);
      setGenerated(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [athlete, idToken, scoutNotes]);

  const recStyle = report ? getRecommendationStyle(report.recommendation) : null;

  return (
    <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">AI Scout Analysis</h2>
          <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 text-[10px]">Powered by Gemini</Badge>
        </div>
        {generated && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 no-print"
            onClick={() => { setReport(null); setGenerated(false); setScoutNotes(''); }}
          >
            Regenerate
          </Button>
        )}
      </div>

      {!generated && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Generate a professional AI-powered scouting analysis for{' '}
            <span className="font-semibold">{athlete.firstName} {athlete.lastName}</span>.
            The analysis synthesises their performance indexes, match history, physical profile, and discipline record
            into an expert narrative report.
          </p>

          <div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors mb-2"
              onClick={() => setShowNotes(v => !v)}
            >
              {showNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Add personal scout notes (optional)
            </button>
            {showNotes && (
              <textarea
                className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white placeholder:text-slate-400"
                rows={3}
                placeholder="E.g. Watched live vs. Gor Mahia. Strong in the air, needs work on left foot. Good attitude on the bench."
                value={scoutNotes}
                onChange={e => setScoutNotes(e.target.value)}
              />
            )}
          </div>

          <Button
            onClick={generate}
            disabled={loading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="w-4 h-4" />
            Generate AI Scouting Analysis
          </Button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Analysing athlete data with Gemini AI…</p>
          <p className="text-xs text-slate-400">This takes 10–20 seconds</p>
        </div>
      )}

      {error && !loading && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Analysis failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
            <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={generate}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {report && !loading && (
        <div className="space-y-5 mt-2">
          {recStyle && (
            <div className={cn('flex items-center justify-between p-4 rounded-xl border-2', recStyle.bg, recStyle.border)}>
              <div className="flex items-center gap-3">
                <div className={cn('w-3 h-3 rounded-full', recStyle.dot)} />
                <div>
                  <p className={cn('text-xs uppercase font-black tracking-widest', recStyle.text)}>Scout Recommendation</p>
                  <p className={cn('text-xl font-black mt-0.5', recStyle.text)}>{report.recommendation}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Confidence</p>
                <p className={cn('font-bold text-sm', recStyle.text)}>{report.confidenceLevel}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Executive Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed">{report.executiveSummary}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Technical Profile</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.technicalProfile}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Performance Analysis</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.performanceAnalysis}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-green-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Strengths</p>
              </div>
              <ul className="space-y-1.5">
                {report.strengthsAndWeaknesses.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-amber-100 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Areas for Development</p>
              </div>
              <ul className="space-y-1.5">
                {report.strengthsAndWeaknesses.areasForDevelopment.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recruitment Verdict</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.recruitmentVerdict}</p>
            </div>
            <div className="bg-white rounded-xl border border-blue-100 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projected Potential</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.projectedPotential}</p>
            </div>
          </div>

          <div className="no-print flex items-center justify-between pt-1">
            <p className="text-[10px] text-slate-400">
              AI analysis by Talent Graph × Gemini 2.5 Flash · Not a substitute for live scouting
            </p>
            {savedId ? (
              <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                <CheckCheck className="w-4 h-4" />
                Saved to profile
              </div>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save to athlete profile
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── PREVIOUSLY SAVED REPORTS ── */}
      {savedReports && savedReports.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Previously Saved Reports ({savedReports.length})
          </p>
          <div className="space-y-2">
            {savedReports.map(saved => (
              <div key={saved.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-700 truncate">{saved.scoutName}</span>
                    <span className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded border',
                      getRecommendationStyle(saved.report.recommendation).text,
                      getRecommendationStyle(saved.report.recommendation).bg,
                      getRecommendationStyle(saved.report.recommendation).border,
                    )}>
                      {saved.report.recommendation}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(saved.savedAt).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}Confidence: {saved.report.confidenceLevel}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{saved.report.executiveSummary}</p>
                </div>
                {saved.scoutId === scoutId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500 flex-shrink-0"
                    onClick={() => deleting !== saved.id && handleDelete(saved.id)}
                    disabled={deleting === saved.id}
                  >
                    {deleting === saved.id
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScoutingReportPage() {
  const params = useParams();
  const athleteId = params.athleteId as string;
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [generatedAt] = useState(() => new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }));
  const [idToken, setIdToken] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(() => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user?.uid]);
  const { data: userAccount } = useDoc<UserAccount>(userDocRef);

  const athleteDocRef = useMemoFirebase(() => (firestore && athleteId ? doc(firestore, 'athletes', athleteId) : null), [firestore, athleteId]);
  const { data: athlete, isLoading: athleteLoading } = useDoc<AthleteProfile>(athleteDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (userAccount && userAccount.role !== 'scout') router.push('/dashboard');
  }, [userAccount, router]);

  useEffect(() => {
    if (user) {
      user.getIdToken().then(setIdToken).catch(() => {});
    }
  }, [user]);

  if (isUserLoading || athleteLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Athlete not found.</p>
        <Button asChild variant="outline"><Link href="/scout-dashboard">Back to Dashboard</Link></Button>
      </div>
    );
  }

  const fullName = `${athlete.firstName} ${athlete.lastName}`;
  const csi = athlete.compositeScoutingIndex;
  const csiBand = csi !== undefined ? getCSIBand(csi) : null;
  const riskBand = getRiskBand(athlete.riskIndex);
  const consistencyLabel = getConsistencyBand(athlete.consistencyIndex);
  const recentMatches = (athlete.matchHistory || []).slice(-10).reverse();
  const totalGoals = recentMatches.reduce((s, m) => s + (m.goals || 0), 0);
  const totalAssists = recentMatches.reduce((s, m) => s + (m.assists || 0), 0);
  const totalApps = recentMatches.reduce((s, m) => s + (m.apps || 0), 0);
  const totalMins = recentMatches.reduce((s, m) => s + (m.minutes || 0), 0);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-root { padding: 0 !important; max-width: 100% !important; }
          .page-break { page-break-before: always; }
        }
        @page { size: A4; margin: 1.5cm; }
      `}</style>

      <div className="min-h-screen bg-slate-50 report-root">
        <div className="no-print sticky top-0 z-20 bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-2" asChild>
              <Link href="/scout-dashboard">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Scouting Report — {fullName}</span>
              <Button size="sm" className="gap-2 h-8" onClick={() => window.print()}>
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8 space-y-0">
          <div className="bg-white rounded-t-2xl shadow-sm overflow-hidden border border-slate-200">

            {/* ── HEADER BAND ── */}
            <div className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-black text-sm">TG</div>
                <div>
                  <p className="font-black text-sm tracking-widest uppercase">Talent Graph Kenya</p>
                  <p className="text-slate-400 text-xs">Professional Scouting Report</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Generated</p>
                <p className="text-white text-sm font-semibold">{generatedAt}</p>
              </div>
            </div>

            {/* ── ATHLETE IDENTITY ── */}
            <div className="px-8 py-6 flex gap-6 border-b border-slate-100">
              <div className="flex-shrink-0">
                {athlete.photoUrl ? (
                  <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-200">
                    <Image src={athlete.photoUrl} alt={fullName} width={96} height={96} className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-black border-2 border-slate-200">
                    {athlete.firstName?.[0]}{athlete.lastName?.[0]}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 leading-tight">{fullName}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {athlete.position && <Badge variant="outline" className="text-xs font-bold">{athlete.position}</Badge>}
                      {athlete.altPositions?.map(p => <Badge key={p} variant="outline" className="text-xs text-muted-foreground">{p}</Badge>)}
                      {athlete.isVerified && (
                        <Badge className="bg-blue-500/10 text-blue-700 border-blue-200 gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3" />Verified
                        </Badge>
                      )}
                      {athlete.activelyLooking && (
                        <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-xs">Actively Looking</Badge>
                      )}
                    </div>
                  </div>
                  {csi !== undefined && csiBand && (
                    <div className={cn('text-center p-3 rounded-xl border-2', csiBand.bg, csiBand.border)}>
                      <p className={cn('text-3xl font-black', csiBand.color)}>{Math.round(csi)}</p>
                      <p className={cn('text-[10px] font-black uppercase tracking-wider', csiBand.color)}>CSI Score</p>
                      <p className={cn('text-[9px]', csiBand.color)}>{csiBand.label}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
                  <div><p className="text-slate-500 text-xs">Age</p><p className="font-bold text-slate-800">{athlete.age}</p></div>
                  <div><p className="text-slate-500 text-xs">Location</p><p className="font-bold text-slate-800">{athlete.country || 'Kenya'}</p></div>
                  <div><p className="text-slate-500 text-xs">Club</p><p className="font-bold text-slate-800">{athlete.clubName || 'Unattached'}</p></div>
                  <div><p className="text-slate-500 text-xs">Nationality</p><p className="font-bold text-slate-800">{athlete.nationality || 'Kenyan'}</p></div>
                </div>
              </div>
            </div>

            {/* ── PERFORMANCE ANALYSIS ── */}
            <div className="px-8 py-6 border-b border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Performance Analysis</h2>
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0 flex items-center justify-center">
                  <RadarChartSVG athlete={athlete} />
                </div>
                <div className="flex-1 space-y-3">
                  <IndexBar value={athlete.performanceIndex} label="Performance Index" />
                  <IndexBar value={athlete.efficiencyIndex} label="Efficiency Index" />
                  <IndexBar value={athlete.consistencyIndex} label="Consistency Index" />
                  <IndexBar value={athlete.developmentIndex} label="Development Index" />
                  <IndexBar value={athlete.contextIndex} label="Context Index" />
                  <IndexBar value={athlete.talentGraphScore} label="Talent Graph Score" />
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Height</p>
                      <p className="font-black text-slate-800">{athlete.heightCm ? `${athlete.heightCm}cm` : '–'}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Weight</p>
                      <p className="font-black text-slate-800">{athlete.weightKg ? `${athlete.weightKg}kg` : '–'}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Foot</p>
                      <p className="font-black text-slate-800">{athlete.dominantFoot || '–'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SEASON SUMMARY ── */}
            {recentMatches.length > 0 && (
              <div className="px-8 py-6 border-b border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Recent Match Summary (Last {recentMatches.length} matches)</h2>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'Appearances', value: totalApps },
                    { label: 'Goals', value: totalGoals },
                    { label: 'Assists', value: totalAssists },
                    { label: 'Minutes', value: totalMins.toLocaleString() },
                  ].map(s => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-2xl font-black text-blue-600">{s.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="text-left py-2 pr-3 font-semibold">Competition</th>
                        <th className="text-center py-2 px-2 font-semibold">Apps</th>
                        <th className="text-center py-2 px-2 font-semibold">Goals</th>
                        <th className="text-center py-2 px-2 font-semibold">Assists</th>
                        <th className="text-center py-2 px-2 font-semibold">Mins</th>
                        <th className="text-center py-2 px-2 font-semibold">Rating</th>
                        <th className="text-center py-2 px-2 font-semibold">YC</th>
                        <th className="text-center py-2 px-2 font-semibold">RC</th>
                        <th className="text-center py-2 pl-2 font-semibold">Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMatches.map((m, i) => (
                        <tr key={i} className={cn('border-b border-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                          <td className="py-1.5 pr-3 font-medium text-slate-700">{m.competition}</td>
                          <td className="text-center py-1.5 px-2">{m.apps}</td>
                          <td className="text-center py-1.5 px-2 font-bold text-blue-600">{m.goals}</td>
                          <td className="text-center py-1.5 px-2 font-bold text-blue-500">{m.assists}</td>
                          <td className="text-center py-1.5 px-2">{m.minutes}</td>
                          <td className="text-center py-1.5 px-2">
                            <span className={cn('font-bold', m.rating >= 8 ? 'text-green-600' : m.rating >= 6 ? 'text-amber-600' : 'text-red-500')}>{m.rating}</span>
                          </td>
                          <td className="text-center py-1.5 px-2">{m.yellowCards}</td>
                          <td className="text-center py-1.5 px-2">{m.redCards}</td>
                          <td className="text-center py-1.5 pl-2">{m.isVerified ? '✓' : '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── CAREER HISTORY ── */}
            {(athlete.previousTeams?.length ?? 0) > 0 && (
              <div className="px-8 py-6 border-b border-slate-100">
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Career History</h2>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="text-left py-2 pr-3 font-semibold">Club</th>
                      <th className="text-left py-2 px-2 font-semibold">Country</th>
                      <th className="text-center py-2 px-2 font-semibold">From</th>
                      <th className="text-center py-2 px-2 font-semibold">To</th>
                      <th className="text-center py-2 px-2 font-semibold">Apps</th>
                      <th className="text-center py-2 pl-2 font-semibold">Goals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athlete.previousTeams!.map((t, i) => (
                      <tr key={i} className={cn('border-b border-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{t.teamName}</td>
                        <td className="py-1.5 px-2 text-slate-600">{t.country}</td>
                        <td className="text-center py-1.5 px-2">{t.from}</td>
                        <td className="text-center py-1.5 px-2">{t.to || 'Present'}</td>
                        <td className="text-center py-1.5 px-2">{t.appearances ?? '–'}</td>
                        <td className="text-center py-1.5 pl-2 font-bold">{t.goals ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── RISK & DISCIPLINE ── */}
            <div className="px-8 py-6 border-b border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Risk & Discipline Assessment</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500">Risk Band</p>
                  <p className={cn('font-black text-sm mt-0.5', riskBand.color)}>{riskBand.label}</p>
                  {athlete.riskIndex !== undefined && <p className="text-xs text-slate-400">{Math.round(athlete.riskIndex)}/100</p>}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500">Consistency</p>
                  <p className="font-black text-sm mt-0.5 text-slate-800">{consistencyLabel}</p>
                  {athlete.consistencyIndex !== undefined && <p className="text-xs text-slate-400">{Math.round(athlete.consistencyIndex)}/100</p>}
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500">Yellow Cards</p>
                  <p className={cn('font-black text-xl mt-0.5', (athlete.yellowCards ?? 0) > 5 ? 'text-amber-600' : 'text-slate-800')}>{athlete.yellowCards ?? 0}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500">Red Cards</p>
                  <p className={cn('font-black text-xl mt-0.5', (athlete.redCards ?? 0) > 0 ? 'text-red-600' : 'text-slate-800')}>{athlete.redCards ?? 0}</p>
                </div>
              </div>

              {athlete.readinessTier && (
                <div className="mt-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Readiness Tier:</span>
                  <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">{athlete.readinessTier}</Badge>
                </div>
              )}

              {athlete.bio && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">Athlete Bio</p>
                  <p className="text-sm text-slate-700 leading-relaxed italic">&ldquo;{athlete.bio}&rdquo;</p>
                </div>
              )}
            </div>

            {/* ── AI SCOUT ANALYSIS ── */}
            {idToken && (
              <AIAnalysisSection
                athlete={athlete}
                idToken={idToken}
                scoutId={user!.uid}
                scoutName={userAccount?.displayName || user!.displayName || 'Scout'}
                firestore={firestore}
              />
            )}

            {/* ── VERIFICATION STATUS ── */}
            <div className="px-8 py-5 border-b border-slate-100">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Verification Status</h2>
              <div className="flex items-center gap-3">
                {athlete.isVerified ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">Institutionally Verified</span>
                    <span className="text-xs text-slate-400">Data confirmed by affiliated club</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500">
                    <ShieldAlert className="w-5 h-5" />
                    <span className="font-semibold text-sm">Self-Reported Data</span>
                    <span className="text-xs text-slate-400">Pending institutional verification</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="px-8 py-5 bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Live Profile</p>
                <p className="text-sm font-bold text-blue-600">talentgraph.co.ke/@{athlete.username}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400">This report was generated by Talent Graph Kenya</p>
                <p className="text-[10px] text-slate-400">Data is subject to change. Verify directly with athlete.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
