
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Flag, Eye, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function ReportManager() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const reportsQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'reports'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);

  const { data: reports, isLoading } = useCollection<any>(reportsQuery);

  const handleUpdateStatus = async (reportId: string, status: 'reviewed' | 'resolved') => {
    if (!firestore) return;
    setProcessingId(reportId);
    try {
      await updateDoc(doc(firestore, 'reports', reportId), { status });
      toast({ title: `Report ${status}`, description: `Status updated to ${status}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Update failed.' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flag className="w-5 h-5 text-red-500" />
          Safety Reports
        </CardTitle>
        <CardDescription>Review user-submitted misconduct reports and flagged connections.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Reporter</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : reports?.length ? (
              reports.map((report) => (
                <TableRow key={report.id} className={report.status === 'new' ? 'bg-red-50/30' : ''}>
                  <TableCell className="text-xs">{format(new Date(report.createdAt), 'PP p')}</TableCell>
                  <TableCell className="font-mono text-[10px]">{report.reportedBy}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs">{report.reason}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === 'new' ? 'destructive' : 'outline'}>{report.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {report.status === 'new' && (
                        <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(report.id, 'reviewed')} disabled={processingId === report.id}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {report.status !== 'resolved' && (
                        <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(report.id, 'resolved')} disabled={processingId === report.id}>
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports filed.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
