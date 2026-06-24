'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Search, Users, ShieldOff, ShieldCheck, RefreshCw,
  UserCog, ExternalLink, Calendar, Mail, Fingerprint, Activity,
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { UserAccount } from '@/lib/types';

type Role = 'athlete' | 'scout' | 'coach' | 'club' | 'admin' | 'analyst';

const ROLE_OPTIONS: { value: Role | 'all'; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'athlete', label: 'Athletes' },
  { value: 'scout', label: 'Scouts' },
  { value: 'coach', label: 'Coaches' },
  { value: 'club', label: 'Clubs' },
  { value: 'analyst', label: 'Analysts' },
  { value: 'admin', label: 'Admins' },
];

const ROLE_COLORS: Record<string, string> = {
  athlete: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  scout: 'bg-blue-100 text-blue-800 border-blue-200',
  coach: 'bg-amber-100 text-amber-800 border-amber-200',
  club: 'bg-purple-100 text-purple-800 border-purple-200',
  analyst: 'bg-pink-100 text-pink-800 border-pink-200',
  admin: 'bg-red-100 text-red-800 border-red-200',
};

interface ExtendedUser extends UserAccount {
  suspended?: boolean;
}

function fmtDate(ts?: string) {
  if (!ts) return '—';
  try {
    const d = parseISO(ts);
    return isValid(d) ? format(d, 'dd MMM yyyy') : '—';
  } catch {
    return '—';
  }
}

function RoleBadge({ role }: { role?: string }) {
  if (!role) return <Badge variant="outline" className="text-[10px]">—</Badge>;
  return (
    <Badge variant="outline" className={`text-[10px] font-black uppercase tracking-widest ${ROLE_COLORS[role] ?? ''}`}>
      {role}
    </Badge>
  );
}

export function UserManager() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<ExtendedUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ExtendedUser | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Role | ''>('');

  const usersQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'users'), orderBy('creationTimestamp', 'desc')) : null,
    [firestore]
  );
  const { data: users, isLoading } = useCollection<ExtendedUser>(usersQuery);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter(u => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter;
      const term = search.toLowerCase();
      const matchesSearch = !term
        || `${u.firstName} ${u.lastName}`.toLowerCase().includes(term)
        || (u.email ?? '').toLowerCase().includes(term)
        || (u.id ?? '').toLowerCase().includes(term);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => {
    if (!users) return {};
    return users.reduce<Record<string, number>>((acc, u) => {
      const r = u.role ?? 'unknown';
      acc[r] = (acc[r] ?? 0) + 1;
      return acc;
    }, {});
  }, [users]);

  const handleToggleSuspend = async () => {
    if (!firestore || !suspendTarget) return;
    setProcessingId(suspendTarget.id);
    try {
      const next = !suspendTarget.suspended;
      await updateDoc(doc(firestore, 'users', suspendTarget.id), { suspended: next });
      toast({
        title: next ? 'Account suspended' : 'Account reinstated',
        description: `${suspendTarget.firstName} ${suspendTarget.lastName}'s account has been ${next ? 'suspended' : 'reinstated'}.`,
      });
      if (selectedUser?.id === suspendTarget.id) {
        setSelectedUser(prev => prev ? { ...prev, suspended: next } : null);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update account status.' });
    } finally {
      setProcessingId(null);
      setSuspendTarget(null);
    }
  };

  const handleChangeRole = async () => {
    if (!firestore || !selectedUser || !newRole) return;
    setProcessingId(selectedUser.id);
    try {
      await updateDoc(doc(firestore, 'users', selectedUser.id), { role: newRole });
      toast({
        title: 'Role updated',
        description: `${selectedUser.firstName} ${selectedUser.lastName} is now a ${newRole}.`,
      });
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
      setNewRole('');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update role.' });
    } finally {
      setProcessingId(null);
    }
  };

  const profilePath = (u: ExtendedUser) => {
    if (u.role === 'athlete') return `/athletes/${u.id}`;
    if (u.role === 'scout') return `/scouts/${u.id}`;
    if (u.role === 'club') return `/clubs/${u.id}`;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      {users && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {(['athlete', 'scout', 'coach', 'club', 'analyst', 'admin'] as Role[]).map(r => (
            <button
              key={r}
              onClick={() => setRoleFilter(prev => prev === r ? 'all' : r)}
              className={`rounded-xl border p-3 text-left transition-all hover:shadow-sm focus:outline-none ${
                roleFilter === r ? 'ring-2 ring-primary border-primary' : 'bg-background'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{r}</p>
              <p className="text-2xl font-black mt-0.5">{stats[r] ?? 0}</p>
            </button>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Users className="w-4 h-4" />
                User Accounts
              </CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? 'Loading…' : `${filtered.length} of ${users?.length ?? 0} users`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, email, UID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-52"
                />
              </div>
              <Select value={roleFilter} onValueChange={v => setRoleFilter(v as Role | 'all')}>
                <SelectTrigger className="h-8 text-sm w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No users match your filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Email</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Role</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Joined</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-sm">
                        {u.firstName} {u.lastName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email ?? '—'}</TableCell>
                      <TableCell><RoleBadge role={u.role} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(u.creationTimestamp)}</TableCell>
                      <TableCell>
                        {u.suspended ? (
                          <Badge variant="destructive" className="text-[10px] font-black uppercase tracking-widest">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest text-emerald-700 border-emerald-200 bg-emerald-50">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => { setSelectedUser(u); setNewRole(''); }}
                          >
                            <UserCog className="w-3.5 h-3.5 mr-1" /> Manage
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 text-xs ${u.suspended ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'}`}
                            onClick={() => setSuspendTarget(u)}
                            disabled={processingId === u.id}
                          >
                            {processingId === u.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : u.suspended
                                ? <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Reinstate</>
                                : <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Suspend</>
                            }
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-lg">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-black">
                  {selectedUser.firstName} {selectedUser.lastName}
                  {selectedUser.suspended && (
                    <Badge variant="destructive" className="text-[9px] font-black uppercase tracking-widest ml-1">
                      Suspended
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  User account details and management actions
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</span>
                    </div>
                    <p className="text-sm font-medium break-all">{selectedUser.email ?? '—'}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <UserCog className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Role</span>
                    </div>
                    <RoleBadge role={selectedUser.role} />
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Joined</span>
                    </div>
                    <p className="text-sm font-medium">{fmtDate(selectedUser.creationTimestamp)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Profile</span>
                    </div>
                    <p className="text-sm font-medium">{selectedUser.profileCompleted ? 'Complete' : 'Incomplete'}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 col-span-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Fingerprint className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">UID</span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground break-all">{selectedUser.id}</p>
                  </div>
                </div>

                {selectedUser.loginHistory && selectedUser.loginHistory.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Last 3 Logins</p>
                    <div className="space-y-1">
                      {selectedUser.loginHistory.slice(-3).reverse().map((ts, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{fmtDate(ts)}</p>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Change role */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Change Role</p>
                  <div className="flex gap-2">
                    <Select value={newRole} onValueChange={v => setNewRole(v as Role)}>
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Select new role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(['athlete', 'scout', 'coach', 'club', 'analyst', 'admin'] as Role[])
                          .filter(r => r !== selectedUser.role)
                          .map(r => (
                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8"
                      disabled={!newRole || processingId === selectedUser.id}
                      onClick={handleChangeRole}
                    >
                      {processingId === selectedUser.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Apply</>
                      }
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="flex-row gap-2 sm:justify-between">
                {profilePath(selectedUser) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => window.open(profilePath(selectedUser)!, '_blank')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Profile
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={selectedUser.suspended ? 'default' : 'destructive'}
                  className="h-8 text-xs ml-auto"
                  onClick={() => { setSuspendTarget(selectedUser); setSelectedUser(null); }}
                  disabled={processingId === selectedUser.id}
                >
                  {selectedUser.suspended
                    ? <><ShieldCheck className="w-3.5 h-3.5 mr-1" /> Reinstate Account</>
                    : <><ShieldOff className="w-3.5 h-3.5 mr-1" /> Suspend Account</>
                  }
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend confirmation */}
      <AlertDialog open={!!suspendTarget} onOpenChange={open => { if (!open) setSuspendTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {suspendTarget?.suspended ? 'Reinstate account?' : 'Suspend account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {suspendTarget?.suspended
                ? `This will reinstate ${suspendTarget?.firstName} ${suspendTarget?.lastName}'s account. They will regain full platform access.`
                : `This will suspend ${suspendTarget?.firstName} ${suspendTarget?.lastName}'s account. Their profile will be hidden and they will not be able to log in.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleSuspend}
              className={suspendTarget?.suspended ? '' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}
            >
              {suspendTarget?.suspended ? 'Yes, Reinstate' : 'Yes, Suspend'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
