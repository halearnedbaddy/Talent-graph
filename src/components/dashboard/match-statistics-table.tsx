'use client';

import { MatchEntry } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Clock, Star, Shield, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const CATEGORY_COLORS: Record<string, string> = {
  league: 'bg-blue-500/10 text-blue-700 border-blue-200',
  cup: 'bg-purple-500/10 text-purple-700 border-purple-200',
  friendly: 'bg-green-500/10 text-green-700 border-green-200',
  national: 'bg-red-500/10 text-red-700 border-red-200',
  other: 'bg-gray-500/10 text-gray-700 border-gray-200',
};

interface Props {
  matchHistory: MatchEntry[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function MatchStatisticsTable({ matchHistory, onEdit, onDelete }: Props) {
  const totals = matchHistory.reduce((acc, m) => ({
    apps: acc.apps + (Number(m.apps) || 0),
    minutes: acc.minutes + (Number(m.minutes) || 0),
    ratingSum: acc.ratingSum + ((Number(m.rating) || 0) * (Number(m.apps) || 0)),
    goals: acc.goals + (Number(m.goals) || 0),
    assists: acc.assists + (Number(m.assists) || 0),
    shots: acc.shots + (Number(m.shots) || 0),
    duels: acc.duels + (Number(m.duelsWon) || 0),
    saves: acc.saves + (Number(m.saves) || 0),
    yellows: acc.yellows + (Number(m.yellowCards) || 0),
    reds: acc.reds + (Number(m.redCards) || 0),
    motm: acc.motm + (m.manOfTheMatch ? 1 : 0),
    cleanSheets: acc.cleanSheets + (m.cleanSheet ? 1 : 0),
  }), { apps: 0, minutes: 0, ratingSum: 0, goals: 0, assists: 0, shots: 0, duels: 0, saves: 0, yellows: 0, reds: 0, motm: 0, cleanSheets: 0 });

  const avgRating = totals.apps > 0 ? (totals.ratingSum / totals.apps).toFixed(2) : '--';

  return (
    <div className="rounded-xl border bg-background overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="font-black text-[10px] uppercase tracking-widest">Competition</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Cat</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Apps</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Min</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest text-primary">Rating</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">G</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">A</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Sh</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Sav</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest text-red-500">Y/R</TableHead>
            <TableHead className="text-center font-black text-[10px] uppercase tracking-widest">Awards</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matchHistory.map((m) => (
            <TableRow key={m.id} className="hover:bg-muted/30">
              <TableCell className="font-bold text-xs">
                <div>{m.competition}</div>
                {m.opponent && <div className="text-[9px] text-muted-foreground">vs {m.opponent}</div>}
              </TableCell>
              <TableCell className="text-center">
                {m.category && (
                  <Badge className={`text-[8px] font-black uppercase border ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.other}`}>
                    {m.category}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.apps) || 0}</TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.minutes) || 0}</TableCell>
              <TableCell className="text-center text-xs font-black text-primary">{(Number(m.rating) || 0).toFixed(1)}</TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.goals) || 0}</TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.assists) || 0}</TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.shots) || 0}</TableCell>
              <TableCell className="text-center text-xs font-mono">{Number(m.saves) || 0}</TableCell>
              <TableCell className="text-center text-xs font-mono font-bold">
                <span className="text-orange-500">{Number(m.yellowCards) || 0}</span>
                /
                <span className="text-red-600">{Number(m.redCards) || 0}</span>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {m.manOfTheMatch && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" title="Man of the Match" />}
                  {m.cleanSheet && <Shield className="w-3 h-3 text-green-500" title="Clean Sheet" />}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {m.isVerified
                    ? <ShieldCheck className="w-3 h-3 text-green-500" />
                    : <Clock className="w-3 h-3 text-muted-foreground" />
                  }
                  {!m.isVerified && (onEdit || onDelete) && (
                    <div className="flex items-center gap-0.5 ml-1">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => onEdit(m.id)}
                          title="Edit match"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(m.id)}
                          title="Delete match"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}

          <TableRow className="bg-neutral-950 text-white font-bold hover:bg-neutral-900 border-none">
            <TableCell className="uppercase text-[10px] tracking-widest">All Time</TableCell>
            <TableCell />
            <TableCell className="text-center font-mono">{totals.apps}</TableCell>
            <TableCell className="text-center font-mono">{totals.minutes}</TableCell>
            <TableCell className="text-center font-black text-primary">{avgRating}</TableCell>
            <TableCell className="text-center font-mono">{totals.goals}</TableCell>
            <TableCell className="text-center font-mono">{totals.assists}</TableCell>
            <TableCell className="text-center font-mono">{totals.shots}</TableCell>
            <TableCell className="text-center font-mono">{totals.saves}</TableCell>
            <TableCell className="text-center font-mono text-orange-300">{totals.yellows}/{totals.reds}</TableCell>
            <TableCell className="text-center text-[10px] font-black text-neutral-400">
              {totals.motm}x MoM / {totals.cleanSheets}x CS
            </TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
