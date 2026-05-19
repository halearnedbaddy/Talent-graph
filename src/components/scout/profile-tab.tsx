'use client';

import type { ScoutProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Globe, Eye, LogOut, Edit3, CheckCircle2, Building2, Tag } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Props {
  scoutProfile: ScoutProfile;
  onSignOut: () => void;
}

export function ProfileTab({ scoutProfile, onSignOut }: Props) {
  const initials = scoutProfile.name
    .split(' ')
    .map(w => w[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 pb-4">
          <div className="-mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              {scoutProfile.photoUrl ? (
                <Image
                  src={scoutProfile.photoUrl}
                  alt={scoutProfile.name}
                  width={72}
                  height={72}
                  className="rounded-full object-cover w-[72px] h-[72px] border-4 border-background shadow"
                />
              ) : (
                <div className="w-[72px] h-[72px] rounded-full bg-primary/10 border-4 border-background shadow flex items-center justify-center text-xl font-bold text-primary">
                  {initials}
                </div>
              )}
              {scoutProfile.isVerified && (
                <CheckCircle2 className="absolute bottom-0 right-0 w-5 h-5 text-blue-500 bg-background rounded-full" />
              )}
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" asChild>
              <Link href="/scout-dashboard/profile">
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </Link>
            </Button>
          </div>

          <h2 className="text-xl font-bold leading-tight">{scoutProfile.name}</h2>
          <p className="text-sm text-muted-foreground">@{scoutProfile.username}</p>

          <div className="flex flex-wrap gap-2 mt-2">
            {scoutProfile.isVerified ? (
              <Badge className="gap-1 bg-blue-500/10 text-blue-600 border-blue-200">
                <CheckCircle2 className="w-3 h-3" /> Verified Scout
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" /> Pending Verification
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 capitalize">
              <Building2 className="w-3 h-3" /> {scoutProfile.entityType}
            </Badge>
          </div>

          {scoutProfile.bio && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{scoutProfile.bio}</p>
          )}

          {scoutProfile.sports && scoutProfile.sports.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Scouting Sports</p>
              <div className="flex flex-wrap gap-1.5">
                {scoutProfile.sports.map(s => (
                  <Badge key={s} variant="secondary" className="text-xs gap-1 capitalize">
                    <Tag className="w-3 h-3" />{s}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-10 gap-2" asChild>
          <Link href={`/scout/${scoutProfile.username}`} target="_blank">
            <Eye className="w-4 h-4" />
            Public Profile
          </Link>
        </Button>
        <Button variant="outline" className="h-10 gap-2" asChild>
          <Link href="/scout-dashboard/profile">
            <Edit3 className="w-4 h-4" />
            Edit Profile
          </Link>
        </Button>
        {scoutProfile.website && (
          <Button variant="ghost" className="h-10 gap-2 col-span-2" asChild>
            <a href={scoutProfile.website} target="_blank" rel="noopener noreferrer">
              <Globe className="w-4 h-4" />
              <span className="truncate">{scoutProfile.website.replace(/^https?:\/\//, '')}</span>
            </a>
          </Button>
        )}
      </div>

      <Separator />

      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/5 gap-2"
        onClick={onSignOut}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>

      <p className="text-center text-xs text-muted-foreground pb-4">Talent Graph Kenya · Scout Console</p>
    </div>
  );
}
