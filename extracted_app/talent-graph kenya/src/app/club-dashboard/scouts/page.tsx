
'use client';

import { ScoutTable } from '@/components/club/scout-table';
import { PendingScouts } from '@/components/club/pending-scouts';

export default function ScoutsOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Scouts Overview</h1>
      </div>
      
      <PendingScouts />

      <div className="flex flex-1 items-start justify-center rounded-lg border border-dashed shadow-sm p-4 mt-4">
        <ScoutTable />
      </div>
    </div>
  );
}
