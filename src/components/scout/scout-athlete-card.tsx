'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AthleteProfile } from '@/lib/types';
import { CheckCircle2, Bookmark, BookmarkCheck, PlusCircle, MinusCircle, MessageSquare, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function getCSIColor(score?: number) {
  if (score === undefined || score === null) return 'text-[#94A3B8] bg-[#1C2333] border-[#1E293B]';
  if (score >= 75) return 'text-[#00C853] bg-[#00C853]/10 border-[#00C853]/30';
  if (score >= 50) return 'text-[#FF6D00] bg-[#FF6D00]/10 border-[#FF6D00]/30';
  return 'text-red-400 bg-red-500/10 border-red-500/30';
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
}

interface ScoutAthleteCardProps {
  athlete: AthleteProfile;
  isInCompare?: boolean;
  compareDisabled?: boolean;
  isSaved?: boolean;
  onCompare?: () => void;
  onSave?: () => void;
  onSendMessage?: () => void;
  showAvailability?: boolean;
}

export function ScoutAthleteCard({
  athlete,
  isInCompare,
  compareDisabled,
  isSaved,
  onCompare,
  onSave,
  onSendMessage,
  showAvailability,
}: ScoutAthleteCardProps) {
  const { firstName, lastName, position, altPositions, age, country, clubName, team, compositeScoutingIndex, isVerified, photoUrl, activelyLooking, availabilityDate, marketplaceBio } = athlete;
  const fullName = `${firstName} ${lastName}`;

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden hover:border-[#00C853]/30 transition-colors">
      <div className="flex gap-3 p-3 pb-2">
        <div className="relative shrink-0">
          {photoUrl ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#1E293B]">
              <Image src={photoUrl} alt={fullName} width={56} height={56} className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[#1C2333] border border-[#1E293B] flex items-center justify-center text-[#94A3B8] font-black text-sm">
              {getInitials(firstName, lastName)}
            </div>
          )}
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 bg-[#00C853] rounded-full p-0.5">
              <CheckCircle2 className="w-3 h-3 text-black" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-black text-sm leading-tight truncate text-white">{fullName}</p>
            {compositeScoutingIndex !== undefined && (
              <Badge variant="outline" className={cn('text-xs font-black shrink-0 border', getCSIColor(compositeScoutingIndex))}>
                {Math.round(compositeScoutingIndex)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            {position && (
              <span className="text-[10px] font-black text-[#94A3B8] bg-[#1C2333] px-1.5 py-0.5 rounded-md uppercase tracking-wide">{position}</span>
            )}
            {altPositions?.slice(0, 1).map(p => (
              <span key={p} className="text-[10px] text-[#94A3B8] bg-[#1C2333] px-1.5 py-0.5 rounded-md uppercase tracking-wide">{p}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#94A3B8]">
            <span className="font-bold">{age}y</span>
            {country && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-2.5 h-2.5" />
                {country}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5 truncate">
            {clubName || team || 'Unattached'}
          </p>
        </div>
      </div>

      {showAvailability && marketplaceBio && (
        <p className="px-3 pb-2 text-[11px] text-[#94A3B8] italic line-clamp-2">&ldquo;{marketplaceBio}&rdquo;</p>
      )}

      <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
        {isVerified && (
          <span className="text-[9px] font-black text-[#00C853] bg-[#00C853]/10 border border-[#00C853]/30 px-1.5 py-0.5 rounded-md">✓ VERIFIED</span>
        )}
        {activelyLooking && (
          <span className="text-[9px] font-black text-black bg-[#00C853] px-1.5 py-0.5 rounded-md uppercase">Looking</span>
        )}
        {showAvailability && availabilityDate && (
          <span className="text-[9px] font-black text-[#94A3B8] bg-[#1C2333] border border-[#1E293B] px-1.5 py-0.5 rounded-md">
            Avail. {availabilityDate}
          </span>
        )}
      </div>

      <div className="flex gap-1 px-2 pb-2 border-t border-[#1E293B] pt-2">
        <Button
          size="sm"
          className="flex-1 text-[10px] font-black h-7 bg-[#00C853] hover:bg-[#00C853]/90 text-black uppercase tracking-wide"
          asChild
        >
          <Link href={`/${athlete.username}`}>View Profile</Link>
        </Button>
        {onCompare && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'text-[10px] h-7 px-2 border font-black',
              isInCompare
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-[#1C2333] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#00C853]/40'
            )}
            onClick={onCompare}
            disabled={!isInCompare && compareDisabled}
            title={compareDisabled && !isInCompare ? 'Remove an athlete to add another (max 5)' : isInCompare ? 'Remove from compare' : 'Add to compare'}
          >
            {isInCompare ? <MinusCircle className="w-3.5 h-3.5" /> : <PlusCircle className="w-3.5 h-3.5" />}
          </Button>
        )}
        {onSave && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'text-[10px] h-7 px-2 border font-black',
              isSaved
                ? 'bg-[#00C853]/10 border-[#00C853]/30 text-[#00C853]'
                : 'bg-[#1C2333] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#00C853]/40'
            )}
            onClick={onSave}
            title={isSaved ? 'Unsave athlete' : 'Save athlete'}
          >
            {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
          </Button>
        )}
        {onSendMessage && (
          <Button
            size="sm"
            variant="outline"
            className="text-[10px] h-7 px-2 border bg-[#1C2333] border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#00C853]/40"
            onClick={onSendMessage}
            title="Send message"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
