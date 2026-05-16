'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play } from 'lucide-react';

function getYouTubeEmbedUrl(url: string): string | null {
  const regExp =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|watch\?.+&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube.com/embed/${match[2]}?rel=0&modestbranding=1`
    : null;
}

function isDirectVideoUrl(url: string): boolean {
  // Firebase Storage URLs or any direct video file URL
  return (
    url.includes('firebasestorage.googleapis.com') ||
    /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url)
  );
}

interface HighlightVideoProps {
  videoUrl: string;
  videoTitle?: string;
  sport?: string;
}

export function HighlightVideo({ videoUrl, videoTitle, sport }: HighlightVideoProps) {
  if (!videoUrl) return null;

  const youtubeEmbed = getYouTubeEmbedUrl(videoUrl);
  const isDirect = isDirectVideoUrl(videoUrl) || (!youtubeEmbed);

  return (
    <Card className="shadow-xl bg-background border-none overflow-hidden">
      <CardHeader className="bg-neutral-950 px-6 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-primary fill-primary" />
            {videoTitle || 'Highlight Reel'}
          </CardTitle>
          {sport && (
            <Badge className="bg-primary/20 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest">
              {sport}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 bg-black">
        {youtubeEmbed ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={youtubeEmbed}
              title={videoTitle || 'Athlete Highlight Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        ) : (
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-[480px] bg-black"
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        )}
      </CardContent>
    </Card>
  );
}
