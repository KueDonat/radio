'use client';
import { useState, useRef, useEffect } from 'react';

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000';
    audioRef.current = new Audio(`${botUrl}/stream`);
    audioRef.current.crossOrigin = "anonymous";
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    const botUrl = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000';
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.load();
      audioRef.current.src = `${botUrl}/stream`;
      setIsPlaying(false);
    } else {
      try {
        setIsPlaying(true);
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      } catch (error) {
        console.error("Playback failed:", error);
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="play-button-overlay" onClick={togglePlay}>
      {isPlaying ? (
        <div style={{width: '20px', height: '20px', backgroundColor: '#000', display: 'flex', gap: '4px', marginLeft: '2px'}}>
          <div style={{width: '6px', height: '100%', backgroundColor: '#000'}} />
          <div style={{width: '6px', height: '100%', backgroundColor: '#000'}} />
        </div>
      ) : (
        <div className="play-icon"></div>
      )}
    </div>
  );
}
