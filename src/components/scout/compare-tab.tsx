'use client';

import type { AthleteProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { X, BarChart2, Printer, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { getCSIColor } from './scout-athlete-card';

interface CompareTabProps {
  compareList: AthleteProfile[];
  onRemove: (uid: string) => void;
  onClear: () => void;
}

type Row = {
  label: string;
  category: string;
  getValue: (a: AthleteProfile) => string | number | boolean | undefined;
  isNumeric?: boolean;
  lowerIsBetter?: boolean;
  render?: (v: string | number | boolean | undefined, isBest: boolean) => React.ReactNode;
};

const ROWS: Row[] = [
  { label: 'Age', category: 'Basic Info', getValue: a => a.age, isNumeric: true },
  { label: 'Position', category: 'Basic Info', getValue: a => a.position || '–' },
  { label: 'County', category: 'Basic Info', getValue: a => a.country || '–' },
  { label: 'Club', category: 'Basic Info', getValue: a => a.clubName || 'Unattached' },
  { label: 'Readiness Tier', category: 'Basic Info', getValue: a => a.readinessTier || '–' },
  { label: 'Height (cm)', category: 'Physical', getValue: a => a.heightCm || '–', isNumeric: true },
  { label: 'Weight (kg)', category: 'Physical', getValue: a => a.weightKg || '–', isNumeric: true },
  { label: 'Dominant Foot', category: 'Physical', getValue: a => a.dominantFoot || '–' },
  { label: 'Composite Score', category: 'Performance', getValue: a => a.compositeScoutingIndex !== undefined ? Math.round(a.compositeScoutingIndex) : '–', isNumeric: true },
  { label: 'Performance Index', category: 'Performance', getValue: a => a.performanceIndex !== undefined ? Math.round(a.performanceIndex) : '–', isNumeric: true },
  { label: 'Efficiency Index', category: 'Performance', getValue: a => a.efficiencyIndex !== undefined ? Math.round(a.efficiencyIndex) : '–', isNumeric: true },
  { label: 'Consistency Index', category: 'Performance', getValue: a => a.consistencyIndex !== undefined ? Math.round(a.consistencyIndex) : '–', isNumeric: true },
  { label: 'Development Index', category: 'Performance', getValue: a => a.developmentIndex !== undefined ? Math.round(a.developmentIndex) : '–', isNumeric: true },
  { label: 'Yellow Cards', category: 'Discipline', getValue: a => a.yellowCards ?? '–', isNumeric: true, lowerIsBetter: true },
  { label: 'Red Cards', category: 'Discipline', getValue: a => a.redCards ?? '–', isNumeric: true, lowerIsBetter: true },
  { label: 'Risk Index', category: 'Discipline', getValue: a => a.riskIndex !== undefined ? Math.round(a.riskIndex) : '–', isNumeric: true, lowerIsBetter: true },
  { label: 'Verified', category: 'Status', getValue: a => a.isVerified ?? false, render: (v) => v ? <CheckCircle2 className="w-4 h-4 text-blue-500" /> : <XCircle className="w-4 h-4 text-muted-foreground/40" /> },
  { label: 'Actively Looking', category: 'Status', getValue: a => a.activelyLooking ?? false, render: (v) => v ? <Badge className="text-[10px] bg-emerald-500">Yes</Badge> : <span className="text-muted-foreground text-xs">No</span> },
];

function getBestIdx(values: (string | number | boolean | undefined)[], lowerIsBetter = false): number | null {
  const nums = values.map(v => (typeof v === 'number' ? v : null));
  if (nums.every(n => n === null)) return null;
  let best: number | null = null;
  let bestVal = lowerIsBetter ? Infinity : -Infinity;
  nums.forEach((n, i) => {
    if (n === null) return;
    if (lowerIsBetter ? n < bestVal : n > bestVal) { bestVal = n; best = i; }
  });
  return best;
}

export function CompareTab({ compareList, onRemove, onClear }: CompareTabProps) {
  if (compareList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <BarChart2 className="w-16 h-16 text-muted-foreground/20" />
        <h3 className="font-semibold text-lg">No athletes to compare</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Go to Search or Marketplace and tap the <span className="font-medium">+ Compare</span> button on up to 5 athlete cards to add them here.
        </p>
      </div>
    );
  }

  if (compareList.length === 1) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <BarChart2 className="w-16 h-16 text-muted-foreground/20" />
        <h3 className="font-semibold text-lg">Add one more athlete</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          You need at least 2 athletes to compare. Add more from Search or Marketplace.
        </p>
      </div>
    );
  }

  const categories = [...new Set(ROWS.map(r => r.category))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Comparing {compareList.length} athletes</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PDF</span>
          </Button>
          <Button size="sm" variant="ghost" className="text-xs h-8 text-destructive hover:text-destructive" onClick={onClear}>
            Clear all
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="min-w-max">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left text-xs text-muted-foreground font-medium py-2 pr-4 sticky left-0 bg-background z-10 min-w-32">Attribute</th>
                {compareList.map(a => (
                  <th key={a.uid} className="text-center py-2 px-3 min-w-36">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="relative">
                        {a.photoUrl ? (
                          <Image src={a.photoUrl} alt={`${a.firstName} ${a.lastName}`} width={40} height={40} className="rounded-full object-cover w-10 h-10 border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 border flex items-center justify-center text-xs font-bold text-primary">
                            {a.firstName?.[0]}{a.lastName?.[0]}
                          </div>
                        )}
                        <button
                          onClick={() => onRemove(a.uid)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-muted border rounded-full flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold leading-tight">{a.firstName} {a.lastName}</p>
                        <p className="text-[10px] text-muted-foreground">{a.position || '–'}</p>
                        {a.compositeScoutingIndex !== undefined && (
                          <Badge variant="outline" className={cn('text-[10px] px-1 py-0 mt-0.5', getCSIColor(a.compositeScoutingIndex))}>
                            {Math.round(a.compositeScoutingIndex)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catRows = ROWS.filter(r => r.category === cat);
                return (
                  <Fragment key={cat}>
                    <tr className="border-b bg-muted/30">
                      <td colSpan={compareList.length + 1} className="py-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sticky left-0">
                        {cat}
                      </td>
                    </tr>
                    {catRows.map(row => {
                      const values = compareList.map(a => row.getValue(a));
                      const bestIdx = row.isNumeric ? getBestIdx(values, row.lowerIsBetter) : null;
                      return (
                        <tr key={row.label} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="text-xs text-muted-foreground py-2 pr-4 sticky left-0 bg-background">{row.label}</td>
                          {values.map((v, i) => (
                            <td
                              key={i}
                              className={cn(
                                'text-center py-2 px-3 text-xs font-medium',
                                bestIdx === i && 'bg-green-500/10 text-green-700 font-bold'
                              )}
                            >
                              {row.render ? row.render(v, bestIdx === i) : (
                                <span>{v === undefined || v === null ? '–' : String(v)}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <p className="text-xs text-muted-foreground text-center">
        Green highlights indicate the best value per row.
      </p>
    </div>
  );
}
