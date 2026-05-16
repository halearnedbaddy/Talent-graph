'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Clock, ShieldCheck, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { VerificationRequest } from '@/lib/types';

export function VerificationManager() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const verificationQuery = useMemoFirebase(() => (
    firestore ? query(collection(firestore, 'verification_requests'), orderBy('requestedAt', 'desc')) : null
  ), [firestore]);

  const { data: requests, isLoading } = useCollection<VerificationRequest>(verificationQuery);

  const handleAction = async (req: VerificationRequest, action: 'approved' | 'rejected') => {
    if (!firestore) return;
    setProcessingId(req.id);

    try {
      const requestRef = doc(firestore, 'verification_requests', req.id);
      await updateDoc(requestRef, {
        status: action,
        processedAt: new Date().toISOString(),
      });

      if (action === 'approved') {
        const targetRef = doc(firestore, req.targetType === 'scout' ? 'scouts' : 'clubs', req.targetUid);
        await updateDoc(targetRef, { isVerified: true });
      }

      toast({
        title: `Request ${action}`,
        description: `The ${req.targetType} has been ${action}.`,
      });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to process verification.' });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Professional Verifications</CardTitle>
        <CardDescription>Manage authenticity requests from clubs and scouts.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Date Requested</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
            ) : requests?.length ? (
              requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="capitalize font-bold">{req.targetType}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5">
                        <a href={req.linkedInUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" /> LinkedIn
                        </a>
                        <a href={req.nationalIdUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> ID/Passport
                        </a>
                        {req.registrationDocUrl && req.registrationDocUrl !== 'N/A' && (
                            <a href={req.registrationDocUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" /> Registration
                            </a>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(req.requestedAt), 'PPP')}</TableCell>
                  <TableCell>
                    <Badge variant={req.status === 'pending' ? 'outline' : req.status === 'approved' ? 'default' : 'destructive'} className="flex items-center gap-1 w-fit">
                      {req.status === 'pending' && <Clock className="w-3 h-3" />}
                      {req.status === 'approved' && <ShieldCheck className="w-3 h-3" />}
                      <span className="capitalize">{req.status}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === 'pending' && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleAction(req, 'rejected')} disabled={processingId === req.id}>
                          <X className="w-4 h-4 text-red-500" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAction(req, 'approved')} disabled={processingId === req.id} className="border-green-500/50 hover:bg-green-50">
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No verification requests found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}