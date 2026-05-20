'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { AthleteProfile } from '@/lib/types';
import { CheckCircle2, Bookmark, BookmarkCheck, PlusCircle, MinusCircle, MessageSquare, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function getCSIColor(score?: number) {
  if (score === undefined || score === null) return 'bg-muted text-muted-foreground border-muted';
  if (score >= 75) return 'bg-green-500/10 text-green-600 border-green-200';
  if (score >= 50) return 'bg-amber-500/10 text-amber-600 border-amber-200';
  return 'bg-red-500/10 text-red-600 border-red-200';
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
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-0">
        <div className="flex gap-3 p-3 pb-2">
          <div className="relative flex-shrink-0">
            {photoUrl ? (
              <div className="w-14 h-14 rounded-full overflow-hidden border">
                <Image src={photoUrl} alt={fullName} width={56} height={56} className="object-cover w-full h-full" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 border flex items-center justify-center text-primary font-bold text-sm">
                {getInitials(firstName, lastName)}
              </div>
            )}
            {isVerified && (
              <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 w-4 h-4 text-blue-500 bg-background rounded-full" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <p className="font-semibold text-sm leading-tight truncate">{fullName}</p>
              {compositeScoutingIndex !== undefined && (
                <Badge variant="outline" className={cn('text-xs font-bold flex-shrink-0', getCSIColor(compositeScoutingIndex))}>
                  {Math.round(compositeScoutingIndex)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {position && (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{position}</span>
              )}
              {altPositions?.slice(0, 1).map(p => (
                <span key={p} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{age}y</span>
              {country && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {country}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {clubName || team || 'Unattached'}
            </p>
          </div>
        </div>

        {showAvailability && marketplaceBio && (
          <p className="px-3 pb-2 text-xs text-muted-foreground italic line-clamp-2">&ldquo;{marketplaceBio}&rdquo;</p>
        )}

        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {isVerified && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">✓ Verified</Badge>
          )}
          {activelyLooking && (
            <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500 hover:bg-emerald-600">Looking</Badge>
          )}
          {showAvailability && availabilityDate && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Avail. {availabilityDate}
            </Badge>
          )}
        </div>

        <div className="flex gap-1 px-2 pb-2 border-t pt-2">
          <Button size="sm" variant="default" className="flex-1 text-xs h-7" asChild>
            <Link href={`/${athlete.username}`}>View Profile</Link>
          </Button>
          {onCompare && (
            <Button
              size="sm"
              variant={isInCompare ? 'destructive' : 'outline'}
              className="text-xs h-7 px-2"
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
              className="text-xs h-7 px-2"
              onClick={onSave}
              title={isSaved ? 'Unsave athlete' : 'Save athlete'}
            >
              {isSaved ? (
                <BookmarkCheck className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          {onSendMessage && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2"
              onClick={onSendMessage}
              title="Send message"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
