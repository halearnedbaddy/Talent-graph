'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useFirestore, useAuth, useFirebaseApp } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { compressImage, uploadFileWithProgress, type UploadProgress } from '@/firebase/storage';
import type { AthleteProfile, ShowcaseVideo } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Camera,
  Video,
  Loader2,
  Pencil,
  User,
  CheckCircle2,
  AlertCircle,
  Film,
  Upload,
  X,
  Plus,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.split(' ');
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
}

interface EditProfileMediaDialogProps {
  profile: AthleteProfile;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function EditProfileMediaDialog({ profile, externalOpen, onExternalOpenChange }: EditProfileMediaDialogProps) {
  const firestore = useFirestore();
  const auth = useAuth();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const fullName = `${profile.firstName} ${profile.lastName}`;

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [photoUpload, setPhotoUpload] = useState<UploadProgress | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null);
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoUpload, setVideoUpload] = useState<UploadProgress | null>(null);
  const [pendingVideoUrl, setPendingVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDragOver, setVideoDragOver] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Showcase video state
  const [showcaseFile, setShowcaseFile] = useState<File | null>(null);
  const [showcasePreviewUrl, setShowcasePreviewUrl] = useState<string | null>(null);
  const [showcaseUpload, setShowcaseUpload] = useState<UploadProgress | null>(null);
  const [pendingShowcaseVideo, setPendingShowcaseVideo] = useState<ShowcaseVideo | null>(null);
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseDragOver, setShowcaseDragOver] = useState(false);
  const showcaseInputRef = useRef<HTMLInputElement>(null);

  // Bio state
  const [bio, setBio] = useState('');

  // Reset all state when dialog opens
  const resetState = useCallback(() => {
    setPhotoPreview(profile.photoUrl || '');
    setPhotoUpload(null);
    setIsCompressingPhoto(false);
    setPendingPhotoUrl(null);
    setPhotoDragOver(false);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoUpload(null);
    setPendingVideoUrl(null);
    setVideoTitle(profile.highlightVideoTitle || '');
    setVideoDragOver(false);
    setShowcaseFile(null);
    setShowcasePreviewUrl(null);
    setShowcaseUpload(null);
    setPendingShowcaseVideo(null);
    setShowcaseTitle('');
    setShowcaseDragOver(false);
    setBio(profile.bio || '');
  }, [profile]);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      resetState();
      if (isControlled) onExternalOpenChange?.(true);
      else setInternalOpen(true);
    } else {
      if (isCompressingPhoto || photoUpload?.state === 'running' || videoUpload?.state === 'running') return;
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (isControlled) onExternalOpenChange?.(false);
      else setInternalOpen(false);
    }
  };

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    };
  }, [videoPreviewUrl]);

  const processPhotoFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Please choose an image under 15 MB.' });
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setIsCompressingPhoto(true);
    setPhotoUpload(null);
    setPendingPhotoUrl(null);

    try {
      if (!auth.currentUser) throw new Error('Not signed in');
      const compressed = await compressImage(file, 400, 0.82);
      setIsCompressingPhoto(false);
      setPhotoUpload({ progress: 5, state: 'running' });
      const photoBlob = new File([compressed], 'photo.jpg', { type: 'image/jpeg' });
      const downloadUrl = await uploadFileWithProgress(
        firebaseApp,
        `profile-photos/${profile.uid}/photo.jpg`,
        photoBlob,
        (p) => setPhotoUpload({ ...p, progress: Math.max(5, p.progress) })
      );
      setPendingPhotoUrl(downloadUrl);
      setPhotoPreview(downloadUrl);
    } catch (err: any) {
      setIsCompressingPhoto(false);
      setPhotoUpload({ progress: 0, state: 'error', error: err.message });
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processPhotoFile(file);
    e.target.value = '';
  };

  const handlePhotoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setPhotoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processPhotoFile(file);
  };

  const processVideoFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select a video file.' });
      return;
    }
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    const localUrl = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoPreviewUrl(localUrl);
    setVideoUpload({ progress: 0, state: 'running' });
    setPendingVideoUrl(null);

    try {
      if (!auth.currentUser) throw new Error('Not signed in');
      const ext = file.name.split('.').pop() || 'mp4';
      const downloadUrl = await uploadFileWithProgress(
        firebaseApp,
        `profile-videos/${profile.uid}/highlight.${ext}`,
        file,
        setVideoUpload
      );
      setPendingVideoUrl(downloadUrl);
    } catch (err: any) {
      setVideoUpload({ progress: 0, state: 'error', error: err.message });
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processVideoFile(file);
    e.target.value = '';
  };

  const handleVideoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setVideoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processVideoFile(file);
  };

  const handleClearVideo = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setVideoUpload(null);
    setPendingVideoUrl(null);
  };

  const processShowcaseFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select a video file.' });
      return;
    }
    if (showcasePreviewUrl) URL.revokeObjectURL(showcasePreviewUrl);
    const localUrl = URL.createObjectURL(file);
    setShowcaseFile(file);
    setShowcasePreviewUrl(localUrl);
    setShowcaseUpload({ progress: 0, state: 'running' });
    setPendingShowcaseVideo(null);
    try {
      if (!auth.currentUser) throw new Error('Not signed in');
      const ts = Date.now();
      const ext = file.name.split('.').pop() || 'mp4';
      const downloadUrl = await uploadFileWithProgress(
        firebaseApp,
        `profile-videos/${profile.uid}/showcase_${ts}.${ext}`,
        file,
        setShowcaseUpload
      );
      setPendingShowcaseVideo({
        id: `${ts}`,
        url: downloadUrl,
        title: showcaseTitle.trim() || undefined,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setShowcaseUpload({ progress: 0, state: 'error', error: err.message });
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    }
  };

  const handleShowcaseSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processShowcaseFile(file);
    e.target.value = '';
  };

  const handleShowcaseDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setShowcaseDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processShowcaseFile(file);
  };

  const handleClearShowcase = () => {
    if (showcasePreviewUrl) URL.revokeObjectURL(showcasePreviewUrl);
    setShowcaseFile(null);
    setShowcasePreviewUrl(null);
    setShowcaseUpload(null);
    setPendingShowcaseVideo(null);
  };

  const handleSave = async () => {
    if (!firestore) return;
    setIsSaving(true);
    try {
      const updates: Record<string, any> = {
        bio: bio.trim() || null,
        highlightVideoTitle: videoTitle.trim() || null,
        updatedAt: new Date().toISOString(),
      };
      if (pendingPhotoUrl) updates.photoUrl = pendingPhotoUrl;
      if (pendingVideoUrl) updates.highlightVideoUrl = pendingVideoUrl;

      if (pendingShowcaseVideo) {
        const videoToSave: ShowcaseVideo = {
          ...pendingShowcaseVideo,
          title: showcaseTitle.trim() || pendingShowcaseVideo.title,
        };
        updates.showcaseVideos = arrayUnion(videoToSave);
      }

      await updateDoc(doc(firestore, 'athletes', profile.uid), updates);
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (showcasePreviewUrl) URL.revokeObjectURL(showcasePreviewUrl);
      if (isControlled) onExternalOpenChange?.(false);
      else setInternalOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save changes.' });
    } finally {
      setIsSaving(false);
    }
  };

  const isUploading = isCompressingPhoto || photoUpload?.state === 'running' || videoUpload?.state === 'running' || showcaseUpload?.state === 'running';
  const canSave = !isSaving && (
    bio.trim() !== (profile.bio || '').trim() ||
    videoTitle.trim() !== (profile.highlightVideoTitle || '').trim() ||
    pendingPhotoUrl !== null ||
    pendingVideoUrl !== null ||
    pendingShowcaseVideo !== null
  );

  return (
    <>
      {!isControlled && (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-bold"
          onClick={() => handleOpenChange(true)}
        >
          <Pencil className="w-4 h-4" />
          Edit Profile
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black">Edit Your Profile</DialogTitle>
            <DialogDescription>
              Upload a profile photo, highlight video, and update your bio.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="photo" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="photo" className="flex-1 gap-1 text-xs">
                <Camera className="w-3.5 h-3.5" />
                Photo
              </TabsTrigger>
              <TabsTrigger value="video" className="flex-1 gap-1 text-xs">
                <Video className="w-3.5 h-3.5" />
                Video
              </TabsTrigger>
              <TabsTrigger value="showcase" className="flex-1 gap-1 text-xs">
                <Plus className="w-3.5 h-3.5" />
                Showcase
              </TabsTrigger>
              <TabsTrigger value="bio" className="flex-1 gap-1 text-xs">
                <User className="w-3.5 h-3.5" />
                Bio
              </TabsTrigger>
            </TabsList>

            {/* PHOTO TAB */}
            <TabsContent value="photo" className="space-y-5 mt-5">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {/* Drag & drop zone */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setPhotoDragOver(true); }}
                onDragLeave={() => setPhotoDragOver(false)}
                onDrop={handlePhotoDrop}
                disabled={photoUpload?.state === 'running'}
                className={`
                  w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-4 transition-all
                  ${photoDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                  ${photoUpload?.state === 'running' ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="relative">
                  <Avatar className="h-24 w-24 border-4 border-background shadow-xl rounded-2xl">
                    <AvatarImage src={photoPreview} className="object-cover" />
                    <AvatarFallback className="text-xl font-black rounded-xl bg-neutral-100">
                      {getInitials(fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                {(isCompressingPhoto || photoUpload?.state === 'running') ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isCompressingPhoto ? 'Compressing image…' : 'Uploading…'}
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="font-bold text-sm flex items-center gap-2 justify-center">
                      <Upload className="w-4 h-4" />
                      {photoDragOver ? 'Drop your photo here' : 'Click or drag to upload a photo'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP — max 10 MB. Auto-compressed.</p>
                  </div>
                )}
              </button>

              {/* Upload progress */}
              {(isCompressingPhoto || photoUpload?.state === 'running') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {isCompressingPhoto ? 'Compressing image…' : 'Uploading photo…'}
                    </span>
                    <span>{isCompressingPhoto ? '—' : `${photoUpload?.progress ?? 0}%`}</span>
                  </div>
                  <Progress value={isCompressingPhoto ? undefined : photoUpload?.progress} className="h-2" />
                </div>
              )}

              {photoUpload?.state === 'success' && (
                <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Photo ready — click Save Changes to apply
                </div>
              )}

              {photoUpload?.state === 'error' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {photoUpload.error}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* VIDEO TAB */}
            <TabsContent value="video" className="space-y-5 mt-5">
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                className="hidden"
                onChange={handleVideoSelect}
              />

              <div className="space-y-2">
                <Label className="font-bold">Video Title</Label>
                <Input
                  placeholder="e.g. Season 2024/25 Highlights"
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                />
              </div>

              {/* No video selected yet — drag & drop zone */}
              {!videoFile && (
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setVideoDragOver(true); }}
                  onDragLeave={() => setVideoDragOver(false)}
                  onDrop={handleVideoDrop}
                  className={`
                    w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all
                    ${videoDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                    cursor-pointer
                  `}
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Film className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm flex items-center gap-2 justify-center">
                      <Upload className="w-4 h-4" />
                      {videoDragOver ? 'Drop your video here' : 'Click or drag to upload a highlight video'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV — up to 500 MB</p>
                  </div>
                  {profile.highlightVideoUrl && (
                    <p className="text-[11px] text-muted-foreground bg-muted rounded-lg px-3 py-1">
                      You already have a video. Uploading will replace it.
                    </p>
                  )}
                </button>
              )}

              {/* Video selected — preview + progress */}
              {videoFile && (
                <div className="space-y-3">
                  {/* Video preview player */}
                  {videoPreviewUrl && (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video
                        src={videoPreviewUrl}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                      />
                      {videoUpload?.state !== 'running' && (
                        <button
                          onClick={handleClearVideo}
                          className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black transition-colors"
                          title="Remove video"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* File info */}
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Film className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{videoFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                    {videoUpload?.state !== 'running' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => videoInputRef.current?.click()}
                      >
                        Change
                      </Button>
                    )}
                  </div>

                  {videoUpload?.state === 'running' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Uploading video...
                        </span>
                        <span>{videoUpload.progress}%</span>
                      </div>
                      <Progress value={videoUpload.progress} className="h-2" />
                      <p className="text-[10px] text-muted-foreground">
                        Please keep this dialog open until the upload finishes.
                      </p>
                    </div>
                  )}

                  {videoUpload?.state === 'success' && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      Video ready — click Save Changes to apply
                    </div>
                  )}

                  {videoUpload?.state === 'error' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Upload failed: {videoUpload.error}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => videoFile && processVideoFile(videoFile)}
                      >
                        Retry Upload
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Show existing video if no new one is being uploaded */}
              {!videoFile && profile.highlightVideoUrl && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Current Video</p>
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video
                      src={profile.highlightVideoUrl}
                      controls
                      className="w-full h-full object-contain"
                      preload="metadata"
                    />
                  </div>
                  {profile.highlightVideoTitle && (
                    <p className="text-xs text-muted-foreground text-center">{profile.highlightVideoTitle}</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* SHOWCASE TAB */}
            <TabsContent value="showcase" className="space-y-5 mt-5">
              <input
                ref={showcaseInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                className="hidden"
                onChange={handleShowcaseSelect}
              />

              <div className="space-y-1">
                <p className="text-sm font-bold">Add a Showcase Video</p>
                <p className="text-xs text-muted-foreground">Each video you add is kept separately — nothing gets replaced.</p>
              </div>

              {profile.showcaseVideos && profile.showcaseVideos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Your Showcase ({profile.showcaseVideos.length})</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {profile.showcaseVideos.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 p-2.5 bg-muted/40 rounded-lg">
                        <Film className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-bold truncate flex-1">{v.title || 'Untitled clip'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-bold">Video Title</Label>
                <Input
                  placeholder="e.g. Free-kick compilation"
                  value={showcaseTitle}
                  onChange={e => setShowcaseTitle(e.target.value)}
                />
              </div>

              {!showcaseFile ? (
                <button
                  type="button"
                  onClick={() => showcaseInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setShowcaseDragOver(true); }}
                  onDragLeave={() => setShowcaseDragOver(false)}
                  onDrop={handleShowcaseDrop}
                  className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all
                    ${showcaseDragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'}
                    cursor-pointer`}
                >
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Film className="w-7 h-7 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm flex items-center gap-2 justify-center">
                      <Upload className="w-4 h-4" />
                      {showcaseDragOver ? 'Drop your video here' : 'Click or drag to add a showcase video'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV — up to 500 MB</p>
                  </div>
                </button>
              ) : (
                <div className="space-y-3">
                  {showcasePreviewUrl && (
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video src={showcasePreviewUrl} controls className="w-full h-full object-contain" preload="metadata" />
                      {showcaseUpload?.state !== 'running' && (
                        <button
                          onClick={handleClearShowcase}
                          className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-black transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Film className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{showcaseFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{(showcaseFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                    </div>
                  </div>

                  {showcaseUpload?.state === 'running' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" />Uploading...</span>
                        <span>{showcaseUpload.progress}%</span>
                      </div>
                      <Progress value={showcaseUpload.progress} className="h-2" />
                    </div>
                  )}

                  {showcaseUpload?.state === 'success' && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      Video ready — click Save Changes to add it
                    </div>
                  )}

                  {showcaseUpload?.state === 'error' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        Upload failed: {showcaseUpload.error}
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => showcaseFile && processShowcaseFile(showcaseFile)}>
                        Retry Upload
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* BIO TAB */}
            <TabsContent value="bio" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="font-bold">Bio</Label>
                <Textarea
                  placeholder="Tell scouts and clubs about yourself — your journey, strengths, and goals..."
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={7}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right">{bio.length} / 500</p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-2 border-t mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 font-black"
              onClick={handleSave}
              disabled={!canSave || isUploading}
              title={isUploading ? 'Wait for upload to complete before saving' : undefined}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
