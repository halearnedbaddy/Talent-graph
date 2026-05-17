'use client';

import { useState } from 'react';
import { useFirestore, useUser, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { ProfileComment, ProfileReaction } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Share2, Repeat2, Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function getInitials(name: string) {
  if (!name) return '?';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

interface VideoEngagementProps {
  videoId: string;
  athleteId: string;
  athleteName: string;
  viewerName?: string;
  viewerRole?: string;
}

export function VideoEngagement({ videoId, athleteId, athleteName, viewerName, viewerRole }: VideoEngagementProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [commentText, setCommentText] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const myReactionRef = useMemoFirebase(
    () =>
      firestore && user?.uid && videoId
        ? doc(firestore, 'video_reactions', `${videoId}_${user.uid}`)
        : null,
    [firestore, user?.uid, videoId]
  );
  const { data: myReaction } = useDoc<ProfileReaction>(myReactionRef);
  const liked = !!myReaction;

  const likesQuery = useMemoFirebase(
    () =>
      firestore && videoId
        ? query(collection(firestore, 'video_reactions'), where('videoId', '==', videoId))
        : null,
    [firestore, videoId]
  );
  const { data: likes } = useCollection<ProfileReaction>(likesQuery);
  const likeCount = likes?.length ?? 0;

  const commentsQuery = useMemoFirebase(
    () =>
      firestore && videoId
        ? query(
            collection(firestore, 'video_comments', videoId, 'comments'),
            orderBy('createdAt', 'desc'),
            limit(20)
          )
        : null,
    [firestore, videoId]
  );
  const { data: comments, isLoading: commentsLoading } = useCollection<ProfileComment>(commentsQuery);

  const handleLike = async () => {
    if (!user || !firestore || !myReactionRef || isLiking) return;
    setIsLiking(true);
    try {
      if (liked) {
        await deleteDoc(myReactionRef);
      } else {
        await setDoc(myReactionRef, {
          userId: user.uid,
          videoId,
          athleteId,
          likedAt: new Date().toISOString(),
        });
        if (athleteId !== user.uid) {
          await addDoc(collection(firestore, 'notifications', athleteId, 'items'), {
            type: 'like',
            actorName: viewerName || 'Someone',
            actorRole: viewerRole || 'visitor',
            message: 'liked your video',
            isRead: false,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update reaction.' });
    } finally {
      setIsLiking(false);
    }
  };

  const handleComment = async () => {
    if (!user || !firestore || !commentText.trim() || isCommenting) return;
    setIsCommenting(true);
    try {
      await addDoc(collection(firestore, 'video_comments', videoId, 'comments'), {
        authorId: user.uid,
        authorName: viewerName || 'Anonymous',
        authorRole: viewerRole || 'visitor',
        content: commentText.trim(),
        createdAt: new Date().toISOString(),
      });
      if (athleteId !== user.uid) {
        await addDoc(collection(firestore, 'notifications', athleteId, 'items'), {
          type: 'comment',
          actorName: viewerName || 'Someone',
          actorRole: viewerRole || 'visitor',
          message: `commented on your video: "${commentText.trim().substring(0, 60)}${commentText.length > 60 ? '...' : ''}"`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
      setCommentText('');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not post comment.' });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${athleteName} — Talent Graph`,
          text: `Check out ${athleteName}'s highlight on Talent Graph`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied!', description: 'Profile link copied to clipboard.' });
      }
    } catch {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied!', description: 'Profile link copied to clipboard.' });
    }
  };

  const handleRepost = async () => {
    const url = window.location.href;
    const text = `🏆 Check out ${athleteName}'s highlight on Talent Graph!\n\n${url}`;
    await navigator.clipboard.writeText(text);
    toast({ title: 'Repost text copied!', description: 'Paste it anywhere to share.' });
  };

  return (
    <div className="bg-background border-t">
      {/* Counts row */}
      {(likeCount > 0 || (comments && comments.length > 0)) && (
        <div className="flex items-center justify-between px-4 py-2 border-b min-h-[36px]">
          {likeCount > 0 && (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
              <span className="font-bold">{likeCount}</span>{' '}
              {likeCount === 1 ? 'like' : 'likes'}
            </span>
          )}
          {comments && comments.length > 0 && (
            <button
              onClick={() => setShowComments(v => !v)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 px-2 py-1 border-b">
        <Button
          variant="ghost"
          className={`flex-1 gap-1.5 font-bold text-xs h-9 rounded-xl transition-colors ${
            liked
              ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={handleLike}
          disabled={!user || isLiking}
        >
          <Heart className={`w-4 h-4 transition-all ${liked ? 'fill-rose-500 scale-110' : ''}`} />
          {liked ? 'Liked' : 'Like'}
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-1.5 font-bold text-xs h-9 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={() => setShowComments(v => !v)}
        >
          <MessageCircle className="w-4 h-4" />
          Comment
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-1.5 font-bold text-xs h-9 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={handleRepost}
        >
          <Repeat2 className="w-4 h-4" />
          Repost
        </Button>
        <Button
          variant="ghost"
          className="flex-1 gap-1.5 font-bold text-xs h-9 rounded-xl text-muted-foreground hover:text-foreground"
          onClick={handleShare}
        >
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="p-4 space-y-4">
          {user && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 border">
                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                  {getInitials(viewerName || 'You')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComment();
                  }}
                />
                {commentText.trim() && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="gap-2 font-bold"
                      onClick={handleComment}
                      disabled={isCommenting}
                    >
                      {isCommenting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Post
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {commentsLoading ? (
            <p className="text-xs text-muted-foreground text-center py-2">Loading comments...</p>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              <Separator />
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0 border">
                    <AvatarFallback className="text-xs font-bold bg-muted">
                      {getInitials(comment.authorName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 bg-muted/50 rounded-2xl px-4 py-2.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-black">{comment.authorName}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">{comment.authorRole}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : !user ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sign in to comment</p>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Be the first to comment</p>
          )}
        </div>
      )}
    </div>
  );
}
