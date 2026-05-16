'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAccount, AthleteProfile } from '@/lib/types';
import { calculateLoginStreak } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Calendar, TrendingUp, Sparkles } from 'lucide-react';

interface ActivitySummaryProps {
  userAccount: UserAccount;
  athleteProfile: AthleteProfile;
}

export function ActivitySummary({ userAccount, athleteProfile }: ActivitySummaryProps) {
  const loginStreak = calculateLoginStreak(userAccount.loginHistory || []);
  const lastMetricUpdate = athleteProfile.updatedAt ? new Date(athleteProfile.updatedAt) : null;
  const nextUpdateRecommended = lastMetricUpdate ? new Date(lastMetricUpdate.setDate(lastMetricUpdate.getDate() + 30)) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <span>Activity Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Daily Login Streak</span>
          </div>
          <span className="font-bold text-lg text-primary">{loginStreak} {loginStreak === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
            <span className="font-medium">Last Metric Update</span>
          </div>
          <span className="text-sm">
            {lastMetricUpdate ? formatDistanceToNow(lastMetricUpdate, { addSuffix: true }) : 'Never'}
          </span>
        </div>
         {nextUpdateRecommended && (
           <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Next Recommended Update</span>
            </div>
            <span className="text-sm">{format(nextUpdateRecommended, 'PPP')}</span>
           </div>
         )}
      </CardContent>
    </Card>
  );
}
