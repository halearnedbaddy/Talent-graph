import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { cn } from '@/lib/utils';
import { PWARegister } from '@/components/pwa-register';
import Script from 'next/script';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'Talent Graph',
  description:
    'Your professional identity in sports. Verified data, structured profiles, and long-term performance tracking.',
  verification: {
    google: 'd90b589de29c6d38',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Talent Graph',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#000000',
    'msapplication-TileImage': '/icons/icon-144x144.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/*
          Suppress Firebase SDK internal assertion errors from Next.js dev overlay.
          Firebase throws "INTERNAL ASSERTION FAILED (ID: ca9)" on stream resets —
          a recoverable connection glitch. This inline script runs FIRST in the
          <head>, before Next.js registers its own error listeners, so our
          capture-phase handler wins the registration race.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var P=['INTERNAL ASSERTION FAILED','ID: ca9','FIRESTORE_INTERNAL'];function m(s){return P.some(function(p){return String(s).indexOf(p)!=-1;});}var e=console.error.bind(console);console.error=function(){var s=Array.prototype.join.call(arguments,' ');if(m(s)){console.warn('[TG] Firebase assertion (suppressed):',s.slice(0,120));return;}e.apply(console,arguments);};window.addEventListener('error',function(ev){if(m(ev.message)){ev.stopImmediatePropagation();ev.preventDefault();}},true);window.addEventListener('unhandledrejection',function(ev){var s=(ev.reason&&ev.reason.message)||String(ev.reason||'');if(m(s))ev.preventDefault();});})();` }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Talent Graph" />
        <meta name="application-name" content="Talent Graph" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
      </head>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-DH7JN1PKKJ"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-DH7JN1PKKJ');
        `}
      </Script>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <FirebaseClientProvider>
          <PWARegister />
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
