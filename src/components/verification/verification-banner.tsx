'use client';

import { useState } from 'react';
import { ShieldCheck, Info, Loader2, Link as LinkIcon, FileCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface VerificationBannerProps {
  uid: string;
  type: 'scout' | 'club';
  isVerified?: boolean;
}

export function VerificationBanner({ uid, type, isVerified }: VerificationBannerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [nationalIdUrl, setNationalIdUrl] = useState('');
  const [regDocUrl, setRegDocUrl] = useState('');

  if (isVerified) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedInUrl || !nationalIdUrl) {
        toast({ variant: 'destructive', title: 'Missing Info', description: 'LinkedIn and ID links are required.' });
        return;
    }

    setIsSubmitting(true);
    try {
      const requestId = `verify_${type}_${uid}`;
      await setDoc(doc(firestore, 'verification_requests', requestId), {
        id: requestId,
        targetUid: uid,
        targetType: type,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        linkedInUrl,
        nationalIdUrl,
        registrationDocUrl: type === 'club' ? regDocUrl : (regDocUrl || 'N/A'),
      });

      toast({ title: 'Request Submitted', description: 'Our admins will review your documents shortly.' });
      setIsOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to submit request.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Alert className="bg-blue-500/10 border-blue-500/20 text-blue-600 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5" />
        <div>
          <AlertTitle className="font-bold">Institutional Verification</AlertTitle>
          <AlertDescription className="text-xs">
            Verify your professional identity to gain institutional trust and access the full Talent Graph.
          </AlertDescription>
        </div>
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 px-4">
            Get Verified
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verification Request</DialogTitle>
            <DialogDescription>
              Please provide Google Cloud links to your professional documents. If you don't have a specific document, write "N/A".
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkedin" className="flex items-center gap-2">
                <LinkIcon className="w-3 h-3" /> LinkedIn Profile Link
              </Label>
              <Input 
                id="linkedin" 
                placeholder="https://console.cloud.google.com/storage/browser/..." 
                value={linkedInUrl}
                onChange={e => setLinkedInUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="id" className="flex items-center gap-2">
                <FileCheck className="w-3 h-3" /> National ID / Passport Copy
              </Label>
              <Input 
                id="id" 
                placeholder="GCS Link to scanned document" 
                value={nationalIdUrl}
                onChange={e => setNationalIdUrl(e.target.value)}
                required
              />
            </div>
            {type === 'club' && (
              <div className="space-y-2">
                <Label htmlFor="reg" className="flex items-center gap-2">
                  <Info className="w-3 h-3" /> Registration Document
                </Label>
                <Input 
                  id="reg" 
                  placeholder="GCS Link to club registration" 
                  value={regDocUrl}
                  onChange={e => setRegDocUrl(e.target.value)}
                  required
                />
              </div>
            )}
            {type === 'scout' && (
              <div className="space-y-2">
                <Label htmlFor="reg" className="flex items-center gap-2">
                  <Info className="w-3 h-3" /> Professional Cert (Optional)
                </Label>
                <Input 
                  id="reg" 
                  placeholder="GCS Link or N/A" 
                  value={regDocUrl}
                  onChange={e => setRegDocUrl(e.target.value)}
                />
              </div>
            )}
            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Submit for Review
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Alert>
  );
}