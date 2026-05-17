'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS() || isInStandaloneMode()) return;
    const t = setTimeout(() => setShow(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] flex items-center gap-3 bg-neutral-950 text-white px-4 py-3 shadow-2xl border-t border-white/10 animate-in slide-in-from-bottom-2 duration-300">
      <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
        <Download className="w-4 h-4 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-tight">Install Talent Graph</p>
        <p className="text-[11px] text-white/60 mt-0.5 leading-tight">
          Tap <Share2 className="inline w-3 h-3 mb-0.5" /> <strong>Share</strong> → <strong>"Add to Home Screen"</strong>
        </p>
      </div>
      <button
        onClick={() => setShow(false)}
        className="w-8 h-8 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function PWAInstallButton({
  className,
  size = 'lg',
  label = 'Install Now',
}: {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;
  label?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    if (isInStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (!mounted || isInstalled || !deferredPrompt) return null;

  const handleClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <Button onClick={handleClick} size={size} className={className}>
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
