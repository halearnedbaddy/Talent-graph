'use client';

import { AthleteProfile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ShieldCheck, Clock, User, Ruler, Weight, Footprints, MapPin, Play, Globe, Star } from 'lucide-react';

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

export function ProfileHeader({ profile }: { profile: AthleteProfile }) {
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const isVerified = profile.isVerified;

  const careerStats = profile.matchHistory?.reduce(
    (acc, m) => ({
      goals: acc.goals + (Number(m.goals) || 0),
      assists: acc.assists + (Number(m.assists) || 0),
      motm: acc.motm + (m.manOfTheMatch ? 1 : 0),
      cleanSheets: acc.cleanSheets + (m.cleanSheet ? 1 : 0),
    }),
    { goals: 0, assists: 0, motm: 0, cleanSheets: 0 }
  ) || { goals: 0, assists: 0, motm: 0, cleanSheets: 0 };

  return (
    <Card className="overflow-hidden border-none shadow-xl bg-background">
      <div className="h-32 bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        {profile.country && (
          <div className="absolute top-4 right-6 flex items-center gap-2 text-neutral-400">
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{profile.country}</span>
          </div>
        )}
      </div>
      <CardContent className="relative px-8 pb-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end -mt-16">
          <div className="relative shrink-0">
            <Avatar className="h-28 w-28 border-4 border-background shadow-2xl rounded-2xl">
              <AvatarImage
                src={profile.photoUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${fullName}`}
                className="object-cover"
              />
              <AvatarFallback className="rounded-xl text-xl font-black bg-neutral-800 text-white">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            {profile.highlightVideoUrl && (
              <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg">
                <Play className="w-3 h-3 fill-current" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-2 pb-2 pt-4 md:pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter">{fullName}</h1>
              {profile.nickname && (
                <span className="text-xl font-bold text-muted-foreground italic">"{profile.nickname}"</span>
              )}
              {profile.jerseyNumber && (
                <Badge variant="outline" className="text-lg font-black border-2 border-primary/20 text-primary">#{profile.jerseyNumber}</Badge>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{profile.team || 'Unattached'}</div>
              <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{profile.age} YRS</div>
              {profile.country && (
                <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />{profile.country}</div>
              )}
              <Badge className="bg-primary text-primary-foreground font-black tracking-[0.2em]">{profile.readinessTier || 'Developing'}</Badge>
              {isVerified ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> COACH VERIFIED
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> SELF REPORTED
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 border-t pt-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Height</p>
            <div className="flex items-center gap-2 font-bold"><Ruler className="w-4 h-4 text-primary" /> {profile.heightCm} cm</div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Weight</p>
            <div className="flex items-center gap-2 font-bold"><Weight className="w-4 h-4 text-primary" /> {profile.weightKg} kg</div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Dominant Foot</p>
            <div className="flex items-center gap-2 font-bold"><Footprints className="w-4 h-4 text-primary" /> {profile.dominantFoot || 'Right'}</div>
          </div>
          <div className="space-y-1 md:col-span-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Position(s)</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge className="bg-neutral-100 text-neutral-900 border-none capitalize">{profile.position}</Badge>
              {profile.altPositions?.map(pos => (
                <Badge key={pos} variant="outline" className="capitalize text-muted-foreground">{pos}</Badge>
              ))}
            </div>
          </div>
        </div>

        {(profile.matchHistory && profile.matchHistory.length > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t pt-6 bg-muted/30 rounded-xl p-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Career Goals</p>
              <p className="text-2xl font-black text-primary mt-1">{careerStats.goals}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Assists</p>
              <p className="text-2xl font-black text-primary mt-1">{careerStats.assists}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Man of Match</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <p className="text-2xl font-black">{careerStats.motm}</p>
              </div>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Clean Sheets</p>
              <p className="text-2xl font-black text-green-600 mt-1">{careerStats.cleanSheets}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
