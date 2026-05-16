'use client';

import { ScoutProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface FilterSidebarProps {
  scoutProfile: ScoutProfile;
  activeFilters: { sports: string[] };
  onFilterChange: (filters: { sports: string[] }) => void;
}

export function FilterSidebar({ scoutProfile, activeFilters, onFilterChange }: FilterSidebarProps) {
  
  const handleSportChange = (sport: string, checked: boolean) => {
    const newSports = checked
      ? [...activeFilters.sports, sport]
      : activeFilters.sports.filter(s => s !== sport);
    onFilterChange({ ...activeFilters, sports: newSports });
  };

  return (
    <div className="p-2 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {scoutProfile.sports?.map(sport => (
            <div key={sport} className="flex items-center space-x-2">
              <Checkbox
                id={`sport-${sport}`}
                checked={activeFilters.sports.includes(sport)}
                onCheckedChange={(checked) => handleSportChange(sport, !!checked)}
              />
              <Label htmlFor={`sport-${sport}`} className="font-normal capitalize">{sport}</Label>
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Other filter cards can be added here */}
    </div>
  );
}
