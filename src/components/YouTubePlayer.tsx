import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Volume2, Maximize, AlertCircle } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  initialTime?: number;
  playbackRate?: number;
  onEnded: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onError?: (error: any) => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  initialTime = 0,
  playbackRate = 1,
  onEnded,
  onTimeUpdate,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const timeIntervalRef = useRef<number | null>(null);
  const endedFiredRef = useRef(false);

  // Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize or update player when videoId changes
  useEffect(() => {
    endedFiredRef.current = false;
    let playerInstance: any = null;
    let isCancelled = false;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        window.onYouTubeIframeAPIReady = () => {
          if (!isCancelled) createPlayer();
        };
        return;
      }
      createPlayer();
    };

    const createPlayer = () => {
      const containerId = 'youtube-iframe-element';
      // If player already exists, load new video
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        try {
          playerRef.current.loadVideoById({
            videoId,
            startSeconds: initialTime > 0 ? initialTime : 0,
          });
          if (playbackRate !== 1) {
            playerRef.current.setPlaybackRate(playbackRate);
          }
          return;
        } catch (e) {
          console.warn('Erro ao carregar novo vídeo, recriando player:', e);
        }
      }

      // Destroy old instance if needed
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }

      playerInstance = new window.YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1,
          modestbranding: 1,
          rel: 0,
          start: Math.floor(initialTime),
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (isCancelled) return;
            playerRef.current = event.target;
            setIsReady(true);
            setLoadError(false);
            if (playbackRate !== 1) {
              event.target.setPlaybackRate(playbackRate);
            }
            if (initialTime > 0) {
              event.target.seekTo(initialTime, true);
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              if (!endedFiredRef.current) {
                endedFiredRef.current = true;
                onEnded();
              }
            }
          },
          onError: (err: any) => {
            console.error('YouTube Player Error:', err);
            setLoadError(true);
            onError?.(err);
          },
        },
      });

      playerRef.current = playerInstance;
    };

    initPlayer();

    return () => {
      isCancelled = true;
      if (timeIntervalRef.current) {
        window.clearInterval(timeIntervalRef.current);
      }
    };
  }, [videoId]);

  // Track playback time
  useEffect(() => {
    if (timeIntervalRef.current) {
      window.clearInterval(timeIntervalRef.current);
    }

    timeIntervalRef.current = window.setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        try {
          const current = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          onTimeUpdate?.(current, dur);
        } catch (e) {}
      }
    }, 1500);

    return () => {
      if (timeIntervalRef.current) {
        window.clearInterval(timeIntervalRef.current);
      }
    };
  }, [onTimeUpdate]);

  // Update playback rate when prop changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch (e) {}
    }
  }, [playbackRate]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      <div id="youtube-iframe-element" className="w-full h-full" />

      {loadError && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-3" />
          <h4 className="text-lg font-semibold text-white mb-1">Vídeo indisponível para incorporação</h4>
          <p className="text-sm text-slate-400 max-w-md mb-4">
            Este vídeo pode estar com restrição de incorporação pelo autor do canal do YouTube.
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
          >
            Assistir direto no YouTube
          </a>
        </div>
      )}
    </div>
  );
};
