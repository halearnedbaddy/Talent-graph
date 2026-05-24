'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Twitter, Linkedin, Instagram, Mail, Phone, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to send message');
      }

      toast({
        title: 'Message sent!',
        description: "We'll get back to you as soon as possible.",
      });
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      toast({
        title: 'Something went wrong',
        description: err?.message || 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <footer className="bg-secondary text-secondary-foreground">
      {/* Contact Us Section */}
      <div className="border-b border-border/40">
        <div className="container mx-auto py-12 px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Contact Info */}
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Contact Us</h3>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  Get in touch with the Talent Graph team
                </p>
              </div>
              <div className="space-y-3">
                <a
                  href="mailto:billionaireomenda@gmail.com"
                  className="flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Mail className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Email</p>
                    <p className="text-sm font-bold group-hover:text-primary transition-colors">billionaireomenda@gmail.com</p>
                  </div>
                </a>
                <a
                  href="tel:+254727946012"
                  className="flex items-center gap-3 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Phone</p>
                    <p className="text-sm font-bold group-hover:text-primary transition-colors">+254 727 946 012</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Inquiry Form */}
            <div>
              <form onSubmit={handleContactSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      id="contact-name"
                      placeholder="Your name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="h-10 bg-background/50 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      className="h-10 bg-background/50 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    Message
                  </Label>
                  <Textarea
                    id="contact-message"
                    placeholder="How can we help you?"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    required
                    rows={3}
                    className="bg-background/50 text-sm resize-none"
                    disabled={isSubmitting}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || !name.trim() || !email.trim() || !message.trim()}
                  className="w-full h-10 font-black uppercase tracking-widest text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container mx-auto py-6 px-4 md:px-6">
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
            <Link href="https://twitter.com/verve.vigor.fitness" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <Twitter className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
            <Link href="https://www.linkedin.com/company/verve-vigor/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <Linkedin className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
            <Link href="https://instagram.com/_verve_vigor" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram className="h-5 w-5 hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
