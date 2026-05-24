'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  UserPlus, Loader2, Copy, CheckCheck, Eye, EyeOff, AlertCircle, ShieldCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ROLES = [
  { value: 'coach', label: 'Head Coach' },
  { value: 'assistant_coach', label: 'Assistant Coach' },
  { value: 'analyst', label: 'Performance Analyst' },
  { value: 'gk_coach', label: 'GK Coach' },
  { value: 'scout', label: 'Scout' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
}

interface CreatedStaff {
  email: string;
  displayName: string;
  role: string;
  tempPassword: string;
  uid: string;
}

export function AddStaffDirectDialog({ open, onClose, clubId, clubName }: Props) {
  const { user } = useUser();
  const { toast } = useToast();

  const [form, setForm] = useState({ displayName: '', email: '', role: '', phone: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedStaff | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<'email' | 'password' | 'all' | null>(null);

  const handleClose = () => {
    setForm({ displayName: '', email: '', role: '', phone: '' });
    setError('');
    setCreated(null);
    setShowPassword(false);
    setCopied(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!user || !form.displayName.trim() || !form.email.trim() || !form.role) {
      setError('Please fill in full name, email, and role.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          role: form.role,
          clubId,
          clubName,
          phone: form.phone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create account.');
        return;
      }
      setCreated(data);
      toast({ title: 'Staff account created', description: `${data.displayName} can now log in.` });
    } catch (e: any) {
      setError(e.message || 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, key: 'email' | 'password' | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };

  const copyAll = () => {
    if (!created) return;
    const text = `Talent Graph Kenya — Login Credentials\n\nName: ${created.displayName}\nEmail: ${created.email}\nTemporary Password: ${created.tempPassword}\n\nPlease log in at https://talentgraphkenya.com and change your password after signing in.`;
    copyToClipboard(text, 'all');
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight text-base">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Staff Directly
          </DialogTitle>
          <DialogDescription className="text-xs">
            Create a login account for a new staff member. They can sign in immediately — no self-registration needed.
          </DialogDescription>
        </DialogHeader>

        {!created ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name *</Label>
              <Input
                placeholder="e.g. James Oduya"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                className="font-bold"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address *</Label>
              <Input
                type="email"
                placeholder="e.g. james@club.co.ke"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="font-bold"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))} disabled={isLoading}>
                <SelectTrigger className="font-bold">
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value} className="font-bold">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone (optional)</Label>
              <Input
                type="tel"
                placeholder="e.g. +254 712 345 678"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="font-bold"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive font-bold">{error}</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={handleClose} disabled={isLoading} className="flex-1 font-bold">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isLoading || !form.displayName.trim() || !form.email.trim() || !form.role}
                className="flex-1 font-black bg-primary hover:bg-primary/90 gap-2"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 rounded-xl border border-green-400/30 bg-green-500/5 p-4">
              <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-green-700 dark:text-green-400 text-sm">Account Created!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {created.displayName} can log in immediately with these credentials.
                </p>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 divide-y overflow-hidden">
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Name</p>
                  <p className="font-black text-sm truncate">{created.displayName}</p>
                </div>
                <Badge className="font-black text-[9px] shrink-0">
                  {ROLES.find(r => r.value === created.role)?.label ?? created.role}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Email</p>
                  <p className="font-bold text-sm truncate">{created.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => copyToClipboard(created.email, 'email')}
                >
                  {copied === 'email' ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Temporary Password</p>
                  <p className="font-black text-sm font-mono tracking-wider">
                    {showPassword ? created.tempPassword : '••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPassword(s => !s)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(created.tempPassword, 'password')}
                  >
                    {copied === 'password' ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground font-bold">
              Share these credentials securely with {created.displayName.split(' ')[0]}. They should change their password after first login.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={copyAll}
                className="flex-1 font-bold gap-2 text-xs"
              >
                {copied === 'all' ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy All Credentials
              </Button>
              <Button
                onClick={handleClose}
                className="flex-1 font-black gap-2 text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
