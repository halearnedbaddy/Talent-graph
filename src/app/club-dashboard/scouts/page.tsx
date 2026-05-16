
'use client';

import { ScoutTable } from '@/components/club/scout-table';
import { PendingScouts } from '@/components/club/pending-scouts';

export default function ScoutsOverviewPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Scouts</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Scout network overview</p>
      </div>

      <PendingScouts />

      <div className="rounded-xl border border-dashed p-4 overflow-x-auto">
        <ScoutTable />
      </div>
    </div>
  );
}
