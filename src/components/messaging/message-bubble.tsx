'use client';

import { useState, useRef } from 'react';
import type { DirectMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  MoreHorizontal, Copy, Pencil, Trash2, Forward, Check, X, Reply,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  message: DirectMessage;
  isOwn: boolean;
  onEdit: (messageId: string, newContent: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  onForward: (message: DirectMessage) => void;
  senderPhotoUrl?: string;
  senderInitials?: string;
}

export function MessageBubble({
  message,
  isOwn,
  onEdit,
  onDelete,
  onForward,
  senderInitials = '??',
}: Props) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      toast({ title: 'Copied to clipboard' });
    });
  };

  const handleEditStart = () => {
    setEditText(message.content);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleEditSave = async () => {
    if (!editText.trim() || editText.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    await onEdit(message.id, editText.trim());
    setIsEditing(false);
    setIsSaving(false);
  };

  const handleEditCancel = () => {
    setEditText(message.content);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(message.id);
  };

  if (message.isDeleted) {
    return (
      <div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl border border-dashed text-muted-foreground text-sm italic">
          <Trash2 className="w-3.5 h-3.5" />
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-2 group', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mb-1">
          {senderInitials}
        </div>
      )}

      <div className={cn('flex flex-col max-w-[72%]', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && (
          <span className="text-[10px] text-muted-foreground mb-1 px-1 font-bold uppercase tracking-widest">
            {message.senderName}
          </span>
        )}

        {message.forwardedFrom && (
          <div className={cn(
            'w-full mb-1 px-3 py-2 rounded-xl border-l-4 text-xs',
            isOwn
              ? 'bg-primary/5 border-primary/40 text-primary/80'
              : 'bg-muted border-muted-foreground/30 text-muted-foreground'
          )}>
            <div className="flex items-center gap-1 font-bold mb-0.5">
              <Reply className="w-3 h-3" />
              Forwarded from {message.forwardedFrom.originalSenderName}
            </div>
            <p className="truncate opacity-75">{message.forwardedFrom.originalContent}</p>
          </div>
        )}

        <div className="flex items-end gap-1">
          {isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1">
              <MessageActions
                isOwn={isOwn}
                onCopy={handleCopy}
                onEdit={handleEditStart}
                onDelete={handleDelete}
                onForward={() => onForward(message)}
              />
            </div>
          )}

          <div>
            {isEditing ? (
              <div className="space-y-2 min-w-[200px]">
                <Textarea
                  ref={textareaRef}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="text-sm min-h-[60px] resize-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
                    if (e.key === 'Escape') handleEditCancel();
                  }}
                />
                <div className="flex gap-1.5 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleEditCancel}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" className="h-7 px-3" onClick={handleEditSave} disabled={isSaving}>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className={cn(
                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                isOwn
                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                  : 'bg-card border rounded-bl-sm'
              )}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <div className={cn(
                  'flex items-center gap-1.5 mt-1',
                  isOwn ? 'justify-end' : 'justify-start'
                )}>
                  <span className={cn(
                    'text-[10px]',
                    isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  )}>
                    {format(new Date(message.timestamp), 'p')}
                  </span>
                  {message.editedAt && (
                    <span className={cn(
                      'text-[10px] italic',
                      isOwn ? 'text-primary-foreground/50' : 'text-muted-foreground/70'
                    )}>
                      · edited
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {!isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1">
              <MessageActions
                isOwn={isOwn}
                onCopy={handleCopy}
                onEdit={handleEditStart}
                onDelete={handleDelete}
                onForward={() => onForward(message)}
              />
            </div>
          )}
        </div>
      </div>

      {isOwn && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mb-1">
          You
        </div>
      )}
    </div>
  );
}

function MessageActions({
  isOwn,
  onCopy,
  onEdit,
  onDelete,
  onForward,
}: {
  isOwn: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="w-40">
        <DropdownMenuItem onClick={onCopy} className="gap-2 text-xs">
          <Copy className="w-3.5 h-3.5" />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onForward} className="gap-2 text-xs">
          <Forward className="w-3.5 h-3.5" />
          Forward
        </DropdownMenuItem>
        {isOwn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-xs">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-xs text-destructive focus:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
