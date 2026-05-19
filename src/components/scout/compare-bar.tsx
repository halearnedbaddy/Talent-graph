'use client';

import type { AthleteProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { X, BarChart2 } from 'lucide-react';
import Image from 'next/image';

interface CompareBarProps {
  compareList: AthleteProfile[];
  onRemove: (uid: string) => void;
  onCompare: () => void;
  onClear: () => void;
  bottomOffset?: number;
}

export function CompareBar({
  compareList,
  onRemove,
  onCompare,
  onClear,
  bottomOffset = 64,
}: CompareBarProps) {
  if (compareList.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg"
      style={{ bottom: bottomOffset }}
    >
      <div className="max-w-screen-xl mx-auto px-3 py-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {compareList.map(a => (
            <div key={a.uid} className="relative flex-shrink-0">
              {a.photoUrl ? (
                <Image
                  src={a.photoUrl}
                  alt={`${a.firstName} ${a.lastName}`}
                  width={36}
                  height={36}
                  className="rounded-full object-cover w-9 h-9 border"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/10 border flex items-center justify-center text-xs font-bold text-primary">
                  {a.firstName?.[0]}{a.lastName?.[0]}
                </div>
              )}
              <button
                onClick={() => onRemove(a.uid)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          {Array.from({ length: Math.max(0, 5 - compareList.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground/30"
            >
              <span className="text-xs font-bold">+</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:block">{compareList.length}/5</span>
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={onClear}>
            Clear
          </Button>
          <Button
            size="sm"
            className="text-xs h-7"
            onClick={onCompare}
            disabled={compareList.length < 2}
          >
            <BarChart2 className="w-3.5 h-3.5 mr-1" />
            Compare{compareList.length >= 2 ? ` (${compareList.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
