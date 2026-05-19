'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AthleteProfile, UserAccount } from '@/lib/types';
import { Loader2, Printer, ArrowLeft, CheckCircle2, ShieldAlert, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

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

export default function ScoutingReportPage() {
  const params = useParams();
  const athleteId = params.athleteId as string;
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [generatedAt] = useState(() => new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' }));

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
