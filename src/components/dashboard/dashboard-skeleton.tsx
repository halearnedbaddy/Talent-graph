'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-muted/40 pb-20">
      <header className="bg-background border-b h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Banner Skeleton */}
        <Skeleton className="h-16 w-full rounded-lg" />

        {/* Profile Header Skeleton */}
        <Card className="overflow-hidden border-none shadow-xl bg-background">
          <Skeleton className="h-32 w-full" />
          <CardContent className="relative px-8 pb-8 pt-12 space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-end -mt-12">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-6 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-8 border-t">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Indices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-10 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="h-[500px]">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="flex items-center justify-center h-full">
                <Skeleton className="h-64 w-64 rounded-full" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-8">
            <Card className="h-48">
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
            <Card className="h-64">
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
