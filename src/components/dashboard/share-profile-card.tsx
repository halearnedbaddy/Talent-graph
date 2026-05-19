'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Share2, CheckCheck, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ShareProfileCardProps {
  username: string;
  firstName: string;
}

export function ShareProfileCard({ username, firstName }: ShareProfileCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const profileUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${username}`
    : `https://talentgraph.ke/${username}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast({ title: 'Link copied!', description: 'Share it with scouts, coaches, and clubs.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: 'Please copy the link manually.' });
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${firstName}'s Talent Graph Profile`,
          text: `Check out ${firstName}'s verified athletic profile on Talent Graph`,
          url: profileUrl,
        });
      } else {
        await handleCopy();
      }
    } catch {
      // user cancelled share — no error needed
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-emerald-400" />
      <CardContent className="p-4 space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-0.5">Your Profile Link</p>
          <p className="text-sm font-black text-primary truncate">/{username}</p>
        </div>

        {/* URL chip */}
        <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border/50">
          <span className="text-xs text-muted-foreground truncate flex-1 font-mono select-all">
            {profileUrl}
          </span>
          <button
            onClick={handleCopy}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy link"
          >
            {copied
              ? <CheckCheck className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4" />
            }
          </button>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-2 font-bold h-9"
            onClick={handleShare}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 font-bold h-9"
            asChild
          >
            <Link href={`/${username}`} target="_blank">
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </Link>
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Anyone with this link can view your public profile — share it with scouts, coaches, and clubs to get discovered.
        </p>
      </CardContent>
    </Card>
  );
}
