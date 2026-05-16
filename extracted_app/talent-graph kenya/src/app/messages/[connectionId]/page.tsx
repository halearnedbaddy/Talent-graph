'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { ScoutConnection, Message, AthleteProfile, ScoutProfile } from '@/lib/types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Loader2, Send, ShieldAlert, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

function getInitials(name: string) {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

export default function MessagingPage() {
    const params = useParams();
    const router = useRouter();
    const connectionId = params.connectionId as string;
    const { user: authUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const [newMessage, setNewMessage] = useState('');
    const [reportReason, setReportReason] = useState('');
    const [isReporting, setIsReporting] = useState(false);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

    const connectionDocRef = useMemoFirebase(() => (firestore && connectionId ? doc(firestore, 'scout_connections', connectionId) : null), [firestore, connectionId]);
    const { data: connection, isLoading: isConnectionLoading } = useDoc<ScoutConnection>(connectionDocRef);

    const otherUserId = useMemo(() => {
        if (!connection || !authUser) return null;
        return authUser.uid === connection.athleteId ? connection.scoutId : connection.athleteId;
    }, [connection, authUser]);

    const otherUserRole = useMemo(() => {
        if (!connection || !authUser) return null;
        return authUser.uid === connection.athleteId ? 'scout' : 'athlete';
    }, [connection, authUser]);

    const otherUserDocRef = useMemoFirebase(() => {
        if (firestore && otherUserId && otherUserRole) {
            return doc(firestore, otherUserRole === 'scout' ? 'scouts' : 'athletes', otherUserId);
        }
        return null;
    }, [firestore, otherUserId, otherUserRole]);

    const { data: otherUserProfile, isLoading: isOtherUserProfileLoading } = useDoc<AthleteProfile | ScoutProfile>(otherUserDocRef);

    const messagesQuery = useMemoFirebase(() => (firestore && connectionId ? query(collection(firestore, 'scout_connections', connectionId, 'messages'), orderBy('timestamp', 'asc')) : null), [firestore, connectionId]);
    const { data: messages, isLoading: areMessagesLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !authUser || !connectionId || newMessage.trim() === '' || connection?.isReported) return;

        const messagesColRef = collection(firestore, 'scout_connections', connectionId, 'messages');
        addDocumentNonBlocking(messagesColRef, {
            senderId: authUser.uid,
            content: newMessage,
            timestamp: new Date().toISOString(),
        });
        setNewMessage('');
    };

    const handleReport = async () => {
        if (!firestore || !authUser || !connectionId || !reportReason.trim()) return;
        setIsReporting(true);

        try {
            const connRef = doc(firestore, 'scout_connections', connectionId);
            updateDocumentNonBlocking(connRef, {
                isReported: true,
                reportReason: reportReason,
                reportedBy: authUser.uid,
                reportedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            toast({
                title: 'Report Submitted',
                description: 'The conversation has been disabled. Our safety team will review this report.',
                variant: 'destructive',
            });
            setIsReportDialogOpen(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Could not submit report. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsReporting(false);
        }
    };

    const isLoading = isUserLoading || isConnectionLoading || isOtherUserProfileLoading || areMessagesLoading;
    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    if (!connection) {
        return (
             <div className="flex h-screen items-center justify-center text-center">
                <p>Connection not found.</p>
                <Button variant="link" onClick={() => router.back()}>Go Back</Button>
             </div>
        );
    }

    // Security check
    if (!authUser || (authUser.uid !== connection.athleteId && authUser.uid !== connection.scoutId)) {
         return (
             <div className="flex h-screen items-center justify-center text-center">
                <p>You do not have permission to view this conversation.</p>
                <Button variant="link" onClick={() => router.back()}>Go Back</Button>
             </div>
        );
    }
    
    const otherUserName = otherUserProfile ? ('name' in otherUserProfile ? otherUserProfile.name : `${otherUserProfile.firstName} ${otherUserProfile.lastName}`) : 'User';

    return (
        <div className="flex flex-col h-screen bg-muted/40">
            <header className="bg-background border-b sticky top-0 z-30 flex-shrink-0">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                <ArrowLeft />
                            </Button>
                            <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${otherUserName}`} />
                                    <AvatarFallback>{getInitials(otherUserName)}</AvatarFallback>
                                </Avatar>
                                <span className="font-semibold">{otherUserName}</span>
                            </div>
                        </div>
                        
                        {!connection.isReported && (
                            <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                                        <ShieldAlert className="w-4 h-4 mr-2" />
                                        Report
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <div className="flex items-center gap-2 text-destructive mb-2">
                                            <AlertTriangle className="w-5 h-5" />
                                            <DialogTitle>Report Misconduct</DialogTitle>
                                        </div>
                                        <DialogDescription>
                                            Please describe the gross misconduct or inappropriate behavior. Submitting this report will permanently disable messaging for this connection.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <Textarea 
                                            placeholder="Enter reason for report..."
                                            value={reportReason}
                                            onChange={(e) => setReportReason(e.target.value)}
                                            className="min-h-[120px]"
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button>
                                        <Button 
                                            variant="destructive" 
                                            onClick={handleReport}
                                            disabled={isReporting || !reportReason.trim()}
                                        >
                                            {isReporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            Submit Report & Disable Chat
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 p-4 sm:p-6" ref={scrollAreaRef as any}>
                    <div className="space-y-4">
                        {messages?.map((message: any) => (
                            <div key={message.id} className={cn('flex items-end gap-2', message.senderId === authUser.uid ? 'justify-end' : 'justify-start')}>
                                {message.senderId !== authUser.uid && (
                                    <Avatar className="h-8 w-8">
                                         <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${otherUserName}`} />
                                         <AvatarFallback>{getInitials(otherUserName)}</AvatarFallback>
                                    </Avatar>
                                )}
                                <div className={cn('max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2', message.senderId === authUser.uid ? 'bg-primary text-primary-foreground' : 'bg-background border')}>
                                    <p className="text-sm">{message.content}</p>
                                    <p className={cn('text-xs mt-1', message.senderId === authUser.uid ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                                        {format(new Date(message.timestamp), 'p')}
                                    </p>
                                </div>
                                {message.senderId === authUser.uid && (
                                     <Avatar className="h-8 w-8">
                                         <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${authUser.displayName}`} />
                                         <AvatarFallback>{getInitials(authUser.displayName || '')}</AvatarFallback>
                                     </Avatar>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                
                <div className="bg-background border-t p-4 flex-shrink-0">
                    {connection.isReported ? (
                        <div className="flex items-center justify-center gap-2 text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/20 text-sm font-medium">
                            <ShieldAlert className="w-4 h-4" />
                            This conversation has been disabled due to a misconduct report.
                        </div>
                    ) : (
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                            <Input
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                autoComplete="off"
                            />
                            <Button type="submit" size="icon" disabled={newMessage.trim() === ''}>
                                <Send />
                                <span className="sr-only">Send</span>
                            </Button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}