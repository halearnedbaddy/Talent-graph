'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Twitter, Linkedin, Instagram } from 'lucide-react';

export function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <Link href="/" className="flex items-center gap-2" prefetch={false}>
            <Zap className="h-6 w-6" />
            <span className="text-lg font-semibold">Talent Graph</span>
          </Link>
          <div className="flex items-center gap-x-6 text-sm text-muted-foreground">
             <p className="text-center md:text-left">&copy; {currentYear || '2025'} Talent Graph. All rights reserved.</p>
             <nav className="flex gap-4">
                <Link href="/terms-of-use" className="hover:text-primary transition-colors">Terms</Link>
                <Link href="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
                <Link href="/help" className="hover:text-primary transition-colors">Help</Link>
                <Link href="/jobs" className="hover:text-primary transition-colors">Jobs</Link>
             </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link 
              href="https://twitter.com/verve.vigor.fitness" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
            <Link 
              href="https://www.linkedin.com/company/verve-vigor/" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
            <Link 
              href="https://instagram.com/_verve_vigor" 
              target="_blank" 
              rel="noopener noreferrer" 
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
