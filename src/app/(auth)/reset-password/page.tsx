'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Zap, Eye, EyeOff, CheckCircle2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

function PasswordStrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-[#00C853]'];
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score - 1] : 'bg-[#1E293B]'}`} />
        ))}
      </div>
      <p className={`text-[10px] font-bold ${score < 2 ? 'text-red-400' : score < 4 ? 'text-yellow-400' : 'text-[#00C853]'}`}>
        {labels[score - 1] ?? 'Too short'}
      </p>
    </div>
  );
}

function ResetPasswordForm() {
  const auth = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const oobCode = searchParams.get('oobCode');

  const [verifying, setVerifying] = useState(true);
  const [codeValid, setCodeValid] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!oobCode || !auth) { setVerifying(false); return; }
    verifyPasswordResetCode(auth, oobCode)
      .then(email => { setEmail(email); setCodeValid(true); })
      .catch(() => setCodeValid(false))
      .finally(() => setVerifying(false));
  }, [oobCode, auth]);

  const handleReset = async () => {
    if (!oobCode || !auth) return;
    if (password.length < 8) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Minimum 8 characters required.' });
      return;
    }
    if (password !== confirm) {
      toast({ variant: 'destructive', title: 'Passwords do not match', description: 'Please make sure both fields match.' });
      return;
    }
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      if (err?.code === 'auth/expired-action-code') {
        toast({ variant: 'destructive', title: 'Link expired', description: 'This reset link has expired. Please request a new one.' });
      } else {
        toast({ variant: 'destructive', title: 'Reset failed', description: 'Invalid or expired link. Please request a new reset link.' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-[#00C853]" />
        <p className="text-[#94A3B8] text-sm">Verifying reset link…</p>
      </div>
    );
  }

  if (!oobCode || !codeValid) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15">
          <ShieldCheck className="h-7 w-7 text-red-400" />
        </div>
        <p className="text-white font-black text-lg">Link invalid or expired</p>
        <p className="text-[#94A3B8] text-sm max-w-xs">
          This password reset link is no longer valid. Reset links expire after 1 hour.
        </p>
        <Button asChild className="mt-2 bg-[#00C853] hover:bg-[#00E676] text-black font-black">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00C853]/15">
          <CheckCircle2 className="h-7 w-7 text-[#00C853]" />
        </div>
        <p className="text-white font-black text-lg">Password updated!</p>
        <p className="text-[#94A3B8] text-sm">Redirecting you to sign in…</p>
        <Button asChild className="mt-2 bg-[#00C853] hover:bg-[#00E676] text-black font-black">
          <Link href="/login">Go to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {email && (
        <div className="rounded-xl bg-[#1C2333] border border-[#1E293B] px-4 py-3">
          <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest mb-0.5">Resetting password for</p>
          <p className="text-sm font-bold text-white">{email}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">New Password</label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="bg-[#1C2333] border-[#1E293B] text-white h-11 pr-10 focus:border-[#00C853]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrengthBar password={password} />
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-black text-[#94A3B8] uppercase tracking-widest">Confirm Password</label>
        <Input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat your new password"
          className="bg-[#1C2333] border-[#1E293B] text-white h-11 focus:border-[#00C853]"
        />
        {confirm && password !== confirm && (
          <p className="text-[10px] text-red-400 font-bold">Passwords do not match</p>
        )}
      </div>

      <Button
        onClick={handleReset}
        disabled={saving || password.length < 8 || password !== confirm}
        className="w-full bg-[#00C853] hover:bg-[#00E676] text-black font-black h-12 rounded-xl uppercase tracking-wider"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set New Password'}
      </Button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4">
      <div className="absolute top-4 left-4">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-[#00C853]" />
          <span className="text-[15px] font-black text-white">Talent Graph</span>
        </Link>
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Set New Password</h1>
          <p className="text-[#94A3B8] text-sm">Choose a strong password to secure your account</p>
        </div>
        <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-6">
          <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[#00C853]" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
        <p className="text-center text-[#94A3B8] text-sm">
          Remember your password?{' '}
          <Link href="/login" className="text-[#00C853] font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
