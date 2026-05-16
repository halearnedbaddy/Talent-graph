import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInCalendarDays, startOfYesterday } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function calculateLoginStreak(loginHistory: string[]): number {
  if (!loginHistory || loginHistory.length === 0) {
    return 0;
  }

  const sortedDates = loginHistory
    .map(ts => new Date(ts))
    .sort((a, b) => b.getTime() - a.getTime());
  
  const uniqueDays = [...new Set(sortedDates.map(d => d.toISOString().split('T')[0]))];

  let streak = 0;
  let today = new Date();
  
  // Check if latest login is today or yesterday
  const lastLogin = new Date(uniqueDays[0]);
  if (differenceInCalendarDays(today, lastLogin) <= 1) {
    streak = 1;
    let currentDay = lastLogin;

    for (let i = 1; i < uniqueDays.length; i++) {
      const previousDay = new Date(uniqueDays[i]);
      if (differenceInCalendarDays(currentDay, previousDay) === 1) {
        streak++;
        currentDay = previousDay;
      } else {
        break; // Streak is broken
      }
    }
  }
  
  return streak;
}
