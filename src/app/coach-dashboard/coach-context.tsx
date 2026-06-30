'use client';

import { createContext, useContext } from 'react';

export interface CoachClubContextValue {
  clubId: string | null;
  clubName: string;
  membershipsLoaded: boolean;
}

export const CoachClubContext = createContext<CoachClubContextValue>({
  clubId: null,
  clubName: '',
  membershipsLoaded: false,
});

export const useCoachClub = () => useContext(CoachClubContext);
