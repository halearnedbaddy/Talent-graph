'use client';

import { createContext, useContext } from 'react';
import type { UserAccount } from '@/lib/types';

export interface CoachClubContextValue {
  clubId: string | null;
  clubName: string;
  membershipsLoaded: boolean;
  userAccount: UserAccount | null;
}

export const CoachClubContext = createContext<CoachClubContextValue>({
  clubId: null,
  clubName: '',
  membershipsLoaded: false,
  userAccount: null,
});

export const useCoachClub = () => useContext(CoachClubContext);
