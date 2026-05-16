
'use client';

import type { AthleteProfile } from '@/lib/types';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1 && parts[0] && parts[parts.length - 1]) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (parts[0]) {
      return name.substring(0, 2).toUpperCase();
    }
    return '??';
}


export function AthleteCard({ athlete }: { athlete: AthleteProfile }) {
  const fullName = (athlete.firstName && athlete.lastName) ? `${athlete.firstName} ${athlete.lastName}` : athlete.username;

  return (
     <Link href={`/${athlete.username}`} className="block">
        <Card className="h-full flex flex-col hover:border-primary transition-colors">
            <CardHeader className="flex-row items-center gap-4">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${fullName}`} />
                    <AvatarFallback>{getInitials(fullName)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg leading-tight">{fullName}</CardTitle>
                    <CardDescription>@{athlete.username}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                <div className="text-sm">
                    <span className="font-semibold">Sport: </span>
                    <span className="capitalize">{athlete.sport}</span>
                </div>
                {athlete.position && (
                    <div className="text-sm">
                        <span className="font-semibold">Position: </span>
                        <span className="capitalize">{athlete.position}</span>
                    </div>
                )}
                 <div className="text-sm">
                    <span className="font-semibold">Age: </span>
                    <span>{athlete.age}</span>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between items-center">
                 <Badge variant="outline">{athlete.readinessTier || 'Not Scored'}</Badge>
                 <div className="text-right">
                    <div className="text-2xl font-bold">{athlete.talentGraphScore || 'N/A'}</div>
                    <div className="text-xs text-muted-foreground">TGS</div>
                 </div>
            </CardFooter>
        </Card>
     </Link>
  );
}
