'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCheck, Link2, QrCode, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  clubId: string;
  clubName: string;
}

function getInviteUrl(clubId: string) {
  const base =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://talentgraphkenya.com';
  return `${base}/join/club/${encodeURIComponent(clubId)}`;
}

export function InviteLinkDialog({ clubId, clubName }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const inviteUrl = getInviteUrl(clubId);
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}&color=000000&bgcolor=FFFFFF&margin=10`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Link copied!', description: 'Share it with staff or athletes.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Please copy manually.' });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Join ${clubName} on Talent Graph Kenya`,
          text: `You've been invited to join ${clubName}. Click to accept:`,
          url: inviteUrl,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 font-bold text-xs h-9"
        onClick={() => setOpen(true)}
      >
        <Link2 className="h-4 w-4" />
        Invite Link / QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Club Invite Link
            </DialogTitle>
            <DialogDescription>
              Share this link or QR code so scouts, coaches and analysts can request to join{' '}
              <strong>{clubName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="rounded-2xl border-4 border-primary/20 p-2 bg-white shadow-lg">
                <img
                  src={qrSrc}
                  alt="Invite QR Code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
            </div>

            <div className="text-center">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">
                Scan to join {clubName}
              </Badge>
            </div>

            {/* Link input */}
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                className="text-xs font-mono flex-1 bg-muted/50"
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopy}
                className="shrink-0 h-10 w-10"
                title="Copy link"
              >
                {copied
                  ? <CheckCheck className="h-4 w-4 text-green-500" />
                  : <Copy className="h-4 w-4" />
                }
              </Button>
            </div>

            <Button
              onClick={handleShare}
              className="w-full font-black gap-2 uppercase tracking-widest text-xs"
            >
              <Share2 className="h-4 w-4" />
              Share Invite
            </Button>

            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Anyone with this link can request to join your club. You still need to approve each request from the Staff page.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
