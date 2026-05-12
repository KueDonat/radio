'use client';
import { useState, useRef } from 'react';

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getBotUrl = () => process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:4000';

  const togglePlay = async () => {
    if (isPlaying) {
      // Stop
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Buat Audio baru saat diklik (bukan saat page load)
      try {
        const audio = new Audio(`${getBotUrl()}/stream`);
        audio.crossOrigin = 'anonymous';
        audioRef.current = audio;
        await audio.play();
        setIsPlaying(true);
        audio.onerror = () => setIsPlaying(false);
      } catch (error) {
        console.error('Playback failed:', error);
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="play-button-overlay" onClick={togglePlay}>
      {isPlaying ? (
        <div style={{width: '20px', height: '20px', display: 'flex', gap: '4px', alignItems: 'center'}}>
          <div style={{width: '6px', height: '20px', backgroundColor: '#000', borderRadius: '2px'}} />
          <div style={{width: '6px', height: '20px', backgroundColor: '#000', borderRadius: '2px'}} />
        </div>
      ) : (
        <div className="play-icon"></div>
      )}
    </div>
  );
}
