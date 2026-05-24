'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, addDoc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, CreditCard, Calendar, CheckCircle2, Clock, TrendingUp,
  Zap, Shield, Star, ChevronRight, Receipt, Phone, RefreshCw, AlertTriangle
} from 'lucide-react';
import type { ClubMember, ClubProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, parseISO, addMonths, format } from 'date-fns';

interface BillingRecord {
  id: string;
  clubId: string;
  amount: number;
  currency: 'KES';
  description: string;
  status: 'paid' | 'pending' | 'failed';
  paymentMethod: 'mpesa' | 'card' | 'bank';
  mpesaNumber?: string;
  transactionRef?: string;
  paidAt?: string;
  createdAt: string;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    priceKes: 2500,
    period: '/month',
    description: 'For small clubs getting started',
    features: [
      'Up to 25 athletes',
      'Basic scout requests',
      'Match data entry',
      'Squad chat',
      '1 coach account',
    ],
    color: 'border-border',
    badge: null,
  },
  {
    id: 'pro',
    name: 'Club Pro',
    priceKes: 6500,
    period: '/month',
    description: 'For serious clubs competing at NSL level',
    features: [
      'Unlimited athletes',
      'Advanced analytics',
      'Priority scout discovery',
      'Live match tracking',
      'Up to 5 staff accounts',
      'Performance reports',
      'API data access',
    ],
    color: 'border-primary',
    badge: 'Most Popular',
  },
  {
    id: 'elite',
    name: 'Elite',
    priceKes: 15000,
    period: '/month',
    description: 'For KPL clubs and professional academies',
    features: [
      'Everything in Club Pro',
      'International scout visibility',
      'Transfer facilitation',
      'FKF data submission',
      'Unlimited staff accounts',
      'Dedicated support',
      'Custom branding',
    ],
    color: 'border-amber-400',
    badge: 'Elite',
  },
];

export default function BillingPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [clubId, setClubId] = useState<string | null>(null);
  const [mpesaNumber, setMpesaNumber] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const myMembershipQuery = useMemoFirebase(() => (
    firestore && user ? query(collection(firestore, 'club_members'), where('userId', '==', user.uid), where('status', '==', 'active')) : null
  ), [firestore, user]);
  const { data: myMemberships } = useCollection<ClubMember>(myMembershipQuery);

  useEffect(() => {
    if (myMemberships?.[0]?.clubId) setClubId(myMemberships[0].clubId);
  }, [myMemberships]);

  const clubRef = useMemoFirebase(() => (firestore && clubId ? doc(firestore, 'clubs', clubId) : null), [firestore, clubId]);
  const { data: club } = useDoc<ClubProfile & { plan?: string; planActivatedAt?: string; billingPhone?: string }>(clubRef);

  const billingQuery = useMemoFirebase(() => (
    firestore && clubId ? query(collection(firestore, 'billing'), where('clubId', '==', clubId)) : null
  ), [firestore, clubId]);
  const { data: billingHistory } = useCollection<BillingRecord>(billingQuery);

  const sortedBilling = [...(billingHistory || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const currentPlan = PLANS.find(p => p.id === ((club as any)?.plan || 'starter')) || PLANS[0];
  const nextBillingDate = (club as any)?.planActivatedAt
    ? addMonths(parseISO((club as any).planActivatedAt), 1)
    : new Date();

  useEffect(() => {
    if ((club as any)?.billingPhone) setMpesaNumber((club as any).billingPhone);
  }, [club]);

  const handleRequestPayment = async (planId: string) => {
    if (!mpesaNumber || mpesaNumber.length < 10) {
      toast({ variant: 'destructive', title: 'Invalid number', description: 'Please enter a valid M-Pesa number.' });
      return;
    }
    if (!firestore || !clubId) return;
    setIsSending(true);
    const plan = PLANS.find(p => p.id === planId);
    if (!plan) return;
    try {
      await addDoc(collection(firestore, 'billing'), {
        clubId,
        amount: plan.priceKes,
        currency: 'KES',
        description: `${plan.name} Plan - Monthly Subscription`,
        status: 'pending',
        paymentMethod: 'mpesa',
        mpesaNumber,
        createdAt: new Date().toISOString(),
      });
      await updateDoc(doc(firestore, 'clubs', clubId), {
        billingPhone: mpesaNumber,
        plan: planId,
        planActivatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: 'Payment request sent!',
        description: `An M-Pesa STK push of KES ${plan.priceKes.toLocaleString()} has been sent to ${mpesaNumber}. Check your phone to complete payment.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to initiate payment. Please try again.' });
    } finally {
      setIsSending(false);
      setSelectedPlan(null);
    }
  };

  if (!clubId) return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-black tracking-tight uppercase">Billing &amp; Subscription</h1>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Manage your club's subscription and payment history
        </p>
      </div>

      {/* Current Plan */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-primary/5 border-b py-4 px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-black uppercase tracking-widest">{currentPlan.name}</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-wide">Current Plan</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary">KES {currentPlan.priceKes.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">/month</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</p>
                <p className="font-black text-sm text-green-600">Active</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next Billing</p>
                <p className="font-black text-sm">{format(nextBillingDate, 'dd MMM yyyy')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
              <Phone className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">M-Pesa Number</p>
                <p className="font-black text-sm">{(club as any)?.billingPhone || 'Not set'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* M-Pesa Number */}
      <Card className="border-none shadow-sm bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" /> M-Pesa Number
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Registered M-Pesa Number</Label>
              <Input
                value={mpesaNumber}
                onChange={e => setMpesaNumber(e.target.value)}
                placeholder="+254 7XX XXX XXX"
                type="tel"
                className="h-11 font-bold"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">All subscription payments and trial unlock fees will be billed to this number via M-Pesa STK Push.</p>
        </CardContent>
      </Card>

      {/* Plans */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Available Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isCurrent = plan.id === ((club as any)?.plan || 'starter');
            return (
              <Card
                key={plan.id}
                className={`border-2 ${plan.color} bg-background overflow-hidden transition-all ${selectedPlan === plan.id ? 'ring-2 ring-primary' : ''}`}
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <CardTitle className="text-base font-black uppercase tracking-widest">{plan.name}</CardTitle>
                    {plan.badge && (
                      <Badge className={plan.badge === 'Elite' ? 'bg-amber-400 text-black font-black text-[9px]' : 'bg-primary text-primary-foreground font-black text-[9px]'}>
                        {plan.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-bold">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black">KES {plan.priceKes.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">/month</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <ul className="space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-[11px] font-bold">
                        <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Badge className="w-full justify-center font-black uppercase tracking-widest h-9 bg-green-500/10 text-green-600 border-green-200 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Current Plan
                    </Badge>
                  ) : selectedPlan === plan.id ? (
                    <div className="space-y-2">
                      <Button
                        className="w-full font-black uppercase tracking-widest h-11 gap-2"
                        onClick={() => handleRequestPayment(plan.id)}
                        disabled={isSending}
                      >
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                        Pay via M-Pesa
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full font-bold h-9 text-xs"
                        onClick={() => setSelectedPlan(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full font-black uppercase tracking-widest h-10 gap-2 text-xs"
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {isCurrent ? 'Renew' : plan.priceKes > currentPlan.priceKes ? 'Upgrade' : 'Downgrade'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Payment History */}
      <Card className="border-none shadow-xl bg-background overflow-hidden">
        <CardHeader className="bg-muted/50 border-b py-3 px-4">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Payment History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedBilling.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-black text-muted-foreground uppercase tracking-widest text-sm">No payments yet</p>
              <p className="text-xs text-muted-foreground mt-1">Your billing history will appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedBilling.map(record => (
                <div key={record.id} className="flex items-center justify-between p-4 gap-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      record.status === 'paid' ? 'bg-green-500/10' :
                        record.status === 'pending' ? 'bg-amber-500/10' : 'bg-red-500/10'
                    }`}>
                      {record.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                        record.status === 'pending' ? <Clock className="h-4 w-4 text-amber-600" /> :
                          <AlertTriangle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-sm truncate">{record.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {formatDistanceToNow(parseISO(record.createdAt), { addSuffix: true })}
                        </span>
                        {record.mpesaNumber && (
                          <span className="text-[9px] font-bold text-muted-foreground">· {record.mpesaNumber}</span>
                        )}
                        {record.transactionRef && (
                          <span className="text-[9px] font-bold text-muted-foreground">· {record.transactionRef}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-sm">KES {record.amount.toLocaleString()}</p>
                    <Badge className={`font-black text-[9px] border mt-0.5 ${
                      record.status === 'paid' ? 'bg-green-500/10 text-green-600 border-green-200' :
                        record.status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                          'bg-red-500/10 text-red-600 border-red-200'
                    }`}>
                      {record.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/40 border">
        <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black">Secure Payments via M-Pesa</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">All payments are processed securely via Safaricom M-Pesa. You will receive an STK Push on your phone to confirm payment. Contact support at support@talentgraph.co.ke for billing queries.</p>
        </div>
      </div>
    </div>
  );
}
