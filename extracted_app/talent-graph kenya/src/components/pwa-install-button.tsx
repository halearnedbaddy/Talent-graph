'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Download, Share, MoreVertical, PlusSquare, Chrome } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function InstructionsDialog({
  open,
  onClose,
  platform,
}: {
  open: boolean;
  onClose: () => void;
  platform: 'ios' | 'android' | 'desktop';
}) {
  const steps: { icon: React.ReactNode; text: string }[] =
    platform === 'ios'
      ? [
          { icon: <Share className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Tap the Share button at the bottom of Safari (the box with an arrow).' },
          { icon: <PlusSquare className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Scroll down and tap "Add to Home Screen".' },
          { icon: <Download className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Tap "Add" in the top-right corner to install.' },
        ]
      : platform === 'android'
      ? [
          { icon: <MoreVertical className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Tap the three-dot menu (⋮) in the top-right of your browser.' },
          { icon: <Download className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Tap "Add to Home screen" or "Install app".' },
          { icon: <PlusSquare className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Confirm by tapping "Add" or "Install".' },
        ]
      : [
          { icon: <Chrome className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Open this page in Google Chrome or Microsoft Edge.' },
          { icon: <MoreVertical className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Click the install icon (⊕) in the address bar, or open the browser menu.' },
          { icon: <Download className="h-5 w-5 text-blue-400 shrink-0" />, text: 'Click "Install Talent Graph" and confirm.' },
        ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Install Talent Graph
          </DialogTitle>
          <DialogDescription>
            {platform === 'ios'
              ? 'Follow these steps in Safari to add Talent Graph to your home screen.'
              : platform === 'android'
              ? 'Follow these steps to install Talent Graph on your Android device.'
              : 'Follow these steps to install Talent Graph on your desktop.'}
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 mt-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-black shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex items-start gap-2">
                {step.icon}
                <span className="text-sm text-muted-foreground leading-relaxed">{step.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

export function PWAInstallButton({ className, size = 'lg' }: { className?: string; size?: 'default' | 'sm' | 'lg' | 'icon' | null }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setPlatform(detectPlatform());

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (!mounted || isInstalled) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowDialog(true);
    }
  };

  return (
    <>
      <Button onClick={handleClick} size={size} className={className}>
        <Download className="mr-2 h-5 w-5" />
        Install App
      </Button>
      <InstructionsDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        platform={platform}
      />
    </>
  );
}
